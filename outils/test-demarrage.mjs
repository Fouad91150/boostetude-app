/**
 * Démarre l'application complète — montage compris — dans un vrai navigateur.
 *
 * Les tests unitaires chargent le script dans un `new Function` : ils vérifient la
 * logique, pas le démarrage. Une variable déclarée deux fois, une parenthèse en
 * trop, et la page reste blanche sans qu'aucun test ne bronche. Ce script comble
 * ce trou : un serveur local sert la vraie page, React et le service worker comme
 * chez l'utilisateur ; seul Supabase est simulé, pour ne pas dépendre du réseau.
 */
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const racine = join(dirname(fileURLToPath(import.meta.url)), "..");

const FICHIERS = {
  "/react.js": join(racine, "node_modules/react/umd/react.production.min.js"),
  "/react-dom.js": join(racine, "node_modules/react-dom/umd/react-dom.production.min.js"),
  "/sw.js": join(racine, "dist/sw.js")
};

// Le client Supabase, simulé : on veut éprouver le code de l'application.
// Supabase simulé, mais avec une vraie session d'administrateur et des données
// ressemblantes : c'est APRÈS la connexion que l'application fait le gros du travail,
// et donc là qu'elle peut casser sans qu'un test unitaire s'en aperçoive.
// Les données réelles de la base, extraites pour reproduire exactement ce que
// l'application doit avaler au démarrage. Un jeu simplifié ne révèle pas les cas
// particuliers — un élève sans groupe, une facture sans date, un prof orphelin.
const DONNEES = JSON.parse(readFileSync(join(racine, ".apercu", "donnees-reelles.json"), "utf8"));

const STUB = `window.__D = ${JSON.stringify(DONNEES)};
window.supabase={createClient:function(){
  function req(table){
    var lignes = (window.__D[table] || []).slice();
    // On se connecte en administrateur : c'est le rôle de Fouad, et celui dont
    // dépendent les écrans qui ont changé (factures, relances, réglages).
    if (table === "profs") lignes = lignes.filter(function(p){ return p.role === "admin" }).concat(lignes);
    var r = {};
    ["select","order","eq","neq","in","is","gte","lte","gt","lt","limit"].forEach(function(m){ r[m]=function(){return r} });
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

let page = readFileSync(join(racine, "dist", "index.html"), "utf8")
  .replace(/<script src="https:\/\/cdn\.jsdelivr\.net[^"]*"><\/script>/, '<script src="/supabase.js"></script>')
  .replace(/<script src="https:\/\/unpkg\.com\/react@18[^"]*"><\/script>/, '<script src="/react.js"></script>')
  .replace(/<script src="https:\/\/unpkg\.com\/react-dom@18[^"]*"><\/script>/, '<script src="/react-dom.js"></script>')
  // Les polices Google ne se chargent pas d'ici et bloqueraient le démarrage.
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
const o = await nav.newPage({ viewport: { width: 414, height: 900 } });

const erreurs = [];
o.on("pageerror", e => erreurs.push("💥 " + e.message));
o.on("console", m => {
  if (m.type() === "error" && !/favicon|ERR_/.test(m.text())) erreurs.push("⚠️  " + m.text());
});

await o.goto(adresse, { waitUntil: "domcontentloaded", timeout: 20000 });
await o.waitForTimeout(2000);

// Chaque onglet est visité : une erreur ne se produit souvent qu'à l'affichage
// d'un écran précis, et personne ne la voit avant l'utilisateur.
const ONGLETS = ["Accueil", "Élèves", "Appel", "Suivi", "Bilans", "Factures", "Réglages"];
for (const nom of ONGLETS) {
  const bouton = o.locator(`button:has-text("${nom}")`).last();
  if (await bouton.count()) {
    await bouton.click().catch(() => {});
    await o.waitForTimeout(500);
    // Dans la facturation, on parcourt aussi les sous-onglets.
    for (const sous of ["Relances", "Historique", "Gérer"]) {
      const b2 = o.locator(`button:has-text("${sous}")`).first();
      if (await b2.count()) { await b2.click().catch(() => {}); await o.waitForTimeout(400); }
    }
  }
}

const texte = await o.evaluate(() => (document.body.innerText || "").replace(/\s+/g, " ").slice(0, 180));
const monte = await o.evaluate(() => (document.getElementById("root") || document.body).innerHTML.length);
await o.screenshot({ path: join(racine, ".apercu", "13-demarrage.png") });
await nav.close();
serveur.close();

console.log(erreurs.length ? "ERREURS AU DÉMARRAGE :\n  " + [...new Set(erreurs)].slice(0, 8).join("\n  ")
                           : "✅ aucune erreur au démarrage");
console.log(`\nContenu monté : ${monte} caractères`);
console.log(`Écran : ${JSON.stringify(texte)}`);
process.exit(erreurs.length ? 1 : 0);
