/** Aperçu de l'onglet Relances : trois factures d'ancienneté croissante. */
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
const jours = n => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0,10); };

const D = {
  ELEVES: [
    { id:"e1", prenom:"Nour Meissane", nom:"Sebbar", niveau:"2nde", th:15, parent:"Mme Sebbar", tel:"06 12 34 56 78", email:"", mp:"Virement", actif:true },
    { id:"e2", prenom:"Insaf", nom:"Zouhair", niveau:"2nde", th:15, parent:"M. Zouhair", tel:"06 22 33 44 55", email:"", mp:"Espèces", actif:true },
    { id:"e3", prenom:"Hawa", nom:"Sall", niveau:"3ème", th:10, thBase:12.5, remise:2.5, parent:"Mme Sall", tel:"06 03 33 65 96", email:"", mp:"Espèces", actif:true }
  ],
  FACTURES: [
    { id:"f1", eleveId:"e1", nbSeances:3, montant:90, encaisse:0, statut:"en_attente", numero:"F2026-0002",
      dateEmission: jours(22), derniereRelance:null, periodeDebut:"2026-09-18",
      datesSeances:[{date:"2026-09-18",matiere:"Mathématiques"}] },
    { id:"f2", eleveId:"e2", nbSeances:3, montant:90, encaisse:50, statut:"partiel", numero:"F2026-0001",
      dateEmission: jours(9), derniereRelance: jours(2), periodeDebut:"2026-09-18",
      datesSeances:[{date:"2026-09-18",matiere:"Mathématiques"}] },
    { id:"f3", eleveId:"e3", nbSeances:4, montant:80, encaisse:0, statut:"en_attente", numero:"F2026-0004",
      dateEmission: jours(3), derniereRelance:null, periodeDebut:"2026-09-25",
      datesSeances:[{date:"2026-09-25",matiere:"Mathématiques"}] }
  ],
  PARAMS: { denomination:"Boost'Étude", exploitant:"Elmkhanter Fouad", siret:"53433388500034", ape:"85.59B",
    adresse:"7 avenue des Meuniers", code_postal:"91150", ville:"Étampes", seuil_facturation:3, remise_multi:2.5 }
};

const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">${styles}
<style>body{margin:0;background:#0a1428;font-family:Inter,system-ui,sans-serif;color:#fafaf7}
#r{max-width:600px;margin:0 auto;padding:16px}</style></head><body><div id="r"></div>
<script>${react}</script><script>${reactDom}</script>
<script>window.supabase={createClient:function(){return {from:function(){var r={};["select","order","eq","neq","in","gte","lte","insert","update","upsert","delete"].forEach(function(m){r[m]=function(){return r}});r.then=function(f){return Promise.resolve({data:[],error:null}).then(f)};return r},rpc:function(){return Promise.resolve({data:null,error:null})},auth:{getSession:function(){return Promise.resolve({data:{}})},onAuthStateChange:function(){return {data:{subscription:{unsubscribe:function(){}}}}}}}}};</script>
<script>${script}</script>
<script>
  const D = ${JSON.stringify(D)};
  ReactDOM.createRoot(document.getElementById("r")).render(
    React.createElement(React.Fragment, null,
      React.createElement(PileBandeaux, null),
      React.createElement(ModuleFacturation, {
        eleves: D.ELEVES, groupes: [], appels: {}, factures: D.FACTURES, parametres: D.PARAMS,
        encaissements: [], ongletInitial: "relances",
        onSaveFacture: async()=>{}, onDeleteFacture: async()=>{}, onDeleteFactureEnCours: async()=>{},
        onEmettreFacture: async()=>"F", onRecharger: async()=>{}, onAjouterVersement: async()=>{},
        onSupprimerVersement: async()=>{}, onAnnulerFacture: async()=>{}, onRetablirFacture: async()=>{},
        onRelancer: async()=>{} })));
</script></body></html>`;
const fichier = join(sortie, "relances.html");
writeFileSync(fichier, html);
const nav = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const onglet = await nav.newPage({ viewport: { width: 414, height: 900 }, deviceScaleFactor: 2 });
const err = [];
onglet.on("pageerror", e => err.push(e.message));
onglet.on("console", m => { if (m.type()==="error") err.push(m.text()); });
await onglet.goto("file://" + fichier);
await onglet.waitForTimeout(600);
await onglet.screenshot({ path: join(sortie, "12-relances.png"), fullPage: true });
await nav.close();
console.log(err.length ? "⚠️ " + err.join("\n") : "✅ aucune erreur de page");
