import sys, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).parent))
from patcher import appliquer

# Les deux dernières alertes, dans Réglages, avec une indentation différente.
chemin = pathlib.Path("src/app/19b-reglages.js")
texte = chemin.read_text(encoding="utf-8")
n = texte.count('alert("Erreur : " + e.message);')
chemin.write_text(texte.replace('alert("Erreur : " + e.message);', 'signalerErreur(e);'), encoding="utf-8")
print(f"✅ src/app/19b-reglages.js — {n} alerte(s) remplacée(s) par un bandeau")

# ── Groupes pourvus / groupes en attente ─────────────────────────────────────
appliquer("src/app/15-module-appel.js", [
    # Le partage se fait juste avant l'écran de choix du groupe.
    ("""  if (etape === "groupes") return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {""",
     """  // Un groupe sans inscrit est une place tenue pour plus tard, pas une séance à
  // pointer. Il quitte la liste principale sans disparaître de l'application.
  const groupesTenus = groupes.filter(g => (g.eids || []).length > 0);
  const groupesVides = groupes.filter(g => (g.eids || []).length === 0);
  if (etape === "groupes") return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {"""),

    # Et la section repliée se glisse en fin de liste, avant les écrans « aucun groupe ».
    ("""  }), groupes.length === 0 && isAdmin && /*#__PURE__*/React.createElement("div", {""",
     """  }), groupesVides.length > 0 && h("div", { style: { marginTop: 14 } },
    h("button", {
      onClick: () => setVidesOuverts(v => !v),
      style: { background: "none", border: "none", color: C.gray, cursor: "pointer", fontSize: 12.5, fontWeight: 600, fontFamily: "inherit", padding: "6px 0" }
    }, videsOuverts ? "▾ " : "▸ ", groupesVides.length, " groupe", groupesVides.length > 1 ? "s" : "", " sans élève inscrit"),
    videsOuverts && h("div", { style: { display: "flex", flexDirection: "column", gap: 8, marginTop: 8 } },
      groupesVides.map(g => h("div", { key: g.id, style: { display: "flex", gap: 8 } },
        h("button", {
          onClick: () => ouvrir(g),
          style: { flex: 1, background: "rgba(255,255,255,.02)", border: "1px dashed rgba(255,255,255,.12)", borderRadius: 12, padding: "12px 14px", cursor: "pointer", fontFamily: "inherit", textAlign: "left" }
        },
          h("div", { style: { fontSize: 14, fontWeight: 700, color: C.gray, fontFamily: FD } },
            g.nom, h("span", { style: { fontSize: 10.5, fontWeight: 700, color: "rgba(212,175,55,.6)", marginLeft: 8 } }, g.matiere)),
          h("div", { style: { fontSize: 11.5, color: "rgba(255,255,255,.3)", marginTop: 2 } }, horaireLabel(g), " • aucun inscrit")),
        isAdmin && h("button", {
          onClick: () => setGrpForm(g),
          style: { background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.08)", borderRadius: 12, padding: "0 13px", color: "rgba(212,175,55,.6)", cursor: "pointer", fontSize: 14, fontFamily: "inherit" }
        }, "✏️"))))),
  groupes.length === 0 && isAdmin && /*#__PURE__*/React.createElement("div", {"""),
], "(appel : les groupes vides attendent dans une section repliée)")
