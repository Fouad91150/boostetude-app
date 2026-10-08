// ─── CARTE APPEL ─────────────────────────────────────────────
function CarteAppel({
  eleve,
  statut,
  onChange
}) {
  const colors = {
    present: {
      bg: C.greenPale,
      bd: C.greenBord
    },
    absent_j: {
      bg: C.orangePale,
      bd: C.orangeBord
    },
    absent_nj: {
      bg: C.redPale,
      bd: C.redBord
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
      color: C.texte,
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
      background: statut === k ? `${cl}22` : C.surface,
      border: statut === k ? `2px solid ${cl}` : `1px solid ${C.bord}`,
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
