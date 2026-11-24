// ─── COMPTES PROFESSEURS ─────────────────────────────────────
// Réglages → Professeurs : Fouad crée lui-même le compte d'un nouveau
// professeur (identifiant « k.nom » + mot de passe), l'envoie sur WhatsApp, et
// lui confie ensuite ses groupes (fiche du groupe → « Professeur assigné »).
// Le professeur voit Appel et Suivi pour ses groupes seulement (règles de la base).
const URL_APPLI = "https://fouad91150.github.io/boostetude-app/";
const DOMAINE_PROF = "@prof.boostetude.fr";
// Champ « Email » de la connexion : un identifiant sans @ est un compte professeur.
const emailDeConnexion = saisie => {
  const v = (saisie || "").trim().toLowerCase();
  return v.includes("@") ? v : v + DOMAINE_PROF;
};
const identifiantProfPropose = (prenom, nom, profs) => {
  const p = sansAccents(prenom).toLowerCase().replace(/[^a-z]/g, "").slice(0, 1) || "p";
  const n = sansAccents(nom).toLowerCase().replace(/[^a-z0-9]/g, "") || "prof";
  const base = `${p}.${n}`.slice(0, 38);
  const pris = new Set((profs || []).map(x => (x.identifiant || (x.email || "").split("@")[0] || "").toLowerCase()));
  if (!pris.has(base)) return base;
  for (let i = 2; ; i++) if (!pris.has(base + i)) return base + i;
};
const messageAccesProf = (prenom, identifiant, mdp) =>
  `Bonjour ${prenom},\n\n` +
  `Bienvenue dans l'équipe Boost'Étude ! Voici ton accès à l'application, pour faire l'appel, noter le suivi de tes élèves et envoyer les bilans et devoirs aux parents :\n\n` +
  `🔗 ${URL_APPLI}\n` +
  `👤 Identifiant : *${identifiant}*\n` +
  `🔑 Mot de passe : *${mdp}*\n\n` +
  `Pense à faire l'appel à chaque séance : c'est lui qui compte tes heures.\n\n` +
  `Boost'Étude`;

function CarteComptesProfs({ profs, onChange }) {
  const [form, setForm] = useState(null); // { prenom, nom, tel, taux }
  const [occupe, setOccupe] = useState(false);
  const [dernier, setDernier] = useState(null); // { prenom, identifiant, mdp, tel }
  const [erreur, setErreur] = useState("");
  const equipe = (profs || []).filter(p => p.role !== "admin");
  const envoyerWA = (tel, texte) => window.open(`https://wa.me/${telWhatsApp(tel)}?text=${encodeURIComponent(texte)}`, "_blank");

  const creer = async (prof) => {
    setOccupe(true); setErreur("");
    const f = prof ? { prenom: prof.prenom, nom: prof.nom, tel: prof.telephone, taux: prof.taux_horaire } : form;
    const tel = (f.tel || "").trim();
    const fenetre = tel ? window.open("", "_blank") : null;
    try {
      if (!prof && (!f.prenom.trim() || !f.nom.trim())) throw new Error("Indique le prénom et le nom.");
      const identifiant = (prof && prof.identifiant) || identifiantProfPropose(f.prenom, f.nom, profs);
      const mdp = motDePasseEleve();
      const taux = f.taux === "" || f.taux == null ? null : Number(String(f.taux).replace(",", "."));
      const { error } = await sb.rpc("creer_compte_prof", {
        p_prof: prof ? prof.id : null, p_prenom: f.prenom, p_nom: f.nom, p_identifiant: identifiant,
        p_mdp: mdp, p_telephone: tel, p_taux: Number.isFinite(taux) ? taux : null
      });
      if (error) throw new Error(error.message);
      setDernier({ prenom: f.prenom, identifiant, mdp, tel });
      if (fenetre) fenetre.location = `https://wa.me/${telWhatsApp(tel)}?text=${encodeURIComponent(messageAccesProf(f.prenom, identifiant, mdp))}`;
      setForm(null);
      onChange && onChange();
    } catch (e) {
      if (fenetre) fenetre.close();
      setErreur(e.message || String(e));
    } finally { setOccupe(false); }
  };

  const champ = (label, k, ph, type) => h(InputText, { label, value: form[k], onChange: v => setForm(s => ({ ...s, [k]: v })), placeholder: ph, type });
  const petitBouton = (label, onClick, plein) => h("button", {
    onClick, disabled: occupe,
    style: { background: plein ? C.green : C.surface, color: plein ? "#fff" : C.texte, border: `1px solid ${plein ? C.green : C.bord}`,
      borderRadius: 10, padding: "9px 12px", fontSize: 13.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }
  }, label);

  return h("div", { style: { background: C.surface, border: `1px solid ${C.bord}`, borderRadius: 12, padding: 16, marginBottom: 16 } },
    h("div", { style: { fontSize: 12, fontWeight: 700, color: C.gold, marginBottom: 10 } }, "👥 Comptes de l'équipe"),
    equipe.length === 0 && h("div", { style: { fontSize: 13, color: C.gray, marginBottom: 10 } }, "Aucun professeur pour l'instant."),
    equipe.map(p => h("div", { key: p.id, style: { display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderTop: `1px solid ${C.bord}` } },
      h("div", { style: { flex: 1, minWidth: 0 } },
        h("div", { style: { fontWeight: 700, fontSize: 14, color: C.texte } }, `${p.prenom || ""} ${p.nom || ""}`.trim() || "Professeur"),
        h("div", { style: { fontSize: 12, color: C.gray } },
          p.identifiant ? `Identifiant : ${p.identifiant}` : (p.email || "Pas encore de compte"))),
      petitBouton("🔑 Nouveau mot de passe", () => {
        if (window.confirm(`Donner un nouveau mot de passe à ${p.prenom || "ce professeur"} ? L'ancien ne marchera plus.`)) creer(p);
      }))),
    dernier && h("div", { style: { background: C.greenPale, border: `1px solid ${C.greenBord}`, borderRadius: 10, padding: 12, margin: "10px 0", fontSize: 13.5, color: C.texte } },
      h("div", null, "✅ Accès de ", h("b", null, dernier.prenom), " : identifiant ", h("b", null, dernier.identifiant), " · mot de passe ", h("b", null, dernier.mdp)),
      h("div", { style: { fontSize: 12, color: C.gray, marginTop: 4 } }, "Pense à lui confier ses groupes : Appel → modifier le groupe → « Professeur assigné »."),
      dernier.tel && h("div", { style: { marginTop: 8 } }, petitBouton("📤 Renvoyer sur WhatsApp", () => envoyerWA(dernier.tel, messageAccesProf(dernier.prenom, dernier.identifiant, dernier.mdp)), true))),
    form
      ? h("div", { style: { marginTop: 12 } },
          champ("Prénom", "prenom", "Khadija"),
          champ("Nom", "nom", "Benali"),
          champ("Téléphone (pour lui envoyer l'accès)", "tel", "06 12 34 56 78", "tel"),
          champ("Taux horaire (€/h)", "taux", String(TAUX_HORAIRE_DEFAUT)),
          form.prenom && form.nom && h("div", { style: { fontSize: 12.5, color: C.gray, marginBottom: 10 } },
            "Identifiant : ", h("b", null, identifiantProfPropose(form.prenom, form.nom, profs))),
          h("div", { style: { display: "flex", gap: 8 } },
            petitBouton(occupe ? "Création…" : "✅ Créer le compte" + (form.tel ? " et l'envoyer sur WhatsApp" : ""), () => creer(null), true),
            petitBouton("Annuler", () => setForm(null))))
      : h("div", { style: { marginTop: 10 } }, petitBouton("➕ Ajouter un professeur", () => { setDernier(null); setForm({ prenom: "", nom: "", tel: "", taux: "" }); }, true)),
    erreur && h("div", { style: { color: C.red, fontSize: 13, marginTop: 8 } }, erreur));
}
