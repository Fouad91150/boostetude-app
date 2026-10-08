import pathlib, sys

# ── L'onglet « Gérer » devient le poste de correction ────────────────────────
# Il ne proposait qu'une corbeille. Or les erreurs d'une journée de travail sont
# ordinaires : un « payé » cliqué trop vite, une facture émise pour le mauvais
# élève, un versement mal saisi. Chaque facture y offre désormais ce qu'il faut
# pour se corriger — et le partage du PDF, qu'on y cherchait sans le trouver.

CHEMIN = pathlib.Path("src/app/18-module-facturation.js")
DEBUT = "  }, toutes.map(f => {"
FIN = "  }))));\n}"

NOUVEAU = '''  }, toutes.map(f => {
    const e = eleveDe(f.eleveId);
    const periode = f.numero || (f.periodeDebut ? `depuis ${fmtDateCourt(f.periodeDebut)}` : "");
    const emise = !!f.numero;
    const annulee = f.statut === "annulee";
    const verse = Number(f.encaisse) || 0;
    const occupe = envoiEnCours === f.id;

    // Partager une facture déjà émise : le PDF et le message, en un geste.
    const partager = async () => {
      setEnvoiEnCours(f.id);
      try {
        const texte = makeFactureWhatsApp(e, f.numero, f.nbSeances, f.montant, f.datesSeances, seuil);
        const r = await partagerFacturePDF(f, e, parametres, texte);
        if (r.telecharge) signalerInfo("PDF téléchargé — cet appareil ne sait pas partager de fichier.");
        else if (r.partage) signalerSucces(`Facture ${f.numero} envoyée.`);
      } catch (err) {
        signalerErreur(err);
      }
      setEnvoiEnCours(null);
    };

    const annuler = async () => {
      const motif = window.prompt(
        `Annuler la facture ${f.numero} de ${e ? e.prenom : "cet élève"} ?\\n\\n` +
        "Elle gardera son numéro — la numérotation comptable ne tolère pas de trou — " +
        "mais sortira du chiffre d'affaires, et ses séances redeviendront facturables.\\n\\n" +
        "Motif (facultatif) :", "");
      if (motif === null) return;
      try {
        await onAnnulerFacture(f.id, motif);
        signalerSucces(`Facture ${f.numero} annulée.`);
      } catch (err) {
        signalerErreur(err);
      }
    };

    const retablir = async () => {
      try {
        await onRetablirFacture(f.id);
        signalerSucces(verse > 0 ? "Facture rétablie." : "Facture remise en attente de règlement.");
      } catch (err) {
        signalerErreur(err);
      }
    };

    const bouton = (libelle, onClick, couleur, fond, bord) => h("button", {
      onClick, disabled: occupe,
      style: {
        flex: 1, background: fond, border: `1px solid ${bord}`, borderRadius: 9,
        padding: "9px 6px", color: couleur, fontSize: 12.5, fontWeight: 700,
        cursor: occupe ? "wait" : "pointer", fontFamily: "inherit", whiteSpace: "nowrap"
      }
    }, libelle);

    return h("div", {
      key: f.id,
      style: {
        background: annulee ? "rgba(255,255,255,.02)" : "rgba(255,255,255,.04)",
        border: `1px solid ${annulee ? "rgba(255,255,255,.07)" : "rgba(255,255,255,.1)"}`,
        borderRadius: 14, padding: 14, opacity: annulee ? 0.65 : 1
      }
    },
      h("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, marginBottom: 10 } },
        h("div", { style: { minWidth: 0, flex: 1 } },
          h("div", { style: { fontSize: 14, fontWeight: 700, color: C.cream, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } },
            e ? `${e.prenom} ${e.nom}` : "Élève introuvable",
            e && e.actif === false && h("span", {
              style: { marginLeft: 8, fontSize: 10, fontWeight: 700, color: C.red, background: "rgba(224,85,85,.15)", padding: "2px 8px", borderRadius: 20 }
            }, "inactif")),
          h("div", { style: { fontSize: 11, color: C.gray, marginTop: 2 } },
            periode, " • ", f.nbSeances, " séance", f.nbSeances > 1 ? "s" : "",
            verse > 0 ? h("span", { style: { color: C.green } }, ` • ${euros(verse)} versés`) : null)),
        h("div", { style: { textAlign: "right", flexShrink: 0 } },
          h(StatutBadge, { statut: f.statut }),
          h("div", {
            style: {
              fontSize: 15, fontWeight: 800, fontFamily: FD, marginTop: 4,
              color: annulee ? C.gray : C.gold,
              textDecoration: annulee ? "line-through" : "none"
            }
          }, euros(f.montant)))),

      h("div", { style: { display: "flex", gap: 6 } },
        annulee
          ? bouton("↩️ Rétablir", retablir, C.gold, "rgba(212,175,55,.12)", "rgba(212,175,55,.35)")
          : [
              emise && e ? h(React.Fragment, { key: "env" },
                bouton(occupe ? "…" : "📤 Envoyer", partager, C.navy, `linear-gradient(135deg,${C.gold},${C.goldD})`, "transparent")) : null,
              e ? h(React.Fragment, { key: "enc" },
                bouton("💰 Encaisser", () => setModal({ e, f, dates: f.datesSeances || [] }),
                  C.green, "rgba(76,175,125,.1)", "rgba(76,175,125,.3)")) : null,
              emise
                ? h(React.Fragment, { key: "ann" },
                    bouton("↩️ Annuler", annuler, C.gray, "rgba(255,255,255,.05)", "rgba(255,255,255,.12)"))
                : h(React.Fragment, { key: "sup" },
                    bouton("🗑 Supprimer", () => handleDeleteToutes(f), C.red, "rgba(224,85,85,.1)", "rgba(224,85,85,.3)"))
            ]),

      // Dire pourquoi une facture émise ne se supprime pas évite de chercher le bouton.
      emise && !annulee && h("div", { style: { fontSize: 10.5, color: "rgba(255,255,255,.3)", marginTop: 8, lineHeight: 1.5 } },
        "Une facture émise ne se supprime pas : son numéro doit rester dans la séquence. L'annuler la sort du chiffre d'affaires et libère ses séances.")
    );
  }))));
}
'''

texte = CHEMIN.read_text(encoding="utf-8")
i = texte.find(DEBUT)
j = texte.rfind(FIN)
if i == -1 or j == -1 or j < i:
    sys.exit("❌ ancres introuvables — fichier modifié, patch non appliqué")
CHEMIN.write_text(texte[:i] + NOUVEAU, encoding="utf-8")
print("✅ src/app/18-module-facturation.js — onglet Gérer refondu")
