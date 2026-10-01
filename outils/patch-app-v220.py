import sys, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).parent))
from patcher import appliquer

appliquer("src/app/20-app.js", [

    # La pile de bandeaux coiffe toute l'application : n'importe quel écran peut
    # signaler une erreur ou une réussite sans que rien ne s'arrête.
    ("""  return /*#__PURE__*/React.createElement("div", {
    style: {
      minHeight: "100vh",
      background: C.navy,
      fontFamily: FD,
      color: C.cream
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: `linear-gradient(135deg,${C.navyM},${C.navyL})`,""",
     """  return /*#__PURE__*/React.createElement("div", {
    style: {
      minHeight: "100vh",
      background: C.navy,
      fontFamily: FD,
      color: C.cream
    }
  }, /*#__PURE__*/React.createElement(PileBandeaux, null), /*#__PURE__*/React.createElement("div", {
    style: {
      background: `linear-gradient(135deg,${C.navyM},${C.navyL})`,"""),

    # L'appel reçoit de quoi écrire le compte rendu sans changer d'onglet.
    ("""  }), tab === "appel" && /*#__PURE__*/React.createElement(ModuleAppel, {
    eleves: eleves,
    groupes: groupes,
    appels: appels,
    onSaveAppel: handleSaveAppel,
    onSaveGroupe: handleSaveGroupe,
    isAdmin: isAdmin,
    profs: profs,
    onAllerSuivi: () => setTab("suivi")
  }),""",
     """  }), tab === "appel" && /*#__PURE__*/React.createElement(ModuleAppel, {
    eleves: eleves,
    groupes: groupes,
    appels: appels,
    comptesRendus: comptesRendus,
    monProfilId: monProfil?.id || null,
    onSaveAppel: handleSaveAppel,
    onSaveComptesRendus: handleSaveComptesRendus,
    onSaveGroupe: handleSaveGroupe,
    isAdmin: isAdmin,
    profs: profs,
    onAllerSuivi: () => setTab("suivi")
  }),"""),

], "(application : bandeaux montés, appel relié au compte rendu)")
