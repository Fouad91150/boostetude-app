import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const racine = join(dirname(fileURLToPath(import.meta.url)), "..");
const lire = (...p) => readFileSync(join(racine, ...p), "utf8");

/**
 * Le dossier dist/ est versionné et publié tel quel par Netlify, sans build côté
 * hébergeur. Il peut donc se désynchroniser des sources — c'est exactement le
 * piège qui a coûté un mois de travail en septembre, quand une ancienne copie a
 * été déployée sans que personne le remarque.
 *
 * Ce test recolle les modules et compare au fichier publié. Il échoue dès qu'on
 * s'apprête à commiter des sources modifiées sans avoir relancé `npm run build`.
 */
const recoller = () => {
  const ordre = JSON.parse(lire("src", "ordre.json"));
  const code = ordre.map(nom => lire("src", "app", nom)).join("");
  return lire("src", "shell-haut.html") + code + lire("src", "shell-bas.html");
};

// La date de build change à chaque exécution : on la neutralise avant de comparer.
const neutraliser = s => s
  .replace(/window\.__APP_VERSION = "[^"]*";\n/, "")
  .replace(/window\.__APP_BUILD = "[^"]*";\n/, "");

describe("Cohérence du dossier publié", () => {
  test("dist/index.html correspond aux sources", () => {
    assert.ok(existsSync(join(racine, "dist", "index.html")),
      "dist/index.html est absent — lancez `npm run build`");
    assert.equal(
      neutraliser(lire("dist", "index.html")),
      neutraliser(recoller()),
      "dist/index.html ne correspond plus aux sources — lancez `npm run build` avant de commiter"
    );
  });

  test("la version publiée est celle de package.json", () => {
    const pkg = JSON.parse(lire("package.json"));
    const publiee = lire("dist", "index.html").match(/window\.__APP_VERSION = "([^"]+)"/);
    assert.ok(publiee, "la page publiée doit porter son numéro de version");
    assert.equal(publiee[1], pkg.version);
  });

  test("les fichiers statiques sont tous publiés", () => {
    const attendus = readdirSync(join(racine, "public"));
    const publies = readdirSync(join(racine, "dist"));
    for (const f of attendus) {
      assert.ok(publies.includes(f), `${f} manque dans dist/`);
    }
    for (const f of ["manifest.json", "sw.js", "icon-192.png"]) {
      assert.ok(publies.includes(f), `${f} est indispensable à l'installation sur téléphone`);
    }
  });

  test("aucun secret ne part dans le fichier public", () => {
    const page = lire("dist", "index.html");
    assert.ok(!page.includes("service_role"), "la clé service_role ne doit jamais être exposée");
    // La clé anon est publique par construction ; c'est RLS qui protège les données.
    const jetons = page.match(/eyJ[A-Za-z0-9_\-.]{20,}/g) || [];
    for (const jeton of jetons) {
      const charge = JSON.parse(Buffer.from(jeton.split(".")[1], "base64url").toString());
      assert.equal(charge.role, "anon", "seule une clé de rôle « anon » peut figurer dans la page");
    }
    assert.ok(!/FR\d{2}[ ]?\d{4}[ ]?\d{4}/.test(page), "aucun IBAN ne doit être écrit en dur");
  });
});
