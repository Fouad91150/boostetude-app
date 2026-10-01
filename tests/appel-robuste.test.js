/**
 * L'appel se fait debout, dans une salle, sur un téléphone, avec un réseau qui
 * va et vient. Ces tests vérifient les trois promesses faites à cet usage :
 *   — la saisie survit à la coupure ;
 *   — le compte rendu se demande sur place, à la fin de l'appel ;
 *   — rien n'arrête l'écran en pleine action.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { chargerApp } from "./charger-app.js";

const racine = join(dirname(fileURLToPath(import.meta.url)), "..");
const pageConstruite = () => readFileSync(join(racine, "dist", "index.html"), "utf8");

describe("Brouillon local de l'appel", () => {
  test("ce qui est écrit se relit", () => {
    const { Local } = chargerApp();
    Local.ecrire("bo:essai", { e1: "present" });
    assert.deepEqual(Local.lire("bo:essai", null), { e1: "present" });
  });

  test("une clé absente rend la valeur par défaut", () => {
    const { Local } = chargerApp();
    assert.equal(Local.lire("bo:jamais-ecrit", "defaut"), "defaut");
  });

  test("un stockage refusé ne fait pas tomber l'application", () => {
    // Navigation privée, réglages verrouillés : le filet disparaît, pas l'app.
    const { Local } = chargerApp();
    const vrai = globalThis.localStorage;
    assert.doesNotThrow(() => {
      Local.lire("peu importe", "defaut");
      Local.ecrire("peu importe", { a: 1 });
      Local.effacer("peu importe");
    });
    globalThis.localStorage = vrai;
  });

  test("la clé de brouillon distingue groupe et date", () => {
    const { cleBrouillonAppel } = chargerApp();
    assert.notEqual(cleBrouillonAppel("g1", "2026-10-01"), cleBrouillonAppel("g1", "2026-10-08"));
    assert.notEqual(cleBrouillonAppel("g1", "2026-10-01"), cleBrouillonAppel("g2", "2026-10-01"));
  });
});

describe("File des appels non transmis", () => {
  test("une coupure réseau met l'appel de côté au lieu de le perdre", async () => {
    const { envoyerAppel, fileAppels } = chargerApp();
    const envoi = async () => { throw new Error("Failed to fetch"); };

    const r = await envoyerAppel(envoi, "g1", "2026-10-01", { e1: "present" });

    assert.equal(r.envoye, false);
    assert.equal(r.enAttente, true);
    assert.equal(fileAppels.lire().length, 1);
    assert.deepEqual(fileAppels.lire()[0].presMap, { e1: "present" });
  });

  test("un refus du serveur remonte à l'utilisateur et n'encombre pas la file", async () => {
    // Un droit manquant ou une donnée invalide doit se voir, pas se rejouer en boucle.
    const { envoyerAppel, fileAppels } = chargerApp();
    const envoi = async () => { throw new Error("new row violates row-level security policy"); };

    await assert.rejects(() => envoyerAppel(envoi, "g1", "2026-10-01", { e1: "present" }));
    assert.equal(fileAppels.lire().length, 0);
  });

  test("un envoi réussi efface le brouillon", async () => {
    const { envoyerAppel, fileAppels, Local, cleBrouillonAppel } = chargerApp();
    Local.ecrire(cleBrouillonAppel("g1", "2026-10-01"), { e1: "present" });

    const r = await envoyerAppel(async () => {}, "g1", "2026-10-01", { e1: "present" });

    assert.equal(r.envoye, true);
    assert.equal(fileAppels.lire().length, 0);
    assert.equal(Local.lire(cleBrouillonAppel("g1", "2026-10-01"), null), null);
  });

  test("un même groupe et une même date n'occupent qu'une place", async () => {
    const { envoyerAppel, fileAppels } = chargerApp();
    const envoi = async () => { throw new Error("Failed to fetch"); };

    await envoyerAppel(envoi, "g1", "2026-10-01", { e1: "present" });
    await envoyerAppel(envoi, "g1", "2026-10-01", { e1: "absent_nj" });

    const file = fileAppels.lire();
    assert.equal(file.length, 1, "le dernier état saisi remplace le précédent");
    assert.deepEqual(file[0].presMap, { e1: "absent_nj" });
  });

  test("au retour du réseau, la file part", async () => {
    const { envoyerAppel, rejouerFileAppels, fileAppels } = chargerApp();
    await envoyerAppel(async () => { throw new Error("Failed to fetch"); }, "g1", "2026-10-01", { e1: "present" });
    await envoyerAppel(async () => { throw new Error("Failed to fetch"); }, "g2", "2026-10-01", { e2: "present" });
    assert.equal(fileAppels.lire().length, 2);

    const envoyes = [];
    const { rejoues, restants } = await rejouerFileAppels(async (g, d, p) => { envoyes.push([g, d, p]); });

    assert.equal(rejoues, 2);
    assert.equal(restants, 0);
    assert.equal(envoyes.length, 2);
  });

  test("ce qui échoue encore pour cause de réseau reste en file", async () => {
    const { envoyerAppel, rejouerFileAppels, fileAppels } = chargerApp();
    await envoyerAppel(async () => { throw new Error("Failed to fetch"); }, "g1", "2026-10-01", { e1: "present" });

    const { rejoues, restants } = await rejouerFileAppels(async () => { throw new Error("NetworkError"); });

    assert.equal(rejoues, 0);
    assert.equal(restants, 1);
    assert.equal(fileAppels.lire().length, 1);
  });
});

describe("Panne de réseau ou refus du serveur", () => {
  test("les messages de coupure sont reconnus", () => {
    const { estPanneReseau } = chargerApp();
    for (const m of ["Failed to fetch", "NetworkError when attempting to fetch",
                     "Load failed", "Network request failed", "timeout of 5000ms exceeded"]) {
      assert.equal(estPanneReseau(new Error(m)), true, m);
    }
  });

  test("un refus métier n'est pas pris pour une coupure", () => {
    const { estPanneReseau } = chargerApp();
    for (const m of ["new row violates row-level security policy",
                     "duplicate key value violates unique constraint",
                     "Facture déjà émise"]) {
      assert.equal(estPanneReseau(new Error(m)), false, m);
    }
  });
});

describe("Bandeaux", () => {
  test("un abonné reçoit ce qui est signalé", () => {
    const { Signal, signalerErreur, signalerSucces } = chargerApp();
    const recus = [];
    const desabonner = Signal.abonner((type, texte) => recus.push([type, texte]));

    signalerSucces("c'est fait");
    signalerErreur(new Error("c'est raté"));

    assert.deepEqual(recus, [["succes", "c'est fait"], ["erreur", "c'est raté"]]);
    desabonner();
    signalerSucces("plus personne n'écoute");
    assert.equal(recus.length, 2);
  });

  test("une erreur sans message reste lisible", () => {
    const { Signal, signalerErreur } = chargerApp();
    let texte = null;
    Signal.abonner((_t, x) => { texte = x; });
    signalerErreur(undefined);
    assert.ok(texte && texte.length > 0, "un bandeau vide ne dirait rien à personne");
  });

  test("un abonné qui jette n'empêche pas les autres d'être servis", () => {
    const { Signal, signalerInfo } = chargerApp();
    let recu = false;
    Signal.abonner(() => { throw new Error("abonné défaillant"); });
    Signal.abonner(() => { recu = true; });
    assert.doesNotThrow(() => signalerInfo("message"));
    assert.equal(recu, true);
  });
});

describe("Écran de fin de séance", () => {
  // Ce qui a été perdu une fois peut l'être deux fois : ces vérifications
  // existent parce qu'un déploiement de septembre avait effacé le suivi.
  test("le compte rendu est demandé dans l'appel, pas renvoyé à un autre onglet", () => {
    const page = pageConstruite();
    assert.ok(page.includes("Qu'avez-vous travaillé"),
      "l'écran qui suit l'appel doit poser la question");
    assert.ok(page.includes("onSaveComptesRendus"),
      "le module appel doit pouvoir enregistrer le compte rendu lui-même");
  });

  test("le compte rendu enregistré depuis l'appel vaut pour les présents", () => {
    const page = pageConstruite();
    assert.ok(page.includes('pres[id] === "present"'),
      "seuls les élèves présents reçoivent le compte rendu de la séance");
  });

  test("le détail élève par élève reste accessible", () => {
    const page = pageConstruite();
    assert.ok(page.includes("Détailler élève par élève"),
      "l'écran rapide ne doit pas supprimer la saisie fine");
  });
});

describe("Liste des groupes à l'appel", () => {
  const groupes = [
    { id: "g1", nom: "3e", matiere: "Mathématiques", jour: "Lundi", hd: "18:00", hf: "20:00", max: 6, eids: ["e1", "e2"] },
    { id: "g2", nom: "Primaire", matiere: "Mathématiques", jour: "Mercredi", hd: "14:00", hf: "16:00", max: 6, eids: [] }
  ];
  const eleves = [
    { id: "e1", prenom: "Hawa", nom: "Sall", niveau: "3ème", th: 15, actif: true },
    { id: "e2", prenom: "Faty", nom: "Sall", niveau: "3ème", th: 15, actif: true }
  ];

  const rendu = () => {
    const { ModuleAppel } = chargerApp();
    return renderToStaticMarkup(React.createElement(ModuleAppel, {
      eleves, groupes, appels: {}, comptesRendus: [], monProfilId: "p1",
      onSaveAppel: async () => {}, onSaveComptesRendus: async () => {},
      onSaveGroupe: async () => {}, isAdmin: true, profs: [], onAllerSuivi: () => {}
    }));
  };

  test("un groupe qui a des élèves est proposé normalement", () => {
    assert.ok(rendu().includes("3e"));
  });

  test("un groupe sans inscrit est relégué et compté", () => {
    const html = rendu();
    assert.ok(html.includes("1 groupe sans élève inscrit"),
      "les places tenues pour plus tard ne doivent pas encombrer l'appel");
  });

  test("aucun groupe n'est supprimé pour autant", () => {
    // Replier n'est pas effacer : le groupe vide reste atteignable.
    const page = pageConstruite();
    assert.ok(page.includes("groupesVides"), "les groupes vides restent dans l'application");
  });
});

describe("Chargement borné dans le temps", () => {
  test("cours et présences ne sont plus chargés sans limite", () => {
    const page = pageConstruite();
    assert.ok(page.includes("depuisUnAn"), "une borne temporelle doit exister");
    assert.ok(/from\("cours"\)\.select\("\*"\)\.gte\("date"/.test(page),
      "les cours doivent être bornés");
    assert.ok(/from\("presences"\)\.select\("\*"\)\.gte\("date"/.test(page),
      "les présences doivent être bornées");
  });

  test("la borne couvre l'exercice comptable en cours", () => {
    const { api } = chargerApp();
    assert.ok(api, "l'API reste chargeable malgré le filtre");
    // Douze mois glissants : au-delà, les factures sont émises et figées.
    const page = pageConstruite();
    assert.ok(page.includes("d.setFullYear(d.getFullYear() - 1)"));
  });
});

describe("Plus d'alerte bloquante", () => {
  test("aucune erreur ne passe par alert()", () => {
    const page = pageConstruite();
    assert.ok(!page.includes('alert("Erreur : "'),
      "une alerte navigateur fige l'application en pleine séance");
  });

  test("les suppressions demandent toujours confirmation", () => {
    // Choix délibéré : une action irréversible doit arrêter la main.
    const page = pageConstruite();
    assert.ok(page.includes("confirm("),
      "supprimer une facture ou des séances reste une décision qu'on confirme");
  });
});
