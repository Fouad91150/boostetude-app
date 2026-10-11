/**
 * Les dates doivent tenir quel que soit le fuseau de la machine.
 *
 * Jusqu'en 3.3.0, les semaines des bilans commençaient le DIMANCHE sur un
 * téléphone réglé à l'heure de Paris : toISOString() repassait en UTC et
 * reculait chaque date d'un jour. Les tests tournaient en UTC et ne voyaient
 * rien. On rejoue donc les tests de dates sous plusieurs fuseaux.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const racine = join(dirname(fileURLToPath(import.meta.url)), "..");
const fichiers = ["tests/suivi-bilans.test.js", "tests/relances-remises.test.js"];

for (const tz of ["Europe/Paris", "UTC", "America/Guadeloupe", "Indian/Reunion", "Pacific/Auckland"]) {
  test(`dates justes en ${tz}`, () => {
    const r = spawnSync(process.execPath, ["--test", ...fichiers], {
      cwd: racine, env: { ...process.env, TZ: tz }, encoding: "utf8"
    });
    assert.equal(r.status, 0, r.stdout.split("\n").filter(l => /not ok|expected|actual/.test(l)).join("\n"));
  });
}
