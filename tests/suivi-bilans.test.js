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

describe("Rédaction du bilan", () => {
  const seances = [{ date: "2026-09-29", matiere: "Mathématiques" }, { date: "2026-10-01", matiere: "Mathématiques" }];
  const crs = [
    { notions: "Théorème de Thalès, calcul littéral", difficultes: "Confond les rapports", progres: "Mise en équation acquise", devoirs: "Ex. 12 à 15 p. 84" },
    { notions: "Théorème de Thalès, équations", difficultes: "", progres: "", devoirs: "" }
  ];
  const d = app.bilanDonnees(eleveType, "2026-09-28", seances, [{ date: "2026-10-02", statut: "absent_j" }], crs);

  test("les notions répétées d'une séance à l'autre ne sont pas redites", () => {
    assert.deepEqual(d.notions, ["Théorème de Thalès", "calcul littéral", "équations"]);
  });

  test("les champs vides ne créent pas de lignes fantômes", () => {
    assert.deepEqual(d.difficultes, ["Confond les rapports"]);
    assert.deepEqual(d.progres, ["Mise en équation acquise"]);
  });

  test("le message WhatsApp nomme le parent, l'élève et l'absence justifiée", () => {
    const m = app.makeBilanWhatsApp(eleveType, d);
    assert.ok(m.includes("Bonjour Marie Martin"));
    assert.ok(m.includes("Voici le point sur Lucas"));
    assert.ok(m.includes("Théorème de Thalès, calcul littéral, équations"));
    assert.ok(m.includes("Absent(e) le 2 octobre 2026 (justifié)"));
    assert.ok(m.includes("M. El Mkhanter"));
  });

  test("les phrases saisies à la volée sont fermées proprement", () => {
    const m = app.makeBilanWhatsApp(eleveType, d);
    assert.ok(m.includes("Mise en équation acquise."), "un point manquant doit être ajouté");
    assert.ok(!m.includes("acquise..") , "un point déjà présent ne doit pas être doublé");
  });

  test("le SMS reste sur une ligne, sans mise en forme WhatsApp", () => {
    const sms = app.makeBilanSMS(eleveType, d);
    assert.ok(!/\n/.test(sms), "un SMS ne contient pas de retour à la ligne");
    assert.ok(!/\*/.test(sms), "les astérisques de WhatsApp n'ont rien à faire dans un SMS");
  });

  test("l'email n'affiche jamais de ligne vide parasite", () => {
    const mail = app.makeBilanEmail(eleveType, d);
    assert.equal(mail.sujet, "Bilan de la semaine — Lucas Martin — Boost'Étude");
    assert.ok(!mail.corps.includes("null"));
  });

  test("sans compte-rendu, le bilan dit la présence et n'invente rien", () => {
    const vide = app.bilanDonnees(eleveType, "2026-09-28", seances, [], []);
    const m = app.makeBilanWhatsApp(eleveType, vide);
    assert.ok(m.includes("📅 *Séances* : 2"));
    assert.ok(!m.includes("Travaillé"));
    assert.ok(!m.includes("À consolider"));
  });
});

describe("Écran Bilans", () => {
  const lundi = app.lundiDe(new Date().toISOString().split("T")[0]);
  const mardi = app.addJours(lundi, 1);
  const eleves = [
    eleveType,
    { id: "e2", prenom: "Inès", nom: "Benali", niveau: "3ème", th: 12.5, parent: "Karim Benali", tel: "", email: "karim@mail.fr", actif: true },
    { id: "e3", prenom: "Théo", nom: "Roux", niveau: "2nde", th: 15, parent: "Parent de Théo", tel: "", email: "", actif: true }
  ];
  const groupes = [
    { id: "g1", nom: "Collège Maths A", matiere: "Mathématiques", eids: ["e1", "e2"], jour: "Mardi", hd: "18:00", hf: "20:00", max: 6 },
    { id: "g2", nom: "Lycée Maths", matiere: "Mathématiques", eids: ["e3"], jour: "Jeudi", hd: "18:00", hf: "20:00", max: 6 }
  ];
  const appels = { [`ap:g1:${mardi}`]: { e1: "present", e2: "absent_j" }, [`ap:g2:${mardi}`]: { e3: "present" } };
  const comptesRendus = [{ id: "c1", eleve_id: "e1", groupe_id: "g1", cours_id: "k1", date: mardi, notions: "Thalès", difficultes: "Rapports", progres: "", devoirs: "", niveau_seance: "bien" }];
  const bilans = [{ id: "b1", eleve_id: "e3", semaine: app.isoSemaine(lundi), canal: "whatsapp" }];

  const html = rendre(app.ModuleBilans, { eleves, groupes, appels, comptesRendus, bilans, monProfilId: "p1", onLog() {} });

  test("le lien WhatsApp est pré-rempli avec le numéro au format international", () => {
    assert.ok(html.includes("https://wa.me/33612345678?text="));
  });

  test("le lien SMS est pré-rempli", () => {
    assert.ok(html.includes('href="sms:0612345678?body='));
  });

  test("un élève sans téléphone garde le courriel comme recours", () => {
    assert.ok(html.includes("mailto:karim@mail.fr"));
    assert.ok(contient(html, "pas de téléphone"));
  });

  test("un élève absent figure quand même : le parent doit être prévenu", () => {
    assert.ok(contient(html, "Inès"));
  });

  test("un bilan déjà envoyé est marqué comme tel, une seule fois", () => {
    assert.equal((html.match(/✓ WhatsApp/g) || []).length, 1);
  });

  test("sans compte-rendu, l'écran renvoie vers l'onglet Suivi", () => {
    assert.ok(contient(html, "onglet Suivi"));
  });

  test("une semaine sans séance ne montre rien à envoyer", () => {
    const vide = rendre(app.ModuleBilans, { eleves, groupes, appels: {}, comptesRendus: [], bilans: [], onLog() {} });
    assert.ok(contient(vide, "Aucune séance pointée cette semaine"));
  });
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
