/**
 * Le geste le plus fréquent de l'application : la facture part au parent.
 * Il doit tenir en un clic côté application — ce qui suit appartient au téléphone.
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

const rendreFacturation = (factures, eleves, extra = {}) => {
  const { ModuleFacturation } = chargerApp();
  return renderToStaticMarkup(React.createElement(ModuleFacturation, {
    eleves, groupes: [], appels: {}, factures,
    parametres: { ...parametresComplets, seuil_facturation: 3 },
    onSaveFacture: async () => {}, onDeleteFacture: async () => {},
    onDeleteFactureEnCours: async () => {}, onEmettreFacture: async () => "F2026-0001",
    onRecharger: async () => {}, ...extra
  }));
};

describe("Le bouton d'envoi direct", () => {
  test("il apparaît sur les factures qui ont atteint le seuil", () => {
    const html = rendreFacturation(
      [factureType({ id: "f1", eleveId: "e1", nbSeances: 3, montant: 75 })],
      [{ ...eleveType, id: "e1" }]);
    assert.ok(html.includes("Envoyer"), "un bouton d'envoi doit être proposé");
  });

  test("le nom reste cliquable pour relire la facture avant de l'envoyer", () => {
    const html = rendreFacturation(
      [factureType({ id: "f1", eleveId: "e1", nbSeances: 3, montant: 75 })],
      [{ ...eleveType, id: "e1", prenom: "Hawa", nom: "Sall" }]);
    assert.ok(html.includes("Hawa Sall"));
    assert.ok(html.includes("3 séances"));
  });

  test("rien n'est proposé sous le seuil", () => {
    const html = rendreFacturation(
      [factureType({ id: "f1", eleveId: "e1", nbSeances: 1, montant: 25 })],
      [{ ...eleveType, id: "e1" }]);
    assert.ok(!html.includes("à envoyer"), "une seule séance n'appelle pas de facture");
  });
});

describe("L'ordre des opérations", () => {
  // navigator.share() n'est accepté que dans la foulée du clic : l'autorisation
  // accordée par le geste de l'utilisateur expire. Si l'on rechargeait toutes les
  // données avant de partager, le partage échouerait sur iPhone.
  test("l'émission ne recharge pas les données avant le partage", () => {
    const page = pageConstruite();
    assert.ok(page.includes("{ recharger: false }"),
      "l'émission doit différer le rechargement pour préserver l'autorisation de partage");
  });

  test("le rechargement a bien lieu, mais après", () => {
    const page = pageConstruite();
    const i = page.indexOf("partagerFacturePDF(emise");
    const j = page.indexOf("onRecharger", i);
    assert.ok(i > 0 && j > i, "onRecharger doit être appelé après le partage");
  });

  test("une autorisation expirée est expliquée, pas signalée comme une panne", () => {
    const page = pageConstruite();
    assert.ok(page.includes("NotAllowedError"));
    assert.ok(page.includes("Facture émise. Ouvrez-la pour la partager."),
      "la facture est émise : le dire, plutôt que de laisser croire à un échec");
  });

  test("l'émission reste confirmée une fois", () => {
    // Un numéro de facture est définitif : la séquence comptable ne tolère pas de trou.
    const page = pageConstruite();
    assert.ok(page.includes("et l'envoyer au parent ?"));
    assert.ok(page.includes("numéro définitif"));
  });

  test("une facturation impossible est arrêtée avant l'émission", () => {
    const page = pageConstruite();
    const i = page.indexOf("const emettreEtEnvoyer");
    const garde = page.indexOf("champsManquants(parametres)", i);
    const emission = page.indexOf("onEmettreFacture(f.id", i);
    assert.ok(garde > i && garde < emission,
      "les mentions légales sont vérifiées avant d'attribuer un numéro");
  });
});

describe("Ce qui part au parent", () => {
  test("le message cite le numéro que la base vient d'attribuer", () => {
    const page = pageConstruite();
    assert.ok(page.includes("makeFactureWhatsApp(el, emise.numero"),
      "le message doit porter le numéro définitif, pas la période du brouillon");
  });

  test("le PDF est fabriqué à partir de la facture émise, pas du brouillon", () => {
    const page = pageConstruite();
    assert.ok(page.includes("partagerFacturePDF(emise, el, parametres, texte)"));
    assert.ok(page.includes("numero: numero || f.numero"));
  });
});

describe("Montants à la française partout", () => {
  test("plus aucun tarif horaire avec un point décimal", () => {
    const page = pageConstruite();
    assert.ok(!/th, "€\/h/.test(page), "les écrans doivent écrire 12,50 €/h");
    assert.ok(!/\$\{eleve\.th\} €\/h/.test(page));
  });

  test("le formateur est partagé par toute l'application", () => {
    const { chargerApp: _ } = { chargerApp };
    const { api } = chargerApp();
    assert.ok(api, "l'application se charge");
    const page = pageConstruite();
    assert.ok(page.includes("euros(eleve.th)") || page.includes("euros(e.th)"));
  });
});

describe("Partage depuis la liste des factures", () => {
  // Régression du 02/10 : une fois les factures émises, elles quittent l'encadré
  // doré (qui ne liste que ce qui reste à émettre) et plus aucun chemin ne menait
  // au PDF depuis la liste. Le panneau d'envoi des cartes ne recevait pas la facture.
  const carte = (facture) => {
    const { ModuleFacturation } = chargerApp();
    const eleve = { ...eleveType, id: "e1", prenom: "Nour", nom: "Sebbar", tel: "06 11 22 33 44" };
    return renderToStaticMarkup(React.createElement(ModuleFacturation, {
      eleves: [eleve], groupes: [], appels: {}, factures: [facture],
      parametres: { ...parametresComplets, seuil_facturation: 3 },
      onSaveFacture: async () => {}, onDeleteFacture: async () => {},
      onDeleteFactureEnCours: async () => {}, onEmettreFacture: async () => "F2026-0002",
      onRecharger: async () => {}
    }));
  };

  test("une facture émise se partage depuis sa carte", () => {
    const html = carte(factureType({
      id: "f1", eleveId: "e1", nbSeances: 3, montant: 90,
      numero: "F2026-0002", dateEmission: "2026-10-02"
    }));
    assert.ok(html.includes("Partager la facture PDF"),
      "sans cela, une facture émise n'a plus aucun chemin vers le PDF");
  });

  test("un brouillon ne le propose toujours pas", () => {
    const html = carte(factureType({ id: "f1", eleveId: "e1", nbSeances: 3, montant: 90 }));
    assert.ok(!html.includes("Partager la facture PDF"),
      "un montant qui bouge encore n'a pas à partir chez un parent");
  });

  test("le message d'une facture émise cite son numéro", () => {
    const html = carte(factureType({
      id: "f1", eleveId: "e1", nbSeances: 3, montant: 90,
      numero: "F2026-0002", dateEmission: "2026-10-02"
    }));
    assert.ok(html.includes("F2026-0002"));
  });
});
