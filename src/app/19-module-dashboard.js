// ─── MODULE DASHBOARD ────────────────────────────────────────
function ModuleDashboard({
  eleves,
  groupes,
  appels,
  factures,
  encaissements
}) {
  const [mois, setMois] = useState(nowYM());
  const actifs = eleves.filter(e => e.actif !== false);
  // Facturé : toutes les factures du mois sauf les annulées.
  const valides = factures.filter(f => f.statut !== "annulee");
  const arrondi = n => Math.round(n * 100) / 100;
  const caYM = ym => arrondi(valides.filter(f => f.mois === ym).reduce((s, f) => s + f.montant, 0));
  const caMois = caYM(mois);
  // Encaissé : l'argent reçu dans le mois, versement par versement.
  // Même source que le livre des recettes : les deux chiffres ne divergent jamais.
  const caPaye = arrondi(lignesRecettes(encaissements, factures)
    .filter(l => l.date.startsWith(mois)).reduce((s, l) => s + l.montant, 0));
  // Impayé = facture ÉMISE dont il reste quelque chose à recevoir (acomptes
  // déduits). Un brouillon pas encore envoyé n'est l'impayé de personne.
  const impayes = valides.filter(f => f.numero && resteDu(f) > 0);
  const totalImpaye = arrondi(impayes.reduce((s, f) => s + resteDu(f), 0));
  const absM = [];
  Object.entries(appels).forEach(([k, p]) => {
    const parts = k.split(":");
    if (parts[0] !== "ap" || !parts[2]?.startsWith(mois) || estFuture(parts[2])) return;
    Object.entries(p).forEach(([eid, s]) => {
      if (s !== "present") {
        const e = eleves.find(x => x.id === eid);
        if (e) absM.push({
          e,
          date: parts[2],
          s
        });
      }
    });
  });
  const totPres = Object.entries(appels).filter(([k]) => k.split(":")[2]?.startsWith(mois)).reduce((s, [, p]) => s + Object.values(p).filter(v => v === "present").length, 0);
  const totAll = Object.entries(appels).filter(([k]) => k.split(":")[2]?.startsWith(mois)).reduce((s, [, p]) => s + Object.values(p).length, 0);
  const taux = totAll > 0 ? Math.round(totPres / totAll * 100) : 100;
  const histoCA = lastMonths(6).reverse().map(m => ({
    l: MOIS_C[+m.split("-")[1] - 1],
    v: caYM(m)
  }));
  const maxCA = Math.max(...histoCA.map(d => d.v), 1);
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 6,
      overflowX: "auto",
      paddingBottom: 8,
      marginBottom: 16
    }
  }, lastMonths(6).map(m => /*#__PURE__*/React.createElement("button", {
    key: m,
    onClick: () => setMois(m),
    style: {
      background: mois === m ? C.navy : C.surface,
      color: mois === m ? "#fff" : C.gray,
      border: "none",
      borderRadius: 20,
      padding: "5px 12px",
      fontSize: 11,
      fontWeight: 700,
      cursor: "pointer",
      whiteSpace: "nowrap",
      fontFamily: "inherit"
    }
  }, MOIS_C[+m.split("-")[1] - 1]))), (absM.filter(a => a.s === "absent_nj").length > 0 || impayes.length > 0) && /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 14
    }
  }, absM.filter(a => a.s === "absent_nj").length > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      background: C.redPale,
      border: `1px solid ${C.redBord}`,
      borderRadius: 12,
      padding: "12px 14px",
      marginBottom: 8,
      display: "flex",
      alignItems: "center",
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 20
    }
  }, "❌"), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      fontWeight: 700,
      color: C.red
    }
  }, absM.filter(a => a.s === "absent_nj").length, " absence", absM.filter(a => a.s === "absent_nj").length > 1 ? "s" : "", " non justifiée", absM.filter(a => a.s === "absent_nj").length > 1 ? "s" : ""), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: C.gray
    }
  }, "Parents à notifier"))), impayes.length > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      background: C.orangePale,
      border: `1px solid ${C.orangeBord}`,
      borderRadius: 12,
      padding: "12px 14px",
      display: "flex",
      alignItems: "center",
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 20
    }
  }, "⚠️"), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      fontWeight: 700,
      color: C.orange
    }
  }, montantTxt(totalImpaye), " à encaisser"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: C.gray
    }
  }, impayes.length, " facture", impayes.length > 1 ? "s" : "", " émise", impayes.length > 1 ? "s" : "", " pas encore réglée", impayes.length > 1 ? "s" : "")))), h(BlocAlertesAbsences, {
    eleves: actifs,
    appels
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: 10,
      marginBottom: 14
    }
  }, [{
    e: "👤",
    v: actifs.length,
    l: "Élèves actifs",
    c: C.texte
  }, {
    e: "📚",
    v: groupes.length,
    l: "Groupes",
    c: C.texte
  }, {
    e: "💰",
    v: `${caMois}€`,
    l: "CA ce mois",
    c: C.green,
    sub: `${caPaye}€ encaissé`
  }, {
    e: "✅",
    v: `${taux}%`,
    l: "Présence",
    c: C.texte
  }].map((s, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      background: C.surface,
      border: `1px solid ${C.bord}`,
      borderRadius: 14,
      padding: "14px 12px"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 15,
      opacity: .75,
      marginBottom: 4
    }
  }, s.e), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 27,
      fontWeight: 700,
      color: s.c,
      fontFamily: FD,
      lineHeight: 1
    }
  }, s.v), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      fontWeight: 500,
      color: C.gray,
      marginTop: 5
    }
  }, s.l), s.sub && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      color: C.gray,
      marginTop: 3
    }
  }, s.sub)))), /*#__PURE__*/React.createElement("div", {
    style: {
      background: C.surface,
      border: `1px solid ${C.bord}`,
      borderRadius: 16,
      padding: 16,
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 15,
      fontWeight: 700,
      color: C.texte,
      fontFamily: FD,
      marginBottom: 12
    }
  }, "📈 CA — 6 mois"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "flex-end",
      gap: 6,
      height: 90
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
        justifyContent: "flex-end",
        gap: 3
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 10,
        color: isL ? C.texte : C.gray,
        fontWeight: isL ? 700 : 400
      }
    }, d.v > 0 ? `${d.v}€` : ""), /*#__PURE__*/React.createElement("div", {
      // Une hauteur en pixels : le parent n'a pas de hauteur propre, et un
      // pourcentage s'y réduisait à rien — les barres ne s'affichaient pas.
      style: {
        width: "100%",
        borderRadius: "4px 4px 0 0",
        background: isL ? C.navyL : C.navyPale,
        height: Math.max(Math.round(pct * 68), 4)
      }
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 10,
        color: isL ? C.texte : C.gray,
        fontWeight: isL ? 700 : 400
      }
    }, d.l));
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      background: C.surface,
      border: `1px solid ${C.bord}`,
      borderRadius: 16,
      padding: 16,
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 15,
      fontWeight: 700,
      color: C.texte,
      fontFamily: FD,
      marginBottom: 12
    }
  }, "👥 Présences — ", ml(mois)), actifs.map(e => {
    const nb = countSeances(e.id, mois, appels, groupes);
    const absE = absM.filter(a => a.e.id === e.id).length;
    const tot = nb + absE;
    const pct = tot > 0 ? Math.round(nb / tot * 100) : 100;
    const cl = pct >= 80 ? C.green : pct >= 50 ? C.orange : C.red;
    return /*#__PURE__*/React.createElement("div", {
      key: e.id,
      style: {
        marginBottom: 12
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 8,
        marginBottom: 4
      }
    }, /*#__PURE__*/React.createElement(Avatar, {
      p: e.prenom,
      n: e.nom,
      s: 28
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1,
        fontSize: 13,
        color: C.texte,
        fontWeight: 600
      }
    }, e.prenom, " ", e.nom), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 13,
        fontWeight: 700,
        color: cl
      }
    }, pct, "%"), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 11,
        color: C.gray
      }
    }, nb, "/", tot)), /*#__PURE__*/React.createElement("div", {
      style: {
        height: 4,
        borderRadius: 4,
        background: C.surface
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        height: "100%",
        borderRadius: 4,
        background: cl,
        width: `${pct}%`,
        transition: "width .4s"
      }
    })));
  }), actifs.length === 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "center",
      padding: "20px 0",
      color: C.gray,
      fontSize: 13
    }
  }, "Aucun élève actif pour l'instant.")), absM.length > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      background: C.surface,
      border: `1px solid ${C.redBord}`,
      borderRadius: 16,
      padding: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      fontWeight: 700,
      color: C.red,
      letterSpacing: "1px",
      textTransform: "uppercase",
      marginBottom: 12
    }
  }, "🔴 Absences ce mois (", absM.length, ")"), absM.slice(0, 6).map((a, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      display: "flex",
      alignItems: "center",
      gap: 10,
      padding: "8px 0",
      borderBottom: i < Math.min(absM.length, 6) - 1 ? `1px solid ${C.bord}` : "none"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 16
    }
  }, a.s === "absent_nj" ? "❌" : "📋"), /*#__PURE__*/React.createElement(Avatar, {
    p: a.e.prenom,
    n: a.e.nom,
    s: 28
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      fontWeight: 600,
      color: C.texte
    }
  }, a.e.prenom, " ", a.e.nom), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      color: C.gray
    }
  }, new Date(a.date).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short"
  }))), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11,
      fontWeight: 700,
      color: a.s === "absent_nj" ? C.red : C.orange,
      background: a.s === "absent_nj" ? C.redPale : C.orangePale,
      padding: "3px 8px",
      borderRadius: 20
    }
  }, a.s === "absent_nj" ? "Non justifié" : "Justifié")))));
}
