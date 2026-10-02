import sys, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).parent))
from patcher import appliquer

# ── Réglages : le rythme de facturation devient un réglage ───────────────────
appliquer("src/app/19b-reglages.js", [
    ("""    h("div", { style: { borderTop: "1px solid rgba(212,175,55,.1)", paddingTop: 14 } },
      h(Lbl, { text: "Mentions de facturation" }),
      h(InputText, { label: "Préfixe des numéros", value: f.prefixe_facture || "", onChange: v => set("prefixe_facture", v), placeholder: "F" }),""",

     """    h("div", { style: { borderTop: "1px solid rgba(212,175,55,.1)", paddingTop: 14 } },
      h(Lbl, { text: "Rythme de facturation" }),
      h(InputText, {
        label: "Facturer toutes les … séances",
        value: String(f.seuil_facturation == null ? SEUIL_FACTURATION_DEFAUT : f.seuil_facturation),
        onChange: v => set("seuil_facturation", v.replace(/\\D/g, "").slice(0, 2)),
        placeholder: "3", type: "tel"
      }),
      h("div", { style: { fontSize: 11, color: C.gray, marginTop: -8, marginBottom: 14, lineHeight: 1.5 } },
        "Au-delà de ce nombre de séances suivies, l'élève est signalé dans Facturation. " +
        "Le chiffre apparaît aussi dans le message au parent : « envoyé toutes les " +
        (f.seuil_facturation || SEUIL_FACTURATION_DEFAUT) + " séances »."),
      h(Lbl, { text: "Mentions de facturation" }),
      h(InputText, { label: "Préfixe des numéros", value: f.prefixe_facture || "", onChange: v => set("prefixe_facture", v), placeholder: "F" }),"""),
], "(réglages : seuil de facturation)")


# ── La facture passe au panneau d'envoi de quoi fabriquer le PDF ─────────────
appliquer("src/app/17-vue-impression.js", [
    ("""      h(PanneauEnvoi, { eleve, mois: periodeLabel, nb: facture.nbSeances, montant: facture.montant, dates, type: "facture" }),""",
     """      h(PanneauEnvoi, {
        eleve, mois: periodeLabel, nb: facture.nbSeances, montant: facture.montant, dates,
        type: "facture", facture, parametres: p, seuil: p.seuil_facturation
      }),"""),

    # Le bouton « PDF » lançait l'impression du navigateur, qui donne un résultat
    # inégal selon l'appareil. Il produit maintenant le fichier lui-même.
    ("""          h("button", {
            onClick: () => window.print(),
            style: { background: `linear-gradient(135deg,${C.gold},${C.goldD})`, border: "none", borderRadius: 10, padding: "9px 16px", color: C.navy, fontSize: 14, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }
          }, "🖨 PDF")""",
     """          h("button", {
            onClick: () => {
              try {
                telechargerBlob(facturePDFBlob(facture, eleve, p), nomFichierFacture(facture, eleve));
                signalerSucces("PDF téléchargé.");
              } catch (e) {
                signalerErreur(e);
              }
            },
            style: { background: `linear-gradient(135deg,${C.gold},${C.goldD})`, border: "none", borderRadius: 10, padding: "9px 16px", color: C.navy, fontSize: 14, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }
          }, "⤓ PDF"),
          h("button", {
            onClick: () => window.print(),
            title: "Imprimer",
            style: { background: "rgba(255,255,255,.08)", border: "none", borderRadius: 10, padding: "9px 12px", color: C.gray, cursor: "pointer", fontSize: 14, fontFamily: "inherit" }
          }, "🖨")"""),
], "(facture : PDF fabriqué par l'application, panneau d'envoi complet)")
