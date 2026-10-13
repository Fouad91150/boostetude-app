// ─── ENVOI AU PARENT, EN UN GESTE ────────────────────────────
// Ce que Fouad voulait : un bouton, et le parent reçoit tout — la facture, le
// message, le moyen de payer. WhatsApp ouvert sur le numéro du parent ne sait
// pas joindre de fichier (limite du protocole wa.me) ; on n'y joint donc rien :
// le PDF est déposé en ligne et son LIEN part dans le message, avec le lien de
// paiement Stripe au montant exact. Il ne reste qu'à appuyer sur « Envoyer ».
//
// Si le lien Stripe ou le dépôt du PDF échoue (réseau, clé absente), le message
// part quand même avec ce qui est prêt, et l'écran dit ce qui manque.

// Fenêtre réservée pendant le geste : après un `await`, le téléphone bloquerait
// l'ouverture. À appeler AVANT toute attente.
const reserverFenetre = tel => (tel ? window.open("", "_blank") : null);

const lienConversation = (canal, tel, texte) => canal === "sms"
  ? `sms:${(tel || "").replace(/\s/g, "")}?body=${encodeURIComponent(texte)}`
  : `https://wa.me/${telWhatsApp((tel || "").replace(/\s/g, ""))}?text=${encodeURIComponent(texte)}`;

async function preparerLiens(facture, eleve, parametres) {
  const soucis = [];
  let stripeUrl = null, pdfUrl = null;
  if (resteDu(facture) > 0) {
    try { stripeUrl = await api.lienPaiementStripe(facture.id); }
    catch (e) { soucis.push("lien de paiement par carte (" + (e.message || e) + ")"); }
  }
  try {
    const blob = facturePDFBlob({ ...facture, stripeUrl: stripeUrl || facture.stripeUrl }, eleve, parametres);
    pdfUrl = await api.deposerFacturePDF(facture, eleve, blob);
  } catch (e) { soucis.push("lien du PDF (" + (e.message || e) + ")"); }
  return { stripeUrl, pdfUrl, soucis };
}

async function envoyerAuParent({ facture, eleve, parametres, seuil, fenetre, relance = false, canal = "whatsapp" }) {
  const liens = await preparerLiens(facture, eleve, parametres);
  const texte = relance
    ? makeRappelWhatsApp(eleve, facture.numero, resteDu(facture), facture.datesSeances, Number(facture.encaisse) || 0, liens, parametres)
    : makeFactureWhatsApp(eleve, facture.numero, facture.nbSeances, facture.montant, facture.datesSeances, seuil, facture.prestation, liens, parametres);
  const lien = lienConversation(canal, eleve.tel, texte);
  if (fenetre) fenetre.location = lien;
  else window.open(lien, "_blank", "noopener,noreferrer");
  return { ...liens, texte };
}

// Le bandeau qui suit l'envoi : succès net, ou ce qui manque, sans bloquer.
const direResultatEnvoi = (r, qui, numero) => {
  if (r.soucis.length) signalerInfo(`Facture ${numero} : WhatsApp s'ouvre sur ${qui}, mais sans ${r.soucis.join(" ni ")}. Le PDF peut se joindre depuis la carte (📎).`);
  else signalerSucces(`Facture ${numero} prête — WhatsApp s'ouvre sur ${qui}, avec le PDF et le lien de paiement. Appuyez sur Envoyer.`);
};
