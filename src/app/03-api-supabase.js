// ─── API SUPABASE ────────────────────────────────────────────
// Douze mois glissants : la borne du chargement initial.
const depuisUnAn = () => {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 1);
  return d.toISOString().slice(0, 10);
};
const api = {
  async fetchAll(isAdmin) {
    const borne = depuisUnAn();
    const [el, gr, co, pr, eg] = await Promise.all([sb.from("eleves").select("*").order("nom"), sb.from("groupes").select("*").order("nom"), sb.from("cours").select("*").gte("date", borne), sb.from("presences").select("*").gte("date", borne), sb.from("eleves_groupes").select("eleve_id,groupe_id")]);
    for (const r of [el, gr, co, pr, eg]) if (r.error) throw r.error;
    const elList = (el.data || []).map(normalizeEleveDB);
    const egList = eg.data || [];
    const grList = (gr.data || []).map(g => normalizeGroupeDB(g, elList, egList));
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
      } = await sb.from("paiements").select("*");
      if (paErr) throw paErr;
      factures = (paData || []).map(p => ({
        id: p.id,
        eleveId: p.eleve_id,
        nbSeances: p.nb_seances ?? 0,
        montant: p.montant,
        statut: p.statut ?? "en_attente",
        mode: p.mode ?? "Virement",
        datePaiement: p.date_paiement ?? "",
        notes: p.notes ?? "",
        periodeDebut: p.periode_debut ?? null,
        periodeFin: p.periode_fin ?? null,
        numero: p.numero ?? null,
        dateEmission: p.date_emission ?? null,
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
    } = await sb.from("profs").select("id,prenom,nom,email,role").order("nom");
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
    const {
      data: existing,
      error: e1
    } = await sb.from("paiements").select("id,statut").eq("eleve_id", eleveId).neq("statut", "paye").maybeSingle();
    if (e1) throw e1;
    if (existing) {
      if (dates.length === 0) {
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
    const { data, error } = await sb.from("comptes_rendus").select("*").gte("date", depuisUnAn()).order("date", { ascending: false });
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
