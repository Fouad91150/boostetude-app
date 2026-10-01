import sys, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).parent))
from patcher import appliquer

# ── BtnSecondary honore enfin « full » ───────────────────────────────────────
# Plusieurs écrans le passaient déjà ; il était ignoré, et les boutons secondaires
# restaient étroits au milieu d'une colonne pleine largeur.
appliquer("src/app/07-atomes.js", [
    ("""function BtnSecondary({
  label,
  onClick
}) {
  return /*#__PURE__*/React.createElement("button", {
    onClick: onClick,
    style: {
      background: "rgba(255,255,255,.08)",
      border: "1px solid rgba(255,255,255,.15)",
      borderRadius: 12,
      padding: "13px 18px",
      fontSize: 14,
      fontWeight: 700,
      color: C.cream,
      cursor: "pointer",
      fontFamily: "inherit",
      boxShadow: "0 2px 8px rgba(0,0,0,.18)"
    }
  }, label);
}""",
     """function BtnSecondary({
  label,
  onClick,
  full
}) {
  return /*#__PURE__*/React.createElement("button", {
    onClick: onClick,
    style: {
      background: "rgba(255,255,255,.08)",
      border: "1px solid rgba(255,255,255,.15)",
      borderRadius: 12,
      padding: "13px 18px",
      fontSize: 14,
      fontWeight: 700,
      color: C.cream,
      cursor: "pointer",
      fontFamily: "inherit",
      width: full ? "100%" : "auto",
      boxShadow: "0 2px 8px rgba(0,0,0,.18)"
    }
  }, label);
}"""),
], "(bouton secondaire pleine largeur)")


# ── Les alertes bloquantes deviennent des bandeaux ───────────────────────────
# Sur un téléphone, alert() recouvre l'écran et fige l'application : un appel en
# cours disparaissait derrière une boîte grise. Le message s'affiche maintenant
# par-dessus, sans rien interrompre.
#
# Les demandes de confirmation avant suppression restent délibérément bloquantes :
# une action irréversible mérite d'arrêter la main de l'utilisateur.
ALERTE = '      alert("Erreur : " + e.message);'
BANDEAU = '      signalerErreur(e);'
total = 0
for nom in ["13-module-eleves.js", "15-module-appel.js", "17-vue-impression.js",
            "18-module-facturation.js", "19c-suivi.js"]:
    chemin = pathlib.Path("src/app") / nom
    texte = chemin.read_text(encoding="utf-8")
    n = texte.count(ALERTE)
    if n:
        chemin.write_text(texte.replace(ALERTE, BANDEAU), encoding="utf-8")
        print(f"✅ src/app/{nom} — {n} alerte(s) remplacée(s) par un bandeau")
        total += n
print(f"   ({total} au total)")

# Le refus d'émettre une facture incomplète méritait mieux qu'une liste à puces
# dans une boîte système.
appliquer("src/app/17-vue-impression.js", [
    ('''      alert("Complétez d'abord vos informations légales dans l'onglet Réglages :\\n\\n· " + manquants.join("\\n· "));''',
     '''      signalerErreur({ message: "Complétez d'abord vos informations légales dans Réglages : " + manquants.join(", ") });'''),
], "(facture : refus d'émission expliqué dans un bandeau)")


# ── Les groupes sans élève passent en retrait ────────────────────────────────
# Six groupes sur onze sont vides : des places tenues pour plus tard. Ils
# encombraient l'écran d'appel à chaque séance. Rien n'est supprimé — ils
# attendent dans une section repliée, en bas.
appliquer("src/app/15-module-appel.js", [
    ("""  }, groupes.map(g => {
    const fait = !!appels[`ap:${g.id}:${date}`];
    return /*#__PURE__*/React.createElement("div", {""",
     """  }, groupesTenus.map(g => {
    const fait = !!appels[`ap:${g.id}:${date}`];
    return /*#__PURE__*/React.createElement("div", {"""),
], "(appel : seuls les groupes pourvus sont listés)")
