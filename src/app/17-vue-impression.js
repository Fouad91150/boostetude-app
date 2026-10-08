// ─── VUE IMPRESSION ──────────────────────────────────────────
// La facture telle qu'elle part chez les parents. Deux états bien distincts :
//
//  · BROUILLON — la facture s'alimente encore toute seule depuis la feuille
//    d'appel, chaque séance pointée la fait grossir. Elle n'a pas de numéro et
//    ne doit pas être envoyée.
//  · ÉMISE — le numéro séquentiel est attribué une fois pour toutes par la base
//    (fonction emettre_facture), la date d'émission est figée. Une facture émise
//    ne se renumérote jamais : c'est ce que demande l'administration.
//
// Les mentions légales viennent de la table parametres_entreprise, jamais du
// code : ce fichier est public, l'IBAN n'a rien à y faire.
function champsManquants(p) {
  const requis = [["denomination", "dénomination"], ["exploitant", "nom de l'exploitant"], ["siret", "SIRET"], ["adresse", "adresse"], ["ville", "ville"]];
  return requis.filter(([k]) => !(p && (p[k] || "").trim())).map(([, libelle]) => libelle);
}

function VueImpression({
  facture,
  eleve,
  parametres,
  onClose,
  onDelete,
  onEmettre
}) {
  const [emission, setEmission] = useState(false);
  const p = parametres || {};
  const dates = facture.datesSeances || [];
  const periodeLabelCours = dates.length ? dates.length === 1 ? fmtDateLongue(dates[0].date) : `${fmtDateCourt(dates[0].date)} – ${fmtDateCourt(dates[dates.length - 1].date)}` : "Facture en cours";
  const matieresGroupees = groupParMatiere(dates);
  // Un stage se vend au forfait : une seule ligne, le libellé et son montant.
  const forfait = (facture.prestation || "").trim();
  const periodeForfait = facture.periodeDebut
    ? (facture.periodeFin && facture.periodeFin !== facture.periodeDebut
        ? `Du ${fmtDateCourt(facture.periodeDebut)} au ${fmtDateLongue(facture.periodeFin)}`
        : fmtDateLongue(facture.periodeDebut))
    : "";
  const periodeLabel = forfait ? (periodeForfait || "Forfait") : periodeLabelCours;
  const emise = !!facture.numero;
  const manquants = champsManquants(p);

  const raisonSociale = [p.denomination, p.exploitant && p.exploitant !== p.denomination ? p.exploitant : null].filter(Boolean).join(" — ");
  const mentionEI = (p.forme_juridique || "EI").toUpperCase() === "EI" ? "Entrepreneur individuel" : p.forme_juridique;

  const emettre = async () => {
    if (manquants.length) {
      signalerErreur({ message: "Complétez d'abord vos informations légales dans Réglages : " + manquants.join(", ") });
      return;
    }
    if (!confirm(`Émettre définitivement cette facture de ${facture.montant}€ pour ${eleve.prenom} ?\n\nElle recevra un numéro et ne bougera plus, même si de nouvelles séances sont pointées.`)) return;
    setEmission(true);
    try {
      await onEmettre(facture.id);
    } catch (e) {
      signalerErreur(e);
    }
    setEmission(false);
  };

  const ligneGrise = (contenu, i) => h("div", { key: i, style: { fontSize: 10, color: "#8a8a8a", lineHeight: 1.7 } }, contenu);

  return h("div", { style: { position: "fixed", inset: 0, zIndex: 600, background: C.fond, overflowY: "auto" } },
    h("div", { className: "zone-facture", style: { maxWidth: 520, margin: "0 auto", padding: "20px 16px 60px" } },

      // ── Barre d'actions (jamais imprimée) ──────────────────
      h("div", { className: "sans-impression", style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, gap: 8 } },
        h("button", {
          onClick: onClose,
          style: { background: C.surface, border: "none", borderRadius: 10, padding: "9px 14px", color: C.gold, cursor: "pointer", fontSize: 14, fontWeight: 700, fontFamily: "inherit" }
        }, "← Retour"),
        h("div", { style: { display: "flex", gap: 8 } },
          onDelete && h("button", {
            onClick: onDelete,
            style: { background: C.redPale, border: `1px solid ${C.redBord}`, borderRadius: 10, padding: "9px 14px", color: C.red, cursor: "pointer", fontSize: 14, fontWeight: 700, fontFamily: "inherit" }
          }, "🗑 Supprimer"),
          h("button", {
            onClick: () => {
              try {
                telechargerBlob(facturePDFBlob(facture, eleve, p), nomFichierFacture(facture, eleve));
                signalerSucces("PDF téléchargé.");
              } catch (e) {
                signalerErreur(e);
              }
            },
            style: { background: C.navy, border: "none", borderRadius: 10, padding: "10px 16px", color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }
          }, "⤓ PDF"),
          h("button", {
            onClick: () => window.print(),
            title: "Imprimer",
            style: { background: C.surface, border: "none", borderRadius: 10, padding: "9px 12px", color: C.gray, cursor: "pointer", fontSize: 14, fontFamily: "inherit" }
          }, "🖨")
        )
      ),

      // ── Brouillon : on ne l'envoie pas, on l'émet d'abord ───
      !emise && h("div", { className: "sans-impression", style: { background: C.orangePale, border: `1px solid ${C.orangeBord}`, borderRadius: 12, padding: 13, marginBottom: 12 } },
        h("div", { style: { fontSize: 13, fontWeight: 800, color: C.orange, marginBottom: 5 } }, "Brouillon — pas encore de numéro"),
        h("div", { style: { fontSize: 12, color: C.gray, lineHeight: 1.6, marginBottom: 10 } },
          "Cette facture grossit automatiquement à chaque séance pointée. Émettez-la pour lui attribuer un numéro définitif et figer son montant — c'est la version que vous pouvez envoyer et déclarer."),
        manquants.length
          ? h("div", { style: { fontSize: 12, color: C.red, lineHeight: 1.6 } },
              "⚠️ Informations légales incomplètes (onglet Réglages) : " + manquants.join(", ") + ".")
          : h(BtnPrimary, { label: emission ? "Émission…" : "🧾 Émettre la facture", onClick: emettre, disabled: emission, full: true })
      ),

      emise && h("div", { className: "sans-impression", style: { background: C.greenPale, border: `1px solid ${C.greenBord}`, borderRadius: 12, padding: "10px 13px", marginBottom: 12, fontSize: 12, color: C.green, lineHeight: 1.6 } },
        `Facture émise le ${fmtDateLongue(facture.dateEmission)} sous le numéro ${facture.numero}. Son montant est figé.`),

      h(PanneauEnvoi, {
        eleve, mois: facture.numero || periodeLabel, nb: facture.nbSeances, montant: facture.montant, dates,
        type: "facture", facture, parametres: p, seuil: p.seuil_facturation
      }),

      // ── La facture elle-même ───────────────────────────────
      h("div", { className: "facture-papier", style: { background: "#fff", borderRadius: 16, padding: "28px 24px", color: "#1a1a1a", fontFamily: "Georgia,serif", marginTop: 14, boxShadow: "0 8px 40px rgba(0,0,0,.4)" } },

        h("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24, gap: 16 } },
          h("div", null,
            h("div", { style: { fontSize: 22, fontWeight: 800, color: C.navy, fontFamily: FD } }, p.denomination || "Boost'Étude"),
            h("div", { style: { fontSize: 11, color: "#666", marginTop: 4, lineHeight: 1.65 } },
              p.exploitant ? h("div", null, p.exploitant, " · ", mentionEI) : null,
              p.adresse ? h("div", null, p.adresse) : null,
              (p.code_postal || p.ville) ? h("div", null, [p.code_postal, p.ville].filter(Boolean).join(" ")) : null,
              p.siret ? h("div", null, "SIRET ", p.siret, p.ape ? ` · APE ${p.ape}` : "") : null,
              p.telephone ? h("div", null, p.telephone) : null,
              p.email ? h("div", null, p.email) : null
            )
          ),
          h("div", { style: { textAlign: "right", flexShrink: 0 } },
            h("div", { style: { fontSize: 10, fontWeight: 700, color: C.gold, letterSpacing: "2px", textTransform: "uppercase" } }, "Facture"),
            h("div", { style: { fontSize: 15, fontWeight: 800, color: emise ? C.navy : "#b02", marginTop: 2 } },
              emise ? "N° " + facture.numero : "BROUILLON"),
            emise && facture.dateEmission
              ? h("div", { style: { fontSize: 11, color: "#777", marginTop: 3 } }, "Émise le ", fmtDateLongue(facture.dateEmission))
              : null,
            h("div", { style: { fontSize: 11, color: "#777", marginTop: 3 } }, periodeLabel)
          )
        ),

        h("div", { style: { height: 2, background: `linear-gradient(90deg,${C.navy},${C.gold})`, marginBottom: 20, borderRadius: 2 } }),

        h("div", { style: { background: "#f8f8f6", borderRadius: 8, padding: "12px 14px", marginBottom: 20 } },
          h("div", { style: { fontSize: 10, fontWeight: 700, color: "#999", letterSpacing: "1.5px", textTransform: "uppercase", marginBottom: 6 } }, "Facturé à"),
          h("div", { style: { fontSize: 15, fontWeight: 700, color: C.navy } }, eleve.parent),
          h("div", { style: { fontSize: 13, color: "#555", marginTop: 3 } },
            "Élève : ", h("strong", null, `${eleve.prenom} ${eleve.nom}`), " — ", eleve.niveau)
        ),

        h("table", { style: { width: "100%", borderCollapse: "collapse", marginBottom: 20, fontSize: 13 } },
          h("thead", null,
            h("tr", { style: { background: C.navy } },
              ["Prestation", "Qté", "Tarif", "Total"].map((entete, i, a) =>
                h("th", {
                  key: entete,
                  style: { padding: "10px 12px", color: "#fff", textAlign: i === 0 ? "left" : "right", borderRadius: i === 0 ? "6px 0 0 6px" : i === a.length - 1 ? "0 6px 6px 0" : "none" }
                }, entete))
            )
          ),
          h("tbody", null,
            forfait
              ? h("tr", null,
                  h("td", { style: { padding: "12px" } },
                    h("div", { style: { fontWeight: 600, color: "#222" } }, forfait),
                    h("div", { style: { fontSize: 11, color: "#888", marginTop: 2 } },
                      `Forfait tout compris${periodeForfait ? ` · ${periodeForfait.toLowerCase()}` : ""}` +
                      (eleve.niveau ? ` · niveau ${eleve.niveau}` : ""))),
                  h("td", { style: { padding: "12px", textAlign: "right", color: "#444" } }, "1"),
                  h("td", { style: { padding: "12px", textAlign: "right", color: "#444" } }, euros(facture.montant)),
                  h("td", { style: { padding: "12px", textAlign: "right", fontWeight: 700, color: C.navy } }, euros(facture.montant)))
            : matieresGroupees.length > 0
              ? matieresGroupees.map((g, i) => {
                  const total = parseFloat((g.dates.length * 2 * eleve.th).toFixed(2));
                  return h("tr", { key: g.matiere, style: { borderBottom: i < matieresGroupees.length - 1 ? "1px solid #eee" : "none" } },
                    h("td", { style: { padding: "12px" } },
                      h("div", { style: { fontWeight: 600, color: "#222" } }, `${g.matiere || "Cours"} — ${eleve.niveau}`),
                      h("div", { style: { fontSize: 11, color: "#888", marginTop: 2 } },
                        `Cours de soutien scolaire en groupe · séances de 2 h · ${g.dates.length} séance${g.dates.length > 1 ? "s" : ""}`),
                      h("div", { style: { fontSize: 11, color: "#999", marginTop: 4, lineHeight: 1.6 } },
                        g.dates.map(d => fmtDateCourt(d)).join(" · "))),
                    h("td", { style: { padding: "12px", textAlign: "right", color: "#444" } }, `${g.dates.length * 2} h`),
                    h("td", { style: { padding: "12px", textAlign: "right", color: "#444" } }, `${euros(eleve.th)}/h`),
                    h("td", { style: { padding: "12px", textAlign: "right", fontWeight: 700, color: C.navy } }, euros(total)));
                })
              : h("tr", null, h("td", { colSpan: 4, style: { padding: "12px", color: "#888", textAlign: "center" } }, "Aucune séance"))
          )
        ),

        h("div", { style: { background: C.navy, borderRadius: 10, padding: "14px 18px", display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 } },
          h("span", { style: { color: "#fff", fontSize: 14, fontWeight: 700 } }, "NET À PAYER"),
          h("span", { style: { color: C.goldVif, fontSize: 28, fontWeight: 700, fontFamily: FD } }, euros(facture.montant))
        ),
        // Mention obligatoire en franchise de TVA : sans elle, la facture est irrégulière.
        h("div", { style: { fontSize: 11, color: "#666", textAlign: "right", marginBottom: 18, fontStyle: "italic" } },
          p.mention_tva || "TVA non applicable, article 293 B du CGI"),

        h("div", { style: { fontSize: 12, color: "#555", borderTop: "1px solid #eee", paddingTop: 12, lineHeight: 1.7 } },
          h("div", null, h("span", { style: { fontWeight: 700, color: "#333" } }, "Règlement : "), eleve.mp,
            facture.statut === "paye" && h("span", { style: { color: "#2e7d4f", fontWeight: 700, marginLeft: 8 } },
              "✅ Payée", facture.datePaiement ? ` le ${new Date(facture.datePaiement).toLocaleDateString("fr-FR")}` : "", ` (${facture.mode})`)),
          p.delai_paiement ? h("div", null, p.delai_paiement) : null,
          (p.iban && facture.statut !== "paye") ? h("div", { style: { marginTop: 8, background: "#f8f8f6", borderRadius: 6, padding: "8px 10px", fontSize: 11, lineHeight: 1.6 } },
            h("div", { style: { fontWeight: 700, color: "#333" } }, "Coordonnées bancaires"),
            p.titulaire_compte ? h("div", null, p.titulaire_compte) : null,
            h("div", null, "IBAN ", p.iban),
            p.bic ? h("div", null, "BIC ", p.bic) : null) : null,
          facture.notes ? h("div", { style: { marginTop: 6, fontStyle: "italic", color: "#888" } }, facture.notes) : null
        ),

        // Mentions de pied de facture : pénalités, escompte, identité complète.
        h("div", { style: { marginTop: 18, paddingTop: 12, borderTop: "1px solid #f0f0f0" } },
          [
            p.penalites_retard,
            p.escompte,
            [raisonSociale || "Boost'Étude", mentionEI, p.siret ? "SIRET " + p.siret : null, p.ape ? "APE " + p.ape : null]
              .filter(Boolean).join(" · ")
          ].filter(Boolean).map(ligneGrise)
        )
      )
    )
  );
}
