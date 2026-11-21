// ─── NORMALISATION DEPUIS SUPABASE ───────────────────────────
const partPayee = v => {
  const n = Number(v);
  return v === null || v === undefined || v === "" || !Number.isFinite(n) ? 1 : Math.min(1, Math.max(0, n));
};
// Le tarif spécial voyage dans les notes de l'élève, sous une étiquette lisible
// (« [Tarif : moitié prix] », « [Tarif : gratuit] ») : aucune colonne à créer
// dans Supabase. L'étiquette est retirée des notes affichées.
const ETIQUETTE_TARIF = /\s*\[Tarif\s*:\s*(gratuit|moitié prix)\]\s*/i;
const partDepuisNotes = notes => {
  const m = (notes || "").match(ETIQUETTE_TARIF);
  return !m ? null : /gratuit/i.test(m[1]) ? 0 : 0.5;
};
const notesSansTarif = notes => (notes || "").replace(ETIQUETTE_TARIF, " ").trim();
const notesAvecTarif = (notes, part) => {
  const base = notesSansTarif(notes);
  const tag = part === 0 ? "[Tarif : gratuit]" : part === 0.5 ? "[Tarif : moitié prix]" : "";
  return [tag, base].filter(Boolean).join(" ");
};
const estGratuit = e => !!e && e.part === 0;
const LIBELLE_PART = p => p === 0 ? "Gratuit" : p === 1 || p == null ? "Tarif normal" : p === 0.5 ? "Moitié prix" : `${Math.round(p * 100)} % du prix`;
// Applique la part payée au tarif horaire, après les remises : Marwa à moitié
// prix paie la moitié de son tarif déjà remisé.
const appliquerPart = eleves => (eleves || []).map(e => {
  if (e.part == null || e.part === 1) return e;
  return { ...e, th: Math.round(e.th * e.part * 100) / 100, thAvantPart: e.th };
});
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
  notes: notesSansTarif(x.notes),
  groupe_id: x.groupe_id ?? null,
  // Nouvel élève : sa première séance de chaque matière n'est pas facturée.
  premierCoursOffert: x.premier_cours_offert === true,
  // Tarif spécial (21/11/2026) : part du prix payée — 1 normal, 0,5 moitié
  // prix, 0 gratuit. Lu dans les notes (voir ETIQUETTE_TARIF).
  identifiant: x.identifiant ?? null,
  part: x.part_payee != null ? partPayee(x.part_payee) : (partDepuisNotes(x.notes) ?? 1)
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
    // Un enfant gratuit (offre famille) ne déclenche pas la remise fratrie.
    if (e.part === 0) return;
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
