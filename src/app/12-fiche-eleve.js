// ─── FICHE ÉLÈVE ─────────────────────────────────────────────
function FicheEleve({
  eleve,
  groupeNom,
  onEdit,
  onBack,
  onToggle
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "0 4px"
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: onBack,
    style: {
      background: "none",
      border: "none",
      color: C.gold,
      cursor: "pointer",
      fontSize: 20,
      padding: 0,
      marginBottom: 20
    }
  }, "←"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 14,
      marginBottom: 20
    }
  }, /*#__PURE__*/React.createElement(Avatar, {
    p: eleve.prenom,
    n: eleve.nom,
    s: 52
  }), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 22,
      fontWeight: 800,
      color: C.cream,
      fontFamily: FD
    }
  }, eleve.prenom, " ", eleve.nom), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: C.gray,
      marginTop: 2
    }
  }, eleve.niveau, " • ", eleve.th, "€/h • ", groupeNom))), [{
    t: "💰 Facturation",
    rows: [["Tarif horaire", `${eleve.th} €`], ["Séance de 2 h", `${eleve.th * 2} €`], ["Mode de règlement", eleve.mp]]
  }, {
    t: "👨‍👩‍👦 Parent",
    rows: [["Nom", eleve.parent || "—"], ["Tél", eleve.tel || "—"], ["Email", eleve.email || "—"]]
  }, eleve.notes ? {
    t: "📝 Notes",
    rows: [["", eleve.notes]]
  } : null].filter(Boolean).map((card, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      background: "rgba(255,255,255,.04)",
      border: "1px solid rgba(212,175,55,.12)",
      borderRadius: 12,
      padding: 16,
      marginBottom: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      fontWeight: 700,
      color: C.gold,
      marginBottom: 10
    }
  }, card.t), card.rows.map(([k, v], j) => /*#__PURE__*/React.createElement("div", {
    key: j,
    style: {
      display: "flex",
      justifyContent: k ? "space-between" : "flex-start",
      marginBottom: j < card.rows.length - 1 ? 6 : 0
    }
  }, k && /*#__PURE__*/React.createElement("span", {
    style: {
      color: C.gray,
      fontSize: 13
    }
  }, k), /*#__PURE__*/React.createElement("span", {
    style: {
      color: C.cream,
      fontSize: 13,
      fontWeight: k ? 600 : 400
    }
  }, v))))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 10,
      marginTop: 16
    }
  }, /*#__PURE__*/React.createElement(BtnPrimary, {
    label: "✏️ Modifier",
    onClick: onEdit
  }), /*#__PURE__*/React.createElement("button", {
    onClick: onToggle,
    style: {
      background: eleve.actif ? "rgba(224,85,85,.12)" : "rgba(76,175,125,.12)",
      border: `1px solid ${eleve.actif ? "rgba(224,85,85,.3)" : "rgba(76,175,125,.3)"}`,
      borderRadius: 10,
      padding: "12px 16px",
      fontSize: 14,
      fontWeight: 700,
      color: eleve.actif ? C.red : C.green,
      cursor: "pointer",
      fontFamily: "inherit"
    }
  }, eleve.actif ? "🔴 Désactiver" : "🟢 Réactiver")));
}
