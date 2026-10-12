/**
 * Premier cours offert (3.5.2). Un nouvel élève ne paie pas sa toute première
 * séance ; un élève déjà là l'an dernier paie tout. La séance offerte reste
 * visible sur la facture (à 0 €), sans fausser le tarif horaire des autres.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { chargerApp, eleveType, factureType, parametresComplets } from "./charger-app.js";

const appels = {
  "ap:g1:2026-09-23": { e1: "present", e2: "present" },
  "ap:g1:2026-09-30": { e1: "present", e2: "absent_nj" },
  "ap:g1:2026-10-07": { e1: "present", e2: "present" }
};
const groupes = [{ id: "g1", matiere: "Mathématiques", eids: ["e1", "e2"] }];
const nouveau = { ...eleveType, id: "e1", th: 15, offert: true };
const ancien = { ...eleveType, id: "e2", th: 15, offert: false };

describe("Le calcul", () => {
  test("nouvel élève : la première présence est offerte, les suivantes payées", () => {
    const a = chargerApp();
    const dates = a.marquerOfferte(nouveau, a.seancesOuvertes("e1", appels, groupes, null), appels);
    assert.equal(dates.length, 3);
    assert.equal(dates.filter(d => d.offert).length, 1);
    assert.equal(dates.find(d => d.offert).date, "2026-09-23");
    assert.equal(a.montantSeances(nouveau, dates), 60);
  });

  test("élève de l'an dernier : rien d'offert", () => {
    const a = chargerApp();
    const dates = a.marquerOfferte(ancien, a.seancesOuvertes("e2", appels, groupes, null), appels);
    assert.equal(dates.filter(d => d.offert).length, 0);
    assert.equal(a.montantSeances(ancien, dates), 60);
  });

  test("la première séance est la première PRÉSENCE : une absence ne compte pas", () => {
    const a = chargerApp();
    const ap = { "ap:g1:2026-09-16": { e1: "absent_nj" }, ...appels };
    assert.equal(a.premiereSeance("e1", ap).date, "2026-09-23");
  });

  test("une fois facturée, la séance offerte ne se rejoue pas sur la facture suivante", () => {
    const a = chargerApp();
    const emise = factureType({ id: "f1", eleveId: "e1", numero: "F2026-0001", statut: "paye",
      datesSeances: [{ date: "2026-09-23", matiere: "Mathématiques", groupeId: "g1", offert: true },
                     { date: "2026-09-30", matiere: "Mathématiques", groupeId: "g1" }] });
    const suite = a.marquerOfferte(nouveau, a.seancesOuvertes("e1", appels, groupes, a.dejaFacturees("e1", [emise])), appels);
    assert.deepEqual(suite.map(d => d.date), ["2026-10-07"]);
    assert.equal(a.montantSeances(nouveau, suite), 30, "la 3e séance se paie normalement");
  });

  test("le rattrapage des appels des collègues applique aussi l'offre", () => {
    const a = chargerApp();
    const r = a.brouillonsEnRetard([nouveau], groupes, appels, []);
    assert.equal(r[0].montant, 60);
  });
});

describe("La facture", () => {
  const f = factureType({ numero: "F2026-0011", nbSeances: 3, montant: 60,
    datesSeances: [{ date: "2026-09-23", matiere: "Mathématiques", offert: true },
                   { date: "2026-09-30", matiere: "Mathématiques" },
                   { date: "2026-10-07", matiere: "Mathématiques" }] });

  test("le PDF imprime la séance offerte à 0 € et garde 15 €/h sur les séances payées", () => {
    const { construireFacturePDF } = chargerApp();
    const brut = Buffer.from(construireFacturePDF(f, { ...nouveau, niveau: "1ère" }, parametresComplets)).toString("latin1");
    assert.match(brut, /Premi\xe8re s\xe9ance offerte/);
    assert.match(brut, /\(15,00 \x80\/h\)/, "tarif des séances payées intact");
    assert.match(brut, /\(4 h\) Tj/, "deux séances payées = 4 h");
  });

  test("la vue imprimée montre la séance offerte", () => {
    const { VueImpression } = chargerApp();
    const html = renderToStaticMarkup(React.createElement(VueImpression, {
      facture: f, eleve: nouveau, parametres: parametresComplets, onClose() {}, onEmettre() {} }));
    assert.match(html, /Première séance offerte/);
  });

  test("une facture ne portant que la séance offerte n'affiche pas « Aucune séance »", () => {
    const { VueImpression } = chargerApp();
    const seule = factureType({ montant: 0, nbSeances: 1, datesSeances: [{ date: "2026-10-06", matiere: "Mathématiques", offert: true }] });
    const html = renderToStaticMarkup(React.createElement(VueImpression, {
      facture: seule, eleve: nouveau, parametres: parametresComplets, onClose() {}, onEmettre() {} }));
    assert.doesNotMatch(html, /Aucune séance/);
  });

  test("le message WhatsApp compte les séances payées et annonce la séance offerte", () => {
    const { makeFactureWhatsApp } = chargerApp();
    const t = makeFactureWhatsApp(nouveau, "F2026-0011", 3, 60, f.datesSeances, 3, null);
    assert.match(t, /• 2 séances de 2 h × 15,00 €\/h/);
    assert.match(t, /1re séance offerte/);
  });
});
