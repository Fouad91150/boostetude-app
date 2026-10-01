// ─── BANDEAUX ────────────────────────────────────────────────
// Les alertes du navigateur arrêtaient l'application en pleine action : sur un
// téléphone, un appel en cours disparaissait derrière une boîte grise. Les
// messages s'affichent maintenant par-dessus l'écran, sans rien interrompre.
//
// Un bus minuscule plutôt qu'un contexte React : n'importe quel module peut
// signaler quelque chose sans qu'on fasse descendre une fonction de props en
// props à travers vingt composants.
const Signal = {
  _abonnes: [],
  emettre(type, texte) {
    Signal._abonnes.forEach(f => {
      try { f(type, texte); } catch (e) {}
    });
  },
  abonner(f) {
    Signal._abonnes.push(f);
    return () => { Signal._abonnes = Signal._abonnes.filter(x => x !== f); };
  }
};

const signalerErreur = e => Signal.emettre("erreur", (e && e.message) || String(e || "Une erreur est survenue"));
const signalerSucces = t => Signal.emettre("succes", t);
const signalerInfo = t => Signal.emettre("info", t);

const APPARENCE_BANDEAU = {
  succes: { fond: "rgba(76,175,125,.16)", bord: "rgba(76,175,125,.5)", teinte: "#4caf7d", icone: "✅" },
  erreur: { fond: "rgba(224,90,90,.16)", bord: "rgba(224,90,90,.5)", teinte: "#e05a5a", icone: "⚠️" },
  info:   { fond: "rgba(212,175,55,.14)", bord: "rgba(212,175,55,.45)", teinte: "#d4af37", icone: "ℹ️" }
};

function PileBandeaux() {
  const [messages, setMessages] = useState([]);

  useEffect(() => Signal.abonner((type, texte) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setMessages(m => [...m.slice(-2), { id, type, texte }]);
    // Une réussite se lit au passage et s'efface seule. Une erreur reste :
    // elle demande une décision, pas un coup d'œil.
    if (type !== "erreur") {
      setTimeout(() => setMessages(m => m.filter(x => x.id !== id)), 5000);
    }
  }), []);

  if (!messages.length) return null;

  return h("div", {
    style: {
      position: "fixed", top: 12, left: "50%", transform: "translateX(-50%)",
      zIndex: 9000, width: "calc(100% - 24px)", maxWidth: 440,
      display: "flex", flexDirection: "column", gap: 8, pointerEvents: "none"
    }
  }, messages.map(m => {
    const a = APPARENCE_BANDEAU[m.type] || APPARENCE_BANDEAU.info;
    return h("div", {
      key: m.id,
      className: "fx-fade-slide-up",
      onClick: () => setMessages(x => x.filter(y => y.id !== m.id)),
      style: {
        pointerEvents: "auto", cursor: "pointer",
        background: a.fond, border: `1px solid ${a.bord}`, borderRadius: 12,
        padding: "12px 14px", display: "flex", alignItems: "flex-start", gap: 10,
        backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
        boxShadow: "0 8px 24px rgba(0,0,0,.35)"
      }
    },
      h("span", { style: { fontSize: 16, lineHeight: "20px" } }, a.icone),
      h("div", { style: { flex: 1, fontSize: 14, lineHeight: 1.45, color: C.cream, fontWeight: 600 } }, m.texte),
      h("span", { style: { color: a.teinte, fontSize: 18, lineHeight: "20px", fontWeight: 700 } }, "×"));
  }));
}

// Barre discrète signalant que l'application travaille sans réseau, et combien
// d'appels attendent de partir.
function BandeauHorsLigne({ enLigne, enAttente }) {
  if (enLigne && !enAttente) return null;
  const texte = !enLigne
    ? (enAttente
        ? `Hors ligne — ${enAttente} appel${enAttente > 1 ? "s" : ""} en attente d'envoi`
        : "Hors ligne — vos saisies sont gardées sur l'appareil")
    : `Envoi en attente — ${enAttente} appel${enAttente > 1 ? "s" : ""} à transmettre`;
  return h("div", {
    style: {
      background: enLigne ? "rgba(212,175,55,.12)" : "rgba(224,150,60,.14)",
      border: `1px solid ${enLigne ? "rgba(212,175,55,.35)" : "rgba(224,150,60,.4)"}`,
      borderRadius: 10, padding: "9px 12px", marginBottom: 12,
      fontSize: 13, fontWeight: 600, color: C.cream,
      display: "flex", alignItems: "center", gap: 8
    }
  }, h("span", null, enLigne ? "📤" : "📡"), h("span", null, texte));
}
