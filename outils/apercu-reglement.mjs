/** Aperçu de l'écran de règlement : facture de 90 €, 50 € déjà versés. */
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

const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">${styles}
<style>body{margin:0;background:#0a1428;font-family:Inter,system-ui,sans-serif;color:#fafaf7}</style>
</head><body><div id="r"></div>
<script>${react}</script><script>${reactDom}</script>
<script>window.supabase={createClient:function(){return {from:function(){var r={};["select","order","eq","neq","in","gte","lte","insert","update","upsert","delete"].forEach(function(m){r[m]=function(){return r}});r.then=function(f){return Promise.resolve({data:[],error:null}).then(f)};return r},rpc:function(){return Promise.resolve({data:null,error:null})},auth:{getSession:function(){return Promise.resolve({data:{}})},onAuthStateChange:function(){return {data:{subscription:{unsubscribe:function(){}}}}}}}}};</script>
<script>${script}</script>
<script>
  const ELEVE = { id:"e1", prenom:"Nour Meissane", nom:"Sebbar", niveau:"2nde", th:15,
                  parent:"Mme Sebbar", tel:"06 12 34 56 78", email:"", mp:"Virement", actif:true };
  const FACTURE = { id:"f1", eleveId:"e1", nbSeances:3, montant:90, encaisse:50, statut:"partiel",
                    mode:"Espèces", numero:"F2026-0002", dateEmission:"2026-10-02", notes:"",
                    datesSeances:[{date:"2026-09-18",matiere:"Mathématiques"},{date:"2026-09-23",matiere:"Mathématiques"},{date:"2026-09-30",matiere:"Mathématiques"}] };
  const ENC = [{ id:"v1", factureId:"f1", date:"2026-09-30", montant:50, mode:"Espèces", note:"" }];
  ReactDOM.createRoot(document.getElementById("r")).render(
    React.createElement(React.Fragment, null,
      React.createElement(PileBandeaux, null),
      React.createElement(ModaleFacture, {
        eleve: ELEVE, existante: FACTURE, dates: FACTURE.datesSeances, encaissements: ENC,
        onAjouterVersement: async () => {}, onSupprimerVersement: async () => {},
        onSave: async () => {}, onClose: () => {} })));
</script></body></html>`;
const fichier = join(sortie, "reglement.html");
writeFileSync(fichier, html);
const nav = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const onglet = await nav.newPage({ viewport: { width: 414, height: 1000 }, deviceScaleFactor: 2 });
const erreurs = [];
onglet.on("pageerror", e => erreurs.push(e.message));
await onglet.goto("file://" + fichier);
await onglet.waitForTimeout(500);
await onglet.screenshot({ path: join(sortie, "10-reglement.png"), fullPage: true });
await nav.close();
console.log(erreurs.length ? "⚠️ " + erreurs.join("\n") : "✅ aucune erreur de page");
