import sys, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).parent))
from patcher import appliquer

# ── Remise pour engagement multiple ──────────────────────────────────────────
# Deux enfants d'une même famille, ou un enfant qui suit deux matières : le geste
# commercial est le même, 2,50 € de moins par heure sur chaque inscription. Un
# foyer se reconnaît au téléphone du parent, à défaut à son adresse mail.
#
# La remise est appliquée au tarif horaire dès le chargement : tout ce qui calcule
# un montant — la facture, le PDF, les messages — en hérite sans rien changer.
# Le tarif d'origine reste sous `thBase` pour pouvoir l'afficher.

chemin = pathlib.Path("src/app/02-normalisation-depuis-supabase.js")
texte = chemin.read_text(encoding="utf-8")
ajout = '''
// Un foyer : le téléphone du parent, à défaut son adresse mail. Deux familles
// différentes ne partagent pas un numéro ; deux enfants d'une même famille, si.
const cleFoyer = e => {
  const tel = String(e.tel || "").replace(/\\D/g, "");
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
'''
assert "appliquerRemiseMulti" not in texte
chemin.write_text(texte + ajout, encoding="utf-8")
print("✅ src/app/02-normalisation-depuis-supabase.js — calcul de la remise")


appliquer("src/app/03-api-supabase.js", [
    ("""  async fetchAll(isAdmin) {
    const borne = depuisUnAn();
    const [el, gr, co, pr, eg] = await Promise.all([sb.from("eleves").select("*").order("nom"), sb.from("groupes").select("*").order("nom"), sb.from("cours").select("*").gte("date", borne), sb.from("presences").select("*").gte("date", borne), sb.from("eleves_groupes").select("eleve_id,groupe_id")]);
    if (e1) throw e1;""",
     """  async fetchAll(isAdmin) {
    const borne = depuisUnAn();
    const [el, gr, co, pr, eg] = await Promise.all([sb.from("eleves").select("*").order("nom"), sb.from("groupes").select("*").order("nom"), sb.from("cours").select("*").gte("date", borne), sb.from("presences").select("*").gte("date", borne), sb.from("eleves_groupes").select("eleve_id,groupe_id")]);
    if (e1) throw e1;"""),

    ("""    const elList = (el.data || []).map(normalizeEleveDB);
    const egList = eg.data || [];
    const grList = (gr.data || []).map(g => normalizeGroupeDB(g, elList, egList));""",
     """    let elList = (el.data || []).map(normalizeEleveDB);
    const egList = eg.data || [];
    const grList = (gr.data || []).map(g => normalizeGroupeDB(g, elList, egList));
    // La remise d'engagement multiple s'applique avant tout calcul de montant,
    // pour que la facture, le PDF et les messages disent tous la même chose.
    if (isAdmin) {
      const { data: reg } = await sb.from("parametres_entreprise").select("remise_multi").maybeSingle();
      elList = appliquerRemiseMulti(elList, grList, reg?.remise_multi);
    }"""),
], "(api : remise appliquée au chargement)")


# La facture montre d'où vient le prix : sans cela, un parent qui compare deux
# factures ne comprend pas pourquoi le tarif horaire a changé.
appliquer("src/app/16b-facture-pdf.js", [
    ("""      page.texte(M + 10, y + 16,
        `Cours de soutien scolaire en groupe · séances de 2 h · ${g.dates.length} séance${g.dates.length > 1 ? "s" : ""}`,
        { taille: 8, couleur: GRIS });""",
     """      page.texte(M + 10, y + 16,
        `Cours de soutien scolaire en groupe · séances de 2 h · ${g.dates.length} séance${g.dates.length > 1 ? "s" : ""}` +
        (eleve.remise > 0 ? ` · remise de ${euros(eleve.remise)}/h (inscriptions multiples)` : ""),
        { taille: 8, couleur: GRIS });"""),
], "(facture : la remise est dite)")
