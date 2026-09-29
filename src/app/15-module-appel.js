// ─── MODULE APPEL ─────────────────────────────────────────────
function ModuleAppel({
  eleves,
  groupes,
  appels,
  onSaveAppel,
  onSaveGroupe,
  isAdmin,
  profs,
  onAllerSuivi
}) {
  const [etape, setEtape] = useState("groupes");
  const [grp, setGrp] = useState(null);
  const [date, setDate] = useState(todayStr());
  const [pres, setPres] = useState({});
  const [onglet, setOnglet] = useState("appel");
  const [grpForm, setGrpForm] = useState(null);
  const [enregistrement, setEnregistrement] = useState(false);
  const elevesMap = {};
  eleves.forEach(e => {
    elevesMap[e.id] = e;
  });
  if (grpForm !== null) {
    return /*#__PURE__*/React.createElement(FormulaireGroupe, {
      initial: grpForm.id ? grpForm : null,
      profs: profs,
      onSave: async f => {
        try {
          await onSaveGroupe(f);
          setGrpForm(null);
        } catch (e) {
          alert("Erreur : " + e.message);
        }
      },
      onCancel: () => setGrpForm(null)
    });
  }
  const ouvrir = g => {
    setGrp(g);
    const ex = appels[`ap:${g.id}:${date}`];
    if (ex) {
      setPres(ex);
    } else {
      const p = {};
      (g.eids || []).forEach(id => {
        p[id] = "present";
      });
      setPres(p);
    }
    setEtape("appel");
  };
  const changerDate = d => {
    setDate(d);
    if (!grp) return;
    const ex = appels[`ap:${grp.id}:${d}`];
    if (ex) {
      setPres(ex);
    } else {
      const p = {};
      (grp.eids || []).forEach(id => {
        p[id] = "present";
      });
      setPres(p);
    }
  };
  const enregistrer = async () => {
    setEnregistrement(true);
    try {
      await onSaveAppel(grp.id, date, pres);
      setEtape("confirme");
    } catch (e) {
      alert("Erreur : " + e.message);
    }
    setEnregistrement(false);
  };
  const nbP = Object.values(pres).filter(s => s === "present").length;
  const nbAJ = Object.values(pres).filter(s => s === "absent_j").length;
  const nbAN = Object.values(pres).filter(s => s === "absent_nj").length;
  if (etape === "groupes") return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      background: "rgba(212,175,55,.08)",
      border: "1px solid rgba(212,175,55,.2)",
      borderRadius: 14,
      padding: 14,
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement(Lbl, {
    text: "Date de la séance"
  }), /*#__PURE__*/React.createElement("input", {
    type: "date",
    value: date,
    onChange: e => setDate(e.target.value),
    style: {
      width: "100%",
      background: "transparent",
      border: "1px solid rgba(212,175,55,.3)",
      borderRadius: 8,
      padding: "10px 12px",
      color: C.cream,
      fontSize: 16,
      fontFamily: "inherit",
      outline: "none",
      boxSizing: "border-box",
      colorScheme: "dark"
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: C.gray,
      marginTop: 6
    }
  }, "📅 ", new Date(date).toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long"
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 10
    }
  }, /*#__PURE__*/React.createElement(Lbl, {
    text: "Choisir le groupe"
  }), isAdmin && /*#__PURE__*/React.createElement("button", {
    onClick: () => setGrpForm({}),
    style: {
      background: "none",
      border: "none",
      color: C.gold,
      cursor: "pointer",
      fontSize: 13,
      fontWeight: 700,
      fontFamily: "inherit"
    }
  }, "+ Nouveau groupe")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 10
    }
  }, groupes.map(g => {
    const fait = !!appels[`ap:${g.id}:${date}`];
    return /*#__PURE__*/React.createElement("div", {
      key: g.id,
      style: {
        display: "flex",
        gap: 8
      }
    }, /*#__PURE__*/React.createElement("button", {
      onClick: () => ouvrir(g),
      style: {
        flex: 1,
        background: fait ? "rgba(76,175,125,.08)" : "rgba(255,255,255,.04)",
        border: fait ? "1.5px solid rgba(76,175,125,.4)" : "1px solid rgba(255,255,255,.1)",
        borderRadius: 14,
        padding: 16,
        cursor: "pointer",
        fontFamily: "inherit",
        textAlign: "left"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center"
      }
    }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 17,
        fontWeight: 800,
        color: C.cream,
        fontFamily: FD,
        marginBottom: 4
      }
    }, g.nom, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 11,
        fontWeight: 700,
        color: C.gold,
        marginLeft: 8,
        fontFamily: "inherit"
      }
    }, g.matiere)), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 12,
        color: C.gray
      }
    }, horaireLabel(g), " • ", (g.eids || []).length, "/", g.max, " élèves")), fait ? /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 11,
        fontWeight: 700,
        color: C.green,
        background: "rgba(76,175,125,.15)",
        padding: "4px 10px",
        borderRadius: 20
      }
    }, "✓ Fait") : /*#__PURE__*/React.createElement("span", {
      style: {
        color: C.gray,
        fontSize: 20
      }
    }, "›"))), isAdmin && /*#__PURE__*/React.createElement("button", {
      onClick: () => setGrpForm(g),
      style: {
        background: "rgba(255,255,255,.06)",
        border: "1px solid rgba(255,255,255,.1)",
        borderRadius: 14,
        padding: "0 14px",
        color: C.gold,
        cursor: "pointer",
        fontSize: 16,
        fontFamily: "inherit"
      }
    }, "✏️"));
  }), groupes.length === 0 && isAdmin && /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "center",
      padding: "30px 0",
      color: C.gray
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 32,
      marginBottom: 10
    }
  }, "🗂️"), /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 12,
      fontSize: 13
    }
  }, "Aucun groupe pour l'instant."), /*#__PURE__*/React.createElement(BtnPrimary, {
    label: "+ Créer le premier groupe",
    onClick: () => setGrpForm({})
  })), groupes.length === 0 && !isAdmin && /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "center",
      padding: "30px 0",
      color: C.gray
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 32,
      marginBottom: 10
    }
  }, "🗂️"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13
    }
  }, "Aucune classe ne vous a été assignée pour l'instant.", /*#__PURE__*/React.createElement("br", null), "Contactez l'administrateur."))));
  if (etape === "confirme") return /*#__PURE__*/React.createElement("div", {
    className: "fx-fade-slide-up",
    style: {
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      minHeight: "50vh",
      textAlign: "center",
      padding: "0 20px"
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "fx-pop-in",
    style: {
      width: 80,
      height: 80,
      borderRadius: "50%",
      background: "rgba(76,175,125,.15)",
      border: `3px solid ${C.green}`,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: 40,
      marginBottom: 20
    }
  }, "✅"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 24,
      fontWeight: 800,
      color: C.cream,
      fontFamily: FD,
      marginBottom: 6
    }
  }, "Appel enregistré !"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      color: C.gray,
      marginBottom: 24
    }
  }, grp.nom, " • ", new Date(date).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 24,
      marginBottom: 28
    }
  }, nbP > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "center"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 32,
      fontWeight: 800,
      color: C.green,
      fontFamily: FD
    }
  }, nbP), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: C.gray
    }
  }, "✅ Présents")), nbAJ > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "center"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 32,
      fontWeight: 800,
      color: C.orange,
      fontFamily: FD
    }
  }, nbAJ), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: C.gray
    }
  }, "📋 Justifiés")), nbAN > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "center"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 32,
      fontWeight: 800,
      color: C.red,
      fontFamily: FD
    }
  }, nbAN), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: C.gray
    }
  }, "❌ Absents"))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 10,
      width: "100%",
      maxWidth: 280
    }
  }, /*#__PURE__*/React.createElement(BtnSecondary, {
    label: "✏️ Corriger",
    onClick: () => setEtape("appel")
  }), onAllerSuivi && /*#__PURE__*/React.createElement(BtnPrimary, {
    label: "📝 Rédiger le compte-rendu",
    onClick: onAllerSuivi,
    full: true
  }), /*#__PURE__*/React.createElement(BtnSecondary, {
    label: "← Retour aux groupes",
    onClick: () => {
      setEtape("groupes");
      setGrp(null);
    },
    full: true
  })));
  const histo = Object.entries(appels).filter(([k]) => k.startsWith(`ap:${grp.id}:`)).map(([k, v]) => ({
    date: k.split(":")[2],
    pres: v
  })).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8);
  // Élèves absents (justifiés ou non) à la date actuellement affichée dans l'appel —
  // pour prévenir un parent en un clic sans quitter l'écran d'appel.
  const dateLabel = new Date(date).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long"
  });
  const absents = (grp.eids || []).filter(eid => pres[eid] && pres[eid] !== "present");
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      marginBottom: 12,
      alignItems: "center"
    }
  }, [{
    k: "appel",
    l: "📋 Appel"
  }, {
    k: "histo",
    l: "🕐 Historique"
  }, {
    k: "parents",
    l: `✉️ Parents${absents.length > 0 ? ` (${absents.length})` : ""}`
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
      fontFamily: "inherit"
    }
  }, l)), /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      setEtape("groupes");
      setGrp(null);
    },
    style: {
      marginLeft: "auto",
      background: "none",
      border: "none",
      color: C.gold,
      cursor: "pointer",
      fontSize: 14,
      fontFamily: "inherit",
      fontWeight: 700
    }
  }, "← Groupes")), onglet === "appel" && /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      background: "rgba(255,255,255,.04)",
      border: "1px solid rgba(212,175,55,.15)",
      borderRadius: 10,
      padding: "10px 14px",
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13,
      color: C.gray
    }
  }, "📅"), /*#__PURE__*/React.createElement("input", {
    type: "date",
    value: date,
    onChange: e => changerDate(e.target.value),
    style: {
      flex: 1,
      background: "transparent",
      border: "none",
      color: C.cream,
      fontSize: 14,
      fontFamily: "inherit",
      outline: "none",
      colorScheme: "dark"
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr 1fr",
      gap: 8,
      marginBottom: 14
    }
  }, [[nbP, "✅", "Présents", C.green], [nbAJ, "📋", "Justifiés", C.orange], [nbAN, "❌", "Absents", C.red]].map(([v, e, l, cl], i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      background: "rgba(255,255,255,.05)",
      borderRadius: 10,
      padding: "10px 6px",
      textAlign: "center"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 16
    }
  }, e), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 22,
      fontWeight: 800,
      color: cl,
      fontFamily: FD
    }
  }, v), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 10,
      color: C.gray,
      textTransform: "uppercase",
      fontWeight: 700
    }
  }, l)))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      const p = {};
      (grp.eids || []).forEach(id => {
        p[id] = "present";
      });
      setPres(p);
    },
    style: {
      flex: 1,
      background: "rgba(76,175,125,.1)",
      border: "1px solid rgba(76,175,125,.3)",
      borderRadius: 10,
      padding: 10,
      color: C.green,
      fontSize: 13,
      fontWeight: 700,
      cursor: "pointer",
      fontFamily: "inherit"
    }
  }, "✅ Tous présents"), /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      const p = {};
      (grp.eids || []).forEach(id => {
        p[id] = "absent_nj";
      });
      setPres(p);
    },
    style: {
      flex: 1,
      background: "rgba(224,85,85,.1)",
      border: "1px solid rgba(224,85,85,.3)",
      borderRadius: 10,
      padding: 10,
      color: C.red,
      fontSize: 13,
      fontWeight: 700,
      cursor: "pointer",
      fontFamily: "inherit"
    }
  }, "❌ Tous absents")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 12,
      paddingBottom: 90
    }
  }, (grp.eids || []).map(eid => {
    const e = elevesMap[eid];
    if (!e) return null;
    return /*#__PURE__*/React.createElement(CarteAppel, {
      key: eid,
      eleve: e,
      statut: pres[eid] || "present",
      onChange: st => setPres(p => ({
        ...p,
        [eid]: st
      }))
    });
  }), (grp.eids || []).length === 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "center",
      padding: "20px 0",
      color: C.gray,
      fontSize: 13
    }
  }, "Aucun élève dans ce groupe pour l'instant.")), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "fixed",
      bottom: 70,
      left: 0,
      right: 0,
      padding: "12px 16px",
      background: `linear-gradient(to top,${C.navy} 70%,transparent)`,
      zIndex: 200
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: enregistrer,
    disabled: enregistrement,
    style: {
      width: "100%",
      background: `linear-gradient(135deg,${C.gold},${C.goldD})`,
      border: "none",
      borderRadius: 14,
      padding: 16,
      color: C.navy,
      fontSize: 16,
      fontWeight: 800,
      cursor: enregistrement ? "not-allowed" : "pointer",
      fontFamily: "inherit",
      boxShadow: "0 4px 20px rgba(212,175,55,.3)",
      opacity: enregistrement ? .7 : 1
    }
  }, enregistrement ? "💾 Enregistrement…" : `💾 Enregistrer • ${nbP}/${(grp.eids || []).length} présents`))), onglet === "histo" && /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 10
    }
  }, histo.length === 0 ? /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "center",
      padding: "40px 0",
      color: C.gray
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 36
    }
  }, "📭"), /*#__PURE__*/React.createElement("div", null, "Aucune séance")) : histo.map(({
    date: d,
    pres: pr
  }) => {
    const nP = Object.values(pr).filter(s => s === "present").length;
    const nA = Object.values(pr).filter(s => s !== "present").length;
    return /*#__PURE__*/React.createElement("div", {
      key: d,
      style: {
        background: "rgba(255,255,255,.04)",
        border: "1px solid rgba(212,175,55,.12)",
        borderRadius: 14,
        padding: 14
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 14,
        fontWeight: 700,
        color: C.cream,
        marginBottom: 8
      }
    }, new Date(d).toLocaleDateString("fr-FR", {
      weekday: "long",
      day: "numeric",
      month: "long"
    })), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        gap: 12,
        marginBottom: 8
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 13,
        color: C.green,
        fontWeight: 700
      }
    }, "✅ ", nP), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 13,
        color: C.red,
        fontWeight: 700
      }
    }, "❌ ", nA)), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        flexWrap: "wrap",
        gap: 6
      }
    }, Object.entries(pr).map(([eid, st]) => {
      const e = elevesMap[eid];
      if (!e) return null;
      const cl = st === "present" ? C.green : st === "absent_j" ? C.orange : C.red;
      return /*#__PURE__*/React.createElement("span", {
        key: eid,
        style: {
          fontSize: 11,
          fontWeight: 600,
          padding: "3px 8px",
          borderRadius: 20,
          background: `${cl}22`,
          color: cl,
          border: `1px solid ${cl}66`
        }
      }, st === "present" ? "✅" : st === "absent_j" ? "📋" : "❌", " ", e.prenom);
    })));
  })), onglet === "parents" && /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      color: C.gray,
      marginBottom: 14,
      lineHeight: 1.5
    }
  }, "Élèves absents le ", dateLabel, " — changez de date dans l'onglet Appel pour prévenir un parent sur un autre jour."), absents.length === 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "center",
      padding: "40px 0",
      color: C.gray
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 36
    }
  }, "✅"), /*#__PURE__*/React.createElement("div", null, "Personne d'absent à cette date.")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 12,
      paddingBottom: 20
    }
  }, absents.map(eid => {
    const e = elevesMap[eid];
    if (!e) return null;
    const st = pres[eid];
    const justifie = st === "absent_j";
    return /*#__PURE__*/React.createElement("div", {
      key: eid,
      style: {
        background: "rgba(255,255,255,.04)",
        border: `1px solid ${justifie ? "rgba(224,144,48,.3)" : "rgba(224,85,85,.3)"}`,
        borderRadius: 14,
        padding: 14
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 10
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
        fontSize: 15,
        fontWeight: 800,
        color: C.cream,
        fontFamily: FD
      }
    }, e.prenom, " ", e.nom), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 12,
        color: C.gray
      }
    }, e.parent || "Parent", e.tel ? ` • 📱 ${e.tel}` : "")), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 11,
        fontWeight: 700,
        color: justifie ? C.orange : C.red,
        background: justifie ? "rgba(224,144,48,.15)" : "rgba(224,85,85,.15)",
        padding: "3px 8px",
        borderRadius: 20,
        whiteSpace: "nowrap"
      }
    }, justifie ? "📋 Justifié" : "❌ Non justifié")), /*#__PURE__*/React.createElement(PanneauEnvoi, {
      eleve: e,
      mois: dateLabel,
      type: "absence",
      justifie: justifie
    }));
  }))));
}
