/** Aperçu de l'onglet « Gérer » : quatre factures dans quatre états différents. */
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

const D = {
  ELEVES: [
    { id:"e1", prenom:"Nour Meissane", nom:"Sebbar", niveau:"2nde", th:15, parent:"Mme Sebbar", tel:"06 12 34 56 78", email:"", mp:"Virement", actif:true },
    { id:"e2", prenom:"Insaf", nom:"Zouhair", niveau:"2nde", th:15, parent:"M. Zouhair", tel:"06 22 33 44 55", email:"", mp:"Espèces", actif:true },
    { id:"e3", prenom:"Rachid", nom:"Saadi", niveau:"4ème", th:12.5, parent:"Mme Saadi", tel:"06 33 44 55 66", email:"", mp:"Chèque", actif:true },
    { id:"e4", prenom:"Imran", nom:"Oubidane", niveau:"2nde", th:15, parent:"Mme Oubidane", tel:"06 44 55 66 77", email:"", mp:"Virement", actif:true }
  ],
  FACTURES: [
    { id:"f1", eleveId:"e1", nbSeances:3, montant:90, encaisse:90, statut:"paye", mode:"Espèces",
      numero:"F2026-0002", dateEmission:"2026-10-02", periodeDebut:"2026-09-18", notes:"",
      datesSeances:[{date:"2026-09-18",matiere:"Mathématiques"},{date:"2026-09-23",matiere:"Mathématiques"},{date:"2026-09-30",matiere:"Mathématiques"}] },
    { id:"f2", eleveId:"e2", nbSeances:3, montant:90, encaisse:50, statut:"partiel", mode:"Espèces",
      numero:"F2026-0001", dateEmission:"2026-10-02", periodeDebut:"2026-09-18", notes:"",
      datesSeances:[{date:"2026-09-18",matiere:"Mathématiques"}] },
    { id:"f3", eleveId:"e3", nbSeances:2, montant:50, encaisse:0, statut:"en_attente", mode:"Chèque",
      numero:null, dateEmission:null, periodeDebut:"2026-09-22", notes:"",
      datesSeances:[{date:"2026-09-22",matiere:"Mathématiques"}] },
    { id:"f4", eleveId:"e4", nbSeances:3, montant:90, encaisse:0, statut:"annulee", mode:"Virement",
      numero:"F2026-0003", dateEmission:"2026-10-02", periodeDebut:"2026-09-18", notes:"[Annulée : élève absent]",
      datesSeances:[{date:"2026-09-18",matiere:"Mathématiques"}] }
  ],
  PARAMS: { denomination:"Boost'Étude", exploitant:"Elmkhanter Fouad", forme_juridique:"EI",
    siret:"53433388500034", ape:"85.59B", adresse:"7 avenue des Meuniers", code_postal:"91150", ville:"Étampes",
    telephone:"07 44 94 45 02", email:"boostetude@gmail.com", iban:"FR76 0000 0000 0000 0000 0000 000",
    mention_tva:"TVA non applicable, article 293 B du CGI", prefixe_facture:"F", seuil_facturation:3 }
};

const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">${styles}
<style>body{margin:0;background:#0a1428;font-family:Inter,system-ui,sans-serif;color:#fafaf7}
#r{max-width:600px;margin:0 auto;padding:16px}</style>
</head><body><div id="r"></div>
<script>${react}</script><script>${reactDom}</script>
<script>window.supabase={createClient:function(){return {from:function(){var r={};["select","order","eq","neq","in","gte","lte","insert","update","upsert","delete"].forEach(function(m){r[m]=function(){return r}});r.then=function(f){return Promise.resolve({data:[],error:null}).then(f)};return r},rpc:function(){return Promise.resolve({data:null,error:null})},auth:{getSession:function(){return Promise.resolve({data:{}})},onAuthStateChange:function(){return {data:{subscription:{unsubscribe:function(){}}}}}}}}};</script>
<script>${script}</script>
<script>
  const D = ${JSON.stringify(D)};
  function Demo() {
    const el = React.useRef(null);
    React.useEffect(() => {
      // On bascule sur l'onglet Gérer dès l'affichage.
      const b = Array.from(document.querySelectorAll("button")).find(x => /Gérer/.test(x.textContent));
      if (b) b.click();
    }, []);
    return React.createElement(React.Fragment, null,
      React.createElement(PileBandeaux, null),
      React.createElement(ModuleFacturation, {
        eleves: D.ELEVES, groupes: [], appels: {}, factures: D.FACTURES, parametres: D.PARAMS,
        encaissements: [],
        onSaveFacture: async () => {}, onDeleteFacture: async () => {},
        onDeleteFactureEnCours: async () => {}, onEmettreFacture: async () => "F2026-0004",
        onRecharger: async () => {}, onAjouterVersement: async () => {}, onSupprimerVersement: async () => {},
        onAnnulerFacture: async () => {}, onRetablirFacture: async () => {} }));
  }
  ReactDOM.createRoot(document.getElementById("r")).render(React.createElement(Demo));
</script></body></html>`;
const fichier = join(sortie, "gerer.html");
writeFileSync(fichier, html);
const nav = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const onglet = await nav.newPage({ viewport: { width: 414, height: 1100 }, deviceScaleFactor: 2 });
const erreurs = [];
onglet.on("pageerror", e => erreurs.push(e.message));
onglet.on("console", m => { if (m.type() === "error") erreurs.push(m.text()); });
await onglet.goto("file://" + fichier);
await onglet.waitForTimeout(700);
await onglet.screenshot({ path: join(sortie, "11-gerer.png"), fullPage: true });
await nav.close();
console.log(erreurs.length ? "⚠️ " + erreurs.join("\n") : "✅ aucune erreur de page");
