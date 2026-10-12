/**
 * Ces messages partent du téléphone de Fouad vers des parents. Trois exigences :
 * dire comment payer, dire quoi écrire en référence d'un virement, et prévenir
 * que l'envoi est systématique — un montant reçu sans contexte fait téléphoner.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { chargerApp, eleveType, factureType, parametresComplets } from "./charger-app.js";

const DATES = [
  { date: "2026-09-15", matiere: "Mathématiques" },
  { date: "2026-09-22", matiere: "Mathématiques" },
  { date: "2026-09-29", matiere: "Physique-Chimie" }
];

describe("Moyens de paiement", () => {
  test("les moyens sont nommés : carte (Stripe), Wero, virement, espèces — sans chèque", () => {
    const { MOYENS_PAIEMENT_TEXTE } = chargerApp();
    const t = MOYENS_PAIEMENT_TEXTE(eleveType);
    assert.match(t, /carte bancaire/);
    assert.match(t, /Stripe/);
    assert.match(t, /Wero/);
    assert.match(t, /virement/);
    assert.match(t, /espèces/);
    assert.doesNotMatch(t, /chèque/i);
  });

  test("avec un lien de paiement, la carte renvoie au lien ; sans, on le propose sur demande", () => {
    const { MOYENS_PAIEMENT_TEXTE } = chargerApp();
    assert.match(MOYENS_PAIEMENT_TEXTE(eleveType, "https://buy.stripe.com/x"), /via le lien ci-dessus/);
    assert.match(MOYENS_PAIEMENT_TEXTE(eleveType), /sur simple demande/);
  });

  test("l'identifiant Wero réglé est cité, et la référence vaut aussi pour Wero", () => {
    const { MOYENS_PAIEMENT_TEXTE, definirContactWero } = chargerApp();
    definirContactWero("06 11 22 33 44");
    const t = MOYENS_PAIEMENT_TEXTE(eleveType);
    assert.match(t, /Wero au 06 11 22 33 44/);
    assert.match(t, /Pour un Wero ou un virement/);
  });

  test("le nom de l'enfant sert de référence au virement", () => {
    const { MOYENS_PAIEMENT_TEXTE } = chargerApp();
    assert.match(MOYENS_PAIEMENT_TEXTE(eleveType), /« Lucas Martin » en référence/);
  });

  test("la référence suit l'élève, pas un texte figé", () => {
    const { MOYENS_PAIEMENT_TEXTE } = chargerApp();
    const autre = { ...eleveType, prenom: "Hawa", nom: "Sall" };
    assert.match(MOYENS_PAIEMENT_TEXTE(autre), /Hawa Sall/);
  });
});

describe("Mention d'envoi automatique", () => {
  test("elle annonce le rythme réel", () => {
    const { mentionAutomatique } = chargerApp();
    assert.equal(mentionAutomatique(3), "Message automatique envoyé toutes les 3 séances.");
    assert.equal(mentionAutomatique(4), "Message automatique envoyé toutes les 4 séances.");
  });

  test("sans réglage, le rythme annoncé est celui par défaut", () => {
    const { mentionAutomatique, SEUIL_FACTURATION_DEFAUT } = chargerApp();
    assert.equal(SEUIL_FACTURATION_DEFAUT, 3);
    assert.match(mentionAutomatique(undefined), /toutes les 3 séances/);
  });

  test("les trois canaux la portent", () => {
    const { makeFactureSMS, makeFactureWhatsApp, makeFactureEmail } = chargerApp();
    const args = [eleveType, "septembre", 3, 75];
    assert.match(makeFactureSMS(...args, 3), /automatique/);
    assert.match(makeFactureWhatsApp(...args, DATES, 3), /automatique/);
    assert.match(makeFactureEmail(...args, DATES, 3).corps, /automatique/);
  });
});

describe("Message WhatsApp", () => {
  const wa = (seuil = 3) => chargerApp().makeFactureWhatsApp(eleveType, "septembre", 3, 75, DATES, seuil);

  test("il s'adresse au parent et nomme l'élève", () => {
    const t = wa();
    assert.match(t, /Marie Martin/);
    assert.match(t, /Lucas/);
  });

  test("il met le total en gras, comme WhatsApp sait le faire", () => {
    assert.match(wa(), /\*Total : 75 €\*/);
  });

  test("il détaille les matières quand il y en a plusieurs", () => {
    const t = wa();
    assert.match(t, /Mathématiques : 2 séances/);
    assert.match(t, /Physique-Chimie : 1 séance/);
  });

  test("il ne détaille pas quand une seule matière est suivie", () => {
    const { makeFactureWhatsApp } = chargerApp();
    const t = makeFactureWhatsApp(eleveType, "septembre", 2, 50,
      [{ date: "2026-09-15", matiere: "Mathématiques" }, { date: "2026-09-22", matiere: "Mathématiques" }], 3);
    assert.ok(!t.includes("• Mathématiques :"), "une seule matière ne mérite pas de ventilation");
  });

  test("il annonce la pièce jointe et signe", () => {
    const t = wa();
    assert.match(t, /jointe en PDF/);
    assert.match(t, /Fouad Elmkhanter/);
  });
});

describe("Message SMS", () => {
  test("il tient l'essentiel sans pièce jointe", () => {
    // Un SMS ne transporte pas de fichier : il doit se suffire à lui-même.
    const { makeFactureSMS } = chargerApp();
    const t = makeFactureSMS(eleveType, "septembre", 3, 75, 3);
    assert.match(t, /75 €/);
    assert.match(t, /Lucas/);
    assert.match(t, /référence : Lucas Martin/);
    assert.ok(!/PDF/.test(t), "ne pas annoncer une pièce jointe qu'un SMS ne peut pas porter");
  });

  test("il reste court", () => {
    const { makeFactureSMS } = chargerApp();
    const t = makeFactureSMS(eleveType, "septembre", 3, 75, 3);
    assert.ok(t.length < 320, `un SMS de ${t.length} caractères coûte trop de segments`);
  });

  test("le rappel de paiement propose aussi les trois moyens", () => {
    const { makeRappelSMS } = chargerApp();
    const t = makeRappelSMS(eleveType, "septembre", 75);
    assert.match(t, /Carte \(Stripe\), Wero, virement ou espèces/);
    assert.doesNotMatch(t, /chèque/i);
    assert.match(t, /Lucas Martin/);
  });
});

describe("Panneau d'envoi d'une facture", () => {
  const rendre = (facture) => {
    const { PanneauEnvoi } = chargerApp();
    return renderToStaticMarkup(React.createElement(PanneauEnvoi, {
      eleve: eleveType, mois: "septembre", nb: 3, montant: 75, dates: DATES,
      type: "facture", facture, parametres: parametresComplets, seuil: 3
    }));
  };

  test("une facture émise propose le partage du PDF", () => {
    const html = rendre(factureType({ numero: "F2026-0001", dateEmission: "2026-10-02" }));
    assert.ok(html.includes("Partager la facture PDF"));
  });

  test("un brouillon ne le propose pas", () => {
    // Son montant bouge encore à chaque séance pointée : l'envoyer n'aurait pas de sens.
    const html = rendre(factureType());
    assert.ok(!html.includes("Partager la facture PDF"));
  });

  test("WhatsApp, SMS et email sont offerts côte à côte", () => {
    const html = rendre(factureType({ numero: "F2026-0001" }));
    assert.ok(html.includes("WhatsApp"));
    assert.ok(html.includes("SMS"));
    assert.ok(html.includes("Email"));
  });

  test("le lien WhatsApp vise le numéro au format international", () => {
    const html = rendre(factureType({ numero: "F2026-0001" }));
    assert.ok(html.includes("wa.me/33612345678"), "06 12 34 56 78 doit devenir 33612345678");
  });

  test("la limite du SMS est dite au lieu d'être subie", () => {
    const html = rendre(factureType({ numero: "F2026-0001" }));
    assert.ok(html.includes("ne peut pas porter de pièce jointe"));
  });
});

describe("Seuil de facturation", () => {
  test("il est réglable et borné", () => {
    const { api } = chargerApp();
    assert.ok(typeof api.saveParametres === "function");
  });

  test("le module de facturation signale les factures qui l'ont atteint", () => {
    const { ModuleFacturation } = chargerApp();
    const eleves = [
      { ...eleveType, id: "e1", prenom: "Hawa", nom: "Sall" },
      { ...eleveType, id: "e2", prenom: "Imran", nom: "Oubidane" }
    ];
    const factures = [
      factureType({ id: "f1", eleveId: "e1", nbSeances: 3, montant: 75 }),
      factureType({ id: "f2", eleveId: "e2", nbSeances: 1, montant: 25 })
    ];
    const html = renderToStaticMarkup(React.createElement(ModuleFacturation, {
      eleves, groupes: [], appels: {}, factures,
      onSaveFacture: async () => {}, onDeleteFacture: async () => {},
      onDeleteFactureEnCours: async () => {}, onEmettreFacture: async () => {},
      parametres: { ...parametresComplets, seuil_facturation: 3 }
    }));
    assert.ok(html.includes("1 facture à envoyer"), "Hawa a trois séances, Imran une seule");
    assert.ok(html.includes("Hawa"));
  });

  test("une facture déjà émise ne se signale plus", () => {
    const { ModuleFacturation } = chargerApp();
    const eleves = [{ ...eleveType, id: "e1" }];
    const factures = [factureType({ id: "f1", eleveId: "e1", nbSeances: 5, montant: 125, numero: "F2026-0007" })];
    const html = renderToStaticMarkup(React.createElement(ModuleFacturation, {
      eleves, groupes: [], appels: {}, factures,
      onSaveFacture: async () => {}, onDeleteFacture: async () => {},
      onDeleteFactureEnCours: async () => {}, onEmettreFacture: async () => {},
      parametres: { ...parametresComplets, seuil_facturation: 3 }
    }));
    assert.ok(!html.includes("à envoyer"), "elle attend un paiement, pas une émission");
  });
});
