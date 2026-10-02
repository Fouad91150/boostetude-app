/**
 * Aperçu de l'écran de facture, tel qu'il s'affiche sur un téléphone.
 * Monte la vraie VueImpression avec le script construit, Supabase court-circuité.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const racine = join(dirname(fileURLToPath(import.meta.url)), "..");
const sortie = join(racine, ".apercu");
mkdirSync(sortie, { recursive: true });

const page = readFileSync(join(racine, "dist", "index.html"), "utf8");
let script = page.match(/<script>([\s\S]*?)<\/script>/)[1];
script = script.slice(0, script.indexOf("// ─── MONTAGE"));

const react = readFileSync(join(racine, "node_modules/react/umd/react.development.js"), "utf8");
const reactDom = readFileSync(join(racine, "node_modules/react-dom/umd/react-dom.development.js"), "utf8");
const styles = (page.match(/<style>[\s\S]*?<\/style>/g) || []).join("\n");

const ELEVE = {
  id: "e1", prenom: "Hawa", nom: "Sall", niveau: "3ème", th: 12.5,
  parent: "Aminata Sall", tel: "06 12 34 56 78", email: "aminata@mail.fr",
  mp: "Virement", actif: true
};
const FACTURE = {
  id: "f1", eleveId: "e1", nbSeances: 3, montant: 75, statut: "en_attente", mode: "Virement",
  datePaiement: "", notes: "", periodeDebut: "2026-09-15", periodeFin: null,
  numero: "F2026-0001", dateEmission: "2026-10-02",
  datesSeances: [
    { date: "2026-09-15", matiere: "Mathématiques" },
    { date: "2026-09-22", matiere: "Mathématiques" },
    { date: "2026-09-29", matiere: "Physique-Chimie" }
  ],
  mois: "2026-09"
};
const PARAMS = {
  denomination: "Boost'Étude", exploitant: "Elmkhanter Fouad", forme_juridique: "EI",
  siret: "53433388500034", ape: "85.59B",
  adresse: "7 avenue des Meuniers", code_postal: "91150", ville: "Étampes",
  telephone: "07 44 94 45 02", email: "boostetude@gmail.com",
  iban: "FR76 0000 0000 0000 0000 0000 000", bic: "XXXXFRPP", titulaire_compte: "Elmkhanter Fouad",
  mention_tva: "TVA non applicable, article 293 B du CGI",
  delai_paiement: "Paiement à réception de la facture.",
  penalites_retard: "En cas de retard de paiement, une pénalité égale à trois fois le taux d'intérêt légal est exigible, ainsi qu'une indemnité forfaitaire de 40 € pour frais de recouvrement.",
  escompte: "Aucun escompte n'est accordé pour paiement anticipé.",
  prefixe_facture: "F", seuil_facturation: 3
};

const html = `<!doctype html>
<html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Aperçu facture</title>
${styles}
<style>body{margin:0;background:#0a1428;font-family:Inter,system-ui,sans-serif;color:#fafaf7}</style>
</head><body><div id="r"></div>
<script>${react}</script>
<script>${reactDom}</script>
<script>window.supabase={createClient:function(){return {from:function(){var r={};["select","order","eq","neq","in","gte","lte","insert","update","upsert","delete"].forEach(function(m){r[m]=function(){return r}});r.then=function(f){return Promise.resolve({data:[],error:null}).then(f)};return r},rpc:function(){return Promise.resolve({data:null,error:null})},auth:{getSession:function(){return Promise.resolve({data:{}})},onAuthStateChange:function(){return {data:{subscription:{unsubscribe:function(){}}}}}}}}};</script>
<script>${script}</script>
<script>
  const D = ${JSON.stringify({ ELEVE, FACTURE, PARAMS })};
  ReactDOM.createRoot(document.getElementById("r")).render(
    React.createElement(React.Fragment, null,
      React.createElement(PileBandeaux, null),
      React.createElement(VueImpression, {
        facture: D.FACTURE, eleve: D.ELEVE, parametres: D.PARAMS,
        onClose: () => {}, onEmettre: async () => {}
      })));
</script></body></html>`;

const fichier = join(sortie, "facture.html");
writeFileSync(fichier, html);

const navigateur = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const onglet = await navigateur.newPage({ viewport: { width: 414, height: 1000 }, deviceScaleFactor: 2 });
const erreurs = [];
onglet.on("pageerror", e => erreurs.push(e.message));
onglet.on("console", m => { if (m.type() === "error") erreurs.push(m.text()); });

await onglet.goto("file://" + fichier);
await onglet.waitForTimeout(500);
await onglet.screenshot({ path: join(sortie, "6-facture-envoi.png"), clip: { x: 0, y: 0, width: 414, height: 520 } });

// L'aperçu du message WhatsApp, tel que le parent le recevra.
await onglet.getByText("💬 WhatsApp").locator("xpath=following-sibling::button[1]").click();
await onglet.waitForTimeout(300);
await onglet.screenshot({ path: join(sortie, "7-message-whatsapp.png"), clip: { x: 0, y: 0, width: 414, height: 700 } });

await navigateur.close();
console.log(erreurs.length ? "⚠️  erreurs page :\n  " + erreurs.join("\n  ") : "✅ aucune erreur de page");
