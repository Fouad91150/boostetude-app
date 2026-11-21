/**
 * Tarif spécial (21/11/2026) : moitié prix (Marwa paie une séance sur deux),
 * gratuit (Sarah Saaidi, un enfant de la famille Delaa : aucune facture).
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { chargerApp, eleveType, factureType } from "./charger-app.js";

const app = chargerApp();
const MATHS = { id: "gm", matiere: "Mathématiques", eids: ["e1"] };
const present = (...cles) => Object.fromEntries(cles.map(k => [k, { e1: "present" }]));
const APPELS = present("ap:gm:2026-11-03", "ap:gm:2026-11-10");

describe("Tarif spécial", () => {
  test("lu depuis la base : absent = normal, 0,5 = moitié, 0 = gratuit", () => {
    const base = { id: "x", prenom: "A", nom: "B", niveau: "2nde" };
    assert.equal(app.normalizeEleveDB(base).part, 1);
    assert.equal(app.normalizeEleveDB({ ...base, part_payee: 0.5 }).part, 0.5);
    assert.equal(app.normalizeEleveDB({ ...base, part_payee: 0 }).part, 0);
    assert.equal(app.LIBELLE_PART(0.5), "Moitié prix");
  });

  test("moitié prix : le tarif horaire est divisé par deux, après remise", () => {
    const [m] = app.appliquerPart([{ ...eleveType, th: 15, part: 0.5 }]);
    assert.equal(m.th, 7.5);
    assert.equal(app.montantSeances([{ date: "2026-11-03" }, { date: "2026-11-10" }], m.th), 30);
  });

  test("moitié prix : le brouillon existant est réaligné", () => {
    const [m] = app.appliquerPart([{ ...eleveType, id: "e1", th: 15, actif: true, part: 0.5 }]);
    const b = factureType({ id: "b", eleveId: "e1", nbSeances: 2, montant: 60, encaisse: 0,
      datesSeances: [{ date: "2026-11-03", matiere: "Mathématiques", groupeId: "gm" }, { date: "2026-11-10", matiere: "Mathématiques", groupeId: "gm" }] });
    const r = app.brouillonsEnRetard([m], [MATHS], APPELS, [b]);
    assert.equal(r.length, 1);
    assert.equal(r[0].montant, 30);
  });

  test("gratuit : aucune facture créée, et un brouillon sans versement est retiré", () => {
    const g = { ...eleveType, id: "e1", th: 15, actif: true, part: 0 };
    assert.deepEqual(app.brouillonsEnRetard([g], [MATHS], APPELS, []), []);
    const b = factureType({ id: "b", eleveId: "e1", nbSeances: 2, montant: 60, encaisse: 0 });
    const r = app.brouillonsEnRetard([g], [MATHS], APPELS, [b]);
    assert.equal(r.length, 1);
    assert.deepEqual(r[0].dates, []);
  });

  test("gratuit : un brouillon qui a déjà reçu de l'argent n'est pas touché", () => {
    const g = { ...eleveType, id: "e1", th: 15, actif: true, part: 0 };
    const b = factureType({ id: "b", eleveId: "e1", nbSeances: 2, montant: 60, encaisse: 30 });
    assert.deepEqual(app.brouillonsEnRetard([g], [MATHS], APPELS, [b]), []);
  });

  test("fratrie : l'enfant gratuit ne donne pas la remise à l'autre", () => {
    const g = [{ id: "gm", matiere: "Mathématiques", eids: ["a", "b"] }];
    const enfants = [
      { ...eleveType, id: "a", prenom: "A", nom: "Delaa", th: 15, actif: true, part: 1 },
      { ...eleveType, id: "b", prenom: "B", nom: "Delaa", th: 15, actif: true, part: 0 },
    ];
    const r = app.appliquerRemiseMulti(enfants, g, 2.5);
    assert.equal(r[0].th, 15, "le payant garde son tarif");
  });
});

describe("Tarif spécial rangé dans les notes (sans colonne Supabase)", () => {
  const base = { id: "x", prenom: "A", nom: "B", niveau: "2nde" };
  test("l'étiquette donne le tarif et disparaît des notes affichées", () => {
    const g = app.normalizeEleveDB({ ...base, notes: "[Tarif : gratuit] Petite sœur" });
    assert.equal(g.part, 0);
    assert.equal(g.notes, "Petite sœur");
    assert.equal(app.normalizeEleveDB({ ...base, notes: "[Tarif : moitié prix]" }).part, 0.5);
    assert.equal(app.normalizeEleveDB({ ...base, notes: "Rien" }).part, 1);
  });
  test("l'enregistrement écrit, change ou retire l'étiquette", () => {
    assert.equal(app.notesAvecTarif("Petite sœur", 0), "[Tarif : gratuit] Petite sœur");
    assert.equal(app.notesAvecTarif("[Tarif : gratuit] Petite sœur", 0.5), "[Tarif : moitié prix] Petite sœur");
    assert.equal(app.notesAvecTarif("[Tarif : gratuit] Petite sœur", 1), "Petite sœur");
  });
});
