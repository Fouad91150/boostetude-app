// ─── FACTURE AU FORMAT PDF ───────────────────────────────────
// Un vrai fichier PDF, fabriqué dans le navigateur, sans serveur ni bibliothèque.
//
// Pourquoi à la main : une bibliothèque comme jsPDF pèse 350 Ko pour dessiner une
// page. L'application entière en fait 220. Elle ajouterait une dépendance à un CDN
// sur le chemin critique d'un geste — envoyer sa facture — qui doit marcher depuis
// un téléphone, en bas de l'immeuble, avec une barre de réseau. Un PDF d'une page
// est un format assez simple pour qu'on l'écrive soi-même : le fichier produit fait
// quelques kilo-octets, son texte reste sélectionnable, et rien ne peut tomber.
//
// Le format : une suite d'objets numérotés, une table (xref) donnant la position de
// chacun en octets depuis le début, et une queue (trailer) pointant vers elle. D'où
// la construction en chaîne d'octets — un caractère vaut un octet — avant conversion.

// Les polices PDF de base lisent le WinAnsi, pas l'UTF-8. Table des caractères
// français qui n'y sont pas à leur place naturelle.
const WINANSI = {
  "€": 128, "‚": 130, "ƒ": 131, "„": 132, "…": 133, "†": 134, "‡": 135,
  "ˆ": 136, "‰": 137, "Š": 138, "‹": 139, "Œ": 140, "Ž": 142,
  "‘": 145, "’": 146, "“": 147, "”": 148, "•": 149, "–": 150, "—": 151,
  "˜": 152, "™": 153, "š": 154, "›": 155, "œ": 156, "ž": 158, "Ÿ": 159
};

const versWinAnsi = texte => String(texte == null ? "" : texte).split("").map(c => {
  const code = c.charCodeAt(0);
  if (code < 128) return c;
  if (WINANSI[c] != null) return String.fromCharCode(WINANSI[c]);
  if (code <= 255) return c;
  return "?";
}).join("");

// Largeurs Helvetica en millièmes de point, pour les caractères imprimables.
// Dans cette police, les lettres accentuées ont la largeur de leur lettre de base.
const LARGEURS = (() => {
  const l = {};
  const poser = (chaine, largeur) => chaine.split("").forEach(c => { l[c] = largeur; });
  poser(" !I|ijlt.,:;'`", 278);
  poser("\"", 355); poser("()[]{}/\\", 333); poser("*", 389);
  poser("#$0123456789+<=>~^", 556);
  poser("%", 889); poser("&", 667); poser("@", 1015);
  poser("?_", 556); poser("-", 333);
  poser("abcdeghknopqsuvxyz", 556);
  poser("f", 278); poser("r", 333); poser("m", 833); poser("w", 722);
  poser("ABDEHKNPRSUVXY", 722);
  poser("CGOQ", 778); poser("FJLTZ", 611); poser("I", 278);
  poser("M", 833); poser("W", 944);
  return l;
})();

const largeurTexte = (texte, taille, gras) => {
  const base = String(texte || "").split("").reduce((s, c) => {
    const brut = c.charCodeAt(0) > 127 ? "e" : c; // accentué ≈ sa lettre de base
    return s + (LARGEURS[brut] != null ? LARGEURS[brut] : 556);
  }, 0);
  // Le gras d'Helvetica est sensiblement plus large que le romain.
  return base * taille / 1000 * (gras ? 1.06 : 1);
};

// Coupe un texte à une largeur donnée, sur les espaces.
const couperLignes = (texte, largeurMax, taille, gras) => {
  const mots = String(texte || "").split(/\s+/).filter(Boolean);
  const lignes = [];
  let courante = "";
  mots.forEach(mot => {
    const essai = courante ? `${courante} ${mot}` : mot;
    if (largeurTexte(essai, taille, gras) <= largeurMax || !courante) {
      courante = essai;
    } else {
      lignes.push(courante);
      courante = mot;
    }
  });
  if (courante) lignes.push(courante);
  return lignes;
};

const echapperPDF = t => versWinAnsi(t).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
const n2 = x => Math.round(x * 100) / 100;

// Les métadonnées d'un PDF ne se lisent pas dans l'encodage des polices : une
// chaîne accentuée doit y être en UTF-16BE précédée de son indicateur d'ordre
// d'octets, sans quoi le titre affiché par le lecteur part en charabia.
const chaineUTF16 = texte => {
  let s = "\\376\\377"; // BOM FE FF
  for (const c of String(texte || "")) {
    const code = c.codePointAt(0);
    const unites = code > 0xffff
      ? [0xd800 + ((code - 0x10000) >> 10), 0xdc00 + ((code - 0x10000) & 0x3ff)]
      : [code];
    unites.forEach(u => {
      s += "\\" + ((u >> 8) & 0xff).toString(8).padStart(3, "0");
      s += "\\" + (u & 0xff).toString(8).padStart(3, "0");
    });
  }
  return s;
};

/**
 * Page A4 sur laquelle on dessine. Les ordonnées sont comptées depuis le HAUT,
 * comme on lit — la conversion vers le repère PDF se fait ici, une seule fois.
 */
function PageA4() {
  const LARGEUR = 595.28, HAUTEUR = 841.89;
  const ops = [];
  const y = v => HAUTEUR - v;

  return {
    LARGEUR, HAUTEUR,
    rect(x, haut, largeur, hauteur, couleur) {
      const [r, v, b] = couleur;
      ops.push(`${n2(r)} ${n2(v)} ${n2(b)} rg`, `${n2(x)} ${n2(y(haut + hauteur))} ${n2(largeur)} ${n2(hauteur)} re f`);
      return this;
    },
    ligne(x1, haut1, x2, haut2, couleur, epaisseur) {
      const [r, v, b] = couleur;
      ops.push(`${n2(r)} ${n2(v)} ${n2(b)} RG`, `${n2(epaisseur || 0.5)} w`,
               `${n2(x1)} ${n2(y(haut1))} m ${n2(x2)} ${n2(y(haut2))} l S`);
      return this;
    },
    texte(x, haut, contenu, opts = {}) {
      const { taille = 10, gras = false, couleur = [0, 0, 0], align = "gauche" } = opts;
      const [r, v, b] = couleur;
      let posX = x;
      if (align === "droite") posX = x - largeurTexte(contenu, taille, gras);
      else if (align === "centre") posX = x - largeurTexte(contenu, taille, gras) / 2;
      ops.push("BT", `/${gras ? "F2" : "F1"} ${n2(taille)} Tf`, `${n2(r)} ${n2(v)} ${n2(b)} rg`,
               `1 0 0 1 ${n2(posX)} ${n2(y(haut))} Tm`, `(${echapperPDF(contenu)}) Tj`, "ET");
      return this;
    },
    /** Écrit un paragraphe et renvoie l'ordonnée atteinte. */
    paragraphe(x, haut, contenu, largeurMax, opts = {}) {
      const { taille = 10, gras = false, interligne = 1.35 } = opts;
      let courant = haut;
      couperLignes(contenu, largeurMax, taille, gras).forEach(ligne => {
        this.texte(x, courant, ligne, opts);
        courant += taille * interligne;
      });
      return courant;
    },
    flux: () => ops.join("\n")
  };
}

/** Assemble les objets, la table de références et la queue du fichier. */
function assemblerPDF(page, meta = {}) {
  const flux = page.flux();
  const objets = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${n2(page.LARGEUR)} ${n2(page.HAUTEUR)}] ` +
      "/Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${flux.length} >>\nstream\n${flux}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>",
    "<< /Title (" + chaineUTF16(meta.titre || "Facture") + ") /Producer (Boost'Etude) >>"
  ];

  let fichier = "%PDF-1.4\n";
  const positions = [];
  objets.forEach((corps, i) => {
    positions.push(fichier.length);
    fichier += `${i + 1} 0 obj\n${corps}\nendobj\n`;
  });

  const debutXref = fichier.length;
  fichier += `xref\n0 ${objets.length + 1}\n0000000000 65535 f \n`;
  positions.forEach(p => { fichier += String(p).padStart(10, "0") + " 00000 n \n"; });
  fichier += `trailer\n<< /Size ${objets.length + 1} /Root 1 0 R /Info ${objets.length} 0 R >>\n` +
             `startxref\n${debutXref}\n%%EOF`;

  const octets = new Uint8Array(fichier.length);
  for (let i = 0; i < fichier.length; i++) octets[i] = fichier.charCodeAt(i) & 0xff;
  return octets;
}

const NAVY_PDF = [0.039, 0.078, 0.157];   // #0a1428
const OR_PDF = [0.831, 0.686, 0.216];     // #d4af37
const GRIS = [0.42, 0.42, 0.42];
const GRIS_PALE = [0.62, 0.62, 0.62];
const NOIR = [0.1, 0.1, 0.1];

/**
 * Dessine la facture. Le contenu reprend exactement celui de l'écran
 * (`VueImpression`) : mêmes mentions légales, mêmes totaux, même pied de page.
 */
function construireFacturePDF(facture, eleve, parametres) {
  const p = parametres || {};
  const page = PageA4();
  const M = 48;                       // marge
  const DROITE = page.LARGEUR - M;
  const dates = facture.datesSeances || [];
  const emise = !!facture.numero;
  const matieres = groupParMatiere(dates);
  // Un stage de vacances ne se compte pas en séances : il se vend au forfait.
  // `prestation` porte alors le libellé à imprimer, et le montant fait la ligne.
  const forfait = (facture.prestation || "").trim();
  const mentionEI = (p.forme_juridique || "EI").toUpperCase() === "EI" ? "Entrepreneur individuel" : p.forme_juridique;

  let y = M + 10;

  // ── En-tête : l'émetteur à gauche, l'identification de la facture à droite ──
  page.texte(M, y, p.denomination || "Boost'Étude", { taille: 19, gras: true, couleur: NAVY_PDF });
  let yg = y + 16;
  [
    p.exploitant ? `${p.exploitant} · ${mentionEI}` : null,
    p.adresse || null,
    [p.code_postal, p.ville].filter(Boolean).join(" ") || null,
    p.siret ? `SIRET ${p.siret}${p.ape ? ` · APE ${p.ape}` : ""}` : null,
    p.telephone || null,
    p.email || null
  ].filter(Boolean).forEach(l => {
    page.texte(M, yg, l, { taille: 8.5, couleur: GRIS });
    yg += 11;
  });

  page.texte(DROITE, y - 2, "FACTURE", { taille: 9, gras: true, couleur: OR_PDF, align: "droite" });
  page.texte(DROITE, y + 13, emise ? `N° ${facture.numero}` : "BROUILLON",
    { taille: 13, gras: true, couleur: emise ? NAVY_PDF : [0.69, 0.13, 0.13], align: "droite" });
  let yd = y + 27;
  if (emise && facture.dateEmission) {
    page.texte(DROITE, yd, `Émise le ${fmtDateLongue(facture.dateEmission)}`, { taille: 8.5, couleur: GRIS, align: "droite" });
    yd += 11;
  }
  const periodeForfait = facture.periodeDebut
    ? (facture.periodeFin && facture.periodeFin !== facture.periodeDebut
        ? `Du ${fmtDateCourt(facture.periodeDebut)} au ${fmtDateLongue(facture.periodeFin)}`
        : fmtDateLongue(facture.periodeDebut))
    : "";
  const periode = forfait ? (periodeForfait || "Forfait")
    : dates.length
      ? (dates.length === 1 ? fmtDateLongue(dates[0].date) : `${fmtDateCourt(dates[0].date)} – ${fmtDateCourt(dates[dates.length - 1].date)}`)
      : "Facture en cours";
  page.texte(DROITE, yd, periode, { taille: 8.5, couleur: GRIS, align: "droite" });

  y = Math.max(yg, yd) + 16;
  page.rect(M, y, DROITE - M, 2, NAVY_PDF);
  y += 20;

  // ── Destinataire ───────────────────────────────────────────
  page.rect(M, y - 10, DROITE - M, 48, [0.97, 0.97, 0.96]);
  page.texte(M + 12, y + 2, "FACTURÉ À", { taille: 7.5, gras: true, couleur: GRIS_PALE });
  page.texte(M + 12, y + 16, eleve.parent || "", { taille: 12, gras: true, couleur: NAVY_PDF });
  page.texte(M + 12, y + 30, `Élève : ${eleve.prenom} ${eleve.nom} — ${eleve.niveau}`, { taille: 10, couleur: GRIS });
  y += 60;

  // ── Tableau des prestations ────────────────────────────────
  const COL_QTE = DROITE - 190, COL_TARIF = DROITE - 95;
  page.rect(M, y - 10, DROITE - M, 22, NAVY_PDF);
  page.texte(M + 10, y + 4, "Prestation", { taille: 9, gras: true, couleur: [1, 1, 1] });
  page.texte(COL_QTE, y + 4, "Qté", { taille: 9, gras: true, couleur: [1, 1, 1], align: "droite" });
  page.texte(COL_TARIF, y + 4, "Tarif", { taille: 9, gras: true, couleur: [1, 1, 1], align: "droite" });
  page.texte(DROITE - 10, y + 4, "Total", { taille: 9, gras: true, couleur: [1, 1, 1], align: "droite" });
  y += 26;

  if (forfait) {
    const total = Number(facture.montant) || 0;
    page.texte(M + 10, y + 4, forfait, { taille: 10, gras: true, couleur: NOIR });
    const finLigne = page.paragraphe(M + 10, y + 16,
      `Forfait tout compris${periodeForfait ? ` · ${periodeForfait.toLowerCase()}` : ""}` +
      (eleve.niveau ? ` · niveau ${eleve.niveau}` : ""),
      COL_QTE - M - 30, { taille: 8, couleur: GRIS, interligne: 1.3 });
    page.texte(COL_QTE, y + 4, "1", { taille: 9.5, couleur: GRIS, align: "droite" });
    page.texte(COL_TARIF, y + 4, euros(total), { taille: 9.5, couleur: GRIS, align: "droite" });
    page.texte(DROITE - 10, y + 4, euros(total), { taille: 10, gras: true, couleur: NAVY_PDF, align: "droite" });
    y = Math.max(finLigne, y + 24) + 6;
  } else if (matieres.length === 0) {
    page.texte(M + 10, y + 6, "Aucune séance", { taille: 9.5, couleur: GRIS });
    y += 24;
  } else {
    lignesFacture(matieres, facture.montant, eleve.th).forEach((g, i) => {
      const total = g.total;
      page.texte(M + 10, y + 4, `${g.matiere || "Cours"} — ${eleve.niveau}`, { taille: 10, gras: true, couleur: NOIR });
      page.texte(M + 10, y + 16,
        `Cours de soutien scolaire en groupe · séances de 2 h · ${g.dates.length} séance${g.dates.length > 1 ? "s" : ""}` +
        (eleve.remise > 0 && Math.abs(g.th - eleve.th) < 0.005 ? ` · remise de ${euros(eleve.remise)}/h (${(eleve.motifsRemise || ["inscriptions multiples"]).join(" + ")})` : ""),
        { taille: 8, couleur: GRIS });
      const finDates = page.paragraphe(M + 10, y + 27, g.dates.map(d => fmtDateCourt(d)).join(" · "),
        COL_QTE - M - 30, { taille: 8, couleur: GRIS_PALE, interligne: 1.3 });
      page.texte(COL_QTE, y + 4, `${g.dates.length * 2} h`, { taille: 9.5, couleur: GRIS, align: "droite" });
      page.texte(COL_TARIF, y + 4, `${euros(g.th)}/h`, { taille: 9.5, couleur: GRIS, align: "droite" });
      page.texte(DROITE - 10, y + 4, euros(total), { taille: 10, gras: true, couleur: NAVY_PDF, align: "droite" });
      y = Math.max(finDates, y + 34) + 6;
      if (i < matieres.length - 1) {
        page.ligne(M, y - 3, DROITE, y - 3, [0.9, 0.9, 0.9], 0.5);
        y += 4;
      }
    });
  }

  // ── Total, acomptes, net à payer ───────────────────────────
  const encaisse = Math.max(0, Number(facture.encaisse) || 0);
  const reste = Math.max(0, Math.round(((Number(facture.montant) || 0) - encaisse) * 100) / 100);
  y += 8;
  if (encaisse > 0) {
    // Le détail du règlement partiel se lit avant le solde, comme sur un relevé.
    page.texte(DROITE - 120, y + 4, "Total", { taille: 9.5, couleur: GRIS, align: "droite" });
    page.texte(DROITE, y + 4, euros(facture.montant), { taille: 9.5, couleur: NOIR, align: "droite" });
    page.texte(DROITE - 120, y + 18, "Déjà réglé", { taille: 9.5, couleur: GRIS, align: "droite" });
    page.texte(DROITE, y + 18, "- " + euros(encaisse), { taille: 9.5, couleur: [0.18, 0.49, 0.31], align: "droite" });
    y += 28;
  }
  page.rect(M, y - 8, DROITE - M, 34, NAVY_PDF);
  page.texte(M + 16, y + 13, encaisse > 0 ? "RESTE À PAYER" : "NET À PAYER", { taille: 11, gras: true, couleur: [1, 1, 1] });
  page.texte(DROITE - 16, y + 15, euros(encaisse > 0 ? reste : facture.montant), { taille: 19, gras: true, couleur: OR_PDF, align: "droite" });
  y += 38;
  page.texte(DROITE, y + 4, p.mention_tva || "TVA non applicable, article 293 B du CGI",
    { taille: 8.5, couleur: GRIS, align: "droite" });
  y += 20;

  // ── Règlement ──────────────────────────────────────────────
  page.ligne(M, y, DROITE, y, [0.9, 0.9, 0.9], 0.5);
  y += 14;
  const payee = facture.statut === "paye" || (encaisse > 0 && reste === 0);
  page.texte(M, y, "Règlement", { taille: 9.5, gras: true, couleur: NOIR });
  y += 13;
  if (payee) {
    page.texte(M, y, `Facture acquittée${facture.datePaiement ? ` le ${fmtDateCourt(facture.datePaiement)}` : ""} (${facture.mode || eleve.mp}).`,
      { taille: 9, couleur: [0.18, 0.49, 0.31] });
    y += 13;
  } else {
    if (facture.stripeUrl) {
      page.texte(M, y + 2, "Payer en ligne par carte bancaire :", { taille: 9, gras: true, couleur: NOIR });
      page.texte(M, y + 14, facture.stripeUrl, { taille: 9, couleur: NAVY_PDF });
      y += 26;
    }
    y = page.paragraphe(M, y, MOYENS_PAIEMENT_TEXTE(eleve, p), DROITE - M, { taille: 9, couleur: GRIS, interligne: 1.45 });
    y += 2;
    if (p.iban) {
      page.rect(M, y, DROITE - M, 44, [0.97, 0.97, 0.96]);
      page.texte(M + 10, y + 13, "Coordonnées bancaires", { taille: 8.5, gras: true, couleur: NOIR });
      page.texte(M + 10, y + 25, `${p.titulaire_compte ? p.titulaire_compte + " · " : ""}IBAN ${p.iban}${p.bic ? " · BIC " + p.bic : ""}`,
        { taille: 8, couleur: GRIS });
      page.texte(M + 10, y + 36, `Référence à indiquer : ${eleve.prenom} ${eleve.nom}`, { taille: 8, gras: true, couleur: NOIR });
      y += 52;
    }
  }
  if (p.delai_paiement) {
    page.texte(M, y + 4, p.delai_paiement, { taille: 8.5, couleur: GRIS });
    y += 16;
  }

  // ── Pied de facture : mentions obligatoires ────────────────
  const raisonSociale = [p.denomination, p.exploitant && p.exploitant !== p.denomination ? p.exploitant : null].filter(Boolean).join(" — ");
  let pied = page.HAUTEUR - M - 34;
  page.ligne(M, pied - 8, DROITE, pied - 8, [0.93, 0.93, 0.93], 0.5);
  [
    p.penalites_retard,
    p.escompte,
    [raisonSociale || "Boost'Étude", mentionEI, p.siret ? "SIRET " + p.siret : null, p.ape ? "APE " + p.ape : null].filter(Boolean).join(" · ")
  ].filter(Boolean).forEach(l => {
    pied = page.paragraphe(M, pied, l, DROITE - M, { taille: 6.8, couleur: GRIS_PALE, interligne: 1.35 });
    pied += 1;
  });

  return assemblerPDF(page, { titre: `Facture ${facture.numero || "brouillon"} — ${eleve.prenom} ${eleve.nom}` });
}

const nomFichierFacture = (facture, eleve) => {
  const base = facture.numero ? facture.numero : "brouillon";
  const qui = `${eleve.prenom}-${eleve.nom}`.replace(/[^A-Za-zÀ-ÿ0-9]+/g, "-").replace(/^-|-$/g, "");
  return `Facture-${base}-${qui}.pdf`.replace(/\s+/g, "");
};

const facturePDFBlob = (facture, eleve, parametres) =>
  new Blob([construireFacturePDF(facture, eleve, parametres)], { type: "application/pdf" });

/**
 * Partage le PDF par les applications du téléphone — WhatsApp, mail, Drive.
 * Un SMS ne transporte pas de pièce jointe : le partage natif est le seul chemin
 * qui dépose vraiment le fichier dans une conversation. Sur un ordinateur, ou si le
 * navigateur ne sait pas partager de fichiers, on retombe sur le téléchargement.
 */
async function partagerFacturePDF(facture, eleve, parametres, texte) {
  const blob = facturePDFBlob(facture, eleve, parametres);
  const nom = nomFichierFacture(facture, eleve);
  const fichier = typeof File === "function" ? new File([blob], nom, { type: "application/pdf" }) : null;

  if (fichier && navigator.canShare && navigator.canShare({ files: [fichier] })) {
    try {
      await navigator.share({ files: [fichier], text: texte || "" });
      return { partage: true };
    } catch (e) {
      // L'utilisateur a refermé le menu de partage : ce n'est pas une erreur.
      if (e && e.name === "AbortError") return { partage: false, annule: true };
    }
  }
  telechargerBlob(blob, nom);
  return { partage: false, telecharge: true };
}

function telechargerBlob(blob, nom) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nom;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
