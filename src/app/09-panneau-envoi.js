// ─── PANNEAU ENVOI ────────────────────────────────────────────
// Ce que le téléphone sait faire, et ce qu'il ne sait pas :
//
//  · Le PDF ne peut rejoindre une conversation que par le partage du système
//    (menu « Partager »), qui dépose le fichier dans WhatsApp, un mail, Drive.
//  · Un SMS ne transporte pas de pièce jointe — jamais, c'est le protocole. Le
//    message SMS porte donc le montant et les modalités, pas la facture.
//  · Les liens wa.me / sms: / mailto: ne portent que du texte, d'où deux gestes
//    distincts : partager le fichier, puis envoyer le message (ou l'inverse).
//
// Rien n'est envoyé par l'application : tout part du téléphone de Fouad, depuis
// son propre numéro. Aucun abonnement à un service d'envoi, aucune donnée confiée
// à un tiers.
function PanneauEnvoi({
  eleve,
  mois,
  nb,
  montant,
  dates,
  type,
  justifie,
  facture,
  parametres,
  seuil
}) {
  // Pour une absence, l'aperçu s'ouvre par défaut : la formulation exacte doit être
  // visible avant l'envoi, pas seulement accessible via l'œil.
  const [apercu, setApercu] = useState(type === "absence" ? "email" : null);
  const [copie, setCopie] = useState(null);
  const [envoiPDF, setEnvoiPDF] = useState(false);

  const isF = type === "facture";
  const isA = type === "absence";
  const accent = isF ? C.green : isA ? C.blue : C.orange;
  const fondBase = isF ? C.greenPale : isA ? C.bluePale : C.orangePale;
  const bordBase = isF ? C.greenBord : isA ? C.blueBord : C.orangeBord;

  // Forfait de stage : le message annonce la prestation, pas un décompte de séances.
  const forfait = (facture && facture.prestation) || null;

  const emailData = isF ? makeFactureEmail(eleve, mois, nb, montant, dates, seuil, forfait)
    : isA ? makeAbsenceEmail(eleve, mois, justifie)
    : makeRappelEmail(eleve, mois, montant, dates);
  const smsText = isF ? makeFactureSMS(eleve, mois, nb, montant, seuil, forfait)
    : isA ? makeAbsenceSMS(eleve, mois, justifie)
    : makeRappelSMS(eleve, mois, montant);
  // WhatsApp accepte un texte plus long et un balisage léger : on lui donne la
  // version soignée plutôt que le SMS tronqué.
  const waText = isF ? makeFactureWhatsApp(eleve, mois, nb, montant, dates, seuil, forfait) : smsText;

  const tel = (eleve.tel || "").replace(/\s/g, "");
  const hrefEmail = `mailto:${eleve.email}?subject=${encodeURIComponent(emailData.sujet)}&body=${encodeURIComponent(emailData.corps)}`;
  const hrefSMS = `sms:${tel}?body=${encodeURIComponent(smsText)}`;
  const hrefWA = `https://wa.me/${telWhatsApp(tel)}?text=${encodeURIComponent(waText)}`;

  // Le PDF n'a de sens que pour une facture émise : un brouillon n'a pas de numéro
  // et son montant bouge encore à chaque séance pointée.
  const pdfPossible = isF && facture && facture.numero;

  const copier = (txt, key) => {
    const fait = () => {
      setCopie(key);
      setTimeout(() => setCopie(null), 2000);
    };
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(txt).then(fait).catch(() => copierFallback(txt, fait));
    } else {
      copierFallback(txt, fait);
    }
  };
  const copierFallback = (txt, fait) => {
    try {
      const ta = document.createElement("textarea");
      ta.value = txt;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      fait();
    } catch (e) {}
  };

  const partagerPDF = async () => {
    setEnvoiPDF(true);
    try {
      const r = await partagerFacturePDF(facture, eleve, parametres, waText);
      if (r.telecharge) signalerInfo("PDF téléchargé. Votre appareil ne sait pas partager de fichier : joignez-le depuis WhatsApp ou votre messagerie.");
      else if (r.partage) signalerSucces("Facture partagée.");
    } catch (e) {
      signalerErreur(e);
    }
    setEnvoiPDF(false);
  };

  const telechargerPDF = () => {
    try {
      telechargerBlob(facturePDFBlob(facture, eleve, parametres), nomFichierFacture(facture, eleve));
      signalerSucces("PDF téléchargé.");
    } catch (e) {
      signalerErreur(e);
    }
  };

  // Un canal = un lien pour agir, un œil pour relire, un bouton pour copier.
  const canal = (cle, libelle, href, texte, couleur, fond, bord) => h("div", {
    key: cle,
    style: { display: "flex", gap: 4, flex: "1 1 100%", minWidth: 0 }
  },
    h("a", {
      href, target: "_blank", rel: "noopener noreferrer",
      style: {
        flex: 1, background: fond, border: `1px solid ${bord}`, borderRadius: 10,
        padding: "10px 6px", color: couleur, textDecoration: "none", fontSize: 13,
        fontWeight: 700, textAlign: "center", display: "block"
      }
    }, libelle),
    h("button", {
      onClick: () => setApercu(apercu === cle ? null : cle),
      style: {
        background: C.surface, border: `1px solid ${C.bord}`,
        borderRadius: 10, padding: "10px 8px", color: C.gray, cursor: "pointer",
        fontSize: 11, fontWeight: 700, fontFamily: "inherit"
      }
    }, "👁"),
    h("button", {
      onClick: () => copier(texte, cle),
      title: "Copier le message",
      style: {
        background: copie === cle ? C.greenPale : C.surface,
        border: `1px solid ${C.bord}`, borderRadius: 10, padding: "10px 8px",
        color: copie === cle ? C.green : C.gray, cursor: "pointer",
        fontSize: 11, fontWeight: 700, fontFamily: "inherit"
      }
    }, copie === cle ? "✅" : "📋"));

  const texteApercu = { email: emailData.corps, sms: smsText, wa: waText }[apercu];

  return h("div", {
    style: {
      background: fondBase, border: `1px solid ${bordBase}`,
      borderRadius: 12, padding: 12, marginTop: 8
    }
  },
    h(Lbl, { text: isF ? "📤 Envoyer la facture" : isA ? "✉️ Prévenir le parent" : "📨 Rappel paiement" }),

    // ── Le fichier : un geste à part, le seul qui emporte vraiment la facture ──
    pdfPossible && h("div", { style: { display: "flex", gap: 6, marginBottom: 10 } },
      h("button", {
        onClick: partagerPDF,
        disabled: envoiPDF,
        style: {
          flex: 1, background: C.navy, border: `1px solid ${C.navy}`,
          borderRadius: 10, padding: "11px 10px", color: "#fff", fontSize: 13.5, fontWeight: 600,
          cursor: envoiPDF ? "wait" : "pointer", fontFamily: "inherit", opacity: envoiPDF ? 0.6 : 1
        }
      }, envoiPDF ? "Préparation…" : "📎 Partager la facture PDF"),
      h("button", {
        onClick: telechargerPDF,
        title: "Télécharger le PDF",
        style: {
          background: C.surface, border: `1px solid ${C.bord}`,
          borderRadius: 10, padding: "11px 12px", color: C.gray, cursor: "pointer",
          fontSize: 13, fontFamily: "inherit"
        }
      }, "⤓")),

    apercu && h("div", {
      style: {
        background: C.surface2, borderRadius: 10, padding: 10, marginBottom: 8,
        fontSize: 12, color: C.texte, lineHeight: 1.6, whiteSpace: "pre-line",
        border: `1px solid ${C.bord}`
      }
    },
      apercu === "email" && h("div", { style: { fontSize: 11, color: C.gold, fontWeight: 700, marginBottom: 6 } },
        "Objet : " + emailData.sujet),
      texteApercu,
      h("button", {
        onClick: () => setApercu(null),
        style: { display: "block", marginTop: 8, background: "none", border: "none", color: C.gray, cursor: "pointer", fontSize: 12, fontFamily: "inherit" }
      }, "✕ Fermer")),

    h("div", { style: { display: "flex", flexWrap: "wrap", gap: 8 } },
      eleve.tel ? canal("wa", "💬 WhatsApp", hrefWA, waText, "#0b6b37", C.whatsappPale, C.whatsappBord) : null,
      eleve.tel ? canal("sms", "📱 SMS", hrefSMS, smsText, C.blue, C.bluePale, C.blueBord) : null,
      eleve.email ? canal("email", "✉️ Email", hrefEmail, emailData.corps, accent, fondBase, bordBase) : null,
      !eleve.email && !eleve.tel && h("div", { style: { fontSize: 12, color: C.gray, fontStyle: "italic" } },
        "Ajoutez un email ou un téléphone parent pour envoyer.")),

    (eleve.email || eleve.tel) && h("div", { style: { fontSize: 11, color: C.gray, marginTop: 8, lineHeight: 1.55 } },
      pdfPossible
        ? "Le SMS ne peut pas porter de pièce jointe. Pour envoyer vraiment le PDF, utilisez « Partager la facture PDF » puis choisissez WhatsApp ou votre messagerie — le message part avec le fichier."
        : "Sur ordinateur, ces boutons n'ouvrent une application que si une messagerie par défaut est configurée. Sinon utilisez 📋 pour copier le message."));
}
