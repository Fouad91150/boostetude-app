// ─── ATOMES ──────────────────────────────────────────────────
// Les briques de l'interface, toutes taillées sur le même patron : une surface
// blanche, un bord fin, un coin arrondi de 12, une ombre à peine perceptible.
// C'est la répétition de ce patron qui fait qu'un écran jamais vu paraît connu.
//
// Les corps de texte ne descendent pas sous 12,5 px et les champs de saisie
// restent à 16 px : en dessous, le téléphone zoome tout seul au moment où on
// touche le champ, et l'écran saute sous le doigt.

// Initiales dans un rond, pour reconnaître un élève sans lire son nom.
function Avatar({ p, n, s }) {
  const size = s || 38;
  const hue = ((p?.charCodeAt(0) || 0) * 37 + (n?.charCodeAt(0) || 0) * 13) % 360;
  return h("div", {
    style: {
      width: size, height: size, borderRadius: "50%", flexShrink: 0,
      background: `hsl(${hue},42%,92%)`,
      border: `1px solid hsl(${hue},38%,80%)`,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.34, fontWeight: 700, color: `hsl(${hue},45%,30%)`
    }
  }, ((p || "")[0] + (n || "")[0]).toUpperCase());
}

// Intitulé d'un champ : court, net, au-dessus de ce qu'il nomme.
function Lbl({ text }) {
  return h("div", {
    style: { fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 5 }
  }, text);
}

// Petit surtitre qui ouvre une section ("À venir", "Terminés").
function Surtitre({ texte, discret }) {
  return h("div", {
    style: {
      fontSize: 11.5, fontWeight: 700, color: discret ? C.grisClair : C.navyL,
      letterSpacing: ".06em", textTransform: "uppercase", margin: "0 0 8px 2px"
    }
  }, texte);
}

// En-tête d'écran : une phrase qui situe, un bouton qui agit.
function EnteteSection({ texte, action }) {
  return h("div", {
    style: {
      display: "flex", justifyContent: "space-between", alignItems: "center",
      gap: 10, flexWrap: "wrap", marginBottom: 14
    }
  },
    h("div", { style: { fontSize: 13.5, color: C.gray, lineHeight: 1.5, flex: 1, minWidth: 150 } }, texte),
    action || null);
}

// La carte, surface élémentaire de l'application.
function Carte({ children, accent, plat, style }) {
  return h("div", {
    style: {
      background: C.surface, border: `1px solid ${C.bord}`,
      borderLeft: accent ? `4px solid ${accent}` : `1px solid ${C.bord}`,
      borderRadius: 12, padding: 14, boxShadow: plat ? "none" : C.ombre,
      ...(style || {})
    }
  }, children);
}

// Une feuille : le plein écran d'un formulaire, posé sur une carte.
function Feuille({ titre, sousTitre, children }) {
  return h("div", null,
    h("div", { style: { marginBottom: 14 } },
      h("div", { style: { fontSize: 21, fontWeight: 700, color: C.texte, fontFamily: FD, lineHeight: 1.2 } }, titre),
      sousTitre ? h("div", { style: { fontSize: 13.5, color: C.gray, marginTop: 3 } }, sousTitre) : null),
    h(Carte, null, children));
}

// L'écran vide : il explique au lieu de laisser perplexe.
function Vide({ icone, titre, texte }) {
  return h("div", {
    style: {
      textAlign: "center", padding: "32px 20px", background: C.surface,
      border: `1px dashed ${C.bordFort}`, borderRadius: 12
    }
  },
    icone ? h("div", { style: { fontSize: 32, marginBottom: 12 } }, icone) : null,
    h("div", { style: { fontSize: 16, fontWeight: 700, color: C.texte, fontFamily: FD, marginBottom: 8 } }, titre),
    h("div", { style: { fontSize: 13.5, color: C.gray, lineHeight: 1.65, maxWidth: 340, margin: "0 auto" } }, texte));
}

// Un chiffre et ce qu'il mesure — la tuile du tableau de bord.
function Mesure({ libelle, valeur, teinte, sur }) {
  return h("div", { style: { flex: 1, minWidth: 78 } },
    h("div", {
      style: {
        fontSize: 11, color: C.gray, textTransform: "uppercase",
        letterSpacing: ".05em", fontWeight: 600, marginBottom: 2
      }
    }, libelle),
    h("div", { style: { fontSize: 18, fontWeight: 700, color: teinte || C.texte, fontFamily: FD, lineHeight: 1.1 } },
      valeur,
      sur ? h("span", { style: { fontSize: 12.5, color: C.gray, fontWeight: 400, fontFamily: FT } }, ` / ${sur}`) : null));
}

// Pastille d'état, en capitales discrètes.
function Puce({ teinte, texte }) {
  return h("span", {
    style: {
      display: "inline-block", fontSize: 10.5, fontWeight: 700, color: teinte,
      letterSpacing: ".06em", textTransform: "uppercase"
    }
  }, texte);
}

// Badge d'une facture. Trois teintes par état : texte franc, fond pâle, bord.
function StatutBadge({ statut }) {
  const cfg = {
    paye: { t: "Payé", cl: C.green, bg: C.greenPale, bd: C.greenBord },
    en_attente: { t: "En attente", cl: C.orange, bg: C.orangePale, bd: C.orangeBord },
    partiel: { t: "Partiel", cl: C.gold, bg: C.goldPale, bd: C.goldBord },
    annulee: { t: "Annulée", cl: C.gray, bg: C.surface2, bd: C.bord },
    impaye: { t: "Impayé", cl: C.red, bg: C.redPale, bd: C.redBord }
  };
  const x = cfg[statut] || cfg.en_attente;
  return h("span", {
    style: {
      fontSize: 12, fontWeight: 600, color: x.cl, background: x.bg,
      border: `1px solid ${x.bd}`, borderRadius: 999, padding: "2px 9px", whiteSpace: "nowrap"
    }
  }, x.t);
}

// Le bouton d'action principal : bleu nuit plein, jamais plus d'un par écran.
function BtnPrimary({ label, onClick, disabled, full }) {
  return h("button", {
    onClick, disabled,
    style: {
      background: disabled ? C.bordFort : C.navy,
      border: `1px solid ${disabled ? C.bordFort : C.navy}`,
      borderRadius: 10, padding: "11px 16px", fontSize: 14.5, fontWeight: 600,
      color: "#fff", cursor: disabled ? "not-allowed" : "pointer", fontFamily: "inherit",
      width: full ? "100%" : "auto", whiteSpace: "nowrap",
      boxShadow: disabled ? "none" : "0 1px 2px rgba(18,28,46,.14)"
    }
  }, label);
}

// Le bouton d'à-côté : blanc, bordé, de même poids visuel qu'un champ.
function BtnSecondary({ label, onClick, full }) {
  return h("button", {
    onClick,
    style: {
      background: C.surface, border: `1px solid ${C.bord}`, borderRadius: 10,
      padding: "11px 16px", fontSize: 14.5, fontWeight: 600, color: C.texte,
      cursor: "pointer", fontFamily: "inherit", width: full ? "100%" : "auto"
    }
  }, label);
}

// Bouton de ligne : la rangée d'actions au pied d'une carte.
function BtnLigne({ label, icone, onClick, teinte, fond, bord, occupe, titre }) {
  return h("button", {
    onClick, disabled: occupe, title: titre || label,
    style: {
      flex: "1 1 46%", minWidth: 120,
      background: fond || C.surface2, border: `1px solid ${bord || C.bord}`,
      borderRadius: 9, padding: "9px 8px", color: teinte || C.texte,
      fontSize: 13, fontWeight: 600, cursor: occupe ? "wait" : "pointer",
      fontFamily: "inherit", display: "inline-flex", alignItems: "center",
      justifyContent: "center", gap: 5
    }
  }, occupe ? "…" : h(React.Fragment, null, icone ? h("span", null, icone) : null, label));
}

function InputText({ label, value, onChange, placeholder, type }) {
  return h("div", { style: { marginBottom: 14 } },
    label ? h(Lbl, { text: label }) : null,
    h("input", {
      type: type || "text",
      value, onChange: e => onChange(e.target.value),
      placeholder: placeholder || "",
      style: {
        width: "100%", background: C.surface, border: `1px solid ${C.bord}`,
        borderRadius: 10, padding: "11px 12px", color: C.texte,
        fontSize: 16, fontFamily: "inherit", outline: "none", boxSizing: "border-box"
      }
    }));
}

function InputArea({ label, value, onChange, placeholder }) {
  return h("div", { style: { marginBottom: 14 } },
    label ? h(Lbl, { text: label }) : null,
    h("textarea", {
      value, onChange: e => onChange(e.target.value),
      placeholder: placeholder || "",
      style: {
        width: "100%", background: C.surface, border: `1px solid ${C.bord}`,
        borderRadius: 10, padding: "11px 12px", color: C.texte,
        fontSize: 16, fontFamily: "inherit", outline: "none",
        boxSizing: "border-box", resize: "vertical", minHeight: 72, lineHeight: 1.5
      }
    }));
}

function SelectInput({ label, value, onChange, options }) {
  return h("div", { style: { marginBottom: 14 } },
    label ? h(Lbl, { text: label }) : null,
    h("select", {
      value, onChange: e => onChange(e.target.value),
      style: {
        width: "100%", background: C.surface, border: `1px solid ${C.bord}`,
        borderRadius: 10, padding: "11px 12px", color: C.texte,
        fontSize: 16, fontFamily: "inherit", outline: "none", boxSizing: "border-box"
      }
    }, options.map(o => h("option", { key: o.v ?? o, value: o.v ?? o }, o.l ?? o))));
}

// Le temps d'ouvrir la base : le nom de la maison, et rien d'autre qui s'agite.
function LoadingScreen({ msg }) {
  return h("div", {
    style: {
      minHeight: "100vh", background: C.fond, display: "flex",
      alignItems: "center", justifyContent: "center"
    }
  },
    h("div", { style: { textAlign: "center" } },
      h("div", { className: "fx-pulse-glow", style: { fontSize: 44, marginBottom: 14 } }, "🎓"),
      h("div", { style: { color: C.navy, fontSize: 23, fontWeight: 700, fontFamily: FD } }, "Boost'Étude"),
      h("div", { style: { color: C.gray, fontSize: 14, marginTop: 8 } }, msg || "Chargement…")));
}
