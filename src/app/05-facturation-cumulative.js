// ─── FACTURATION CUMULATIVE ────────────────────────────────────
// La dernière facture payée d'un élève marque la fin de la période déjà réglée.
// Tout ce qui suit (séances présentes après cette date) s'accumule sur une facture
// ouverte unique, jusqu'à ce qu'elle soit à son tour marquée payée.
const dernierePeriodeFin = (eid, factures) => {
  const payees = factures.filter(f => f.eleveId === eid && f.statut === "paye" && f.periodeFin);
  if (!payees.length) return null;
  return payees.reduce((max, f) => f.periodeFin > max ? f.periodeFin : max, payees[0].periodeFin);
};
// Chaque séance renvoyée porte sa matière (un même élève peut suivre plusieurs
// matières, ex. Maths + Physique) afin que la facture détaille quoi a été suivi.
const seancesOuvertes = (eid, appels, groupes, depuis) => {
  const egs = groupes.filter(g => (g.eids || []).includes(eid));
  return Object.entries(appels).filter(([k, p]) => {
    const parts = k.split(":");
    if (parts[0] !== "ap") return false;
    if (!egs.find(g => g.id === parts[1])) return false;
    if (depuis && parts[2] <= depuis) return false;
    return p[eid] === "present";
  }).map(([k]) => {
    const parts = k.split(":");
    const g = egs.find(x => x.id === parts[1]);
    return {
      date: parts[2],
      matiere: g?.matiere || ""
    };
  }).sort((a, b) => a.date.localeCompare(b.date));
};
// Regroupe une liste de séances {date,matiere} par matière, en conservant l'ordre
// d'apparition — utilisé partout où la facture doit détailler Maths/Physique séparément.
const groupParMatiere = dates => {
  const map = new Map();
  (dates || []).forEach(d => {
    const mat = d.matiere || "Cours";
    if (!map.has(mat)) map.set(mat, []);
    map.get(mat).push(d.date);
  });
  return Array.from(map, ([matiere, dates]) => ({
    matiere,
    dates
  }));
};
const horaireLabel = g => {
  if (g.jour && g.hd && g.hf) return `🕐 ${g.hd}–${g.hf} • ${g.jour}`;
  return "🕐 Horaire à définir";
};
