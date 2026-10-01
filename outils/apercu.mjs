/**
 * Aperçu visuel hors navigateur réel.
 *
 * Les tests disent que le code fait ce qu'on attend ; ils ne disent pas si
 * l'écran est lisible. Ce script monte le vrai module d'appel, avec le vrai
 * script construit, dans un Chromium, et photographie les écrans qui comptent.
 * Supabase n'est jamais appelé : le module reçoit ses données en props.
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

const GROUPES = [
  { id: "g1", nom: "3e", matiere: "Mathématiques", niveau: "3ème", jour: "Lundi", hd: "18:00", hf: "20:00", max: 6, eids: ["e1", "e2", "e3", "e4", "e5"] },
  { id: "g2", nom: "Seconde 1", matiere: "Mathématiques", niveau: "2nde", jour: "Mardi", hd: "18:00", hf: "20:00", max: 6, eids: ["e6", "e7"] },
  { id: "g3", nom: "Primaire", matiere: "Mathématiques", niveau: "CM2", jour: "Mercredi", hd: "14:00", hf: "16:00", max: 6, eids: [] },
  { id: "g4", nom: "Terminale maths", matiere: "Mathématiques", niveau: "Terminale", jour: "Vendredi", hd: "18:00", hf: "20:00", max: 6, eids: [] }
];
const ELEVES = [
  ["e1", "Hawa", "Sall"], ["e2", "Faty", "Sall"], ["e3", "Cameron", "Elwin"],
  ["e4", "Ilyes", "Nassi"], ["e5", "Abigaelle", "Gourouvin"],
  ["e6", "Imran", "Oubidane"], ["e7", "Shayma", "Tissir"]
].map(([id, prenom, nom]) => ({
  id, prenom, nom, niveau: "3ème", th: 15, actif: true,
  parent: `Parent de ${prenom}`, tel: "06 00 00 00 00", email: "", mp: "Virement"
}));
// Deux séances déjà renseignées : de quoi faire apparaître les raccourcis de notions.
const COMPTES_RENDUS = [
  { id: "c1", groupe_id: "g1", eleve_id: "e1", date: "2026-09-22", notions: "Théorème de Pythagore, Racines carrées", difficultes: "", progres: "", devoirs: "" },
  { id: "c2", groupe_id: "g1", eleve_id: "e2", date: "2026-09-29", notions: "Trigonométrie", difficultes: "", progres: "", devoirs: "" }
];

const html = `<!doctype html>
<html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Aperçu</title>
${styles}
<style>body{margin:0;background:#0a1428;font-family:Inter,system-ui,sans-serif;color:#fafaf7}
#r{max-width:600px;margin:0 auto;padding:16px}</style>
</head><body><div id="r"></div>
<script>${react}</script>
<script>${reactDom}</script>
<script>window.supabase={createClient:function(){return {from:function(){var r={};["select","order","eq","neq","in","gte","lte","insert","update","upsert","delete"].forEach(function(m){r[m]=function(){return r}});r.then=function(f){return Promise.resolve({data:[],error:null}).then(f)};r.maybeSingle=function(){return Promise.resolve({data:null,error:null})};return r},rpc:function(){return Promise.resolve({data:null,error:null})},auth:{getSession:function(){return Promise.resolve({data:{}})},onAuthStateChange:function(){return {data:{subscription:{unsubscribe:function(){}}}}}}}}};</script>
<script>${script}</script>
<script>
  const DONNEES = ${JSON.stringify({ GROUPES, ELEVES, COMPTES_RENDUS })};
  ReactDOM.createRoot(document.getElementById("r")).render(
    React.createElement(React.Fragment, null,
      React.createElement(PileBandeaux, null),
      React.createElement(ModuleAppel, {
        eleves: DONNEES.ELEVES, groupes: DONNEES.GROUPES, appels: {},
        comptesRendus: DONNEES.COMPTES_RENDUS, monProfilId: "p1",
        onSaveAppel: async () => {}, onSaveComptesRendus: async () => {},
        onSaveGroupe: async () => {}, isAdmin: true, profs: [],
        onAllerSuivi: () => {}
      })));
</script></body></html>`;

const fichier = join(sortie, "appel.html");
writeFileSync(fichier, html);

const navigateur = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const onglet = await navigateur.newPage({ viewport: { width: 414, height: 900 }, deviceScaleFactor: 2 });
const erreurs = [];
onglet.on("pageerror", e => erreurs.push(e.message));
onglet.on("console", m => { if (m.type() === "error") erreurs.push(m.text()); });

await onglet.goto("file://" + fichier);
await onglet.waitForTimeout(500);

// 1. La liste des groupes : les pourvus devant, les vides repliés.
await onglet.screenshot({ path: join(sortie, "1-groupes.png"), fullPage: true });

// 2. On déplie les groupes sans élève.
await onglet.getByText(/groupes? sans élève inscrit/).click();
await onglet.waitForTimeout(250);
await onglet.screenshot({ path: join(sortie, "2-groupes-vides.png"), fullPage: true });
await onglet.getByText(/groupes? sans élève inscrit/).click();

// 3. L'appel d'un groupe.
await onglet.getByText("3e", { exact: false }).first().click();
await onglet.waitForTimeout(300);
await onglet.screenshot({ path: join(sortie, "3-appel.png"), fullPage: true });

// 4. L'écran de fin de séance : la question posée sur place.
const bouton = onglet.getByRole("button", { name: /Enregistrer/i }).first();
await bouton.click();
await onglet.waitForTimeout(600);
await onglet.screenshot({ path: join(sortie, "4-fin-de-seance.png"), fullPage: true });

// 5. Rempli, comme il le sera en vrai.
await onglet.getByPlaceholder(/Théorème de Pythagore/).fill("Trigonométrie : cosinus dans le triangle rectangle");
await onglet.getByPlaceholder(/Confusion entre/).fill("Repérage du côté adjacent selon l'angle choisi");
await onglet.getByPlaceholder(/Exercices 20/).fill("Exercices 14 à 17 page 102");
await onglet.waitForTimeout(200);
await onglet.screenshot({ path: join(sortie, "5-fin-de-seance-rempli.png"), fullPage: true });

await navigateur.close();

console.log(erreurs.length ? "⚠️  erreurs page :\n  " + erreurs.join("\n  ") : "✅ aucune erreur de page");
console.log("Captures dans .apercu/");
