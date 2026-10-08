// ─── MON COMPTE ──────────────────────────────────────────────
// Les professeurs reçoivent leur mot de passe par message : il faut qu'ils
// puissent le remplacer dès la première ouverture, sans passer par Fouad.
//
// L'identifiant, lui, ne se change pas ici. C'est l'adresse qui porte le compte ;
// la modifier demande une confirmation par courriel, et ces adresses
// @boostetude.fr n'ont pas de boîte aux lettres. Elle reste donc affichée, en
// lecture seule, avec un mot pour dire à qui s'adresser.
const LONGUEUR_MOT_DE_PASSE = 8;

function FenetreCompte({ profil, email, onFermer, onChanger, onDeconnexion }) {
  const [nouveau, setNouveau] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [fait, setFait] = useState(false);

  const tropCourt = nouveau.length > 0 && nouveau.length < LONGUEUR_MOT_DE_PASSE;
  const discordant = confirmation.length > 0 && confirmation !== nouveau;
  const pret = nouveau.length >= LONGUEUR_MOT_DE_PASSE && confirmation === nouveau && !enCours;

  const valider = async () => {
    if (!pret) return;
    setEnCours(true);
    try {
      await onChanger(nouveau);
      setFait(true);
      setNouveau("");
      setConfirmation("");
      signalerSucces("Mot de passe changé. Gardez-le précieusement.");
    } catch (e) {
      signalerErreur(e);
    }
    setEnCours(false);
  };

  return h("div", {
    onClick: onFermer,
    style: {
      position: "fixed", inset: 0, zIndex: 700, background: C.voile,
      display: "flex", alignItems: "flex-end", justifyContent: "center"
    }
  },
    h("div", {
      onClick: e => e.stopPropagation(),
      className: "fx-fade-slide-up",
      style: {
        width: "100%", maxWidth: 480, background: C.surface,
        borderRadius: "18px 18px 0 0", padding: "18px 16px calc(22px + env(safe-area-inset-bottom))",
        maxHeight: "92vh", overflowY: "auto"
      }
    },
      h("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, marginBottom: 16 } },
        h("div", { style: { minWidth: 0 } },
          h("div", { style: { fontSize: 20, fontWeight: 700, color: C.texte, fontFamily: FD, lineHeight: 1.2 } },
            "Mon compte"),
          h("div", { style: { fontSize: 13.5, color: C.gray, marginTop: 3 } },
            profil && (profil.prenom || profil.nom)
              ? [profil.prenom, profil.nom].filter(Boolean).join(" ")
              : "Espace professeur")),
        h("button", {
          onClick: onFermer, title: "Fermer",
          style: {
            background: "none", border: "none", color: C.gray, fontSize: 22,
            cursor: "pointer", fontFamily: "inherit", lineHeight: 1, padding: "0 4px"
          }
        }, "×")),

      h("div", {
        style: {
          background: C.surface2, border: `1px solid ${C.bord}`, borderRadius: 10,
          padding: "11px 12px", marginBottom: 18
        }
      },
        h("div", { style: { fontSize: 12, color: C.gray, marginBottom: 3 } }, "Identifiant"),
        h("div", { style: { fontSize: 14.5, fontWeight: 600, color: C.texte, wordBreak: "break-all" } }, email || "—"),
        h("div", { style: { fontSize: 12, color: C.grisClair, marginTop: 6, lineHeight: 1.5 } },
          "L'identifiant ne se change pas ici — demandez-le à Fouad.")),

      h(Lbl, { text: "Nouveau mot de passe" }),
      h("input", {
        type: "password", value: nouveau, autoComplete: "new-password",
        onChange: e => { setNouveau(e.target.value); setFait(false); },
        placeholder: `${LONGUEUR_MOT_DE_PASSE} caractères au minimum`,
        style: {
          width: "100%", background: C.surface, borderRadius: 10, padding: "11px 12px",
          border: `1px solid ${tropCourt ? C.redBord : C.bord}`, color: C.texte,
          fontSize: 16, fontFamily: "inherit", outline: "none", boxSizing: "border-box",
          marginBottom: tropCourt ? 4 : 12
        }
      }),
      tropCourt
        ? h("div", { style: { fontSize: 12.5, color: C.red, marginBottom: 12 } },
            `Encore ${LONGUEUR_MOT_DE_PASSE - nouveau.length} caractère${LONGUEUR_MOT_DE_PASSE - nouveau.length > 1 ? "s" : ""}.`)
        : null,

      h(Lbl, { text: "Confirmation" }),
      h("input", {
        type: "password", value: confirmation, autoComplete: "new-password",
        onChange: e => { setConfirmation(e.target.value); setFait(false); },
        placeholder: "le même, pour être sûr",
        style: {
          width: "100%", background: C.surface, borderRadius: 10, padding: "11px 12px",
          border: `1px solid ${discordant ? C.redBord : C.bord}`, color: C.texte,
          fontSize: 16, fontFamily: "inherit", outline: "none", boxSizing: "border-box",
          marginBottom: discordant ? 4 : 14
        }
      }),
      discordant
        ? h("div", { style: { fontSize: 12.5, color: C.red, marginBottom: 14 } },
            "Les deux saisies diffèrent.")
        : null,

      fait
        ? h("div", {
            style: {
              background: C.greenPale, border: `1px solid ${C.greenBord}`, borderRadius: 10,
              padding: "10px 12px", marginBottom: 14, fontSize: 13.5, color: C.green, fontWeight: 600
            }
          }, "✅ Mot de passe changé. Il servira à la prochaine connexion.")
        : null,

      h(BtnPrimary, {
        label: enCours ? "Enregistrement…" : "Changer le mot de passe",
        onClick: valider, disabled: !pret, full: true
      }),

      h("div", { style: { height: 1, background: C.bord, margin: "18px 0" } }),
      h(BtnSecondary, { label: "Se déconnecter", onClick: onDeconnexion, full: true })));
}
