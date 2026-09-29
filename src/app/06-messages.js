// ─── MESSAGES ────────────────────────────────────────────────
// `detail` : quand l'élève cumule plusieurs matières (ex. Maths + Physique) sur la même
// facture, on précise la répartition séance par matière — sinon on garde le message simple.
const detailMatieresTxt = dates => {
  const groupes = groupParMatiere(dates);
  if (groupes.length < 2) return "";
  return "\n" + groupes.map(g => `- ${g.matiere} : ${g.dates.length} séance${g.dates.length > 1 ? "s" : ""}`).join("\n");
};
const makeFactureEmail = (e, mois, nb, total, dates) => ({
  sujet: `Facture ${mois} — ${e.prenom} ${e.nom} — Boost'Étude`,
  corps: `Bonjour ${e.parent},\n\nVoici la facture de ${e.prenom} pour ${mois}.\n\nSéances : ${nb} × 2h × ${e.th}€/h${detailMatieresTxt(dates)}\nTOTAL : ${total}€\nRèglement : ${e.mp}\n\nCordialement,\nBoost'Étude — M. El Mkhanter\nboostetude@gmail.com`
});
const makeFactureSMS = (e, mois, nb, total) => `Boost'Étude - Facture ${mois} : bonjour ${e.parent}, facture de ${e.prenom} = ${nb}x2hx${e.th}€ = ${total}€. Merci !`;
const makeRappelEmail = (e, mois, total, dates) => ({
  sujet: `Rappel règlement ${mois} — ${e.prenom} ${e.nom}`,
  corps: `Bonjour ${e.parent},\n\nRappel : le règlement de ${total}€ pour ${e.prenom} (${mois}) est en attente.${detailMatieresTxt(dates)}\n\nMerci de régler par ${e.mp.toLowerCase()}.\n\nBoost'Étude`
});
const makeRappelSMS = (e, mois, total) => `Boost'Étude - Rappel ${mois} : bonjour ${e.parent}, règlement de ${total}€ pour ${e.prenom} en attente. Merci !`;
const makeAbsenceEmail = (e, dateLabel, justifie) => ({
  sujet: `Absence de ${e.prenom} ${e.nom} — ${dateLabel} — Boost'Étude`,
  corps: justifie ? `Bonjour ${e.parent},\n\nNous confirmons l'absence justifiée de ${e.prenom} à la séance du ${dateLabel}.\n\nÀ bientôt,\nBoost'Étude — M. El Mkhanter\nboostetude@gmail.com` : `Bonjour ${e.parent},\n\nNous vous informons que ${e.prenom} était absent(e) à la séance du ${dateLabel}. Merci de nous tenir informés du motif si besoin.\n\nCordialement,\nBoost'Étude — M. El Mkhanter\nboostetude@gmail.com`
});
const makeAbsenceSMS = (e, dateLabel, justifie) => justifie ? `Boost'Étude : bonjour ${e.parent}, nous confirmons l'absence justifiée de ${e.prenom} le ${dateLabel}. Merci !` : `Boost'Étude : bonjour ${e.parent}, ${e.prenom} était absent(e) le ${dateLabel}. Merci de nous contacter si besoin.`;
const {
  useState,
  useEffect
} = React;
