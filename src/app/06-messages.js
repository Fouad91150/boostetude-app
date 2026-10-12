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

// Trois moyens acceptés depuis la 3.5.1 : carte (Stripe), Wero, virement — plus de
// chèque. Pour un Wero ou un virement, le nom de l'enfant est indispensable : sans
// lui, l'argent arrive sans qu'on sache à qui le rattacher.
// L'identifiant Wero (numéro ou e-mail) se règle dans Réglages → Entreprise ;
// l'application le communique ici dès que les réglages sont chargés.
let CONTACT_WERO = "";
const definirContactWero = v => { CONTACT_WERO = String(v || "").trim(); };
const weroTxt = () => `Wero${CONTACT_WERO ? ` au ${CONTACT_WERO}` : ""}`;
const MOYENS_PAIEMENT_TEXTE = (e, lienCarte) =>
  `Règlement au choix : ` +
  (lienCarte
    ? `carte bancaire via le lien ci-dessus (paiement sécurisé Stripe), `
    : `carte bancaire (lien de paiement sécurisé Stripe sur simple demande), `) +
  `${weroTxt()}, virement bancaire ou espèces. ` +
  `Pour un Wero ou un virement, merci d'indiquer « ${e.prenom} ${e.nom} » en référence.`;
// Version courte, pour les SMS.
const moyensCourts = e => `Carte (Stripe), ${weroTxt()}, virement ou espèces (référence : ${e.prenom} ${e.nom}).`;
// Séances payées et séance offerte, pour le décompte des messages.
const nbPayees = (nb, dates) => Math.max(0, (nb || 0) - seancesOffertes(dates).length);
const offerteTxt = dates => seancesOffertes(dates).length ? `1re séance offerte (${fmtDateCourt(seancesOffertes(dates)[0].date)})` : "";

// Le lien de paiement par carte, quand la facture en a un : en tête des moyens de
// règlement, parce que c'est le plus rapide pour le parent.
const ligneCarteWhatsApp = url => url ? `💳 *Payer en ligne par carte :*\n${url}\n\n` : "";
const ligneCarteTexte = url => url ? `Paiement en ligne par carte bancaire : ${url}\n\n` : "";

const mentionAutomatique = seuil =>
  `Message automatique envoyé toutes les ${seuil || SEUIL_FACTURATION_DEFAUT} séances.`;

const signatureBoost = "Fouad Elmkhanter — Boost'Étude";

// Un stage se vend au forfait : il n'y a pas de séances à compter, seulement un
// libellé et un prix. `prestation`, quand elle est là, remplace le décompte.
const makeFactureEmail = (e, mois, nb, total, dates, seuil, prestation, lienCarte) => ({
  sujet: `Facture ${mois} — ${e.prenom} ${e.nom} — Boost'Étude`,
  corps: `Bonjour ${e.parent},\n\nVoici la facture de ${e.prenom} pour ${mois}.\n\n` +
         (prestation ? `${prestation}\n` : `Séances : ${nbPayees(nb, dates)} × 2 h × ${euros(e.th)}/h${detailMatieresTxt(dates)}\n` +
           (offerteTxt(dates) ? `${offerteTxt(dates)} : 0 €\n` : "")) +
         `TOTAL : ${montantTxt(total)}\n\n` +
         ligneCarteTexte(lienCarte) +
         `${MOYENS_PAIEMENT_TEXTE(e, lienCarte)}\n\n` +
         `La facture détaillée est jointe en PDF.\n\n` +
         `Cordialement,\n${signatureBoost}\nboostetude@gmail.com\n\n` +
         `— ${mentionAutomatique(seuil)}`
});

const makeFactureSMS = (e, mois, nb, total, seuil, prestation) =>
  `Boost'Étude — Facture ${mois}\n` +
  (prestation
    ? `Bonjour, voici la facture de ${e.prenom} — ${prestation} : ${montantTxt(total)}.\n`
    : `Bonjour, voici la facture de ${e.prenom} : ${nb} séance${nb > 1 ? "s" : ""} de 2 h, soit ${montantTxt(total)}.\n`) +
  `${moyensCourts(e)}\n` +
  `${mentionAutomatique(seuil)}`;

// WhatsApp accepte un balisage léger : *gras* et _italique_. Le PDF part à côté,
// par le partage du téléphone — un message seul ne peut pas l'emporter.
const makeFactureWhatsApp = (e, mois, nb, total, dates, seuil, prestation, lienCarte) => {
  const detail = groupParMatiere(dates || []);
  const lignes = prestation ? "" : detail.length > 1
    ? detail.map(g => `• ${g.matiere} : ${g.dates.length} séance${g.dates.length > 1 ? "s" : ""}`).join("\n") + "\n"
    : "";
  return `*Boost'Étude — Facture ${mois}*\n\n` +
         `Bonjour ${e.parent},\n\n` +
         `Voici la facture de ${e.prenom} :\n` +
         lignes +
         (prestation
           ? `• ${prestation}\n`
           : `• ${nbPayees(nb, dates)} séance${nbPayees(nb, dates) > 1 ? "s" : ""} de 2 h × ${euros(e.th)}/h\n` +
             (offerteTxt(dates) ? `• 🎁 ${offerteTxt(dates)}\n` : "")) +
         `• *Total : ${montantTxt(total)}*\n\n` +
         ligneCarteWhatsApp(lienCarte) +
         `${MOYENS_PAIEMENT_TEXTE(e, lienCarte)}\n\n` +
         `La facture détaillée est jointe en PDF.\n\n` +
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
  `${moyensCourts(e)} Merci !`;
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
const makeRappelWhatsApp = (e, reference, reste, dates, dejaVerse, lienCarte) => {
  const detail = groupParMatiere(dates || []);
  const lignes = detail.length > 1
    ? detail.map(g => `• ${g.matiere} : ${g.dates.length} séance${g.dates.length > 1 ? "s" : ""}`).join("\n") + "\n"
    : "";
  return `*Boost'Étude — Rappel ${reference || ""}*`.trim() + "\n\n" +
         `Bonjour ${e.parent},\n\n` +
         `Un petit rappel au sujet de la facture de ${e.prenom} :\n` +
         lignes +
         ((dejaVerse || 0) > 0 ? `• Déjà versé : ${montantTxt(dejaVerse)}\n` : "") +
         `• *Reste à régler : ${montantTxt(reste)}*\n\n` +
         ligneCarteWhatsApp(lienCarte) +
         `${MOYENS_PAIEMENT_TEXTE(e, lienCarte)}\n\n` +
         `Merci d'avance,\n${signatureBoost}`;
};
