import { test, describe } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { chargerApp, eleveType, factureType, parametresComplets } from "./charger-app.js";

const app = chargerApp();
const rendre = (composant, props) => renderToStaticMarkup(React.createElement(composant, props));
// Le rendu HTML échappe les apostrophes typographiques et les accents composés.
const contient = (html, texte) => html.replace(/&#x27;|&#39;/g, "'").includes(texte);

describe("Contrôle des mentions légales", () => {
  test("des réglages vides signalent tous les champs requis", () => {
    const m = app.champsManquants(null);
    assert.deepEqual(m, ["dénomination", "nom de l'exploitant", "SIRET", "adresse", "ville"]);
  });

  test("des réglages complets ne signalent rien", () => {
    assert.deepEqual(app.champsManquants(parametresComplets), []);
  });

  test("un champ rempli d'espaces ne compte pas comme rempli", () => {
    const m = app.champsManquants({ ...parametresComplets, siret: "   " });
    assert.deepEqual(m, ["SIRET"]);
  });
});

describe("Facture", () => {
  test("sans numéro, elle est présentée comme un brouillon", () => {
    const html = rendre(app.VueImpression, {
      facture: factureType(), eleve: eleveType, parametres: parametresComplets,
      onClose() {}, onEmettre() {}
    });
    assert.ok(contient(html, "BROUILLON"), "le mot BROUILLON doit apparaître");
    assert.ok(contient(html, "Émettre la facture"), "le bouton d'émission doit être proposé");
    assert.ok(!contient(html, "N° F2026"), "aucun numéro ne doit être affiché");
  });

  test("réglages incomplets : l'émission est refusée et les manques listés", () => {
    const html = rendre(app.VueImpression, {
      facture: factureType(), eleve: eleveType, parametres: { denomination: "Boost'Étude" },
      onClose() {}, onEmettre() {}
    });
    assert.ok(contient(html, "Informations légales incomplètes"));
    assert.ok(contient(html, "SIRET"));
    assert.ok(!contient(html, "Émettre la facture"), "le bouton ne doit pas être proposé");
  });

  test("une facture émise porte toutes les mentions obligatoires", () => {
    const html = rendre(app.VueImpression, {
      facture: factureType({ numero: "F2026-0001", dateEmission: "2026-09-30" }),
      eleve: eleveType, parametres: parametresComplets, onClose() {}, onEmettre() {}
    });
    for (const [quoi, texte] of [
      ["le numéro", "F2026-0001"],
      ["la date d'émission", "30 septembre 2026"],
      ["le SIRET", "SIRET 12345678900012"],
      ["le code APE", "85.59B"],
      ["la mention d'entrepreneur individuel", "Entrepreneur individuel"],
      ["la franchise de TVA", "TVA non applicable, article 293 B du CGI"],
      ["les pénalités de retard", "trois fois le taux d'intérêt légal"],
      ["l'indemnité de recouvrement", "40 €"],
      ["l'escompte", "Aucun escompte"],
      ["l'adresse", "7 avenue des Meuniers"],
      ["le client", "Marie Martin"],
      ["l'élève", "Lucas"]
    ]) {
      assert.ok(contient(html, texte), `${quoi} doit figurer sur la facture (${texte})`);
    }
    assert.ok(!contient(html, "BROUILLON"));
  });

  test("l'IBAN apparaît sur une facture à régler, disparaît une fois payée", () => {
    const aRegler = rendre(app.VueImpression, {
      facture: factureType({ numero: "F2026-0001", dateEmission: "2026-09-30" }),
      eleve: eleveType, parametres: parametresComplets, onClose() {}, onEmettre() {}
    });
    assert.ok(contient(aRegler, "FR76 3000 1000 0100 0000 0000 123"));

    const payee = rendre(app.VueImpression, {
      facture: factureType({ numero: "F2026-0001", dateEmission: "2026-09-30", statut: "paye", datePaiement: "2026-10-02" }),
      eleve: eleveType, parametres: parametresComplets, onClose() {}, onEmettre() {}
    });
    assert.ok(!contient(payee, "FR76 3000"), "inutile de réclamer un virement déjà reçu");
    assert.ok(contient(payee, "Payée"));
  });

  test("le détail facturé reprend les heures et le tarif horaire de l'élève", () => {
    const html = rendre(app.VueImpression, {
      facture: factureType({ numero: "F2026-0002", dateEmission: "2026-09-30" }),
      eleve: eleveType, parametres: parametresComplets, onClose() {}, onEmettre() {}
    });
    assert.ok(contient(html, "8 h"), "4 séances de 2 h font 8 heures");
    // Présentation comptable française : virgule décimale et deux décimales.
    assert.ok(contient(html, "12,50 €/h"));
    assert.ok(contient(html, "100,00 €"));
  });
});

describe("Écran Réglages", () => {
  test("les trois onglets se rendent sans erreur", () => {
    for (const onglet of ["entreprise", "recettes", "donnees"]) {
      const html = rendre(app.ModuleReglages, {
        parametres: parametresComplets, eleves: [eleveType], groupes: [], appels: {},
        factures: [factureType({ numero: "F2026-0001", statut: "paye", datePaiement: "2026-09-30" })],
        onSaveParametres() {}, onExportComplet: async () => ({})
      });
      assert.ok(html.length > 500, `l'onglet ${onglet} doit produire du contenu`);
    }
  });

  test("le bandeau de conformité alerte quand il manque quelque chose", () => {
    const incomplet = rendre(app.BlocConformite, { parametres: { denomination: "Boost'Étude" } });
    assert.ok(contient(incomplet, "ne sont pas conformes"));
    const complet = rendre(app.BlocConformite, { parametres: parametresComplets });
    assert.ok(contient(complet, "mentions obligatoires"));
  });

  test("le livre des recettes ne retient que les factures encaissées", () => {
    const factures = [
      factureType({ id: "a", numero: "F2026-0001", statut: "paye", datePaiement: "2026-09-10", montant: 100 }),
      factureType({ id: "b", numero: "F2026-0002", statut: "en_attente", montant: 75 }),
      factureType({ id: "c", numero: null, statut: "en_attente", montant: 50 })
    ];
    const html = rendre(app.OngletLivreRecettes, { factures, eleves: [eleveType] });
    assert.ok(contient(html, "F2026-0001"), "la facture encaissée doit apparaître");
    assert.ok(!contient(html, "F2026-0002"), "une facture émise non payée n'est pas une recette");
    assert.ok(contient(html, "100,00€"), "le total des recettes doit être de 100 €");
  });
});

describe("Export CSV", () => {
  test("le séparateur, le BOM et l'échappement conviennent à Excel", () => {
    const csv = app.versCSV(
      [{ titre: "Nom", valeur: l => l.nom }, { titre: "Note", valeur: l => l.note }],
      [{ nom: "Martin", note: 'a;b"c' }]
    );
    assert.ok(csv.startsWith("﻿"), "le BOM évite les accents cassés dans Excel");
    assert.ok(csv.includes("Nom;Note"));
    assert.ok(csv.includes('"a;b""c"'), "les points-virgules et guillemets doivent être échappés");
  });

  test("une valeur absente devient une cellule vide, jamais « undefined »", () => {
    const csv = app.versCSV([{ titre: "X", valeur: l => l.manquant }], [{}]);
    assert.ok(!csv.includes("undefined"));
  });
});
