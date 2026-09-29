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
const lundiDe = d => {
  const x = new Date(d + "T00:00:00");
  x.setDate(x.getDate() - (x.getDay() + 6) % 7);
  return x.toISOString().split("T")[0];
};
const addJours = (d, n) => {
  const x = new Date(d + "T00:00:00");
  x.setDate(x.getDate() + n);
  return x.toISOString().split("T")[0];
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
