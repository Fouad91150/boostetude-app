// ─── PANNEAU ENVOI ────────────────────────────────────────────
function PanneauEnvoi({
  eleve,
  mois,
  nb,
  montant,
  dates,
  type,
  justifie
}) {
  // Pour une absence, l'aperçu s'ouvre par défaut : la formulation exacte doit être visible
  // avant l'envoi, pas seulement accessible via l'œil 👁.
  const [apercu, setApercu] = useState(type === "absence" ? "email" : null);
  const [copie, setCopie] = useState(null);
  const isF = type === "facture";
  const isA = type === "absence";
  const accent = isF ? C.green : isA ? C.blue : C.orange;
  const bgBase = isF ? "rgba(76,175,125," : isA ? "rgba(74,158,221," : "rgba(224,144,48,";
  const emailData = isF ? makeFactureEmail(eleve, mois, nb, montant, dates) : isA ? makeAbsenceEmail(eleve, mois, justifie) : makeRappelEmail(eleve, mois, montant, dates);
  const smsText = isF ? makeFactureSMS(eleve, mois, nb, montant) : isA ? makeAbsenceSMS(eleve, mois, justifie) : makeRappelSMS(eleve, mois, montant);
  const tel = (eleve.tel || "").replace(/\s/g, "");
  const hrefEmail = `mailto:${eleve.email}?subject=${encodeURIComponent(emailData.sujet)}&body=${encodeURIComponent(emailData.corps)}`;
  const hrefSMS = `sms:${tel}?body=${encodeURIComponent(smsText)}`;
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
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: `${bgBase}.07)`,
      border: `1px solid ${bgBase}.22)`,
      borderRadius: 12,
      padding: "12px",
      marginTop: 8
    }
  }, /*#__PURE__*/React.createElement(Lbl, {
    text: isF ? "📤 Envoyer la facture" : isA ? "✉️ Prévenir le parent" : "📨 Rappel paiement"
  }), apercu && /*#__PURE__*/React.createElement("div", {
    style: {
      background: "rgba(0,0,0,.4)",
      borderRadius: 8,
      padding: "10px",
      marginBottom: 8,
      fontSize: 12,
      color: C.cream,
      lineHeight: 1.6,
      whiteSpace: "pre-line",
      border: "1px solid rgba(255,255,255,.08)"
    }
  }, apercu === "email" && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      color: C.gold,
      fontWeight: 700,
      marginBottom: 6
    }
  }, "Objet : ", emailData.sujet), apercu === "sms" ? smsText : emailData.corps, /*#__PURE__*/React.createElement("button", {
    onClick: () => setApercu(null),
    style: {
      display: "block",
      marginTop: 8,
      background: "none",
      border: "none",
      color: C.gray,
      cursor: "pointer",
      fontSize: 12,
      fontFamily: "inherit"
    }
  }, "✕ Fermer")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8
    }
  }, eleve.email && /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 4,
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("a", {
    href: hrefEmail,
    target: "_blank",
    rel: "noopener noreferrer",
    style: {
      flex: 1,
      background: `${bgBase}.15)`,
      border: `1px solid ${bgBase}.4)`,
      borderRadius: 10,
      padding: "10px 6px",
      color: accent,
      textDecoration: "none",
      fontSize: 13,
      fontWeight: 700,
      textAlign: "center",
      display: "block"
    }
  }, "✉️ Email"), /*#__PURE__*/React.createElement("button", {
    onClick: () => setApercu(apercu === "email" ? null : "email"),
    style: {
      background: "rgba(255,255,255,.07)",
      border: "1px solid rgba(255,255,255,.1)",
      borderRadius: 10,
      padding: "10px 8px",
      color: C.gray,
      cursor: "pointer",
      fontSize: 11,
      fontWeight: 700,
      fontFamily: "inherit"
    }
  }, "👁"), /*#__PURE__*/React.createElement("button", {
    onClick: () => copier(emailData.corps, "email"),
    title: "Copier le message",
    style: {
      background: copie === "email" ? "rgba(76,175,125,.25)" : "rgba(255,255,255,.07)",
      border: "1px solid rgba(255,255,255,.1)",
      borderRadius: 10,
      padding: "10px 8px",
      color: copie === "email" ? C.green : C.gray,
      cursor: "pointer",
      fontSize: 11,
      fontWeight: 700,
      fontFamily: "inherit"
    }
  }, copie === "email" ? "✅" : "📋")), eleve.tel && /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 4,
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("a", {
    href: hrefSMS,
    target: "_blank",
    rel: "noopener noreferrer",
    style: {
      flex: 1,
      background: "rgba(74,158,221,.15)",
      border: "1px solid rgba(74,158,221,.4)",
      borderRadius: 10,
      padding: "10px 6px",
      color: C.blue,
      textDecoration: "none",
      fontSize: 13,
      fontWeight: 700,
      textAlign: "center",
      display: "block"
    }
  }, "📱 SMS"), /*#__PURE__*/React.createElement("button", {
    onClick: () => setApercu(apercu === "sms" ? null : "sms"),
    style: {
      background: "rgba(255,255,255,.07)",
      border: "1px solid rgba(255,255,255,.1)",
      borderRadius: 10,
      padding: "10px 8px",
      color: C.gray,
      cursor: "pointer",
      fontSize: 11,
      fontWeight: 700,
      fontFamily: "inherit"
    }
  }, "👁"), /*#__PURE__*/React.createElement("button", {
    onClick: () => copier(smsText, "sms"),
    title: "Copier le message",
    style: {
      background: copie === "sms" ? "rgba(76,175,125,.25)" : "rgba(255,255,255,.07)",
      border: "1px solid rgba(255,255,255,.1)",
      borderRadius: 10,
      padding: "10px 8px",
      color: copie === "sms" ? C.green : C.gray,
      cursor: "pointer",
      fontSize: 11,
      fontWeight: 700,
      fontFamily: "inherit"
    }
  }, copie === "sms" ? "✅" : "📋")), !eleve.email && !eleve.tel && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: C.gray,
      fontStyle: "italic"
    }
  }, "Ajoutez un email ou un téléphone parent pour envoyer.")), (eleve.email || eleve.tel) && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      color: C.gray,
      marginTop: 6,
      lineHeight: 1.5
    }
  }, "Sur ordinateur, ✉️/📱 n'ouvrent une appli que si une messagerie par défaut est configurée. Sinon utilisez 📋 pour copier le message et le coller dans votre mail ou SMS."));
}
