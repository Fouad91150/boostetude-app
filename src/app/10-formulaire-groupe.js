// ─── FORMULAIRE GROUPE ────────────────────────────────────────
function FormulaireGroupe({
  initial,
  profs,
  onSave,
  onCancel
}) {
  const def = initial || {
    nom: "",
    niveau: "6ème",
    matiere: "Mathématiques",
    jour: "",
    hd: "",
    hf: "",
    max: 6,
    profText: "",
    profId: ""
  };
  // Liste fermée (MATIERES) pour que le regroupement par matière sur la facture soit fiable —
  // "Autre" ouvre un champ libre pour les matières hors liste, mémorisé tel quel.
  const matiereInit = MATIERES.includes(def.matiere) ? def.matiere : def.matiere ? "Autre" : "Mathématiques";
  const [nom, setNom] = useState(def.nom);
  const [niveau, setNiveau] = useState(def.niveau);
  const [matiereSel, setMatiereSel] = useState(matiereInit);
  const [matiereAutre, setMatiereAutre] = useState(matiereInit === "Autre" ? def.matiere : "");
  const matiere = matiereSel === "Autre" ? matiereAutre.trim() : matiereSel;
  const [jour, setJour] = useState(def.jour);
  const [hd, setHd] = useState(def.hd);
  const [hf, setHf] = useState(def.hf);
  const [max, setMax] = useState(def.max);
  const [profText, setProfText] = useState(def.profText);
  const [profId, setProfId] = useState(def.profId || "");
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    try {
      await onSave({
        id: initial?.id,
        nom,
        niveau,
        matiere,
        jour,
        hd,
        hf,
        max,
        profText,
        profId: profId || null
      });
    } finally {
      setSaving(false);
    }
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "0 4px"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 20,
      fontWeight: 800,
      color: C.texte,
      fontFamily: FD,
      marginBottom: 20
    }
  }, initial?.id ? "Modifier le groupe" : "Nouveau groupe"), /*#__PURE__*/React.createElement(InputText, {
    label: "Nom du groupe *",
    value: nom,
    onChange: setNom,
    placeholder: "Collège Maths A"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: "0 12px"
    }
  }, /*#__PURE__*/React.createElement(SelectInput, {
    label: "Niveau",
    value: niveau,
    onChange: setNiveau,
    options: NIVEAUX
  }), /*#__PURE__*/React.createElement(SelectInput, {
    label: "Matière",
    value: matiereSel,
    onChange: setMatiereSel,
    options: MATIERES
  })), matiereSel === "Autre" && /*#__PURE__*/React.createElement(InputText, {
    label: "Préciser la matière",
    value: matiereAutre,
    onChange: setMatiereAutre,
    placeholder: "ex. Musique"
  }), /*#__PURE__*/React.createElement(SelectInput, {
    label: "Jour",
    value: jour,
    onChange: setJour,
    options: [{
      v: "",
      l: "— À définir —"
    }, ...JOURS]
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: "0 12px"
    }
  }, /*#__PURE__*/React.createElement(InputText, {
    label: "Heure début",
    value: hd,
    onChange: setHd,
    type: "time"
  }), /*#__PURE__*/React.createElement(InputText, {
    label: "Heure fin",
    value: hf,
    onChange: setHf,
    type: "time"
  })), /*#__PURE__*/React.createElement(InputText, {
    label: "Capacité max",
    value: String(max),
    onChange: v => setMax(parseInt(v) || 6),
    type: "number"
  }), profs && profs.length > 0 && /*#__PURE__*/React.createElement(SelectInput, {
    label: "Professeur assigné (accès à ce groupe)",
    value: profId,
    onChange: setProfId,
    options: [{
      v: "",
      l: "— Non assigné —"
    }, ...profs.map(p => ({
      v: p.id,
      l: `${p.prenom} ${p.nom}${p.role === "admin" ? " (admin)" : ""}`
    }))]
  }), /*#__PURE__*/React.createElement(InputText, {
    label: "Professeur (nom affiché, optionnel)",
    value: profText,
    onChange: setProfText,
    placeholder: "Nom du professeur"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 10,
      marginTop: 8
    }
  }, /*#__PURE__*/React.createElement(BtnPrimary, {
    label: saving ? "…" : initial?.id ? "💾 Enregistrer" : "✅ Créer",
    onClick: save,
    disabled: !nom.trim() || matiereSel === "Autre" && !matiereAutre.trim() || saving
  }), /*#__PURE__*/React.createElement(BtnSecondary, {
    label: "Annuler",
    onClick: onCancel
  })));
}
