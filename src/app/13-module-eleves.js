// ─── MODULE ÉLÈVES ────────────────────────────────────────────
function ModuleEleves({
  eleves,
  groupes,
  onCreate,
  onUpdate,
  onToggle
}) {
  const [vue, setVue] = useState("liste");
  const [sel, setSel] = useState(null);
  const [search, setSearch] = useState("");
  const [toast, setToast] = useState(null);
  const showToast = msg => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };
  const actifs = eleves.filter(e => e.actif !== false);
  const filtered = actifs.filter(e => !search || `${e.prenom} ${e.nom} ${e.niveau}`.toLowerCase().includes(search.toLowerCase()));
  // Un élève peut suivre plusieurs matières (ex. Maths + Physique) : on liste tous les
  // groupes où il apparaît (eleves_groupes, reflété dans groupes[].eids), pas un seul.
  const matieresDe = eid => {
    const gs = groupes.filter(g => (g.eids || []).includes(eid));
    return gs.length ? gs.map(g => g.matiere).join(" + ") : "Sans groupe";
  };
  const handleSave = async form => {
    try {
      if (sel?.id) {
        await onUpdate(sel.id, form);
        showToast(`${form.prenom} modifié ✓`);
        setSel({
          ...sel,
          ...form
        });
        setVue("fiche");
      } else {
        await onCreate(form);
        showToast(`${form.prenom} ajouté ✓`);
        setVue("liste");
        setSel(null);
      }
    } catch (e) {
      alert("Erreur : " + e.message);
    }
  };
  const handleToggle = async () => {
    try {
      const nextActif = !sel.actif;
      await onToggle(sel.id, nextActif);
      setSel({
        ...sel,
        actif: nextActif
      });
    } catch (e) {
      alert("Erreur : " + e.message);
    }
  };
  if (vue === "form") return /*#__PURE__*/React.createElement(FormulaireEleve, {
    initial: sel,
    groupes: groupes,
    onSave: handleSave,
    onCancel: () => setVue(sel?.id ? "fiche" : "liste")
  });
  if (vue === "fiche" && sel) return /*#__PURE__*/React.createElement(FicheEleve, {
    eleve: sel,
    groupeNom: matieresDe(sel.id),
    onEdit: () => setVue("form"),
    onBack: () => {
      setVue("liste");
      setSel(null);
    },
    onToggle: handleToggle
  });
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
  }, toast), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr 1fr",
      gap: 8,
      marginBottom: 16
    }
  }, [{
    e: "👤",
    v: actifs.length,
    l: "Actifs",
    c: C.gold
  }, {
    e: "💰",
    v: `${actifs.reduce((s, e) => s + e.th * 8, 0)}€`,
    l: "CA estimé",
    c: C.green
  }, {
    e: "📋",
    v: eleves.length,
    l: "Total",
    c: C.gray
  }].map((s, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      background: "rgba(212,175,55,.08)",
      border: "1px solid rgba(212,175,55,.15)",
      borderRadius: 12,
      padding: "12px 8px",
      textAlign: "center"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 18,
      marginBottom: 2
    }
  }, s.e), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 16,
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
      position: "relative",
      marginBottom: 12
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      position: "absolute",
      left: 12,
      top: "50%",
      transform: "translateY(-50%)",
      color: C.gray
    }
  }, "🔍"), /*#__PURE__*/React.createElement("input", {
    value: search,
    onChange: e => setSearch(e.target.value),
    placeholder: "Rechercher…",
    style: {
      width: "100%",
      background: "rgba(255,255,255,.05)",
      border: "1px solid rgba(212,175,55,.2)",
      borderRadius: 10,
      padding: "10px 12px 10px 36px",
      color: C.cream,
      fontSize: 14,
      fontFamily: "inherit",
      outline: "none",
      boxSizing: "border-box"
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "flex-end",
      marginBottom: 12
    }
  }, /*#__PURE__*/React.createElement(BtnPrimary, {
    label: "+ Ajouter",
    onClick: () => {
      setSel(null);
      setVue("form");
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 10
    }
  }, filtered.map(e => /*#__PURE__*/React.createElement("div", {
    key: e.id,
    onClick: () => {
      setSel(e);
      setVue("fiche");
    },
    style: {
      background: "rgba(255,255,255,.04)",
      border: "1px solid rgba(212,175,55,.12)",
      borderRadius: 14,
      padding: 14,
      cursor: "pointer",
      display: "flex",
      alignItems: "center",
      gap: 12
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
      color: C.gray,
      marginTop: 2
    }
  }, e.niveau, " • ", e.th, "€/h • ", matieresDe(e.id))), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 15,
      fontWeight: 800,
      color: C.gold,
      fontFamily: FD
    }
  }, e.th * 8, "€"), /*#__PURE__*/React.createElement("span", {
    style: {
      color: C.gray,
      fontSize: 16
    }
  }, "›"))), filtered.length === 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "center",
      padding: "40px 0",
      color: C.gray
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 36,
      marginBottom: 12
    }
  }, "🎓"), /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 12,
      fontSize: 13
    }
  }, "Aucun élève pour l'instant — les inscriptions démarrent à la rentrée."), /*#__PURE__*/React.createElement(BtnPrimary, {
    label: "+ Ajouter un élève",
    onClick: () => {
      setSel(null);
      setVue("form");
    }
  }))));
}
