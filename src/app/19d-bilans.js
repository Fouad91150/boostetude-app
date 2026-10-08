// ─── BILANS HEBDOMADAIRES ────────────────────────────────────
// Chaque semaine, un bilan par élève envoyé au parent. Il se rédige tout seul à
// partir de la feuille d'appel et des comptes-rendus : aucune ressaisie.
//
// L'envoi passe par un lien pré-rempli — WhatsApp, SMS ou courriel. Le message
// part du téléphone de Fouad : gratuit, immédiat, aucun compte tiers à gérer.
// Chaque envoi est tracé dans bilans_envoyes pour savoir qui a déjà reçu le sien.

const bilanDonnees = (eleve, lundi, seances, absences, crs) => {
  const uniq = arr => [...new Set(arr.filter(Boolean).map(s => s.trim()).filter(Boolean))];
  return {
    periode: libelleSemaine(lundi),
    nbSeances: seances.length,
    jours: seances.map(s => fmtJourCourt(s.date)),
    notions: [...new Set(crs.flatMap(c => splitNotions(c.notions)))],
    difficultes: uniq(crs.map(c => c.difficultes)),
    progres: uniq(crs.map(c => c.progres)),
    devoirs: uniq(crs.map(c => c.devoirs)),
    absences: absences.map(a => ({ jour: fmtDateLongue(a.date), justifie: a.statut === "absent_j" }))
  };
};

const makeBilanWhatsApp = (e, d) => {
  const L = [];
  L.push("*Boost'Étude — Bilan de la semaine*");
  L.push(`_${d.periode}_`);
  L.push("");
  L.push(`Bonjour ${e.parent},`);
  L.push("");
  L.push(`Voici le point sur ${e.prenom} cette semaine.`);
  L.push("");
  L.push(`📅 *Séances* : ${d.nbSeances}${d.jours.length ? ` (${d.jours.join(", ")})` : ""}`);
  d.absences.forEach(a => L.push(`📌 Absent(e) le ${a.jour}${a.justifie ? " (justifié)" : ""}`));
  if (d.notions.length)     L.push(`📘 *Travaillé* : ${d.notions.join(", ")}`);
  if (d.progres.length)     L.push(`✅ *Points forts* : ${phrase(d.progres.join(" "))}`);
  if (d.difficultes.length) L.push(`⚠️ *À consolider* : ${phrase(d.difficultes.join(" "))}`);
  if (d.devoirs.length)     L.push(`📝 *Pour la prochaine séance* : ${phrase(d.devoirs.join(" "))}`);
  L.push("");
  L.push("Bonne fin de semaine,");
  L.push("M. El Mkhanter — Boost'Étude");
  return L.join("\n");
};

const makeBilanSMS = (e, d) => {
  const bouts = [`Boost'Étude - Bilan de ${e.prenom} (${d.periode}) : ${d.nbSeances} séance${d.nbSeances > 1 ? "s" : ""}.`];
  if (d.absences.length)    bouts.push(`Absent(e) le ${d.absences.map(a => a.jour).join(", ")}.`);
  if (d.notions.length)     bouts.push(`Travaillé : ${d.notions.join(", ")}.`);
  if (d.progres.length)     bouts.push(`Points forts : ${phrase(d.progres.join(" "))}`);
  if (d.difficultes.length) bouts.push(`À consolider : ${phrase(d.difficultes.join(" "))}`);
  if (d.devoirs.length)     bouts.push(`À faire : ${phrase(d.devoirs.join(" "))}`);
  bouts.push("M. El Mkhanter, Boost'Étude");
  return bouts.join(" ");
};

const makeBilanEmail = (e, d) => ({
  sujet: `Bilan de la semaine — ${e.prenom} ${e.nom} — Boost'Étude`,
  corps: [
    `Bonjour ${e.parent},`,
    "",
    `Voici le bilan de ${e.prenom} pour la semaine du ${d.periode}.`,
    "",
    `Séances suivies : ${d.nbSeances}${d.jours.length ? ` (${d.jours.join(", ")})` : ""}`,
    ...d.absences.map(a => `Absence le ${a.jour}${a.justifie ? " (justifiée)" : ""}`),
    d.notions.length     ? `Notions travaillées : ${d.notions.join(", ")}` : null,
    d.progres.length     ? `Points forts : ${phrase(d.progres.join(" "))}` : null,
    d.difficultes.length ? `À consolider : ${phrase(d.difficultes.join(" "))}` : null,
    d.devoirs.length     ? `Travail pour la prochaine séance : ${phrase(d.devoirs.join(" "))}` : null,
    "",
    "Je reste à votre disposition si vous souhaitez en échanger.",
    "",
    "Cordialement,",
    "M. El Mkhanter — Boost'Étude"
  ].filter(x => x !== null).join("\n")
});

function CarteBilan({ eleve, donnees, envois, onEnvoi }) {
  const [apercu, setApercu] = useState(null);
  const [copie, setCopie] = useState(false);

  const txtWA = makeBilanWhatsApp(eleve, donnees);
  const txtSMS = makeBilanSMS(eleve, donnees);
  const mail = makeBilanEmail(eleve, donnees);
  const tel = (eleve.tel || "").replace(/\s/g, "");
  const dernier = envois[0];
  const vide = !donnees.notions.length && !donnees.difficultes.length && !donnees.progres.length && !donnees.devoirs.length;

  const copier = () => {
    const fait = () => { setCopie(true); setTimeout(() => setCopie(false), 2000); };
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(txtWA).then(fait).catch(fait);
    else fait();
  };

  const bouton = (canal, href, couleur, icone, libelle, dispo, texte) => dispo
    ? h("a", {
        href, target: "_blank", rel: "noopener noreferrer",
        onClick: () => onEnvoi(canal, canal === "email" ? eleve.email : eleve.tel, texte),
        style: { flex: 1, background: `${couleur}22`, border: `1px solid ${couleur}66`, borderRadius: 10, padding: "11px 6px", color: couleur, textDecoration: "none", fontSize: 13, fontWeight: 700, textAlign: "center", display: "block" }
      }, `${icone} ${libelle}`)
    : null;

  return h("div", {
    style: {
      background: dernier ? C.greenPale : C.surface,
      border: `1px solid ${dernier ? C.greenBord : C.goldBord}`,
      borderRadius: 14, padding: 13, marginBottom: 10
    }
  },
    h("div", { style: { display: "flex", alignItems: "center", gap: 10, marginBottom: 10 } },
      h(Avatar, { p: eleve.prenom, n: eleve.nom, s: 38 }),
      h("div", { style: { flex: 1, minWidth: 0 } },
        h("div", { style: { fontSize: 15, fontWeight: 800, color: C.texte, fontFamily: FD } }, `${eleve.prenom} ${eleve.nom}`),
        h("div", { style: { fontSize: 11, color: C.gray } },
          `${donnees.nbSeances} séance${donnees.nbSeances > 1 ? "s" : ""}`,
          donnees.absences.length ? ` • ${donnees.absences.length} absence${donnees.absences.length > 1 ? "s" : ""}` : "",
          eleve.tel ? "" : " • pas de téléphone")),
      dernier && h("span", { style: { fontSize: 10, fontWeight: 700, color: C.green, background: C.greenPale, padding: "4px 9px", borderRadius: 20, whiteSpace: "nowrap" } },
        "✓ " + (dernier.canal === "whatsapp" ? "WhatsApp" : dernier.canal === "sms" ? "SMS" : "Email"))
    ),

    vide && h("div", { style: { fontSize: 12, color: C.orange, background: C.orangePale, border: `1px solid ${C.orangeBord}`, borderRadius: 8, padding: "8px 10px", marginBottom: 10, lineHeight: 1.5 } },
      "Aucun compte-rendu cette semaine : le bilan ne mentionnera que la présence. Passez par l'onglet Suivi pour l'enrichir."),

    !vide && h("div", { style: { fontSize: 12, color: C.gray, marginBottom: 10, lineHeight: 1.6 } },
      donnees.notions.length ? h("div", null, h("span", { style: { color: C.gold, fontWeight: 700 } }, "Travaillé : "), donnees.notions.join(", ")) : null,
      donnees.difficultes.length ? h("div", null, h("span", { style: { color: C.orange, fontWeight: 700 } }, "À consolider : "), donnees.difficultes.join(" ")) : null),

    apercu && h("div", { style: { background: C.surface2, border: `1px solid ${C.bord}`, borderRadius: 8, padding: 11, marginBottom: 10, fontSize: 12, color: C.texte, lineHeight: 1.6, whiteSpace: "pre-line" } },
      apercu === "email" ? h("div", { style: { fontSize: 11, color: C.gold, fontWeight: 700, marginBottom: 6 } }, "Objet : " + mail.sujet) : null,
      apercu === "whatsapp" ? txtWA : apercu === "sms" ? txtSMS : mail.corps,
      h("button", {
        onClick: () => setApercu(null),
        style: { display: "block", marginTop: 8, background: "none", border: "none", color: C.gray, cursor: "pointer", fontSize: 12, fontFamily: "inherit" }
      }, "✕ Fermer")),

    h("div", { style: { display: "flex", gap: 6, marginBottom: 8 } },
      bouton("whatsapp", `https://wa.me/${telWhatsApp(eleve.tel)}?text=${encodeURIComponent(txtWA)}`, "#25d366", "💬", "WhatsApp", !!eleve.tel, txtWA),
      bouton("sms", `sms:${tel}?body=${encodeURIComponent(txtSMS)}`, C.blue, "📱", "SMS", !!eleve.tel, txtSMS),
      bouton("email", `mailto:${eleve.email}?subject=${encodeURIComponent(mail.sujet)}&body=${encodeURIComponent(mail.corps)}`, C.gold, "✉️", "Email", !!eleve.email, mail.corps)
    ),

    h("div", { style: { display: "flex", gap: 6 } },
      ["whatsapp", "sms", "email"].map(k => h("button", {
        key: k,
        onClick: () => setApercu(apercu === k ? null : k),
        style: { flex: 1, background: apercu === k ? C.navyPale : C.surface, border: `1px solid ${C.bord}`, borderRadius: 8, padding: "7px 4px", color: apercu === k ? C.gold : C.gray, cursor: "pointer", fontSize: 11, fontWeight: 700, fontFamily: "inherit" }
      }, "👁 " + (k === "whatsapp" ? "WA" : k === "sms" ? "SMS" : "Mail"))),
      h("button", {
        onClick: copier,
        style: { flex: 1, background: copie ? C.greenPale : C.surface, border: `1px solid ${C.bord}`, borderRadius: 8, padding: "7px 4px", color: copie ? C.green : C.gray, cursor: "pointer", fontSize: 11, fontWeight: 700, fontFamily: "inherit" }
      }, copie ? "✅ Copié" : "📋 Copier")
    ),

    !eleve.tel && !eleve.email && h("div", { style: { fontSize: 11, color: C.gray, fontStyle: "italic", marginTop: 8 } },
      "Ajoutez un téléphone ou un email parent dans la fiche élève pour pouvoir envoyer.")
  );
}

function ModuleBilans({ eleves, groupes, appels, comptesRendus, bilans, monProfilId, onLog }) {
  const [lundi, setLundi] = useState(lundiDe(todayStr()));
  const dimanche = addJours(lundi, 6);
  const semaineId = isoSemaine(lundi);

  // Séances et absences reconstituées depuis la feuille d'appel.
  const semaineDe = eid => {
    const gs = groupes.filter(g => (g.eids || []).includes(eid));
    const presentes = [], absences = [];
    Object.entries(appels).forEach(([k, p]) => {
      const parts = k.split(":");
      if (parts[0] !== "ap") return;
      const [, gid, d] = parts;
      if (d < lundi || d > dimanche) return;
      const g = gs.find(x => x.id === gid);
      if (!g) return;
      if (p[eid] === "present") presentes.push({ date: d, matiere: g.matiere || "" });
      else if (p[eid] === "absent_j" || p[eid] === "absent_nj") absences.push({ date: d, statut: p[eid] });
    });
    presentes.sort((a, b) => a.date.localeCompare(b.date));
    absences.sort((a, b) => a.date.localeCompare(b.date));
    return { presentes, absences };
  };

  const lignes = eleves.filter(e => e.actif !== false).map(e => {
    const { presentes, absences } = semaineDe(e.id);
    if (!presentes.length && !absences.length) return null;
    const crs = comptesRendus
      .filter(c => c.eleve_id === e.id && c.date >= lundi && c.date <= dimanche)
      .sort((a, b) => a.date.localeCompare(b.date));
    return {
      eleve: e,
      donnees: bilanDonnees(e, lundi, presentes, absences, crs),
      envois: bilans.filter(b => b.eleve_id === e.id && b.semaine === semaineId)
    };
  }).filter(Boolean).sort((a, b) => a.eleve.prenom.localeCompare(b.eleve.prenom));

  const nbEnvoyes = lignes.filter(l => l.envois.length).length;
  const semaineCourante = lundi === lundiDe(todayStr());

  return h("div", null,
    h("div", { style: { display: "flex", alignItems: "center", gap: 8, background: C.navyPale, border: `1px solid ${C.bord}`, borderRadius: 14, padding: "10px 12px", marginBottom: 14 } },
      h("button", {
        onClick: () => setLundi(addJours(lundi, -7)),
        style: { background: C.surface, border: "none", borderRadius: 8, padding: "8px 12px", color: C.gold, cursor: "pointer", fontSize: 16, fontFamily: "inherit" }
      }, "‹"),
      h("div", { style: { flex: 1, textAlign: "center" } },
        h("div", { style: { fontSize: 15, fontWeight: 800, color: C.texte, fontFamily: FD } }, libelleSemaine(lundi)),
        h("div", { style: { fontSize: 11, color: C.gray } }, semaineCourante ? "Semaine en cours" : "Semaine " + semaineId.split("-W")[1])),
      h("button", {
        onClick: () => setLundi(addJours(lundi, 7)),
        disabled: semaineCourante,
        style: { background: C.surface, border: "none", borderRadius: 8, padding: "8px 12px", color: semaineCourante ? C.grisClair : C.gold, cursor: semaineCourante ? "default" : "pointer", fontSize: 16, fontFamily: "inherit" }
      }, "›")
    ),

    h("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 } },
      [
        { e: "📨", v: lignes.length, l: "À envoyer", c: C.gold },
        { e: "✅", v: `${nbEnvoyes}/${lignes.length}`, l: "Envoyés", c: C.green }
      ].map((s, i) => h("div", {
        key: i,
        style: { background: C.surface, border: `1px solid ${C.bord}`, borderRadius: 12, padding: "13px 8px", textAlign: "center" }
      },
        h("div", { style: { fontSize: 18, marginBottom: 2 } }, s.e),
        h("div", { style: { fontSize: 16, fontWeight: 800, color: s.c, fontFamily: FD } }, s.v),
        h("div", { style: { fontSize: 10, color: C.gray, fontWeight: 700, textTransform: "uppercase" } }, s.l)))
    ),

    lignes.length === 0
      ? h("div", { style: { textAlign: "center", padding: "40px 20px", color: C.gray } },
          h("div", { style: { fontSize: 36, marginBottom: 12 } }, "📭"),
          h("div", { style: { fontSize: 13, lineHeight: 1.6 } },
            "Aucune séance pointée cette semaine.", h("br", null), "Les bilans apparaissent dès que l'appel est fait."))
      : lignes.map(l => h(CarteBilan, {
          key: l.eleve.id,
          eleve: l.eleve,
          donnees: l.donnees,
          envois: l.envois,
          onEnvoi: (canal, destinataire, message) => onLog({
            eleve_id: l.eleve.id, semaine: semaineId,
            periode_debut: lundi, periode_fin: dimanche,
            canal, destinataire: destinataire || null, message,
            auteur_id: monProfilId || null
          })
        }))
  );
}
