/**
 * Réglages → « 🎙 Cours en ligne » : Fouad enregistre sa voix diapo par diapo.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { chargerApp, parametresComplets } from "./charger-app.js";

const app = chargerApp();

describe("Cours en ligne (enregistrement de la voix)", () => {
  test("l'onglet apparaît dans les Réglages", () => {
    const html = renderToStaticMarkup(React.createElement(app.ModuleReglages, {
      parametres: parametresComplets, eleves: [], groupes: [], appels: {}, factures: [], encaissements: [], profs: [] }));
    assert.match(html, /Cours en ligne/);
  });
  test("le chemin d'un enregistrement range la diapo dans le dossier du cours", () => {
    const c = app.cheminAudio({ url: "3eme-arithmetique.pdf" }, 3, "m4a");
    assert.match(c, /^audio\/3eme-arithmetique\/03-[a-z0-9]+\.m4a$/);
  });
  test("compte des diapos enregistrées", () => {
    assert.equal(app.nbAudios({ audios: ["a", null, "b"] }), 2);
    assert.equal(app.nbAudios({}), 0);
  });
});
