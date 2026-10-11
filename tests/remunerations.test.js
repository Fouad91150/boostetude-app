/**
 * Ce que Boost'Étude doit à ses professeurs.
 *
 * Deux comptes sortent de la même feuille d'appel et ne doivent jamais se
 * mélanger : le parent paie les séances où son enfant était présent, le
 * professeur est payé pour la séance qu'il a assurée. Un professeur payé au
 * prorata des présents serait une faute — c'est le cœur de ces vérifications.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { chargerApp } from "./charger-app.js";

const PROF = (extra = {}) => ({
  id: "p1", prenom: "Mourad", nom: "", email: "college2@boostetude.fr",
  role: "prof", taux_horaire: 25, telephone: "", ...extra
});
const GROUPE = (extra = {}) => ({
  id: "g1", nom: "4e", niveau: "4ème", matiere: "Mathématiques", profId: "p1", eids: [], ...extra
});
// Le mois PRÉCÉDENT : toutes ses séances sont passées, quel que soit le jour
// où l'on lance les tests (une séance à venir ne compte pas encore).
const mois = () => {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};
const jour = n => `${mois()}-${String(n).padStart(2, "0")}`;

describe("Compter les séances assurées", () => {
  test("une séance pointée vaut deux heures", () => {
    const { seancesDuMois } = chargerApp();
    const appels = { [`ap:g1:${jour(3)}`]: { e1: "present", e2: "present" } };
    assert.equal(seancesDuMois("p1", mois(), appels, [GROUPE()]).length, 1);
  });

  test("une séance où tout le monde manquait compte quand même", () => {
    // Le professeur s'est déplacé, il a tenu l'heure : elle lui est due.
    const { duAuProf } = chargerApp();
    const appels = { [`ap:g1:${jour(3)}`]: { e1: "absent_nj", e2: "absent_j" } };
    const d = duAuProf(PROF(), mois(), appels, [GROUPE()]);
    assert.equal(d.heures, 2);
    assert.equal(d.montant, 50);
  });

  test("une séance sans appel enregistré ne compte pas", () => {
    // Rien ne prouve qu'elle a eu lieu — ni pour le parent, ni pour le professeur.
    const { duAuProf } = chargerApp();
    const appels = { [`ap:g1:${jour(3)}`]: {} };
    assert.equal(duAuProf(PROF(), mois(), appels, [GROUPE()]).heures, 0);
  });

  test("les séances d'un autre professeur ne comptent pas", () => {
    const { duAuProf } = chargerApp();
    const appels = { [`ap:g2:${jour(3)}`]: { e1: "present" } };
    const groupes = [GROUPE(), GROUPE({ id: "g2", nom: "3e", profId: "p2" })];
    assert.equal(duAuProf(PROF(), mois(), appels, groupes).heures, 0);
  });

  test("ni celles d'un autre mois", () => {
    const { duAuProf } = chargerApp();
    const appels = { "ap:g1:2020-01-06": { e1: "present" } };
    assert.equal(duAuProf(PROF(), mois(), appels, [GROUPE()]).heures, 0);
  });

  test("quatre séances à 25 €/h font 200 €", () => {
    const { duAuProf } = chargerApp();
    const appels = {};
    [3, 10, 17, 24].forEach(j => { appels[`ap:g1:${jour(j)}`] = { e1: "present" }; });
    const d = duAuProf(PROF(), mois(), appels, [GROUPE()]);
    assert.equal(d.seances.length, 4);
    assert.equal(d.heures, 8);
    assert.equal(d.montant, 200);
  });

  test("un taux absent retombe sur 25 €/h", () => {
    const { duAuProf } = chargerApp();
    const appels = { [`ap:g1:${jour(3)}`]: { e1: "present" } };
    assert.equal(duAuProf(PROF({ taux_horaire: null }), mois(), appels, [GROUPE()]).montant, 50);
  });

  test("un professeur qui enseigne deux matières cumule ses groupes", () => {
    const { duAuProf } = chargerApp();
    const groupes = [GROUPE({ id: "g1" }), GROUPE({ id: "g2", nom: "Terminale physique", matiere: "Physique-Chimie" })];
    const appels = {
      [`ap:g1:${jour(3)}`]: { e1: "present" },
      [`ap:g2:${jour(4)}`]: { e2: "present" }
    };
    assert.equal(duAuProf(PROF(), mois(), appels, groupes).heures, 4);
  });
});

describe("L'écran des professeurs", () => {
  const rendre = (profs, groupes, appels) => {
    const { OngletProfesseurs } = chargerApp();
    return renderToStaticMarkup(React.createElement(OngletProfesseurs, {
      profs, groupes, appels, moisInitial: mois(), onSaveTaux: async () => {}, onSaveTel: async () => {}
    }));
  };

  test("il affiche le total à verser", () => {
    const appels = {};
    [3, 10].forEach(j => { appels[`ap:g1:${jour(j)}`] = { e1: "present" }; });
    const html = rendre([PROF()], [GROUPE()], appels);
    assert.ok(html.includes("100,00"), "2 séances × 2 h × 25 €");
    assert.ok(html.includes("Mourad"));
  });

  test("un professeur sans groupe n'apparaît pas", () => {
    const html = rendre([PROF({ id: "p9", prenom: "Chakir" })], [GROUPE()], {});
    assert.ok(!html.includes("Chakir"));
  });

  test("sans numéro, il propose de l'ajouter et de copier le message", () => {
    const appels = { [`ap:g1:${jour(3)}`]: { e1: "present" } };
    const html = rendre([PROF()], [GROUPE()], appels);
    assert.ok(html.includes("Ajouter son numéro"));
    assert.ok(html.includes("Copier le récapitulatif"));
  });

  test("avec un numéro, il envoie sur WhatsApp", () => {
    const appels = { [`ap:g1:${jour(3)}`]: { e1: "present" } };
    const html = rendre([PROF({ telephone: "06 12 34 56 78" })], [GROUPE()], appels);
    assert.ok(html.includes("Envoyer sur WhatsApp"));
  });

  test("aucun groupe attribué : il dit où les attribuer", () => {
    const html = rendre([PROF()], [], {});
    assert.ok(html.includes("Aucun professeur à rémunérer"));
  });

  test("l'exploitant ne figure pas dans les rémunérations", () => {
    // En micro-entreprise, il ne se verse pas de salaire : il prend le bénéfice.
    const appels = { [`ap:g1:${jour(3)}`]: { e1: "present" } };
    const html = rendre(
      [PROF({ id: "admin", prenom: "Fouad", role: "admin" }), PROF()],
      [GROUPE(), GROUPE({ id: "g0", profId: "admin" })],
      { ...appels, [`ap:g0:${jour(4)}`]: { e1: "present" } });
    assert.ok(!html.includes("Fouad ELMKHANTER"));
    assert.ok(html.includes("ne se verse pas de salaire"));
    assert.ok(html.includes("Mourad"));
  });
});

describe("Le récapitulatif envoyé au professeur", () => {
  test("il détaille les séances, les heures et le total", () => {
    const { makeRemunerationWhatsApp } = chargerApp();
    const seances = [
      { date: "2026-10-03", groupe: "4e", presents: 4 },
      { date: "2026-10-10", groupe: "4e", presents: 3 }
    ];
    const t = makeRemunerationWhatsApp(PROF(), "2026-10", seances, 4, 100, 25);
    assert.match(t, /Octobre 2026/);
    assert.match(t, /4e \(4 présents\)/);
    assert.match(t, /2 séances de 2 h, soit \*4 h\*/);
    assert.match(t, /25 €\/h/);
    assert.match(t, /Total : 100 €/);
    assert.match(t, /Fouad Elmkhanter/);
  });
});

describe("Mon compte", () => {
  const rendre = (email = "college2@boostetude.fr") => {
    const { FenetreCompte } = chargerApp();
    return renderToStaticMarkup(React.createElement(FenetreCompte, {
      profil: { prenom: "Mourad", nom: "" }, email,
      onFermer: () => {}, onChanger: async () => {}, onDeconnexion: () => {}
    }));
  };

  test("il montre l'identifiant sans permettre de le changer", () => {
    const html = rendre();
    assert.ok(html.includes("college2@boostetude.fr"));
    assert.ok(html.includes("ne se change pas ici"));
  });

  test("le bouton reste inactif tant que rien n'est saisi", () => {
    assert.match(rendre(), /disabled=""/);
  });

  test("il porte aussi la déconnexion", () => {
    assert.ok(rendre().includes("Se déconnecter"));
  });
});

describe("Une séance à venir", () => {
  test("n'est pas encore assurée, donc pas encore due", () => {
    const { seancesDuMois } = chargerApp();
    const d = new Date(); d.setDate(d.getDate() + 3);
    const futur = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const appels = { [`ap:g1:${futur}`]: { e1: "present" } };
    assert.equal(seancesDuMois("p1", futur.slice(0, 7), appels, [GROUPE()]).length, 0);
  });
});
