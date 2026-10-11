// ─── ALERTE ABSENCES RÉPÉTÉES ────────────────────────────────
// Une absence isolée se signale séance par séance (onglet Parents de l'appel).
// Trois absences non justifiées, c'est autre chose : un décrochage qui commence,
// et un parent qui ne le sait peut-être pas. L'application le repère et prépare
// le message ; l'envoi, comme partout, reste un geste de Fouad.
//
// Règles retenues :
//  · seules les absences NON justifiées comptent — un parent qui a prévenu n'a
//    pas à recevoir d'alerte ;
//  · le compte court sur l'année scolaire (1er septembre → 31 août) ;
//  · l'alerte revient par paliers : 3e absence, puis 6e, 9e…
//  · « Parent prévenu » est mémorisé sur l'appareil, par élève et par palier.
const SEUIL_ALERTE_ABSENCES = 3;

const debutAnneeScolaire = d => {
  const [y, m] = (d || todayStr()).split("-").map(Number);
  return `${m >= 9 ? y : y - 1}-09-01`;
};
const finAnneeScolaire = d => `${Number(debutAnneeScolaire(d).slice(0, 4)) + 1}-08-31`;

// Dates des absences non justifiées de l'élève sur l'année scolaire de `ref`,
// tous groupes confondus (un élève inscrit en maths et en physique peut manquer
// deux séances le même jour : ce sont bien deux absences).
// Rien au-delà de la date de référence : une séance à venir n'a pas eu lieu.
const absencesNonJustifiees = (eid, appels, ref) => {
  const debut = debutAnneeScolaire(ref), fin = finAnneeScolaire(ref);
  return Object.entries(appels || {}).filter(([k, p]) => {
    const [t, , d] = k.split(":");
    return t === "ap" && d >= debut && d <= fin && d <= (ref || todayStr()) && p && p[eid] === "absent_nj";
  }).map(([k]) => k.split(":")[2]).sort();
};

const paliersAbsences = (n, seuil = SEUIL_ALERTE_ABSENCES) => Math.floor(n / seuil);
const cleAlerteAbsences = (eid, ref) => `bo:alerte-abs:${eid}:${debutAnneeScolaire(ref)}`;
const palierPrevenu = (eid, ref) => Number(Local.lire(cleAlerteAbsences(eid, ref), 0)) || 0;
const marquerPrevenu = (eid, ref, palier) => Local.ecrire(cleAlerteAbsences(eid, ref), palier);

// L'élève a-t-il franchi un palier dont le parent n'a pas encore été prévenu ?
const alerteAbsences = (eid, appels, ref, seuil = SEUIL_ALERTE_ABSENCES) => {
  const dates = absencesNonJustifiees(eid, appels, ref);
  const palier = paliersAbsences(dates.length, seuil);
  if (palier < 1 || palierPrevenu(eid, ref) >= palier) return null;
  return { dates, palier, nb: dates.length };
};

const elevesEnAlerteAbsences = (eleves, appels, ref, seuil = SEUIL_ALERTE_ABSENCES) =>
  (eleves || []).map(e => {
    const a = alerteAbsences(e.id, appels, ref, seuil);
    return a ? { eleve: e, ...a } : null;
  }).filter(Boolean).sort((a, b) => b.nb - a.nb);

// ── Messages ────────────────────────────────────────────────
// Le ton : inquiet pour l'élève, pas accusateur envers le parent. On donne les
// dates — un parent qui croyait son enfant en cours doit pouvoir vérifier — et
// on ouvre la porte à une discussion plutôt qu'on ne réclame un justificatif.
const listeDatesAbsences = (dates, puce) => dates.map(d => `${puce} ${fmtDateLongue(d)}`).join("\n");

const makeAlerteAbsencesEmail = (e, dates) => ({
  sujet: `Absences répétées de ${e.prenom} ${e.nom} — Boost'Étude`,
  corps: `Bonjour ${e.parent || ""},\n\n`.replace(" ,", ",") +
         `${e.prenom} a manqué ${dates.length} séances sans justificatif depuis la rentrée :\n` +
         `${listeDatesAbsences(dates, "-")}\n\n` +
         `En petit groupe, la régularité fait l'essentiel des progrès, et chaque séance manquée se rattrape difficilement. ` +
         `Pourriez-vous nous dire ce qui empêche ${e.prenom} de venir ? Nous sommes disponibles pour en parler et trouver ensemble une solution.\n\n` +
         `Cordialement,\n${signatureBoost}\nboostetude@gmail.com`
});

const makeAlerteAbsencesSMS = (e, dates) =>
  `Boost'Étude : bonjour, ${e.prenom} a manqué ${dates.length} séances sans justificatif depuis la rentrée ` +
  `(${dates.slice(-3).map(fmtDateCourt).join(", ")}). Pouvez-vous nous rappeler pour en parler ? Merci.`;

const makeAlerteAbsencesWhatsApp = (e, dates) =>
  `*Boost'Étude — Absences de ${e.prenom}*\n\n` +
  `Bonjour ${e.parent || ""},\n\n`.replace(" ,", ",") +
  `${e.prenom} a manqué *${dates.length} séances sans justificatif* depuis la rentrée :\n` +
  `${listeDatesAbsences(dates, "•")}\n\n` +
  `La régularité fait l'essentiel des progrès en petit groupe. Pourriez-vous nous dire ce qui empêche ${e.prenom} de venir ? ` +
  `Nous sommes disponibles pour en parler.\n\n` +
  `${signatureBoost}`;

// ── Carte d'alerte ──────────────────────────────────────────
function CarteAlerteAbsences({ eleve, dates, palier, refDate }) {
  const [prevenu, setPrevenu] = useState(false);
  const ref = refDate || todayStr();

  if (prevenu) return h("div", {
    style: {
      background: C.greenPale, border: `1px solid ${C.greenBord}`, borderRadius: 12,
      padding: "10px 14px", display: "flex", alignItems: "center", gap: 10, fontSize: 13
    }
  },
    h("span", null, "✅"),
    h("div", { style: { flex: 1, color: C.texte } }, "Parent de ", h("b", null, eleve.prenom), " prévenu des absences répétées."),
    h("button", {
      onClick: () => { marquerPrevenu(eleve.id, ref, palier - 1); setPrevenu(false); },
      style: { background: "none", border: "none", color: C.gold, cursor: "pointer", fontSize: 12, fontWeight: 700, fontFamily: "inherit" }
    }, "Annuler"));

  return h("div", {
    style: { background: C.surface, border: `2px solid ${C.red}`, borderRadius: 14, padding: 14 }
  },
    h("div", { style: { display: "flex", alignItems: "center", gap: 10 } },
      h(Avatar, { p: eleve.prenom, n: eleve.nom }),
      h("div", { style: { flex: 1, minWidth: 0 } },
        h("div", { style: { fontSize: 15, fontWeight: 800, color: C.texte, fontFamily: FD } }, eleve.prenom, " ", eleve.nom),
        h("div", { style: { fontSize: 12, color: C.gray } }, eleve.parent || "Parent", eleve.tel ? ` • 📱 ${eleve.tel}` : "")),
      h("span", {
        style: { fontSize: 11, fontWeight: 800, color: "#fff", background: C.red, padding: "4px 9px", borderRadius: 20, whiteSpace: "nowrap" }
      }, `🚨 ${dates.length} absences`)),
    h("div", { style: { fontSize: 12.5, color: C.red, fontWeight: 700, margin: "10px 0 6px" } },
      `${dates.length} absences non justifiées depuis la rentrée`),
    h("div", { style: { display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 4 } },
      dates.map((d, i) => h("span", {
        key: d + i,
        style: { fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: 20, background: C.redPale, color: C.red, border: `1px solid ${C.redBord}` }
      }, fmtDateCourt(d)))),
    h(PanneauEnvoi, { eleve, mois: "", type: "alerte_absences", dates }),
    h("button", {
      onClick: () => { marquerPrevenu(eleve.id, ref, palier); setPrevenu(true); },
      style: {
        width: "100%", marginTop: 10, background: C.navy, border: "none", borderRadius: 10,
        padding: 11, color: "#fff", fontSize: 13.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit"
      }
    }, "✓ Parent prévenu"));
}

// Bloc de l'accueil : tous les élèves à alerter, ou rien du tout.
function BlocAlertesAbsences({ eleves, appels }) {
  const ref = todayStr();
  const liste = elevesEnAlerteAbsences(eleves, appels, ref);
  if (!liste.length) return null;
  return h("div", { style: { marginBottom: 16 } },
    h("div", { style: { fontSize: 13, fontWeight: 800, color: C.red, marginBottom: 4 } },
      `🚨 Absences répétées — ${liste.length} parent${liste.length > 1 ? "s" : ""} à prévenir`),
    h("div", { style: { fontSize: 11.5, color: C.gray, marginBottom: 10, lineHeight: 1.5 } },
      `Alerte à chaque palier de ${SEUIL_ALERTE_ABSENCES} absences non justifiées depuis la rentrée.`),
    h("div", { style: { display: "flex", flexDirection: "column", gap: 10 } },
      liste.map(a => h(CarteAlerteAbsences, { key: a.eleve.id, eleve: a.eleve, dates: a.dates, palier: a.palier, refDate: ref }))));
}
