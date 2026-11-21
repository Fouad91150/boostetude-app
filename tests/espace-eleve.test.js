/**
 * Espace élève (21/11/2026) : identifiant « première lettre du prénom . nom »,
 * mot de passe envoyé au parent sur WhatsApp, collège et lycée seulement.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { chargerApp, eleveType } from "./charger-app.js";

const app = chargerApp();

describe("Identifiant élève", () => {
  test("première lettre du prénom, un point, le nom, sans accents ni espaces", () => {
    assert.equal(app.identifiantPropose({ id: "1", prenom: "Fouad", nom: "El Mkhanter" }, []), "f.elmkhanter");
    assert.equal(app.identifiantPropose({ id: "1", prenom: "Élodie", nom: "Ait Belk" }, []), "e.aitbelk");
  });
  test("un chiffre s'ajoute si l'identifiant est déjà pris", () => {
    const autres = [{ id: "2", identifiant: "f.elmkhanter" }, { id: "3", identifiant: "f.elmkhanter2" }];
    assert.equal(app.identifiantPropose({ id: "1", prenom: "Farid", nom: "Elmkhanter" }, autres), "f.elmkhanter3");
  });
  test("l'élève garde son propre identifiant", () => {
    assert.equal(app.identifiantPropose({ id: "1", prenom: "Fouad", nom: "Elmkhanter" }, [{ id: "1", identifiant: "f.elmkhanter" }]), "f.elmkhanter");
  });
});

describe("Mot de passe et message", () => {
  test("mot de passe simple à taper : mot-4 chiffres", () => {
    assert.match(app.motDePasseEleve(), /^[a-z]+-\d{4}$/);
  });
  test("le message au parent donne le lien, l'identifiant et le mot de passe", () => {
    const t = app.messageAccesEleve(eleveType, "l.martin", "maths-1234");
    assert.match(t, /eleve\.html/);
    assert.match(t, /l\.martin/);
    assert.match(t, /maths-1234/);
    assert.match(t, /Boost'Étude$/);
  });
});

describe("Réservé au collège et au lycée", () => {
  test("primaire exclu, collège et lycée inclus", () => {
    assert.equal(app.aEspaceEleve({ niveau: "CM2" }), false);
    assert.equal(app.aEspaceEleve({ niveau: "6ème" }), true);
    assert.equal(app.aEspaceEleve({ niveau: "Terminale" }), true);
  });
  test("la fiche d'un collégien propose de créer l'accès", () => {
    const html = renderToStaticMarkup(React.createElement(app.FicheEleve, {
      eleve: { ...eleveType, niveau: "3ème", actif: true }, groupeNom: "Maths", eleves: [] }));
    assert.match(html, /Espace élève/);
    assert.match(html, /Créer l&#x27;accès|Créer l'accès/);
  });
  test("la fiche d'un élève de primaire n'en parle pas", () => {
    const html = renderToStaticMarkup(React.createElement(app.FicheEleve, {
      eleve: { ...eleveType, niveau: "CM1", actif: true }, groupeNom: "Aide aux devoirs", eleves: [] }));
    assert.doesNotMatch(html, /Espace élève/);
  });
});
