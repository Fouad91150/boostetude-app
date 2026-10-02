import sys, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).parent))
from patcher import appliquer

# ── Les messages de facture disent enfin tout ce qu'un parent doit savoir ────
# Trois manques : on ne disait pas comment payer, on ne disait pas quoi mettre en
# référence d'un virement (d'où des virements anonymes impossibles à rapprocher),
# et on ne prévenait pas que l'envoi est systématique — un parent qui reçoit un
# montant sans contexte appelle pour demander pourquoi.

appliquer("src/app/06-messages.js", [
    ("""const makeFactureEmail = (e, mois, nb, total, dates) => ({
  sujet: `Facture ${mois} — ${e.prenom} ${e.nom} — Boost'Étude`,
  corps: `Bonjour ${e.parent},\\n\\nVoici la facture de ${e.prenom} pour ${mois}.\\n\\nSéances : ${nb} × 2h × ${e.th}€/h${detailMatieresTxt(dates)}\\nTOTAL : ${total}€\\nRèglement : ${e.mp}\\n\\nCordialement,\\nBoost'Étude — M. El Mkhanter\\nboostetude@gmail.com`
});
const makeFactureSMS = (e, mois, nb, total) => `Boost'Étude - Facture ${mois} : bonjour ${e.parent}, facture de ${e.prenom} = ${nb}x2hx${e.th}€ = ${total}€. Merci !`;""",

     """// Toutes les trois séances par défaut — le seuil se règle dans l'onglet Réglages.
const SEUIL_FACTURATION_DEFAUT = 3;

// Trois moyens acceptés. Pour un virement, le nom de l'enfant est indispensable :
// sans lui, un virement arrive sans qu'on sache à qui le rattacher.
const MOYENS_PAIEMENT_TEXTE = e =>
  `Règlement au choix : espèces, chèque ou virement bancaire. ` +
  `Pour un virement, merci d'indiquer « ${e.prenom} ${e.nom} » en référence.`;

const mentionAutomatique = seuil =>
  `Message automatique envoyé toutes les ${seuil || SEUIL_FACTURATION_DEFAUT} séances.`;

const signatureBoost = "Fouad Elmkhanter — Boost'Étude";

const makeFactureEmail = (e, mois, nb, total, dates, seuil) => ({
  sujet: `Facture ${mois} — ${e.prenom} ${e.nom} — Boost'Étude`,
  corps: `Bonjour ${e.parent},\\n\\nVoici la facture de ${e.prenom} pour ${mois}.\\n\\n` +
         `Séances : ${nb} × 2 h × ${e.th} €/h${detailMatieresTxt(dates)}\\n` +
         `TOTAL : ${total} €\\n\\n` +
         `${MOYENS_PAIEMENT_TEXTE(e)}\\n\\n` +
         `La facture détaillée est jointe en PDF.\\n\\n` +
         `Cordialement,\\n${signatureBoost}\\nboostetude@gmail.com\\n\\n` +
         `— ${mentionAutomatique(seuil)}`
});

const makeFactureSMS = (e, mois, nb, total, seuil) =>
  `Boost'Étude — Facture ${mois}\\n` +
  `Bonjour, voici la facture de ${e.prenom} : ${nb} séance${nb > 1 ? "s" : ""} de 2 h, soit ${total} €.\\n` +
  `Espèces, chèque ou virement (référence : ${e.prenom} ${e.nom}).\\n` +
  `${mentionAutomatique(seuil)}`;

// WhatsApp accepte un balisage léger : *gras* et _italique_. Le PDF part à côté,
// par le partage du téléphone — un message seul ne peut pas l'emporter.
const makeFactureWhatsApp = (e, mois, nb, total, dates, seuil) => {
  const detail = groupParMatiere(dates || []);
  const lignes = detail.length > 1
    ? detail.map(g => `• ${g.matiere} : ${g.dates.length} séance${g.dates.length > 1 ? "s" : ""}`).join("\\n") + "\\n"
    : "";
  return `*Boost'Étude — Facture ${mois}*\\n\\n` +
         `Bonjour ${e.parent},\\n\\n` +
         `Voici la facture de ${e.prenom} :\\n` +
         lignes +
         `• ${nb} séance${nb > 1 ? "s" : ""} de 2 h × ${e.th} €/h\\n` +
         `• *Total : ${total} €*\\n\\n` +
         `${MOYENS_PAIEMENT_TEXTE(e)}\\n\\n` +
         `La facture détaillée est jointe en PDF.\\n\\n` +
         `_${mentionAutomatique(seuil)}_\\n\\n` +
         `${signatureBoost}`;
};"""),

    # Le rappel de paiement reprend les mêmes moyens et la même référence.
    ("""const makeRappelEmail = (e, mois, total, dates) => ({
  sujet: `Rappel règlement ${mois} — ${e.prenom} ${e.nom}`,
  corps: `Bonjour ${e.parent},\\n\\nRappel : le règlement de ${total}€ pour ${e.prenom} (${mois}) est en attente.${detailMatieresTxt(dates)}\\n\\nMerci de régler par ${e.mp.toLowerCase()}.\\n\\nBoost'Étude`
});
const makeRappelSMS = (e, mois, total) => `Boost'Étude - Rappel ${mois} : bonjour ${e.parent}, règlement de ${total}€ pour ${e.prenom} en attente. Merci !`;""",

     """const makeRappelEmail = (e, mois, total, dates) => ({
  sujet: `Rappel règlement ${mois} — ${e.prenom} ${e.nom}`,
  corps: `Bonjour ${e.parent},\\n\\nRappel : le règlement de ${total} € pour ${e.prenom} (${mois}) est en attente.${detailMatieresTxt(dates)}\\n\\n` +
         `${MOYENS_PAIEMENT_TEXTE(e)}\\n\\nMerci,\\n${signatureBoost}`
});
const makeRappelSMS = (e, mois, total) =>
  `Boost'Étude — Rappel ${mois}\\n` +
  `Bonjour, le règlement de ${total} € pour ${e.prenom} est en attente.\\n` +
  `Espèces, chèque ou virement (référence : ${e.prenom} ${e.nom}). Merci !`;"""),
], "(messages : moyens de paiement, référence du virement, mention d'envoi automatique)")
