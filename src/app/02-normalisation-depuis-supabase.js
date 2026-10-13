// ─── NORMALISATION DEPUIS SUPABASE ───────────────────────────
const normalizeEleveDB = x => ({
  id: x.id,
  prenom: x.prenom,
  nom: x.nom,
  niveau: x.niveau,
  th: TARIFS_H[x.niveau] ?? 12.5,
  mp: x.mode_paiement ?? "Virement",
  actif: x.actif !== false,
  email: x.parent_email ?? "",
  tel: x.parent_tel ?? "",
  parent: x.parent_nom ?? `Parent de ${x.prenom}`,
  notes: x.notes ?? "",
  groupe_id: x.groupe_id ?? null
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

// Une inscription = un élève dans une matière. Un élève qui suit maths et physique
// en compte deux, exactement comme deux frères qui suivent les maths.
const compterInscriptions = (eleves, groupes) => {
  const par = {};
  (eleves || []).forEach(e => {
    if (e.actif === false) return;
    const k = cleFoyer(e);
    if (!k) return;
    const matieres = new Set((groupes || [])
      .filter(g => (g.eids || []).includes(e.id))
      .map(g => g.matiere || "Cours"));
    par[k] = (par[k] || 0) + Math.max(1, matieres.size);
  });
  return par;
};

// À partir de deux inscriptions dans le même foyer, chacune bénéficie de la remise.
const appliquerRemiseMulti = (eleves, groupes, remise) => {
  const valeur = Number(remise) || 0;
  if (!(valeur > 0)) return eleves;
  const par = compterInscriptions(eleves, groupes);
  return (eleves || []).map(e => {
    const k = cleFoyer(e);
    const n = k ? (par[k] || 0) : 0;
    if (n < 2) return e;
    const reduit = Math.max(0, Math.round((e.th - valeur) * 100) / 100);
    return { ...e, th: reduit, thBase: e.th, remise: valeur, inscriptionsFoyer: n };
  });
};
