// ─── SUIVI DE SÉANCE ─────────────────────────────────────────
// Un compte-rendu par élève et par séance : ce qui a été travaillé, ce qui a
// bloqué, les progrès, le travail à faire. C'est la matière première du bilan
// hebdomadaire envoyé aux parents.
//
// Contrainte de conception : la saisie se fait à 20 h, debout, en fin de cours,
// pour six élèves d'affilée. Tout est pensé pour tenir en deux minutes — une
// appréciation en un tap, le tronc commun du groupe saisi une seule fois, et
// les notions déjà écrites reproposées en pastilles cliquables.

const NIVEAUX_SEANCE = [
  { k: "excellent", e: "🌟", l: "Excellent", c: "#4caf7d" },
  { k: "bien",      e: "👍", l: "Bien",      c: "#8bc34a" },
  { k: "moyen",     e: "😐", l: "Moyen",     c: "#e09030" },
  { k: "difficile", e: "🧗", l: "Difficile", c: "#e05555" }
];
const niveauSeanceCfg = k => NIVEAUX_SEANCE.find(x => x.k === k) || null;

const estCompteRenduVide = v =>
  !((v.notions || "").trim() || (v.difficultes || "").trim() ||
    (v.progres || "").trim() || (v.devoirs || "").trim() || v.niveau_seance);

function MiniArea({ label, value, onChange, placeholder, rows }) {
  return h("div", { style: { marginBottom: 10 } },
    label && h("div", { style: { fontSize: 10, fontWeight: 700, color: C.gold, letterSpacing: ".8px", textTransform: "uppercase", marginBottom: 4 } }, label),
    h("textarea", {
      value: value || "",
      onChange: e => onChange(e.target.value),
      placeholder: placeholder || "",
      rows: rows || 2,
      style: {
        width: "100%", background: C.surface, border: `1px solid ${C.bord}`,
        borderRadius: 8, padding: "9px 11px", color: C.texte, fontSize: 14, fontFamily: "inherit",
        outline: "none", boxSizing: "border-box", resize: "vertical", lineHeight: 1.5
      }
    })
  );
}

function Suggestions({ items, onPick }) {
  if (!items.length) return null;
  return h("div", { style: { display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 } },
    items.map(t => h("button", {
      key: t,
      onClick: () => onPick(t),
      style: { background: C.navyPale, border: `1px solid ${C.bord}`, borderRadius: 20, padding: "5px 11px", color: C.navyL, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }
    }, "+ " + t))
  );
}

function CarteSuiviEleve({ eleve, valeur, onChange, ouvert, onToggleOuvert, suggestions }) {
  const v = valeur || {};
  const set = (k, val) => onChange({ ...v, [k]: val });
  const cfg = niveauSeanceCfg(v.niveau_seance);
  const rempli = !estCompteRenduVide(v);
  const ajouterNotion = t => set("notions", (v.notions || "").trim() ? `${v.notions.trim()}, ${t}` : t);

  return h("div", {
    style: {
      background: rempli ? C.navyPale : C.surface,
      border: `1px solid ${rempli ? C.goldBord : C.bord}`,
      borderRadius: 14, padding: 13, marginBottom: 10
    }
  },
    h("div", { style: { display: "flex", alignItems: "center", gap: 10, marginBottom: 10 } },
      h(Avatar, { p: eleve.prenom, n: eleve.nom, s: 38 }),
      h("div", { style: { flex: 1, minWidth: 0 } },
        h("div", { style: { fontSize: 15, fontWeight: 800, color: C.texte, fontFamily: FD } }, `${eleve.prenom} ${eleve.nom}`),
        h("div", { style: { fontSize: 11, color: C.gray } }, eleve.niveau)),
      cfg && h("span", { style: { fontSize: 18 } }, cfg.e)
    ),

    h("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 6, marginBottom: 10 } },
      NIVEAUX_SEANCE.map(n => {
        const on = v.niveau_seance === n.k;
        return h("button", {
          key: n.k,
          onClick: () => set("niveau_seance", on ? null : n.k),
          style: {
            background: on ? `${n.c}22` : C.surface,
            border: on ? `2px solid ${n.c}` : `1px solid ${C.bord}`,
            borderRadius: 10, padding: "7px 2px", cursor: "pointer", fontFamily: "inherit",
            display: "flex", flexDirection: "column", alignItems: "center", gap: 2
          }
        },
          h("span", { style: { fontSize: 16 } }, n.e),
          h("span", { style: { fontSize: 9, fontWeight: 700, color: on ? n.c : C.gray } }, n.l));
      })
    ),

    h(MiniArea, {
      label: "Difficultés rencontrées",
      value: v.difficultes,
      onChange: t => set("difficultes", t),
      placeholder: `Ce qui a bloqué ${eleve.prenom} aujourd'hui…`
    }),

    h("button", {
      onClick: onToggleOuvert,
      style: { background: "none", border: "none", color: C.gold, cursor: "pointer", fontSize: 12, fontWeight: 700, fontFamily: "inherit", padding: "2px 0" }
    }, ouvert ? "− Moins de détails" : "+ Notions, progrès, devoirs"),

    ouvert && h("div", { className: "fx-fade-slide-up", style: { marginTop: 10, borderTop: `1px solid ${C.bord}`, paddingTop: 10 } },
      h(Suggestions, { items: suggestions, onPick: ajouterNotion }),
      h(MiniArea, { label: "Travaillé avec cet élève", value: v.notions, onChange: t => set("notions", t), placeholder: "Thalès, équations…" }),
      h(MiniArea, { label: "Progrès / points forts", value: v.progres, onChange: t => set("progres", t), placeholder: "Ce qui a bien marché…" }),
      h(MiniArea, { label: "Travail pour la prochaine fois", value: v.devoirs, onChange: t => set("devoirs", t), placeholder: "Exercices 12 à 15 p. 84" })
    )
  );
}

function ModuleSuivi({ eleves, groupes, appels, comptesRendus, monProfilId, onSave }) {
  const [etape, setEtape] = useState("groupes");
  const [date, setDate] = useState(todayStr());
  const [grp, setGrp] = useState(null);
  const [brouillon, setBrouillon] = useState({});
  const [commun, setCommun] = useState("");
  const [ouvert, setOuvert] = useState(null);
  const [saving, setSaving] = useState(false);

  const elevesMap = {};
  eleves.forEach(e => { elevesMap[e.id] = e; });

  const crsDuJour = (gid, d) => comptesRendus.filter(c => c.groupe_id === gid && c.date === d);
  // Rouvrir un suivi doit montrer ce qui a été écrit, jamais un formulaire vierge.
  const chargerBrouillon = (gid, d) => {
    const deja = {};
    crsDuJour(gid, d).forEach(c => {
      deja[c.eleve_id] = {
        notions: c.notions || "", difficultes: c.difficultes || "",
        progres: c.progres || "", devoirs: c.devoirs || "", niveau_seance: c.niveau_seance || null
      };
    });
    return deja;
  };

  const ouvrirGroupe = g => {
    setGrp(g);
    setBrouillon(chargerBrouillon(g.id, date));
    setCommun("");
    setOuvert(null);
    setEtape("saisie");
  };

  const changerDate = d => {
    setDate(d);
    if (grp) setBrouillon(chargerBrouillon(grp.id, d));
  };

  if (etape === "groupes") {
    return h("div", null,
      h("div", { style: { background: C.navyPale, border: `1px solid ${C.bord}`, borderRadius: 14, padding: 14, marginBottom: 16 } },
        h(Lbl, { text: "Date de la séance" }),
        h("input", {
          type: "date", value: date, onChange: e => setDate(e.target.value),
          style: { width: "100%", background: C.surface, border: `1px solid ${C.bord}`, borderRadius: 8, padding: "10px 12px", color: C.texte, fontSize: 16, fontFamily: "inherit", outline: "none", boxSizing: "border-box", colorScheme: "light" }
        }),
        h("div", { style: { fontSize: 13, color: C.gray, marginTop: 6 } },
          "📅 " + new Date(date).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" }))
      ),
      h(Lbl, { text: "Rédiger le compte-rendu" }),
      h("div", { style: { display: "flex", flexDirection: "column", gap: 10 } },
        groupes.map(g => {
          const nbCR = crsDuJour(g.id, date).length;
          const appelFait = !!appels[`ap:${g.id}:${date}`];
          return h("button", {
            key: g.id,
            onClick: () => ouvrirGroupe(g),
            style: {
              background: nbCR ? C.navyPale : C.surface,
              border: nbCR ? `1.5px solid ${C.bord}` : `1px solid ${C.bord}`,
              borderRadius: 14, padding: 16, cursor: "pointer", fontFamily: "inherit", textAlign: "left"
            }
          },
            h("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 } },
              h("div", null,
                h("div", { style: { fontSize: 17, fontWeight: 800, color: C.texte, fontFamily: FD, marginBottom: 4 } },
                  g.nom, h("span", { style: { fontSize: 11, fontWeight: 700, color: C.gold, marginLeft: 8 } }, g.matiere)),
                h("div", { style: { fontSize: 12, color: C.gray } },
                  horaireLabel(g), " • ", (g.eids || []).length, " élèves", appelFait ? "" : " • appel non fait")),
              nbCR
                ? h("span", { style: { fontSize: 11, fontWeight: 700, color: C.navyL, background: C.navyPale, padding: "4px 10px", borderRadius: 20, whiteSpace: "nowrap" } }, `✓ ${nbCR} rédigé${nbCR > 1 ? "s" : ""}`)
                : h("span", { style: { color: C.gray, fontSize: 20 } }, "›")));
        }),
        groupes.length === 0 && h("div", { style: { textAlign: "center", padding: "30px 0", color: C.gray, fontSize: 13 } }, "Aucun groupe pour l'instant.")
      )
    );
  }

  if (etape === "confirme") {
    return h("div", { className: "fx-fade-slide-up", style: { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "50vh", textAlign: "center", padding: "0 20px" } },
      h("div", { className: "fx-pop-in", style: { width: 80, height: 80, borderRadius: "50%", background: C.navyPale, border: `3px solid ${C.gold}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 40, marginBottom: 20 } }, "📝"),
      h("div", { style: { fontSize: 24, fontWeight: 800, color: C.texte, fontFamily: FD, marginBottom: 6 } }, "Compte-rendu enregistré !"),
      h("div", { style: { fontSize: 14, color: C.gray, marginBottom: 20 } }, `${grp.nom} • ${fmtDateLongue(date)}`),
      h("div", { style: { fontSize: 13, color: C.gray, marginBottom: 24, maxWidth: 300, lineHeight: 1.6 } },
        "Il alimentera automatiquement le bilan hebdomadaire envoyé aux parents."),
      h("div", { style: { display: "flex", flexDirection: "column", gap: 10, width: "100%", maxWidth: 280 } },
        h(BtnSecondary, { label: "✏️ Modifier", onClick: () => setEtape("saisie") }),
        h(BtnPrimary, { label: "← Retour aux groupes", onClick: () => { setEtape("groupes"); setGrp(null); }, full: true }))
    );
  }

  const presMap = appels[`ap:${grp.id}:${date}`] || {};
  const appelFait = Object.keys(presMap).length > 0;
  const listeIds = appelFait ? (grp.eids || []).filter(id => presMap[id] === "present") : (grp.eids || []);

  const suggestions = [...new Set(
    comptesRendus.filter(c => c.groupe_id === grp.id).flatMap(c => splitNotions(c.notions))
  )].slice(0, 8);

  const appliquerATous = () => {
    const t = commun.trim();
    if (!t) return;
    const next = { ...brouillon };
    listeIds.forEach(id => {
      const v = next[id] || {};
      const deja = splitNotions(v.notions).some(x => x.toLowerCase() === t.toLowerCase());
      next[id] = { ...v, notions: deja ? v.notions : ((v.notions || "").trim() ? `${v.notions.trim()}, ${t}` : t) };
    });
    setBrouillon(next);
    setCommun("");
  };

  const enregistrer = async () => {
    setSaving(true);
    try {
      const complet = {};
      listeIds.forEach(id => { complet[id] = brouillon[id] || {}; });
      await onSave(grp.id, date, complet, monProfilId);
      setEtape("confirme");
    } catch (e) {
      signalerErreur(e);
    }
    setSaving(false);
  };

  const nbRemplis = listeIds.filter(id => !estCompteRenduVide(brouillon[id] || {})).length;

  return h("div", null,
    h("div", { style: { display: "flex", alignItems: "center", gap: 8, marginBottom: 12 } },
      h("div", { style: { fontSize: 15, fontWeight: 800, color: C.texte, fontFamily: FD } }, grp.nom),
      h("span", { style: { fontSize: 11, fontWeight: 700, color: C.gold } }, grp.matiere),
      h("button", {
        onClick: () => { setEtape("groupes"); setGrp(null); },
        style: { marginLeft: "auto", background: "none", border: "none", color: C.gold, cursor: "pointer", fontSize: 14, fontFamily: "inherit", fontWeight: 700 }
      }, "← Groupes")
    ),

    h("div", { style: { display: "flex", alignItems: "center", gap: 8, background: C.surface, border: `1px solid ${C.bord}`, borderRadius: 10, padding: "10px 14px", marginBottom: 14 } },
      h("span", { style: { fontSize: 13, color: C.gray } }, "📅"),
      h("input", {
        type: "date", value: date, onChange: e => changerDate(e.target.value),
        style: { flex: 1, background: "transparent", border: "none", color: C.texte, fontSize: 14, fontFamily: "inherit", outline: "none", colorScheme: "light" }
      }),
      h("span", { style: { fontSize: 11, fontWeight: 700, color: nbRemplis ? C.gold : C.gray } }, `${nbRemplis}/${listeIds.length}`)
    ),

    !appelFait && h("div", { style: { background: C.orangePale, border: `1px solid ${C.orangeBord}`, borderRadius: 10, padding: "10px 12px", marginBottom: 14, fontSize: 12, color: C.orange, lineHeight: 1.5 } },
      "L'appel n'a pas encore été fait pour cette séance — tout le groupe est affiché. Faites l'appel d'abord pour ne voir que les présents."),

    h("div", { style: { background: C.navyPale, border: `1px solid ${C.bord}`, borderRadius: 14, padding: 13, marginBottom: 14 } },
      h(Lbl, { text: "Travaillé en séance (tout le groupe)" }),
      h(Suggestions, { items: suggestions, onPick: t => setCommun(commun.trim() ? `${commun.trim()}, ${t}` : t) }),
      h("textarea", {
        value: commun,
        onChange: e => setCommun(e.target.value),
        placeholder: "Théorème de Thalès, exercices d'application…",
        rows: 2,
        style: { width: "100%", background: C.surface, border: `1px solid ${C.bord}`, borderRadius: 8, padding: "9px 11px", color: C.texte, fontSize: 14, fontFamily: "inherit", outline: "none", boxSizing: "border-box", resize: "vertical", marginBottom: 8, lineHeight: 1.5 }
      }),
      h(BtnPrimary, { label: `↓ Appliquer aux ${listeIds.length} élèves`, onClick: appliquerATous, disabled: !commun.trim(), full: true })
    ),

    listeIds.length === 0
      ? h("div", { style: { textAlign: "center", padding: "30px 0", color: C.gray, fontSize: 13 } }, "Aucun élève présent à cette séance.")
      : listeIds.map(id => {
          const e = elevesMap[id];
          return e ? h(CarteSuiviEleve, {
            key: id, eleve: e, valeur: brouillon[id],
            onChange: v => setBrouillon({ ...brouillon, [id]: v }),
            ouvert: ouvert === id,
            onToggleOuvert: () => setOuvert(ouvert === id ? null : id),
            suggestions
          }) : null;
        }),

    listeIds.length > 0 && h("div", { style: { position: "sticky", bottom: 78, paddingTop: 8, background: `linear-gradient(to top, ${C.fond} 62%, transparent)` } },
      h(BtnPrimary, { label: saving ? "Enregistrement…" : "💾 Enregistrer le compte-rendu", onClick: enregistrer, disabled: saving, full: true }))
  );
}
