/**
 * Premier cours offert, matière par matière (décision du 14/10/2026) :
 * un nouvel élève qui commence maths et physique a DEUX séances offertes,
 * la première de chaque matière.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { chargerApp, eleveType, factureType, parametresComplets } from "./charger-app.js";

const app = chargerApp();
const MATHS = { id: "gm", matiere: "Mathématiques", eids: ["e1"] };
const PHYS = { id: "gp", matiere: "Physique-Chimie", eids: ["e1"] };
const present = (...cles) => Object.fromEntries(cles.map(k => [k, { e1: "present" }]));

describe("Premier cours offert", () => {
  test("une séance offerte par matière", () => {
    const appels = present("ap:gm:2026-09-01", "ap:gm:2026-09-08", "ap:gp:2026-09-03", "ap:gp:2026-09-10");
    const s = app.seancesOuvertes("e1", appels, [MATHS, PHYS], null, true);
    assert.deepEqual(s.filter(x => x.offert).map(x => x.date), ["2026-09-01", "2026-09-03"]);
    assert.equal(app.montantSeances(s, 15), 60, "4 séances dont 2 offertes : 2 × 2 h × 15 €");
  });

  test("un élève sans l'avantage paie tout", () => {
    const appels = present("ap:gm:2026-09-01", "ap:gm:2026-09-08");
    const s = app.seancesOuvertes("e1", appels, [MATHS], null, false);
    assert.equal(s.some(x => x.offert), false);
    assert.equal(app.montantSeances(s, 15), 60);
  });

  test("une absence ne consomme pas la séance offerte", () => {
    const appels = { "ap:gm:2026-09-01": { e1: "absent_nj" }, ...present("ap:gm:2026-09-08") };
    const s = app.seancesOuvertes("e1", appels, [MATHS], null, true);
    assert.equal(s[0].date, "2026-09-08");
    assert.equal(s[0].offert, true);
  });

  test("une séance offerte déjà portée par une facture ne se ré-offre pas plus tard", () => {
    const appels = present("ap:gm:2026-09-01", "ap:gm:2026-09-08");
    const f = factureType({ id: "f", eleveId: "e1", numero: "F1", datesSeances: [{ date: "2026-09-01", matiere: "Mathématiques", groupeId: "gm", offert: true }] });
    const s = app.seancesOuvertes("e1", appels, [MATHS], app.dejaFacturees("e1", [f]), true);
    assert.deepEqual(s.map(x => [x.date, !!x.offert]), [["2026-09-08", false]]);
  });

  test("le brouillon d'un nouvel élève est recalculé au montant juste", () => {
    const eleve = { ...eleveType, id: "e1", th: 15, actif: true, premierCoursOffert: true };
    const appels = present("ap:gm:2026-09-01", "ap:gm:2026-09-08");
    const brouillon = factureType({ id: "b", eleveId: "e1", nbSeances: 2, montant: 60 });
    const r = app.brouillonsEnRetard([eleve], [MATHS], appels, [brouillon]);
    assert.equal(r.length, 1);
    assert.equal(r[0].montant, 30);
  });

  test("la facture imprimée dit quelle séance est offerte, et les heures payées", () => {
    const f = factureType({ numero: "F2026-0020", dateEmission: "2026-10-14", montant: 30, nbSeances: 2,
      datesSeances: [{ date: "2026-09-01", matiere: "Mathématiques", offert: true }, { date: "2026-09-08", matiere: "Mathématiques" }] });
    const brut = Buffer.from(app.construireFacturePDF(f, { ...eleveType, th: 15, niveau: "2nde" }, parametresComplets)).toString("latin1");
    assert.match(brut, /1re s.ance offerte/);
    assert.match(brut, /\(2 h\)/);
    assert.match(brut, /15,00/);
  });

  test("le message au parent annonce la séance offerte", () => {
    const t = app.makeFactureWhatsApp({ ...eleveType, th: 15 }, "F2026-0020", 2, 30,
      [{ date: "2026-09-01", matiere: "Mathématiques", offert: true }, { date: "2026-09-08", matiere: "Mathématiques" }], 3);
    assert.match(t, /1 première séance offerte/);
  });
});
