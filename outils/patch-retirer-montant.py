import sys, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).parent))
from patcher import appliquer

# Le montant affiché devant chaque élève valait « tarif horaire × 8 h », soit un mois
# théorique de 4 séances. Depuis que la facturation se calcule sur les séances
# réellement pointées, ce chiffre ne correspond à rien : il se lisait comme un solde
# dû alors qu'il n'était qu'une projection. On le retire partout.

appliquer("src/app/13-module-eleves.js", [
    # La tuile « CA estimé » sommait cette projection sur tous les élèves.
    # Deux compteurs vrais valent mieux que trois dont un inventé.
    ("""  }, [{
    e: "👤",
    v: actifs.length,
    l: "Actifs",
    c: C.gold
  }, {
    e: "💰",
    v: `${actifs.reduce((s, e) => s + e.th * 8, 0)}€`,
    l: "CA estimé",
    c: C.green
  }, {
    e: "📋",
    v: eleves.length,
    l: "Total",
    c: C.gray
  }].map((s, i)""",
     """  }, [{
    e: "👤",
    v: actifs.length,
    l: "Actifs",
    c: C.gold
  }, {
    e: "📋",
    v: eleves.length,
    l: "Total",
    c: C.gray
  }].map((s, i)"""),

    # Trois tuiles devenaient deux : la grille suit.
    ("""    style: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr 1fr",
      gap: 8,
      marginBottom: 16
    }
  }, [{
    e: "👤",""",
     """    style: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: 8,
      marginBottom: 16
    }
  }, [{
    e: "👤","""),

    # Dans la liste, le montant cède la place au niveau et au tarif horaire,
    # déjà présents juste à gauche — donc on supprime simplement la pastille.
    ("""  }, e.niveau, " • ", e.th, "€/h • ", matieresDe(e.id))), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 15,
      fontWeight: 800,
      color: C.gold,
      fontFamily: FD
    }
  }, e.th * 8, "€"), /*#__PURE__*/React.createElement("span", {""",
     """  }, e.niveau, " • ", e.th, "€/h • ", matieresDe(e.id))), /*#__PURE__*/React.createElement("span", {"""),
], "(montant projeté retiré de la liste des élèves)")

appliquer("src/app/12-fiche-eleve.js", [
    # Même chose sur la fiche : le barème 3/4/5 séances était une grille indicative
    # qui ne correspondait à aucune facture réelle.
    ("""    rows: [["Tarif/h", `${eleve.th}€`], ["3 séances", `${eleve.th * 6}€`], ["4 séances", `${eleve.th * 8}€`], ["5 séances", `${eleve.th * 10}€`], ["Mode", eleve.mp]]""",
     """    rows: [["Tarif horaire", `${eleve.th} €`], ["Séance de 2 h", `${eleve.th * 2} €`], ["Mode de règlement", eleve.mp]]"""),
], "(barème indicatif remplacé par le tarif réel)")
