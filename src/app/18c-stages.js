// ─── STAGES DE VACANCES ──────────────────────────────────────
// Un stage ne se compte pas en séances : il se vend au forfait, sur une semaine
// de vacances, à un groupe constitué pour l'occasion. Il lui fallait donc son
// propre écran — mais surtout pas sa propre facturation : inscrire un élève crée
// une facture ordinaire, qui repart dans Factures avec sa numérotation, ses
// versements, ses relances et son envoi en un clic.

// Les trois forfaits de l'offre. Le champ reste libre : un stage plus court ou
// plus long se chiffre à la main sans toucher au code.
const FORFAITS_STAGE = [149, 189, 229];

const etatStage = s => {
  const t = todayStr();
  if (s.dateFin && s.dateFin < t) return { k: "termine", l: "Terminé", cl: C.gray, bg: C.surface, bd: C.bord };
  if (s.dateDebut && s.dateDebut > t) return { k: "avenir", l: "À venir", cl: C.blue, bg: C.surface, bd: C.blueBord };
  return { k: "encours", l: "En cours", cl: C.green, bg: C.surface, bd: C.greenBord };
};

const periodeStage = s => {
  if (!s.dateDebut) return "Dates à définir";
  if (!s.dateFin || s.dateFin === s.dateDebut) return fmtDateLongue(s.dateDebut);
  return `${fmtDateCourt(s.dateDebut)} → ${fmtDateLongue(s.dateFin)}`;
};

// L'argent d'un stage : ce que valent les inscriptions, ce qui est déjà facturé,
// ce qui est rentré. Une facture annulée ne compte pas — et rend l'inscription
// de nouveau facturable, sinon une erreur de saisie serait sans retour.
const bilanStage = (stage, inscrits, factures) => {
  const ins = (inscrits || []).filter(i => i.stageId === stage.id);
  const fs = (factures || []).filter(f => f.stageId === stage.id && f.statut !== "annulee");
  const attendu = ins.reduce((s, i) => s + (Number(i.tarif) || 0), 0);
  const facture = fs.reduce((s, f) => s + (Number(f.montant) || 0), 0);
  const encaisse = fs.reduce((s, f) => s + (Number(f.encaisse) || 0), 0);
  const aFacturer = ins.filter(i => !i.factureId || !fs.find(f => f.id === i.factureId));
  return {
    ins, attendu, facture, encaisse,
    reste: Math.max(0, Math.round((facture - encaisse) * 100) / 100),
    aFacturer
  };
};

// ── Formulaire ───────────────────────────────────────────────
function FormulaireStage({ initial, onSave, onCancel }) {
  const def = initial || {
    nom: "", niveau: "3ème", matiere: "Mathématiques",
    dateDebut: todayStr(), dateFin: todayStr(), horaire: "10h–12h",
    tarif: 189, places: 8, notes: ""
  };
  const [nom, setNom] = useState(def.nom);
  const [niveau, setNiveau] = useState(def.niveau || "3ème");
  const [matiere, setMatiere] = useState(def.matiere || "Mathématiques");
  const [dateDebut, setDateDebut] = useState(def.dateDebut || todayStr());
  const [dateFin, setDateFin] = useState(def.dateFin || todayStr());
  const [horaire, setHoraire] = useState(def.horaire || "");
  const [tarif, setTarif] = useState(String(def.tarif ?? 189));
  const [places, setPlaces] = useState(String(def.places ?? 8));
  const [notes, setNotes] = useState(def.notes || "");
  const [saving, setSaving] = useState(false);

  const tarifNum = Number(String(tarif).replace(",", ".")) || 0;
  const datesIncoherentes = dateDebut && dateFin && dateFin < dateDebut;
  const pret = nom.trim() && dateDebut && dateFin && !datesIncoherentes && tarifNum > 0;

  const save = async () => {
    setSaving(true);
    try {
      await onSave({
        id: initial?.id, nom: nom.trim(), niveau, matiere,
        dateDebut, dateFin, horaire: horaire.trim(),
        tarif: tarifNum, places: Number(places) || 8, notes: notes.trim()
      });
    } finally {
      setSaving(false);
    }
  };

  return h(Feuille, { titre: initial?.id ? "Modifier le stage" : "Nouveau stage" },
    h(InputText, {
      label: "Nom du stage *", value: nom, onChange: setNom,
      placeholder: "Stage Toussaint — révisions brevet"
    }),
    h("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 } },
      h(SelectInput, { label: "Niveau", value: niveau, onChange: setNiveau, options: NIVEAUX }),
      h(SelectInput, { label: "Matière", value: matiere, onChange: setMatiere, options: MATIERES })),
    h("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 } },
      h(InputText, { label: "Du *", value: dateDebut, onChange: setDateDebut, type: "date" }),
      h(InputText, { label: "Au *", value: dateFin, onChange: setDateFin, type: "date" })),
    datesIncoherentes
      ? h("div", { style: { fontSize: 12.5, color: C.red, marginTop: -6, marginBottom: 12 } },
          "La date de fin précède la date de début.")
      : null,
    h(InputText, { label: "Horaire", value: horaire, onChange: setHoraire, placeholder: "10h–12h et 14h–16h" }),

    h(Lbl, { text: "Forfait par élève *" }),
    h("div", { style: { display: "flex", gap: 6, marginBottom: 10 } },
      FORFAITS_STAGE.map(v => h("button", {
        key: v,
        onClick: () => setTarif(String(v)),
        style: {
          flex: 1,
          background: tarifNum === v ? C.navy : C.surface,
          border: `1px solid ${tarifNum === v ? C.navy : C.bord}`,
          borderRadius: 10, padding: "10px 4px",
          color: tarifNum === v ? "#fff" : C.texte,
          fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit"
        }
      }, `${v} €`))),
    h(InputText, { label: null, value: tarif, onChange: setTarif, placeholder: "189" }),

    h("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 } },
      h(InputText, { label: "Places", value: places, onChange: setPlaces, type: "number" }),
      h("div", { style: { marginBottom: 14 } },
        h(Lbl, { text: "Recette si complet" }),
        h("div", {
          style: {
            padding: "11px 12px", borderRadius: 10, background: C.navyPale,
            border: `1px solid ${C.bord}`, color: C.gold, fontWeight: 700,
            fontSize: 15, fontFamily: FD
          }
        }, euros(tarifNum * (Number(places) || 0))))),
    h(InputArea, { label: "Notes", value: notes, onChange: setNotes, placeholder: "Programme, salle, matériel…" }),

    h("div", { style: { display: "flex", gap: 10, marginTop: 6 } },
      h(BtnSecondary, { label: "Annuler", onClick: onCancel, full: true }),
      h(BtnPrimary, { label: saving ? "…" : initial?.id ? "Enregistrer" : "Créer le stage", onClick: save, disabled: !pret || saving, full: true })));
}

// ── Inscription d'un élève ───────────────────────────────────
function ChoixEleve({ stage, eleves, dejaInscrits, onInscrire, onCancel }) {
  const [recherche, setRecherche] = useState("");
  const [tarif, setTarif] = useState(String(stage.tarif));
  const [enCours, setEnCours] = useState(null);

  const q = recherche.trim().toLowerCase();
  const dispo = (eleves || [])
    .filter(e => !dejaInscrits.includes(e.id))
    .filter(e => !q || `${e.prenom} ${e.nom} ${e.niveau}`.toLowerCase().includes(q))
    .sort((a, b) => (a.nom || "").localeCompare(b.nom || ""));

  const inscrire = async el => {
    setEnCours(el.id);
    try {
      await onInscrire(stage.id, el.id, Number(String(tarif).replace(",", ".")) || stage.tarif);
      signalerSucces(`${el.prenom} est inscrit au stage.`);
    } catch (e) {
      signalerErreur(e);
    }
    setEnCours(null);
  };

  return h(Feuille, { titre: "Inscrire au stage", sousTitre: stage.nom },
    h(InputText, { label: "Forfait appliqué", value: tarif, onChange: setTarif, placeholder: String(stage.tarif) }),
    h("div", { style: { fontSize: 12.5, color: C.gray, marginTop: -8, marginBottom: 14, lineHeight: 1.5 } },
      "Modifiable avant chaque inscription — pour une remise fratrie ou un stage partiel."),
    h(InputText, { label: "Rechercher", value: recherche, onChange: setRecherche, placeholder: "Nom de l'élève" }),

    dispo.length === 0
      ? h("div", { style: { fontSize: 13.5, color: C.gray, textAlign: "center", padding: "20px 10px" } },
          q ? "Aucun élève ne correspond." : "Tous les élèves sont déjà inscrits.")
      : h("div", { style: { display: "flex", flexDirection: "column", gap: 6, maxHeight: 340, overflowY: "auto" } },
          dispo.map(el => h("button", {
            key: el.id,
            onClick: () => inscrire(el),
            disabled: enCours === el.id,
            style: {
              display: "flex", alignItems: "center", gap: 10, textAlign: "left",
              background: C.surface, border: `1px solid ${C.bord}`,
              borderRadius: 10, padding: "9px 11px", cursor: "pointer", fontFamily: "inherit",
              color: C.texte, opacity: enCours === el.id ? 0.5 : 1
            }
          },
            h(Avatar, { p: el.prenom, n: el.nom, s: 32 }),
            h("div", { style: { minWidth: 0, flex: 1 } },
              h("div", { style: { fontSize: 14, fontWeight: 600 } }, `${el.prenom} ${el.nom}`),
              h("div", { style: { fontSize: 12, color: C.gray } }, el.niveau)),
            h("div", { style: { fontSize: 20, color: C.navyL, fontWeight: 700 } }, enCours === el.id ? "…" : "+")))),

    h("div", { style: { marginTop: 14 } }, h(BtnSecondary, { label: "Fermer", onClick: onCancel, full: true })));
}

// ── Écran principal ─────────────────────────────────────────
function ModuleStages({
  stages, inscrits, eleves, factures,
  onSaveStage, onSupprimerStage, onInscrire, onDesinscrire, onFacturerStage
}) {
  const [vue, setVue] = useState({ k: "liste" });
  const [ouvert, setOuvert] = useState(null);
  const [facturation, setFacturation] = useState(null);

  const eleveDe = id => (eleves || []).find(e => e.id === id);

  const enregistrer = async form => {
    try {
      await onSaveStage(form);
      signalerSucces(form.id ? "Stage modifié." : "Stage créé.");
      setVue({ k: "liste" });
    } catch (e) {
      signalerErreur(e);
    }
  };

  const facturer = async stage => {
    const { aFacturer } = bilanStage(stage, inscrits, factures);
    if (aFacturer.length === 0) return;
    const total = aFacturer.reduce((s, i) => s + (Number(i.tarif) || 0), 0);
    if (!confirm(`Créer ${aFacturer.length} facture${aFacturer.length > 1 ? "s" : ""} de stage, soit ${euros(total)} ?\n\n` +
                 `Elles apparaîtront dans Factures, prêtes à être émises et envoyées.`)) return;
    setFacturation(stage.id);
    try {
      const n = await onFacturerStage(stage, aFacturer);
      signalerSucces(`${n} facture${n > 1 ? "s" : ""} créée${n > 1 ? "s" : ""} — à émettre dans Factures.`);
    } catch (e) {
      signalerErreur(e);
    }
    setFacturation(null);
  };

  // Un stage sans inscrit se supprime ; dès qu'un élève y figure, il faut le
  // retirer d'abord — on n'efface pas une ligne dont dépend une facture.
  const supprimer = async stage => {
    if (!confirm(`Supprimer le stage « ${stage.nom} » ?\n\nCette suppression est définitive.`)) return;
    try {
      await onSupprimerStage(stage.id);
      signalerSucces("Stage supprimé.");
    } catch (e) {
      signalerErreur(e);
    }
  };

  const desinscrire = async (inscription, el) => {
    if (inscription.factureId) {
      signalerErreur({ message: "Cet élève est déjà facturé : annulez d'abord sa facture dans Factures." });
      return;
    }
    if (!confirm(`Retirer ${el ? el.prenom : "cet élève"} du stage ?`)) return;
    try {
      await onDesinscrire(inscription.id);
    } catch (e) {
      signalerErreur(e);
    }
  };

  if (vue.k === "form") {
    return h(FormulaireStage, {
      initial: vue.stage, onSave: enregistrer, onCancel: () => setVue({ k: "liste" })
    });
  }
  if (vue.k === "inscrire") {
    const stage = (stages || []).find(s => s.id === vue.id);
    if (!stage) return h("div", null);
    return h(ChoixEleve, {
      stage, eleves: (eleves || []).filter(e => e.actif !== false),
      dejaInscrits: (inscrits || []).filter(i => i.stageId === stage.id).map(i => i.eleveId),
      onInscrire, onCancel: () => setVue({ k: "liste" })
    });
  }

  const tries = (stages || []).slice().sort((a, b) => (b.dateDebut || "").localeCompare(a.dateDebut || ""));
  const aVenir = tries.filter(s => etatStage(s).k !== "termine");
  const passes = tries.filter(s => etatStage(s).k === "termine");

  const carte = stage => {
    const et = etatStage(stage);
    const b = bilanStage(stage, inscrits, factures);
    const deplie = ouvert === stage.id;
    const complet = b.ins.length >= (stage.places || 0);

    return h("div", {
      key: stage.id,
      style: {
        background: C.surface, border: `1px solid ${C.bord}`, borderLeft: `4px solid ${et.bd}`,
        borderRadius: 12, padding: 14, marginBottom: 10, boxShadow: C.ombre
      }
    },
      h("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 } },
        h("div", { style: { minWidth: 0, flex: 1 } },
          h("div", { style: { fontSize: 17, fontWeight: 700, color: C.texte, fontFamily: FD, lineHeight: 1.25 } }, stage.nom),
          h("div", { style: { fontSize: 13, color: C.gray, marginTop: 4, lineHeight: 1.6 } },
            periodeStage(stage),
            stage.horaire ? h("span", null, ` · ${stage.horaire}`) : null,
            h("br", null),
            `${stage.matiere || "Cours"} · ${stage.niveau || "tous niveaux"}`)),
        h("div", { style: { textAlign: "right", flexShrink: 0 } },
          h(Puce, { teinte: et.cl, texte: et.l }),
          h("div", { style: { fontSize: 20, fontWeight: 700, color: C.texte, fontFamily: FD, marginTop: 6 } }, euros(stage.tarif)),
          h("div", { style: { fontSize: 11.5, color: C.gray } }, "par élève"))),

      h("div", {
        style: {
          display: "flex", gap: 8, marginTop: 12, paddingTop: 12,
          borderTop: `1px solid ${C.bord}`, flexWrap: "wrap"
        }
      },
        h(Mesure, { libelle: "Inscrits", valeur: `${b.ins.length}/${stage.places || "–"}`, teinte: complet ? C.orange : C.texte }),
        h(Mesure, { libelle: "Facturé", valeur: euros(b.facture) }),
        h(Mesure, { libelle: "Encaissé", valeur: euros(b.encaisse), teinte: b.encaisse > 0 ? C.green : C.gray })),

      b.reste > 0
        ? h("div", {
            style: {
              fontSize: 12.5, color: C.orange, background: C.orangePale, border: `1px solid ${C.orangeBord}`,
              borderRadius: 10, padding: "8px 10px", marginTop: 10, fontWeight: 600
            }
          }, `${euros(b.reste)} en attente de règlement — à relancer depuis Factures.`)
        : null,

      h("div", { style: { display: "flex", gap: 6, marginTop: 12, flexWrap: "wrap" } },
        h(BtnLigne, {
          label: "Inscrire un élève", icone: "＋", teinte: C.navyL, fond: C.navyPale, bord: C.blueBord,
          onClick: () => setVue({ k: "inscrire", id: stage.id })
        }),
        b.aFacturer.length > 0
          ? h(BtnLigne, {
              label: `Facturer (${b.aFacturer.length})`, icone: "💰", teinte: C.green,
              fond: C.greenPale, bord: C.greenBord,
              occupe: facturation === stage.id, onClick: () => facturer(stage)
            })
          : null,
        b.ins.length > 0
          ? h(BtnLigne, {
              label: deplie ? "Masquer la liste" : `Voir les ${b.ins.length} inscrits`,
              icone: deplie ? "▴" : "👥", onClick: () => setOuvert(deplie ? null : stage.id)
            })
          : null,
        h(BtnLigne, { label: "Modifier", icone: "✏️", onClick: () => setVue({ k: "form", stage }) }),
        b.ins.length === 0
          ? h(BtnLigne, {
              label: "Supprimer", icone: "🗑",
              teinte: C.red, fond: C.redPale, bord: C.redBord,
              onClick: () => supprimer(stage)
            })
          : null),

      deplie
        ? h("div", { style: { marginTop: 10, display: "flex", flexDirection: "column", gap: 1 } },
            b.ins.map(i => {
              const el = eleveDe(i.eleveId);
              const f = (factures || []).find(x => x.id === i.factureId);
              return h("div", {
                key: i.id,
                style: {
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "9px 2px", borderBottom: `1px solid ${C.bord}`
                }
              },
                h("div", { style: { minWidth: 0, flex: 1 } },
                  h("div", { style: { fontSize: 14, fontWeight: 600, color: C.texte } },
                    el ? `${el.prenom} ${el.nom}` : "Élève supprimé"),
                  h("div", { style: { fontSize: 12, color: C.gray, marginTop: 2 } },
                    euros(i.tarif),
                    f && f.numero ? ` · ${f.numero}` : f ? " · brouillon" : " · pas encore facturé")),
                f ? h(StatutBadge, { statut: f.statut }) : null,
                !i.factureId
                  ? h("button", {
                      onClick: () => desinscrire(i, el),
                      title: "Retirer du stage",
                      style: {
                        background: "none", border: "none", color: C.red, fontSize: 16,
                        cursor: "pointer", fontFamily: "inherit", padding: "0 4px"
                      }
                    }, "✕")
                  : null);
            }))
        : null);
  };

  return h("div", null,
    h(EnteteSection, {
      texte: stages && stages.length
        ? `${stages.length} stage${stages.length > 1 ? "s" : ""} · ${(inscrits || []).length} inscription${(inscrits || []).length > 1 ? "s" : ""}`
        : "Les stages de vacances se facturent au forfait.",
      action: h(BtnPrimary, { label: "Nouveau stage", onClick: () => setVue({ k: "form" }) })
    }),

    (stages || []).length === 0
      ? h(Vide, {
          icone: "🏖️", titre: "Aucun stage pour l'instant",
          texte: "Un stage se vend au forfait — 149, 189 ou 229 € — sur une semaine de vacances. " +
                 "Vous inscrivez les élèves, l'application crée leurs factures : elles rejoignent " +
                 "l'onglet Factures avec la numérotation, les versements et les relances habituels."
        })
      : h("div", null,
          aVenir.length > 0
            ? h("div", null, h(Surtitre, { texte: "À venir" }), aVenir.map(carte))
            : null,
          passes.length > 0
            ? h("div", { style: { marginTop: aVenir.length > 0 ? 18 : 0 } },
                h(Surtitre, { texte: "Terminés", discret: true }), passes.map(carte))
            : null));
}
