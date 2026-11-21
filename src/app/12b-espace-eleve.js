// ─── ESPACE ÉLÈVE (accès aux cours en ligne) ─────────────────
// Chaque collégien ou lycéen peut recevoir un identifiant (« f.elmkhanter ») et
// un mot de passe pour ouvrir ses cours de maths sur l'espace élève. Le compte
// est créé côté base par la fonction creer_compte_eleve (réservée à l'admin) ;
// les règles de la base ne lui laissent voir que les cours de son niveau.
const URL_ESPACE_ELEVE = "https://fouad91150.github.io/boostetude-app/eleve.html";
const NIVEAUX_ESPACE_ELEVE = ["6ème", "5ème", "4ème", "3ème", "2nde", "1ère", "Terminale"];
const aEspaceEleve = e => !!e && NIVEAUX_ESPACE_ELEVE.includes(e.niveau);

const sansAccents = s => (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "");
// Première lettre du prénom, un point, le nom de famille : « f.elmkhanter ».
// Un chiffre s'ajoute si l'identifiant est déjà pris (« f.elmkhanter2 »).
const identifiantPropose = (eleve, eleves) => {
  const p = sansAccents(eleve.prenom).toLowerCase().replace(/[^a-z]/g, "").slice(0, 1) || "e";
  const n = sansAccents(eleve.nom).toLowerCase().replace(/[^a-z0-9]/g, "") || "eleve";
  const base = `${p}.${n}`.slice(0, 38);
  const pris = new Set((eleves || []).filter(x => x.id !== eleve.id && x.identifiant).map(x => x.identifiant));
  if (!pris.has(base)) return base;
  for (let i = 2; ; i++) if (!pris.has(base + i)) return base + i;
};
// Simple à taper sur un téléphone, assez long pour ne pas se deviner.
const motDePasseEleve = (alea = Math.random) => {
  const mots = ["maths", "boost", "etude", "reussir", "calcul", "pi", "angle", "vecteur"];
  const m = mots[Math.floor(alea() * mots.length)];
  return `${m}-${String(Math.floor(alea() * 9000) + 1000)}`;
};
const messageAccesEleve = (e, identifiant, mdp) =>
  `Bonjour ${e.parent},\n\n` +
  `Voici l'accès de ${e.prenom} à son *espace élève Boost'Étude*, pour revoir ses cours de mathématiques quand il le souhaite :\n\n` +
  `🔗 ${URL_ESPACE_ELEVE}\n` +
  `👤 Identifiant : *${identifiant}*\n` +
  `🔑 Mot de passe : *${mdp}*\n\n` +
  `${e.prenom} pourra changer son mot de passe une fois connecté(e).\n\n` +
  `Boost'Étude`;

function CarteEspaceEleve({ eleve, eleves, onChange }) {
  const [etat, setEtat] = useState({ identifiant: eleve.identifiant || null, mdp: null });
  const [occupe, setOccupe] = useState(false);
  const [erreur, setErreur] = useState("");
  if (!aEspaceEleve(eleve)) return null;
  const creer = async () => {
    setOccupe(true); setErreur("");
    // Fenêtre réservée tout de suite : après l'attente, le téléphone bloquerait WhatsApp.
    const fenetre = eleve.tel ? window.open("", "_blank") : null;
    try {
      const identifiant = etat.identifiant || identifiantPropose(eleve, eleves);
      const mdp = motDePasseEleve();
      const r = await api.creerCompteEleve(eleve.id, identifiant, mdp);
      setEtat({ identifiant: r || identifiant, mdp });
      const lien = `https://wa.me/${telWhatsApp(eleve.tel)}?text=${encodeURIComponent(messageAccesEleve(eleve, r || identifiant, mdp))}`;
      if (fenetre) fenetre.location = lien;
      onChange && onChange();
    } catch (e) {
      if (fenetre) fenetre.close();
      setErreur(e.message || String(e));
    } finally { setOccupe(false); }
  };
  const renvoyer = () => {
    window.open(`https://wa.me/${telWhatsApp(eleve.tel)}?text=${encodeURIComponent(messageAccesEleve(eleve, etat.identifiant, etat.mdp))}`, "_blank");
  };
  const bouton = (label, onClick, principal) => h("button", {
    onClick, disabled: occupe,
    style: { flex: 1, background: principal ? C.green : C.surface, color: principal ? "#fff" : C.texte,
      border: `1px solid ${principal ? C.green : C.bord}`, borderRadius: 10, padding: "11px 12px",
      fontSize: 14, fontWeight: 700, cursor: occupe ? "wait" : "pointer", fontFamily: "inherit" }
  }, label);
  return h("div", { style: { background: C.surface, border: `1px solid ${C.bord}`, borderRadius: 12, padding: 16, marginBottom: 10 } },
    h("div", { style: { fontSize: 12, fontWeight: 700, color: C.gold, marginBottom: 10 } }, "🎓 Espace élève (cours en ligne)"),
    etat.identifiant
      ? h("div", { style: { fontSize: 13, color: C.texte, marginBottom: 10 } },
          "Identifiant : ", h("b", null, etat.identifiant),
          etat.mdp ? h("span", null, " · Mot de passe : ", h("b", null, etat.mdp)) : null)
      : h("div", { style: { fontSize: 13, color: C.gray, marginBottom: 10 } },
          `Pas encore d'accès. Identifiant prévu : ${identifiantPropose(eleve, eleves)}`),
    h("div", { style: { display: "flex", gap: 8, flexWrap: "wrap" } },
      etat.identifiant
        ? [etat.mdp && eleve.tel ? h(React.Fragment, { key: "r" }, bouton("📤 Renvoyer sur WhatsApp", renvoyer, true)) : null,
           h(React.Fragment, { key: "n" }, bouton(occupe ? "…" : "🔑 Nouveau mot de passe" + (eleve.tel ? " + WhatsApp" : ""), creer, !etat.mdp))]
        : bouton(occupe ? "Création…" : "🎓 Créer l'accès" + (eleve.tel ? " et l'envoyer sur WhatsApp" : ""), creer, true)),
    !eleve.tel && h("div", { style: { fontSize: 12, color: C.gray, marginTop: 8 } }, "Pas de téléphone parent : note le mot de passe affiché et transmets-le."),
    erreur && h("div", { style: { fontSize: 13, color: C.red, marginTop: 8 } }, erreur));
}
