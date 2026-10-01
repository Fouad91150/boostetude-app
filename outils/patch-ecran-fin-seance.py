import pathlib, sys

# L'écran qui suivait l'appel félicitait l'utilisateur et lui proposait un bouton
# vers un autre onglet. Personne ne l'a jamais suivi : zéro compte rendu en un mois.
# Il demande maintenant, là, sur place, ce qui a été travaillé — trois champs et
# deux boutons. Le détail élève par élève reste accessible dans l'onglet Suivi
# pour qui veut nuancer, mais le geste courant tient sur un écran.

CHEMIN = pathlib.Path("src/app/15-module-appel.js")
DEBUT = '  if (etape === "confirme") return /*#__PURE__*/React.createElement("div", {'
FIN = "  const histo = Object.entries(appels)"

NOUVEAU = '''  if (etape === "confirme") {
    const presentsIds = (grp.eids || []).filter(id => pres[id] === "present");
    const dejaEcrits = (comptesRendus || []).filter(c => c.groupe_id === grp.id && c.date === date).length;
    // Les notions déjà saisies pour ce groupe deviennent des raccourcis : un chapitre
    // s'étale sur plusieurs séances, le retaper chaque fois est une corvée inutile.
    const suggestions = [...new Set((comptesRendus || [])
      .filter(c => c.groupe_id === grp.id)
      .flatMap(c => splitNotions(c.notions)))].slice(0, 6);
    const ajouterNotion = t => setTravaille(v => {
      const deja = splitNotions(v).some(x => x.toLowerCase() === t.toLowerCase());
      return deja ? v : (v.trim() ? `${v.trim()}, ${t}` : t);
    });
    const finir = () => {
      setEtape("groupes");
      setGrp(null);
      setTravaille("");
      setDifficultes("");
      setDevoirs("");
    };
    const enregistrerCR = async () => {
      if (!travaille.trim() && !difficultes.trim() && !devoirs.trim()) {
        signalerInfo("Écrivez au moins ce qui a été travaillé.");
        return;
      }
      setSaveCR(true);
      try {
        const parEleve = {};
        presentsIds.forEach(id => {
          parEleve[id] = {
            notions: travaille.trim(),
            difficultes: difficultes.trim(),
            progres: "",
            devoirs: devoirs.trim(),
            niveau_seance: null
          };
        });
        await onSaveComptesRendus(grp.id, date, parEleve, monProfilId);
        signalerSucces("Compte rendu enregistré — il alimentera le bilan aux parents.");
        finir();
      } catch (e) {
        signalerErreur(e);
      }
      setSaveCR(false);
    };

    return h("div", { className: "fx-fade-slide-up" },
      // L'appel est fait : on le dit en une ligne et on passe à la suite.
      h("div", {
        style: {
          background: enAttente ? "rgba(224,150,60,.12)" : "rgba(76,175,125,.1)",
          border: `1px solid ${enAttente ? "rgba(224,150,60,.4)" : "rgba(76,175,125,.35)"}`,
          borderRadius: 12, padding: "12px 14px", marginBottom: 18,
          display: "flex", alignItems: "center", gap: 10
        }
      },
        h("span", { style: { fontSize: 20 } }, enAttente ? "📡" : "✅"),
        h("div", { style: { flex: 1 } },
          h("div", { style: { fontSize: 14, fontWeight: 800, color: C.cream, fontFamily: FD } },
            enAttente ? "Appel gardé sur l'appareil" : "Appel enregistré"),
          h("div", { style: { fontSize: 12, color: C.gray, marginTop: 2 } },
            `${grp.nom} • ${new Date(date).toLocaleDateString("fr-FR", { day: "numeric", month: "long" })} • `,
            h("span", { style: { color: C.green, fontWeight: 700 } }, `${nbP} présent${nbP > 1 ? "s" : ""}`),
            nbAJ > 0 ? h("span", { style: { color: C.orange } }, ` • ${nbAJ} justifié${nbAJ > 1 ? "s" : ""}`) : null,
            nbAN > 0 ? h("span", { style: { color: C.red } }, ` • ${nbAN} absent${nbAN > 1 ? "s" : ""}`) : null)),
        h("button", {
          onClick: () => setEtape("appel"),
          style: { background: "none", border: "none", color: C.gold, cursor: "pointer", fontSize: 12, fontWeight: 700, fontFamily: "inherit", whiteSpace: "nowrap" }
        }, "✏️ Corriger")),

      presentsIds.length === 0
        ? h("div", { style: { textAlign: "center", padding: "20px 0 28px", color: C.gray, fontSize: 13 } },
            "Personne n'était présent : il n'y a pas de compte rendu à écrire.")
        : h("div", null,
            h("div", { style: { fontSize: 20, fontWeight: 800, color: C.cream, fontFamily: FD, marginBottom: 4 } },
              "Qu'avez-vous travaillé ?"),
            h("div", { style: { fontSize: 13, color: C.gray, marginBottom: 16, lineHeight: 1.5 } },
              "Deux lignes suffisent. Elles valent pour les ", presentsIds.length, " élève",
              presentsIds.length > 1 ? "s" : "", " présent", presentsIds.length > 1 ? "s" : "",
              " et nourrissent le bilan envoyé aux parents."),

            dejaEcrits > 0 && h("div", {
              style: { background: "rgba(212,175,55,.1)", border: "1px solid rgba(212,175,55,.3)", borderRadius: 10, padding: "9px 12px", marginBottom: 14, fontSize: 12.5, color: C.cream }
            }, `📝 Un compte rendu existe déjà pour cette séance. L'enregistrer à nouveau le remplacera.`),

            suggestions.length > 0 && h("div", { style: { marginBottom: 12 } },
              h("div", { style: { fontSize: 11, color: C.gray, marginBottom: 6, textTransform: "uppercase", letterSpacing: ".06em", fontWeight: 700 } }, "Déjà vu avec ce groupe"),
              h("div", { style: { display: "flex", flexWrap: "wrap", gap: 6 } },
                suggestions.map(s => h("button", {
                  key: s,
                  onClick: () => ajouterNotion(s),
                  style: { background: "rgba(212,175,55,.1)", border: "1px solid rgba(212,175,55,.3)", borderRadius: 16, padding: "5px 11px", color: C.gold, cursor: "pointer", fontSize: 12, fontWeight: 600, fontFamily: "inherit" }
                }, "+ ", s)))),

            h(InputArea, {
              label: "Travaillé en séance",
              value: travaille,
              onChange: setTravaille,
              placeholder: "Théorème de Pythagore, exercices 12 à 18…"
            }),
            h(InputArea, {
              label: "Difficultés rencontrées (facultatif)",
              value: difficultes,
              onChange: setDifficultes,
              placeholder: "Confusion entre hypoténuse et côté adjacent…"
            }),
            h(InputText, {
              label: "Devoirs pour la prochaine fois (facultatif)",
              value: devoirs,
              onChange: setDevoirs,
              placeholder: "Exercices 20 et 21 page 54"
            }),

            h("div", { style: { display: "flex", flexDirection: "column", gap: 10, marginTop: 4 } },
              h(BtnPrimary, {
                label: saveCR ? "Enregistrement…" : "📝 Enregistrer le compte rendu",
                onClick: enregistrerCR,
                full: true,
                disabled: saveCR
              }),
              onAllerSuivi && h("button", {
                onClick: onAllerSuivi,
                style: { background: "none", border: "none", color: C.gold, cursor: "pointer", fontSize: 13, fontWeight: 700, fontFamily: "inherit", padding: "4px 0" }
              }, "Détailler élève par élève →"))),

      h("div", { style: { marginTop: 18, paddingTop: 16, borderTop: "1px solid rgba(255,255,255,.08)" } },
        h(BtnSecondary, {
          label: presentsIds.length === 0 ? "← Retour aux groupes" : "Passer pour cette fois",
          onClick: finir,
          full: true
        })));
  }
'''

texte = CHEMIN.read_text(encoding="utf-8")
i = texte.find(DEBUT)
j = texte.find(FIN)
if i == -1 or j == -1 or j < i:
    sys.exit("❌ ancres introuvables — le fichier a changé, patch non appliqué")
CHEMIN.write_text(texte[:i] + NOUVEAU + texte[j:], encoding="utf-8")
print("✅ src/app/15-module-appel.js — écran de fin de séance remplacé par la saisie du compte rendu")
