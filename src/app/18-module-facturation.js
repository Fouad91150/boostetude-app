// ─── MODULE FACTURATION ──────────────────────────────────────
function ModuleFacturation({
  eleves,
  groupes,
  appels,
  factures,
  onSaveFacture,
  onDeleteFacture,
  onDeleteFactureEnCours,
  parametres,
  onEmettreFacture,
  onRecharger,
  encaissements,
  onAjouterVersement,
  onSupprimerVersement,
  onAnnulerFacture,
  onRetablirFacture,
  onRelancer,
  ongletInitial
}) {
  const [onglet, setOnglet] = useState(ongletInitial || "encours");
  const [envoiEnCours, setEnvoiEnCours] = useState(null);
  const [modal, setModal] = useState(null); // {e,f,dates}
  const [impression, setImpression] = useState(null); // {f,e}
  const [toast, setToast] = useState(null);
  const [suppression, setSuppression] = useState(false);
  const showToast = msg => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };
  const eleveDe = eid => eleves.find(x => x.id === eid);
  // Ne reste à enregistrer que la note : le montant vient de l'appel, et le statut
  // se déduit des versements.
  const handleSave = async data => {
    await onSaveFacture(modal.f?.id || null, modal.e.id, { ...modal.f, ...data });
  };
  const encaissementsDe = fid => (encaissements || []).filter(e => e.factureId === fid);
  // Renvoie true si la suppression a bien eu lieu (permet d'attendre la confirmation
  // avant de fermer une vue, ex. la fiche d'impression, sans la fermer si on annule).
  const handleDelete = async factureId => {
    if (!window.confirm("Supprimer définitivement cette facture ? Cette action est irréversible.")) return false;
    setSuppression(true);
    let ok = false;
    try {
      await onDeleteFacture(factureId);
      showToast("Facture supprimée ✓");
      ok = true;
    } catch (e) {
      signalerErreur(e);
    }
    setSuppression(false);
    return ok;
  };
  // Une facture "en cours" est entièrement recalculée depuis l'appel : supprimer seulement
  // la ligne facture ne suffit pas, le même montant réapparaîtrait aussitôt. On retire donc
  // aussi les séances présentes sous-jacentes (utile pour nettoyer un test, par exemple).
  const handleDeleteEnCours = async (factureId, eleveId, dates) => {
    if (!window.confirm("Supprimer ces séances de l'appel et la facture en cours associée ? Cette action retire ces séances de l'historique de présence et est irréversible.")) return false;
    setSuppression(true);
    let ok = false;
    try {
      await onDeleteFactureEnCours(factureId, eleveId, dates);
      showToast("Facture en cours supprimée ✓");
      ok = true;
    } catch (e) {
      signalerErreur(e);
    }
    setSuppression(false);
    return ok;
  };
  // Émettre puis partager, sans repasser par l'écran de la facture.
  const emettreEtEnvoyer = async (f, el) => {
    const manquants = champsManquants(parametres);
    if (manquants.length) {
      signalerErreur({ message: "Complétez d'abord vos informations légales dans Réglages : " + manquants.join(", ") });
      return;
    }
    // Une seule confirmation, parce qu'une facture émise reçoit un numéro définitif :
    // la séquence comptable ne tolère ni trou ni doublon, on ne défait pas une émission.
    if (!window.confirm(`Émettre la facture de ${el.prenom} (${f.montant} €) et l'envoyer au parent ?\n\nElle recevra un numéro définitif et son montant sera figé.`)) return;

    // Le partage système (menu « Partager ») sait joindre le PDF, mais il demande
    // ensuite à qui l'envoyer : à dix-huit élèves, c'est dix-huit occasions de se
    // tromper de conversation. Un lien wa.me, lui, ouvre directement la discussion
    // du parent — mais ne transporte aucun fichier. On ouvre donc la bonne
    // conversation, et le PDF se joint ensuite d'un geste, depuis la carte.
    const tel = (el.tel || "").replace(/\s/g, "");
    // La fenêtre doit être réservée AVANT l'attente : après un `await`, le
    // téléphone considère le geste expiré et bloque l'ouverture.
    const fenetre = tel ? window.open("", "_blank") : null;

    setEnvoiEnCours(f.id);
    try {
      const numero = await onEmettreFacture(f.id, { recharger: false });
      const emise = { ...f, numero: numero || f.numero, dateEmission: todayStr() };
      const texte = makeFactureWhatsApp(el, emise.numero, f.nbSeances, f.montant, f.datesSeances, seuil, f.prestation);

      if (tel) {
        const lien = `https://wa.me/${telWhatsApp(tel)}?text=${encodeURIComponent(texte)}`;
        if (fenetre) fenetre.location = lien;
        else window.open(lien, "_blank", "noopener,noreferrer");
        signalerSucces(`Facture ${emise.numero} émise — WhatsApp s'ouvre sur ${el.parent || "le parent"}. Le PDF se joint depuis la carte.`);
      } else {
        // Sans numéro de parent, le partage système reste le seul chemin.
        const r = await partagerFacturePDF(emise, el, parametres, texte);
        if (r.telecharge) signalerInfo(`Facture ${emise.numero} émise, PDF téléchargé — cet appareil ne sait pas partager de fichier.`);
        else if (r.partage) signalerSucces(`Facture ${emise.numero} envoyée.`);
        else signalerInfo(`Facture ${emise.numero} émise. Ajoutez le téléphone du parent pour l'envoyer en un geste.`);
      }
    } catch (e) {
      if (fenetre) fenetre.close();
      // L'autorisation de partage a expiré : la facture est bien émise, il suffit de
      // la renvoyer depuis sa fiche. On le dit au lieu de laisser croire à un échec.
      if (e && e.name === "NotAllowedError") signalerInfo("Facture émise. Ouvrez-la pour la partager.");
      else signalerErreur(e);
    }
    setEnvoiEnCours(null);
    if (onRecharger) await onRecharger();
  };

  const actifs = eleves.filter(e => e.actif !== false);
  const ouvertes = factures.filter(f => f.statut !== "paye");
  // Seuil de signalement, réglable dans Réglages (trois séances par défaut).
  const seuil = Math.max(1, parseInt(parametres?.seuil_facturation, 10) || SEUIL_FACTURATION_DEFAUT);
  // À facturer : la facture a atteint le seuil et n'a pas encore de numéro.
  const aFacturer = ouvertes
    .filter(f => !f.numero && (f.nbSeances || 0) >= seuil && actifs.find(e => e.id === f.eleveId))
    .sort((a, b) => (b.nbSeances || 0) - (a.nbSeances || 0));
  // Ce qui reste à encaisser sur des factures déjà parties chez les parents.
  const nbARelancer = aRelancer(factures, actifs).length;
  const ouverteDe = eid => ouvertes.find(f => f.eleveId === eid);
  // Solde ouvert dont l'élève est désactivé ou n'existe plus : à traiter à part,
  // sinon il reste invisible et impossible à solder ou supprimer.
  const ouvertesOrphelines = ouvertes.filter(f => !actifs.find(e => e.id === f.eleveId));
  const totalEnCours = ouvertes.reduce((s, f) => s + f.montant, 0);
  const payees = factures.filter(f => f.statut === "paye").sort((a, b) => (b.periodeFin || b.datePaiement || "").localeCompare(a.periodeFin || a.datePaiement || ""));
  const caParMois = ym => payees.filter(f => (f.datePaiement || "").startsWith(ym)).reduce((s, f) => s + f.montant, 0);
  const histoCA = lastMonths(6).reverse().map(m => ({
    l: MOIS_C[+m.split("-")[1] - 1],
    v: caParMois(m)
  }));
  const maxCA = Math.max(...histoCA.map(d => d.v), 1);
  // Onglet "Gérer" : toutes les factures (en cours + payées) au même endroit, pour un
  // nettoyage rapide (ex. des tests) sans avoir à jongler entre les deux autres onglets.
  const toutes = [...factures].sort((a, b) => (b.periodeFin || b.datePaiement || b.periodeDebut || "").localeCompare(a.periodeFin || a.datePaiement || a.periodeDebut || ""));
  const handleDeleteToutes = f => f.statut === "paye" ? handleDelete(f.id) : handleDeleteEnCours(f.id, f.eleveId, f.datesSeances || []);
  return /*#__PURE__*/React.createElement("div", null, toast && /*#__PURE__*/React.createElement("div", {
    className: "fx-pop-in",
    style: {
      position: "fixed",
      top: 60,
      left: "50%",
      transform: "translateX(-50%)",
      zIndex: 900,
      background: C.green,
      color: "#fff",
      padding: "10px 20px",
      borderRadius: 10,
      fontSize: 13,
      fontWeight: 700,
      boxShadow: C.ombreForte,
      whiteSpace: "nowrap"
    }
  }, toast), modal && /*#__PURE__*/React.createElement(ModaleFacture, {
    eleve: modal.e,
    existante: modal.f,
    dates: modal.dates,
    encaissements: encaissementsDe(modal.f?.id),
    onAjouterVersement: onAjouterVersement,
    onSupprimerVersement: onSupprimerVersement,
    onSave: handleSave,
    onClose: () => setModal(null)
  }), impression && /*#__PURE__*/React.createElement(VueImpression, {
    facture: impression.f,
    eleve: impression.e,
    parametres: parametres,
    onEmettre: onEmettreFacture,
    onClose: () => setImpression(null),
    onDelete: async () => {
      const ok = impression.f.statut === "paye" ? await handleDelete(impression.f.id) : await handleDeleteEnCours(impression.f.id, impression.f.eleveId, impression.f.datesSeances || []);
      if (ok) setImpression(null);
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      marginBottom: 14,
      overflowX: "auto"
    }
  }, [{
    k: "encours",
    l: `💰 En cours${aFacturer.length > 0 ? ` • ${aFacturer.length} à envoyer` : ouvertes.length > 0 ? ` (${ouvertes.length})` : ""}`
  }, {
    k: "relances",
    l: `🔔 Relances${nbARelancer > 0 ? ` (${nbARelancer})` : ""}`
  }, {
    k: "histo",
    l: "📋 Historique"
  }, {
    k: "gerer",
    l: `🗑 Gérer${toutes.length > 0 ? ` (${toutes.length})` : ""}`
  }].map(({
    k,
    l
  }) => /*#__PURE__*/React.createElement("button", {
    key: k,
    onClick: () => setOnglet(k),
    style: {
      background: onglet === k ? C.navy : C.surface,
      color: onglet === k ? "#fff" : C.gray,
      border: "none",
      borderRadius: 20,
      padding: "6px 14px",
      fontSize: 12,
      fontWeight: 700,
      cursor: "pointer",
      fontFamily: "inherit",
      whiteSpace: "nowrap"
    }
  }, l))), onglet === "encours" && /*#__PURE__*/React.createElement("div", null,
  aFacturer.length > 0 && h("div", {
    style: {
      background: C.navyPale, border: `1px solid ${C.bord}`,
      borderRadius: 14, padding: 14, marginBottom: 14
    }
  },
    h("div", { style: { fontSize: 15, fontWeight: 800, color: C.gold, fontFamily: FD, marginBottom: 3 } },
      `${aFacturer.length} facture${aFacturer.length > 1 ? "s" : ""} à envoyer`),
    h("div", { style: { fontSize: 12, color: C.gray, marginBottom: 10, lineHeight: 1.5 } },
      `Ces élèves ont atteint ${seuil} séances. « Envoyer » émet la facture et ouvre le partage avec le PDF et le message — touchez le nom pour la relire avant.`),
    h("div", { style: { display: "flex", flexDirection: "column", gap: 6 } },
      aFacturer.map(f => {
        const el = eleveDe(f.eleveId);
        if (!el) return null;
        const occupe = envoiEnCours === f.id;
        return h("div", {
          key: f.id,
          style: {
            display: "flex", alignItems: "center", gap: 8,
            background: C.surface, border: `1px solid ${C.bord}`,
            borderRadius: 10, padding: "8px 8px 8px 12px"
          }
        },
          // Le nom reste cliquable pour relire la facture avant de l'envoyer.
          h("button", {
            onClick: () => setImpression({ f, e: el }),
            style: {
              flex: 1, minWidth: 0, background: "none", border: "none", padding: "4px 0",
              cursor: "pointer", fontFamily: "inherit", textAlign: "left"
            }
          },
            h("div", { style: { fontSize: 13.5, fontWeight: 700, color: C.texte, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } },
              `${el.prenom} ${el.nom}`),
            h("div", { style: { fontSize: 11.5, color: C.gray, fontWeight: 600, marginTop: 1 } },
              `${f.nbSeances} séance${f.nbSeances > 1 ? "s" : ""} • `,
              h("span", { style: { color: C.gold, fontWeight: 800 } }, `${f.montant} €`))),
          h("button", {
            onClick: () => emettreEtEnvoyer(f, el),
            disabled: occupe,
            style: {
              background: occupe ? C.bordFort : C.navy,
              border: "none", borderRadius: 9, padding: "10px 14px", color: "#fff",
              fontSize: 13.5, fontWeight: 600, cursor: occupe ? "wait" : "pointer",
              fontFamily: "inherit", whiteSpace: "nowrap", opacity: occupe ? 0.6 : 1
            }
          }, occupe ? "…" : "📤 Envoyer"));
      }))),
  /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      color: C.gray,
      marginBottom: 14,
      lineHeight: 1.5
    }
  }, `La facturation est cumulative : chaque élève a une seule facture qui grossit à chaque séance présente. Au bout de ${seuil} séances, elle est signalée ici — à vous de l'émettre et de l'envoyer.`), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: 8,
      marginBottom: 16
    }
  }, [{
    e: "💰",
    v: `${totalEnCours}€`,
    l: "Total en cours",
    c: C.gold
  }, {
    e: "⏳",
    v: ouvertes.length,
    l: "Factures ouvertes",
    c: C.orange
  }].map((s, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      background: C.surface,
      borderRadius: 12,
      padding: "10px 8px",
      textAlign: "center",
      border: `1px solid ${C.bord}`
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 18
    }
  }, s.e), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 15,
      fontWeight: 800,
      color: s.c,
      fontFamily: FD
    }
  }, s.v), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12.5,
      color: C.gray,
      fontWeight: 500
    }
  }, s.l)))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 12
    }
  }, actifs.map(e => {
    const f = ouverteDe(e.id);
    const dates = f ? f.datesSeances || [] : seancesOuvertes(e.id, appels, groupes, dernierePeriodeFin(e.id, factures));
    const nb = dates.length;
    const montant = f ? f.montant : parseFloat((nb * 2 * e.th).toFixed(2));
    return /*#__PURE__*/React.createElement("div", {
      key: e.id,
      style: {
        background: C.surface,
        border: `1px solid ${f ? C.orangeBord : C.bord}`,
        borderRadius: 14,
        padding: 14
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 10,
        marginBottom: 10
      }
    }, /*#__PURE__*/React.createElement(Avatar, {
      p: e.prenom,
      n: e.nom
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 16,
        fontWeight: 800,
        color: C.texte,
        fontFamily: FD
      }
    }, e.prenom, " ", e.nom), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 12,
        color: C.gray
      }
    }, e.niveau, " • ", euros(e.th), "/h")), f && /*#__PURE__*/React.createElement(StatutBadge, {
      statut: f.statut
    })), nb > 0 ? /*#__PURE__*/React.createElement("div", {
      style: {
        background: C.surface2,
        borderRadius: 10,
        padding: "10px 12px",
        marginBottom: 10
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 13,
        color: C.gray
      }
    }, nb, " séance", nb > 1 ? "s" : "", " × 2h × ", e.th, "€ ", /*#__PURE__*/React.createElement("span", {
      style: {
        fontStyle: "italic"
      }
    }, "(depuis l'appel)")), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 24,
        fontWeight: 800,
        color: C.gold,
        fontFamily: FD
      }
    }, montant, "€")), groupParMatiere(dates).map(g => /*#__PURE__*/React.createElement("div", {
      key: g.matiere,
      style: {
        fontSize: 11,
        color: C.gray,
        marginTop: 6,
        lineHeight: 1.6
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        color: C.gold,
        fontWeight: 700
      }
    }, g.matiere), " (", g.dates.length, ") : ", g.dates.map(d => fmtDateCourt(d)).join(" · ")))) : /*#__PURE__*/React.createElement("div", {
      style: {
        background: C.navyPale,
        borderRadius: 10,
        padding: "10px 12px",
        marginBottom: 10
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 13,
        color: C.gray
      }
    }, "À jour — rien en attente")), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        gap: 8
      }
    }, nb > 0 && /*#__PURE__*/React.createElement(BtnPrimary, {
      label: resteDu(f) < (f?.montant || 0) ? `💰 Reste ${euros(resteDu(f))}` : "💰 Encaisser",
      onClick: () => setModal({
        e,
        f,
        dates
      }),
      full: true
    }), f && /*#__PURE__*/React.createElement("button", {
      onClick: () => setImpression({
        f,
        e
      }),
      style: {
        background: C.surface,
        border: `1px solid ${C.bord}`,
        borderRadius: 10,
        padding: "11px 14px",
        color: C.texte,
        fontSize: 16,
        cursor: "pointer",
        fontFamily: "inherit"
      }
    }, "🖨"), nb > 0 && /*#__PURE__*/React.createElement("button", {
      onClick: () => handleDeleteEnCours(f?.id || null, e.id, dates),
      disabled: suppression,
      title: "Supprimer ces séances et la facture en cours",
      style: {
        background: C.redPale,
        border: `1px solid ${C.redBord}`,
        borderRadius: 10,
        padding: "11px 14px",
        color: C.red,
        fontSize: 16,
        cursor: suppression ? "not-allowed" : "pointer",
        fontFamily: "inherit"
      }
    }, "🗑")), nb > 0 && /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(PanneauEnvoi, {
      eleve: e,
      mois: f && f.numero ? f.numero : `depuis ${fmtDateCourt(dates[0].date)}`,
      nb: nb,
      montant: montant,
      dates: dates,
      type: "facture",
      facture: f,
      parametres: parametres,
      seuil: seuil
    }), /*#__PURE__*/React.createElement(PanneauEnvoi, {
      eleve: e,
      mois: f && f.numero ? f.numero : `depuis ${fmtDateCourt(dates[0].date)}`,
      nb: nb,
      montant: montant,
      dates: dates,
      type: "rappel",
      facture: f,
      parametres: parametres,
      seuil: seuil
    })));
  }), actifs.length === 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "center",
      padding: "30px 0",
      color: C.gray,
      fontSize: 13
    }
  }, "Aucun élève actif pour l'instant.")), ouvertesOrphelines.length > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 24
    }
  }, /*#__PURE__*/React.createElement(Lbl, {
    text: "⚠️ Soldes ouverts — élèves désactivés ou introuvables"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 12
    }
  }, ouvertesOrphelines.map(f => {
    const e = eleveDe(f.eleveId);
    return /*#__PURE__*/React.createElement("div", {
      key: f.id,
      style: {
        background: C.redPale,
        border: `1px solid ${C.redBord}`,
        borderRadius: 14,
        padding: 14
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: e ? 10 : 0
      }
    }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 14,
        fontWeight: 700,
        color: C.texte
      }
    }, e ? `${e.prenom} ${e.nom}` : "Élève introuvable", e && /*#__PURE__*/React.createElement("span", {
      style: {
        marginLeft: 8,
        fontSize: 10,
        fontWeight: 700,
        color: C.red,
        background: C.redPale,
        padding: "2px 8px",
        borderRadius: 20
      }
    }, "🔴 Inactif")), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 12,
        color: C.gray
      }
    }, f.nbSeances, " séance", f.nbSeances > 1 ? "s" : "", " • ", f.montant, "€")), /*#__PURE__*/React.createElement("button", {
      onClick: () => handleDeleteEnCours(f.id, f.eleveId, f.datesSeances || []),
      disabled: suppression,
      style: {
        background: C.redPale,
        border: `1px solid ${C.redBord}`,
        borderRadius: 10,
        padding: "10px 14px",
        color: C.red,
        fontSize: 16,
        cursor: suppression ? "not-allowed" : "pointer",
        fontFamily: "inherit"
      }
    }, "🗑")), e && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(PanneauEnvoi, {
      eleve: e,
      facture: f,
      parametres: parametres,
      seuil: seuil,
      mois: f.numero || `depuis ${fmtDateCourt(f.periodeDebut || (f.datesSeances || [])[0]?.date || "")}`,
      nb: f.nbSeances,
      montant: f.montant,
      dates: f.datesSeances || [],
      type: "rappel"
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: 8
      }
    }, /*#__PURE__*/React.createElement(BtnPrimary, {
      label: "💰 Encaisser",
      onClick: () => setModal({
        e,
        f,
        dates: f.datesSeances || []
      }),
      full: true
    }))));
  })))), onglet === "relances" && h(ModuleRelances, {
    eleves: actifs, factures: factures, parametres: parametres, onRelancer: onRelancer
  }), onglet === "histo" && /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      background: C.surface,
      border: `1px solid ${C.bord}`,
      borderRadius: 16,
      padding: 16,
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 15,
      fontWeight: 700,
      color: C.texte,
      fontFamily: FD,
      marginBottom: 12
    }
  }, "📈 Encaissé — 6 mois"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "flex-end",
      gap: 6,
      height: 80
    }
  }, histoCA.map((d, i) => {
    const isL = i === histoCA.length - 1;
    const pct = d.v / maxCA;
    return /*#__PURE__*/React.createElement("div", {
      key: i,
      style: {
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 3
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 9,
        color: isL ? C.gold : C.gray,
        fontWeight: isL ? 700 : 400
      }
    }, d.v > 0 ? `${d.v}€` : ""), /*#__PURE__*/React.createElement("div", {
      style: {
        width: "100%",
        borderRadius: "3px 3px 0 0",
        background: isL ? C.navyL : C.navyPale,
        height: `${Math.max(pct * 100, 4)}%`
      }
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 9,
        color: isL ? C.gold : C.gray,
        fontWeight: isL ? 700 : 400
      }
    }, d.l));
  }))), payees.length === 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "center",
      padding: "40px 0",
      color: C.gray,
      fontSize: 13
    }
  }, "Aucune facture payée pour l'instant."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 8
    }
  }, payees.map(f => {
    const e = eleveDe(f.eleveId);
    const dates = f.datesSeances || [];
    const periode = dates.length ? dates.length === 1 ? fmtDateCourt(dates[0].date) : `${fmtDateCourt(dates[0].date)} – ${fmtDateCourt(dates[dates.length - 1].date)}` : "—";
    return /*#__PURE__*/React.createElement("div", {
      key: f.id,
      onClick: () => e && setImpression({
        f,
        e
      }),
      style: {
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 12px",
        background: C.surface,
        border: `1px solid ${C.bord}`,
        borderRadius: 10,
        cursor: e ? "pointer" : "default"
      }
    }, e && /*#__PURE__*/React.createElement(Avatar, {
      p: e.prenom,
      n: e.nom,
      s: 30
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 14,
        color: C.texte,
        fontWeight: 600
      }
    }, e ? `${e.prenom} ${e.nom}` : "Élève introuvable"), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 11,
        color: C.gray
      }
    }, periode, " • ", f.nbSeances, " séance", f.nbSeances > 1 ? "s" : "")), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 15,
        fontWeight: 800,
        color: C.gold,
        fontFamily: FD
      }
    }, f.montant, "€"), /*#__PURE__*/React.createElement("button", {
      onClick: ev => {
        ev.stopPropagation();
        handleDelete(f.id);
      },
      disabled: suppression,
      title: "Supprimer cette facture",
      style: {
        background: C.redPale,
        border: `1px solid ${C.redBord}`,
        borderRadius: 10,
        padding: "8px 10px",
        color: C.red,
        fontSize: 14,
        cursor: suppression ? "not-allowed" : "pointer",
        fontFamily: "inherit"
      }
    }, "🗑"));
  }))), onglet === "gerer" && /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      color: C.gray,
      marginBottom: 14,
      lineHeight: 1.5
    }
  }, "Toutes vos factures, et de quoi corriger une erreur : enregistrer un règlement, retirer un versement mal saisi, annuler une facture émise par erreur ou la rétablir. Supprimer un brouillon retire aussi les séances « présent » correspondantes de l'appel."), toutes.length === 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "center",
      padding: "40px 0",
      color: C.gray,
      fontSize: 13
    }
  }, "Aucune facture pour l'instant."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 8
    }
  }, toutes.map(f => {
    const e = eleveDe(f.eleveId);
    const periode = f.numero || (f.periodeDebut ? `depuis ${fmtDateCourt(f.periodeDebut)}` : "");
    const emise = !!f.numero;
    const annulee = f.statut === "annulee";
    const verse = Number(f.encaisse) || 0;
    const occupe = envoiEnCours === f.id;

    // Ouvrir la conversation du parent, directement sur son numéro : aucun risque
    // de se tromper de destinataire dans la liste des contacts.
    const whatsappParent = () => {
      const tel = (e.tel || "").replace(/\s/g, "");
      if (!tel) {
        signalerErreur({ message: `Pas de téléphone parent pour ${e.prenom} : ajoutez-le dans sa fiche.` });
        return;
      }
      const texte = makeFactureWhatsApp(e, f.numero, f.nbSeances, f.montant, f.datesSeances, seuil, f.prestation);
      window.open(`https://wa.me/${telWhatsApp(tel)}?text=${encodeURIComponent(texte)}`, "_blank", "noopener,noreferrer");
    };

    // Joindre le PDF : le partage système, une fois la conversation ouverte.
    const partager = async () => {
      setEnvoiEnCours(f.id);
      try {
        const texte = makeFactureWhatsApp(e, f.numero, f.nbSeances, f.montant, f.datesSeances, seuil, f.prestation);
        const r = await partagerFacturePDF(f, e, parametres, texte);
        if (r.telecharge) signalerInfo("PDF téléchargé — cet appareil ne sait pas partager de fichier.");
        else if (r.partage) signalerSucces(`Facture ${f.numero} envoyée.`);
      } catch (err) {
        signalerErreur(err);
      }
      setEnvoiEnCours(null);
    };

    const annuler = async () => {
      const motif = window.prompt(
        `Annuler la facture ${f.numero} de ${e ? e.prenom : "cet élève"} ?\n\n` +
        "Elle gardera son numéro — la numérotation comptable ne tolère pas de trou — " +
        "mais sortira du chiffre d'affaires, et ses séances redeviendront facturables.\n\n" +
        "Motif (facultatif) :", "");
      if (motif === null) return;
      try {
        await onAnnulerFacture(f.id, motif);
        signalerSucces(`Facture ${f.numero} annulée.`);
      } catch (err) {
        signalerErreur(err);
      }
    };

    const retablir = async () => {
      try {
        await onRetablirFacture(f.id);
        signalerSucces(verse > 0 ? "Facture rétablie." : "Facture remise en attente de règlement.");
      } catch (err) {
        signalerErreur(err);
      }
    };

    const bouton = (libelle, onClick, couleur, fond, bord) => h("button", {
      onClick, disabled: occupe,
      style: {
        flex: 1, background: fond, border: `1px solid ${bord}`, borderRadius: 9,
        padding: "9px 6px", color: couleur, fontSize: 12.5, fontWeight: 700,
        cursor: occupe ? "wait" : "pointer", fontFamily: "inherit", whiteSpace: "nowrap"
      }
    }, libelle);

    return h("div", {
      key: f.id,
      style: {
        background: C.surface, border: `1px solid ${C.bord}`, boxShadow: C.ombre,
        borderRadius: 12, padding: 14, opacity: annulee ? 0.68 : 1
      }
    },
      h("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, marginBottom: 10 } },
        h("div", { style: { minWidth: 0, flex: 1 } },
          h("div", { style: { fontSize: 14, fontWeight: 700, color: C.texte, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } },
            e ? `${e.prenom} ${e.nom}` : "Élève introuvable",
            e && e.actif === false && h("span", {
              style: { marginLeft: 8, fontSize: 10, fontWeight: 700, color: C.red, background: C.redPale, padding: "2px 8px", borderRadius: 20 }
            }, "inactif")),
          h("div", { style: { fontSize: 11, color: C.gray, marginTop: 2 } },
            periode, " • ", f.nbSeances, " séance", f.nbSeances > 1 ? "s" : "",
            verse > 0 ? h("span", { style: { color: C.green } }, ` • ${euros(verse)} versés`) : null)),
        h("div", { style: { textAlign: "right", flexShrink: 0 } },
          h(StatutBadge, { statut: f.statut }),
          h("div", {
            style: {
              fontSize: 15, fontWeight: 800, fontFamily: FD, marginTop: 4,
              color: annulee ? C.gray : C.gold,
              textDecoration: annulee ? "line-through" : "none"
            }
          }, euros(f.montant)))),

      h("div", { style: { display: "flex", gap: 6 } },
        annulee
          ? bouton("↩️ Rétablir", retablir, C.gold, C.goldPale, C.goldBord)
          : [
              emise && e ? h(React.Fragment, { key: "env" },
                bouton("💬 WhatsApp", whatsappParent, "#0b6b37", C.whatsappPale, C.whatsappBord)) : null,
              emise && e ? h(React.Fragment, { key: "pdf" },
                bouton(occupe ? "…" : "📎 PDF", partager, C.texte, C.surface2, C.bord)) : null,
              e ? h(React.Fragment, { key: "enc" },
                bouton("💰 Encaisser", () => setModal({ e, f, dates: f.datesSeances || [] }),
                  C.green, C.greenPale, C.greenBord)) : null,
              emise
                ? h(React.Fragment, { key: "ann" },
                    bouton("↩️ Annuler", annuler, C.gray, C.surface2, C.bord))
                : h(React.Fragment, { key: "sup" },
                    bouton("🗑 Supprimer", () => handleDeleteToutes(f), C.red, C.redPale, C.redBord))
            ]),

      // Dire pourquoi une facture émise ne se supprime pas évite de chercher le bouton.
      emise && !annulee && h("div", { style: { fontSize: 10.5, color: C.grisClair, marginTop: 8, lineHeight: 1.5 } },
        "Une facture émise ne se supprime pas : son numéro doit rester dans la séquence. L'annuler la sort du chiffre d'affaires et libère ses séances.")
    );
  }))));
}
