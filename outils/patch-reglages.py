import sys, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).parent))
from patcher import appliquer

appliquer("src/app/20-app.js", [
    # État des réglages de l'entreprise.
    ("""  const [factures, setFactures] = useState([]);""",
     """  const [factures, setFactures] = useState([]);
  const [parametres, setParametres] = useState(null);"""),

    # Chargés en même temps que le reste, dans reloadAll…
    ("""      setFactures(fa);
    } catch (e) {""",
     """      setFactures(fa);
      if (role === "admin") setParametres(await api.fetchParametres());
    } catch (e) {"""),

    # … et au premier chargement, après connexion.
    ("""      if (role === "admin") {
        try {
          setProfs(await api.fetchProfs());""",
     """      if (role === "admin") {
        setParametres(await api.fetchParametres());
        try {
          setProfs(await api.fetchProfs());"""),

    # Enregistrement des réglages, émission d'une facture, sauvegarde complète.
    ("""  const handleSaveFacture = async (factureId, eleveId, data) => {""",
     """  const handleSaveParametres = async form => {
    await api.saveParametres(form);
    setParametres(await api.fetchParametres());
  };
  // L'émission attribue le numéro définitif côté base ; on recharge pour
  // que la facture affichée porte tout de suite son numéro.
  const handleEmettreFacture = async factureId => {
    await api.emettreFacture(factureId);
    await reloadAll();
  };
  // Sauvegarde : le plan gratuit de Supabase ne sauvegarde rien de lui-même.
  const handleExportComplet = async () => ({
    exporte_le: new Date().toISOString(),
    version: window.__APP_VERSION || null,
    eleves, groupes, appels, factures,
    comptes_rendus: await api.fetchComptesRendus().catch(() => []),
    bilans_envoyes: await api.fetchBilansEnvoyes().catch(() => [])
  });
  const handleSaveFacture = async (factureId, eleveId, data) => {"""),

    # Onglet Réglages, réservé à l'administrateur.
    ("""  }, {
    k: "factures",
    i: "💰",
    l: "Factures",
    badge: nbImpayes > 0 ? nbImpayes : null
  }] : [{""",
     """  }, {
    k: "factures",
    i: "💰",
    l: "Factures",
    badge: nbImpayes > 0 ? nbImpayes : null
  }, {
    k: "reglages",
    i: "⚙️",
    l: "Réglages",
    badge: conformiteIncomplete ? "!" : null
  }] : [{"""),

    ("""    appel: "Feuille d'appel",
    factures: "Facturation"
  } : {""",
     """    appel: "Feuille d'appel",
    factures: "Facturation",
    reglages: "Réglages"
  } : {"""),

    # Un point d'exclamation sur l'onglet tant que les mentions légales manquent.
    ("""  const nbImpayes = factures.filter(f => f.statut === "en_attente" || f.statut === "impaye").length;""",
     """  const nbImpayes = factures.filter(f => f.statut === "en_attente" || f.statut === "impaye").length;
  const conformiteIncomplete = isAdmin && champsManquants(parametres).length > 0;"""),

    # Routage de l'écran Réglages + transmission des réglages à la facturation.
    ("""    onDeleteFactureEnCours: handleDeleteFactureEnCours
  })), isAdmin &&""",
     """    onDeleteFactureEnCours: handleDeleteFactureEnCours,
    parametres: parametres,
    onEmettreFacture: handleEmettreFacture
  }), tab === "reglages" && isAdmin && /*#__PURE__*/React.createElement(ModuleReglages, {
    parametres: parametres,
    eleves: eleves,
    groupes: groupes,
    appels: appels,
    factures: factures,
    onSaveParametres: handleSaveParametres,
    onExportComplet: handleExportComplet
  })), isAdmin &&"""),
], "(réglages, émission, sauvegarde)")

appliquer("src/app/18-module-facturation.js", [
    ("""  onSaveFacture,
  onDeleteFacture,
  onDeleteFactureEnCours
}) {""",
     """  onSaveFacture,
  onDeleteFacture,
  onDeleteFactureEnCours,
  parametres,
  onEmettreFacture
}) {"""),

    ("""    facture: impression.f,
    eleve: impression.e,
    onClose: () => setImpression(null),""",
     """    facture: impression.f,
    eleve: impression.e,
    parametres: parametres,
    onEmettre: onEmettreFacture,
    onClose: () => setImpression(null),"""),
], "(passe les réglages à la facture)")
