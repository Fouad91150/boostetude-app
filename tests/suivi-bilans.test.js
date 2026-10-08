import { test, describe } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { chargerApp, eleveType } from "./charger-app.js";

const app = chargerApp();
const rendre = (composant, props) => renderToStaticMarkup(React.createElement(composant, props));
const contient = (html, texte) => html.replace(/&#x27;|&#39;/g, "'").includes(texte);

describe("Semaines", () => {
  test("le lundi est le même pour tous les jours d'une semaine", () => {
    for (const jour of ["2026-09-28", "2026-09-30", "2026-10-04"]) {
      assert.equal(app.lundiDe(jour), "2026-09-28", jour);
    }
  });

  test("un dimanche appartient à la semaine qui précède, pas à la suivante", () => {
    assert.equal(app.lundiDe("2026-10-04"), "2026-09-28");
    assert.equal(app.addJours("2026-09-28", 6), "2026-10-04");
  });

  test("le numéro ISO tient au passage d'une année à l'autre", () => {
    assert.equal(app.isoSemaine("2026-09-28"), "2026-W40");
    assert.equal(app.isoSemaine("2027-01-01"), "2026-W53");
    assert.equal(app.lundiDe("2027-01-01"), "2026-12-28");
  });

  test("le libellé s'adapte à une semaine à cheval sur deux mois", () => {
    assert.equal(app.libelleSemaine("2026-09-28"), "28 septembre – 4 octobre");
    assert.equal(app.libelleSemaine("2026-10-05"), "5 – 11 octobre");
  });
});

describe("Numéros de téléphone", () => {
  const cas = [
    ["06 12 34 56 78", "33612345678"],
    ["0612345678", "33612345678"],
    ["06.12.34.56.78", "33612345678"],
    ["+33 6 12 34 56 78", "33612345678"],
    ["0033612345678", "33612345678"],
    ["+212 6 61 00 00 00", "212661000000"],
    ["", ""]
  ];
  for (const [saisi, attendu] of cas) {
    test(`« ${saisi || "(vide)"} » devient ${attendu || "(vide)"}`, () => {
      assert.equal(app.telWhatsApp(saisi), attendu);
    });
  }
});



describe("Écran Suivi", () => {
  const aujourdhui = new Date().toISOString().split("T")[0];
  const groupes = [{ id: "g1", nom: "Collège Maths A", matiere: "Mathématiques", eids: ["e1"], jour: "Mardi", hd: "18:00", hf: "20:00", max: 6 }];

  test("le choix de la séance se rend sans erreur", () => {
    const html = rendre(app.ModuleSuivi, {
      eleves: [eleveType], groupes, appels: {}, comptesRendus: [], monProfilId: "p1", onSave() {}
    });
    assert.ok(contient(html, "Collège Maths A"));
    assert.ok(contient(html, "appel non fait"));
  });

  test("une fiche élève vierge propose l'appréciation et les difficultés", () => {
    const html = rendre(app.CarteSuiviEleve, {
      eleve: eleveType, valeur: {}, onChange() {}, ouvert: false, onToggleOuvert() {}, suggestions: ["Thalès"]
    });
    for (const mot of ["Excellent", "Bien", "Moyen", "Difficile", "Difficultés rencontrées"]) {
      assert.ok(contient(html, mot), mot);
    }
  });

  test("dépliée, elle ajoute notions, progrès et devoirs", () => {
    const html = rendre(app.CarteSuiviEleve, {
      eleve: eleveType, valeur: { notions: "Thalès", niveau_seance: "excellent" },
      onChange() {}, ouvert: true, onToggleOuvert() {}, suggestions: []
    });
    assert.ok(contient(html, "Progrès / points forts"));
    assert.ok(contient(html, "Travail pour la prochaine fois"));
  });

  test("une fiche entièrement vide est reconnue comme telle", () => {
    assert.equal(app.estCompteRenduVide({}), true);
    assert.equal(app.estCompteRenduVide({ notions: "   " }), true);
    assert.equal(app.estCompteRenduVide({ niveau_seance: "bien" }), false);
    assert.equal(app.estCompteRenduVide({ difficultes: "x" }), false);
  });
});
