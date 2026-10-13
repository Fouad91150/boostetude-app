// ─── MESSAGES ────────────────────────────────────────────────
// `detail` : quand l'élève cumule plusieurs matières (ex. Maths + Physique) sur la même
// facture, on précise la répartition séance par matière — sinon on garde le message simple.
const detailMatieresTxt = dates => {
  const groupes = groupParMatiere(dates);
  if (groupes.length < 2) return "";
  return "\n" + groupes.map(g => `- ${g.matiere} : ${g.dates.length} séance${g.dates.length > 1 ? "s" : ""}`).join("\n");
};
// Toutes les trois séances par défaut — le seuil se règle dans l'onglet Réglages.
const SEUIL_FACTURATION_DEFAUT = 3;

// Trois moyens acceptés. Pour un virement, le nom de l'enfant est indispensable :
// sans lui, un virement arrive sans qu'on sache à qui le rattacher.
// Moyens de règlement 2026-2027 : carte en ligne (Stripe), Wero, virement,
// espèces — plus de chèque. Wero n'est cité que s'il est renseigné dans Réglages.
const MOYENS_PAIEMENT_TEXTE = (e, p) =>
  `Règlement au choix : ${p && p.wero ? `Wero (${p.wero}), ` : ""}virement bancaire ou espèces au cours. ` +
  `Pour un virement, merci d'indiquer « ${e.prenom} ${e.nom} » en référence.`;

// Les deux liens qui font de l'envoi un seul geste : la facture PDF (un lien,
// puisque WhatsApp ouvert sur le bon numéro ne peut pas joindre de fichier) et
// le paiement par carte au montant exact.
const blocLiens = liens => {
  const l = liens || {};
  return (l.pdfUrl ? `📄 *Votre facture (PDF)* :\n${l.pdfUrl}\n\n` : "") +
         (l.stripeUrl ? `💳 *Payer en ligne par carte* :\n${l.stripeUrl}\n\n` : "");
};

const mentionAutomatique = seuil =>
  `Message automatique envoyé toutes les ${seuil || SEUIL_FACTURATION_DEFAUT} séances.`;

const signatureBoost = "Fouad Elmkhanter — Boost'Étude";

// Un stage se vend au forfait : il n'y a pas de séances à compter, seulement un
// libellé et un prix. `prestation`, quand elle est là, remplace le décompte.
const makeFactureEmail = (e, mois, nb, total, dates, seuil, prestation) => ({
  sujet: `Facture ${mois} — ${e.prenom} ${e.nom} — Boost'Étude`,
  corps: `Bonjour ${e.parent},\n\nVoici la facture de ${e.prenom} pour ${mois}.\n\n` +
         (prestation ? `${prestation}\n` : `Séances : ${nb} × 2 h × ${euros(e.th)}/h${detailMatieresTxt(dates)}\n`) +
         `TOTAL : ${montantTxt(total)}\n\n` +
         `${MOYENS_PAIEMENT_TEXTE(e)}\n\n` +
         `La facture détaillée est jointe en PDF.\n\n` +
         `Cordialement,\n${signatureBoost}\nboostetude@gmail.com\n\n` +
         `— ${mentionAutomatique(seuil)}`
});

const makeFactureSMS = (e, mois, nb, total, seuil, prestation) =>
  `Boost'Étude — Facture ${mois}\n` +
  (prestation
    ? `Bonjour, voici la facture de ${e.prenom} — ${prestation} : ${montantTxt(total)}.\n`
    : `Bonjour, voici la facture de ${e.prenom} : ${nb} séance${nb > 1 ? "s" : ""} de 2 h, soit ${montantTxt(total)}.\n`) +
  `Espèces, chèque ou virement (référence : ${e.prenom} ${e.nom}).\n` +
  `${mentionAutomatique(seuil)}`;

// WhatsApp accepte un balisage léger : *gras* et _italique_. Le PDF part à côté,
// par le partage du téléphone — un message seul ne peut pas l'emporter.
const makeFactureWhatsApp = (e, mois, nb, total, dates, seuil, prestation, liens, p) => {
  const detail = groupParMatiere(dates || []);
  const lignes = prestation ? "" : detail.length > 1
    ? detail.map(g => `• ${g.matiere} : ${g.dates.length} séance${g.dates.length > 1 ? "s" : ""}`).join("\n") + "\n"
    : "";
  // Titre sans gras sur toute la ligne : WhatsApp affichait un « * » orphelin
  // (capture du 13/10). Le gras ne porte que sur le numéro.
  return `🧾 *Facture ${mois}* — Boost'Étude\n\n` +
         `Bonjour ${e.parent},\n\n` +
         `Voici la facture de ${e.prenom} :\n` +
         lignes +
         (prestation
           ? `• ${prestation}\n`
           : `• ${nb} séance${nb > 1 ? "s" : ""} de 2 h × ${euros(e.th)}/h\n`) +
         `• *Total : ${montantTxt(total)}*\n\n` +
         blocLiens(liens) +
         `${liens && liens.stripeUrl ? "Ou bien : " + MOYENS_PAIEMENT_TEXTE(e, p).replace(/^Règlement au choix : /, "") : MOYENS_PAIEMENT_TEXTE(e, p)}\n\n` +
         (liens && liens.pdfUrl ? "" : `La facture détaillée est jointe en PDF.\n\n`) +
         `_${mentionAutomatique(seuil)}_\n\n` +
         `${signatureBoost}`;
};
const makeRappelEmail = (e, mois, total, dates) => ({
  sujet: `Rappel règlement ${mois} — ${e.prenom} ${e.nom}`,
  corps: `Bonjour ${e.parent},\n\nRappel : le règlement de ${montantTxt(total)} pour ${e.prenom} (${mois}) est en attente.${detailMatieresTxt(dates)}\n\n` +
         `${MOYENS_PAIEMENT_TEXTE(e)}\n\nMerci,\n${signatureBoost}`
});
const makeRappelSMS = (e, mois, total) =>
  `Boost'Étude — Rappel ${mois}\n` +
  `Bonjour, le règlement de ${montantTxt(total)} pour ${e.prenom} est en attente.\n` +
  `Espèces, chèque ou virement (référence : ${e.prenom} ${e.nom}). Merci !`;
const makeAbsenceEmail = (e, dateLabel, justifie) => ({
  sujet: `Absence de ${e.prenom} ${e.nom} — ${dateLabel} — Boost'Étude`,
  corps: justifie ? `Bonjour ${e.parent},\n\nNous confirmons l'absence justifiée de ${e.prenom} à la séance du ${dateLabel}.\n\nÀ bientôt,\nBoost'Étude — M. El Mkhanter\nboostetude@gmail.com` : `Bonjour ${e.parent},\n\nNous vous informons que ${e.prenom} était absent(e) à la séance du ${dateLabel}. Merci de nous tenir informés du motif si besoin.\n\nCordialement,\nBoost'Étude — M. El Mkhanter\nboostetude@gmail.com`
});
const makeAbsenceSMS = (e, dateLabel, justifie) => justifie ? `Boost'Étude : bonjour ${e.parent}, nous confirmons l'absence justifiée de ${e.prenom} le ${dateLabel}. Merci !` : `Boost'Étude : bonjour ${e.parent}, ${e.prenom} était absent(e) le ${dateLabel}. Merci de nous contacter si besoin.`;
const {
  useState,
  useEffect
} = React;

// Relance : courtoise, précise, et qui rappelle ce qui a déjà été versé — un
// parent qui a donné un acompte n'aime pas qu'on lui réclame la somme entière.
const makeRappelWhatsApp = (e, reference, reste, dates, dejaVerse, liens, p) => {
  const detail = groupParMatiere(dates || []);
  const lignes = detail.length > 1
    ? detail.map(g => `• ${g.matiere} : ${g.dates.length} séance${g.dates.length > 1 ? "s" : ""}`).join("\n") + "\n"
    : "";
  return (reference ? `🔔 *Rappel facture ${reference}* — Boost'Étude` : `🔔 Rappel — Boost'Étude`) + "\n\n" +
         `Bonjour ${e.parent},\n\n` +
         `Un petit rappel au sujet de la facture de ${e.prenom} :\n` +
         lignes +
         ((dejaVerse || 0) > 0 ? `• Déjà versé : ${montantTxt(dejaVerse)}\n` : "") +
         `• *Reste à régler : ${montantTxt(reste)}*\n\n` +
         blocLiens(liens) +
         `${liens && liens.stripeUrl ? "Ou bien : " + MOYENS_PAIEMENT_TEXTE(e, p).replace(/^Règlement au choix : /, "") : MOYENS_PAIEMENT_TEXTE(e, p)}\n\n` +
         `Merci d'avance,\n${signatureBoost}`;
};
