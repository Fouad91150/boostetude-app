// ─── MODULE RÉGLAGES ─────────────────────────────────────────
// Trois choses que l'application ne pouvait pas faire jusqu'ici :
//  · saisir les mentions légales sans qu'elles soient écrites en dur dans un
//    fichier public (l'IBAN surtout) ;
//  · sortir le livre des recettes, obligatoire pour un micro-entrepreneur ;
//  · exporter toutes les données, pour la sauvegarde comme pour le RGPD.

// Téléchargement d'un fichier produit dans le navigateur.
// Le point-virgule et le BOM sont ce qu'attend un Excel français : sans eux,
// les accents sont illisibles et tout atterrit dans une seule colonne.
const telechargerFichier = (nom, contenu, type) => {
  const blob = new Blob([contenu], { type: type || "text/plain;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = nom;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
};

const versCSV = (colonnes, lignes) => {
  const cellule = v => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[";\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  return "﻿" + [colonnes.map(c => cellule(c.titre)).join(";")]
    .concat(lignes.map(l => colonnes.map(c => cellule(c.valeur(l))).join(";")))
    .join("\r\n");
};

function BlocConformite({ parametres }) {
  const manquants = champsManquants(parametres);
  const ok = manquants.length === 0;
  return h("div", {
    style: {
      background: ok ? C.greenPale : C.redPale,
      border: `1px solid ${ok ? C.greenBord : C.redBord}`,
      borderRadius: 12, padding: 13, marginBottom: 16
    }
  },
    h("div", { style: { fontSize: 13, fontWeight: 800, color: ok ? C.green : C.red, marginBottom: 5 } },
      ok ? "✅ Vos factures portent toutes les mentions obligatoires" : "⚠️ Vos factures ne sont pas conformes"),
    h("div", { style: { fontSize: 12, color: C.gray, lineHeight: 1.65 } },
      ok
        ? "Numérotation séquentielle, identité complète, mention de franchise de TVA et conditions de règlement : tout y est."
        : "Il manque : " + manquants.join(", ") + ". Tant que ces champs sont vides, une facture émise serait irrégulière.")
  );
}

function OngletEntreprise({ parametres, onSave }) {
  const [f, setF] = useState(parametres || {});
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const set = (k, v) => setF({ ...f, [k]: v });

  const enregistrer = async () => {
    setSaving(true);
    try {
      await onSave(f);
      setToast("Réglages enregistrés ✓");
      setTimeout(() => setToast(null), 2500);
    } catch (e) {
      signalerErreur(e);
    }
    setSaving(false);
  };

  return h("div", null,
    toast && h("div", {
      className: "fx-pop-in",
      style: { position: "fixed", top: 60, left: "50%", transform: "translateX(-50%)", zIndex: 900, background: C.green, color: "#fff", padding: "10px 20px", borderRadius: 10, fontSize: 13, fontWeight: 700, boxShadow: C.ombreForte }
    }, toast),

    h(BlocConformite, { parametres: f }),

    h(Lbl, { text: "Identité de l'entreprise" }),
    h(InputText, { label: "Nom commercial", value: f.denomination || "", onChange: v => set("denomination", v), placeholder: "Boost'Étude" }),
    h(InputText, { label: "Nom de l'exploitant", value: f.exploitant || "", onChange: v => set("exploitant", v), placeholder: "Prénom NOM" }),
    h("div", { style: { fontSize: 11, color: C.gray, marginTop: -8, marginBottom: 14, lineHeight: 1.6 } },
      "Depuis 2022, un entrepreneur individuel doit faire figurer « Entrepreneur individuel » ou « EI » à côté de son nom sur ses factures."),
    h("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 12px" } },
      h(InputText, { label: "SIRET", value: f.siret || "", onChange: v => set("siret", v), placeholder: "14 chiffres" }),
      h(InputText, { label: "Code APE", value: f.ape || "", onChange: v => set("ape", v), placeholder: "85.59B" })
    ),

    h("div", { style: { borderTop: `1px solid ${C.bord}`, paddingTop: 14, marginTop: 4 } },
      h(Lbl, { text: "Adresse" }),
      h(InputText, { label: "Rue", value: f.adresse || "", onChange: v => set("adresse", v), placeholder: "7 avenue des Meuniers" }),
      h("div", { style: { display: "grid", gridTemplateColumns: "1fr 2fr", gap: "0 12px" } },
        h(InputText, { label: "Code postal", value: f.code_postal || "", onChange: v => set("code_postal", v), placeholder: "91150" }),
        h(InputText, { label: "Ville", value: f.ville || "", onChange: v => set("ville", v), placeholder: "Étampes" })
      ),
      h("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 12px" } },
        h(InputText, { label: "Téléphone", value: f.telephone || "", onChange: v => set("telephone", v), placeholder: "07 44 94 45 02", type: "tel" }),
        h(InputText, { label: "Email", value: f.email || "", onChange: v => set("email", v), placeholder: "boostetude@gmail.com", type: "email" })
      )
    ),

    h("div", { style: { borderTop: `1px solid ${C.bord}`, paddingTop: 14 } },
      h(Lbl, { text: "Coordonnées bancaires" }),
      h("div", { style: { fontSize: 11, color: C.gray, marginBottom: 10, lineHeight: 1.6 } },
        "Enregistrées dans la base, accessibles à vous seul. Elles n'apparaissent que sur les factures non réglées, jamais dans le code du site."),
      h(InputText, { label: "Titulaire du compte", value: f.titulaire_compte || "", onChange: v => set("titulaire_compte", v) }),
      h(InputText, { label: "IBAN", value: f.iban || "", onChange: v => set("iban", v), placeholder: "FR76 …" }),
      h(InputText, { label: "BIC", value: f.bic || "", onChange: v => set("bic", v) })
    ),

    h("div", { style: { borderTop: `1px solid ${C.bord}`, paddingTop: 14 } },
      h(Lbl, { text: "Rythme de facturation" }),
      h(InputText, {
        label: "Facturer toutes les … séances",
        value: String(f.seuil_facturation == null ? SEUIL_FACTURATION_DEFAUT : f.seuil_facturation),
        onChange: v => set("seuil_facturation", v.replace(/\D/g, "").slice(0, 2)),
        placeholder: "3", type: "tel"
      }),
      h("div", { style: { fontSize: 11, color: C.gray, marginTop: -8, marginBottom: 14, lineHeight: 1.5 } },
        "Au-delà de ce nombre de séances suivies, l'élève est signalé dans Facturation. " +
        "Le chiffre apparaît aussi dans le message au parent : « envoyé toutes les " +
        (f.seuil_facturation || SEUIL_FACTURATION_DEFAUT) + " séances »."),
      h(Lbl, { text: "Mentions de facturation" }),
      h(InputText, { label: "Préfixe des numéros", value: f.prefixe_facture || "", onChange: v => set("prefixe_facture", v), placeholder: "F" }),
      h("div", { style: { fontSize: 11, color: C.gray, marginTop: -8, marginBottom: 14 } },
        "Les factures seront numérotées " + (f.prefixe_facture || "F") + new Date().getFullYear() + "-0001, -0002, … sans rupture."),
      h(InputText, { label: "Régime de TVA", value: f.mention_tva || "", onChange: v => set("mention_tva", v) }),
      h(InputText, { label: "Délai de paiement", value: f.delai_paiement || "", onChange: v => set("delai_paiement", v) }),
      h(InputArea, { label: "Pénalités de retard", value: f.penalites_retard || "", onChange: v => set("penalites_retard", v) }),
      h(InputArea, { label: "Escompte", value: f.escompte || "", onChange: v => set("escompte", v) })
    ),

    h(BtnPrimary, { label: saving ? "Enregistrement…" : "💾 Enregistrer les réglages", onClick: enregistrer, disabled: saving, full: true })
  );
}

function OngletLivreRecettes({ factures, eleves }) {
  const annee = new Date().getFullYear();
  const emises = factures.filter(f => f.numero).sort((a, b) => (a.numero || "").localeCompare(b.numero || ""));
  const encaissees = emises.filter(f => f.statut === "paye" && f.datePaiement);
  const total = encaissees.reduce((s, f) => s + Number(f.montant || 0), 0);
  const nomDe = eid => {
    const e = eleves.find(x => x.id === eid);
    return e ? `${e.prenom} ${e.nom}` : "—";
  };

  const exporter = () => {
    telechargerFichier(
      `livre-recettes-${annee}.csv`,
      versCSV([
        { titre: "Date d'encaissement", valeur: f => f.datePaiement },
        { titre: "N° de facture", valeur: f => f.numero },
        { titre: "Client", valeur: f => nomDe(f.eleveId) },
        { titre: "Nature", valeur: f => `Cours de soutien scolaire — ${f.nbSeances} séance(s)` },
        { titre: "Montant (€)", valeur: f => String(f.montant).replace(".", ",") },
        { titre: "Mode de règlement", valeur: f => f.mode }
      ], encaissees),
      "text/csv;charset=utf-8"
    );
  };

  return h("div", null,
    h("div", { style: { background: C.navyPale, border: `1px solid ${C.bord}`, borderRadius: 12, padding: 13, marginBottom: 16, fontSize: 12, color: C.gray, lineHeight: 1.65 } },
      h("div", { style: { fontSize: 13, fontWeight: 800, color: C.gold, marginBottom: 5 } }, "Livre des recettes"),
      "Registre chronologique des encaissements que tout micro-entrepreneur doit tenir. Il se remplit tout seul : une ligne par facture marquée payée."),

    h("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 16 } },
      [
        { e: "🧾", v: emises.length, l: "Émises", c: C.gold },
        { e: "✅", v: encaissees.length, l: "Encaissées", c: C.green },
        { e: "💰", v: total.toFixed(2).replace(".", ",") + "€", l: "Recettes", c: C.green }
      ].map((s, i) => h("div", {
        key: i,
        style: { background: C.surface, border: `1px solid ${C.bord}`, borderRadius: 12, padding: "13px 8px", textAlign: "center" }
      },
        h("div", { style: { fontSize: 18, marginBottom: 2 } }, s.e),
        h("div", { style: { fontSize: 15, fontWeight: 800, color: s.c, fontFamily: FD } }, s.v),
        h("div", { style: { fontSize: 10, color: C.gray, fontWeight: 700, textTransform: "uppercase" } }, s.l)))
    ),

    encaissees.length === 0
      ? h("div", { style: { textAlign: "center", padding: "30px 20px", color: C.gray, fontSize: 13, lineHeight: 1.6 } },
          "Aucune recette encaissée pour l'instant.", h("br", null),
          "Une facture entre ici quand elle est émise puis marquée payée.")
      : h("div", null,
          h("div", { style: { display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 } },
            encaissees.map(f => h("div", {
              key: f.id,
              style: { background: C.surface, border: `1px solid ${C.bord}`, borderRadius: 10, padding: "10px 12px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }
            },
              h("div", { style: { minWidth: 0 } },
                h("div", { style: { fontSize: 13, fontWeight: 700, color: C.texte } }, f.numero, " · ", nomDe(f.eleveId)),
                h("div", { style: { fontSize: 11, color: C.gray } },
                  new Date(f.datePaiement + "T00:00:00").toLocaleDateString("fr-FR"), " · ", f.mode)),
              h("span", { style: { fontSize: 14, fontWeight: 800, color: C.green, fontFamily: FD, whiteSpace: "nowrap" } }, f.montant, "€")))),
          h(BtnPrimary, { label: "⬇️ Exporter le livre des recettes (CSV)", onClick: exporter, full: true })
        )
  );
}

function OngletDonnees({ eleves, groupes, appels, factures, onExportComplet }) {
  const [enCours, setEnCours] = useState(false);

  const exportEleves = () => telechargerFichier("eleves.csv", versCSV([
    { titre: "Prénom", valeur: e => e.prenom },
    { titre: "Nom", valeur: e => e.nom },
    { titre: "Niveau", valeur: e => e.niveau },
    { titre: "Tarif horaire", valeur: e => String(e.th).replace(".", ",") },
    { titre: "Parent", valeur: e => e.parent },
    { titre: "Téléphone", valeur: e => e.tel },
    { titre: "Email", valeur: e => e.email },
    { titre: "Actif", valeur: e => e.actif === false ? "non" : "oui" }
  ], eleves), "text/csv;charset=utf-8");

  const sauvegarde = async () => {
    setEnCours(true);
    try {
      const tout = await onExportComplet();
      telechargerFichier(
        `sauvegarde-boostetude-${new Date().toISOString().slice(0, 10)}.json`,
        JSON.stringify(tout, null, 2),
        "application/json"
      );
    } catch (e) {
      signalerErreur(e);
    }
    setEnCours(false);
  };

  const bloc = (titre, texte, bouton) => h("div", {
    style: { background: C.surface, border: `1px solid ${C.bord}`, borderRadius: 12, padding: 14, marginBottom: 12 }
  },
    h("div", { style: { fontSize: 13, fontWeight: 800, color: C.texte, marginBottom: 5 } }, titre),
    h("div", { style: { fontSize: 12, color: C.gray, lineHeight: 1.65, marginBottom: 11 } }, texte),
    bouton);

  return h("div", null,
    bloc("Sauvegarde complète",
      "Votre base n'est pas sauvegardée automatiquement : le plan gratuit de l'hébergeur ne le prévoit pas. Ce fichier contient tout — élèves, groupes, présences, comptes-rendus, factures — et permet de repartir si quelque chose est perdu. À faire une fois par mois.",
      h(BtnPrimary, { label: enCours ? "Préparation…" : "⬇️ Télécharger la sauvegarde", onClick: sauvegarde, disabled: enCours, full: true })),

    bloc("Liste des élèves (CSV)",
      "Tableau ouvrable dans Excel : élèves, niveaux, tarifs et contacts des parents.",
      h(BtnSecondary, { label: "⬇️ Exporter les élèves", onClick: exportEleves })),

    h("div", { style: { background: C.bluePale, border: `1px solid ${C.blueBord}`, borderRadius: 12, padding: 14, fontSize: 12, color: C.gray, lineHeight: 1.7 } },
      h("div", { style: { fontSize: 13, fontWeight: 800, color: C.blue, marginBottom: 6 } }, "Données personnelles et RGPD"),
      "Cette application traite des données de mineurs : elles méritent le même soin que les copies. Ce qu'il faut retenir :",
      h("ul", { style: { margin: "8px 0 0 18px", padding: 0 } },
        h("li", { style: { marginBottom: 5 } }, "Ne collecter que l'utile : identité de l'élève, niveau, contact d'un parent. Pas de date de naissance, pas d'adresse, pas de santé."),
        h("li", { style: { marginBottom: 5 } }, "Les familles peuvent demander à consulter, corriger ou faire supprimer les données de leur enfant — l'export CSV ci-dessus sert à répondre."),
        h("li", { style: { marginBottom: 5 } }, "Désactiver un élève le retire des listes sans effacer l'historique de facturation, que la comptabilité impose de garder."),
        h("li", null, "Conservation : dossiers d'élèves trois ans après le dernier cours, pièces comptables dix ans.")))
  );
}

function ModuleReglages({ parametres, eleves, groupes, appels, factures, profs, onSaveParametres, onExportComplet, onSaveTaux, onSaveTel }) {
  const [onglet, setOnglet] = useState("entreprise");
  const onglets = [
    { k: "entreprise", l: "🏛 Entreprise" },
    { k: "profs", l: "👥 Professeurs" },
    { k: "recettes", l: "📒 Recettes" },
    { k: "donnees", l: "🗄 Données" }
  ];
  return h("div", null,
    h("div", { style: { display: "flex", gap: 8, marginBottom: 14, overflowX: "auto", paddingBottom: 2 } },
      onglets.map(({ k, l }) => h("button", {
        key: k,
        onClick: () => setOnglet(k),
        style: {
          background: onglet === k ? C.navy : C.surface,
          color: onglet === k ? "#fff" : C.gray,
          border: `1px solid ${onglet === k ? C.navy : C.bord}`, borderRadius: 999,
          padding: "6px 13px", fontSize: 12.5, fontWeight: 600, cursor: "pointer",
          fontFamily: "inherit", whiteSpace: "nowrap"
        }
      }, l))),
    onglet === "entreprise" && h(OngletEntreprise, { parametres, onSave: onSaveParametres }),
    onglet === "profs" && h(OngletProfesseurs, { profs, groupes, appels, onSaveTaux, onSaveTel }),
    onglet === "recettes" && h(OngletLivreRecettes, { factures, eleves }),
    onglet === "donnees" && h(OngletDonnees, { eleves, groupes, appels, factures, onExportComplet })
  );
}
