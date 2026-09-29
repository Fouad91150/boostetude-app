import sys, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).parent))
from patcher import appliquer

appliquer("src/app/20-app.js", [
    ("""  const [parametres, setParametres] = useState(null);""",
     """  const [parametres, setParametres] = useState(null);
  const [comptesRendus, setComptesRendus] = useState([]);
  const [bilans, setBilans] = useState([]);"""),

    ("""      if (role === "admin") setParametres(await api.fetchParametres());
    } catch (e) {""",
     """      if (role === "admin") setParametres(await api.fetchParametres());
      setComptesRendus(await api.fetchComptesRendus());
      setBilans(await api.fetchBilansEnvoyes());
    } catch (e) {"""),

    ("""      if (role === "admin") {
        setParametres(await api.fetchParametres());""",
     """      setComptesRendus(await api.fetchComptesRendus());
      setBilans(await api.fetchBilansEnvoyes());
      if (role === "admin") {
        setParametres(await api.fetchParametres());"""),

    ("""  const handleSaveParametres = async form => {""",
     """  const handleSaveComptesRendus = async (groupeId, date, parEleve, auteurId) => {
    await api.saveComptesRendus(groupeId, date, parEleve, auteurId);
    setComptesRendus(await api.fetchComptesRendus());
  };
  // La trace d'envoi est un confort (badge « ✓ envoyé »), jamais un préalable :
  // si elle échoue, le message part quand même.
  const handleLogBilan = async row => {
    try {
      await api.logBilan(row);
      setBilans(await api.fetchBilansEnvoyes());
    } catch (e) {}
  };
  const handleSaveParametres = async form => {"""),

    # Badge : élèves vus cette semaine dont le parent n'a pas encore reçu son bilan.
    ("""  const conformiteIncomplete = isAdmin && champsManquants(parametres).length > 0;""",
     """  const conformiteIncomplete = isAdmin && champsManquants(parametres).length > 0;
  const lundiCourant = lundiDe(todayStr());
  const dimancheCourant = addJours(lundiCourant, 6);
  const semaineCouranteId = isoSemaine(lundiCourant);
  const vusCetteSemaine = new Set();
  Object.entries(appels).forEach(([k, p]) => {
    const parts = k.split(":");
    if (parts[0] !== "ap") return;
    if (parts[2] < lundiCourant || parts[2] > dimancheCourant) return;
    Object.entries(p).forEach(([eid, st]) => { if (st) vusCetteSemaine.add(eid); });
  });
  const bilansFaits = new Set(bilans.filter(b => b.semaine === semaineCouranteId).map(b => b.eleve_id));
  const nbBilansDus = [...vusCetteSemaine].filter(id => !bilansFaits.has(id)).length;"""),

    # Onglets : Suivi et Bilans, accessibles aussi aux professeurs.
    ("""  }, {
    k: "reglages",
    i: "⚙️",
    l: "Réglages",
    badge: conformiteIncomplete ? "!" : null
  }] : [{
    k: "appel",
    i: "📋",
    l: "Appel"
  }];""",
     """  }, {
    k: "reglages",
    i: "⚙️",
    l: "Réglages",
    badge: conformiteIncomplete ? "!" : null
  }] : [{
    k: "appel",
    i: "📋",
    l: "Appel"
  }, {
    k: "suivi",
    i: "📝",
    l: "Suivi"
  }, {
    k: "bilans",
    i: "📨",
    l: "Bilans",
    badge: nbBilansDus > 0 ? nbBilansDus : null
  }];"""),

    ("""  }, {
    k: "factures",
    i: "💰",
    l: "Factures",
    badge: nbImpayes > 0 ? nbImpayes : null
  }, {
    k: "reglages",""",
     """  }, {
    k: "suivi",
    i: "📝",
    l: "Suivi"
  }, {
    k: "bilans",
    i: "📨",
    l: "Bilans",
    badge: nbBilansDus > 0 ? nbBilansDus : null
  }, {
    k: "factures",
    i: "💰",
    l: "Factures",
    badge: nbImpayes > 0 ? nbImpayes : null
  }, {
    k: "reglages","""),

    ("""    appel: "Feuille d'appel",
    factures: "Facturation",
    reglages: "Réglages"
  } : {
    appel: "Feuille d'appel"
  };""",
     """    appel: "Feuille d'appel",
    suivi: "Suivi de séance",
    bilans: "Bilans hebdo",
    factures: "Facturation",
    reglages: "Réglages"
  } : {
    appel: "Feuille d'appel",
    suivi: "Suivi de séance",
    bilans: "Bilans hebdo"
  };"""),

    # Routage des deux écrans.
    ("""  }), tab === "reglages" && isAdmin &&""",
     """  }), tab === "suivi" && /*#__PURE__*/React.createElement(ModuleSuivi, {
    eleves: eleves,
    groupes: groupes,
    appels: appels,
    comptesRendus: comptesRendus,
    monProfilId: monProfil && monProfil.id ? monProfil.id : null,
    onSave: handleSaveComptesRendus
  }), tab === "bilans" && /*#__PURE__*/React.createElement(ModuleBilans, {
    eleves: eleves,
    groupes: groupes,
    appels: appels,
    comptesRendus: comptesRendus,
    bilans: bilans,
    monProfilId: monProfil && monProfil.id ? monProfil.id : null,
    onLog: handleLogBilan
  }), tab === "reglages" && isAdmin &&"""),

    # Le profil doit ramener son identifiant : il signe comptes-rendus et bilans.
    ("""sb.from("profs").select("role,prenom,nom,email").eq("auth_id", session.user.id)""",
     """sb.from("profs").select("id,role,prenom,nom,email").eq("auth_id", session.user.id)"""),

    # La barre du bas dès qu'il y a plus d'un onglet : les professeurs en ont trois.
    ("""  })), isAdmin && /*#__PURE__*/React.createElement("div", {
    style: {
      position: "fixed",
      bottom: 0,""",
     """  })), TABS.length > 1 && /*#__PURE__*/React.createElement("div", {
    style: {
      position: "fixed",
      bottom: 0,"""),

    ("""      padding: isAdmin ? "16px 16px 90px" : "16px",""",
     """      padding: "16px 16px 90px","""),

    # Sept onglets tiennent sur un écran de téléphone : boutons resserrés.
    ("""      gap: 3,
      padding: "0 12px",
      position: "relative\"""",
     """      gap: 3,
      padding: "0 3px",
      flex: 1,
      minWidth: 0,
      position: "relative\""""),

    ("""      fontSize: 10,
      fontWeight: 700,
      color: tab === k ? C.gold : C.gray,
      letterSpacing: ".5px",
      textTransform: "uppercase\"""",
     """      fontSize: 9,
      fontWeight: 700,
      color: tab === k ? C.gold : C.gray,
      letterSpacing: ".2px",
      textTransform: "uppercase",
      whiteSpace: "nowrap\""""),
], "(suivi, bilans, navigation)")

# Après un appel enregistré, proposer d'enchaîner sur le compte-rendu.
appliquer("src/app/15-module-appel.js", [
    ("""  isAdmin,
  profs
}) {""",
     """  isAdmin,
  profs,
  onAllerSuivi
}) {"""),

    ("""/*#__PURE__*/React.createElement(BtnSecondary, {
    label: "✏️ Corriger",
    onClick: () => setEtape("appel")
  }), /*#__PURE__*/React.createElement(BtnPrimary, {
    label: "← Retour aux groupes",""",
     """/*#__PURE__*/React.createElement(BtnSecondary, {
    label: "✏️ Corriger",
    onClick: () => setEtape("appel")
  }), onAllerSuivi && /*#__PURE__*/React.createElement(BtnPrimary, {
    label: "📝 Rédiger le compte-rendu",
    onClick: onAllerSuivi,
    full: true
  }), /*#__PURE__*/React.createElement(BtnSecondary, {
    label: "← Retour aux groupes","""),
], "(enchaînement appel → compte-rendu)")

appliquer("src/app/20-app.js", [
    ("""    isAdmin: isAdmin,
    profs: profs
  }),""",
     """    isAdmin: isAdmin,
    profs: profs,
    onAllerSuivi: () => setTab("suivi")
  }),"""),
], "(bouton d'enchaînement)")
