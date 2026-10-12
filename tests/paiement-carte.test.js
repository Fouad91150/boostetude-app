/**
 * Paiement par carte (Stripe), 3.5.0.
 *
 * Le lien de paiement est fabriqué côté serveur, au montant exact du reste à
 * payer, et le paiement revient seul en versement « Carte ». Côté application,
 * trois exigences : ne jamais proposer un lien qui demanderait un mauvais
 * montant, le faire figurer partout où le parent lit sa facture, et ne jamais
 * bloquer un envoi parce que Stripe ne répond pas.
 */
import { test, describe, afterEach } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { execFileSync } from "node:child_process";
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chargerApp, eleveType, factureType, parametresComplets } from "./charger-app.js";

const URL_CARTE = "https://buy.stripe.com/eVq5kwcRa9Ao3di0lx8bS03";
const octetsEnTexte = o => Buffer.from(o).toString("latin1");

const emise = (extra = {}) => factureType({
  numero: "F2026-0007", dateEmission: "2026-10-12", nbSeances: 3, montant: 75,
  lienPaiement: URL_CARTE, lienMontant: 75, ...extra
});

afterEach(() => {
  delete globalThis.__reponseFonction;
  globalThis.__appelsFonctions = [];
});

describe("Le lien n'est proposé qu'au bon montant", () => {
  test("facture émise, rien versé : le lien vaut", () => {
    const { lienPaiementValide } = chargerApp();
    assert.equal(lienPaiementValide(emise()), URL_CARTE);
  });

  test("après un acompte en espèces, l'ancien lien réclamerait trop : il est écarté", () => {
    const { lienPaiementValide } = chargerApp();
    assert.equal(lienPaiementValide(emise({ encaisse: 25, statut: "partiel" })), null);
  });

  test("un lien refait pour le reste après acompte est de nouveau valable", () => {
    const { lienPaiementValide } = chargerApp();
    assert.equal(lienPaiementValide(emise({ encaisse: 25, statut: "partiel", lienMontant: 50 })), URL_CARTE);
  });

  test("facture payée, annulée ou encore en brouillon : aucun lien", () => {
    const { lienPaiementValide } = chargerApp();
    assert.equal(lienPaiementValide(emise({ statut: "paye", encaisse: 75 })), null);
    assert.equal(lienPaiementValide(emise({ statut: "annulee" })), null);
    assert.equal(lienPaiementValide(emise({ numero: null })), null);
    assert.equal(lienPaiementValide(emise({ lienPaiement: null })), null);
    assert.equal(lienPaiementValide(null), null);
  });
});

describe("Les messages au parent", () => {
  test("la facture WhatsApp porte le lien, avant les autres moyens", () => {
    const { makeFactureWhatsApp } = chargerApp();
    const t = makeFactureWhatsApp(eleveType, "F2026-0007", 3, 75, [], 3, null, URL_CARTE);
    assert.ok(t.includes(URL_CARTE));
    assert.match(t, /Payer en ligne par carte/);
    assert.ok(t.indexOf(URL_CARTE) < t.indexOf("Règlement au choix"), "le lien vient en tête des moyens");
  });

  test("sans lien, pas de ligne de paiement en ligne ; la carte reste proposée sur demande", () => {
    const { makeFactureWhatsApp } = chargerApp();
    const t = makeFactureWhatsApp(eleveType, "F2026-0007", 3, 75, [], 3, null);
    assert.doesNotMatch(t, /Payer en ligne/);
    assert.doesNotMatch(t, /buy\.stripe/);
    assert.match(t, /sur simple demande/);
  });

  test("la relance et le courriel portent aussi le lien", () => {
    const { makeRappelWhatsApp, makeFactureEmail } = chargerApp();
    assert.ok(makeRappelWhatsApp(eleveType, "F2026-0007", 50, [], 25, URL_CARTE).includes(URL_CARTE));
    assert.ok(makeFactureEmail(eleveType, "F2026-0007", 3, 75, [], 3, null, URL_CARTE).corps.includes(URL_CARTE));
  });
});

describe("Le PDF", () => {
  test("il affiche l'encadré et l'adresse en clair", () => {
    const { construireFacturePDF } = chargerApp();
    const brut = octetsEnTexte(construireFacturePDF(emise(), eleveType, parametresComplets));
    assert.match(brut, /Payer en ligne par carte bancaire/);
    assert.ok(brut.includes(`(${URL_CARTE}) Tj`), "l'adresse doit être lisible sur papier");
  });

  test("l'encadré est cliquable : une annotation de lien pointe sur Stripe", () => {
    const { construireFacturePDF } = chargerApp();
    const brut = octetsEnTexte(construireFacturePDF(emise(), eleveType, parametresComplets));
    assert.match(brut, /\/Annots \[8 0 R\]/);
    assert.ok(brut.includes(`/S /URI /URI (${URL_CARTE})`));
  });

  test("avec l'annotation, la table de références reste exacte et l'Info reste l'objet 7", () => {
    const { construireFacturePDF } = chargerApp();
    const brut = octetsEnTexte(construireFacturePDF(emise(), eleveType, parametresComplets));
    const positions = (brut.match(/^(\d{10}) 00000 n $/gm) || []).map(l => parseInt(l, 10));
    assert.equal(positions.length, 8, "sept objets fixes + une annotation");
    positions.forEach((pos, i) => assert.ok(brut.startsWith(`${i + 1} 0 obj`, pos), `objet ${i + 1}`));
    assert.match(brut, /\/Info 7 0 R/);
    assert.match(brut.slice(positions[6], positions[7]), /\/Title/);
  });

  test("qpdf accepte le fichier", { skip: !qpdfDisponible() }, () => {
    const { construireFacturePDF } = chargerApp();
    const dossier = mkdtempSync(join(tmpdir(), "pdf-carte-"));
    const chemin = join(dossier, "f.pdf");
    writeFileSync(chemin, Buffer.from(construireFacturePDF(emise(), eleveType, parametresComplets)));
    const sortie = execFileSync("qpdf", ["--check", chemin], { encoding: "utf8" });
    assert.match(sortie, /No syntax or stream encoding errors/);
  });

  test("après acompte, plus d'encadré ni d'annotation au mauvais montant", () => {
    const { construireFacturePDF } = chargerApp();
    const brut = octetsEnTexte(construireFacturePDF(emise({ encaisse: 25, statut: "partiel" }), eleveType, parametresComplets));
    assert.doesNotMatch(brut, /Annots/);
    assert.doesNotMatch(brut, /Payer en ligne/);
  });
});

describe("L'écran de la facture et le règlement", () => {
  test("la vue imprimée propose le lien cliquable", () => {
    const { VueImpression } = chargerApp();
    const html = renderToStaticMarkup(React.createElement(VueImpression, {
      facture: emise(), eleve: eleveType, parametres: parametresComplets, onClose() {}, onEmettre() {}
    }));
    assert.ok(html.includes(`href="${URL_CARTE}"`));
  });

  test("modes de règlement : virement, carte, Wero, espèces — plus de chèque", () => {
    const { MODES_REGLEMENT } = chargerApp();
    assert.deepEqual(MODES_REGLEMENT, ["Virement", "Carte", "Wero", "Espèces"]);
  });
});

describe("L'appel au serveur", () => {
  test("il demande le lien pour la facture visée, à la bonne fonction", async () => {
    const { api } = chargerApp();
    globalThis.__appelsFonctions = [];
    const r = await api.lienPaiement("fac-1");
    assert.equal(r.url, "https://buy.stripe.com/test_lien");
    assert.equal(globalThis.__appelsFonctions[0].nom, "stripe-lien-facture");
    assert.deepEqual(globalThis.__appelsFonctions[0].options.body, { facture_id: "fac-1" });
  });

  test("une erreur du serveur remonte avec son message lisible", async () => {
    const { api } = chargerApp();
    globalThis.__reponseFonction = () => ({
      data: null,
      error: { message: "Edge Function returned a non-2xx status code",
               context: { json: async () => ({ erreur: "Facture déjà soldée" }) } }
    });
    await assert.rejects(api.lienPaiement("fac-1"), /Facture déjà soldée/);
  });

  test("une réponse sans adresse est une erreur, pas un lien vide", async () => {
    const { api } = chargerApp();
    globalThis.__reponseFonction = () => ({ data: {}, error: null });
    await assert.rejects(api.lienPaiement("fac-1"), /indisponible/);
  });
});

function qpdfDisponible() {
  try { execFileSync("qpdf", ["--version"]); return true; } catch { return false; }
}

// L'ordre des gestes compte sur téléphone : une fenêtre ouverte après une attente
// est bloquée, et un partage lancé après une attente réseau est refusé. Ces
// invariants se lisent dans le code de l'envoi.
import { readFileSync } from "node:fs";
const source = f => readFileSync(new URL(`../src/app/${f}`, import.meta.url), "utf8");

describe("L'envoi ne se casse pas pour un lien de paiement", () => {
  const envoi = () => {
    const s = source("18-module-facturation.js");
    return s.slice(s.indexOf("const emettreEtEnvoyer"), s.indexOf("const actifs ="));
  };

  test("la fenêtre WhatsApp est réservée avant de demander le lien", () => {
    const s = envoi();
    assert.ok(s.indexOf('window.open("", "_blank")') < s.indexOf("api.lienPaiement"));
  });

  test("un lien indisponible n'empêche pas l'envoi : l'erreur est rattrapée", () => {
    const s = envoi();
    const appel = s.indexOf("api.lienPaiement");
    assert.ok(s.lastIndexOf("try {", appel) > s.indexOf("onEmettreFacture"), "l'appel est dans son propre try");
    assert.match(s, /sans lien carte/);
  });

  test("sans téléphone, le partage du PDF part sans détour par le serveur", () => {
    const s = envoi();
    const brancheSansTel = s.slice(s.indexOf("} else {", s.indexOf("api.lienPaiement")));
    const avantPartage = brancheSansTel.slice(0, brancheSansTel.indexOf("await partagerFacturePDF"));
    assert.ok(!avantPartage.includes("await") && !avantPartage.includes("lienPaiement"),
      "aucune attente avant le partage");
  });

  test("la relance réserve aussi sa fenêtre avant de demander un lien neuf", () => {
    const s = source("18b-relances.js");
    assert.ok(s.indexOf('window.open("", "_blank")') < s.indexOf("api.lienPaiement"));
  });
});
