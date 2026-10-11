// ─── RELANCES ────────────────────────────────────────────────
// « L'envoi des factures et le suivi, la relance » — c'est ce qui pèse le plus.
// L'envoi tient désormais en un geste ; restait la relance, qui demandait de se
// souvenir de qui doit quoi depuis quand.
//
// Cet écran ne montre que les factures émises qu'il reste à encaisser, les plus
// anciennes d'abord, avec le nombre de jours écoulés et la date de la dernière
// relance — pour ne harceler personne et n'oublier personne.

const JOURS_TIEDE = 7;
const JOURS_CHAUD = 15;

const joursDepuis = iso => {
  if (!iso) return 0;
  // Écart en jours de calendrier, compté en UTC pur : ni le fuseau ni le
  // passage à l'heure d'été (journée de 23 h) ne peuvent décaler le compte.
  const [a, m, j] = String(iso).slice(0, 10).split("-").map(Number);
  const debut = Date.UTC(a, m - 1, j);
  if (isNaN(debut)) return 0;
  const n = new Date();
  const auj = Date.UTC(n.getFullYear(), n.getMonth(), n.getDate());
  return Math.max(0, Math.round((auj - debut) / 86400000));
};

const tonRelance = jours =>
  jours >= JOURS_CHAUD ? { cl: C.red, bg: C.redPale, bd: C.redBord }
  : jours >= JOURS_TIEDE ? { cl: C.orange, bg: C.orangePale, bd: C.orangeBord }
  : { cl: C.gray, bg: C.surface, bd: C.bord };

// Les factures à relancer : émises, pas annulées, et pas encore soldées.
const aRelancer = (factures, eleves) => (factures || [])
  .filter(f => f.numero && f.statut !== "annulee" && resteDu(f) > 0 && eleves.find(e => e.id === f.eleveId))
  .map(f => ({ f, jours: joursDepuis(f.dateEmission), reste: resteDu(f) }))
  .sort((a, b) => b.jours - a.jours);

function ModuleRelances({ eleves, factures, parametres, onRelancer }) {
  const [enCours, setEnCours] = useState(null);
  const liste = aRelancer(factures, eleves);
  const total = liste.reduce((s, x) => s + x.reste, 0);
  const eleveDe = id => eleves.find(e => e.id === id);

  const relancer = async (f, el, canal) => {
    const reste = resteDu(f);
    const texte = makeRappelWhatsApp(el, f.numero, reste, f.datesSeances, Number(f.encaisse) || 0);
    const tel = telWhatsApp((el.tel || "").replace(/\s/g, ""));
    const lien = canal === "sms"
      ? `sms:${(el.tel || "").replace(/\s/g, "")}?body=${encodeURIComponent(texte)}`
      : `https://wa.me/${tel}?text=${encodeURIComponent(texte)}`;
    // On ouvre la conversation d'abord : l'autorisation du geste ne dure qu'un instant.
    window.open(lien, "_blank", "noopener,noreferrer");
    setEnCours(f.id);
    try {
      await onRelancer(f.id);
      signalerSucces(`Relance notée pour ${el.prenom}.`);
    } catch (e) {
      signalerErreur(e);
    }
    setEnCours(null);
  };

  if (liste.length === 0) {
    return h("div", { style: { textAlign: "center", padding: "40px 20px", color: C.gray } },
      h("div", { style: { fontSize: 36, marginBottom: 12 } }, "✅"),
      h("div", { style: { fontSize: 15, fontWeight: 700, color: C.texte, fontFamily: FD, marginBottom: 6 } },
        "Rien à relancer"),
      h("div", { style: { fontSize: 13, lineHeight: 1.6, maxWidth: 300, margin: "0 auto" } },
        "Toutes les factures émises sont réglées. Les factures en brouillon n'apparaissent pas ici : il faut d'abord les émettre."));
  }

  return h("div", null,
    h("div", {
      style: {
        background: C.orangePale, border: `1px solid ${C.orangeBord}`,
        borderRadius: 14, padding: 14, marginBottom: 14
      }
    },
      h("div", { style: { fontSize: 22, fontWeight: 800, color: C.orange, fontFamily: FD } }, euros(total)),
      h("div", { style: { fontSize: 12.5, color: C.gray, marginTop: 2 } },
        `en attente sur ${liste.length} facture${liste.length > 1 ? "s" : ""} — les plus anciennes d'abord`)),

    h("div", { style: { display: "flex", flexDirection: "column", gap: 10 } },
      liste.map(({ f, jours, reste }) => {
        const el = eleveDe(f.eleveId);
        const ton = tonRelance(jours);
        const occupe = enCours === f.id;
        const relanceJours = f.derniereRelance ? joursDepuis(f.derniereRelance) : null;
        return h("div", {
          key: f.id,
          style: { background: ton.bg, border: `1px solid ${ton.bd}`, borderRadius: 14, padding: 14 }
        },
          h("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, marginBottom: 10 } },
            h("div", { style: { minWidth: 0, flex: 1 } },
              h("div", { style: { fontSize: 15, fontWeight: 700, color: C.texte, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } },
                `${el.prenom} ${el.nom}`),
              h("div", { style: { fontSize: 11.5, color: C.gray, marginTop: 3, lineHeight: 1.5 } },
                f.numero, " • émise il y a ",
                h("span", { style: { color: ton.cl, fontWeight: 700 } }, `${jours} jour${jours > 1 ? "s" : ""}`),
                (Number(f.encaisse) || 0) > 0
                  ? h("span", { style: { color: C.green } }, ` • ${euros(f.encaisse)} déjà versés`)
                  : null),
              relanceJours !== null
                ? h("div", { style: { fontSize: 11, color: C.grisClair, marginTop: 3 } },
                    relanceJours === 0 ? "🔔 relancé aujourd'hui"
                      : `🔔 relancé il y a ${relanceJours} jour${relanceJours > 1 ? "s" : ""}`)
                : h("div", { style: { fontSize: 11, color: C.grisClair, marginTop: 3 } }, "jamais relancé")),
            h("div", { style: { fontSize: 19, fontWeight: 800, color: ton.cl, fontFamily: FD, whiteSpace: "nowrap" } },
              euros(reste))),

          el.tel
            ? h("div", { style: { display: "flex", gap: 6 } },
                h("button", {
                  onClick: () => relancer(f, el, "whatsapp"),
                  disabled: occupe,
                  style: {
                    flex: 2, background: C.whatsappPale, border: `1px solid ${C.whatsappBord}`,
                    borderRadius: 9, padding: "10px 8px", color: "#25d366", fontSize: 13,
                    fontWeight: 700, cursor: occupe ? "wait" : "pointer", fontFamily: "inherit"
                  }
                }, occupe ? "…" : "💬 Relancer par WhatsApp"),
                h("button", {
                  onClick: () => relancer(f, el, "sms"),
                  disabled: occupe,
                  style: {
                    flex: 1, background: C.bluePale, border: `1px solid ${C.blueBord}`,
                    borderRadius: 9, padding: "10px 8px", color: C.blue, fontSize: 13,
                    fontWeight: 700, cursor: occupe ? "wait" : "pointer", fontFamily: "inherit"
                  }
                }, "📱 SMS"))
            : h("div", { style: { fontSize: 12, color: C.gray, fontStyle: "italic" } },
                "Pas de téléphone parent : ajoutez-le dans la fiche de l'élève."));
      })));
}
