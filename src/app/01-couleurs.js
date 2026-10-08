// ─── COULEURS ────────────────────────────────────────────────
// Thème clair. L'appel se fait debout, dans une salle éclairée, souvent près
// d'une fenêtre : un fond blanc se lit dans ces conditions, un fond bleu nuit
// non. Les couleurs de la charte — bleu nuit, or — deviennent donc des accents
// (en-tête, boutons, chiffres) au lieu d'être le fond.
//
// Chaque état a trois teintes, comme sur une étiquette : la couleur franche pour
// le texte, un fond pâle, un bord un peu plus soutenu. C'est ce trio qui rend un
// badge lisible sans l'alourdir.
const C = {
  // ── Marque ──
  navy: "#0a1428",      // bleu nuit de la charte : en-tête, boutons, texte sur or
  navyM: "#14233f",
  navyL: "#1d3557",
  navyPale: "#e8edf5",
  gold: "#9a7a16",      // l'or, assombri : lisible sur blanc
  goldVif: "#d4af37",   // l'or de la charte : aplats et dégradés sur fond sombre
  goldD: "#7e6113",
  goldPale: "#faf3dd",
  goldBord: "#e6d6a2",

  // ── Surfaces ──
  fond: "#f3f4f8",
  surface: "#ffffff",
  surface2: "#f8fafc",  // en-têtes de tableau, encarts, champs au repos
  bord: "#e3e6ec",
  bordFort: "#ced4df",
  voile: "rgba(18,28,46,.45)",   // derrière une fenêtre modale

  // ── Texte ──
  texte: "#121c2e",
  gray: "#5a6679",
  grisClair: "#8c95a4",

  // ── États ──
  green: "#2f7d5b", greenPale: "#e5f2eb", greenBord: "#bfe3cb",
  orange: "#a8620f", orangePale: "#faeedb", orangeBord: "#f2ddc0",
  red: "#b23a3a", redPale: "#f9e6e5", redBord: "#f0c4c1",
  blue: "#4057a0", bluePale: "#e8ecf8", blueBord: "#ccd9f7",
  whatsapp: "#25d366", whatsappPale: "#e9f9f0", whatsappBord: "#a5e5c2",

  // ── Relief ──
  ombre: "0 1px 2px rgba(18,28,46,.05),0 6px 18px rgba(18,28,46,.05)",
  ombreForte: "0 10px 34px rgba(18,28,46,.16)"
};
// Titres et chiffres : une serif, comme sur les documents de la maison.
const FD = "'Playfair Display',Georgia,'Times New Roman',serif";
// Texte courant : posé sur <body> et hérité partout — rien à répéter.
const FT = "'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif";
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
