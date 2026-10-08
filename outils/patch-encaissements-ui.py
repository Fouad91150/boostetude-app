import sys, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).parent))
from patcher import appliquer

appliquer("src/app/18-module-facturation.js", [
    ("""  onEmettreFacture,
  onRecharger
}) {""",
     """  onEmettreFacture,
  onRecharger,
  encaissements,
  onAjouterVersement,
  onSupprimerVersement
}) {"""),

    # La modale n'enregistre plus un statut : elle enregistre des versements.
    ("""  const handleSave = async data => {
    try {
      await onSaveFacture(modal.f?.id || null, modal.e.id, data);
      setModal(null);
      showToast(data.statut === "paye" ? "🎉 Facture payée !" : "Facture enregistrée ✓");
    } catch (e) {
      signalerErreur(e);
    }
  };""",
     """  // Ne reste à enregistrer que la note : le montant vient de l'appel, et le statut
  // se déduit des versements.
  const handleSave = async data => {
    await onSaveFacture(modal.f?.id || null, modal.e.id, { ...modal.f, ...data });
  };
  const encaissementsDe = fid => (encaissements || []).filter(e => e.factureId === fid);"""),

    ("""  }, toast), modal && /*#__PURE__*/React.createElement(ModaleFacture, {
    eleve: modal.e,
    existante: modal.f,
    dates: modal.dates,
    onSave: handleSave,
    onClose: () => setModal(null)
  }),""",
     """  }, toast), modal && /*#__PURE__*/React.createElement(ModaleFacture, {
    eleve: modal.e,
    existante: modal.f,
    dates: modal.dates,
    encaissements: encaissementsDe(modal.f?.id),
    onAjouterVersement: onAjouterVersement,
    onSupprimerVersement: onSupprimerVersement,
    onSave: handleSave,
    onClose: () => setModal(null)
  }),"""),

    # « Marquer payé » devenait faux dès qu'un acompte entrait en jeu.
    ("""      label: "💰 Marquer payé",""", """      label: resteDu(f) < (f?.montant || 0) ? `💰 Reste ${euros(resteDu(f))}` : "💰 Encaisser","""),
    ("""      label: "✅ Marquer payé",""", """      label: "💰 Encaisser","""),
], "(facturation : la modale enregistre des versements)")


appliquer("src/app/20-app.js", [
    ("""  const [comptesRendus, setComptesRendus] = useState([]);""",
     """  const [comptesRendus, setComptesRendus] = useState([]);
  const [encaissements, setEncaissements] = useState([]);"""),

    # Les versements se chargent avec le reste, pour l'administrateur seul.
    ("""      setFactures(fa);
      if (role === "admin") setParametres(await api.fetchParametres());
      setComptesRendus(await api.fetchComptesRendus());""",
     """      setFactures(fa);
      if (role === "admin") {
        setParametres(await api.fetchParametres());
        setEncaissements(await api.fetchEncaissements().catch(() => []));
      }
      setComptesRendus(await api.fetchComptesRendus());"""),

    ("""      setFactures(fa);
      setComptesRendus(await api.fetchComptesRendus());
      setBilans(await api.fetchBilansEnvoyes());
      if (role === "admin") {
        setParametres(await api.fetchParametres());""",
     """      setFactures(fa);
      setComptesRendus(await api.fetchComptesRendus());
      setBilans(await api.fetchBilansEnvoyes());
      if (role === "admin") {
        setEncaissements(await api.fetchEncaissements().catch(() => []));
        setParametres(await api.fetchParametres());"""),

    ("""  const handleEmettreFacture = async (factureId, options) => {""",
     """  const handleAjouterVersement = async (factureId, versement) => {
    await api.ajouterEncaissement(factureId, versement);
    await reloadAll();
  };
  const handleSupprimerVersement = async id => {
    await api.supprimerEncaissement(id);
    await reloadAll();
  };
  const handleEmettreFacture = async (factureId, options) => {"""),

    ("""    onEmettreFacture: handleEmettreFacture,
    onRecharger: reloadAll
  }),""",
     """    onEmettreFacture: handleEmettreFacture,
    onRecharger: reloadAll,
    encaissements: encaissements,
    onAjouterVersement: handleAjouterVersement,
    onSupprimerVersement: handleSupprimerVersement
  }),"""),
], "(application : versements chargés et transmis)")
