/**
 * Charge les composants de l'application hors navigateur.
 *
 * Le code construit n'est pas un module : c'est un script destiné à une page,
 * qui déclare tout dans une portée globale et se termine par le montage React.
 * On le coupe avant le montage et on l'évalue avec un DOM et un client Supabase
 * factices — assez pour rendre les écrans et vérifier ce qu'ils affichent.
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import React from "react";

const racine = join(dirname(fileURLToPath(import.meta.url)), "..");

const reponseVide = { data: [], error: null };
const requete = () => {
  const r = {
    select: () => r, order: () => r, eq: () => r, neq: () => r, in: () => r,
    gte: () => r, lte: () => r, gt: () => r, lt: () => r,
    maybeSingle: () => ({ data: null, error: null }), single: () => ({ data: null, error: null }),
    insert: () => r, update: () => r, upsert: () => r, delete: () => r,
    then: (f) => Promise.resolve(reponseVide).then(f)
  };
  return r;
};

const sbFactice = {
  from: requete,
  rpc: async () => ({ data: "F2026-0001", error: null }),
  auth: {
    getSession: async () => ({ data: {} }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    signInWithPassword: async () => ({ error: null }),
    signOut: async () => {}
  }
};

export function chargerApp() {
  let script = readFileSync(join(racine, "dist", "index.html"), "utf8")
    .match(/<script>([\s\S]*?)<\/script>/)[1];
  script = script.slice(0, script.indexOf("// ─── MONTAGE"));

  const elementFactice = () => ({
    style: {}, select() {}, focus() {}, click() {}, remove() {},
    appendChild() {}, setAttribute() {}
  });

  const fenetre = {
    supabase: { createClient: () => sbFactice }, isSecureContext: true, __APP_VERSION: "test",
    addEventListener() {}, removeEventListener() {}
  };
  const doc = {
    createElement: elementFactice,
    body: { appendChild() {}, removeChild() {} },
    execCommand: () => true
  };

  return new Function("React", "window", "document", "navigator", "URL", "Blob", "localStorage", script + `
    return { VueImpression, ModuleReglages, OngletEntreprise, OngletLivreRecettes, OngletDonnees,
             BlocConformite, champsManquants, versCSV, ModuleFacturation, ModuleAppel, App, api, C,
             ModuleSuivi, ModuleBilans, CarteBilan, CarteSuiviEleve,
             bilanDonnees, makeBilanWhatsApp, makeBilanSMS, makeBilanEmail,
             lundiDe, addJours, isoSemaine, libelleSemaine, telWhatsApp, splitNotions,
             estCompteRenduVide, phrase,
             Local, fileAppels, envoyerAppel, rejouerFileAppels, estPanneReseau,
             cleBrouillonAppel, Signal, signalerErreur, signalerSucces, signalerInfo,
             PileBandeaux, BandeauHorsLigne,
             construireFacturePDF, nomFichierFacture, PanneauEnvoi, ModaleFacture,
             resteDu, dernierePeriodeFin, seancesOuvertes, euros, montantTxt, StatutBadge,
             ModuleRelances, aRelancer, joursDepuis, makeRappelWhatsApp,
             appliquerRemiseMulti, cleFoyer, compterInscriptions,
             makeFactureWhatsApp, makeFactureSMS, makeFactureEmail, makeRappelSMS,
             MOYENS_PAIEMENT_TEXTE, mentionAutomatique, SEUIL_FACTURATION_DEFAUT,
             largeurTexte, couperLignes, versWinAnsi,
             ModuleStages, FormulaireStage, ChoixEleve, bilanStage, etatStage,
             periodeStage, FORFAITS_STAGE,
             OngletProfesseurs, seancesDuMois, duAuProf, makeRemunerationWhatsApp,
             FenetreCompte, TAUX_HORAIRE_DEFAUT };
  `)(React, fenetre, doc, { clipboard: null, onLine: true },
     { createObjectURL: () => "blob:x", revokeObjectURL() {} },
     function Blob() {},
     memoireLocale());
}

/**
 * Stockage local factice. Le vrai peut être refusé par le navigateur ; les tests
 * couvrent aussi ce cas en passant `{ casse: true }`, qui fait échouer chaque
 * accès comme le ferait une navigation privée verrouillée.
 */
export function memoireLocale({ casse = false } = {}) {
  const sac = new Map();
  const boum = () => { throw new Error("localStorage indisponible"); };
  return {
    getItem: k => (casse ? boum() : (sac.has(k) ? sac.get(k) : null)),
    setItem: (k, v) => (casse ? boum() : void sac.set(k, String(v))),
    removeItem: k => (casse ? boum() : void sac.delete(k)),
    get taille() { return sac.size; }
  };
}

/** Élève et facture représentatifs de ce que produit l'application. */
export const eleveType = {
  id: "e1", prenom: "Lucas", nom: "Martin", niveau: "3ème", th: 12.5,
  parent: "Marie Martin", tel: "06 12 34 56 78", email: "marie@mail.fr", mp: "Virement", actif: true
};

export const factureType = (extra = {}) => ({
  id: "11111111-2222-3333-4444-555555555555",
  eleveId: "e1", nbSeances: 4, montant: 100, statut: "en_attente", mode: "Virement",
  datePaiement: "", notes: "", periodeDebut: "2026-09-01", periodeFin: null,
  numero: null, dateEmission: null,
  datesSeances: [
    { date: "2026-09-08", matiere: "Mathématiques" },
    { date: "2026-09-15", matiere: "Mathématiques" },
    { date: "2026-09-22", matiere: "Mathématiques" },
    { date: "2026-09-29", matiere: "Mathématiques" }
  ],
  mois: "2026-09", ...extra
});

export const parametresComplets = {
  denomination: "Boost'Étude", exploitant: "Fouad EL MKHANTER", forme_juridique: "EI",
  siret: "12345678900012", ape: "85.59B",
  adresse: "7 avenue des Meuniers", code_postal: "91150", ville: "Étampes",
  telephone: "07 44 94 45 02", email: "boostetude@gmail.com",
  iban: "FR76 3000 1000 0100 0000 0000 123", bic: "BDFEFRPP", titulaire_compte: "Fouad EL MKHANTER",
  mention_tva: "TVA non applicable, article 293 B du CGI",
  delai_paiement: "Paiement à réception de la facture.",
  penalites_retard: "En cas de retard de paiement, une pénalité égale à trois fois le taux d'intérêt légal est exigible, ainsi qu'une indemnité forfaitaire de 40 € pour frais de recouvrement.",
  escompte: "Aucun escompte n'est accordé pour paiement anticipé.",
  prefixe_facture: "F"
};
