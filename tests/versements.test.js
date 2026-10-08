/**
 * Un parent règle rarement d'un coup. La facture doit savoir dire ce qui a été
 * versé et ce qui reste — y compris quand elle continue de grossir entre deux
 * versements.
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
const textesDessines = octets => {
  const brut = Buffer.from(octets).toString("latin1");
  return (brut.match(/\(((?:[^()\\]|\\.)*)\)\s*Tj/g) || [])
    .map(m => m.replace(/\)\s*Tj$/, "").slice(1).replace(/\\([()\\])/g, "$1")).join("\n");
};

describe("Reste à payer", () => {
  test("il se déduit des versements", () => {
    const { resteDu } = chargerApp();
    assert.equal(resteDu({ montant: 90, encaisse: 50 }), 40);
    assert.equal(resteDu({ montant: 90, encaisse: 90 }), 0);
  });

  test("un trop-perçu ne devient pas une dette négative", () => {
    const { resteDu } = chargerApp();
    assert.equal(resteDu({ montant: 90, encaisse: 100 }), 0);
  });

  test("une facture qui grossit laisse à nouveau un reste", () => {
    // Le cas de Fouad : 90 € réglés, puis trois séances de plus.
    const { resteDu } = chargerApp();
    assert.equal(resteDu({ montant: 90, encaisse: 90 }), 0);
    assert.equal(resteDu({ montant: 120, encaisse: 90 }), 30);
  });

  test("les centimes ne dérivent pas", () => {
    const { resteDu } = chargerApp();
    assert.equal(resteDu({ montant: 37.5, encaisse: 12.5 }), 25);
    assert.equal(resteDu({ montant: 0.3, encaisse: 0.1 }), 0.2);
  });
});

describe("Une facture émise est figée", () => {
  // Sans cela, une facture envoyée au parent continuerait de grossir et son
  // montant ne voudrait plus rien dire.
  test("le cumul repart après la dernière facture émise, même impayée", () => {
    const { dernierePeriodeFin } = chargerApp();
    const factures = [{
      eleveId: "e1", numero: "F2026-0001", statut: "en_attente", periodeFin: null,
      datesSeances: [{ date: "2026-09-15" }, { date: "2026-09-22" }, { date: "2026-09-29" }]
    }];
    assert.equal(dernierePeriodeFin("e1", factures), "2026-09-29");
  });

  test("un brouillon ne ferme aucune période", () => {
    const { dernierePeriodeFin } = chargerApp();
    const factures = [{
      eleveId: "e1", numero: null, statut: "en_attente", periodeFin: null,
      datesSeances: [{ date: "2026-09-15" }]
    }];
    assert.equal(dernierePeriodeFin("e1", factures), null);
  });

  test("la facture payée la plus récente l'emporte", () => {
    const { dernierePeriodeFin } = chargerApp();
    const factures = [
      { eleveId: "e1", numero: "F2026-0001", statut: "paye", periodeFin: "2026-06-30", datesSeances: [] },
      { eleveId: "e1", numero: "F2026-0004", statut: "paye", periodeFin: "2026-09-29", datesSeances: [] }
    ];
    assert.equal(dernierePeriodeFin("e1", factures), "2026-09-29");
  });

  test("seul le brouillon suit l'appel", () => {
    const page = pageConstruite();
    assert.ok(page.includes('.is("numero", null)') && page.includes('.neq("statut", "paye")'),
      "une facture numérotée ne doit plus être mise à jour par la feuille d'appel");
    assert.ok(page.includes('.is("stage_id", null)'),
      "ni la facture d'un stage, qui se vend au forfait");
  });
});

describe("La facture PDF déduit l'acompte", () => {
  const dessiner = (encaisse) => {
    const { construireFacturePDF } = chargerApp();
    return textesDessines(construireFacturePDF(
      factureType({ numero: "F2026-0002", dateEmission: "2026-10-02", nbSeances: 4, montant: 100, encaisse }),
      eleveType, parametresComplets));
  };

  test("sans acompte, elle annonce le net à payer", () => {
    const t = dessiner(0);
    assert.match(t, /NET . PAYER|NET À PAYER/);
    assert.ok(!t.includes("Déjà réglé"));
  });

  test("avec acompte, elle montre le détail et le reste", () => {
    const t = dessiner(40);
    assert.match(t, /Déjà réglé/);
    assert.match(t, /- 40,00/);
    assert.match(t, /RESTE . PAYER|RESTE À PAYER/);
    assert.match(t, /60,00/, "100 € moins 40 € d'acompte");
  });

  test("une facture soldée par versements ne redemande pas l'IBAN", () => {
    const t = dessiner(100);
    assert.ok(!t.includes("FR76"), "le parent a tout réglé : inutile de lui redonner le RIB");
  });
});

describe("Écran de règlement", () => {
  const rendre = (facture, encaissements) => {
    const { ModaleFacture } = chargerApp();
    return renderToStaticMarkup(React.createElement(ModaleFacture, {
      eleve: eleveType, existante: facture, dates: facture.datesSeances || [],
      encaissements, onAjouterVersement: async () => {}, onSupprimerVersement: async () => {},
      onSave: async () => {}, onClose: () => {}
    }));
  };

  test("il annonce le reste, pas seulement le total", () => {
    const html = rendre(
      factureType({ montant: 90, encaisse: 50, nbSeances: 3 }),
      [{ id: "v1", factureId: "x", date: "2026-09-30", montant: 50, mode: "Espèces", note: "" }]);
    assert.ok(html.includes("Reste à payer"));
    assert.ok(html.includes("40,00"));
    assert.ok(html.includes("Déjà versé"));
  });

  test("une facture soldée se dit soldée", () => {
    const html = rendre(
      factureType({ montant: 90, encaisse: 90, nbSeances: 3 }),
      [{ id: "v1", factureId: "x", date: "2026-09-30", montant: 90, mode: "Virement", note: "" }]);
    assert.ok(html.includes("Soldée"));
  });

  test("les trois moyens de règlement sont proposés", () => {
    const html = rendre(factureType({ montant: 90, encaisse: 0, nbSeances: 3 }), []);
    assert.ok(html.includes("Espèces"));
    assert.ok(html.includes("Virement"));
    assert.ok(html.includes("Chèque"));
  });

  test("chaque versement reçu peut être retiré", () => {
    // Une erreur de frappe sur un montant ne doit pas rester gravée.
    const html = rendre(
      factureType({ montant: 90, encaisse: 50 }),
      [{ id: "v1", factureId: "x", date: "2026-09-30", montant: 50, mode: "Espèces", note: "" }]);
    assert.ok(html.includes("Versements reçus"));
    assert.ok(html.includes("Retirer ce versement"));
  });

  test("le montant proposé est le reste dû", () => {
    const page = pageConstruite();
    assert.ok(page.includes('useState(reste > 0 ? String(reste).replace(".", ",") : "")'),
      "le geste courant est de solder : le champ doit être pré-rempli");
  });

  test("une virgule décimale est acceptée", () => {
    const page = pageConstruite();
    assert.ok(page.includes('String(montant).replace(",", ".")'),
      "on écrit 42,50 en France");
  });
});
