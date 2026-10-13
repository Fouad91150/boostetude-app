// Reçoit les paiements Stripe et les enregistre comme versements : la facture
// passe toute seule à « payée » (le déclencheur recalcule son solde).
// Pas de JWT ici : l'authenticité vient de la signature Stripe, vérifiée ci-dessous.
import { createClient } from "jsr:@supabase/supabase-js@2";

const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
const egal = (a: string, b: string) => {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
};
async function signatureValide(brut: string, entete: string, secret: string) {
  const parts = Object.fromEntries(entete.split(",").map((p) => p.split("=") as [string, string]).filter((p) => p.length === 2));
  const t = parts["t"];
  const v1s = entete.split(",").filter((p) => p.startsWith("v1=")).map((p) => p.slice(3));
  if (!t || !v1s.length) return false;
  if (Math.abs(Date.now() / 1000 - Number(t)) > 600) return false; // 10 min de tolérance
  const cle = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const attendu = hex(await crypto.subtle.sign("HMAC", cle, new TextEncoder().encode(`${t}.${brut}`)));
  return v1s.some((v) => egal(v, attendu));
}
// Date du paiement au calendrier de Paris (livre des recettes).
const dateParis = (sec: number) =>
  new Intl.DateTimeFormat("fr-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(sec * 1000));

Deno.serve(async (req) => {
  const brut = await req.text();
  const secret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  if (!secret || !(await signatureValide(brut, req.headers.get("stripe-signature") ?? "", secret))) {
    return new Response("signature invalide", { status: 400 });
  }
  const evt = JSON.parse(brut);
  if (evt.type !== "checkout.session.completed" && evt.type !== "checkout.session.async_payment_succeeded") {
    return new Response("ignoré", { status: 200 });
  }
  const s = evt.data.object;
  if (s.payment_status !== "paid") return new Response("pas encore payé", { status: 200 });
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  let factureId = s.metadata?.facture_id;
  if (!factureId && s.payment_link) {
    const { data } = await db.from("paiements").select("id").eq("stripe_lien_id", s.payment_link).maybeSingle();
    factureId = data?.id;
  }
  if (!factureId) return new Response("paiement sans facture", { status: 200 });
  const { error } = await db.from("encaissements").insert({
    facture_id: factureId,
    date: dateParis(s.created),
    montant: (s.amount_total ?? 0) / 100,
    mode: "Carte bancaire",
    note: "Payé en ligne (Stripe)",
    stripe_ref: s.id,
  });
  // 23505 = déjà enregistré (Stripe renvoie parfois l'événement) : c'est un succès.
  if (error && error.code !== "23505") return new Response(error.message, { status: 500 });
  return new Response("ok", { status: 200 });
});
