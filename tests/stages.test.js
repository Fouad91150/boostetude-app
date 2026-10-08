/**
 * « Introduire une rubrique stage » — cinquième réponse de Fouad.
 *
 * Un stage se vend au forfait sur une semaine de vacances. Deux exigences
 * pèsent ici plus que l'affichage : la facture d'un stage doit s'imprimer
 * comme un forfait (et non « Aucune séance »), et elle ne doit surtout pas
 * se mêler à la facturation des cours, qui se calcule à la séance.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { chargerApp, eleveType, factureType, parametresComplets } from "./charger-app.js";

const dansNJours = n => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

const STAGE = (extra = {}) => ({
  id: "s1", nom: "Stage Toussaint — révisions brevet", niveau: "3ème",
  matiere: "Mathématiques", dateDebut: dansNJours(10), dateFin: dansNJours(14),
  horaire: "10h–12h", tarif: 189, places: 8, notes: "", ...extra
});

const INSCRIT = (extra = {}) => ({
  id: "i1", stageId: "s1", eleveId: "e1", tarif: 189, factureId: null, ...extra
});

describe("Où en est un stage", () => {
  test("avant, pendant, après", () => {
    const { etatStage } = chargerApp();
    assert.equal(etatStage(STAGE()).k, "avenir");
    assert.equal(etatStage(STAGE({ dateDebut: dansNJours(-1), dateFin: dansNJours(2) })).k, "encours");
    assert.equal(etatStage(STAGE({ dateDebut: dansNJours(-9), dateFin: dansNJours(-5) })).k, "termine");
  });

  test("un stage d'un seul jour reste lisible", () => {
    const { periodeStage } = chargerApp();
    const d = "2026-10-21";
    assert.ok(!periodeStage(STAGE({ dateDebut: d, dateFin: d })).includes("→"));
    assert.ok(periodeStage(STAGE({ dateDebut: d, dateFin: "2026-10-23" })).includes("→"));
  });
});

describe("Le compte d'un stage", () => {
  test("ce qui est attendu, facturé, encaissé", () => {
    const { bilanStage } = chargerApp();
    const ins = [INSCRIT(), INSCRIT({ id: "i2", eleveId: "e2", factureId: "f1" })];
    const factures = [factureType({ id: "f1", eleveId: "e2", stageId: "s1", montant: 189, encaisse: 100 })];
    const b = bilanStage(STAGE(), ins, factures);
    assert.equal(b.attendu, 378);
    assert.equal(b.facture, 189);
    assert.equal(b.encaisse, 100);
    assert.equal(b.reste, 89);
    assert.equal(b.aFacturer.length, 1, "l'élève sans facture reste à facturer");
  });

  test("une facture annulée rend l'inscription de nouveau facturable", () => {
    // Sinon une erreur de saisie priverait l'élève de facture pour toujours.
    const { bilanStage } = chargerApp();
    const ins = [INSCRIT({ factureId: "f1" })];
    const factures = [factureType({ id: "f1", stageId: "s1", montant: 189, statut: "annulee" })];
    const b = bilanStage(STAGE(), ins, factures);
    assert.equal(b.facture, 0);
    assert.equal(b.aFacturer.length, 1);
  });

  test("les inscrits d'un autre stage ne comptent pas", () => {
    const { bilanStage } = chargerApp();
    const b = bilanStage(STAGE(), [INSCRIT({ stageId: "autre" })], []);
    assert.equal(b.ins.length, 0);
    assert.equal(b.aFacturer.length, 0);
  });
});

describe("L'écran des stages", () => {
  const rendre = (stages, inscrits = [], factures = []) => {
    const { ModuleStages } = chargerApp();
    return renderToStaticMarkup(React.createElement(ModuleStages, {
      stages, inscrits, factures, eleves: [{ ...eleveType, id: "e1" }],
      onSaveStage: async () => {}, onInscrire: async () => {},
      onDesinscrire: async () => {}, onFacturerStage: async () => 1
    }));
  };

  test("sans stage, il explique à quoi sert l'onglet", () => {
    const html = rendre([]);
    assert.ok(html.includes("Aucun stage"));
    assert.ok(html.includes("149"), "les forfaits de l'offre sont rappelés");
  });

  test("un stage affiche son forfait, ses dates et ses places", () => {
    const html = rendre([STAGE()], [INSCRIT()]);
    assert.ok(html.includes("189,00"));
    assert.ok(html.includes("Stage Toussaint"));
    assert.ok(html.includes("1/8"), "une place prise sur huit");
  });

  test("il propose de facturer les inscrits qui ne le sont pas", () => {
    const html = rendre([STAGE()], [INSCRIT(), INSCRIT({ id: "i2", eleveId: "e2" })]);
    assert.ok(html.includes("Facturer (2)"));
  });

  test("tout le monde facturé : plus de bouton de facturation", () => {
    const html = rendre([STAGE()], [INSCRIT({ factureId: "f1" })],
      [factureType({ id: "f1", stageId: "s1", montant: 189, encaisse: 189, statut: "paye" })]);
    assert.ok(!html.includes("Facturer ("));
  });

  test("ce qui reste dû renvoie vers les relances", () => {
    const html = rendre([STAGE()], [INSCRIT({ factureId: "f1" })],
      [factureType({ id: "f1", stageId: "s1", montant: 189, encaisse: 89, numero: "F2026-0012" })]);
    assert.ok(html.includes("100,00"));
    assert.ok(html.includes("relancer depuis Factures"));
  });

  test("les stages passés sont rangés à part", () => {
    const html = rendre([
      STAGE(),
      STAGE({ id: "s2", nom: "Stage été", dateDebut: dansNJours(-40), dateFin: dansNJours(-36) })
    ]);
    assert.ok(html.indexOf("À venir") < html.indexOf("Terminés"));
  });
});

describe("Le formulaire de stage", () => {
  test("il propose les trois forfaits de l'offre", () => {
    const { FormulaireStage, FORFAITS_STAGE } = chargerApp();
    assert.deepEqual(FORFAITS_STAGE, [149, 189, 229]);
    const html = renderToStaticMarkup(React.createElement(FormulaireStage, {
      onSave: async () => {}, onCancel: () => {}
    }));
    ["149 €", "189 €", "229 €"].forEach(t => assert.ok(html.includes(t), t));
  });

  test("il annonce la recette si le stage fait le plein", () => {
    const { FormulaireStage } = chargerApp();
    const html = renderToStaticMarkup(React.createElement(FormulaireStage, {
      initial: STAGE({ tarif: 189, places: 8 }), onSave: async () => {}, onCancel: () => {}
    }));
    assert.ok(html.includes("1512,00"), "189 € × 8 places");
  });
});

describe("La facture d'un stage", () => {
  const FACTURE_STAGE = (extra = {}) => factureType({
    numero: "F2026-0012", dateEmission: "2026-10-20", nbSeances: 0, montant: 189,
    datesSeances: [], stageId: "s1", periodeDebut: "2026-10-19", periodeFin: "2026-10-23",
    prestation: "Stage — Toussaint · Mathématiques", ...extra
  });

  test("le PDF imprime le forfait, pas « Aucune séance »", () => {
    const { construireFacturePDF } = chargerApp();
    const brut = Buffer.from(construireFacturePDF(FACTURE_STAGE(), eleveType, parametresComplets)).toString("latin1");
    assert.match(brut, /Stage/);
    assert.match(brut, /Forfait tout compris/);
    assert.ok(!brut.includes("Aucune s"), "une facture de stage n'a pas de séances à déplorer");
    assert.match(brut, /189,00/);
  });

  test("le PDF reste un PDF valide", () => {
    const { construireFacturePDF } = chargerApp();
    const octets = construireFacturePDF(FACTURE_STAGE(), eleveType, parametresComplets);
    const brut = Buffer.from(octets).toString("latin1");
    assert.ok(brut.startsWith("%PDF-1.4"));
    assert.ok(brut.trimEnd().endsWith("%%EOF"));
  });

  test("l'écran de facture affiche la ligne de forfait", () => {
    const { VueImpression } = chargerApp();
    const html = renderToStaticMarkup(React.createElement(VueImpression, {
      facture: FACTURE_STAGE(), eleve: eleveType, parametres: parametresComplets,
      onClose: () => {}, onDelete: async () => {}, onEmettre: async () => {}
    }));
    assert.ok(html.includes("Stage — Toussaint"));
    assert.ok(!html.includes("Aucune séance"));
  });

  test("le message au parent annonce le stage, pas un décompte de séances", () => {
    const { makeFactureWhatsApp, makeFactureSMS } = chargerApp();
    const wa = makeFactureWhatsApp(eleveType, "F2026-0012", 0, 189, [], 3, "Stage — Toussaint");
    assert.match(wa, /Stage — Toussaint/);
    assert.ok(!wa.includes("0 séance"));
    assert.match(wa, /189 €/);
    const sms = makeFactureSMS(eleveType, "F2026-0012", 0, 189, 3, "Stage — Toussaint");
    assert.match(sms, /Stage — Toussaint/);
    assert.ok(!sms.includes("0 séance"));
  });

  test("une facture de cours garde son décompte de séances", () => {
    // Le forfait est une branche, pas un remplacement.
    const { makeFactureWhatsApp } = chargerApp();
    const wa = makeFactureWhatsApp(eleveType, "2026-09", 3, 75, [], 3);
    assert.match(wa, /3 séances de 2 h/);
  });
});

describe("Stages et cours ne se mélangent pas", () => {
  test("la facture d'un stage ne clôt aucune période de cours", () => {
    // Sans cela, un stage facturé en octobre ferait passer pour réglées les
    // séances de cours de la même semaine : des heures travaillées, jamais
    // facturées.
    const { dernierePeriodeFin } = chargerApp();
    const factures = [
      factureType({
        id: "fs", eleveId: "e1", stageId: "s1", numero: "F2026-0012",
        datesSeances: [], periodeFin: "2026-10-23", montant: 189
      })
    ];
    assert.equal(dernierePeriodeFin("e1", factures), null);
  });

  test("une facture de cours, elle, clôt bien sa période", () => {
    const { dernierePeriodeFin } = chargerApp();
    const factures = [factureType({ id: "fc", eleveId: "e1", numero: "F2026-0011", statut: "paye" })];
    assert.equal(dernierePeriodeFin("e1", factures), "2026-09-29");
  });

  test("le brouillon de cours ignore les stages pour se recalculer", () => {
    // Garde-fou côté base : syncFacture ne doit jamais retomber sur la facture
    // d'un stage, qu'elle écraserait au montant des séances — ou supprimerait.
    const { api } = chargerApp();
    assert.ok(api.syncFacture, "syncFacture existe");
    assert.match(String(api.syncFacture), /is\("stage_id", null\)/);
  });
});
