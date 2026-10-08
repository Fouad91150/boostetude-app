/**
 * Le thème clair, et les pièges qu'il tend.
 *
 * Une refonte de couleurs se défait vite : il suffit d'une carte recopiée d'un
 * ancien écran pour réintroduire un fond translucide blanc — invisible sur du
 * blanc — ou un bouton bleu nuit dont le texte est resté bleu nuit. Ces
 * vérifications-là ne remplacent pas le coup d'œil, mais elles attrapent les
 * deux fautes qui ne se voient pas en lisant le code.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const racine = join(dirname(fileURLToPath(import.meta.url)), "..");
const page = readFileSync(join(racine, "dist", "index.html"), "utf8");
const script = page.match(/<script>([\s\S]*?)<\/script>/)[1];

describe("Le thème clair tient", () => {
  test("la page s'ouvre sur un fond clair", () => {
    assert.match(page, /body\{[^}]*background:#f3f4f8/);
    assert.match(page, /color:#121c2e/);
  });

  test("plus aucun aplat blanc translucide — il serait invisible sur du blanc", () => {
    const restes = script.match(/rgba\(255,255,255,\.\d+\)/g) || [];
    // L'en-tête bleu nuit a le droit d'y poser ses propres aplats.
    const horsEntete = restes.filter(x => !["rgba(255,255,255,.14)", "rgba(255,255,255,.12)", "rgba(255,255,255,.72)"].includes(x));
    assert.deepEqual(horsEntete, [], `à reprendre : ${[...new Set(horsEntete)].join(", ")}`);
  });

  test("aucun texte bleu nuit sur un bouton bleu nuit", () => {
    // `background: C.navy` suivi, dans le même bloc de style, de `color: C.navy`.
    const fautes = [];
    const re = /background: C\.navy\b[\s\S]{0,320}?\}/g;
    let m;
    while ((m = re.exec(script))) {
      if (/color: C\.navy\b/.test(m[0])) fautes.push(m[0].slice(0, 80));
    }
    assert.deepEqual(fautes, [], "un bouton bleu nuit doit écrire en blanc");
  });

  test("les champs de saisie restent à 16 px", () => {
    // En dessous, le téléphone zoome tout seul dès qu'on touche le champ.
    assert.match(page, /input,select,textarea\{font-size:16px/);
  });

  test("les polices de la charte sont chargées", () => {
    assert.match(page, /Playfair\+Display/);
    assert.match(page, /family=Inter/);
  });
});
