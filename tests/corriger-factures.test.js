/**
 * Les erreurs d'une journée de travail sont ordinaires : un « payé » cliqué trop
 * vite, une facture émise pour le mauvais élève. Elles doivent se corriger — sans
 * jamais trouer la numérotation comptable.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { chargerApp, eleveType, factureType, parametresComplets } from "./charger-app.js";

const racine = join(dirname(fileURLToPath(import.meta.url)), "..");
const pageConstruite = () => readFileSync(join(racine, "dist", "index.html"), "utf8");

const ELEVE = { ...eleveType, id: "e1", prenom: "Nour", nom: "Sebbar", tel: "06 12 34 56 78" };

const rendreGerer = (factures) => {
  const { ModuleFacturation } = chargerApp();
  const html = renderToStaticMarkup(React.createElement(ModuleFacturation, {
    eleves: [ELEVE], groupes: [], appels: {}, factures,
    parametres: { ...parametresComplets, seuil_facturation: 3 }, encaissements: [],
    onSaveFacture: async () => {}, onDeleteFacture: async () => {},
    onDeleteFactureEnCours: async () => {}, onEmettreFacture: async () => "F2026-0001",
    onRecharger: async () => {}, onAjouterVersement: async () => {}, onSupprimerVersement: async () => {},
    onAnnulerFacture: async () => {}, onRetablirFacture: async () => {},
    ongletInitial: "gerer"
  }));
  return html;
};

describe("Une facture émise ne se supprime pas", () => {
  test("elle s'annule, et le dit", () => {
    const page = pageConstruite();
    assert.ok(page.includes("Une facture émise ne se supprime pas"),
      "l'écran doit expliquer pourquoi la corbeille a disparu");
    assert.ok(page.includes("son numéro doit rester dans la séquence"));
  });

  test("l'annulation conserve le numéro", () => {
    const page = pageConstruite();
    assert.ok(page.includes("Elle gardera son numéro"));
    assert.ok(page.includes("annuler_facture"), "l'annulation passe par la base");
  });

  test("un brouillon, lui, se supprime", () => {
    const page = pageConstruite();
    const i = page.indexOf("🗑 Supprimer");
    assert.ok(i > 0, "le brouillon garde sa corbeille");
  });
});

describe("Ce que propose chaque état", () => {
  test("un brouillon : encaisser ou supprimer, pas d'envoi", () => {
    const html = rendreGerer([factureType({ id: "f1", eleveId: "e1", nbSeances: 2, montant: 50, numero: null })]);
    assert.ok(html.includes("Encaisser"));
    assert.ok(html.includes("Supprimer"));
    assert.ok(!html.includes("💬 WhatsApp"), "un brouillon n'a pas à partir chez un parent");
  });

  test("une facture émise : WhatsApp, PDF, encaisser, annuler", () => {
    const html = rendreGerer([factureType({
      id: "f1", eleveId: "e1", nbSeances: 3, montant: 90, numero: "F2026-0002", dateEmission: "2026-10-02"
    })]);
    // Deux gestes distincts : ouvrir la conversation du bon parent, puis joindre
    // le document. Le lien wa.me ne transporte pas de fichier, le partage système
    // ne choisit pas le destinataire.
    assert.ok(html.includes("WhatsApp"));
    assert.ok(html.includes("PDF"));
    assert.ok(html.includes("Encaisser"));
    assert.ok(html.includes("Annuler"));
    assert.ok(!html.includes("🗑 Supprimer"));
  });

  test("une facture annulée : rétablir, et rien d'autre", () => {
    const html = rendreGerer([factureType({
      id: "f1", eleveId: "e1", nbSeances: 3, montant: 90, numero: "F2026-0003", statut: "annulee"
    })]);
    assert.ok(html.includes("Rétablir"));
    assert.ok(!html.includes("💬 WhatsApp"));
    assert.ok(!html.includes("💰 Encaisser"));
  });

  test("le montant d'une facture annulée est barré", () => {
    const html = rendreGerer([factureType({
      id: "f1", eleveId: "e1", montant: 90, numero: "F2026-0003", statut: "annulee"
    })]);
    assert.ok(html.includes("line-through"));
  });

  test("les versements reçus se lisent sur la carte", () => {
    const html = rendreGerer([factureType({
      id: "f1", eleveId: "e1", nbSeances: 3, montant: 90, encaisse: 50,
      statut: "partiel", numero: "F2026-0001"
    })]);
    assert.ok(html.includes("50,00 € versés"));
    assert.ok(html.includes("Partiel"));
  });
});

describe("Une facture annulée libère ses séances", () => {
  test("elle ne ferme plus la période", () => {
    // Sans cela, les séances resteraient prisonnières d'une facture qui ne vaut plus rien.
    const { dernierePeriodeFin } = chargerApp();
    const factures = [{
      eleveId: "e1", numero: "F2026-0003", statut: "annulee", periodeFin: null,
      datesSeances: [{ date: "2026-09-18" }, { date: "2026-09-30" }]
    }];
    assert.equal(dernierePeriodeFin("e1", factures), null);
  });

  test("une facture émise valide, elle, ferme toujours", () => {
    const { dernierePeriodeFin } = chargerApp();
    const factures = [{
      eleveId: "e1", numero: "F2026-0002", statut: "en_attente", periodeFin: null,
      datesSeances: [{ date: "2026-09-18" }, { date: "2026-09-30" }]
    }];
    assert.equal(dernierePeriodeFin("e1", factures), "2026-09-30");
  });
});

describe("Pastilles d'état", () => {
  test("partiel et annulée ont la leur", () => {
    const { StatutBadge } = chargerApp();
    assert.ok(renderToStaticMarkup(React.createElement(StatutBadge, { statut: "partiel" })).includes("Partiel"));
    assert.ok(renderToStaticMarkup(React.createElement(StatutBadge, { statut: "annulee" })).includes("Annulée"));
  });

  test("un état inconnu retombe sur « En attente »", () => {
    const { StatutBadge } = chargerApp();
    assert.ok(renderToStaticMarkup(React.createElement(StatutBadge, { statut: "farfelu" })).includes("En attente"));
  });
});

describe("Partage depuis Gérer", () => {
  test("le PDF et le message partent ensemble", () => {
    const page = pageConstruite();
    const i = page.indexOf("const partager = async () => {");
    assert.ok(i > 0, "l'onglet Gérer doit savoir partager");
    const bloc = page.slice(i, i + 700);
    assert.ok(bloc.includes("makeFactureWhatsApp"), "un message accompagne le fichier");
    assert.ok(bloc.includes("partagerFacturePDF"), "et le fichier est le PDF de la facture");
  });
});
