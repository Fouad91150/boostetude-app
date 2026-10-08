import sys, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).parent))
from patcher import appliquer

# ── Les versements partiels ──────────────────────────────────────────────────
# Un parent règle rarement d'un coup. Jusqu'ici la facture était payée ou pas, et
# un acompte n'avait nulle part où s'inscrire. Les versements deviennent des lignes
# à part entière (table `encaissements`) ; la facture porte leur total, et son
# statut en découle : en attente, partiel, ou payée.

appliquer("src/app/03-api-supabase.js", [
    ("""      factures = (paData || []).map(p => ({
        id: p.id,
        eleveId: p.eleve_id,
        nbSeances: p.nb_seances ?? 0,
        montant: p.montant,
        statut: p.statut ?? "en_attente",""",
     """      factures = (paData || []).map(p => ({
        id: p.id,
        eleveId: p.eleve_id,
        nbSeances: p.nb_seances ?? 0,
        montant: Number(p.montant) || 0,
        encaisse: Number(p.montant_encaisse) || 0,
        statut: p.statut ?? "en_attente","""),

    # Une facture émise ne bouge plus. Les séances suivantes ouvrent un brouillon neuf.
    ("""  async syncFacture(eleveId, dates, montant) {
    const {
      data: existing,
      error: e1
    } = await sb.from("paiements").select("id,statut").eq("eleve_id", eleveId).neq("statut", "paye").maybeSingle();""",
     """  async syncFacture(eleveId, dates, montant) {
    // Seul un brouillon suit l'appel. Une facture qui porte un numéro est figée :
    // son montant a été communiqué au parent, il ne peut plus changer.
    const {
      data: existing,
      error: e1
    } = await sb.from("paiements").select("id,statut").eq("eleve_id", eleveId).is("numero", null).neq("statut", "paye").maybeSingle();"""),
], "(api : solde encaissé lu, brouillon seul synchronisé)")


# Les nouvelles opérations, à la suite des autres.
chemin = pathlib.Path("src/app/03-api-supabase.js")
texte = chemin.read_text(encoding="utf-8")
ajout = '''
// ─── ENCAISSEMENTS ───────────────────────────────────────────────────────────
// Ce que le parent a effectivement versé, versement par versement. La base
// recalcule seule le solde de la facture et son statut (déclencheur).
Object.assign(api, {
  async fetchEncaissements() {
    const { data, error } = await sb.from("encaissements").select("*").order("date", { ascending: false });
    if (error) throw error;
    return (data || []).map(e => ({
      id: e.id,
      factureId: e.facture_id,
      date: e.date,
      montant: Number(e.montant) || 0,
      mode: e.mode || "Espèces",
      note: e.note || ""
    }));
  },
  async ajouterEncaissement(factureId, { montant, mode, date, note }) {
    const valeur = Math.round((Number(montant) || 0) * 100) / 100;
    if (!(valeur > 0)) throw new Error("Le montant du versement doit être supérieur à zéro.");
    const { error } = await sb.from("encaissements").insert({
      facture_id: factureId,
      montant: valeur,
      mode: mode || "Espèces",
      date: date || todayStr(),
      note: note || null
    });
    if (error) throw error;
  },
  async supprimerEncaissement(id) {
    const { error } = await sb.from("encaissements").delete().eq("id", id);
    if (error) throw error;
  }
});
'''
assert "ENCAISSEMENTS" not in texte
chemin.write_text(texte + ajout, encoding="utf-8")
print("✅ src/app/03-api-supabase.js — opérations d'encaissement ajoutées")


# ── Le cumul repart après la dernière facture FIGÉE, pas seulement payée ──────
appliquer("src/app/05-facturation-cumulative.js", [
    ("""const dernierePeriodeFin = (eid, factures) => {
  const payees = factures.filter(f => f.eleveId === eid && f.statut === "paye" && f.periodeFin);
  if (!payees.length) return null;
  return payees.reduce((max, f) => f.periodeFin > max ? f.periodeFin : max, payees[0].periodeFin);
};""",
     """// Une facture est « figée » dès qu'elle porte un numéro — elle est partie chez le
// parent — ou qu'elle est soldée. Les séances qu'elle couvre sont définitivement
// facturées ; les suivantes alimentent un nouveau brouillon, même si le parent n'a
// encore rien versé. Sans cela, une facture émise continuerait de grossir après
// avoir été envoyée, et son montant ne vaudrait plus rien.
const dernierePeriodeFin = (eid, factures) => {
  const figees = (factures || []).filter(f => f.eleveId === eid && (f.statut === "paye" || f.numero));
  let fin = null;
  figees.forEach(f => {
    const dates = f.datesSeances || [];
    const derniere = dates.reduce((max, d) => (!max || d.date > max ? d.date : max), f.periodeFin || null);
    if (derniere && (!fin || derniere > fin)) fin = derniere;
  });
  return fin;
};

// Ce qu'il reste à régler sur une facture, une fois les versements déduits.
const resteDu = f => Math.max(0, Math.round(((f?.montant || 0) - (f?.encaisse || 0)) * 100) / 100);"""),
], "(cumul : une facture émise est figée, reste dû calculé)")
