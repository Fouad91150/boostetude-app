// ─── RÉMUNÉRATION DES PROFESSEURS ────────────────────────────
// Deux comptes sortent de la même feuille d'appel, et il ne faut pas les
// confondre : le parent paie les séances où son enfant était présent ; le
// professeur est payé pour la séance qu'il a assurée, même si deux élèves
// manquaient. C'est la séance qui est due, pas la tête des élèves.
//
// Conséquence directe, à redire aux professeurs : une séance dont l'appel n'a
// pas été fait n'existe nulle part — ni facturée au parent, ni rémunérée.

const TAUX_HORAIRE_DEFAUT = 25;
const HEURES_PAR_SEANCE = 2;

// Les séances effectivement assurées dans le mois, par professeur. Une clé
// d'appel vide (cours créé, appel jamais enregistré) ne compte pas : rien ne
// prouve que la séance a eu lieu.
const seancesDuMois = (profId, ym, appels, groupes) => {
  const siens = (groupes || []).filter(g => g.profId === profId).map(g => g.id);
  if (siens.length === 0) return [];
  return Object.entries(appels || {})
    .filter(([cle, presences]) => {
      const [tag, groupeId, date] = cle.split(":");
      if (tag !== "ap" || !date || !date.startsWith(ym)) return false;
      if (!siens.includes(groupeId)) return false;
      return Object.values(presences || {}).some(Boolean);
    })
    .map(([cle]) => {
      const [, groupeId, date] = cle.split(":");
      const g = (groupes || []).find(x => x.id === groupeId);
      return {
        date, groupeId,
        groupe: g ? g.nom : "Groupe supprimé",
        presents: Object.values(appels[cle] || {}).filter(v => v === "present").length
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date));
};

// Un taux non renseigné vaut 25 €/h ; un taux volontairement mis à zéro reste
// à zéro — un professeur bénévole, cela existe.
const tauxDe = p => {
  if (!p || p.taux_horaire === null || p.taux_horaire === undefined || p.taux_horaire === "") {
    return TAUX_HORAIRE_DEFAUT;
  }
  const t = Number(p.taux_horaire);
  return Number.isFinite(t) && t >= 0 ? t : TAUX_HORAIRE_DEFAUT;
};

const duAuProf = (prof, ym, appels, groupes) => {
  const seances = seancesDuMois(prof.id, ym, appels, groupes);
  const heures = seances.length * HEURES_PAR_SEANCE;
  return { seances, heures, montant: Math.round(heures * tauxDe(prof) * 100) / 100 };
};

// Le récapitulatif qu'on envoie au professeur : ce qu'il a assuré, et ce qu'il
// touche. Détaillé, parce qu'un décompte qu'on ne peut pas vérifier se discute.
const makeRemunerationWhatsApp = (prof, ym, seances, heures, montant, taux) =>
  `*Boost'Étude — ${ml(ym)}*\n\n` +
  `Bonjour ${prof.prenom || ""},\n\n`.replace("  ", " ") +
  `Voici le récapitulatif de tes séances :\n` +
  seances.map(s => `• ${fmtDateCourt(s.date)} — ${s.groupe} (${s.presents} présent${s.presents > 1 ? "s" : ""})`).join("\n") +
  `\n\n` +
  `• ${seances.length} séance${seances.length > 1 ? "s" : ""} de ${HEURES_PAR_SEANCE} h, soit *${heures} h*\n` +
  `• ${montantTxt(taux)}/h\n` +
  `• *Total : ${montantTxt(montant)}*\n\n` +
  `Merci pour ton travail de ce mois-ci.\n` +
  `Fouad Elmkhanter — Boost'Étude`;

function OngletProfesseurs({ profs, groupes, appels, onSaveTaux, onSaveTel }) {
  const [mois, setMois] = useState(nowYM());
  const [edition, setEdition] = useState(null);   // { id, champ, valeur }
  const [deplie, setDeplie] = useState(null);
  const [envoi, setEnvoi] = useState(null);

  // L'exploitant ne figure pas parmi les rémunérations : en micro-entreprise, il
  // ne se verse pas de salaire — il prend le bénéfice. Ses heures restent
  // affichées à part, parce qu'elles disent la charge réelle de la semaine.
  const avecGroupes = p => (groupes || []).some(g => g.profId === p.id);
  const enseignants = (profs || [])
    .filter(p => p.role !== "admin" && avecGroupes(p))
    .map(p => ({ p, ...duAuProf(p, mois, appels, groupes) }))
    .sort((a, b) => b.montant - a.montant);

  const mesHeures = (profs || [])
    .filter(p => p.role === "admin" && avecGroupes(p))
    .reduce((s, p) => s + duAuProf(p, mois, appels, groupes).heures, 0);

  const total = enseignants.reduce((s, x) => s + x.montant, 0);

  const enregistrer = async prof => {
    try {
      if (edition.champ === "taux") {
        const valeur = Number(String(edition.valeur).replace(",", "."));
        if (!Number.isFinite(valeur) || valeur < 0) {
          signalerErreur({ message: "Entrez un taux horaire valide." });
          return;
        }
        await onSaveTaux(prof.id, valeur);
        signalerSucces(`${prof.prenom || "Ce professeur"} : ${montantTxt(valeur)}/h.`);
      } else {
        await onSaveTel(prof.id, edition.valeur);
        signalerSucces(edition.valeur.trim() ? "Numéro enregistré." : "Numéro retiré.");
      }
      setEdition(null);
    } catch (e) {
      signalerErreur(e);
    }
  };

  const envoyer = (prof, seances, heures, montant) => {
    const tel = String(prof.telephone || "").replace(/\s/g, "");
    const texte = makeRemunerationWhatsApp(prof, mois, seances, heures, montant, tauxDe(prof));
    if (tel) {
      window.open(`https://wa.me/${telWhatsApp(tel)}?text=${encodeURIComponent(texte)}`, "_blank", "noopener,noreferrer");
      return;
    }
    // Sans numéro en base, on copie : le message est prêt, il n'y a qu'à le coller.
    try {
      const champ = document.createElement("textarea");
      champ.value = texte;
      document.body.appendChild(champ);
      champ.select();
      document.execCommand("copy");
      champ.remove();
      setEnvoi(prof.id);
      setTimeout(() => setEnvoi(null), 2500);
      signalerInfo("Récapitulatif copié — collez-le dans WhatsApp.");
    } catch (e) {
      signalerErreur({ message: "Copie impossible sur cet appareil." });
    }
  };

  return h("div", null,
    h("div", { style: { fontSize: 13.5, color: C.gray, lineHeight: 1.6, marginBottom: 14 } },
      "Chaque séance dont l'appel a été enregistré compte ", h("strong", null, `${HEURES_PAR_SEANCE} heures`),
      ", quel que soit le nombre d'élèves présents. Une séance sans appel n'est ni facturée au parent, ni rémunérée."),

    h("div", { style: { display: "flex", gap: 6, marginBottom: 14, overflowX: "auto", paddingBottom: 2 } },
      lastMonths(6).map(m => h("button", {
        key: m,
        onClick: () => setMois(m),
        style: {
          background: mois === m ? C.navy : C.surface,
          color: mois === m ? "#fff" : C.gray,
          border: `1px solid ${mois === m ? C.navy : C.bord}`,
          borderRadius: 999, padding: "6px 13px", fontSize: 12.5, fontWeight: 600,
          cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap"
        }
      }, MOIS_C[+m.split("-")[1] - 1]))),

    enseignants.length === 0
      ? h(Vide, {
          icone: "👥", titre: "Aucun professeur à rémunérer",
          texte: "Attribuez un professeur à ses groupes dans l'onglet Appel — c'est ce lien qui permet de compter ses heures."
        })
      : h("div", null,
          h(Carte, { style: { marginBottom: 12 } },
            h("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10 } },
              h("div", { style: { fontSize: 13.5, color: C.gray } }, `À verser pour ${ml(mois)}`),
              h("div", { style: { fontSize: 24, fontWeight: 700, color: C.texte, fontFamily: FD } }, euros(total))),
            mesHeures > 0
              ? h("div", { style: { fontSize: 12.5, color: C.grisClair, marginTop: 6, lineHeight: 1.5 } },
                  `Vos ${mesHeures} heures de cours ne sont pas comptées ici : en micro-entreprise, l'exploitant ne se verse pas de salaire.`)
              : null),

          enseignants.map(({ p, seances, heures, montant }) => {
            const ouvert = deplie === p.id;
            const enEdition = edition && edition.id === p.id;
            return h(Carte, { key: p.id, style: { marginBottom: 10 } },
              h("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 } },
                h("div", { style: { minWidth: 0, flex: 1 } },
                  h("div", { style: { fontSize: 16, fontWeight: 700, color: C.texte, fontFamily: FD } },
                    [p.prenom, p.nom].filter(Boolean).join(" ") || p.email),
                  h("div", { style: { fontSize: 12.5, color: C.gray, marginTop: 3 } },
                    `${seances.length} séance${seances.length > 1 ? "s" : ""} · ${heures} h · ${montantTxt(tauxDe(p))}/h`)),
                h("div", { style: { fontSize: 20, fontWeight: 700, color: montant > 0 ? C.texte : C.grisClair, fontFamily: FD, whiteSpace: "nowrap" } },
                  euros(montant))),

              enEdition
                ? h("div", { style: { display: "flex", gap: 6, alignItems: "center", marginTop: 12 } },
                    h("input", {
                      value: edition.valeur, autoFocus: true,
                      inputMode: edition.champ === "taux" ? "decimal" : "tel",
                      placeholder: edition.champ === "taux" ? "25" : "06 12 34 56 78",
                      onChange: e => setEdition({ id: p.id, champ: edition.champ, valeur: e.target.value }),
                      style: {
                        flex: 1, background: C.surface, border: `1px solid ${C.bord}`, borderRadius: 10,
                        padding: "10px 12px", color: C.texte, fontSize: 16, fontFamily: "inherit",
                        outline: "none", boxSizing: "border-box"
                      }
                    }),
                    h("span", { style: { fontSize: 14, color: C.gray, whiteSpace: "nowrap" } },
                      edition.champ === "taux" ? "€/h" : "☎"),
                    h(BtnPrimary, { label: "OK", onClick: () => enregistrer(p) }),
                    h(BtnSecondary, { label: "✕", onClick: () => setEdition(null) }))
                : h("div", { style: { display: "flex", gap: 6, marginTop: 12, flexWrap: "wrap" } },
                    seances.length > 0
                      ? h(BtnLigne, {
                          label: envoi === p.id ? "Copié" : p.telephone ? "Envoyer sur WhatsApp" : "Copier le récapitulatif",
                          icone: "💬",
                          teinte: "#0b6b37", fond: C.whatsappPale, bord: C.whatsappBord,
                          onClick: () => envoyer(p, seances, heures, montant)
                        })
                      : null,
                    h(BtnLigne, {
                      label: `Taux : ${montantTxt(tauxDe(p))}/h`, icone: "💶",
                      onClick: () => setEdition({ id: p.id, champ: "taux", valeur: String(tauxDe(p)) })
                    }),
                    h(BtnLigne, {
                      label: p.telephone ? "Changer le numéro" : "Ajouter son numéro", icone: "☎",
                      teinte: p.telephone ? C.texte : C.orange,
                      fond: p.telephone ? C.surface2 : C.orangePale,
                      bord: p.telephone ? C.bord : C.orangeBord,
                      onClick: () => setEdition({ id: p.id, champ: "tel", valeur: p.telephone || "" })
                    }),
                    seances.length > 0
                      ? h(BtnLigne, {
                          label: ouvert ? "Masquer le détail" : "Voir le détail",
                          icone: ouvert ? "▴" : "📋",
                          onClick: () => setDeplie(ouvert ? null : p.id)
                        })
                      : null),

              ouvert
                ? h("div", { style: { marginTop: 10 } },
                    seances.map(s => h("div", {
                      key: `${s.groupeId}:${s.date}`,
                      style: {
                        display: "flex", justifyContent: "space-between", gap: 10,
                        padding: "8px 2px", borderBottom: `1px solid ${C.bord}`, fontSize: 13.5
                      }
                    },
                      h("span", { style: { color: C.texte } }, `${fmtDateCourt(s.date)} — ${s.groupe}`),
                      h("span", { style: { color: C.gray, whiteSpace: "nowrap" } },
                        `${s.presents} présent${s.presents > 1 ? "s" : ""}`))))
                : null);
          }),

          h("div", { style: { fontSize: 12.5, color: C.grisClair, lineHeight: 1.6, marginTop: 14 } },
            "Ces montants ne sont pas des factures : ils récapitulent ce que vous devez. ",
            "Un professeur auto-entrepreneur vous adressera sa propre facture — ce décompte sert à la vérifier.")));
}
