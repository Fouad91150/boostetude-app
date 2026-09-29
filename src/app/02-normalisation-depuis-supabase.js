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
