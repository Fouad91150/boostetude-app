/**
 * « L'envoi des factures et le suivi, la relance » — la corvée nommée par Fouad.
 * Et la remise d'engagement multiple, qui change le prix de deux familles sur
 * dix-huit élèves : une erreur ici se voit tout de suite sur une facture.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { chargerApp, eleveType, factureType, parametresComplets } from "./charger-app.js";

const ilYa = n => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
};

const ELEVE = (extra = {}) => ({ ...eleveType, id: "e1", tel: "06 12 34 56 78", ...extra });

describe("Qui apparaît dans les relances", () => {
  test("une facture émise et impayée, oui", () => {
    const { aRelancer } = chargerApp();
    const f = factureType({ id: "f1", eleveId: "e1", montant: 90, encaisse: 0, numero: "F2026-0001", dateEmission: ilYa(10) });
    assert.equal(aRelancer([f], [ELEVE()]).length, 1);
  });

  test("un brouillon, non — il n'a jamais été envoyé", () => {
    const { aRelancer } = chargerApp();
    const f = factureType({ id: "f1", eleveId: "e1", montant: 90, encaisse: 0, numero: null });
    assert.equal(aRelancer([f], [ELEVE()]).length, 0);
  });

  test("une facture soldée, non", () => {
    const { aRelancer } = chargerApp();
    const f = factureType({ id: "f1", eleveId: "e1", montant: 90, encaisse: 90, numero: "F2026-0001", dateEmission: ilYa(10) });
    assert.equal(aRelancer([f], [ELEVE()]).length, 0);
  });

  test("une facture annulée, non", () => {
    const { aRelancer } = chargerApp();
    const f = factureType({ id: "f1", eleveId: "e1", montant: 90, encaisse: 0, numero: "F2026-0003", statut: "annulee", dateEmission: ilYa(30) });
    assert.equal(aRelancer([f], [ELEVE()]).length, 0);
  });

  test("une facture partiellement réglée, oui — pour le reste", () => {
    const { aRelancer } = chargerApp();
    const f = factureType({ id: "f1", eleveId: "e1", montant: 90, encaisse: 50, statut: "partiel", numero: "F2026-0001", dateEmission: ilYa(10) });
    const liste = aRelancer([f], [ELEVE()]);
    assert.equal(liste.length, 1);
    assert.equal(liste[0].reste, 40);
  });

  test("les plus anciennes en premier", () => {
    const { aRelancer } = chargerApp();
    const factures = [
      factureType({ id: "jeune", eleveId: "e1", montant: 90, encaisse: 0, numero: "F2", dateEmission: ilYa(3) }),
      factureType({ id: "vieille", eleveId: "e1", montant: 90, encaisse: 0, numero: "F1", dateEmission: ilYa(30) })
    ];
    const liste = aRelancer(factures, [ELEVE()]);
    assert.equal(liste[0].f.id, "vieille");
    assert.equal(liste[0].jours, 30);
  });
});

describe("L'écran de relance", () => {
  const rendre = (factures, eleves) => {
    const { ModuleRelances } = chargerApp();
    return renderToStaticMarkup(React.createElement(ModuleRelances, {
      eleves, factures, parametres: parametresComplets, onRelancer: async () => {}
    }));
  };

  test("il annonce le total en attente", () => {
    const html = rendre([
      factureType({ id: "f1", eleveId: "e1", montant: 90, encaisse: 0, numero: "F1", dateEmission: ilYa(10) }),
      factureType({ id: "f2", eleveId: "e1", montant: 50, encaisse: 0, numero: "F2", dateEmission: ilYa(5) })
    ], [ELEVE()]);
    assert.ok(html.includes("140,00"), "90 € + 50 €");
  });

  test("il dit depuis quand, et quand on a relancé", () => {
    const html = rendre([factureType({
      id: "f1", eleveId: "e1", montant: 90, encaisse: 0, numero: "F1",
      dateEmission: ilYa(12), derniereRelance: ilYa(3)
    })], [ELEVE()]);
    assert.ok(html.includes("12 jours"));
    assert.ok(html.includes("relancé il y a 3 jours"));
  });

  test("une facture jamais relancée le dit aussi", () => {
    const html = rendre([factureType({
      id: "f1", eleveId: "e1", montant: 90, encaisse: 0, numero: "F1", dateEmission: ilYa(4)
    })], [ELEVE()]);
    assert.ok(html.includes("jamais relancé"));
  });

  test("sans téléphone, il demande le numéro au lieu d'offrir un bouton mort", () => {
    const html = rendre([factureType({
      id: "f1", eleveId: "e1", montant: 90, encaisse: 0, numero: "F1", dateEmission: ilYa(4)
    })], [ELEVE({ tel: "" })]);
    assert.ok(html.includes("Pas de téléphone parent"));
    assert.ok(!html.includes("Relancer par WhatsApp"));
  });

  test("rien à relancer se dit clairement", () => {
    const html = rendre([], [ELEVE()]);
    assert.ok(html.includes("Rien à relancer"));
  });
});

describe("Le message de relance", () => {
  test("il réclame le reste, pas le total", () => {
    // Un parent qui a versé un acompte n'aime pas qu'on lui redemande tout.
    const { makeRappelWhatsApp } = chargerApp();
    const t = makeRappelWhatsApp(ELEVE(), "F2026-0001", 40, [{ date: "2026-09-18", matiere: "Mathématiques" }], 50);
    assert.match(t, /Reste à régler : 40 €/);
    assert.match(t, /Déjà versé : 50 €/);
  });

  test("sans acompte, il ne parle pas d'acompte", () => {
    const { makeRappelWhatsApp } = chargerApp();
    const t = makeRappelWhatsApp(ELEVE(), "F2026-0001", 90, [], 0);
    assert.ok(!t.includes("Déjà versé"));
  });

  test("il rappelle comment payer et signe", () => {
    const { makeRappelWhatsApp } = chargerApp();
    const t = makeRappelWhatsApp(ELEVE(), "F2026-0001", 90, [], 0);
    assert.match(t, /espèces, chèque ou virement/);
    assert.match(t, /Fouad Elmkhanter/);
  });
});

describe("Remise d'engagement multiple", () => {
  const G = (id, eids, matiere) => ({ id, nom: id, matiere, eids });

  test("un enfant seul en une matière paie plein tarif", () => {
    const { appliquerRemiseMulti } = chargerApp();
    const eleves = [{ ...eleveType, id: "e1", th: 15, tel: "0600000001", actif: true }];
    const r = appliquerRemiseMulti(eleves, [G("g1", ["e1"], "Mathématiques")], 2.5);
    assert.equal(r[0].th, 15);
    assert.equal(r[0].remise, undefined);
  });

  test("deux enfants d'un même foyer : chacun a la remise", () => {
    // Les Sall : Hawa et Faty, même numéro de parent.
    const { appliquerRemiseMulti } = chargerApp();
    const eleves = [
      { ...eleveType, id: "e1", prenom: "Hawa", th: 12.5, tel: "06 03 33 65 96", actif: true },
      { ...eleveType, id: "e2", prenom: "Faty", th: 12.5, tel: "0603336596", actif: true }
    ];
    const r = appliquerRemiseMulti(eleves, [G("g1", ["e1", "e2"], "Mathématiques")], 2.5);
    assert.equal(r[0].th, 10);
    assert.equal(r[1].th, 10);
    assert.equal(r[0].thBase, 12.5);
  });

  test("le format du numéro n'empêche pas de reconnaître un foyer", () => {
    const { appliquerRemiseMulti } = chargerApp();
    const eleves = [
      { ...eleveType, id: "e1", th: 15, tel: "+33 6 12 34 56 78", actif: true },
      { ...eleveType, id: "e2", th: 15, tel: "06.12.34.56.78", actif: true }
    ];
    const r = appliquerRemiseMulti(eleves, [G("g1", ["e1", "e2"], "Mathématiques")], 2.5);
    assert.equal(r[0].th, 12.5);
  });

  test("un enfant seul qui suit deux matières l'a aussi", () => {
    const { appliquerRemiseMulti } = chargerApp();
    const eleves = [{ ...eleveType, id: "e1", th: 15, tel: "0600000001", actif: true }];
    const r = appliquerRemiseMulti(eleves, [
      G("g1", ["e1"], "Mathématiques"), G("g2", ["e1"], "Physique-Chimie")
    ], 2.5);
    assert.equal(r[0].th, 12.5);
    assert.equal(r[0].inscriptionsFoyer, 2);
  });

  test("deux groupes de la même matière ne comptent qu'une inscription", () => {
    // Un élève qui change de créneau de maths ne gagne pas une remise.
    const { appliquerRemiseMulti } = chargerApp();
    const eleves = [{ ...eleveType, id: "e1", th: 15, tel: "0600000001", actif: true }];
    const r = appliquerRemiseMulti(eleves, [
      G("g1", ["e1"], "Mathématiques"), G("g2", ["e1"], "Mathématiques")
    ], 2.5);
    assert.equal(r[0].th, 15);
  });

  test("un élève inactif ne fait pas gagner de remise à son frère", () => {
    const { appliquerRemiseMulti } = chargerApp();
    const eleves = [
      { ...eleveType, id: "e1", th: 15, tel: "0600000001", actif: true },
      { ...eleveType, id: "e2", th: 15, tel: "0600000001", actif: false }
    ];
    const r = appliquerRemiseMulti(eleves, [G("g1", ["e1", "e2"], "Mathématiques")], 2.5);
    assert.equal(r[0].th, 15);
  });

  test("sans contact parent, pas de foyer donc pas de remise automatique", () => {
    const { appliquerRemiseMulti } = chargerApp();
    const eleves = [
      { ...eleveType, id: "e1", th: 15, tel: "", email: "", actif: true },
      { ...eleveType, id: "e2", th: 15, tel: "", email: "", actif: true }
    ];
    const r = appliquerRemiseMulti(eleves, [G("g1", ["e1", "e2"], "Mathématiques")], 2.5);
    assert.equal(r[0].th, 15);
  });

  test("une remise nulle ne change rien", () => {
    const { appliquerRemiseMulti } = chargerApp();
    const eleves = [
      { ...eleveType, id: "e1", th: 15, tel: "0600000001", actif: true },
      { ...eleveType, id: "e2", th: 15, tel: "0600000001", actif: true }
    ];
    assert.equal(appliquerRemiseMulti(eleves, [G("g1", ["e1", "e2"], "Maths")], 0)[0].th, 15);
  });

  test("le tarif ne descend jamais sous zéro", () => {
    const { appliquerRemiseMulti } = chargerApp();
    const eleves = [
      { ...eleveType, id: "e1", th: 2, tel: "0600000001", actif: true },
      { ...eleveType, id: "e2", th: 2, tel: "0600000001", actif: true }
    ];
    assert.equal(appliquerRemiseMulti(eleves, [G("g1", ["e1", "e2"], "Maths")], 2.5)[0].th, 0);
  });

  test("la facture dit d'où vient le prix", () => {
    const { construireFacturePDF } = chargerApp();
    const brut = Buffer.from(construireFacturePDF(
      factureType({ numero: "F2026-0005", dateEmission: "2026-10-05", nbSeances: 4, montant: 80 }),
      { ...eleveType, th: 10, thBase: 12.5, remise: 2.5 }, parametresComplets)).toString("latin1");
    assert.match(brut, /remise de 2,50/);
  });
});
