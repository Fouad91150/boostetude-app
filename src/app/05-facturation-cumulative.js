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
// Chaque séance renvoyée porte sa matière (un même élève peut suivre plusieurs
// matières, ex. Maths + Physique) afin que la facture détaille quoi a été suivi.
// Toute présence de l'élève compte, y compris dans un groupe qu'il a quitté
// depuis : sinon un changement de groupe effaçait ses séances non facturées.
// `offert` (premier cours offert, propre à l'élève) : la toute première séance
// de l'élève DANS CHAQUE MATIÈRE est marquée `offert: true` et ne se facture pas.
// Un élève qui commence maths et physique a donc deux séances offertes.
const premieresParMatiere = (eid, appels, groupes) => {
  const groupeDe = id => (groupes || []).find(g => g.id === id);
  const premiere = {};
  Object.entries(appels || {}).forEach(([k, p]) => {
    const [tag, gid, date] = k.split(":");
    if (tag !== "ap" || !p || p[eid] !== "present" || estFuture(date)) return;
    const m = groupeDe(gid)?.matiere || "";
    if (!premiere[m] || date < premiere[m].date) premiere[m] = { date, gid };
  });
  return premiere;
};
const seancesOuvertes = (eid, appels, groupes, depuis, offert = false) => {
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
  }).sort((a, b) => a.date.localeCompare(b.date))
    .map((s, _, tout) => {
      if (!offert) return s;
      const p = premieresParMatiere(eid, appels, groupes)[s.matiere];
      return p && p.date === s.date && p.gid === s.groupeId ? { ...s, offert: true } : s;
    });
};

// Montant d'une liste de séances : les séances offertes ne se paient pas.
const montantSeances = (dates, th) =>
  parseFloat(((dates || []).filter(d => !d.offert).length * 2 * (Number(th) || 0)).toFixed(2));
// Regroupe une liste de séances {date,matiere} par matière, en conservant l'ordre
// d'apparition — utilisé partout où la facture doit détailler Maths/Physique séparément.
const groupParMatiere = dates => {
  const map = new Map();
  (dates || []).forEach(d => {
    const mat = d.matiere || "Cours";
    if (!map.has(mat)) map.set(mat, { dates: [], offertes: [] });
    map.get(mat).dates.push(d.date);
    if (d.offert) map.get(mat).offertes.push(d.date);
  });
  return Array.from(map, ([matiere, v]) => ({
    matiere,
    dates: v.dates,
    offertes: v.offertes
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
  const payees = g => g.dates.length - ((g.offertes || []).length);
  const heures = (matieres || []).reduce((s, g) => s + payees(g) * 2, 0);
  const m = Number(montant) || 0;
  const th = heures > 0 && m > 0 ? Math.round((m / heures) * 100) / 100 : (Number(thSecours) || 0);
  let cumul = 0;
  return (matieres || []).map((g, i, tout) => {
    const h = payees(g) * 2;
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
    const dates = seancesOuvertes(e.id, appels || {}, groupes || [], dejaFacturees(e.id, factures), e.premierCoursOffert)
      .filter(d => !estFuture(d.date));
    const brouillon = (factures || []).find(f => f.eleveId === e.id && !f.numero && !f.stageId && f.statut !== "paye" && f.statut !== "annulee");
    const actuel = brouillon ? (brouillon.nbSeances || 0) : 0;
    const montant = montantSeances(dates, e.th);
    // Ajout de séances, ou même nombre de séances mais montant à corriger
    // (cours offert pas encore déduit). Jamais de séance retirée.
    const aCorriger = brouillon && dates.length === actuel && Math.abs((Number(brouillon.montant) || 0) - montant) > 0.004
      && !(Number(brouillon.encaisse) > 0);
    return dates.length > actuel || aCorriger ? { eid: e.id, dates, montant } : null;
  })
  .filter(Boolean);

