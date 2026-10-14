// ─── MODALE RÈGLEMENT ────────────────────────────────────────
// Un parent règle rarement d'un coup : cinquante euros en espèces à la sortie du
// cours, le reste par virement la semaine suivante. Et pendant ce temps la facture
// continue de grossir, séance après séance.
//
// Cet écran enregistre donc des VERSEMENTS, pas un état « payé ». Le reste dû s'en
// déduit, et le statut de la facture aussi : en attente, partiellement réglée, ou
// soldée. C'est la base qui fait ce calcul, pour qu'il soit le même partout.
// La carte passe par Stripe et s'enregistre d'elle-même ; elle reste saisissable
// à la main pour un paiement reçu autrement (terminal, lien ancien).
const MODES_REGLEMENT = ["Espèces", "Virement", "Wero", "Carte bancaire"];

function ModaleFacture({
  eleve,
  existante,
  dates,
  encaissements,
  onAjouterVersement,
  onSupprimerVersement,
  onSave,
  onClose
}) {
  const nb = dates.length;
  const total = existante ? Number(existante.montant) || 0 : montantSeances(dates, eleve.th);
  const verses = (encaissements || []).reduce((s, e) => s + e.montant, 0);
  const reste = Math.max(0, Math.round((total - verses) * 100) / 100);

  const [montant, setMontant] = useState(reste > 0 ? String(reste).replace(".", ",") : "");
  const [mode, setMode] = useState(eleve.mp && MODES_REGLEMENT.includes(eleve.mp) ? eleve.mp : "Espèces");
  const [date, setDate] = useState(todayStr());
  const [notes, setNotes] = useState(existante?.notes ?? "");
  const [enCours, setEnCours] = useState(false);

  // « 42,50 » comme « 42.50 » : on accepte les deux façons d'écrire.
  const valeur = parseFloat(String(montant).replace(",", ".").replace(/\s/g, ""));
  const valide = Number.isFinite(valeur) && valeur > 0;

  const enregistrer = async () => {
    if (!valide) {
      signalerInfo("Indiquez le montant que le parent a versé.");
      return;
    }
    setEnCours(true);
    try {
      await onAjouterVersement(existante.id, { montant: valeur, mode, date, note: "" });
      const restant = Math.max(0, Math.round((total - verses - valeur) * 100) / 100);
      signalerSucces(restant > 0
        ? `${euros(valeur)} enregistrés — il reste ${euros(restant)}.`
        : `${euros(valeur)} enregistrés — facture soldée.`);
      setMontant(restant > 0 ? String(restant).replace(".", ",") : "");
    } catch (e) {
      signalerErreur(e);
    }
    setEnCours(false);
  };

  const retirer = async (enc) => {
    if (!window.confirm(`Retirer le versement de ${euros(enc.montant)} du ${fmtDateCourt(enc.date)} ?`)) return;
    try {
      await onSupprimerVersement(enc.id);
      signalerSucces("Versement retiré.");
    } catch (e) {
      signalerErreur(e);
    }
  };

  const enregistrerNotes = async () => {
    if (!onSave || notes === (existante?.notes ?? "")) return;
    try {
      await onSave({ notes });
      signalerSucces("Note enregistrée.");
    } catch (e) {
      signalerErreur(e);
    }
  };

  const ligneSolde = (libelle, valeurTxt, couleur, fort) =>
    h("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "5px 0" } },
      h("span", { style: { fontSize: fort ? 14 : 13, color: fort ? C.texte : C.gray, fontWeight: fort ? 800 : 600 } }, libelle),
      h("span", { style: { fontSize: fort ? 19 : 14, fontWeight: 800, color: couleur, fontFamily: FD } }, valeurTxt));

  return h("div", {
    onClick: e => e.target === e.currentTarget && onClose(),
    style: { position: "fixed", inset: 0, zIndex: 500, background: C.voile, display: "flex", alignItems: "flex-end" }
  },
    h("div", {
      style: {
        width: "100%", background: C.surface, borderRadius: "18px 18px 0 0",
        padding: "24px 20px 44px", maxHeight: "92vh", overflowY: "auto",
        border: `1px solid ${C.bord}`
      }
    },

      h("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 } },
        h("div", null,
          h("div", { style: { fontSize: 19, fontWeight: 800, color: C.texte, fontFamily: FD } }, "Règlement"),
          h("div", { style: { fontSize: 12.5, color: C.gray, marginTop: 2 } },
            `${eleve.prenom} ${eleve.nom}`,
            existante?.numero ? ` • facture ${existante.numero}` : " • brouillon")),
        h("button", {
          onClick: onClose,
          style: { background: C.surface, border: "none", borderRadius: 10, padding: "8px 12px", color: C.gray, cursor: "pointer", fontSize: 14, fontFamily: "inherit" }
        }, "✕")),

      // ── Où en est cette facture ──────────────────────────────
      h("div", { style: { background: C.surface, border: `1px solid ${C.bord}`, borderRadius: 12, padding: "12px 14px", marginBottom: 16 } },
        ligneSolde(`${nb} séance${nb > 1 ? "s" : ""} de 2 h × ${euros(eleve.th)}/h`, euros(total), C.texte),
        verses > 0 ? ligneSolde("Déjà versé", "− " + euros(verses), C.green) : null,
        h("div", { style: { height: 1, background: C.surface, margin: "6px 0" } }),
        ligneSolde(reste > 0 ? "Reste à payer" : "Soldée", euros(reste), reste > 0 ? C.gold : C.green, true)),

      // ── Les versements déjà enregistrés ──────────────────────
      (encaissements || []).length > 0 && h("div", { style: { marginBottom: 16 } },
        h(Lbl, { text: "Versements reçus" }),
        h("div", { style: { display: "flex", flexDirection: "column", gap: 6 } },
          encaissements.map(enc => h("div", {
            key: enc.id,
            style: {
              display: "flex", alignItems: "center", gap: 10,
              background: C.greenPale, border: `1px solid ${C.greenBord}`,
              borderRadius: 10, padding: "9px 12px"
            }
          },
            h("span", { style: { fontSize: 14, fontWeight: 800, color: C.green, fontFamily: FD, minWidth: 72 } }, euros(enc.montant)),
            h("span", { style: { flex: 1, fontSize: 12, color: C.gray } }, `${enc.mode} • ${fmtDateCourt(enc.date)}`),
            h("button", {
              onClick: () => retirer(enc),
              title: "Retirer ce versement",
              style: { background: "none", border: "none", color: C.red, cursor: "pointer", fontSize: 14, fontFamily: "inherit", padding: "2px 4px" }
            }, "✕")))))
      ,

      // ── Enregistrer un versement ─────────────────────────────
      existante
        ? h("div", null,
            h(Lbl, { text: reste > 0 ? "Nouveau versement" : "Versement supplémentaire" }),
            h("div", { style: { display: "flex", gap: 8, marginBottom: 12 } },
              h("div", { style: { flex: 1 } },
                h("input", {
                  type: "text", inputMode: "decimal", value: montant,
                  onChange: e => setMontant(e.target.value),
                  placeholder: reste > 0 ? String(reste).replace(".", ",") : "0",
                  style: {
                    width: "100%", background: C.surface, border: `1px solid ${valide || !montant ? C.bord : C.redBord}`,
                    borderRadius: 10, padding: "12px 14px", color: C.texte, fontSize: 18, fontWeight: 700,
                    fontFamily: FD, outline: "none", boxSizing: "border-box"
                  }
                })),
              h("div", { style: { display: "flex", alignItems: "center", fontSize: 18, fontWeight: 700, color: C.gray, fontFamily: FD } }, "€")),

            h("div", { style: { display: "flex", gap: 6, marginBottom: 12 } },
              MODES_REGLEMENT.map(m => h("button", {
                key: m,
                onClick: () => setMode(m),
                style: {
                  flex: 1, background: mode === m ? C.navyPale : C.surface,
                  border: `1px solid ${mode === m ? C.navyL : C.bord}`,
                  borderRadius: 10, padding: "10px 6px", color: mode === m ? C.navyL : C.gray,
                  cursor: "pointer", fontSize: 13, fontWeight: 700, fontFamily: "inherit"
                }
              }, m))),

            h("div", { style: { marginBottom: 14 } },
              h(Lbl, { text: "Date du versement" }),
              h("input", {
                type: "date", value: date, onChange: e => setDate(e.target.value),
                style: {
                  width: "100%", background: C.surface, border: `1px solid ${C.bord}`,
                  borderRadius: 10, padding: "11px 14px", color: C.texte, fontSize: 14,
                  fontFamily: "inherit", outline: "none", boxSizing: "border-box", colorScheme: "light"
                }
              })),

            h(BtnPrimary, {
              label: enCours ? "Enregistrement…" : "💰 Enregistrer le versement",
              onClick: enregistrer, disabled: enCours || !valide, full: true
            }),

            reste > 0 && valide && Math.abs(valeur - reste) > 0.004
              ? h("div", { style: { fontSize: 12, color: C.gray, marginTop: 8, textAlign: "center", lineHeight: 1.5 } },
                  valeur < reste
                    ? `Après ce versement, il restera ${euros(reste - valeur)}.`
                    : `C'est ${euros(valeur - reste)} de plus que le reste dû.`)
              : null)
        : h("div", { style: { fontSize: 13, color: C.gray, lineHeight: 1.6, padding: "8px 0" } },
            "Cette facture n'existe pas encore : pointez au moins une séance dans l'appel."),

      // ── Note interne ─────────────────────────────────────────
      h("div", { style: { marginTop: 18, paddingTop: 14, borderTop: `1px solid ${C.bord}` } },
        h(InputText, {
          label: "Note (visible sur la facture)",
          value: notes, onChange: setNotes,
          placeholder: "Chèque remis le 3, encaissé le 10…"
        }),
        notes !== (existante?.notes ?? "") && h(BtnSecondary, { label: "Enregistrer la note", onClick: enregistrerNotes, full: true }))
    ));
}
