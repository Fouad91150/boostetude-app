// ─── COULEURS ────────────────────────────────────────────────
const C = {
  navy: "#0a1428",
  gold: "#d4af37",
  cream: "#fafaf7",
  navyL: "#1a2540",
  navyM: "#0f1e38",
  goldD: "#b8962e",
  red: "#e05555",
  green: "#4caf7d",
  orange: "#e09030",
  gray: "#8892a4",
  blue: "#4a9edd"
};
// Police d'usage quotidien (chargée via Google Fonts dans index.html).
// NB: VueImpression (facture imprimée/PDF) garde volontairement "Georgia,serif" — esthétique papier distincte.
const FD = "'Poppins',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif";
const NIVEAUX = ["CP", "CE1", "CE2", "CM1", "CM2", "6ème", "5ème", "4ème", "3ème", "2nde", "1ère", "Terminale"];
// Liste fermée pour éviter les fautes de saisie/casse (ex. "physique" vs "Physique-Chimie")
// qui empêcheraient la facture de regrouper correctement les séances par matière.
const MATIERES = ["Mathématiques", "Physique-Chimie", "SVT", "Français", "Anglais", "Espagnol", "Histoire-Géographie", "Philosophie", "SES", "Autre"];
const JOURS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];
const MOIS_L = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
const MOIS_C = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"];
const TARIFS_H = {
  // Tarifs 2026-2027 : primaire 10 €/h, collège 12,50 €/h, lycée 15 €/h
  "CP": 10,
  "CE1": 10,
  "CE2": 10,
  "CM1": 10,
  "CM2": 10,
  "6ème": 12.5,
  "5ème": 12.5,
  "4ème": 12.5,
  "3ème": 12.5,
  "2nde": 15,
  "1ère": 15,
  "Terminale": 15
};
const ml = ym => {
  const [y, m] = ym.split("-");
  return `${MOIS_L[+m - 1]} ${y}`;
};
const nowYM = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};
const todayStr = () => new Date().toISOString().split("T")[0];
const lastMonths = n => {
  const r = [],
    d = new Date();
  for (let i = 0; i < n; i++) {
    r.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    d.setMonth(d.getMonth() - 1);
  }
  return r;
};
