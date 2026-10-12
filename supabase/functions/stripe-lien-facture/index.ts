// Boost'Étude — crée le lien de paiement Stripe d'une facture, au montant exact
// du reste à payer. Réservé à l'administrateur. La clé Stripe vit dans le secret
// STRIPE_SECRET_KEY, jamais dans l'application.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const repondre = (corps: unknown, statut = 200) =>
  new Response(JSON.stringify(corps), {
    status: statut,
    headers: { ...CORS, "Content-Type": "application/json" },
  });

async function stripe(chemin: string, params?: Record<string, string>) {
  const cle = Deno.env.get("STRIPE_SECRET_KEY");
  if (!cle) throw new Error("Clé Stripe absente : renseigner le secret STRIPE_SECRET_KEY dans Supabase.");
  const r = await fetch(`https://api.stripe.com/v1/${chemin}`, {
    method: params ? "POST" : "GET",
    headers: {
      Authorization: `Bearer ${cle}`,
      ...(params ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
    },
    body: params ? new URLSearchParams(params) : undefined,
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d?.error?.message ?? `Erreur Stripe ${r.status}`);
  return d;
}

const arrondi = (x: number) => Math.round(x * 100) / 100;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return repondre({ erreur: "Méthode non permise" }, 405);

  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const auth = req.headers.get("Authorization") ?? "";

    // 1. Seul l'administrateur peut créer un lien de paiement
    const client = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: auth } },
    });
    const { data: admin, error: errAdmin } = await client.rpc("est_admin");
    if (errAdmin || admin !== true) return repondre({ erreur: "Accès réservé à l'administrateur" }, 403);

    const { facture_id } = await req.json().catch(() => ({}));
    if (!facture_id) return repondre({ erreur: "facture_id manquant" }, 400);

    // 2. Lecture de la facture (clé de service : la RLS a déjà été vérifiée ci-dessus)
    const sb = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: f, error: errF } = await sb
      .from("paiements")
      .select("id, eleve_id, numero, montant, montant_encaisse, statut, stripe_lien_id, stripe_lien_url, stripe_lien_montant")
      .eq("id", facture_id)
      .maybeSingle();
    if (errF) throw errF;
    if (!f) return repondre({ erreur: "Facture introuvable" }, 404);
    if (!f.numero) return repondre({ erreur: "La facture doit être émise avant d'être payée en ligne" }, 400);
    if (String(f.statut ?? "").startsWith("annul")) return repondre({ erreur: "Facture annulée" }, 400);

    const reste = arrondi(Number(f.montant ?? 0) - Number(f.montant_encaisse ?? 0));
    if (reste <= 0) return repondre({ erreur: "Facture déjà soldée" }, 400);

    // 3. Un lien existe déjà pour ce montant : on le réutilise
    if (f.stripe_lien_id && f.stripe_lien_url && arrondi(Number(f.stripe_lien_montant)) === reste) {
      const lien = await stripe(`payment_links/${f.stripe_lien_id}`);
      if (lien.active) return repondre({ url: f.stripe_lien_url, montant: reste, reutilise: true });
    }

    // 4. Un ancien lien à un autre montant : on le coupe
    if (f.stripe_lien_id) {
      try { await stripe(`payment_links/${f.stripe_lien_id}`, { active: "false" }); } catch (_) { /* déjà inactif */ }
    }

    const { data: e } = await sb.from("eleves").select("prenom, nom").eq("id", f.eleve_id).maybeSingle();
    const enfant = [e?.prenom, e?.nom].filter(Boolean).join(" ").trim();

    // 5. Prix au montant exact, puis lien à usage unique
    const prix = await stripe("prices", {
      currency: "eur",
      unit_amount: String(Math.round(reste * 100)),
      "product_data[name]": `Facture ${f.numero}${enfant ? " — " + enfant : ""}`,
    });

    const lien = await stripe("payment_links", {
      "line_items[0][price]": prix.id,
      "line_items[0][quantity]": "1",
      "metadata[facture_id]": f.id,
      "metadata[numero]": f.numero,
      "payment_intent_data[metadata][facture_id]": f.id,
      "payment_intent_data[description]": `Boost'Étude — facture ${f.numero}`,
      "restrictions[completed_sessions][limit]": "1",
      "after_completion[type]": "hosted_confirmation",
      "after_completion[hosted_confirmation][custom_message]":
        `Merci ! Le règlement de la facture ${f.numero} est bien reçu. — Boost'Étude`,
      "inactive_message": `Cette facture est déjà réglée, ou ce lien a été remplacé. Contactez Boost'Étude.`,
      submit_type: "pay",
    });

    const { error: errMaj } = await sb
      .from("paiements")
      .update({ stripe_lien_id: lien.id, stripe_lien_url: lien.url, stripe_lien_montant: reste })
      .eq("id", f.id);
    if (errMaj) throw errMaj;

    return repondre({ url: lien.url, montant: reste, reutilise: false });
  } catch (err) {
    return repondre({ erreur: (err as Error).message }, 500);
  }
});
