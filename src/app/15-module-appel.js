// ─── MODULE APPEL ─────────────────────────────────────────────
function ModuleAppel({
  eleves,
  groupes,
  appels,
  comptesRendus,
  monProfilId,
  onSaveAppel,
  onSaveComptesRendus,
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
  const [travaille, setTravaille] = useState("");
  const [difficultes, setDifficultes] = useState("");
  const [devoirs, setDevoirs] = useState("");
  const [saveCR, setSaveCR] = useState(false);
  const [enAttente, setEnAttente] = useState(fileAppels.lire().length);
  const [videsOuverts, setVidesOuverts] = useState(false);
  const enLigne = useEnLigne();
  const elevesMap = {};
  eleves.forEach(e => {
    elevesMap[e.id] = e;
  });

  // Le brouillon est écrit à chaque geste : si l'onglet se ferme ou si le réseau
  // tombe, la saisie est toujours là au retour.
  useEffect(() => {
    if (grp && etape === "appel" && Object.keys(pres).length) {
      Local.ecrire(cleBrouillonAppel(grp.id, date), pres);
    }
  }, [pres, grp, date, etape]);

  // Au retour de la connexion, ce qui attendait part tout seul.
  useEffect(() => {
    if (!enLigne) return;
    let vivant = true;
    (async () => {
      const { rejoues, restants } = await rejouerFileAppels(onSaveAppel);
      if (!vivant) return;
      setEnAttente(restants);
      if (rejoues) signalerSucces(`${rejoues} appel${rejoues > 1 ? "s" : ""} enregistré${rejoues > 1 ? "s" : ""} au retour du réseau.`);
    })();
    return () => { vivant = false; };
  }, [enLigne]);
  if (grpForm !== null) {
    return /*#__PURE__*/React.createElement(FormulaireGroupe, {
      initial: grpForm.id ? grpForm : null,
      profs: profs,
      onSave: async f => {
        try {
          await onSaveGroupe(f);
          setGrpForm(null);
        } catch (e) {
          signalerErreur(e);
        }
      },
      onCancel: () => setGrpForm(null)
    });
  }
  // Un appel laissé en plan vaut mieux qu'une liste repartie de zéro : le
  // brouillon local l'emporte sur ce qu'a renvoyé le serveur.
  const etatPour = (g, d) => {
    const brouillon = Local.lire(cleBrouillonAppel(g.id, d), null);
    if (brouillon && Object.keys(brouillon).length) return { pres: brouillon, repris: !appels[`ap:${g.id}:${d}`] };
    const ex = appels[`ap:${g.id}:${d}`];
    if (ex) return { pres: ex, repris: false };
    const p = {};
    (g.eids || []).forEach(id => {
      p[id] = "present";
    });
    return { pres: p, repris: false };
  };
  const ouvrir = g => {
    if (estFuture(date)) {
      signalerErreur(`Le ${fmtDateLongue(date)} n'est pas encore arrivé : l'appel se fait le jour de la séance.`);
      return;
    }
    setGrp(g);
    const { pres: p, repris } = etatPour(g, date);
    setPres(p);
    if (repris) signalerInfo("Appel repris là où vous l'aviez laissé.");
    setEtape("appel");
  };
  const changerDate = d => {
    setDate(d);
    if (!grp) return;
    setPres(etatPour(grp, d).pres);
  };
  const enregistrer = async () => {
    setEnregistrement(true);
    try {
      const { enAttente: differe } = await envoyerAppel(onSaveAppel, grp.id, date, pres);
      setEnAttente(fileAppels.lire().length);
      if (differe) signalerInfo("Pas de réseau : l'appel est gardé sur l'appareil et partira tout seul.");
      setTravaille("");
      setDifficultes("");
      setDevoirs("");
      setEtape("confirme");
    } catch (e) {
      signalerErreur(e);
    }
    setEnregistrement(false);
  };
  const nbP = Object.values(pres).filter(s => s === "present").length;
  const nbAJ = Object.values(pres).filter(s => s === "absent_j").length;
  const nbAN = Object.values(pres).filter(s => s === "absent_nj").length;
  // Absences répétées : on compte avec l'appel en cours de saisie, pour que
  // l'alerte tombe dès la séance qui fait franchir le palier.
  const alertesAbs = grp ? (() => {
    const avecCetAppel = { ...appels, [`ap:${grp.id}:${date}`]: pres };
    return (grp.eids || []).map(eid => {
      const e = elevesMap[eid];
      const a = e && pres[eid] === "absent_nj" ? alerteAbsences(eid, avecCetAppel, date) : null;
      return a ? { eleve: e, ...a } : null;
    }).filter(Boolean);
  })() : [];
  const idsAlerte = alertesAbs.map(a => a.eleve.id);
  // Un groupe sans inscrit est une place tenue pour plus tard, pas une séance à
  // pointer. Il quitte la liste principale sans disparaître de l'application.
  // Les groupes qui ont cours ce jour-là passent en tête : le bon groupe est
  // sous le pouce, et un groupe pointé un autre jour que le sien se remarque.
  const jourChoisi = jourDeLaDate(date);
  const horsJour = g => !!g.jour && g.jour !== jourChoisi;
  const groupesTenus = groupes.filter(g => (g.eids || []).length > 0)
    .sort((a, b) => (horsJour(a) ? 1 : 0) - (horsJour(b) ? 1 : 0));
  // Si aucun groupe n'a cours ce jour-là, une seule ligne le dit (plutôt qu'un
  // avertissement sur chaque carte).
  const avecJour = groupesTenus.filter(g => g.jour);
  const aucunCeJour = avecJour.length > 0 && avecJour.every(horsJour);
  const groupesVides = groupes.filter(g => (g.eids || []).length === 0);
  if (etape === "groupes") return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      background: C.navyPale,
      border: `1px solid ${C.bord}`,
      borderRadius: 14,
      padding: 14,
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement(Lbl, {
    text: "Date de la séance"
  }), /*#__PURE__*/React.createElement("input", {
    type: "date",
    value: date,
    max: todayStr(),
    onChange: e => setDate(e.target.value),
    style: {
      width: "100%",
      background: "transparent",
      border: `1px solid ${C.bord}`,
      borderRadius: 8,
      padding: "10px 12px",
      color: C.texte,
      fontSize: 16,
      fontFamily: "inherit",
      outline: "none",
      boxSizing: "border-box",
      colorScheme: "light"
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
  })), !estFuture(date) && aucunCeJour && h("div", {
    style: { marginTop: 8, fontSize: 13, color: C.orange, fontWeight: 600 }
  }, `Aucun groupe n'a cours le ${jourChoisi.toLowerCase()} — vérifiez la date avant de faire l'appel.`), estFuture(date) && h("div", {
    style: { marginTop: 10, padding: "10px 12px", borderRadius: 10, background: C.redPale,
      border: `1px solid ${C.redBord}`, color: C.red, fontSize: 13, fontWeight: 600 }
  }, "⚠️ Cette date est à venir. L'appel se fait le jour de la séance. ",
    h("button", {
      onClick: () => setDate(todayStr()),
      style: { background: "none", border: "none", padding: 0, color: C.red, fontWeight: 800,
        textDecoration: "underline", cursor: "pointer", fontFamily: "inherit", fontSize: 13 }
    }, "Revenir à aujourd'hui"))), /*#__PURE__*/React.createElement("div", {
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
  }, groupesTenus.map(g => {
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
        background: fait ? C.greenPale : C.surface,
        border: fait ? `1.5px solid ${C.greenBord}` : `1px solid ${C.bord}`,
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
        color: C.texte,
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
    }, horaireLabel(g), " • ", (g.eids || []).length, "/", g.max, " élèves"),
      horsJour(g) && !fait && !aucunCeJour && h("div", {
        style: { fontSize: 12, color: C.orange, fontWeight: 600, marginTop: 4 }
      }, `Cours habituel le ${g.jour.toLowerCase()} — vérifiez la date`)), fait ? /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 11,
        fontWeight: 700,
        color: C.green,
        background: C.greenPale,
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
        background: C.surface,
        border: `1px solid ${C.bord}`,
        borderRadius: 14,
        padding: "0 14px",
        color: C.gold,
        cursor: "pointer",
        fontSize: 16,
        fontFamily: "inherit"
      }
    }, "✏️"));
  }), groupesVides.length > 0 && h("div", { style: { marginTop: 14 } },
    h("button", {
      onClick: () => setVidesOuverts(v => !v),
      style: { background: "none", border: "none", color: C.gray, cursor: "pointer", fontSize: 12.5, fontWeight: 600, fontFamily: "inherit", padding: "6px 0" }
    }, videsOuverts ? "▾ " : "▸ ", groupesVides.length, " groupe", groupesVides.length > 1 ? "s" : "", " sans élève inscrit"),
    videsOuverts && h("div", { style: { display: "flex", flexDirection: "column", gap: 8, marginTop: 8 } },
      groupesVides.map(g => h("div", { key: g.id, style: { display: "flex", gap: 8 } },
        h("button", {
          onClick: () => ouvrir(g),
          style: { flex: 1, background: C.surface, border: `1px dashed ${C.bord}`, borderRadius: 12, padding: "12px 14px", cursor: "pointer", fontFamily: "inherit", textAlign: "left" }
        },
          h("div", { style: { fontSize: 14, fontWeight: 700, color: C.gray, fontFamily: FD } },
            g.nom, h("span", { style: { fontSize: 10.5, fontWeight: 700, color: C.gold, marginLeft: 8 } }, g.matiere)),
          h("div", { style: { fontSize: 11.5, color: C.grisClair, marginTop: 2 } }, horaireLabel(g), " • aucun inscrit")),
        isAdmin && h("button", {
          onClick: () => setGrpForm(g),
          style: { background: C.surface, border: `1px solid ${C.bord}`, borderRadius: 12, padding: "0 13px", color: C.gold, cursor: "pointer", fontSize: 14, fontFamily: "inherit" }
        }, "✏️"))))),
  groupes.length === 0 && isAdmin && /*#__PURE__*/React.createElement("div", {
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
  if (etape === "confirme") {
    const presentsIds = (grp.eids || []).filter(id => pres[id] === "present");
    const dejaEcrits = (comptesRendus || []).filter(c => c.groupe_id === grp.id && c.date === date).length;
    // Les notions déjà saisies pour ce groupe deviennent des raccourcis : un chapitre
    // s'étale sur plusieurs séances, le retaper chaque fois est une corvée inutile.
    const suggestions = [...new Set((comptesRendus || [])
      .filter(c => c.groupe_id === grp.id)
      .flatMap(c => splitNotions(c.notions)))].slice(0, 6);
    const ajouterNotion = t => setTravaille(v => {
      const deja = splitNotions(v).some(x => x.toLowerCase() === t.toLowerCase());
      return deja ? v : (v.trim() ? `${v.trim()}, ${t}` : t);
    });
    const finir = () => {
      setEtape("groupes");
      setGrp(null);
      setTravaille("");
      setDifficultes("");
      setDevoirs("");
    };
    const enregistrerCR = async () => {
      if (!travaille.trim() && !difficultes.trim() && !devoirs.trim()) {
        signalerInfo("Écrivez au moins ce qui a été travaillé.");
        return;
      }
      setSaveCR(true);
      try {
        const parEleve = {};
        presentsIds.forEach(id => {
          parEleve[id] = {
            notions: travaille.trim(),
            difficultes: difficultes.trim(),
            progres: "",
            devoirs: devoirs.trim(),
            niveau_seance: null
          };
        });
        await onSaveComptesRendus(grp.id, date, parEleve, monProfilId);
        signalerSucces("Compte rendu enregistré — il alimentera le bilan aux parents.");
        finir();
      } catch (e) {
        signalerErreur(e);
      }
      setSaveCR(false);
    };

    return h("div", { className: "fx-fade-slide-up" },
      // L'appel est fait : on le dit en une ligne et on passe à la suite.
      h("div", {
        style: {
          background: enAttente ? "rgba(224,150,60,.12)" : C.greenPale,
          border: `1px solid ${enAttente ? "rgba(224,150,60,.4)" : C.greenBord}`,
          borderRadius: 12, padding: "12px 14px", marginBottom: 18,
          display: "flex", alignItems: "center", gap: 10
        }
      },
        h("span", { style: { fontSize: 20 } }, enAttente ? "📡" : "✅"),
        h("div", { style: { flex: 1 } },
          h("div", { style: { fontSize: 14, fontWeight: 800, color: C.texte, fontFamily: FD } },
            enAttente ? "Appel gardé sur l'appareil" : "Appel enregistré"),
          h("div", { style: { fontSize: 12, color: C.gray, marginTop: 2 } },
            `${grp.nom} • ${new Date(date).toLocaleDateString("fr-FR", { day: "numeric", month: "long" })} • `,
            h("span", { style: { color: C.green, fontWeight: 700 } }, `${nbP} présent${nbP > 1 ? "s" : ""}`),
            nbAJ > 0 ? h("span", { style: { color: C.orange } }, ` • ${nbAJ} justifié${nbAJ > 1 ? "s" : ""}`) : null,
            nbAN > 0 ? h("span", { style: { color: C.red } }, ` • ${nbAN} absent${nbAN > 1 ? "s" : ""}`) : null)),
        h("button", {
          onClick: () => setEtape("appel"),
          style: { background: "none", border: "none", color: C.gold, cursor: "pointer", fontSize: 12, fontWeight: 700, fontFamily: "inherit", whiteSpace: "nowrap" }
        }, "✏️ Corriger")),

      // Un élève vient d'atteindre 3, 6, 9… absences non justifiées : on le dit
      // tout de suite, c'est le moment où le prof a le téléphone en main.
      alertesAbs.length > 0 && h("div", {
        style: {
          background: C.redPale, border: `1px solid ${C.redBord}`, borderRadius: 12,
          padding: "12px 14px", marginBottom: 18, display: "flex", alignItems: "center", gap: 10
        }
      },
        h("span", { style: { fontSize: 20 } }, "🚨"),
        h("div", { style: { flex: 1, fontSize: 13, color: C.texte, lineHeight: 1.45 } },
          alertesAbs.map((a, i) => h("div", { key: a.eleve.id },
            h("b", null, a.eleve.prenom, " ", a.eleve.nom), ` : ${a.nb} absences non justifiées depuis la rentrée`))),
        h("button", {
          onClick: () => { setEtape("appel"); setOnglet("parents"); },
          style: { background: C.red, border: "none", borderRadius: 10, color: "#fff", cursor: "pointer", fontSize: 12, fontWeight: 700, fontFamily: "inherit", padding: "8px 10px", whiteSpace: "nowrap" }
        }, "Prévenir →")),

      presentsIds.length === 0
        ? h("div", { style: { textAlign: "center", padding: "20px 0 28px", color: C.gray, fontSize: 13 } },
            "Personne n'était présent : il n'y a pas de compte rendu à écrire.")
        : h("div", null,
            h("div", { style: { fontSize: 20, fontWeight: 800, color: C.texte, fontFamily: FD, marginBottom: 4 } },
              "Qu'avez-vous travaillé ?"),
            h("div", { style: { fontSize: 13, color: C.gray, marginBottom: 16, lineHeight: 1.5 } },
              "Deux lignes suffisent. Elles valent pour les ", presentsIds.length, " élève",
              presentsIds.length > 1 ? "s" : "", " présent", presentsIds.length > 1 ? "s" : "",
              " et nourrissent le bilan envoyé aux parents."),

            dejaEcrits > 0 && h("div", {
              style: { background: C.navyPale, border: `1px solid ${C.bord}`, borderRadius: 10, padding: "9px 12px", marginBottom: 14, fontSize: 12.5, color: C.texte }
            }, `📝 Un compte rendu existe déjà pour cette séance. L'enregistrer à nouveau le remplacera.`),

            suggestions.length > 0 && h("div", { style: { marginBottom: 12 } },
              h("div", { style: { fontSize: 11, color: C.gray, marginBottom: 6, textTransform: "uppercase", letterSpacing: ".06em", fontWeight: 700 } }, "Déjà vu avec ce groupe"),
              h("div", { style: { display: "flex", flexWrap: "wrap", gap: 6 } },
                suggestions.map(s => h("button", {
                  key: s,
                  onClick: () => ajouterNotion(s),
                  style: { background: C.navyPale, border: `1px solid ${C.bord}`, borderRadius: 16, padding: "5px 11px", color: C.navyL, cursor: "pointer", fontSize: 12, fontWeight: 600, fontFamily: "inherit" }
                }, "+ ", s)))),

            h(InputArea, {
              label: "Travaillé en séance",
              value: travaille,
              onChange: setTravaille,
              placeholder: "Théorème de Pythagore, exercices 12 à 18…"
            }),
            h(InputArea, {
              label: "Difficultés rencontrées (facultatif)",
              value: difficultes,
              onChange: setDifficultes,
              placeholder: "Confusion entre hypoténuse et côté adjacent…"
            }),
            h(InputText, {
              label: "Devoirs pour la prochaine fois (facultatif)",
              value: devoirs,
              onChange: setDevoirs,
              placeholder: "Exercices 20 et 21 page 54"
            }),

            h("div", { style: { display: "flex", flexDirection: "column", gap: 10, marginTop: 4 } },
              h(BtnPrimary, {
                label: saveCR ? "Enregistrement…" : "📝 Enregistrer le compte rendu",
                onClick: enregistrerCR,
                full: true,
                disabled: saveCR
              }),
              onAllerSuivi && h("button", {
                onClick: onAllerSuivi,
                style: { background: "none", border: "none", color: C.gold, cursor: "pointer", fontSize: 13, fontWeight: 700, fontFamily: "inherit", padding: "4px 0" }
              }, "Détailler élève par élève →"))),

      h("div", { style: { marginTop: 18, paddingTop: 16, borderTop: `1px solid ${C.bord}` } },
        h(BtnSecondary, {
          label: presentsIds.length === 0 ? "← Retour aux groupes" : "Passer pour cette fois",
          onClick: finir,
          full: true
        })));
  }
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
    l: `${alertesAbs.length > 0 ? "🚨" : "✉️"} Parents${absents.length > 0 ? ` (${absents.length})` : ""}`
  }].map(({
    k,
    l
  }) => /*#__PURE__*/React.createElement("button", {
    key: k,
    onClick: () => setOnglet(k),
    style: {
      background: onglet === k ? C.navy : C.surface,
      color: onglet === k ? "#fff" : C.gray,
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
      background: C.surface,
      border: `1px solid ${C.bord}`,
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
      color: C.texte,
      fontSize: 14,
      fontFamily: "inherit",
      outline: "none",
      colorScheme: "light"
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
      background: C.surface,
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
      background: C.greenPale,
      border: `1px solid ${C.greenBord}`,
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
      background: C.redPale,
      border: `1px solid ${C.redBord}`,
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
      background: `linear-gradient(to top,${C.fond} 72%,transparent)`,
      zIndex: 200
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: enregistrer,
    disabled: enregistrement,
    style: {
      width: "100%",
      background: C.navy,
      border: "none",
      borderRadius: 12,
      padding: 16,
      color: "#fff",
      fontSize: 16,
      fontWeight: 600,
      cursor: enregistrement ? "not-allowed" : "pointer",
      fontFamily: "inherit",
      boxShadow: C.ombreForte,
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
        background: C.surface,
        border: `1px solid ${C.bord}`,
        borderRadius: 14,
        padding: 14
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 14,
        fontWeight: 700,
        color: C.texte,
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
  })), onglet === "parents" && /*#__PURE__*/React.createElement("div", null, alertesAbs.length > 0 && h("div", {
    style: { display: "flex", flexDirection: "column", gap: 10, marginBottom: 18 }
  }, h("div", { style: { fontSize: 13, fontWeight: 800, color: C.red } }, "🚨 Absences répétées"),
    alertesAbs.map(a => h(CarteAlerteAbsences, { key: a.eleve.id, eleve: a.eleve, dates: a.dates, palier: a.palier, refDate: date }))),
  /*#__PURE__*/React.createElement("div", {
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
  }, absents.filter(eid => !idsAlerte.includes(eid)).map(eid => {
    const e = elevesMap[eid];
    if (!e) return null;
    const st = pres[eid];
    const justifie = st === "absent_j";
    return /*#__PURE__*/React.createElement("div", {
      key: eid,
      style: {
        background: C.surface,
        border: `1px solid ${justifie ? C.orangeBord : C.redBord}`,
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
        color: C.texte,
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
        background: justifie ? C.orangePale : C.redPale,
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
