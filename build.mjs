#!/usr/bin/env node
/**
 * Build de l'application Boost'Étude.
 *
 * Recolle les modules de src/app/ dans l'ordre de src/ordre.json, les insère
 * entre les deux moitiés de la coquille HTML, et écrit dist/index.html avec
 * les fichiers statiques de public/.
 *
 * Deux garde-fous :
 *  - `--verifier` compare la sortie à l'empreinte de référence (le fichier qui
 *    tournait en production au moment de la mise sous Git) : tant qu'on n'a rien
 *    voulu changer, la sortie doit être identique à l'octet près ;
 *  - la version et la date de build sont injectées dans la page, pour qu'on sache
 *    toujours quelle version tourne — ce qui manquait le jour où un déploiement
 *    a écrasé un mois de travail.
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, copyFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const racine = join(dirname(fileURLToPath(import.meta.url)));
const lire = (...p) => readFileSync(join(racine, ...p), "utf8");

const pkg = JSON.parse(lire("package.json"));
const ordre = JSON.parse(lire("src", "ordre.json"));

const modules = ordre.map(nom => {
  const chemin = join(racine, "src", "app", nom);
  if (!existsSync(chemin)) throw new Error(`module manquant : ${nom}`);
  return readFileSync(chemin, "utf8");
});

const code = modules.join("");
let page = lire("src", "shell-haut.html") + code + lire("src", "shell-bas.html");

const verifier = process.argv.includes("--verifier");

// L'estampille de version ne s'applique qu'aux vrais builds : en mode
// vérification on compare le recollage brut à la référence.
if (!verifier) {
  const estampille = `window.__APP_VERSION = ${JSON.stringify(pkg.version)};\n`
                   + `window.__APP_BUILD = ${JSON.stringify(new Date().toISOString().slice(0, 10))};\n`;
  page = page.replace("<script>// ─── SUPABASE", "<script>" + estampille + "// ─── SUPABASE");
}

mkdirSync(join(racine, "dist"), { recursive: true });
writeFileSync(join(racine, "dist", "index.html"), page, "utf8");

for (const f of existsSync(join(racine, "public")) ? readdirSync(join(racine, "public")) : []) {
  // Le service worker porte le numéro de version dans le nom de son cache : une
  // mise à jour ouvre un cache neuf et efface l'ancien, au lieu de les mélanger.
  if (f === "sw.js") {
    const sw = readFileSync(join(racine, "public", f), "utf8").replaceAll("__VERSION__", pkg.version);
    writeFileSync(join(racine, "dist", f), sw);
    continue;
  }
  copyFileSync(join(racine, "public", f), join(racine, "dist", f));
}

const empreinte = createHash("sha256").update(page).digest("hex");
console.log(`dist/index.html — ${page.length} caractères`);
console.log(`sha256          — ${empreinte}`);

if (verifier) {
  const attendue = lire("reference.sha256").trim();
  if (empreinte === attendue) {
    console.log("✅ identique à la version de production prise comme référence");
  } else {
    console.error("❌ la sortie diffère de la référence");
    process.exit(1);
  }
}
