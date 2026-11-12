/**
 * Une séance présente se facture une fois, et une seule — jamais zéro.
 * Avant 3.4.0, tout ce qui précédait la DERNIÈRE date d'une facture figée était
 * réputé facturé : la physique d'un jour où seuls les maths figuraient sur la
 * facture, ou un appel saisi en retard, ne se facturaient jamais.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { chargerApp, factureType } from "./charger-app.js";

const app = chargerApp();
const MATHS = { id: "gm", matiere: "Mathématiques", eids: ["e1"] };
const PHYS = { id: "gp", matiere: "Physique", eids: ["e1"] };
const present = (...cles) => Object.fromEntries(cles.map(k => [k, { e1: "present" }]));
const figee = dates => factureType({ id: "f1", eleveId: "e1", numero: "F2026-0001", statut: "en_attente",
  datesSeances: dates.map(([date, matiere]) => ({ date, matiere })) });

describe("Séances déjà facturées", () => {
  test("la physique du même jour reste à facturer", () => {
    const appels = present("ap:gm:2026-09-29", "ap:gp:2026-09-29");
    const deja = app.dejaFacturees("e1", [figee([["2026-09-29", "Mathématiques"]])]);
    const reste = app.seancesOuvertes("e1", appels, [MATHS, PHYS], deja);
    assert.deepEqual(reste.map(s => s.matiere), ["Physique"]);
  });

  test("un appel saisi en retard pour une date antérieure se facture quand même", () => {
    const appels = present("ap:gm:2026-09-15", "ap:gm:2026-09-22", "ap:gm:2026-09-29");
    const deja = app.dejaFacturees("e1", [figee([["2026-09-15", "Mathématiques"], ["2026-09-29", "Mathématiques"]])]);
    assert.deepEqual(app.seancesOuvertes("e1", appels, [MATHS], deja).map(s => s.date), ["2026-09-22"]);
  });

  test("une facture annulée libère ses séances", () => {
    const appels = present("ap:gm:2026-09-15");
    const annulee = { ...figee([["2026-09-15", "Mathématiques"]]), statut: "annulee" };
    assert.equal(app.seancesOuvertes("e1", appels, [MATHS], app.dejaFacturees("e1", [annulee])).length, 1);
  });

  test("une ancienne facture sans détail garde sa date de fin comme borne", () => {
    const appels = present("ap:gm:2026-09-15", "ap:gm:2026-09-29");
    const ancienne = factureType({ id: "f0", eleveId: "e1", statut: "paye", datesSeances: [], periodeFin: "2026-09-20" });
    assert.deepEqual(app.seancesOuvertes("e1", appels, [MATHS], app.dejaFacturees("e1", [ancienne])).map(s => s.date), ["2026-09-29"]);
  });
});

describe("Rattrapage des appels des collègues", () => {
  const eleve = { id: "e1", prenom: "Imran", nom: "", th: 15, actif: true };

  test("une séance pointée sans brouillon en crée un", () => {
    const r = app.brouillonsEnRetard([eleve], [MATHS], present("ap:gm:2026-10-07"), []);
    assert.equal(r.length, 1);
    assert.equal(r[0].montant, 30);
  });

  test("un brouillon à jour n'est pas touché", () => {
    const brouillon = factureType({ id: "b", eleveId: "e1", nbSeances: 1, montant: 30 });
    assert.equal(app.brouillonsEnRetard([eleve], [MATHS], present("ap:gm:2026-10-07"), [brouillon]).length, 0);
  });

  test("jamais de retrait : un brouillon plus fourni que l'appel reste tel quel", () => {
    const brouillon = factureType({ id: "b", eleveId: "e1", nbSeances: 5, montant: 150 });
    assert.equal(app.brouillonsEnRetard([eleve], [MATHS], present("ap:gm:2026-10-07"), [brouillon]).length, 0);
  });
});

describe("Robustesse de la clé de facturation", () => {
  test("renommer la matière d'un groupe ne refacture rien (factures 3.4.0, avec groupe)", () => {
    const appels = present("ap:gm:2026-09-08");
    const f = factureType({ id: "f", eleveId: "e1", numero: "F1", datesSeances: [{ date: "2026-09-08", matiere: "Mathématiques", groupeId: "gm" }] });
    const renomme = { ...MATHS, matiere: "Maths renforcées" };
    assert.equal(app.seancesOuvertes("e1", appels, [renomme], app.dejaFacturees("e1", [f])).length, 0);
  });

  test("renommer la matière ne refacture rien non plus (anciennes factures, sans groupe)", () => {
    const appels = present("ap:gm:2026-09-08", "ap:gm:2026-09-15");
    const f = figee([["2026-09-08", "Mathématiques"], ["2026-09-15", "Mathématiques"]]);
    const renomme = { ...MATHS, matiere: "Maths renforcées" };
    assert.equal(app.seancesOuvertes("e1", appels, [renomme], app.dejaFacturees("e1", [f])).length, 0);
  });

  test("un élève qui change de groupe garde ses séances non facturées", () => {
    const appels = present("ap:gm:2026-09-08", "ap:gp:2026-09-15");
    const quitte = { ...MATHS, eids: [] };
    const reste = app.seancesOuvertes("e1", appels, [quitte, PHYS], null);
    assert.deepEqual(reste.map(s => s.date), ["2026-09-08", "2026-09-15"]);
  });

  test("chaque séance retient son groupe pour la suite", () => {
    const s = app.seancesOuvertes("e1", present("ap:gm:2026-09-08"), [MATHS], null);
    assert.equal(s[0].groupeId, "gm");
  });
});
