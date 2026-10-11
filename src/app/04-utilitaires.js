// ─── UTILITAIRES ─────────────────────────────────────────────
const countSeances = (eid, ym, appels, groupes) => {
  const egs = groupes.filter(g => (g.eids || []).includes(eid));
  return Object.entries(appels).reduce((c, [k, p]) => {
    const parts = k.split(":");
    if (parts[0] !== "ap" || !parts[2]?.startsWith(ym)) return c;
    if (!egs.find(g => g.id === parts[1])) return c;
    return p[eid] === "present" ? c + 1 : c;
  }, 0);
};
const seanceDates = (eid, ym, appels, groupes) => {
  const egs = groupes.filter(g => (g.eids || []).includes(eid));
  return Object.entries(appels).filter(([k, p]) => {
    const parts = k.split(":");
    if (parts[0] !== "ap" || !parts[2]?.startsWith(ym)) return false;
    if (!egs.find(g => g.id === parts[1])) return false;
    return p[eid] === "present";
  }).map(([k]) => k.split(":")[2]).sort();
};
const fmtDateCourt = d => new Date(d + "T00:00:00").toLocaleDateString("fr-FR", {
  day: "numeric",
  month: "short"
});
const fmtDateLongue = d => new Date(d + "T00:00:00").toLocaleDateString("fr-FR", {
  day: "numeric",
  month: "long",
  year: "numeric"
});
// Raccourci de rendu. Le fichier historique écrit React.createElement en toutes
// lettres (il sort d'une transpilation JSX) ; le code ajouté depuis utilise `h`,
// strictement équivalent mais lisible dans un diff.
const h = React.createElement;
// Ferme une phrase saisie à la volée, pour que les messages restent soignés.
const phrase = t => {
  const s = (t || "").trim();
  return !s || /[.!?…]$/.test(s) ? s : s + ".";
};

// ── Semaines ─────────────────────────────────────────────────
// Le bilan aux parents se raisonne par semaine du lundi au dimanche.
// Calcul au calendrier local : en France (UTC+1/+2), toISOString() reculait
// chaque date d'un jour et faisait commencer les semaines le dimanche.
const lundiDe = d => {
  const x = new Date(d + "T00:00:00");
  x.setDate(x.getDate() - (x.getDay() + 6) % 7);
  return isoLocal(x);
};
const addJours = (d, n) => {
  const x = new Date(d + "T00:00:00");
  x.setDate(x.getDate() + n);
  return isoLocal(x);
};
// Numéro de semaine ISO ("2026-W40") : identifiant du bilan, pour ne pas
// envoyer deux fois le même à un parent.
const isoSemaine = d => {
  const x = new Date(d + "T00:00:00");
  const t = new Date(Date.UTC(x.getFullYear(), x.getMonth(), x.getDate()));
  t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));
  const jan1 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return `${t.getUTCFullYear()}-W${String(Math.ceil(((t - jan1) / 86400000 + 1) / 7)).padStart(2, "0")}`;
};
const libelleSemaine = lundi => {
  const a = new Date(lundi + "T00:00:00"), b = new Date(addJours(lundi, 6) + "T00:00:00");
  return a.getMonth() === b.getMonth()
    ? `${a.getDate()} – ${b.getDate()} ${MOIS_L[b.getMonth()].toLowerCase()}`
    : `${a.getDate()} ${MOIS_L[a.getMonth()].toLowerCase()} – ${b.getDate()} ${MOIS_L[b.getMonth()].toLowerCase()}`;
};
// Jour de la semaine d'une date, au format des groupes ("Mercredi").
const jourDeLaDate = d => JOURS[(new Date(d + "T00:00:00").getDay() + 6) % 7];
// Une séance ne peut pas avoir eu lieu dans le futur. Le 11/10, un appel daté
// du 30/10 (un vendredi, pour un groupe du mercredi) avait compté cinq
// absences fantômes et déclenché une alerte aux parents.
const estFuture = d => !!d && d > todayStr();
const fmtJourCourt = d => new Date(d + "T00:00:00").toLocaleDateString("fr-FR", { weekday: "short", day: "numeric" });

// Découpe un champ libre ("Thalès, calcul littéral") en notions distinctes,
// pour les dédoublonner dans le bilan et les reproposer en suggestions.
const splitNotions = txt => (txt || "").split(/[,;\n•]+/).map(s => s.trim()).filter(Boolean);

// Format international sans « + », exigé par les liens wa.me.
// "06 12 34 56 78" → "33612345678".
const telWhatsApp = tel => {
  const t = (tel || "").replace(/[^\d+]/g, "");
  if (t.startsWith("+")) return t.slice(1);
  if (t.startsWith("00")) return t.slice(2);
  if (t.startsWith("0")) return "33" + t.slice(1);
  return t;
};

// Montant d'un document comptable : toujours deux décimales, virgule française.
const euros = montant => {
  const n = Number(montant);
  return (Number.isFinite(n) ? n : 0).toFixed(2).replace(".", ",") + " €";
};
// Montant d'un message : « 75 € » si le compte est rond, « 74,50 € » sinon.
const montantTxt = montant => {
  const n = Number(montant);
  if (!Number.isFinite(n)) return "0 €";
  return (Number.isInteger(n) ? String(n) : n.toFixed(2).replace(".", ",")) + " €";
};
