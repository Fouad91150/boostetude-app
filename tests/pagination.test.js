/**
 * Supabase ne rend jamais plus de 1 000 lignes par réponse. Au-delà, les
 * présences arrivaient tronquées et la facturation se recalculait sur une
 * partie de l'année. `toutLire` doit tout ramener, page après page.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { chargerApp } from "./charger-app.js";

const tableDe = n => Array.from({ length: n }, (_, i) => ({ id: String(i).padStart(5, "0") }));
const requeteSur = lignes => () => {
  const r = { order: () => r, range: (de, a) => Promise.resolve({ data: lignes.slice(de, a + 1), error: null }) };
  return r;
};

test("2 500 lignes reviennent toutes, en trois pages", async () => {
  const { toutLire } = chargerApp();
  const { data } = await toutLire(requeteSur(tableDe(2500)));
  assert.equal(data.length, 2500);
});

test("exactement 1 000 lignes : une page pleine puis une vide", async () => {
  const { toutLire } = chargerApp();
  const { data } = await toutLire(requeteSur(tableDe(1000)));
  assert.equal(data.length, 1000);
});

test("une erreur remonte au lieu d'un résultat partiel", async () => {
  const { toutLire } = chargerApp();
  const r = await toutLire(() => ({ order() { return this; }, range: () => Promise.resolve({ data: null, error: new Error("refus") }) }));
  assert.equal(r.data, null);
  assert.equal(r.error.message, "refus");
});
