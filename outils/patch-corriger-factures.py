import sys, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).parent))
from patcher import appliquer

# ── Pouvoir revenir en arrière ───────────────────────────────────────────────
# Une erreur de saisie — un « payé » cliqué trop vite, une facture émise pour le
# mauvais élève — ne doit pas rester gravée. Mais une facture émise ne s'efface
# pas non plus : son numéro appartient à une séquence qui ne tolère aucun trou.
# D'où l'annulation, qui conserve le numéro et libère les séances.

appliquer("src/app/07-atomes.js", [
    ("""    impaye: {
      t: "Impayé",
      cl: C.red,
      bg: "rgba(224,85,85,.15)",
      bd: "rgba(224,85,85,.4)"
    }
  };""",
     """    partiel: {
      t: "Partiel",
      cl: C.gold,
      bg: "rgba(212,175,55,.15)",
      bd: "rgba(212,175,55,.4)"
    },
    annulee: {
      t: "Annulée",
      cl: C.gray,
      bg: "rgba(255,255,255,.07)",
      bd: "rgba(255,255,255,.18)"
    },
    impaye: {
      t: "Impayé",
      cl: C.red,
      bg: "rgba(224,85,85,.15)",
      bd: "rgba(224,85,85,.4)"
    }
  };"""),
], "(pastilles : partiel et annulée)")


# Une facture annulée ne ferme plus aucune période : ses séances redeviennent
# facturables et rejoignent un nouveau brouillon.
appliquer("src/app/05-facturation-cumulative.js", [
    ("""  const figees = (factures || []).filter(f => f.eleveId === eid && (f.statut === "paye" || f.numero));""",
     """  const figees = (factures || []).filter(f =>
    f.eleveId === eid && f.statut !== "annulee" && (f.statut === "paye" || f.numero));"""),
], "(cumul : une facture annulée libère ses séances)")


appliquer("src/app/03-api-supabase.js", [
    ("""  async supprimerEncaissement(id) {""",
     """  // Annuler, c'est conserver le numéro et sortir le montant du chiffre d'affaires.
  // Supprimer n'est possible que pour un brouillon, qui n'a jamais rien promis.
  async annulerFacture(factureId, motif) {
    const { error } = await sb.rpc("annuler_facture", { p_facture_id: factureId, p_motif: motif || null });
    if (error) throw error;
  },
  async retablirFacture(factureId) {
    const { error } = await sb.rpc("retablir_facture", { p_facture_id: factureId });
    if (error) throw error;
  },
  async supprimerEncaissement(id) {"""),
], "(api : annuler et rétablir une facture)")


appliquer("src/app/20-app.js", [
    ("""  const handleAjouterVersement = async (factureId, versement) => {""",
     """  const handleAnnulerFacture = async (factureId, motif) => {
    await api.annulerFacture(factureId, motif);
    await reloadAll();
  };
  const handleRetablirFacture = async factureId => {
    await api.retablirFacture(factureId);
    await reloadAll();
  };
  const handleAjouterVersement = async (factureId, versement) => {"""),

    ("""    encaissements: encaissements,
    onAjouterVersement: handleAjouterVersement,
    onSupprimerVersement: handleSupprimerVersement
  }),""",
     """    encaissements: encaissements,
    onAjouterVersement: handleAjouterVersement,
    onSupprimerVersement: handleSupprimerVersement,
    onAnnulerFacture: handleAnnulerFacture,
    onRetablirFacture: handleRetablirFacture
  }),"""),
], "(application : annulation et rétablissement transmis)")
