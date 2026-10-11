/**
 * Trois absences non justifiées depuis la rentrée : le parent doit le savoir.
 * L'application repère le palier et prépare le message ; l'envoi reste humain.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { chargerApp, eleveType } from "./charger-app.js";

const ap = (d, statut, eid = "e1", g = "g1") => [`ap:${g}:${d}`, { [eid]: statut }];
const appelsDe = (...l) => Object.fromEntries(l);

describe("Décompte des absences", () => {
  test("l'année scolaire commence le 1er septembre", () => {
    const { debutAnneeScolaire } = chargerApp();
    assert.equal(debutAnneeScolaire("2026-10-10"), "2026-09-01");
    assert.equal(debutAnneeScolaire("2027-03-02"), "2026-09-01");
    assert.equal(debutAnneeScolaire("2026-08-31"), "2025-09-01");
  });

  test("seules les absences non justifiées de l'année comptent", () => {
    const { absencesNonJustifiees } = chargerApp();
    const appels = appelsDe(
      ap("2026-06-10", "absent_nj"),            // année précédente
      ap("2026-09-15", "absent_nj"),
      ap("2026-09-22", "absent_j"),             // justifiée
      ap("2026-09-29", "present"),
      ap("2026-10-06", "absent_nj", "e1", "g2") // autre groupe : compte aussi
    );
    assert.deepEqual(absencesNonJustifiees("e1", appels, "2026-10-10"), ["2026-09-15", "2026-10-06"]);
  });
});

describe("Déclenchement de l'alerte", () => {
  const trois = appelsDe(ap("2026-09-15", "absent_nj"), ap("2026-09-22", "absent_nj"), ap("2026-09-29", "absent_nj"));

  test("rien à deux absences", () => {
    const { alerteAbsences } = chargerApp();
    const deux = appelsDe(ap("2026-09-15", "absent_nj"), ap("2026-09-22", "absent_nj"));
    assert.equal(alerteAbsences("e1", deux, "2026-10-10"), null);
  });

  test("alerte à la troisième", () => {
    const { alerteAbsences } = chargerApp();
    const a = alerteAbsences("e1", trois, "2026-10-10");
    assert.equal(a.nb, 3);
    assert.equal(a.palier, 1);
  });

  test("une fois le parent prévenu, l'alerte se tait jusqu'au palier suivant", () => {
    const { alerteAbsences, marquerPrevenu } = chargerApp();
    marquerPrevenu("e1", "2026-10-10", 1);
    assert.equal(alerteAbsences("e1", trois, "2026-10-10"), null);
    const six = { ...trois, ...appelsDe(ap("2026-10-06", "absent_nj"), ap("2026-10-13", "absent_nj"), ap("2026-10-20", "absent_nj")) };
    assert.equal(alerteAbsences("e1", six, "2026-10-20").palier, 2);
  });

  test("la liste de l'accueil ne garde que les élèves concernés", () => {
    const { elevesEnAlerteAbsences } = chargerApp();
    const eleves = [eleveType, { ...eleveType, id: "e2", prenom: "Hawa" }];
    const l = elevesEnAlerteAbsences(eleves, trois, "2026-10-10");
    assert.equal(l.length, 1);
    assert.equal(l[0].eleve.prenom, "Lucas");
  });
});

describe("Messages aux parents", () => {
  const DATES = ["2026-09-15", "2026-09-22", "2026-09-29"];

  test("l'email nomme l'élève, le nombre et les dates", () => {
    const { makeAlerteAbsencesEmail } = chargerApp();
    const m = makeAlerteAbsencesEmail(eleveType, DATES);
    assert.match(m.sujet, /Absences répétées de Lucas Martin/);
    assert.match(m.corps, /Bonjour Marie Martin/);
    assert.match(m.corps, /3 séances sans justificatif/);
    assert.match(m.corps, /29 septembre 2026/);
    assert.match(m.corps, /Fouad Elmkhanter/);
  });

  test("le SMS reste court", () => {
    const { makeAlerteAbsencesSMS } = chargerApp();
    const t = makeAlerteAbsencesSMS(eleveType, DATES);
    assert.match(t, /Lucas/);
    assert.match(t, /3 séances/);
    assert.ok(t.length < 320, `SMS de ${t.length} caractères`);
  });

  test("WhatsApp met le nombre en gras", () => {
    const { makeAlerteAbsencesWhatsApp } = chargerApp();
    assert.match(makeAlerteAbsencesWhatsApp(eleveType, DATES), /\*3 séances sans justificatif\*/);
  });

  test("la carte propose les trois canaux et le bouton « Parent prévenu »", () => {
    const { CarteAlerteAbsences } = chargerApp();
    const html = renderToStaticMarkup(React.createElement(CarteAlerteAbsences, {
      eleve: eleveType, dates: DATES, palier: 1, refDate: "2026-10-10"
    }));
    assert.ok(html.includes("Alerter le parent"));
    assert.ok(html.includes("WhatsApp") && html.includes("SMS") && html.includes("Email"));
    assert.ok(html.includes("Parent prévenu"));
    assert.ok(html.includes("wa.me/33612345678"));
  });
});

describe("Accueil", () => {
  test("l'élève à trois absences apparaît dans le bloc d'alerte", () => {
    const { ModuleDashboard, debutAnneeScolaire } = chargerApp();
    const y = debutAnneeScolaire(new Date().toISOString().slice(0, 10)).slice(0, 4);
    const appels = appelsDe(ap(`${y}-09-15`, "absent_nj"), ap(`${y}-09-22`, "absent_nj"), ap(`${y}-09-29`, "absent_nj"));
    const html = renderToStaticMarkup(React.createElement(ModuleDashboard, {
      eleves: [eleveType], groupes: [], appels, factures: []
    }));
    assert.ok(html.includes("Absences répétées"));
    assert.ok(html.includes("Lucas"));
  });

  test("rien ne s'affiche quand personne n'a atteint le seuil", () => {
    const { ModuleDashboard } = chargerApp();
    const html = renderToStaticMarkup(React.createElement(ModuleDashboard, {
      eleves: [eleveType], groupes: [], appels: {}, factures: []
    }));
    assert.ok(!html.includes("Absences répétées"));
  });
});

describe("Dates à venir", () => {
  test("une séance datée après la référence ne compte pas", () => {
    const { absencesNonJustifiees } = chargerApp();
    const appels = appelsDe(ap("2026-09-15", "absent_nj"), ap("2026-10-30", "absent_nj"));
    assert.deepEqual(absencesNonJustifiees("e1", appels, "2026-10-11"), ["2026-09-15"]);
  });
});

