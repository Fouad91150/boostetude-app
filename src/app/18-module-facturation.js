// ─── MODULE FACTURATION ──────────────────────────────────────
function ModuleFacturation({
  eleves,
  groupes,
  appels,
  factures,
  onSaveFacture,
  onDeleteFacture,
  onDeleteFactureEnCours,
  parametres,
  onEmettreFacture
}) {
  const [onglet, setOnglet] = useState("encours");
  const [modal, setModal] = useState(null); // {e,f,dates}
  const [impression, setImpression] = useState(null); // {f,e}
  const [toast, setToast] = useState(null);
  const [suppression, setSuppression] = useState(false);
  const showToast = msg => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };
  const eleveDe = eid => eleves.find(x => x.id === eid);
  const handleSave = async data => {
    try {
      await onSaveFacture(modal.f?.id || null, modal.e.id, data);
      setModal(null);
      showToast(data.statut === "paye" ? "🎉 Facture payée !" : "Facture enregistrée ✓");
    } catch (e) {
      signalerErreur(e);
    }
  };
  // Renvoie true si la suppression a bien eu lieu (permet d'attendre la confirmation
  // avant de fermer une vue, ex. la fiche d'impression, sans la fermer si on annule).
  const handleDelete = async factureId => {
    if (!window.confirm("Supprimer définitivement cette facture ? Cette action est irréversible.")) return false;
    setSuppression(true);
    let ok = false;
    try {
      await onDeleteFacture(factureId);
      showToast("Facture supprimée ✓");
      ok = true;
    } catch (e) {
      signalerErreur(e);
    }
    setSuppression(false);
    return ok;
  };
  // Une facture "en cours" est entièrement recalculée depuis l'appel : supprimer seulement
  // la ligne facture ne suffit pas, le même montant réapparaîtrait aussitôt. On retire donc
  // aussi les séances présentes sous-jacentes (utile pour nettoyer un test, par exemple).
  const handleDeleteEnCours = async (factureId, eleveId, dates) => {
    if (!window.confirm("Supprimer ces séances de l'appel et la facture en cours associée ? Cette action retire ces séances de l'historique de présence et est irréversible.")) return false;
    setSuppression(true);
    let ok = false;
    try {
      await onDeleteFactureEnCours(factureId, eleveId, dates);
      showToast("Facture en cours supprimée ✓");
      ok = true;
    } catch (e) {
      signalerErreur(e);
    }
    setSuppression(false);
    return ok;
  };
  const actifs = eleves.filter(e => e.actif !== false);
  const ouvertes = factures.filter(f => f.statut !== "paye");
  // Seuil de signalement, réglable dans Réglages (trois séances par défaut).
  const seuil = Math.max(1, parseInt(parametres?.seuil_facturation, 10) || SEUIL_FACTURATION_DEFAUT);
  // À facturer : la facture a atteint le seuil et n'a pas encore de numéro.
  const aFacturer = ouvertes
    .filter(f => !f.numero && (f.nbSeances || 0) >= seuil && actifs.find(e => e.id === f.eleveId))
    .sort((a, b) => (b.nbSeances || 0) - (a.nbSeances || 0));
  const ouverteDe = eid => ouvertes.find(f => f.eleveId === eid);
  // Solde ouvert dont l'élève est désactivé ou n'existe plus : à traiter à part,
  // sinon il reste invisible et impossible à solder ou supprimer.
  const ouvertesOrphelines = ouvertes.filter(f => !actifs.find(e => e.id === f.eleveId));
  const totalEnCours = ouvertes.reduce((s, f) => s + f.montant, 0);
  const payees = factures.filter(f => f.statut === "paye").sort((a, b) => (b.periodeFin || b.datePaiement || "").localeCompare(a.periodeFin || a.datePaiement || ""));
  const caParMois = ym => payees.filter(f => (f.datePaiement || "").startsWith(ym)).reduce((s, f) => s + f.montant, 0);
  const histoCA = lastMonths(6).reverse().map(m => ({
    l: MOIS_C[+m.split("-")[1] - 1],
    v: caParMois(m)
  }));
  const maxCA = Math.max(...histoCA.map(d => d.v), 1);
  // Onglet "Gérer" : toutes les factures (en cours + payées) au même endroit, pour un
  // nettoyage rapide (ex. des tests) sans avoir à jongler entre les deux autres onglets.
  const toutes = [...factures].sort((a, b) => (b.periodeFin || b.datePaiement || b.periodeDebut || "").localeCompare(a.periodeFin || a.datePaiement || a.periodeDebut || ""));
  const handleDeleteToutes = f => f.statut === "paye" ? handleDelete(f.id) : handleDeleteEnCours(f.id, f.eleveId, f.datesSeances || []);
  return /*#__PURE__*/React.createElement("div", null, toast && /*#__PURE__*/React.createElement("div", {
    className: "fx-pop-in",
    style: {
      position: "fixed",
      top: 60,
      left: "50%",
      transform: "translateX(-50%)",
      zIndex: 900,
      background: C.green,
      color: "#fff",
      padding: "10px 20px",
      borderRadius: 10,
      fontSize: 13,
      fontWeight: 700,
      boxShadow: "0 4px 16px rgba(0,0,0,.4)",
      whiteSpace: "nowrap"
    }
  }, toast), modal && /*#__PURE__*/React.createElement(ModaleFacture, {
    eleve: modal.e,
    existante: modal.f,
    dates: modal.dates,
    onSave: handleSave,
    onClose: () => setModal(null)
  }), impression && /*#__PURE__*/React.createElement(VueImpression, {
    facture: impression.f,
    eleve: impression.e,
    parametres: parametres,
    onEmettre: onEmettreFacture,
    onClose: () => setImpression(null),
    onDelete: async () => {
      const ok = impression.f.statut === "paye" ? await handleDelete(impression.f.id) : await handleDeleteEnCours(impression.f.id, impression.f.eleveId, impression.f.datesSeances || []);
      if (ok) setImpression(null);
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      marginBottom: 14,
      overflowX: "auto"
    }
  }, [{
    k: "encours",
    l: `💰 En cours${aFacturer.length > 0 ? ` • ${aFacturer.length} à envoyer` : ouvertes.length > 0 ? ` (${ouvertes.length})` : ""}`
  }, {
    k: "histo",
    l: "📋 Historique"
  }, {
    k: "gerer",
    l: `🗑 Gérer${toutes.length > 0 ? ` (${toutes.length})` : ""}`
  }].map(({
    k,
    l
  }) => /*#__PURE__*/React.createElement("button", {
    key: k,
    onClick: () => setOnglet(k),
    style: {
      background: onglet === k ? C.gold : "rgba(255,255,255,.08)",
      color: onglet === k ? C.navy : C.gray,
      border: "none",
      borderRadius: 20,
      padding: "6px 14px",
      fontSize: 12,
      fontWeight: 700,
      cursor: "pointer",
      fontFamily: "inherit",
      whiteSpace: "nowrap"
    }
  }, l))), onglet === "encours" && /*#__PURE__*/React.createElement("div", null,
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
  }, `La facturation est cumulative : chaque élève a une seule facture qui grossit à chaque séance présente. Au bout de ${seuil} séances, elle est signalée ici — à vous de l'émettre et de l'envoyer.`), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: 8,
      marginBottom: 16
    }
  }, [{
    e: "💰",
    v: `${totalEnCours}€`,
    l: "Total en cours",
    c: C.gold
  }, {
    e: "⏳",
    v: ouvertes.length,
    l: "Factures ouvertes",
    c: C.orange
  }].map((s, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      background: "rgba(255,255,255,.04)",
      borderRadius: 12,
      padding: "10px 8px",
      textAlign: "center",
      border: "1px solid rgba(255,255,255,.08)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 18
    }
  }, s.e), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 15,
      fontWeight: 800,
      color: s.c,
      fontFamily: FD
    }
  }, s.v), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 10,
      color: C.gray,
      fontWeight: 700,
      textTransform: "uppercase"
    }
  }, s.l)))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 12
    }
  }, actifs.map(e => {
    const f = ouverteDe(e.id);
    const dates = f ? f.datesSeances || [] : seancesOuvertes(e.id, appels, groupes, dernierePeriodeFin(e.id, factures));
    const nb = dates.length;
    const montant = f ? f.montant : parseFloat((nb * 2 * e.th).toFixed(2));
    return /*#__PURE__*/React.createElement("div", {
      key: e.id,
      style: {
        background: "rgba(255,255,255,.04)",
        border: `1px solid ${f ? "rgba(224,144,48,.25)" : "rgba(255,255,255,.08)"}`,
        borderRadius: 14,
        padding: 14
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 10,
        marginBottom: 10
      }
    }, /*#__PURE__*/React.createElement(Avatar, {
      p: e.prenom,
      n: e.nom
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 16,
        fontWeight: 800,
        color: C.cream,
        fontFamily: FD
      }
    }, e.prenom, " ", e.nom), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 12,
        color: C.gray
      }
    }, e.niveau, " • ", e.th, "€/h")), f && /*#__PURE__*/React.createElement(StatutBadge, {
      statut: f.statut
    })), nb > 0 ? /*#__PURE__*/React.createElement("div", {
      style: {
        background: "rgba(0,0,0,.2)",
        borderRadius: 10,
        padding: "10px 12px",
        marginBottom: 10
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 13,
        color: C.gray
      }
    }, nb, " séance", nb > 1 ? "s" : "", " × 2h × ", e.th, "€ ", /*#__PURE__*/React.createElement("span", {
      style: {
        fontStyle: "italic"
      }
    }, "(depuis l'appel)")), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 24,
        fontWeight: 800,
        color: C.gold,
        fontFamily: FD
      }
    }, montant, "€")), groupParMatiere(dates).map(g => /*#__PURE__*/React.createElement("div", {
      key: g.matiere,
      style: {
        fontSize: 11,
        color: C.gray,
        marginTop: 6,
        lineHeight: 1.6
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        color: C.gold,
        fontWeight: 700
      }
    }, g.matiere), " (", g.dates.length, ") : ", g.dates.map(d => fmtDateCourt(d)).join(" · ")))) : /*#__PURE__*/React.createElement("div", {
      style: {
        background: "rgba(212,175,55,.06)",
        borderRadius: 10,
        padding: "10px 12px",
        marginBottom: 10
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 13,
        color: C.gray
      }
    }, "À jour — rien en attente")), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        gap: 8
      }
    }, nb > 0 && /*#__PURE__*/React.createElement(BtnPrimary, {
      label: "💰 Marquer payé",
      onClick: () => setModal({
        e,
        f,
        dates
      }),
      full: true
    }), f && /*#__PURE__*/React.createElement("button", {
      onClick: () => setImpression({
        f,
        e
      }),
      style: {
        background: "rgba(255,255,255,.08)",
        border: "1px solid rgba(255,255,255,.12)",
        borderRadius: 10,
        padding: "11px 14px",
        color: C.cream,
        fontSize: 16,
        cursor: "pointer",
        fontFamily: "inherit"
      }
    }, "🖨"), nb > 0 && /*#__PURE__*/React.createElement("button", {
      onClick: () => handleDeleteEnCours(f?.id || null, e.id, dates),
      disabled: suppression,
      title: "Supprimer ces séances et la facture en cours",
      style: {
        background: "rgba(224,85,85,.1)",
        border: "1px solid rgba(224,85,85,.3)",
        borderRadius: 10,
        padding: "11px 14px",
        color: C.red,
        fontSize: 16,
        cursor: suppression ? "not-allowed" : "pointer",
        fontFamily: "inherit"
      }
    }, "🗑")), nb > 0 && /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(PanneauEnvoi, {
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
    })));
  }), actifs.length === 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "center",
      padding: "30px 0",
      color: C.gray,
      fontSize: 13
    }
  }, "Aucun élève actif pour l'instant.")), ouvertesOrphelines.length > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 24
    }
  }, /*#__PURE__*/React.createElement(Lbl, {
    text: "⚠️ Soldes ouverts — élèves désactivés ou introuvables"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 12
    }
  }, ouvertesOrphelines.map(f => {
    const e = eleveDe(f.eleveId);
    return /*#__PURE__*/React.createElement("div", {
      key: f.id,
      style: {
        background: "rgba(224,85,85,.07)",
        border: "1px solid rgba(224,85,85,.25)",
        borderRadius: 14,
        padding: 14
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: e ? 10 : 0
      }
    }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 14,
        fontWeight: 700,
        color: C.cream
      }
    }, e ? `${e.prenom} ${e.nom}` : "Élève introuvable", e && /*#__PURE__*/React.createElement("span", {
      style: {
        marginLeft: 8,
        fontSize: 10,
        fontWeight: 700,
        color: C.red,
        background: "rgba(224,85,85,.15)",
        padding: "2px 8px",
        borderRadius: 20
      }
    }, "🔴 Inactif")), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 12,
        color: C.gray
      }
    }, f.nbSeances, " séance", f.nbSeances > 1 ? "s" : "", " • ", f.montant, "€")), /*#__PURE__*/React.createElement("button", {
      onClick: () => handleDeleteEnCours(f.id, f.eleveId, f.datesSeances || []),
      disabled: suppression,
      style: {
        background: "rgba(224,85,85,.15)",
        border: "1px solid rgba(224,85,85,.4)",
        borderRadius: 10,
        padding: "10px 14px",
        color: C.red,
        fontSize: 16,
        cursor: suppression ? "not-allowed" : "pointer",
        fontFamily: "inherit"
      }
    }, "🗑")), e && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(PanneauEnvoi, {
      eleve: e,
      mois: `depuis ${fmtDateCourt(f.periodeDebut || (f.datesSeances || [])[0]?.date || "")}`,
      nb: f.nbSeances,
      montant: f.montant,
      dates: f.datesSeances || [],
      type: "rappel"
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: 8
      }
    }, /*#__PURE__*/React.createElement(BtnPrimary, {
      label: "✅ Marquer payé",
      onClick: () => setModal({
        e,
        f,
        dates: f.datesSeances || []
      }),
      full: true
    }))));
  })))), onglet === "histo" && /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      background: "rgba(255,255,255,.04)",
      border: "1px solid rgba(212,175,55,.12)",
      borderRadius: 16,
      padding: 16,
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      fontWeight: 700,
      color: C.gold,
      letterSpacing: "1px",
      textTransform: "uppercase",
      marginBottom: 12
    }
  }, "📈 Encaissé — 6 mois"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "flex-end",
      gap: 6,
      height: 80
    }
  }, histoCA.map((d, i) => {
    const isL = i === histoCA.length - 1;
    const pct = d.v / maxCA;
    return /*#__PURE__*/React.createElement("div", {
      key: i,
      style: {
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 3
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 9,
        color: isL ? C.gold : C.gray,
        fontWeight: isL ? 700 : 400
      }
    }, d.v > 0 ? `${d.v}€` : ""), /*#__PURE__*/React.createElement("div", {
      style: {
        width: "100%",
        borderRadius: "3px 3px 0 0",
        background: isL ? `linear-gradient(to top,${C.goldD},${C.gold})` : "rgba(212,175,55,.25)",
        height: `${Math.max(pct * 100, 4)}%`
      }
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 9,
        color: isL ? C.gold : C.gray,
        fontWeight: isL ? 700 : 400
      }
    }, d.l));
  }))), payees.length === 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "center",
      padding: "40px 0",
      color: C.gray,
      fontSize: 13
    }
  }, "Aucune facture payée pour l'instant."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 8
    }
  }, payees.map(f => {
    const e = eleveDe(f.eleveId);
    const dates = f.datesSeances || [];
    const periode = dates.length ? dates.length === 1 ? fmtDateCourt(dates[0].date) : `${fmtDateCourt(dates[0].date)} – ${fmtDateCourt(dates[dates.length - 1].date)}` : "—";
    return /*#__PURE__*/React.createElement("div", {
      key: f.id,
      onClick: () => e && setImpression({
        f,
        e
      }),
      style: {
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 12px",
        background: "rgba(255,255,255,.03)",
        border: "1px solid rgba(255,255,255,.07)",
        borderRadius: 10,
        cursor: e ? "pointer" : "default"
      }
    }, e && /*#__PURE__*/React.createElement(Avatar, {
      p: e.prenom,
      n: e.nom,
      s: 30
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 14,
        color: C.cream,
        fontWeight: 600
      }
    }, e ? `${e.prenom} ${e.nom}` : "Élève introuvable"), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 11,
        color: C.gray
      }
    }, periode, " • ", f.nbSeances, " séance", f.nbSeances > 1 ? "s" : "")), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 15,
        fontWeight: 800,
        color: C.gold,
        fontFamily: FD
      }
    }, f.montant, "€"), /*#__PURE__*/React.createElement("button", {
      onClick: ev => {
        ev.stopPropagation();
        handleDelete(f.id);
      },
      disabled: suppression,
      title: "Supprimer cette facture",
      style: {
        background: "rgba(224,85,85,.1)",
        border: "1px solid rgba(224,85,85,.3)",
        borderRadius: 10,
        padding: "8px 10px",
        color: C.red,
        fontSize: 14,
        cursor: suppression ? "not-allowed" : "pointer",
        fontFamily: "inherit"
      }
    }, "🗑"));
  }))), onglet === "gerer" && /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      color: C.gray,
      marginBottom: 14,
      lineHeight: 1.5
    }
  }, "Toutes les factures — en cours et payées — au même endroit, pratique pour nettoyer des tests. Supprimer une facture en cours retire aussi les séances \"présent\" correspondantes de l'appel ; supprimer une facture payée ne touche pas l'historique de présence."), toutes.length === 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "center",
      padding: "40px 0",
      color: C.gray,
      fontSize: 13
    }
  }, "Aucune facture pour l'instant."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 8
    }
  }, toutes.map(f => {
    const e = eleveDe(f.eleveId);
    const dates = f.datesSeances || [];
    const periode = dates.length ? dates.length === 1 ? fmtDateCourt(dates[0].date) : `${fmtDateCourt(dates[0].date)} – ${fmtDateCourt(dates[dates.length - 1].date)}` : "—";
    return /*#__PURE__*/React.createElement("div", {
      key: f.id,
      style: {
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 12px",
        background: "rgba(255,255,255,.03)",
        border: "1px solid rgba(255,255,255,.07)",
        borderRadius: 10
      }
    }, e && /*#__PURE__*/React.createElement(Avatar, {
      p: e.prenom,
      n: e.nom,
      s: 30
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 14,
        color: C.cream,
        fontWeight: 600
      }
    }, e ? `${e.prenom} ${e.nom}` : "Élève introuvable", e && e.actif === false && /*#__PURE__*/React.createElement("span", {
      style: {
        marginLeft: 6,
        fontSize: 10,
        fontWeight: 700,
        color: C.red,
        background: "rgba(224,85,85,.15)",
        padding: "2px 8px",
        borderRadius: 20
      }
    }, "🔴 Inactif")), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 11,
        color: C.gray
      }
    }, periode, " • ", f.nbSeances, " séance", f.nbSeances > 1 ? "s" : "")), /*#__PURE__*/React.createElement(StatutBadge, {
      statut: f.statut
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 15,
        fontWeight: 800,
        color: C.gold,
        fontFamily: FD
      }
    }, f.montant, "€"), /*#__PURE__*/React.createElement("button", {
      onClick: () => handleDeleteToutes(f),
      disabled: suppression,
      title: "Supprimer cette facture",
      style: {
        background: "rgba(224,85,85,.1)",
        border: "1px solid rgba(224,85,85,.3)",
        borderRadius: 10,
        padding: "8px 10px",
        color: C.red,
        fontSize: 14,
        cursor: suppression ? "not-allowed" : "pointer",
        fontFamily: "inherit"
      }
    }, "🗑"));
  }))));
}
