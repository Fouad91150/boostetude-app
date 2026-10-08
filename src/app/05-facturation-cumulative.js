// ─── FACTURATION CUMULATIVE ────────────────────────────────────
// La dernière facture payée d'un élève marque la fin de la période déjà réglée.
// Tout ce qui suit (séances présentes après cette date) s'accumule sur une facture
// ouverte unique, jusqu'à ce qu'elle soit à son tour marquée payée.
// Une facture est « figée » dès qu'elle porte un numéro — elle est partie chez le
// parent — ou qu'elle est soldée. Les séances qu'elle couvre sont définitivement
// facturées ; les suivantes alimentent un nouveau brouillon, même si le parent n'a
// encore rien versé. Sans cela, une facture émise continuerait de grossir après
// avoir été envoyée, et son montant ne vaudrait plus rien.
const dernierePeriodeFin = (eid, factures) => {
  // Un stage de vacances se facture à part, au forfait : sa période ne doit pas
  // faire croire que les cours de la même semaine ont déjà été réglés.
  const figees = (factures || []).filter(f =>
    f.eleveId === eid && !f.stageId && f.statut !== "annulee" && (f.statut === "paye" || f.numero));
  let fin = null;
  figees.forEach(f => {
    const dates = f.datesSeances || [];
    const derniere = dates.reduce((max, d) => (!max || d.date > max ? d.date : max), f.periodeFin || null);
    if (derniere && (!fin || derniere > fin)) fin = derniere;
  });
  return fin;
};

// Ce qu'il reste à régler sur une facture, une fois les versements déduits.
const resteDu = f => Math.max(0, Math.round(((f?.montant || 0) - (f?.encaisse || 0)) * 100) / 100);
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
