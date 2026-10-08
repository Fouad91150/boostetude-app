import sys, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).parent))
from patcher import appliquer

# ── Émettre et envoyer en un geste ───────────────────────────────────────────
# Le parcours faisait huit clics : ouvrir la facture, émettre, confirmer, revenir,
# partager, choisir l'application, choisir le contact. Il en reste trois, dont deux
# appartiennent au téléphone et non à l'application.
#
# Une contrainte technique commande l'ordre des opérations : navigator.share() doit
# être appelé dans la foulée du clic, sinon le navigateur refuse (l'autorisation
# accordée par le geste de l'utilisateur expire). On émet donc la facture — une seule
# requête, quelques centaines de millisecondes — puis on partage AUSSITÔT, et on
# recharge les données seulement après. L'ordre inverse ferait perdre l'autorisation
# et le partage échouerait sur iPhone.

appliquer("src/app/20-app.js", [
    # Le numéro attribué par la base remonte jusqu'à l'appelant, et le rechargement
    # devient optionnel pour ne pas retarder le partage.
    ("""  const handleEmettreFacture = async factureId => {
    await api.emettreFacture(factureId);
    await reloadAll();
  };""",
     """  const handleEmettreFacture = async (factureId, options) => {
    const numero = await api.emettreFacture(factureId);
    // Recharger prend une seconde ou deux : quand un partage suit immédiatement,
    // l'appelant diffère ce rechargement pour ne pas perdre l'autorisation de partage.
    if (!options || options.recharger !== false) await reloadAll();
    return numero;
  };"""),

    # Le module doit pouvoir rafraîchir les données lui-même, après le partage.
    ("""    onEmettreFacture: handleEmettreFacture
  }),""",
     """    onEmettreFacture: handleEmettreFacture,
    onRecharger: reloadAll
  }),"""),
], "(application : le numéro de facture remonte, rechargement différable)")


appliquer("src/app/18-module-facturation.js", [
    ("""function ModuleFacturation({
  eleves,
  groupes,
  appels,
  factures,
  onSaveFacture,
  onDeleteFacture,
  onDeleteFactureEnCours,
  parametres,
  onEmettreFacture
}) {
  const [onglet, setOnglet] = useState("encours");""",

     """function ModuleFacturation({
  eleves,
  groupes,
  appels,
  factures,
  onSaveFacture,
  onDeleteFacture,
  onDeleteFactureEnCours,
  parametres,
  onEmettreFacture,
  onRecharger
}) {
  const [onglet, setOnglet] = useState("encours");
  const [envoiEnCours, setEnvoiEnCours] = useState(null);"""),

    # L'enchaînement complet, derrière un seul bouton.
    ("""  const actifs = eleves.filter(e => e.actif !== false);""",

     """  // Émettre puis partager, sans repasser par l'écran de la facture.
  const emettreEtEnvoyer = async (f, el) => {
    const manquants = champsManquants(parametres);
    if (manquants.length) {
      signalerErreur({ message: "Complétez d'abord vos informations légales dans Réglages : " + manquants.join(", ") });
      return;
    }
    // Une seule confirmation, parce qu'une facture émise reçoit un numéro définitif :
    // la séquence comptable ne tolère ni trou ni doublon, on ne défait pas une émission.
    if (!window.confirm(`Émettre la facture de ${el.prenom} (${f.montant} €) et l'envoyer au parent ?\\n\\nElle recevra un numéro définitif et son montant sera figé.`)) return;

    setEnvoiEnCours(f.id);
    try {
      const numero = await onEmettreFacture(f.id, { recharger: false });
      const emise = { ...f, numero: numero || f.numero, dateEmission: todayStr() };
      const texte = makeFactureWhatsApp(el, emise.numero, f.nbSeances, f.montant, f.datesSeances, seuil);
      const r = await partagerFacturePDF(emise, el, parametres, texte);

      if (r.telecharge) signalerInfo(`Facture ${emise.numero} émise, PDF téléchargé — cet appareil ne sait pas partager de fichier.`);
      else if (r.partage) signalerSucces(`Facture ${emise.numero} envoyée.`);
      else signalerSucces(`Facture ${emise.numero} émise — le partage a été annulé.`);
    } catch (e) {
      // L'autorisation de partage a expiré : la facture est bien émise, il suffit de
      // la renvoyer depuis sa fiche. On le dit au lieu de laisser croire à un échec.
      if (e && e.name === "NotAllowedError") signalerInfo("Facture émise. Ouvrez-la pour la partager.");
      else signalerErreur(e);
    }
    setEnvoiEnCours(null);
    if (onRecharger) await onRecharger();
  };

  const actifs = eleves.filter(e => e.actif !== false);"""),

    # La ligne de l'encadré doré porte désormais l'action principale.
    ("""      aFacturer.map(f => {
        const el = eleveDe(f.eleveId);
        if (!el) return null;
        return h("button", {
          key: f.id,
          onClick: () => setImpression({ f, e: el }),
          style: {
            display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10,
            background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.1)",
            borderRadius: 10, padding: "10px 12px", cursor: "pointer", fontFamily: "inherit",
            textAlign: "left", width: "100%"
          }
        },
          h("span", { style: { fontSize: 13.5, fontWeight: 700, color: C.cream } },
            `${el.prenom} ${el.nom}`,
            h("span", { style: { fontSize: 11.5, color: C.gray, fontWeight: 600 } },
              ` • ${f.nbSeances} séance${f.nbSeances > 1 ? "s" : ""}`)),
          h("span", { style: { fontSize: 14, fontWeight: 800, color: C.gold, fontFamily: FD, whiteSpace: "nowrap" } },
            `${f.montant} € ›`));
      }))),""",

     """      aFacturer.map(f => {
        const el = eleveDe(f.eleveId);
        if (!el) return null;
        const occupe = envoiEnCours === f.id;
        return h("div", {
          key: f.id,
          style: {
            display: "flex", alignItems: "center", gap: 8,
            background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.1)",
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
            h("div", { style: { fontSize: 13.5, fontWeight: 700, color: C.cream, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } },
              `${el.prenom} ${el.nom}`),
            h("div", { style: { fontSize: 11.5, color: C.gray, fontWeight: 600, marginTop: 1 } },
              `${f.nbSeances} séance${f.nbSeances > 1 ? "s" : ""} • `,
              h("span", { style: { color: C.gold, fontWeight: 800 } }, `${f.montant} €`))),
          h("button", {
            onClick: () => emettreEtEnvoyer(f, el),
            disabled: occupe,
            style: {
              background: occupe ? "#555" : `linear-gradient(135deg,${C.gold},${C.goldD})`,
              border: "none", borderRadius: 9, padding: "10px 14px", color: C.navy,
              fontSize: 13, fontWeight: 800, cursor: occupe ? "wait" : "pointer",
              fontFamily: "inherit", whiteSpace: "nowrap", opacity: occupe ? 0.6 : 1
            }
          }, occupe ? "…" : "📤 Envoyer"));
      }))),"""),

    # Le texte d'explication colle au nouveau geste.
    ("""    h("div", { style: { fontSize: 12, color: C.gray, marginBottom: 10, lineHeight: 1.5 } },
      `Ces élèves ont atteint ${seuil} séances. Ouvrez la facture, émettez-la, puis partagez le PDF au parent.`),""",
     """    h("div", { style: { fontSize: 12, color: C.gray, marginBottom: 10, lineHeight: 1.5 } },
      `Ces élèves ont atteint ${seuil} séances. « Envoyer » émet la facture et ouvre le partage avec le PDF et le message — touchez le nom pour la relire avant.`),"""),
], "(facturation : émettre et envoyer en un geste)")
