/**
 * Photographie chaque écran de l'application, l'un après l'autre.
 *
 * Une refonte visuelle ne se vérifie pas en lisant du code : il faut regarder.
 * Ce script sert la vraie page avec les vraies données, visite tous les onglets
 * et dépose une capture par écran dans .apercu/ — de quoi repérer d'un coup
 * d'œil un texte blanc sur blanc ou un bouton devenu illisible.
 */
import { readFileSync, mkdirSync } from "node:fs";
import { createServer } from "node:http";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const racine = join(dirname(fileURLToPath(import.meta.url)), "..");
const sortie = join(racine, ".apercu");
mkdirSync(sortie, { recursive: true });

const FICHIERS = {
  "/react.js": join(racine, "node_modules/react/umd/react.production.min.js"),
  "/react-dom.js": join(racine, "node_modules/react-dom/umd/react-dom.production.min.js"),
  "/sw.js": join(racine, "dist/sw.js")
};

const DONNEES = JSON.parse(readFileSync(join(racine, ".apercu", "donnees-reelles.json"), "utf8"));
// Deux stages pour que l'écran ne soit pas vide : un à venir, un terminé.
const jour = n => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
DONNEES.stages = [
  { id: "st1", nom: "Stage Toussaint — révisions brevet", niveau: "3ème", matiere: "Mathématiques",
    date_debut: jour(12), date_fin: jour(16), horaire: "10h–12h", tarif: 189, places: 8, notes: "" },
  { id: "st2", nom: "Stage de Pâques — seconde", niveau: "2nde", matiere: "Mathématiques",
    date_debut: jour(-40), date_fin: jour(-36), horaire: "14h–16h", tarif: 229, places: 6, notes: "" }
];
// Un taux horaire sur chaque professeur, pour que l'écran des rémunérations
// montre autre chose que des zéros.
(DONNEES.profs || []).forEach(p => { p.taux_horaire = 25; });
const premiers = (DONNEES.eleves || []).slice(0, 3);
DONNEES.stages_inscrits = premiers.map((e, i) => ({
  id: `si${i}`, stage_id: "st1", eleve_id: e.id, tarif: 189, facture_id: null
}));

const STUB = `window.__D = ${JSON.stringify(DONNEES)};
window.supabase={createClient:function(){
  function req(table){
    var lignes = (window.__D[table] || []).slice();
    if (table === "profs") lignes = lignes.filter(function(p){ return p.role === "admin" }).concat(lignes);
    var r = {};
    ["select","order","eq","neq","in","is","gte","lte","gt","lt","limit","range"].forEach(function(m){ r[m]=function(){return r} });
    ["insert","update","upsert","delete"].forEach(function(m){ r[m]=function(){ lignes=[]; return r } });
    r.maybeSingle=function(){ return Promise.resolve({data: lignes[0] || null, error:null}) };
    r.single=function(){ return Promise.resolve({data: lignes[0] || null, error:null}) };
    r.then=function(f,g){ return Promise.resolve({data: lignes, error:null}).then(f,g) };
    return r }
  return {from:req, rpc:function(){return Promise.resolve({data:"F2026-0003",error:null})},
    auth:{getSession:function(){return Promise.resolve({data:{session:{user:{id:"u1"}}}})},
          onAuthStateChange:function(cb){ setTimeout(function(){cb("SIGNED_IN",{user:{id:"u1"}})},10);
            return {data:{subscription:{unsubscribe:function(){}}}} },
          signInWithPassword:function(){return Promise.resolve({error:null})},
          signOut:function(){return Promise.resolve()}}}}};`;

const page = readFileSync(join(racine, "dist", "index.html"), "utf8")
  .replace(/<script src="https:\/\/cdn\.jsdelivr\.net[^"]*"><\/script>/, '<script src="/supabase.js"></script>')
  .replace(/<script src="https:\/\/unpkg\.com\/react@18[^"]*"><\/script>/, '<script src="/react.js"></script>')
  .replace(/<script src="https:\/\/unpkg\.com\/react-dom@18[^"]*"><\/script>/, '<script src="/react-dom.js"></script>')
  .replace(/<link[^>]*fonts\.(googleapis|gstatic)\.com[^>]*>/g, "");

const serveur = createServer((req, res) => {
  const chemin = req.url.split("?")[0];
  if (chemin === "/supabase.js") {
    res.writeHead(200, { "content-type": "text/javascript; charset=utf-8" });
    return res.end(STUB);
  }
  if (FICHIERS[chemin]) {
    res.writeHead(200, { "content-type": "text/javascript; charset=utf-8" });
    return res.end(readFileSync(FICHIERS[chemin]));
  }
  res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  res.end(page);
}).listen(0);

const adresse = "http://127.0.0.1:" + serveur.address().port + "/";
const nav = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const o = await nav.newPage({ viewport: { width: 414, height: 1000 }, deviceScaleFactor: 2 });

const erreurs = [];
o.on("pageerror", e => erreurs.push("💥 " + e.message));
o.on("console", m => {
  if (m.type() === "error" && !/favicon|ERR_|fonts/.test(m.text())) erreurs.push("⚠️  " + m.text());
});

await o.goto(adresse, { waitUntil: "domcontentloaded", timeout: 20000 });
await o.waitForTimeout(2200);

const ECRANS = [
  ["accueil", "Accueil", null],
  ["eleves", "Élèves", null],
  ["appel", "Appel", null],
  ["suivi", "Suivi", null],
  ["factures", "Factures", null],
  ["factures-relances", "Factures", "Relances"],
  ["factures-gerer", "Factures", "Gérer"],
  ["stages", "Stages", null],
  ["reglages", "Réglages", null],
  ["reglages-profs", "Réglages", "Professeurs"]
];

for (const [nom, onglet, sous] of ECRANS) {
  const b = o.locator(`button:has-text("${onglet}")`).last();
  if (await b.count()) {
    await b.click().catch(() => {});
    await o.waitForTimeout(600);
  }
  if (sous) {
    const b2 = o.locator(`button:has-text("${sous}")`).first();
    if (await b2.count()) { await b2.click().catch(() => {}); await o.waitForTimeout(500); }
  }
  await o.screenshot({ path: join(sortie, `v3-${nom}.png`), fullPage: false });
}

await nav.close();
serveur.close();
console.log(erreurs.length ? "ERREURS :\n  " + [...new Set(erreurs)].slice(0, 8).join("\n  ")
                           : "✅ aucune erreur");
console.log(`${ECRANS.length} captures dans .apercu/`);
