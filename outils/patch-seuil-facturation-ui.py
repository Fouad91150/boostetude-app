import sys, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).parent))
from patcher import appliquer

# ── « Toutes les trois séances » ─────────────────────────────────────────────
# La facturation cumulative n'a pas de fin naturelle : une facture grossit tant
# qu'elle n'est pas payée. Sans repère, on l'oublie, et le parent reçoit un jour
# une note de dix séances. Le seuil donne ce repère — un simple signalement, pas
# une émission automatique : c'est Fouad qui décide quand une facture part.

appliquer("src/app/18-module-facturation.js", [
    ("""  const actifs = eleves.filter(e => e.actif !== false);
  const ouvertes = factures.filter(f => f.statut !== "paye");""",

     """  const actifs = eleves.filter(e => e.actif !== false);
  const ouvertes = factures.filter(f => f.statut !== "paye");
  // Seuil de signalement, réglable dans Réglages (trois séances par défaut).
  const seuil = Math.max(1, parseInt(parametres?.seuil_facturation, 10) || SEUIL_FACTURATION_DEFAUT);
  // À facturer : la facture a atteint le seuil et n'a pas encore de numéro.
  const aFacturer = ouvertes
    .filter(f => !f.numero && (f.nbSeances || 0) >= seuil && actifs.find(e => e.id === f.eleveId))
    .sort((a, b) => (b.nbSeances || 0) - (a.nbSeances || 0));"""),

    # Repère sur l'onglet lui-même : visible sans avoir à ouvrir quoi que ce soit.
    ("""  }, [{
    k: "encours",
    l: `💰 En cours${ouvertes.length > 0 ? ` (${ouvertes.length})` : ""}`
  }, {""",
     """  }, [{
    k: "encours",
    l: `💰 En cours${aFacturer.length > 0 ? ` • ${aFacturer.length} à envoyer` : ouvertes.length > 0 ? ` (${ouvertes.length})` : ""}`
  }, {"""),

    # Le bandeau d'appel à l'action, en tête de l'onglet « En cours ».
    ("""  }, l))), onglet === "encours" && /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      color: C.gray,
      marginBottom: 14,
      lineHeight: 1.5
    }
  }, "La facturation est cumulative : chaque élève a une seule facture qui grossit à chaque séance présente, jusqu'à ce qu'elle soit marquée payée — elle est alors figée et une nouvelle facture repart de zéro."),""",

     """  }, l))), onglet === "encours" && /*#__PURE__*/React.createElement("div", null,
  aFacturer.length > 0 && h("div", {
    style: {
      background: "rgba(212,175,55,.1)", border: "1px solid rgba(212,175,55,.35)",
      borderRadius: 14, padding: 14, marginBottom: 14
    }
  },
    h("div", { style: { fontSize: 15, fontWeight: 800, color: C.gold, fontFamily: FD, marginBottom: 3 } },
      `${aFacturer.length} facture${aFacturer.length > 1 ? "s" : ""} à envoyer`),
    h("div", { style: { fontSize: 12, color: C.gray, marginBottom: 10, lineHeight: 1.5 } },
      `Ces élèves ont atteint ${seuil} séances. Ouvrez la facture, émettez-la, puis partagez le PDF au parent.`),
    h("div", { style: { display: "flex", flexDirection: "column", gap: 6 } },
      aFacturer.map(f => {
        const el = eleveDe(f.eleveId);
        if (!el) return null;
        return h("button", {
          key: f.id,
          onClick: () => setImpression({ f, e: el }),
          style: {
            display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10,
            background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.1)",
            borderRadius: 10, padding: "10px 12px", cursor: "pointer", fontFamily: "inherit",
            textAlign: "left", width: "100%"
          }
        },
          h("span", { style: { fontSize: 13.5, fontWeight: 700, color: C.cream } },
            `${el.prenom} ${el.nom}`,
            h("span", { style: { fontSize: 11.5, color: C.gray, fontWeight: 600 } },
              ` • ${f.nbSeances} séance${f.nbSeances > 1 ? "s" : ""}`)),
          h("span", { style: { fontSize: 14, fontWeight: 800, color: C.gold, fontFamily: FD, whiteSpace: "nowrap" } },
            `${f.montant} € ›`));
      }))),
  /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      color: C.gray,
      marginBottom: 14,
      lineHeight: 1.5
    }
  }, `La facturation est cumulative : chaque élève a une seule facture qui grossit à chaque séance présente. Au bout de ${seuil} séances, elle est signalée ici — à vous de l'émettre et de l'envoyer.`),"""),
], "(facturation : signalement au seuil de séances)")
