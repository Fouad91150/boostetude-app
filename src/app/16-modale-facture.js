// ─── MODALE FACTURE ──────────────────────────────────────────
function ModaleFacture({
  eleve,
  existante,
  dates,
  onSave,
  onClose
}) {
  // Le montant n'est plus modifiable à la main : il vient uniquement de l'appel.
  // La facture est cumulative : "dates" liste toutes les séances présentes depuis
  // la dernière facture payée de cet élève. La marquer payée clôt cette période ;
  // les séances suivantes ouvriront une toute nouvelle facture.
  const nb = dates.length;
  const [st, setSt] = useState(existante?.statut ?? "en_attente");
  const [mode, setMode] = useState(existante?.mode ?? eleve.mp);
  const [dateP, setDateP] = useState(existante?.datePaiement ?? "");
  const [notes, setNotes] = useState(existante?.notes ?? "");
  const [saving, setSaving] = useState(false);
  const total = parseFloat((nb * 2 * eleve.th).toFixed(2));
  const save = async () => {
    setSaving(true);
    try {
      await onSave({
        nbSeances: nb,
        montant: total,
        datesSeances: dates,
        statut: st,
        mode,
        datePaiement: dateP,
        notes
      });
    } finally {
      setSaving(false);
    }
  };
  return /*#__PURE__*/React.createElement("div", {
    onClick: e => e.target === e.currentTarget && onClose(),
    style: {
      position: "fixed",
      inset: 0,
      zIndex: 500,
      background: "rgba(0,0,0,.75)",
      display: "flex",
      alignItems: "flex-end"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: "100%",
      background: C.navyM,
      borderRadius: "20px 20px 0 0",
      padding: "24px 20px 44px",
      maxHeight: "92vh",
      overflowY: "auto",
      border: "1px solid rgba(212,175,55,.2)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 20
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      fontWeight: 700,
      color: C.gold,
      letterSpacing: "1px",
      textTransform: "uppercase"
    }
  }, existante ? "Statut du paiement" : "Nouvelle facture", " — depuis ", dates.length ? fmtDateCourt(dates[0].date) : "—"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 20,
      fontWeight: 800,
      color: C.cream,
      fontFamily: FD
    }
  }, eleve.prenom, " ", eleve.nom)), /*#__PURE__*/React.createElement("button", {
    onClick: onClose,
    style: {
      background: "rgba(255,255,255,.08)",
      border: "none",
      borderRadius: "50%",
      width: 36,
      height: 36,
      color: C.gray,
      cursor: "pointer",
      fontSize: 18,
      fontFamily: "inherit"
    }
  }, "×")), /*#__PURE__*/React.createElement(Lbl, {
    text: "Séances (calculées depuis l'appel)"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 16,
      background: "rgba(255,255,255,.04)",
      borderRadius: 14,
      padding: 14,
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "center"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 44,
      fontWeight: 800,
      color: C.gold,
      fontFamily: FD,
      lineHeight: 1
    }
  }, nb), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: C.gray,
      marginTop: 4
    }
  }, "× 2h × ", eleve.th, "€/h = ", /*#__PURE__*/React.createElement("strong", {
    style: {
      color: C.gold
    }
  }, total, "€")), dates.length > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 8,
      textAlign: "left"
    }
  }, groupParMatiere(dates).map(g => /*#__PURE__*/React.createElement("div", {
    key: g.matiere,
    style: {
      fontSize: 11,
      color: C.gray,
      lineHeight: 1.6,
      marginBottom: 2
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: C.gold,
      fontWeight: 700
    }
  }, g.matiere), " (", g.dates.length, " séance", g.dates.length > 1 ? "s" : "", ") : ", g.dates.map(d => fmtDateCourt(d)).join(" · ")))), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      color: C.gray,
      marginTop: 6,
      fontStyle: "italic"
    }
  }, "Pour changer ce nombre, corrigez l'appel — le montant ne se modifie pas ici."))), st === "paye" && /*#__PURE__*/React.createElement("div", {
    style: {
      background: "rgba(224,144,48,.1)",
      border: "1px solid rgba(224,144,48,.3)",
      borderRadius: 10,
      padding: "10px 12px",
      marginBottom: 14,
      fontSize: 12,
      color: C.orange
    }
  }, "⚠️ Marquer payé clôt cette facture : les prochaines séances de cet élève ouvriront une nouvelle facture, elles ne s'ajouteront plus à celle-ci."), /*#__PURE__*/React.createElement(Lbl, {
    text: "Statut"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr 1fr",
      gap: 8,
      marginBottom: 16
    }
  }, [{
    k: "en_attente",
    i: "⏳",
    l: "En attente",
    cl: C.orange
  }, {
    k: "paye",
    i: "✅",
    l: "Payé",
    cl: C.green
  }, {
    k: "impaye",
    i: "❌",
    l: "Impayé",
    cl: C.red
  }].map(({
    k,
    i,
    l,
    cl
  }) => /*#__PURE__*/React.createElement("button", {
    key: k,
    onClick: () => {
      setSt(k);
      if (k === "paye" && !dateP) setDateP(todayStr());
    },
    style: {
      background: st === k ? `${cl}22` : "rgba(255,255,255,.05)",
      border: st === k ? `2px solid ${cl}` : "1px solid rgba(255,255,255,.1)",
      borderRadius: 12,
      padding: "12px 4px",
      cursor: "pointer",
      fontFamily: "inherit",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 4
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 20
    }
  }, i), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11,
      fontWeight: 700,
      color: st === k ? cl : C.gray
    }
  }, l)))), st === "paye" && /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Lbl, {
    text: "Mode de paiement"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      marginBottom: 14
    }
  }, ["Virement", "Espèces", "Chèque"].map(m => /*#__PURE__*/React.createElement("button", {
    key: m,
    onClick: () => setMode(m),
    style: {
      flex: 1,
      background: mode === m ? "rgba(212,175,55,.15)" : "rgba(255,255,255,.05)",
      border: mode === m ? `1.5px solid ${C.gold}` : "1px solid rgba(255,255,255,.1)",
      borderRadius: 10,
      padding: "9px 4px",
      cursor: "pointer",
      fontFamily: "inherit",
      fontSize: 12,
      fontWeight: 700,
      color: mode === m ? C.gold : C.gray
    }
  }, m))), /*#__PURE__*/React.createElement(InputText, {
    label: "Date de paiement",
    value: dateP,
    onChange: setDateP,
    type: "date"
  })), /*#__PURE__*/React.createElement(InputArea, {
    label: "Notes",
    value: notes,
    onChange: setNotes,
    placeholder: "Remise, rattrapage…"
  }), /*#__PURE__*/React.createElement("button", {
    onClick: save,
    disabled: saving,
    style: {
      width: "100%",
      background: `linear-gradient(135deg,${C.gold},${C.goldD})`,
      border: "none",
      borderRadius: 14,
      padding: 16,
      color: C.navy,
      fontSize: 16,
      fontWeight: 800,
      cursor: saving ? "not-allowed" : "pointer",
      fontFamily: "inherit",
      boxShadow: "0 4px 20px rgba(212,175,55,.3)",
      opacity: saving ? .7 : 1
    }
  }, saving ? "💾 Enregistrement…" : `💾 Enregistrer — ${total}€`)));
}
