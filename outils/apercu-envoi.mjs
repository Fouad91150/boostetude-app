/**
 * Vérifie l'enchaînement « un clic » de bout en bout, dans un vrai navigateur :
 * le bouton Envoyer doit émettre la facture, fabriquer le PDF et appeler le partage
 * du système avec le fichier ET le message — sans écran intermédiaire.
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

const ELEVES = [
  { id: "e1", prenom: "Hawa", nom: "Sall", niveau: "3ème", th: 12.5, parent: "Aminata Sall",
    tel: "06 12 34 56 78", email: "aminata@mail.fr", mp: "Virement", actif: true },
  { id: "e2", prenom: "Imran", nom: "Oubidane", niveau: "2nde", th: 15, parent: "Leila Oubidane",
    tel: "06 98 76 54 32", email: "", mp: "Espèces", actif: true }
];
const FACTURES = [
  { id: "f1", eleveId: "e1", nbSeances: 3, montant: 90, statut: "en_attente", mode: "Virement",
    datePaiement: "", notes: "", periodeDebut: "2026-09-15", periodeFin: null,
    numero: "F2026-0002", dateEmission: "2026-10-02",
    datesSeances: [
      { date: "2026-09-15", matiere: "Mathématiques" },
      { date: "2026-09-22", matiere: "Mathématiques" },
      { date: "2026-09-29", matiere: "Mathématiques" }],
    mois: "2026-09" },
  { id: "f2", eleveId: "e2", nbSeances: 1, montant: 30, statut: "en_attente", mode: "Espèces",
    datePaiement: "", notes: "", periodeDebut: "2026-09-29", periodeFin: null, numero: null, dateEmission: null,
    datesSeances: [{ date: "2026-09-29", matiere: "Mathématiques" }], mois: "2026-09" }
];
const PARAMS = {
  denomination: "Boost'Étude", exploitant: "Elmkhanter Fouad", forme_juridique: "EI",
  siret: "53433388500034", ape: "85.59B", adresse: "7 avenue des Meuniers",
  code_postal: "91150", ville: "Étampes", telephone: "07 44 94 45 02", email: "boostetude@gmail.com",
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
<title>Aperçu envoi</title>
${styles}
<style>body{margin:0;background:#0a1428;font-family:Inter,system-ui,sans-serif;color:#fafaf7}
#r{max-width:600px;margin:0 auto;padding:16px}</style>
</head><body><div id="r"></div>
<script>${react}</script>
<script>${reactDom}</script>
<script>
  window.__journal = [];
  window.supabase={createClient:function(){return {from:function(){var r={};["select","order","eq","neq","in","gte","lte","insert","update","upsert","delete"].forEach(function(m){r[m]=function(){return r}});r.then=function(f){return Promise.resolve({data:[],error:null}).then(f)};return r},rpc:function(){return Promise.resolve({data:null,error:null})},auth:{getSession:function(){return Promise.resolve({data:{}})},onAuthStateChange:function(){return {data:{subscription:{unsubscribe:function(){}}}}}}}}};
  // On remplace la confirmation et le partage du système pour observer l'enchaînement.
  window.confirm = function(texte){ window.__journal.push({ etape: "confirmation", texte: texte }); return true; };
  navigator.canShare = function(d){ return !!(d && d.files && d.files.length); };
  navigator.share = async function(d){
    const f = d.files[0];
    window.__journal.push({ etape: "partage", fichier: f.name, type: f.type, taille: f.size, texte: d.text });
    window.__pdf = await f.arrayBuffer().then(b => Array.from(new Uint8Array(b.slice(0, 8))));
  };
</script>
<script>${script}</script>
<script>
  const D = ${JSON.stringify({ ELEVES, FACTURES, PARAMS })};
  function Demo() {
    return React.createElement(React.Fragment, null,
      React.createElement(PileBandeaux, null),
      React.createElement(ModuleFacturation, {
        eleves: D.ELEVES, groupes: [], appels: {}, factures: D.FACTURES,
        parametres: D.PARAMS,
        onSaveFacture: async () => {}, onDeleteFacture: async () => {},
        onDeleteFactureEnCours: async () => {},
        onEmettreFacture: async (id, opts) => {
          window.__journal.push({ etape: "emission", id: id, recharger: !opts || opts.recharger !== false });
          await new Promise(r => setTimeout(r, 120));   // la requête à la base
          return "F2026-0001";
        },
        onRecharger: async () => { window.__journal.push({ etape: "rechargement" }); }
      }));
  }
  ReactDOM.createRoot(document.getElementById("r")).render(React.createElement(Demo));
</script></body></html>`;

const fichier = join(sortie, "envoi.html");
writeFileSync(fichier, html);

const navigateur = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const onglet = await navigateur.newPage({ viewport: { width: 414, height: 900 }, deviceScaleFactor: 2 });
const erreurs = [];
onglet.on("pageerror", e => erreurs.push(e.message));
onglet.on("console", m => { if (m.type() === "error") erreurs.push(m.text()); });

await onglet.goto("file://" + fichier);
await onglet.waitForTimeout(400);
await onglet.screenshot({ path: join(sortie, "8-a-envoyer.png"), fullPage: true });

// Le geste unique.
const bouton = onglet.getByRole("button", { name: /Partager la facture PDF/ }).first();
await bouton.scrollIntoViewIfNeeded();
await bouton.click();
await onglet.waitForTimeout(900);
await onglet.screenshot({ path: join(sortie, "9-apres-envoi.png"), fullPage: true });

const journal = await onglet.evaluate(() => window.__journal);
const entete = await onglet.evaluate(() => window.__pdf);
await navigateur.close();

console.log(erreurs.length ? "⚠️  erreurs page :\n  " + erreurs.join("\n  ") : "✅ aucune erreur de page");
console.log("\nEnchaînement observé :");
journal.forEach((e, i) => {
  if (e.etape === "partage") {
    console.log(`  ${i + 1}. partage — ${e.fichier} (${e.type}, ${e.taille} octets)`);
    console.log(`     message : ${String(e.texte).split("\n")[0]} …`);
  } else if (e.etape === "confirmation") {
    console.log(`  ${i + 1}. confirmation — « ${String(e.texte).split("\n")[0]} »`);
  } else if (e.etape === "emission") {
    console.log(`  ${i + 1}. émission — recharge aussitôt : ${e.recharger}`);
  } else {
    console.log(`  ${i + 1}. ${e.etape}`);
  }
});
const signature = (entete || []).map(o => String.fromCharCode(o)).join("");
console.log(`\nEn-tête du fichier partagé : ${signature.trim()} ${signature.startsWith("%PDF") ? "✅" : "❌"}`);
