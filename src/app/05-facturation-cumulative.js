// ─── FACTURATION CUMULATIVE ────────────────────────────────────
// La dernière facture payée d'un élève marque la fin de la période déjà réglée.
// Tout ce qui suit (séances présentes après cette date) s'accumule sur une facture
// ouverte unique, jusqu'à ce qu'elle soit à son tour marquée payée.
// Une facture est « figée » dès qu'elle porte un numéro — elle est partie chez le
// parent — ou qu'elle est soldée. Les séances qu'elle couvre sont définitivement
// facturées ; les suivantes alimentent un nouveau brouillon, même si le parent n'a
// encore rien versé. Sans cela, une facture émise continuerait de grossir après
// avoir été envoyée, et son montant ne vaudrait plus rien.
const dernierePeriodeFin = (eid, factures) => {
  // Un stage de vacances se facture à part, au forfait : sa période ne doit pas
  // faire croire que les cours de la même semaine ont déjà été réglés.
  const figees = (factures || []).filter(f =>
    f.eleveId === eid && !f.stageId && f.statut !== "annulee" && (f.statut === "paye" || f.numero));
  let fin = null;
  figees.forEach(f => {
    const dates = f.datesSeances || [];
    const derniere = dates.reduce((max, d) => (!max || d.date > max ? d.date : max), f.periodeFin || null);
    if (derniere && (!fin || derniere > fin)) fin = derniere;
  });
  return fin;
};

// Les séances déjà portées par une facture figée, une à une (date + matière).
// Couper à « la dernière date facturée » perdait des séances pour de bon : la
// physique d'un jour où seuls les maths figuraient sur la facture, ou un appel
// saisi en retard pour une date antérieure. Une facture ancienne sans détail des
// séances garde l'ancienne règle, par sa date de fin (`avant`).
//
// Depuis 3.4.0 chaque séance facturée porte aussi son groupe (`groupeId`) : la
// clé date + groupe survit au renommage d'une matière. Les séances plus
// anciennes (date + matière seulement) restent reconnues ; et si leur matière
// n'existe plus chez l'élève — matière renommée — la date suffit.
const dejaFacturees = (eid, factures) => {
  const cles = new Set();
  const anciennes = new Map(); // date → matières inscrites sans groupe
  let avant = null;
  (factures || []).filter(f =>
    f.eleveId === eid && !f.stageId && f.statut !== "annulee" && (f.statut === "paye" || f.numero))
    .forEach(f => {
      const dates = f.datesSeances || [];
      if (dates.length) dates.forEach(d => {
        if (d.groupeId) cles.add(`${d.date}|g:${d.groupeId}`);
        else {
          cles.add(`${d.date}|${d.matiere || ""}`);
          if (!anciennes.has(d.date)) anciennes.set(d.date, new Set());
          anciennes.get(d.date).add(d.matiere || "");
        }
      });
      else if (f.periodeFin && (!avant || f.periodeFin > avant)) avant = f.periodeFin;
    });
  return { cles, anciennes, avant };
};

// Ce qu'il reste à régler sur une facture, une fois les versements déduits.
const resteDu = f => Math.max(0, Math.round(((f?.montant || 0) - (f?.encaisse || 0)) * 100) / 100);
// Un lien Stripe vaut pour le montant exact qui lui a donné naissance. Après un
// acompte en espèces, il réclamerait trop : on ne le propose plus, et le prochain
// envoi en fabrique un neuf, au bon montant.
const lienPaiementValide = f => {
  if (!f || !f.lienPaiement || !f.numero) return null;
  if (f.statut === "paye" || f.statut === "annulee") return null;
  const reste = resteDu(f);
  if (!(reste > 0)) return null;
  return Math.round(Number(f.lienMontant) * 100) / 100 === reste ? f.lienPaiement : null;
};
// Chaque séance renvoyée porte sa matière (un même élève peut suivre plusieurs
// matières, ex. Maths + Physique) afin que la facture détaille quoi a été suivi.
// Toute présence de l'élève compte, y compris dans un groupe qu'il a quitté
// depuis : sinon un changement de groupe effaçait ses séances non facturées.
const seancesOuvertes = (eid, appels, groupes, depuis) => {
  const groupeDe = id => (groupes || []).find(g => g.id === id);
  const matieresActuelles = new Set((groupes || []).filter(g => (g.eids || []).includes(eid)).map(g => g.matiere || ""));
  const dejaVue = (date, g, gid) => {
    if (!depuis) return false;
    if (typeof depuis === "string") return date <= depuis;
    if (depuis.avant && date <= depuis.avant) return true;
    const matiere = g?.matiere || "";
    if (depuis.cles.has(`${date}|g:${gid}`) || depuis.cles.has(`${date}|${matiere}`)) return true;
    // Ancienne facture dont la matière a disparu des groupes de l'élève :
    // la séance du même jour est réputée facturée (jamais deux fois).
    const old = depuis.anciennes && depuis.anciennes.get(date);
    return !!old && [...old].some(m => !matieresActuelles.has(m));
  };
  return Object.entries(appels || {}).filter(([k, p]) => {
    const [tag, gid, date] = k.split(":");
    if (tag !== "ap" || !p || p[eid] !== "present") return false;
    return !dejaVue(date, groupeDe(gid), gid);
  }).map(([k]) => {
    const [, gid, date] = k.split(":");
    return { date, matiere: groupeDe(gid)?.matiere || "", groupeId: gid };
  }).sort((a, b) => a.date.localeCompare(b.date));
};
// ── Premier cours offert (3.5.2) ──────────────────────────────────────────
// La séance offerte est la toute première présence de l'élève, tous groupes
// confondus. Elle figure sur la facture (à 0 €) mais ne se paie pas ; elle compte
// pour le rythme de facturation, et une fois facturée elle ne revient jamais.
const premiereSeance = (eid, appels) => Object.entries(appels || {})
  .filter(([k, p]) => k.startsWith("ap:") && p && p[eid] === "present")
  .map(([k]) => { const [, gid, date] = k.split(":"); return { gid, date }; })
  .sort((a, b) => a.date.localeCompare(b.date) || a.gid.localeCompare(b.gid))[0] || null;
const marquerOfferte = (eleve, dates, appels) => {
  if (!eleve || !eleve.offert) return dates;
  const p = premiereSeance(eleve.id, appels);
  if (!p) return dates;
  return (dates || []).map(d => d.date === p.date && (!d.groupeId || d.groupeId === p.gid) ? { ...d, offert: true } : d);
};
const montantSeances = (eleve, dates) =>
  parseFloat(((dates || []).filter(d => !d.offert).length * 2 * eleve.th).toFixed(2));
const seancesOffertes = dates => (dates || []).filter(d => d.offert);
const seancesPayantes = dates => (dates || []).filter(d => !d.offert);

// Regroupe une liste de séances {date,matiere} par matière, en conservant l'ordre
// d'apparition — utilisé partout où la facture doit détailler Maths/Physique séparément.
const groupParMatiere = dates => {
  const map = new Map();
  (dates || []).forEach(d => {
    const mat = d.matiere || "Cours";
    if (!map.has(mat)) map.set(mat, []);
    map.get(mat).push(d.date);
  });
  return Array.from(map, ([matiere, dates]) => ({
    matiere,
    dates
  }));
};
const horaireLabel = g => {
  if (g.jour && g.hd && g.hf) return `🕐 ${g.hd}–${g.hf} • ${g.jour}`;
  return "🕐 Horaire à définir";
};

// Lignes imprimées d'une facture, déduites de la facture elle-même.
// Le tarif horaire se lit dans le MONTANT figé (montant ÷ heures), jamais dans la
// fiche actuelle de l'élève : un élève passé de 3e en 2nde, ou une remise
// ajoutée après coup, faisait imprimer « 120,00 € » au-dessus d'un « NET À PAYER
// 100,00 € ». La dernière ligne absorbe l'arrondi pour que la somme tombe juste.
const lignesFacture = (matieres, montant, thSecours) => {
  const heures = (matieres || []).reduce((s, g) => s + g.dates.length * 2, 0);
  const m = Number(montant) || 0;
  const th = heures > 0 && m > 0 ? Math.round((m / heures) * 100) / 100 : (Number(thSecours) || 0);
  let cumul = 0;
  return (matieres || []).map((g, i, tout) => {
    const h = g.dates.length * 2;
    const total = i === tout.length - 1 && heures > 0 && m > 0
      ? Math.round((m - cumul) * 100) / 100
      : Math.round(h * th * 100) / 100;
    cumul += total;
    return { ...g, heures: h, th, total };
  });
};

// Brouillons en retard sur l'appel. Seul l'administrateur peut écrire les
// factures (sécurité de la base) : un appel enregistré par un collègue ne
// recalculait donc rien, et ses élèves n'apparaissaient jamais « à envoyer ».
// Au chargement, l'administrateur rattrape ce retard. Prudence voulue : on ne
// fait qu'AJOUTER des séances manquantes, jamais en retirer ni supprimer.
const brouillonsEnRetard = (eleves, groupes, appels, factures) => (eleves || [])
  .filter(e => e.actif !== false)
  .map(e => {
    const dates = marquerOfferte(e, seancesOuvertes(e.id, appels || {}, groupes || [], dejaFacturees(e.id, factures))
      .filter(d => !estFuture(d.date)), appels);
    const brouillon = (factures || []).find(f => f.eleveId === e.id && !f.numero && !f.stageId && f.statut !== "paye" && f.statut !== "annulee");
    const actuel = brouillon ? (brouillon.nbSeances || 0) : 0;
    return dates.length > actuel
      ? { eid: e.id, dates, montant: montantSeances(e, dates) }
      : null;
  })
  .filter(Boolean);

