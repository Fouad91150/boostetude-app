import sys, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).parent))
from patcher import appliquer

# ── Le partage du PDF manquait là où il sert le plus ─────────────────────────
# Le bouton « Partager la facture PDF » n'avait été branché que sur l'écran de la
# facture ouverte. Les cartes de la liste — l'endroit où l'on passe en revue ses
# élèves — recevaient un panneau d'envoi sans la facture ni les paramètres : le
# bouton ne pouvait donc pas s'y afficher.
#
# Conséquence concrète : une fois les trois factures émises, elles quittaient
# l'encadré doré (qui ne liste que ce qui reste à émettre) et plus aucun chemin
# ne menait au PDF. C'est exactement ce que Fouad a constaté.

appliquer("src/app/18-module-facturation.js", [
    # Carte d'un élève, onglet « En cours » — envoi de la facture.
    ("""    }, "🗑")), nb > 0 && /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(PanneauEnvoi, {
      eleve: e,
      mois: `depuis ${fmtDateCourt(dates[0].date)}`,
      nb: nb,
      montant: montant,
      dates: dates,
      type: "facture"
    }), /*#__PURE__*/React.createElement(PanneauEnvoi, {
      eleve: e,
      mois: `depuis ${fmtDateCourt(dates[0].date)}`,
      nb: nb,
      montant: montant,
      dates: dates,
      type: "rappel"
    })));""",

     """    }, "🗑")), nb > 0 && /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(PanneauEnvoi, {
      eleve: e,
      mois: f && f.numero ? f.numero : `depuis ${fmtDateCourt(dates[0].date)}`,
      nb: nb,
      montant: montant,
      dates: dates,
      type: "facture",
      facture: f,
      parametres: parametres,
      seuil: seuil
    }), /*#__PURE__*/React.createElement(PanneauEnvoi, {
      eleve: e,
      mois: f && f.numero ? f.numero : `depuis ${fmtDateCourt(dates[0].date)}`,
      nb: nb,
      montant: montant,
      dates: dates,
      type: "rappel",
      facture: f,
      parametres: parametres,
      seuil: seuil
    })));"""),

    # Onglet « Gérer » — même chose.
    ("""    }, "🗑")), e && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(PanneauEnvoi, {
      eleve: e,
      mois: `depuis ${fmtDateCourt(f.periodeDebut || (f.datesSeances || [])[0]?.date || "")}`,
      nb: f.nbSeances,
      montant: f.montant,""",

     """    }, "🗑")), e && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(PanneauEnvoi, {
      eleve: e,
      facture: f,
      parametres: parametres,
      seuil: seuil,
      mois: f.numero || `depuis ${fmtDateCourt(f.periodeDebut || (f.datesSeances || [])[0]?.date || "")}`,
      nb: f.nbSeances,
      montant: f.montant,"""),
], "(facturation : le PDF partageable depuis les cartes de la liste)")
