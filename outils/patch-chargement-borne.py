import sys, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).parent))
from patcher import appliquer

# ── Le chargement initial cesse de grossir avec l'historique ─────────────────
# L'application téléchargeait l'intégralité des cours et des présences à chaque
# ouverture. Quarante-six lignes aujourd'hui, c'est instantané ; après trois ans
# d'exploitation ce sont des milliers de lignes à faire passer en 4G dans une
# salle de cours, avant que le premier écran s'affiche.
#
# Douze mois glissants : au-delà, les factures sont émises et figées, les bilans
# envoyés. L'année écoulée couvre l'exercice comptable en cours et tout ce que les
# écrans savent montrer.

appliquer("src/app/03-api-supabase.js", [
    ("""const api = {
  async fetchAll(isAdmin) {
    const [el, gr, co, pr, eg] = await Promise.all([sb.from("eleves").select("*").order("nom"), sb.from("groupes").select("*").order("nom"), sb.from("cours").select("*"), sb.from("presences").select("*"), sb.from("eleves_groupes").select("eleve_id,groupe_id")]);""",
     """// Douze mois glissants : la borne du chargement initial.
const depuisUnAn = () => {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 1);
  return d.toISOString().slice(0, 10);
};
const api = {
  async fetchAll(isAdmin) {
    const borne = depuisUnAn();
    const [el, gr, co, pr, eg] = await Promise.all([sb.from("eleves").select("*").order("nom"), sb.from("groupes").select("*").order("nom"), sb.from("cours").select("*").gte("date", borne), sb.from("presences").select("*").gte("date", borne), sb.from("eleves_groupes").select("eleve_id,groupe_id")]);"""),
], "(chargement initial borné à douze mois)")

# Les comptes rendus suivent la même borne : ils ne servent qu'aux bilans récents
# et aux suggestions de notions.
appliquer("src/app/03-api-supabase.js", [
    ("""    const { data, error } = await sb.from("comptes_rendus").select("*").order("date", { ascending: false });""",
     """    const { data, error } = await sb.from("comptes_rendus").select("*").gte("date", depuisUnAn()).order("date", { ascending: false });"""),
], "(comptes rendus bornés à douze mois)")
