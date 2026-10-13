/**
 * La facture part chez des parents et, en cas de contrôle, chez l'administration.
 * Ces tests vérifient que le fichier produit est un vrai PDF, qu'il porte toutes
 * les mentions obligatoires, et qu'il dit au parent comment payer.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { chargerApp, eleveType, factureType, parametresComplets } from "./charger-app.js";

const octetsEnTexte = octets => Buffer.from(octets).toString("latin1");

const factureEmise = (extra = {}) => factureType({
  numero: "F2026-0001", dateEmission: "2026-10-02", nbSeances: 3, montant: 75,
  datesSeances: [
    { date: "2026-09-15", matiere: "Mathématiques" },
    { date: "2026-09-22", matiere: "Mathématiques" },
    { date: "2026-09-29", matiere: "Physique-Chimie" }
  ], ...extra
});

/** Extrait le texte dessiné : les PDF écrivent chaque chaîne entre parenthèses avant Tj. */
const textesDessines = octets => {
  const brut = octetsEnTexte(octets);
  return (brut.match(/\(((?:[^()\\]|\\.)*)\)\s*Tj/g) || [])
    .map(m => m.replace(/\)\s*Tj$/, "").slice(1).replace(/\\([()\\])/g, "$1"))
    .join("\n");
};

describe("Le fichier est un PDF valide", () => {
  test("il commence et finit comme un PDF", () => {
    const { construireFacturePDF } = chargerApp();
    const brut = octetsEnTexte(construireFacturePDF(factureEmise(), eleveType, parametresComplets));
    assert.ok(brut.startsWith("%PDF-1.4"), "en-tête PDF attendu");
    assert.ok(brut.trimEnd().endsWith("%%EOF"), "marque de fin attendue");
  });

  test("la table de références pointe bien sur chaque objet", () => {
    // Un décalage d'un octet ici et le fichier ne s'ouvre nulle part.
    const { construireFacturePDF } = chargerApp();
    const brut = octetsEnTexte(construireFacturePDF(factureEmise(), eleveType, parametresComplets));
    const positions = (brut.match(/^(\d{10}) 00000 n $/gm) || []).map(l => parseInt(l, 10));
    assert.equal(positions.length, 7, "sept objets attendus");
    positions.forEach((pos, i) => {
      assert.ok(brut.startsWith(`${i + 1} 0 obj`, pos),
        `l'objet ${i + 1} devrait commencer à l'octet ${pos}`);
    });
    const depart = parseInt(brut.slice(brut.lastIndexOf("startxref") + 9), 10);
    assert.ok(brut.startsWith("xref", depart), "startxref doit pointer sur la table");
  });

  test("la longueur déclarée du flux est la vraie", () => {
    const { construireFacturePDF } = chargerApp();
    const brut = octetsEnTexte(construireFacturePDF(factureEmise(), eleveType, parametresComplets));
    const declaree = parseInt(brut.match(/<< \/Length (\d+) >>/)[1], 10);
    const flux = brut.slice(brut.indexOf("stream\n") + 7, brut.indexOf("\nendstream"));
    assert.equal(flux.length, declaree);
  });

  test("le fichier reste léger", () => {
    const { construireFacturePDF } = chargerApp();
    const octets = construireFacturePDF(factureEmise(), eleveType, parametresComplets);
    assert.ok(octets.length < 20000, `une facture d'une page ne doit pas peser ${octets.length} octets`);
  });
});

describe("Mentions obligatoires", () => {
  const dessine = () => {
    const { construireFacturePDF } = chargerApp();
    return textesDessines(construireFacturePDF(factureEmise(), eleveType, parametresComplets));
  };

  test("le numéro et la date d'émission figurent sur la facture", () => {
    const t = dessine();
    assert.match(t, /F2026-0001/);
    assert.match(t, /\u00c9mise le 2 octobre 2026/);
  });

  test("l'identité de l'entreprise y est au complet", () => {
    const t = dessine();
    assert.match(t, /12345678900012/, "SIRET");
    assert.match(t, /85\.59B/, "code APE");
    assert.match(t, /Entrepreneur individuel/, "mention de forme juridique");
  });

  test("la franchise de TVA est mentionnée", () => {
    assert.match(dessine(), /article 293 B du CGI/);
  });

  test("les pénalités de retard et l'escompte figurent en pied", () => {
    const t = dessine();
    assert.match(t, /p\u00e9nalit\u00e9/i);
    assert.match(t, /escompte/i);
  });

  test("les montants sont au format français", () => {
    const t = dessine();
    assert.match(t, /75,00/, "le total doit s'écrire 75,00 et non 75.00");
    assert.ok(!/\d+\.\d\d\s*\u0080/.test(t), "aucun montant ne doit garder un point décimal");
  });
});

describe("Ce que le parent doit comprendre", () => {
  const dessine = () => {
    const { construireFacturePDF } = chargerApp();
    return textesDessines(construireFacturePDF(factureEmise(), eleveType, parametresComplets));
  };

  test("les moyens de paiement sont proposés, sans chèque", () => {
    const t = dessine();
    assert.match(t, /esp\u00e8ces/i, "espèces");
    assert.doesNotMatch(t, /ch\u00e8que/i, "plus de chèque");
    assert.match(t, /virement/i);
  });

  test("le nom de l'enfant est donné comme référence de virement", () => {
    // Sans référence, un virement arrive sans qu'on sache à qui le rattacher.
    const t = dessine();
    const occurrences = (t.match(/Lucas Martin/g) || []).length;
    assert.ok(occurrences >= 2,
      "le nom doit apparaître dans la phrase de règlement ET près de l'IBAN");
    assert.match(t, /R\u00e9f\u00e9rence \u00e0 indiquer/, "l'encadré bancaire répète la référence");
  });

  test("l'IBAN ne figure pas sur une facture déjà payée", () => {
    const { construireFacturePDF } = chargerApp();
    const payee = factureEmise({ statut: "paye", datePaiement: "2026-10-01", mode: "Virement" });
    const t = textesDessines(construireFacturePDF(payee, eleveType, parametresComplets));
    assert.ok(!t.includes("FR76"), "inutile de redemander un paiement déjà reçu");
    assert.match(t, /acquitt/i);
  });

  test("chaque matière est détaillée avec ses dates", () => {
    const t = dessine();
    assert.match(t, /Math\u00e9matiques/);
    assert.match(t, /Physique-Chimie/);
    assert.match(t, /15 sept/);
  });
});

describe("Brouillon et facture émise", () => {
  test("un brouillon s'annonce comme tel et n'a pas de numéro", () => {
    const { construireFacturePDF } = chargerApp();
    const t = textesDessines(construireFacturePDF(factureType(), eleveType, parametresComplets));
    assert.match(t, /BROUILLON/);
    assert.ok(!t.includes("F2026-"), "un brouillon ne porte aucun numéro");
  });

  test("le nom du fichier reprend le numéro et l'élève", () => {
    const { nomFichierFacture } = chargerApp();
    const nom = nomFichierFacture(factureEmise(), eleveType);
    assert.match(nom, /^Facture-F2026-0001-Lucas-Martin\.pdf$/);
  });

  test("un brouillon téléchargé se distingue d'une facture émise", () => {
    const { nomFichierFacture } = chargerApp();
    assert.match(nomFichierFacture(factureType(), eleveType), /brouillon/);
  });
});

describe("Encodage des caractères français", () => {
  test("les accents et l'euro passent en WinAnsi", () => {
    const { versWinAnsi } = chargerApp();
    assert.equal(versWinAnsi("Étampes"), "Étampes");
    assert.equal(versWinAnsi("€"), "\u0080", "l'euro vit à 0x80 en WinAnsi");
    assert.equal(versWinAnsi("Boost’Étude"), "Boost\u0092Étude", "apostrophe typographique");
  });

  test("un caractère hors table ne casse pas le fichier", () => {
    const { versWinAnsi } = chargerApp();
    assert.equal(versWinAnsi("中"), "?");
  });

  test("une facture au nom accentué reste un PDF valide", () => {
    const { construireFacturePDF } = chargerApp();
    const eleve = { ...eleveType, prenom: "Noëlle", nom: "Étienne-Bâ", parent: "Hélène Étienne" };
    const octets = construireFacturePDF(factureEmise(), eleve, parametresComplets);
    const brut = octetsEnTexte(octets);
    assert.ok(brut.startsWith("%PDF"));
    const declaree = parseInt(brut.match(/<< \/Length (\d+) >>/)[1], 10);
    assert.equal(brut.slice(brut.indexOf("stream\n") + 7, brut.indexOf("\nendstream")).length, declaree);
  });
});

describe("Mise en page du texte", () => {
  test("un texte long est coupé sur les espaces", () => {
    const { couperLignes } = chargerApp();
    const lignes = couperLignes("Cours de soutien scolaire en petit groupe le mercredi", 100, 9, false);
    assert.ok(lignes.length > 1);
    assert.equal(lignes.join(" "), "Cours de soutien scolaire en petit groupe le mercredi");
    assert.ok(!lignes.some(l => l.startsWith(" ") || l.endsWith(" ")));
  });

  test("un mot plus large que la colonne occupe sa ligne au lieu de disparaître", () => {
    const { couperLignes } = chargerApp();
    assert.deepEqual(couperLignes("anticonstitutionnellement", 10, 9, false), ["anticonstitutionnellement"]);
  });

  test("le gras est mesuré plus large que le romain", () => {
    const { largeurTexte } = chargerApp();
    assert.ok(largeurTexte("NET À PAYER", 11, true) > largeurTexte("NET À PAYER", 11, false));
  });
});
