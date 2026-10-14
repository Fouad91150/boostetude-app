// ─── FORMULAIRE ÉLÈVE ────────────────────────────────────────
function FormulaireEleve({
  initial,
  groupes,
  onSave,
  onCancel
}) {
  const def = initial || {
    prenom: "",
    nom: "",
    niveau: "6ème",
    mp: "Virement",
    actif: true,
    email: "",
    tel: "",
    parent: "",
    notes: ""
  };
  // Un élève peut suivre plusieurs matières (ex. Maths + Physique) : on part de tous les
  // groupes où il apparaît déjà (via eleves_groupes, reflété dans groupes[].eids).
  const initialGroupeIds = initial?.id ? groupes.filter(g => (g.eids || []).includes(initial.id)).map(g => g.id) : [];
  const [prenom, setPrenom] = useState(def.prenom);
  const [nom, setNom] = useState(def.nom);
  const [niveau, setNiveau] = useState(def.niveau);
  const [groupeIds, setGroupeIds] = useState(initialGroupeIds);
  const [mp, setMp] = useState(def.mp);
  const [email, setEmail] = useState(def.email);
  const [tel, setTel] = useState(def.tel);
  const [parent, setParent] = useState(def.parent);
  const [notes, setNotes] = useState(def.notes);
  // Nouvel élève : coché d'office (sa 1re séance de chaque matière est offerte).
  const [offert, setOffert] = useState(initial?.id ? initial.premierCoursOffert === true : true);
  const [saving, setSaving] = useState(false);
  const th = TARIFS_H[niveau] ?? 12.5;
  const toggleGroupe = gid => setGroupeIds(ids => ids.includes(gid) ? ids.filter(x => x !== gid) : [...ids, gid]);
  const save = async () => {
    setSaving(true);
    try {
      await onSave({
        id: initial?.id,
        prenom: prenom.trim(),
        nom: nom.trim(),
        niveau,
        mp,
        email,
        tel,
        parent,
        notes,
        premierCoursOffert: offert,
        groupeIds
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
  }, initial?.id ? "Modifier l'élève" : "Nouvel élève"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: "0 12px"
    }
  }, /*#__PURE__*/React.createElement(InputText, {
    label: "Prénom *",
    value: prenom,
    onChange: setPrenom,
    placeholder: "Lucas"
  }), /*#__PURE__*/React.createElement(InputText, {
    label: "Nom *",
    value: nom,
    onChange: setNom,
    placeholder: "Martin"
  })), /*#__PURE__*/React.createElement(SelectInput, {
    label: "Niveau",
    value: niveau,
    onChange: setNiveau,
    options: NIVEAUX
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      background: C.navyPale,
      border: `1px solid ${C.bord}`,
      borderRadius: 10,
      padding: "10px 12px",
      marginBottom: 14,
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12,
      color: C.gray
    }
  }, "Tarif horaire (fixé par niveau)"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 16,
      fontWeight: 800,
      color: C.gold,
      fontFamily: FD
    }
  }, euros(th), "/h")), h("label", {
    style: { display: "flex", alignItems: "center", gap: 10, background: C.greenPale, border: `1px solid ${C.greenBord}`,
      borderRadius: 10, padding: "10px 12px", marginBottom: 14, cursor: "pointer", fontSize: 13.5, color: C.texte }
  }, h("input", { type: "checkbox", checked: offert, onChange: e => setOffert(e.target.checked),
      style: { width: 20, height: 20, accentColor: C.green } }),
    h("span", null, "🎁 ", h("b", null, "Premier cours offert"), " — la 1re séance de chaque matière n'est pas facturée")),
  /*#__PURE__*/React.createElement(Lbl, {
    text: "Groupes suivis (matières)"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 6,
      marginBottom: 14
    }
  }, groupes.map(g => {
    const checked = groupeIds.includes(g.id);
    return /*#__PURE__*/React.createElement("label", {
      key: g.id,
      style: {
        display: "flex",
        alignItems: "center",
        gap: 10,
        background: checked ? C.navyPale : C.surface,
        border: checked ? `1px solid ${C.gold}` : `1px solid ${C.bord}`,
        borderRadius: 10,
        padding: "10px 12px",
        cursor: "pointer"
      }
    }, /*#__PURE__*/React.createElement("input", {
      type: "checkbox",
      checked: checked,
      onChange: () => toggleGroupe(g.id),
      style: {
        width: 16,
        height: 16,
        accentColor: C.gold
      }
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 13,
        fontWeight: 700,
        color: C.texte
      }
    }, g.matiere, " — ", g.nom), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 11,
        color: C.gray
      }
    }, g.jour && g.hd ? `${g.jour} ${g.hd}–${g.hf}` : "Horaire à définir")));
  }), groupes.length === 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: C.gray,
      fontStyle: "italic"
    }
  }, "Aucun groupe créé pour l'instant.")), /*#__PURE__*/React.createElement("div", {
    style: {
      borderTop: `1px solid ${C.bord}`,
      paddingTop: 14,
      marginBottom: 4
    }
  }, /*#__PURE__*/React.createElement(Lbl, {
    text: "Contact parent"
  }), /*#__PURE__*/React.createElement(InputText, {
    label: "Nom parent",
    value: parent,
    onChange: setParent,
    placeholder: "Marie Martin"
  }), /*#__PURE__*/React.createElement(InputText, {
    label: "Téléphone",
    value: tel,
    onChange: setTel,
    placeholder: "06 00 00 00 00",
    type: "tel"
  }), /*#__PURE__*/React.createElement(InputText, {
    label: "Email",
    value: email,
    onChange: setEmail,
    placeholder: "parent@mail.com",
    type: "email"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      borderTop: `1px solid ${C.bord}`,
      paddingTop: 14,
      marginBottom: 4
    }
  }, /*#__PURE__*/React.createElement(Lbl, {
    text: "Facturation"
  }), /*#__PURE__*/React.createElement(SelectInput, {
    label: "Mode de paiement",
    value: mp,
    onChange: setMp,
    options: ["Virement", "Espèces", "Chèque"]
  })), /*#__PURE__*/React.createElement(InputArea, {
    label: "Notes",
    value: notes,
    onChange: setNotes,
    placeholder: "Observations…"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 10,
      marginTop: 8
    }
  }, /*#__PURE__*/React.createElement(BtnPrimary, {
    label: saving ? "…" : initial?.id ? "💾 Enregistrer" : "✅ Ajouter",
    onClick: save,
    disabled: !prenom.trim() || !nom.trim() || saving
  }), /*#__PURE__*/React.createElement(BtnSecondary, {
    label: "Annuler",
    onClick: onCancel
  })));
}
