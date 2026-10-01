// ─── RÉSEAU ET BROUILLONS LOCAUX ─────────────────────────────
// Une salle de cours n'est pas un bureau : le wifi tombe, la 4G traverse mal le
// béton, l'onglet se ferme. Tant que l'appel ne vivait qu'en mémoire, une coupure
// l'effaçait sans bruit. Il s'écrit désormais d'abord dans le navigateur ; il ne
// part vers Supabase qu'ensuite, et attend le retour du réseau s'il le faut.

// Le stockage local peut être refusé (navigation privée, réglages stricts).
// Dans ce cas on perd le filet, jamais l'application : tout est en try/catch.
const Local = {
  lire(cle, defaut) {
    try {
      const v = localStorage.getItem(cle);
      return v == null ? defaut : JSON.parse(v);
    } catch (e) {
      return defaut;
    }
  },
  ecrire(cle, valeur) {
    try {
      localStorage.setItem(cle, JSON.stringify(valeur));
      return true;
    } catch (e) {
      return false;
    }
  },
  effacer(cle) {
    try {
      localStorage.removeItem(cle);
    } catch (e) {}
  }
};

const cleBrouillonAppel = (groupeId, date) => `bo:appel:${groupeId}:${date}`;
const CLE_FILE_APPELS = "bo:file-appels";

// Un appel qui n'a pas pu partir reste ici jusqu'à ce qu'il parte. Une seule
// entrée par groupe et par date : le dernier état saisi fait foi.
const fileAppels = {
  lire: () => {
    const f = Local.lire(CLE_FILE_APPELS, []);
    return Array.isArray(f) ? f : [];
  },
  ajouter(entree) {
    const reste = fileAppels.lire().filter(x => !(x.groupeId === entree.groupeId && x.date === entree.date));
    reste.push({ ...entree, depuis: new Date().toISOString() });
    Local.ecrire(CLE_FILE_APPELS, reste);
  },
  retirer(groupeId, date) {
    Local.ecrire(CLE_FILE_APPELS, fileAppels.lire().filter(x => !(x.groupeId === groupeId && x.date === date)));
  },
  vider: () => Local.ecrire(CLE_FILE_APPELS, [])
};

// Distinguer « le réseau a manqué » de « le serveur a refusé ». Une erreur de
// droits ou de données doit remonter à l'utilisateur ; une coupure doit être
// mise de côté et rejouée.
const estPanneReseau = e => {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return true;
  const m = ((e && e.message) || "").toLowerCase();
  return m.includes("failed to fetch") || m.includes("networkerror") ||
         m.includes("load failed") || m.includes("network request failed") ||
         m.includes("timeout");
};

// Enregistre l'appel, ou le garde sous le coude. Renvoie ce qui s'est passé pour
// que l'écran puisse le dire honnêtement plutôt que d'afficher une fausse réussite.
async function envoyerAppel(envoyer, groupeId, date, presMap) {
  try {
    await envoyer(groupeId, date, presMap);
    fileAppels.retirer(groupeId, date);
    Local.effacer(cleBrouillonAppel(groupeId, date));
    return { envoye: true };
  } catch (e) {
    if (estPanneReseau(e)) {
      fileAppels.ajouter({ groupeId, date, presMap });
      Local.ecrire(cleBrouillonAppel(groupeId, date), presMap);
      return { envoye: false, enAttente: true };
    }
    throw e;
  }
}

// Vide la file dès que la connexion revient. Les échecs restent en file : on
// réessaiera au prochain retour de réseau plutôt que de boucler.
async function rejouerFileAppels(envoyer) {
  const file = fileAppels.lire();
  if (!file.length) return { rejoues: 0, restants: 0 };
  let rejoues = 0;
  for (const entree of file) {
    try {
      await envoyer(entree.groupeId, entree.date, entree.presMap);
      fileAppels.retirer(entree.groupeId, entree.date);
      Local.effacer(cleBrouillonAppel(entree.groupeId, entree.date));
      rejoues++;
    } catch (e) {
      if (!estPanneReseau(e)) {
        // Le serveur refuse cet appel : le garder en file le ferait échouer
        // indéfiniment. On le sort et on le signale.
        fileAppels.retirer(entree.groupeId, entree.date);
        signalerErreur(e);
      }
    }
  }
  return { rejoues, restants: fileAppels.lire().length };
}

// État de la connexion, rafraîchi par le navigateur lui-même.
function useEnLigne() {
  const [enLigne, setEnLigne] = useState(typeof navigator === "undefined" || navigator.onLine !== false);
  useEffect(() => {
    const monter = () => setEnLigne(true);
    const tomber = () => setEnLigne(false);
    window.addEventListener("online", monter);
    window.addEventListener("offline", tomber);
    return () => {
      window.removeEventListener("online", monter);
      window.removeEventListener("offline", tomber);
    };
  }, []);
  return enLigne;
}
