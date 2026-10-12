// Boost'Étude — reçoit les notifications de Stripe et enregistre le versement
// sur la bonne facture.
//
// Sécurité : on ne croit jamais le contenu reçu. On n'en lit que l'identifiant de
// l'événement, puis on va le relire CHEZ Stripe avec la clé secrète. Un faux
// événement n'existe pas chez Stripe et ne passe donc pas.
// Idempotence : un paiement porte sa référence Stripe (index unique), une
// notification répétée ne crée pas de second versement.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const ok = (msg: string) => new Response(JSON.stringify({ recu: true, info: msg }), {
  headers: { "Content-Type": "application/json" },
});

async function stripe(chemin: string) {
  const cle = Deno.env.get("STRIPE_SECRET_KEY");
  if (!cle) throw new Error("STRIPE_SECRET_KEY absente");
  const r = await fetch(`https://api.stripe.com/v1/${chemin}`, {
    headers: { Authorization: `Bearer ${cle}` },
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d?.error?.message ?? `Erreur Stripe ${r.status}`);
  return d;
}

const jourParis = (secondes: number) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(new Date(secondes * 1000));

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Méthode non permise", { status: 405 });

  const recu = await req.json().catch(() => null);
  const id = recu?.id;
  if (typeof id !== "string" || !id.startsWith("evt_")) {
    return new Response("Événement invalide", { status: 400 });
  }

  try {
    // Relecture authentique chez Stripe
    const evt = await stripe(`events/${id}`);
    const types = ["checkout.session.completed", "checkout.session.async_payment_succeeded"];
    if (!types.includes(evt.type)) return ok("type ignoré");

    const session = evt.data.object;
    if (session.payment_status !== "paid") return ok("paiement pas encore confirmé");

    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Retrouver la facture : par le lien, sinon par la métadonnée du paiement
    let factureId: string | null = null;
    if (session.payment_link) {
      const { data } = await sb.from("paiements").select("id").eq("stripe_lien_id", session.payment_link).maybeSingle();
      factureId = data?.id ?? null;
    }
    if (!factureId && session.payment_intent) {
      const pi = await stripe(`payment_intents/${session.payment_intent}`);
      factureId = pi?.metadata?.facture_id ?? null;
    }
    if (!factureId) return ok("paiement hors facture (ancien lien générique ?) — à pointer à la main");

    const montant = Math.round(Number(session.amount_total ?? 0)) / 100;
    if (montant <= 0) return ok("montant nul");

    const payeur = session.customer_details?.name ? ` — ${session.customer_details.name}` : "";
    const { error } = await sb.from("encaissements").insert({
      facture_id: factureId,
      date: jourParis(evt.created),
      montant,
      mode: "Carte",
      note: `Paiement en ligne Stripe${payeur}`,
      stripe_ref: session.id,
    });
    if (error) {
      if (error.code === "23505") return ok("déjà enregistré");
      throw error;
    }
    return ok("versement enregistré");
  } catch (err) {
    // 500 : Stripe réessaiera plus tard
    return new Response(JSON.stringify({ erreur: (err as Error).message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
