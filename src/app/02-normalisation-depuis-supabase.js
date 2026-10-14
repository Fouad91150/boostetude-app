// ─── NORMALISATION DEPUIS SUPABASE ───────────────────────────
const normalizeEleveDB = x => ({
  id: x.id,
  // Espaces parasites retirés à la lecture : « Ilyes  Nassi » s'affichait avec
  // deux espaces dans les messages aux parents.
  prenom: (x.prenom || "").replace(/\s+/g, " ").trim(),
  nom: (x.nom || "").replace(/\s+/g, " ").trim(),
  niveau: x.niveau,
  th: TARIFS_H[x.niveau] ?? 12.5,
  mp: x.mode_paiement ?? "Virement",
  actif: x.actif !== false,
  email: x.parent_email ?? "",
  tel: x.parent_tel ?? "",
  parent: x.parent_nom ?? `Parent de ${x.prenom}`,
  notes: x.notes ?? "",
  groupe_id: x.groupe_id ?? null,
  // Nouvel élève : sa première séance de chaque matière n'est pas facturée.
  premierCoursOffert: x.premier_cours_offert === true
});
// Un élève peut suivre plusieurs matières (ex. Maths + Physique) : l'appartenance
// à un groupe passe par la table de liaison eleves_groupes (many-to-many). La colonne
// eleves.groupe_id est conservée comme "groupe principal" historique et fusionnée ici
// par sécurité, mais eleves_groupes fait foi pour tout ce qui est appel/facturation.
const normalizeGroupeDB = (g, elevesList, egList) => {
  const membres = new Set(elevesList.filter(e => e.groupe_id === g.id).map(e => e.id));
  (egList || []).filter(r => r.groupe_id === g.id).forEach(r => membres.add(r.eleve_id));
  return {
    id: g.id,
    nom: g.nom,
    niveau: g.niveau,
    matiere: g.matiere ?? "Mathématiques",
    jour: g.jour || "",
    hd: g.heure_debut || "",
    hf: g.heure_fin || "",
    max: g.capacite_max ?? 6,
    profText: g.prof ?? "",
    profId: g.prof_id ?? null,
    eids: Array.from(membres)
  };
};

// Un foyer : le téléphone du parent, à défaut son adresse mail. Deux familles
// différentes ne partagent pas un numéro ; deux enfants d'une même famille, si.
const cleFoyer = e => {
  const tel = String(e.tel || "").replace(/\D/g, "");
  if (tel.length >= 9) return "t:" + tel.slice(-9);
  const mail = String(e.email || "").trim().toLowerCase();
  return mail ? "m:" + mail : "";
};

// Les matières distinctes d'un élève (deux créneaux de maths = une matière).
const matieresEleve = (e, groupes) => new Set((groupes || [])
  .filter(g => (g.eids || []).includes(e.id))
  .map(g => g.matiere || "Cours"));

// Compte, par foyer, les inscriptions (élève × matière) et les enfants actifs.
const compterInscriptions = (eleves, groupes) => {
  const par = {};
  (eleves || []).forEach(e => {
    if (e.actif === false) return;
    const k = cleFoyer(e);
    if (!k) return;
    par[k] = (par[k] || 0) + Math.max(1, matieresEleve(e, groupes).size);
  });
  return par;
};
const compterEnfants = eleves => {
  const par = {};
  (eleves || []).forEach(e => {
    if (e.actif === false) return;
    const k = cleFoyer(e);
    if (k) par[k] = (par[k] || 0) + 1;
  });
  return par;
};

// Deux remises cumulables, chacune de `remise` €/h (2,50 € par défaut), décidées
// par Fouad le 14/10/2026 :
//  · deux matières (maths + physique) : remise sur TOUTES les heures de l'élève ;
//  · fratrie : dès deux enfants actifs du même foyer, chacun a la remise.
// Un enfant d'une fratrie qui suit deux matières cumule les deux (5 €/h).
const appliquerRemiseMulti = (eleves, groupes, remise) => {
  const valeur = Number(remise) || 0;
  if (!(valeur > 0)) return eleves;
  const inscriptions = compterInscriptions(eleves, groupes);
  const enfants = compterEnfants(eleves);
  return (eleves || []).map(e => {
    const deuxMatieres = matieresEleve(e, groupes).size >= 2;
    const k = cleFoyer(e);
    const fratrie = e.actif !== false && !!k && (enfants[k] || 0) >= 2;
    const motifs = [deuxMatieres && "deux matières", fratrie && "fratrie"].filter(Boolean);
    if (!motifs.length) return e;
    const total = Math.round(valeur * motifs.length * 100) / 100;
    const reduit = Math.max(0, Math.round((e.th - total) * 100) / 100);
    return { ...e, th: reduit, thBase: e.th, remise: total, motifsRemise: motifs,
             inscriptionsFoyer: k ? (inscriptions[k] || 0) : matieresEleve(e, groupes).size };
  });
};
