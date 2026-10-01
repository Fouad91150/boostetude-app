import sys, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).parent))
from patcher import appliquer

# ── 1. Le compte rendu rejoint l'appel ────────────────────────────────────────
# Il vivait dans un onglet séparé : il fallait y penser, rouvrir le groupe, puis
# la date. Un mois d'exploitation, zéro compte rendu écrit. Il s'écrit désormais
# dans la foulée de l'appel, sur l'écran qui s'affiche quand la séance se termine.
#
# ── 2. L'appel survit à la coupure ────────────────────────────────────────────
# Chaque modification est écrite dans le navigateur ; l'envoi qui échoue pour
# cause de réseau est mis en file et rejoué au retour de la connexion.

appliquer("src/app/15-module-appel.js", [

    # Trois props de plus : de quoi écrire le compte rendu sans quitter l'écran.
    ("""function ModuleAppel({
  eleves,
  groupes,
  appels,
  onSaveAppel,
  onSaveGroupe,
  isAdmin,
  profs,
  onAllerSuivi
}) {
  const [etape, setEtape] = useState("groupes");
  const [grp, setGrp] = useState(null);
  const [date, setDate] = useState(todayStr());
  const [pres, setPres] = useState({});
  const [onglet, setOnglet] = useState("appel");
  const [grpForm, setGrpForm] = useState(null);
  const [enregistrement, setEnregistrement] = useState(false);
  const elevesMap = {};
  eleves.forEach(e => {
    elevesMap[e.id] = e;
  });""",
     """function ModuleAppel({
  eleves,
  groupes,
  appels,
  comptesRendus,
  monProfilId,
  onSaveAppel,
  onSaveComptesRendus,
  onSaveGroupe,
  isAdmin,
  profs,
  onAllerSuivi
}) {
  const [etape, setEtape] = useState("groupes");
  const [grp, setGrp] = useState(null);
  const [date, setDate] = useState(todayStr());
  const [pres, setPres] = useState({});
  const [onglet, setOnglet] = useState("appel");
  const [grpForm, setGrpForm] = useState(null);
  const [enregistrement, setEnregistrement] = useState(false);
  const [travaille, setTravaille] = useState("");
  const [difficultes, setDifficultes] = useState("");
  const [devoirs, setDevoirs] = useState("");
  const [saveCR, setSaveCR] = useState(false);
  const [enAttente, setEnAttente] = useState(fileAppels.lire().length);
  const [videsOuverts, setVidesOuverts] = useState(false);
  const enLigne = useEnLigne();
  const elevesMap = {};
  eleves.forEach(e => {
    elevesMap[e.id] = e;
  });

  // Le brouillon est écrit à chaque geste : si l'onglet se ferme ou si le réseau
  // tombe, la saisie est toujours là au retour.
  useEffect(() => {
    if (grp && etape === "appel" && Object.keys(pres).length) {
      Local.ecrire(cleBrouillonAppel(grp.id, date), pres);
    }
  }, [pres, grp, date, etape]);

  // Au retour de la connexion, ce qui attendait part tout seul.
  useEffect(() => {
    if (!enLigne) return;
    let vivant = true;
    (async () => {
      const { rejoues, restants } = await rejouerFileAppels(onSaveAppel);
      if (!vivant) return;
      setEnAttente(restants);
      if (rejoues) signalerSucces(`${rejoues} appel${rejoues > 1 ? "s" : ""} enregistré${rejoues > 1 ? "s" : ""} au retour du réseau.`);
    })();
    return () => { vivant = false; };
  }, [enLigne]);"""),

    # Une erreur de formulaire ne doit plus arrêter l'application.
    ("""        } catch (e) {
          alert("Erreur : " + e.message);
        }
      },
      onCancel: () => setGrpForm(null)""",
     """        } catch (e) {
          signalerErreur(e);
        }
      },
      onCancel: () => setGrpForm(null)"""),

    # Ouvrir un groupe : le brouillon local prime, car il est forcément le plus récent.
    ("""  const ouvrir = g => {
    setGrp(g);
    const ex = appels[`ap:${g.id}:${date}`];
    if (ex) {
      setPres(ex);
    } else {
      const p = {};
      (g.eids || []).forEach(id => {
        p[id] = "present";
      });
      setPres(p);
    }
    setEtape("appel");
  };
  const changerDate = d => {
    setDate(d);
    if (!grp) return;
    const ex = appels[`ap:${grp.id}:${d}`];
    if (ex) {
      setPres(ex);
    } else {
      const p = {};
      (grp.eids || []).forEach(id => {
        p[id] = "present";
      });
      setPres(p);
    }
  };""",
     """  // Un appel laissé en plan vaut mieux qu'une liste repartie de zéro : le
  // brouillon local l'emporte sur ce qu'a renvoyé le serveur.
  const etatPour = (g, d) => {
    const brouillon = Local.lire(cleBrouillonAppel(g.id, d), null);
    if (brouillon && Object.keys(brouillon).length) return { pres: brouillon, repris: !appels[`ap:${g.id}:${d}`] };
    const ex = appels[`ap:${g.id}:${d}`];
    if (ex) return { pres: ex, repris: false };
    const p = {};
    (g.eids || []).forEach(id => {
      p[id] = "present";
    });
    return { pres: p, repris: false };
  };
  const ouvrir = g => {
    setGrp(g);
    const { pres: p, repris } = etatPour(g, date);
    setPres(p);
    if (repris) signalerInfo("Appel repris là où vous l'aviez laissé.");
    setEtape("appel");
  };
  const changerDate = d => {
    setDate(d);
    if (!grp) return;
    setPres(etatPour(grp, d).pres);
  };"""),

    # Enregistrer : une coupure met l'appel en file au lieu de le perdre.
    ("""  const enregistrer = async () => {
    setEnregistrement(true);
    try {
      await onSaveAppel(grp.id, date, pres);
      setEtape("confirme");
    } catch (e) {
      alert("Erreur : " + e.message);
    }
    setEnregistrement(false);
  };""",
     """  const enregistrer = async () => {
    setEnregistrement(true);
    try {
      const { enAttente: differe } = await envoyerAppel(onSaveAppel, grp.id, date, pres);
      setEnAttente(fileAppels.lire().length);
      if (differe) signalerInfo("Pas de réseau : l'appel est gardé sur l'appareil et partira tout seul.");
      setTravaille("");
      setDifficultes("");
      setDevoirs("");
      setEtape("confirme");
    } catch (e) {
      signalerErreur(e);
    }
    setEnregistrement(false);
  };"""),

], "(appel : compte rendu intégré, brouillon local, file d'attente)")
