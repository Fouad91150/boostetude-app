/**
 * Chaque onglet de la barre du bas mène quelque part.
 *
 * Écrit après coup : en retirant l'onglet Bilans, la découpe a emporté le bloc
 * d'affichage des Stages qui le suivait. L'onglet restait dans la barre, mais
 * ne montrait plus rien — et rien, dans les tests, ne s'en est aperçu. Ce
 * fichier ferme ce trou : un onglet déclaré doit avoir son écran.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const racine = join(dirname(fileURLToPath(import.meta.url)), "..");
const script = readFileSync(join(racine, "dist", "index.html"), "utf8")
  .match(/<script>([\s\S]*?)<\/script>/)[1];

// Les clés déclarées dans les deux barres (administrateur et professeur).
const onglets = [...script.matchAll(/\{\s*k:\s*"([a-z]+)",\s*\n\s*i:\s*"/g)].map(m => m[1]);

describe("La barre de navigation", () => {
  test("elle déclare les onglets attendus", () => {
    const attendus = ["dashboard", "eleves", "appel", "suivi", "factures", "stages", "reglages"];
    attendus.forEach(k => assert.ok(onglets.includes(k), `onglet manquant : ${k}`));
    assert.ok(!onglets.includes("bilans"), "l'onglet Bilans a été retiré");
  });

  test("chaque onglet déclaré a son écran", () => {
    const orphelins = [...new Set(onglets)].filter(k => !script.includes(`tab === "${k}"`));
    assert.deepEqual(orphelins, [], `onglets sans écran : ${orphelins.join(", ")}`);
  });

  test("chaque onglet déclaré a son titre", () => {
    const sansTitre = [...new Set(onglets)].filter(k => !new RegExp(`\\n\\s*${k}: "`).test(script));
    assert.deepEqual(sansTitre, [], `onglets sans titre : ${sansTitre.join(", ")}`);
  });

  test("un professeur ne voit ni la facturation ni les réglages", () => {
    // La seconde barre, celle du rôle « prof », s'arrête après le suivi.
    const barreProf = script.slice(script.indexOf("}] : [{"), script.indexOf("const TITRES"));
    ["factures", "stages", "reglages", "eleves", "dashboard"].forEach(k =>
      assert.ok(!barreProf.includes(`k: "${k}"`), `un professeur ne doit pas voir « ${k} »`));
  });
});
