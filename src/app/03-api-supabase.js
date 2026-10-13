// ─── API SUPABASE ────────────────────────────────────────────
// Douze mois glissants : la borne du chargement initial.
const depuisUnAn = () => {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 1);
  return isoLocal(d);
};
// Supabase plafonne chaque réponse à 1 000 lignes. Les présences dépassent ce
// seuil en quelques mois : tronquées sans prévenir, elles faisaient recalculer
// des brouillons de facture à la baisse. On lit donc par pages, dans un ordre
// stable, jusqu'à la dernière.
const PAGE_LIGNES = 1000;
const toutLire = async construire => {
  let tout = [];
  for (let de = 0; ; de += PAGE_LIGNES) {
    const { data, error } = await construire().order("id").range(de, de + PAGE_LIGNES - 1);
    if (error) return { data: null, error };
    tout = tout.concat(data || []);
    if (!data || data.length < PAGE_LIGNES) return { data: tout, error: null };
  }
};
const api = {
  async fetchAll(isAdmin) {
    const borne = depuisUnAn();
    const [el, gr, co, pr, eg] = await Promise.all([sb.from("eleves").select("*").order("nom"), sb.from("groupes").select("*").order("nom"), toutLire(() => sb.from("cours").select("*").gte("date", borne)), toutLire(() => sb.from("presences").select("*").gte("date", borne)), sb.from("eleves_groupes").select("eleve_id,groupe_id")]);
    for (const r of [el, gr, co, pr, eg]) if (r.error) throw r.error;
    let elList = (el.data || []).map(normalizeEleveDB);
    const egList = eg.data || [];
    const grList = (gr.data || []).map(g => normalizeGroupeDB(g, elList, egList));
    // La remise d'engagement multiple s'applique avant tout calcul de montant,
    // pour que la facture, le PDF et les messages disent tous la même chose.
    if (isAdmin) {
      const { data: reg } = await sb.from("parametres_entreprise").select("remise_multi").maybeSingle();
      elList = appliquerRemiseMulti(elList, grList, reg && reg.remise_multi);
    }
    const coursMap = {};
    (co.data || []).forEach(c => {
      coursMap[c.id] = c;
    });
    const appels = {};
    (co.data || []).forEach(c => {
      appels[`ap:${c.groupe_id}:${c.date}`] = appels[`ap:${c.groupe_id}:${c.date}`] || {};
    });
    (pr.data || []).forEach(p => {
      const c = coursMap[p.cours_id];
      if (!c) return;
      const k = `ap:${c.groupe_id}:${c.date}`;
      appels[k] = appels[k] || {};
      appels[k][p.eleve_id] = p.statut;
    });
    // Facturation cumulative : chaque élève a au plus UNE facture ouverte (statut≠payé)
    // qui accumule toutes les séances présentes depuis la dernière facture payée.
    // Les factures payées sont conservées telles quelles, figées, dans l'historique.
    let factures = [];
    if (isAdmin) {
      const {
        data: paData,
        error: paErr
      } = await toutLire(() => sb.from("paiements").select("*"));
      if (paErr) throw paErr;
      factures = (paData || []).map(p => ({
        id: p.id,
        eleveId: p.eleve_id,
        nbSeances: p.nb_seances ?? 0,
        montant: Number(p.montant) || 0,
        encaisse: Number(p.montant_encaisse) || 0,
        statut: p.statut ?? "en_attente",
        mode: p.mode ?? "Virement",
        datePaiement: p.date_paiement ?? "",
        notes: p.notes ?? "",
        periodeDebut: p.periode_debut ?? null,
        periodeFin: p.periode_fin ?? null,
        numero: p.numero ?? null,
        derniereRelance: p.derniere_relance ?? null,
        dateEmission: p.date_emission ?? null,
        // Un stage se facture au forfait : `prestation` porte le libellé à imprimer
        // et `stageId` dit que cette facture ne suit pas l'appel.
        prestation: p.prestation ?? null,
        stageId: p.stage_id ?? null,
        stripeUrl: p.stripe_lien_url ?? null,
        pdfUrl: p.pdf_url ?? null,
        envoyeeLe: p.envoyee_le ?? null,
        datesSeances: (p.dates_seances ?? []).map(d => typeof d === "string" ? {
          date: d,
          matiere: ""
        } : d),
        mois: p.mois ?? ""
      }));
    }
    return {
      eleves: elList,
      groupes: grList,
      appels,
      factures
    };
  },
  // `form.groupeIds` = tous les groupes (matières) suivis par l'élève. La colonne
  // eleves.groupe_id est mise à jour avec le premier groupe pour rester cohérente avec
  // les usages historiques (ex. RLS "eleve lit son groupe"), mais eleves_groupes reste
  // la source de vérité pour l'appel/la facturation multi-matières.
  async saveEleve(form) {
    const groupeIds = form.groupeIds || [];
    const row = {
      prenom: form.prenom,
      nom: form.nom,
      niveau: form.niveau,
      mode_paiement: form.mp,
      parent_nom: form.parent,
      parent_tel: form.tel,
      parent_email: form.email,
      notes: form.notes,
      groupe_id: groupeIds[0] || null
    };
    let eleveId = form.id;
    if (eleveId) {
      const {
        error
      } = await sb.from("eleves").update(row).eq("id", eleveId);
      if (error) throw error;
    } else {
      const {
        data,
        error
      } = await sb.from("eleves").insert(row).select("id").single();
      if (error) throw error;
      eleveId = data.id;
    }
    await this.syncElevesGroupes(eleveId, groupeIds);
  },
  // Aligne eleves_groupes sur la sélection courante : ajoute les nouveaux rattachements,
  // retire ceux décochés. N'écrit jamais rien d'autre (jamais de trace hors de cette liste).
  async syncElevesGroupes(eleveId, groupeIds) {
    const {
      data: existing,
      error: e1
    } = await sb.from("eleves_groupes").select("id,groupe_id").eq("eleve_id", eleveId);
    if (e1) throw e1;
    const existingIds = (existing || []).map(r => r.groupe_id);
    const toDelete = (existing || []).filter(r => !groupeIds.includes(r.groupe_id)).map(r => r.id);
    const toAdd = groupeIds.filter(gid => !existingIds.includes(gid));
    if (toDelete.length) {
      const {
        error
      } = await sb.from("eleves_groupes").delete().in("id", toDelete);
      if (error) throw error;
    }
    if (toAdd.length) {
      const {
        error
      } = await sb.from("eleves_groupes").insert(toAdd.map(groupe_id => ({
        eleve_id: eleveId,
        groupe_id
      })));
      if (error) throw error;
    }
  },
  async toggleEleveActif(id, actif) {
    const {
      error
    } = await sb.from("eleves").update({
      actif
    }).eq("id", id);
    if (error) throw error;
  },
  async saveGroupe(form) {
    const row = {
      nom: form.nom,
      niveau: form.niveau,
      matiere: form.matiere,
      jour: form.jour || null,
      heure_debut: form.hd || null,
      heure_fin: form.hf || null,
      capacite_max: form.max,
      prof: form.profText || null,
      prof_id: form.profId || null
    };
    if (form.id) {
      const {
        error
      } = await sb.from("groupes").update(row).eq("id", form.id);
      if (error) throw error;
    } else {
      const {
        error
      } = await sb.from("groupes").insert(row);
      if (error) throw error;
    }
  },
  // Liste des professeurs, pour assigner un groupe — réservé à l'admin (RLS).
  async fetchProfs() {
    const {
      data,
      error
    } = await sb.from("profs").select("id,prenom,nom,email,role,taux_horaire,telephone").order("nom");
    if (error) throw error;
    return data || [];
  },
  async ensureCours(groupeId, date) {
    const {
      data: existing,
      error: e1
    } = await sb.from("cours").select("id").eq("groupe_id", groupeId).eq("date", date).maybeSingle();
    if (e1) throw e1;
    if (existing) return existing.id;
    const {
      data,
      error
    } = await sb.from("cours").insert({
      groupe_id: groupeId,
      date,
      titre: `Séance du ${date}`
    }).select("id").single();
    if (error) throw error;
    return data.id;
  },
  async saveAppel(groupeId, date, presMap) {
    const coursId = await this.ensureCours(groupeId, date);
    const {
      error: eDel
    } = await sb.from("presences").delete().eq("cours_id", coursId);
    if (eDel) throw eDel;
    const rows = Object.entries(presMap).map(([eleve_id, statut]) => ({
      eleve_id,
      cours_id: coursId,
      statut,
      date
    }));
    if (rows.length) {
      const {
        error
      } = await sb.from("presences").insert(rows);
      if (error) throw error;
    }
  },
  // Facturation cumulative : au plus une facture "ouverte" (statut≠payé) par élève.
  // saveFacture sert uniquement à changer le statut de paiement d'une facture existante.
  // La marquer "payé" la FIGE (periode_fin = aujourd'hui) : les séances suivantes
  // ouvriront une toute nouvelle facture, elles ne s'ajouteront plus à celle-ci.
  async saveFacture(factureId, eleveId, data) {
    const cloture = data.statut === "paye";
    const row = {
      montant: data.montant,
      statut: data.statut,
      mode: data.mode,
      date_paiement: data.datePaiement || null,
      nb_seances: data.nbSeances,
      notes: data.notes || null,
      dates_seances: data.datesSeances || []
    };
    if (cloture) row.periode_fin = data.datesSeances?.length ? data.datesSeances[data.datesSeances.length - 1].date : todayStr();
    if (factureId) {
      const {
        error
      } = await sb.from("paiements").update(row).eq("id", factureId);
      if (error) throw error;
    } else {
      const {
        error
      } = await sb.from("paiements").insert({
        eleve_id: eleveId,
        periode_debut: data.datesSeances?.[0]?.date || todayStr(),
        mois: (data.datesSeances?.[data.datesSeances.length - 1]?.date || todayStr()).slice(0, 7),
        ...row
      });
      if (error) throw error;
    }
  },
  // Recalcule automatiquement la facture ouverte d'un élève à partir de l'appel.
  // `dates` = toutes les séances {date,matiere} présentes depuis la dernière facture payée
  // (un même élève peut cumuler plusieurs matières, ex. Maths + Physique, sur une même facture).
  // Ne touche jamais une facture déjà payée — elle reste figée dans l'historique.
  async syncFacture(eleveId, dates, montant) {
    // Seul un brouillon suit l'appel. Une facture qui porte un numéro est figée :
    // son montant a été communiqué au parent, il ne peut plus changer.
    const {
      data: existing,
      error: e1
    } = await sb.from("paiements").select("id,statut,montant_encaisse").eq("eleve_id", eleveId).is("numero", null).is("stage_id", null).neq("statut", "paye").maybeSingle();
    if (e1) throw e1;
    if (existing) {
      // Un brouillon qui a déjà reçu de l'argent ne disparaît pas : ses
      // versements sont au livre des recettes. Il passe à zéro séance, et
      // l'écran montre alors une somme à rendre ou à reporter.
      if (dates.length === 0 && Number(existing.montant_encaisse) > 0) {
        const { error } = await sb.from("paiements").update({ nb_seances: 0, montant: 0, dates_seances: [] }).eq("id", existing.id);
        if (error) throw error;
      } else if (dates.length === 0) {
        const {
          error
        } = await sb.from("paiements").delete().eq("id", existing.id);
        if (error) throw error;
      } else {
        const {
          error
        } = await sb.from("paiements").update({
          nb_seances: dates.length,
          montant,
          periode_debut: dates[0].date,
          dates_seances: dates,
          mois: dates[dates.length - 1].date.slice(0, 7)
        }).eq("id", existing.id);
        if (error) throw error;
      }
    } else if (dates.length > 0) {
      const {
        error
      } = await sb.from("paiements").insert({
        eleve_id: eleveId,
        periode_debut: dates[0].date,
        dates_seances: dates,
        nb_seances: dates.length,
        montant,
        statut: "en_attente",
        mois: dates[dates.length - 1].date.slice(0, 7)
      });
      if (error) throw error;
    }
  },
  async deleteFacture(factureId) {
    const {
      error
    } = await sb.from("paiements").delete().eq("id", factureId);
    if (error) throw error;
  },
  // Supprime une facture "en cours" pour de bon : comme la facture est entièrement pilotée
  // par l'appel, retirer seulement la ligne paiements ne suffit pas — les séances présentes
  // sous-jacentes referaient réapparaître le même montant en attente au prochain calcul.
  // On retire donc aussi les présences correspondantes (ex. pour nettoyer un test).
  async deleteFactureEnCours(factureId, eleveId, dates) {
    if (factureId) {
      const {
        error
      } = await sb.from("paiements").delete().eq("id", factureId);
      if (error) throw error;
    }
    const jours = [...new Set((dates || []).map(d => d.date || d))];
    if (jours.length) {
      const {
        error
      } = await sb.from("presences").delete().eq("eleve_id", eleveId).eq("statut", "present").in("date", jours);
      if (error) throw error;
    }
  }
};

// ─── API RÉGLAGES & FACTURATION CONFORME ─────────────────────
// Les mentions légales et les coordonnées bancaires vivent en base, protégées
// par RLS (admin seul) : le fichier HTML déployé est public.
Object.assign(api, {
  async fetchParametres() {
    const { data, error } = await sb.from("parametres_entreprise").select("*").maybeSingle();
    // Un professeur non-admin n'y a pas accès : ce n'est pas une erreur, il n'en a pas besoin.
    if (error) return null;
    return data;
  },
  async saveParametres(form) {
    // Le seuil arrive du formulaire sous forme de texte, parfois vide si l'on a
    // tout effacé avant de retaper. La base attend un entier entre 1 et 52.
    const seuilBrut = parseInt(form.seuil_facturation, 10);
    const seuil = Number.isFinite(seuilBrut) ? Math.min(52, Math.max(1, seuilBrut)) : SEUIL_FACTURATION_DEFAUT;
    const { error } = await sb.from("parametres_entreprise").update({
      ...form,
      seuil_facturation: seuil,
      maj_le: new Date().toISOString()
    }).eq("id", true);
    if (error) throw error;
  },
  // Le numéro est attribué par la base, sous verrou, et jamais deux fois :
  // c'est la seule façon d'obtenir une séquence continue sans trou ni doublon.
  async emettreFacture(factureId) {
    const { data, error } = await sb.rpc("emettre_facture", { p_facture_id: factureId });
    if (error) throw error;
    return data;
  },
  async fetchLivreRecettes() {
    const { data, error } = await sb.from("v_livre_recettes").select("*");
    if (error) throw error;
    return data || [];
  }
});

// ─── API SUIVI DE SÉANCE & BILANS ────────────────────────────
Object.assign(api, {
  async fetchComptesRendus() {
    const { data, error } = await toutLire(() => sb.from("comptes_rendus").select("*").gte("date", depuisUnAn()));
    (data || []).sort((a, b) => (b.date || "").localeCompare(a.date || ""));
    if (error) throw error;
    return data || [];
  },
  async fetchBilansEnvoyes() {
    const { data, error } = await sb.from("bilans_envoyes").select("*").order("cree_le", { ascending: false });
    if (error) throw error;
    return data || [];
  },
  // Un compte-rendu par (élève, séance) : ré-enregistrer met à jour au lieu de
  // dupliquer. Une fiche vidée est supprimée plutôt que stockée vide, pour que
  // « aucun commentaire » reste un état franc.
  async saveComptesRendus(groupeId, date, parEleve, auteurId) {
    const coursId = await this.ensureCours(groupeId, date);
    const remplies = [], aVider = [];
    Object.entries(parEleve).forEach(([eleve_id, v]) => {
      (estCompteRenduVide(v) ? aVider : remplies).push({
        eleve_id, cours_id: coursId, groupe_id: groupeId, date,
        notions: (v.notions || "").trim() || null,
        difficultes: (v.difficultes || "").trim() || null,
        progres: (v.progres || "").trim() || null,
        devoirs: (v.devoirs || "").trim() || null,
        niveau_seance: v.niveau_seance || null,
        auteur_id: auteurId || null,
        maj_le: new Date().toISOString()
      });
    });
    if (remplies.length) {
      const { error } = await sb.from("comptes_rendus").upsert(remplies, { onConflict: "eleve_id,cours_id" });
      if (error) throw error;
    }
    if (aVider.length) {
      const { error } = await sb.from("comptes_rendus").delete()
        .eq("cours_id", coursId).in("eleve_id", aVider.map(r => r.eleve_id));
      if (error) throw error;
    }
  },
  async logBilan(row) {
    const { error } = await sb.from("bilans_envoyes").insert(row);
    if (error) throw error;
  }
});

// ─── ENCAISSEMENTS ───────────────────────────────────────────────────────────
// Ce que le parent a effectivement versé, versement par versement. La base
// recalcule seule le solde de la facture et son statut (déclencheur).
Object.assign(api, {
  async fetchEncaissements() {
    const { data, error } = await toutLire(() => sb.from("encaissements").select("*"));
    (data || []).sort((a, b) => (b.date || "").localeCompare(a.date || ""));
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
  // Annuler, c'est conserver le numéro et sortir le montant du chiffre d'affaires.
  // Supprimer n'est possible que pour un brouillon, qui n'a jamais rien promis.
  async annulerFacture(factureId, motif) {
    const { error } = await sb.rpc("annuler_facture", { p_facture_id: factureId, p_motif: motif || null });
    if (error) throw error;
  },
  // Noter la relance évite les deux écueils symétriques : oublier un parent
  // pendant trois semaines, ou le relancer deux fois le même jour.
  async marquerRelance(factureId) {
    const { error } = await sb.from("paiements").update({ derniere_relance: todayStr() }).eq("id", factureId);
    if (error) throw error;
  },
  async retablirFacture(factureId) {
    const { error } = await sb.rpc("retablir_facture", { p_facture_id: factureId });
    if (error) throw error;
  },
  async supprimerEncaissement(id) {
    const { error } = await sb.from("encaissements").delete().eq("id", id);
    if (error) throw error;
  }
});

// ─── STAGES DE VACANCES ──────────────────────────────────────────────────────
// Un stage se vend au forfait, pas à la séance. Sa facture reste une facture
// ordinaire — même numérotation, mêmes versements, mêmes relances — simplement
// rattachée au stage pour que le document dise ce qu'il facture.
Object.assign(api, {
  async fetchStages() {
    const [st, ins] = await Promise.all([
      sb.from("stages").select("*").order("date_debut", { ascending: false }),
      sb.from("stages_inscrits").select("*")
    ]);
    if (st.error) throw st.error;
    if (ins.error) throw ins.error;
    const inscrits = (ins.data || []).map(i => ({
      id: i.id, stageId: i.stage_id, eleveId: i.eleve_id,
      tarif: Number(i.tarif) || 0, factureId: i.facture_id || null
    }));
    return {
      stages: (st.data || []).map(s => ({
        id: s.id, nom: s.nom, niveau: s.niveau || "", matiere: s.matiere || "Mathématiques",
        dateDebut: s.date_debut, dateFin: s.date_fin, horaire: s.horaire || "",
        tarif: Number(s.tarif) || 0, places: s.places || 8, notes: s.notes || ""
      })),
      inscrits
    };
  },

  async saveStage(form) {
    const ligne = {
      nom: form.nom, niveau: form.niveau || null, matiere: form.matiere || "Mathématiques",
      date_debut: form.dateDebut, date_fin: form.dateFin, horaire: form.horaire || null,
      tarif: Number(form.tarif) || 0, places: Number(form.places) || 8, notes: form.notes || null
    };
    const { error } = form.id
      ? await sb.from("stages").update(ligne).eq("id", form.id)
      : await sb.from("stages").insert(ligne);
    if (error) throw error;
  },

  async supprimerStage(id) {
    const { error } = await sb.from("stages").delete().eq("id", id);
    if (error) throw error;
  },

  async inscrireAuStage(stageId, eleveId, tarif) {
    const { error } = await sb.from("stages_inscrits").insert({
      stage_id: stageId, eleve_id: eleveId, tarif: Number(tarif) || 0
    });
    if (error) throw error;
  },

  async desinscrireDuStage(inscriptionId) {
    const { error } = await sb.from("stages_inscrits").delete().eq("id", inscriptionId);
    if (error) throw error;
  },

  // Une facture par inscrit : le forfait du stage, rattaché au stage. L'appelant
  // choisit qui facturer — l'écran des stages ne propose que les inscrits sans
  // facture valide — si bien que l'opération peut être relancée sans risque après
  // l'ajout d'un inscrit de dernière minute ou l'annulation d'une facture.
  async facturerStage(stage, inscriptions) {
    const aFacturer = (inscriptions || []).filter(i => i.stageId === stage.id);
    // Le libellé imprimé sur la facture. « Stage » n'est pas ajouté deux fois.
    const libelle = /^stages?\b/i.test(stage.nom || "") ? stage.nom : `Stage — ${stage.nom}`;
    for (const i of aFacturer) {
      const { data, error } = await sb.from("paiements").insert({
        eleve_id: i.eleveId,
        montant: i.tarif,
        nb_seances: 0,
        statut: "en_attente",
        stage_id: stage.id,
        prestation: stage.matiere ? `${libelle} · ${stage.matiere}` : libelle,
        periode_debut: stage.dateDebut,
        periode_fin: stage.dateFin,
        dates_seances: [],
        mois: String(stage.dateDebut || "").slice(0, 7),
        notes: `Stage : ${stage.nom}`
      }).select("id").single();
      if (error) throw error;
      const { error: e2 } = await sb.from("stages_inscrits").update({ facture_id: data.id }).eq("id", i.id);
      if (e2) throw e2;
    }
    return aFacturer.length;
  }
});

// ─── MON COMPTE ──────────────────────────────────────────────────────────────
// Un mot de passe transmis par message doit pouvoir être remplacé tout de suite.
// Supabase le change sur la session en cours : aucun email de confirmation à
// attendre — et c'est heureux, les adresses @boostetude.fr des professeurs n'ont
// pas de boîte aux lettres.
Object.assign(api, {
  async changerMotDePasse(nouveau) {
    const { error } = await sb.auth.updateUser({ password: nouveau });
    if (error) throw error;
  }
});

// Le taux horaire d'un professeur : ce que coûte une heure de cours assurée.
Object.assign(api, {
  async saveTauxProf(profId, taux) {
    const { error } = await sb.from("profs").update({ taux_horaire: Number(taux) || 0 }).eq("id", profId);
    if (error) throw error;
  },
  // Le numéro sert à lui envoyer son récapitulatif ; vide, il s'efface.
  async saveTelProf(profId, tel) {
    const { error } = await sb.from("profs").update({ telephone: (tel || "").trim() || null }).eq("id", profId);
    if (error) throw error;
  }
});

// ─── ENVOI AU PARENT ─────────────────────────────────────────────────────────
// Deux pièces font de l'envoi un geste unique : le lien de paiement Stripe au
// montant exact (fonction serveur `stripe-lien-facture`, qui seule détient la
// clé Stripe) et le PDF déposé en ligne sous un nom imprévisible, que le parent
// ouvre d'un toucher depuis WhatsApp.
Object.assign(api, {
  async lienPaiementStripe(factureId) {
    const { data, error } = await sb.functions.invoke("stripe-lien-facture", { body: { facture_id: factureId } });
    if (error) {
      // Le corps de la réponse porte le message utile (« clé Stripe absente »…).
      let detail = "";
      try { detail = (await error.context.json()).erreur || ""; } catch (e) { /* corps illisible */ }
      throw new Error(detail || error.message || "Lien de paiement indisponible");
    }
    if (data && data.erreur) throw new Error(data.erreur);
    return data && data.url ? data.url : null;
  },
  async deposerFacturePDF(facture, eleve, blob) {
    const alea = Array.from(crypto.getRandomValues(new Uint8Array(12)), b => b.toString(16).padStart(2, "0")).join("");
    const chemin = `${facture.numero || "brouillon"}-${alea}.pdf`;
    const { error } = await sb.storage.from("factures").upload(chemin, blob, { contentType: "application/pdf", upsert: false });
    if (error) throw error;
    const url = sb.storage.from("factures").getPublicUrl(chemin).data.publicUrl;
    const { error: e2 } = await sb.from("paiements").update({ pdf_url: url, envoyee_le: new Date().toISOString() }).eq("id", facture.id);
    if (e2) throw e2;
    return url;
  }
});

