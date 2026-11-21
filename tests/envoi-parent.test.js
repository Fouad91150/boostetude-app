/**
 * « Un bouton : le parent reçoit le PDF, le message et le lien Stripe. »
 * WhatsApp ouvert sur le numéro du parent ne transporte pas de fichier : le PDF
 * part donc en LIEN, à côté du lien de paiement au montant exact.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { chargerApp, eleveType, factureType, parametresComplets } from "./charger-app.js";

const ELEVE = { ...eleveType, id: "e1", prenom: "Lina", nom: "Benali", parent: "Mme Benali", tel: "06 12 34 56 78" };
const FACTURE = factureType({ id: "f1", eleveId: "e1", numero: "F2026-0007", montant: 90, nbSeances: 3 });

const preparer = ({ stripe = "https://buy.stripe.com/test_abc", pdf = "https://x.supabase.co/storage/v1/object/public/factures/F2026-0007-ab.pdf", stripeEchoue = false } = {}) => {
  const app = chargerApp();
  const appels = { stripe: 0, pdf: 0 };
  app.api.lienPaiementStripe = async () => { appels.stripe++; if (stripeEchoue) throw new Error("clé Stripe absente"); return stripe; };
  app.api.deposerFacturePDF = async (f, e, blob) => { appels.pdf++; return pdf; };
  return { app, appels };
};

describe("Envoi au parent en un geste", () => {
  test("le message porte le lien du PDF, sans paiement par carte, et s'ouvre chez le bon parent", async () => {
    const { app, appels } = preparer();
    const fenetre = {};
    const r = await app.envoyerAuParent({ facture: FACTURE, eleve: ELEVE, parametres: { ...parametresComplets, wero: "07 44 94 45 02" }, seuil: 3, fenetre });
    assert.equal(appels.stripe, 0, "plus de lien Stripe (21/11/2026)");
    assert.equal(appels.pdf, 1);
    assert.ok(fenetre.location.startsWith("https://wa.me/33612345678?text="), "conversation du parent");
    const texte = decodeURIComponent(fenetre.location.split("?text=")[1]);
    assert.doesNotMatch(texte, /stripe|carte/i);
    assert.match(texte, /factures\/F2026-0007-ab\.pdf/);
    assert.match(texte, /espèces au cours, virement bancaire ou Wero \(07 44 94 45 02\)/);
    assert.doesNotMatch(texte, /chèque/i);
    assert.doesNotMatch(texte, /jointe en PDF/, "rien n'est joint : c'est un lien");
    assert.deepEqual(r.soucis, []);
  });

  test("Stripe n'est même plus appelé : aucun souci possible de ce côté", async () => {
    const { app } = preparer({ stripeEchoue: true });
    const fenetre = {};
    const r = await app.envoyerAuParent({ facture: FACTURE, eleve: ELEVE, parametres: parametresComplets, seuil: 3, fenetre });
    const texte = decodeURIComponent(fenetre.location.split("?text=")[1]);
    assert.match(texte, /factures\/F2026-0007/);
    assert.doesNotMatch(texte, /stripe/);
    assert.match(texte, /virement/);
    assert.equal(r.soucis.length, 0);
  });

  test("une facture soldée ne demande pas de lien de paiement", async () => {
    const { app, appels } = preparer();
    await app.preparerLiens({ ...FACTURE, encaisse: 90 }, ELEVE, parametresComplets);
    assert.equal(appels.stripe, 0);
  });

  test("la relance annonce le reste dû, avec le PDF et sans carte", async () => {
    const { app } = preparer();
    const fenetre = {};
    await app.envoyerAuParent({ facture: { ...FACTURE, encaisse: 40 }, eleve: ELEVE, parametres: parametresComplets, fenetre, relance: true });
    const texte = decodeURIComponent(fenetre.location.split("?text=")[1]);
    assert.match(texte, /Reste à régler : 50 €/);
    assert.match(texte, /factures\/F2026-0007/);
    assert.doesNotMatch(texte, /stripe/i);
  });
});

describe("Le bouton unique sur la carte de l'élève", () => {
  test("une facture émise affiche « Envoyer sur WhatsApp — avec la facture PDF »", async () => {
    const React = (await import("react")).default;
    const { renderToStaticMarkup } = await import("react-dom/server");
    const { PanneauEnvoi } = chargerApp();
    const html = renderToStaticMarkup(React.createElement(PanneauEnvoi, {
      eleve: ELEVE, mois: "F2026-0007", nb: 3, montant: 90, dates: FACTURE.datesSeances,
      type: "facture", facture: FACTURE, parametres: parametresComplets, seuil: 3 }));
    assert.ok(html.includes("avec la facture PDF"));
  });
  test("un brouillon ne l'affiche pas", async () => {
    const React = (await import("react")).default;
    const { renderToStaticMarkup } = await import("react-dom/server");
    const { PanneauEnvoi } = chargerApp();
    const html = renderToStaticMarkup(React.createElement(PanneauEnvoi, {
      eleve: ELEVE, mois: "depuis…", nb: 3, montant: 90, dates: FACTURE.datesSeances,
      type: "facture", facture: { ...FACTURE, numero: null }, parametres: parametresComplets, seuil: 3 }));
    assert.ok(!html.includes("avec la facture PDF"));
  });
});
