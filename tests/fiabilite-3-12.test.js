/**
 * Passe de fiabilité 3.12.0 (24/11/2026). Chaque test verrouille un bug
 * trouvé à l'audit, pour qu'il ne revienne pas.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { chargerApp, eleveType, factureType } from "./charger-app.js";

const app = chargerApp();
const MATHS = { id: "gm", matiere: "Mathématiques", eids: ["e1"] };
const present = (...cles) => Object.fromEntries(cles.map(k => [k, { e1: "present" }]));
const aujourdhui = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

describe("Numéro WhatsApp", () => {
  test("les formats courants donnent le même numéro", () => {
    for (const t of ["06 12 34 56 78", "+33 6 12 34 56 78", "0033612345678", "+33 (0)6 12 34 56 78", "+330612345678"])
      assert.equal(app.telWhatsApp(t), "33612345678", t);
  });
  test("deux numéros dans le champ : seul le premier sert", () => {
    assert.equal(app.telWhatsApp("06 12 34 56 78 / 07 11 22 33 44"), "33612345678");
    assert.equal(app.telWhatsApp("06 12 34 56 78 ou 07 11 22 33 44"), "33612345678");
  });
});

describe("Salutation", () => {
  test("nom du parent absent : « Bonjour, » et non « Bonjour , »", () => {
    assert.equal(app.salut({ parent: "" }), "Bonjour");
    assert.equal(app.salut({ parent: "Mme Sall" }), "Bonjour Mme Sall");
    const m = app.makeFactureWhatsApp({ ...eleveType, parent: "" }, "septembre 2026", 1, 25, factureType().datesSeances);
    assert.match(m, /Bonjour,\n/);
    assert.ok(!/Bonjour ,/.test(m));
  });
});

describe("Séance offerte : une seule par matière, pour toujours", () => {
  const emise = factureType({ id: "f1", eleveId: "e1", numero: "F2026-0001", statut: "en_attente",
    datesSeances: [{ date: "2026-10-06", matiere: "Mathématiques", groupeId: "gm", offert: true },
                   { date: "2026-10-13", matiere: "Mathématiques", groupeId: "gm" }] });

  test("un appel saisi en retard, plus ancien, n'offre pas une seconde séance", () => {
    const appels = present("ap:gm:2026-09-29", "ap:gm:2026-10-06", "ap:gm:2026-10-13");
    const s = app.seancesOuvertes("e1", appels, [MATHS], app.dejaFacturees("e1", [emise]), true);
    assert.deepEqual(s.map(x => x.date), ["2026-09-29"]);
    assert.equal(s[0].offert, undefined);
  });

  test("une reprise après plus d'un an (hors fenêtre chargée) ne ré-offre rien", () => {
    const appels = present("ap:gm:2026-11-03");
    const s = app.seancesOuvertes("e1", appels, [MATHS], app.dejaFacturees("e1", [emise]), true);
    assert.equal(s.some(x => x.offert), false);
  });
});

describe("Brouillon plus ancien que douze mois", () => {
  test("ses séances hors de la fenêtre ne sont pas effacées au rattrapage", () => {
    const e = { ...eleveType, th: 12.5 };
    const brouillon = factureType({ id: "b1", nbSeances: 1, montant: 25,
      datesSeances: [{ date: "2020-01-06", matiere: "Mathématiques", groupeId: "gm" }] });
    const appels = present("ap:gm:2026-11-02");
    const r = app.brouillonsEnRetard([e], [MATHS], appels, [brouillon]);
    assert.equal(r.length, 1);
    assert.deepEqual(r[0].dates.map(d => d.date), ["2020-01-06", "2026-11-02"]);
    assert.equal(r[0].montant, 50);
  });
});

describe("Feuille d'appel", () => {
  const groupes = [{ id: "g1", nom: "3e", matiere: "Mathématiques", jour: "Lundi", hd: "18:00", hf: "20:00", max: 6, eids: ["e1", "e2"] }];
  const eleves = [
    { id: "e1", prenom: "Hawa", nom: "Sall", niveau: "3ème", th: 15, actif: true },
    { id: "e2", prenom: "Faty", nom: "Sall", niveau: "3ème", th: 15, actif: true }
  ];
  const rendu = appels => renderToStaticMarkup(React.createElement(app.ModuleAppel, {
    eleves, groupes, appels, comptesRendus: [], monProfilId: "p1",
    onSaveAppel: async () => {}, onSaveComptesRendus: async () => {},
    onSaveGroupe: async () => {}, isAdmin: true, profs: [], onAllerSuivi: () => {}
  }));

  test("un cours sans aucune présence (créé par un compte rendu) n'est pas « Fait »", () => {
    assert.ok(!rendu({ [`ap:g1:${aujourdhui()}`]: {} }).includes("✓ Fait"));
  });
  test("un appel réellement saisi reste « Fait »", () => {
    assert.ok(rendu({ [`ap:g1:${aujourdhui()}`]: { e1: "present", e2: "absent_nj" } }).includes("✓ Fait"));
  });
});

describe("Garde-fous dans le code", () => {
  const src = f => readFileSync(new URL(`../src/app/${f}`, import.meta.url), "utf8");

  test("un rechargement ne démonte plus l'écran ouvert", () => {
    assert.match(src("20-app.js"), /if \(loadingData && !dejaCharge\)/);
  });
  test("la date de l'appel ne peut pas passer dans le futur", () => {
    const s = src("15-module-appel.js");
    assert.match(s, /max: todayStr\(\)/);
    assert.match(s, /const changerDate = d => \{\s*if \(estFuture\(d\)\)/);
  });
  test("la suppression d'un brouillon vise le cours exact, pas toute la journée", () => {
    assert.match(src("03-api-supabase.js"), /in\("cours_id", ids\)/);
  });
  test("une lecture ratée des réglages n'efface pas les remises", () => {
    assert.match(src("03-api-supabase.js"), /if \(eReg\) throw eReg;/);
  });
  test("le Suivi enregistre le tronc commun même sans « Appliquer »", () => {
    assert.match(src("19c-suivi.js"), /const source = avecCommun\(brouillon\);/);
  });
});
