/**
 * Comptes professeurs (24/11/2026) : créés par l'admin depuis Réglages → Professeurs.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { chargerApp } from "./charger-app.js";

const app = chargerApp();

describe("Comptes professeurs", () => {
  test("identifiant : première lettre du prénom, un point, le nom", () => {
    assert.equal(app.identifiantProfPropose("Khadija", "Ben Ali", []), "k.benali");
    assert.equal(app.identifiantProfPropose("Karim", "Benali", [{ identifiant: "k.benali" }]), "k.benali2");
  });
  test("la connexion accepte l'identifiant seul ou une adresse e-mail", () => {
    assert.equal(app.emailDeConnexion("K.Benali "), "k.benali@prof.boostetude.fr");
    assert.equal(app.emailDeConnexion("fouad@boostetude.fr"), "fouad@boostetude.fr");
  });
  test("le message d'accès donne le lien, l'identifiant et le mot de passe", () => {
    const t = app.messageAccesProf("Khadija", "k.benali", "boost-1234");
    assert.match(t, /boostetude-app/);
    assert.match(t, /k\.benali/);
    assert.match(t, /boost-1234/);
    assert.match(t, /appel/);
  });
});

describe("Primaire : séances de 1 h 30 facturées 1 h 30", () => {
  test("une séance de CM1 à 10 €/h coûte 15 €, une séance de 4e reste à 2 h", () => {
    const groupes = [{ id: "gp", matiere: "Aide aux devoirs", niveau: "CM1", eids: ["e1"] }, { id: "g4", matiere: "Mathématiques", niveau: "4ème", eids: ["e2"] }];
    const appels = { "ap:gp:2026-11-04": { e1: "present" }, "ap:g4:2026-11-05": { e2: "present" } };
    const s1 = app.seancesOuvertes("e1", appels, groupes, null, false);
    assert.equal(s1[0].duree, 1.5);
    assert.equal(app.montantSeances(s1, 10), 15);
    const s2 = app.seancesOuvertes("e2", appels, groupes, null, false);
    assert.equal(app.montantSeances(s2, 12.5), 25);
  });
  test("la facture compte les heures réelles", () => {
    const l = app.lignesFacture([{ matiere: "Aide aux devoirs", dates: ["a", "b"], offertes: [], duree: 1.5 }], 30, 10);
    assert.equal(l[0].heures, 3);
    assert.equal(l[0].th, 10);
  });
});

test("un groupe de niveau « primaire » compte aussi 1 h 30", () => {
  const groupes = [{ id: "gp", matiere: "Mathématiques", niveau: "primaire", eids: ["e1"] }];
  const s = app.seancesOuvertes("e1", { "ap:gp:2026-11-04": { e1: "present" } }, groupes, null, false);
  assert.equal(s[0].duree, 1.5);
});
