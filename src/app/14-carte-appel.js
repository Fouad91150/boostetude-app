// ─── CARTE APPEL ─────────────────────────────────────────────
function CarteAppel({
  eleve,
  statut,
  onChange
}) {
  const colors = {
    present: {
      bg: "rgba(76,175,125,.12)",
      bd: "rgba(76,175,125,.4)"
    },
    absent_j: {
      bg: "rgba(224,144,48,.12)",
      bd: "rgba(224,144,48,.4)"
    },
    absent_nj: {
      bg: "rgba(224,85,85,.12)",
      bd: "rgba(224,85,85,.4)"
    }
  };
  const s = colors[statut] || colors.present;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: s.bg,
      border: `1.5px solid ${s.bd}`,
      borderRadius: 14,
      padding: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 10,
      marginBottom: 12
    }
  }, /*#__PURE__*/React.createElement(Avatar, {
    p: eleve.prenom,
    n: eleve.nom,
    s: 44
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 17,
      fontWeight: 800,
      color: C.cream,
      fontFamily: FD
    }
  }, eleve.prenom, " ", eleve.nom), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: C.gray
    }
  }, eleve.niveau, eleve.tel ? ` • 📱 ${eleve.tel}` : "")), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 22
    }
  }, statut === "present" ? "✅" : statut === "absent_j" ? "📋" : "❌")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr 1fr",
      gap: 8
    }
  }, [["present", "✅", "Présent", C.green], ["absent_j", "📋", "Justifié", C.orange], ["absent_nj", "❌", "Absent", C.red]].map(([k, icon, lbl, cl]) => /*#__PURE__*/React.createElement("button", {
    key: k,
    onClick: () => onChange(k),
    style: {
      background: statut === k ? `${cl}22` : "rgba(255,255,255,.05)",
      border: statut === k ? `2px solid ${cl}` : "1px solid rgba(255,255,255,.1)",
      borderRadius: 10,
      padding: "10px 4px",
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
  }, icon), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 10,
      fontWeight: 700,
      color: statut === k ? cl : C.gray
    }
  }, lbl)))));
}
