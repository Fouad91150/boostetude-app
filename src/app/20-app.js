// ─── APP ─────────────────────────────────────────────────────
function App() {
  const [session, setSession] = useState(null);
  const [initAuth, setInitAuth] = useState(true);
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [eleves, setEleves] = useState([]);
  const [groupes, setGroupes] = useState([]);
  const [appels, setAppels] = useState({});
  const [factures, setFactures] = useState([]);
  const [parametres, setParametres] = useState(null);
  const [comptesRendus, setComptesRendus] = useState([]);
  const [encaissements, setEncaissements] = useState([]);
  const [stages, setStages] = useState([]);
  const [inscrits, setInscrits] = useState([]);
  const [loadingData, setLoadingData] = useState(true);
  const [dataError, setDataError] = useState("");
  const [tab, setTab] = useState("dashboard");
  const [monRole, setMonRole] = useState(null);
  const [profs, setProfs] = useState([]);
  const [compteOuvert, setCompteOuvert] = useState(false);
  const [monProfil, setMonProfil] = useState(null);
  useEffect(() => {
    sb.auth.getSession().then(({
      data
    }) => {
      setSession(data.session);
      setInitAuth(false);
    });
    const {
      data: sub
    } = sb.auth.onAuthStateChange((_evt, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);
  const reloadAll = async roleOverride => {
    const role = roleOverride || monRole;
    setLoadingData(true);
    setDataError("");
    try {
      const {
        eleves: el,
        groupes: gr,
        appels: ap,
        factures: fa
      } = await api.fetchAll(role === "admin");
      setEleves(el);
      setGroupes(gr);
      setAppels(ap);
      setFactures(fa);
      if (role === "admin") {
        setParametres(await api.fetchParametres());
        setEncaissements(await api.fetchEncaissements().catch(() => []));
        const st = await api.fetchStages().catch(() => ({ stages: [], inscrits: [] }));
        setStages(st.stages);
        setInscrits(st.inscrits);
      }
      setComptesRendus(await api.fetchComptesRendus());
    } catch (e) {
      setDataError(e.message || "Erreur de chargement des données");
    }
    setLoadingData(false);
  };
  const chargerProfilEtDonnees = async () => {
    setLoadingData(true);
    setDataError("");
    try {
      const {
        data: profRow,
        error: profErr
      } = await sb.from("profs").select("id,role,prenom,nom,email").eq("auth_id", session.user.id).maybeSingle();
      if (profErr) throw profErr;
      const role = profRow?.role === "admin" ? "admin" : "prof";
      setMonRole(role);
      setMonProfil(profRow);
      if (role !== "admin") setTab("appel");
      const {
        eleves: el,
        groupes: gr,
        appels: ap,
        factures: fa
      } = await api.fetchAll(role === "admin");
      setEleves(el);
      setGroupes(gr);
      setAppels(ap);
      setFactures(fa);
      setComptesRendus(await api.fetchComptesRendus());
      if (role === "admin") {
        setEncaissements(await api.fetchEncaissements().catch(() => []));
        setParametres(await api.fetchParametres());
        const st = await api.fetchStages().catch(() => ({ stages: [], inscrits: [] }));
        setStages(st.stages);
        setInscrits(st.inscrits);
        try {
          setProfs(await api.fetchProfs());
        } catch (e) {/* non bloquant */}
      }
    } catch (e) {
      setDataError(e.message || "Erreur de chargement des données");
    }
    setLoadingData(false);
  };
  useEffect(() => {
    if (session) chargerProfilEtDonnees();
  }, [session]);
  const doLogin = async (email, password) => {
    setAuthLoading(true);
    setAuthError("");
    try {
      const {
        error
      } = await sb.auth.signInWithPassword({
        email,
        password
      });
      if (error) throw error;
    } catch (e) {
      setAuthError(e.message === "Invalid login credentials" ? "Email ou mot de passe incorrect." : e.message);
    }
    setAuthLoading(false);
  };
  const handleChangerMotDePasse = async nouveau => {
    await api.changerMotDePasse(nouveau);
  };
  const doLogout = async () => {
    await sb.auth.signOut();
    setTab("dashboard");
  };
  const handleCreateEleve = async form => {
    await api.saveEleve(form);
    await reloadAll();
  };
  const handleUpdateEleve = async (id, form) => {
    await api.saveEleve({
      ...form,
      id
    });
    await reloadAll();
  };
  const handleToggleEleve = async (id, actif) => {
    await api.toggleEleveActif(id, actif);
    await reloadAll();
  };
  const handleSaveGroupe = async form => {
    await api.saveGroupe(form);
    await reloadAll();
  };
  const handleSaveAppel = async (groupeId, date, presMap) => {
    await api.saveAppel(groupeId, date, presMap);
    // La facturation est cumulative et entièrement pilotée par l'appel : dès qu'une
    // présence est enregistrée, la facture ouverte de l'élève (depuis sa dernière
    // facture payée) est recalculée automatiquement.
    const role = monRole;
    const {
      eleves: el,
      groupes: gr,
      appels: ap,
      factures: fa
    } = await api.fetchAll(role === "admin");
    const grp = gr.find(g => g.id === groupeId);
    if (grp && role === "admin") {
      for (const eid of grp.eids || []) {
        const ele = el.find(x => x.id === eid);
        if (!ele) continue;
        const depuis = dernierePeriodeFin(eid, fa);
        const dates = seancesOuvertes(eid, ap, gr, depuis);
        const montant = parseFloat((dates.length * 2 * ele.th).toFixed(2));
        await api.syncFacture(eid, dates, montant);
      }
    }
    await reloadAll();
  };
  const handleSaveComptesRendus = async (groupeId, date, parEleve, auteurId) => {
    await api.saveComptesRendus(groupeId, date, parEleve, auteurId);
    setComptesRendus(await api.fetchComptesRendus());
  };
  const handleSaveTaux = async (profId, taux) => {
    await api.saveTauxProf(profId, taux);
    setProfs(await api.fetchProfs());
  };
  const handleSaveTel = async (profId, tel) => {
    await api.saveTelProf(profId, tel);
    setProfs(await api.fetchProfs());
  };
  const handleSaveParametres = async form => {
    await api.saveParametres(form);
    setParametres(await api.fetchParametres());
  };
  // L'émission attribue le numéro définitif côté base ; on recharge pour
  // que la facture affichée porte tout de suite son numéro.
  const handleRelancer = async factureId => {
    await api.marquerRelance(factureId);
    await reloadAll();
  };
  const handleAnnulerFacture = async (factureId, motif) => {
    await api.annulerFacture(factureId, motif);
    await reloadAll();
  };
  const handleRetablirFacture = async factureId => {
    await api.retablirFacture(factureId);
    await reloadAll();
  };
  const handleAjouterVersement = async (factureId, versement) => {
    await api.ajouterEncaissement(factureId, versement);
    await reloadAll();
  };
  const handleSupprimerVersement = async id => {
    await api.supprimerEncaissement(id);
    await reloadAll();
  };
  const rechargerStages = async () => {
    const st = await api.fetchStages().catch(() => ({ stages: [], inscrits: [] }));
    setStages(st.stages);
    setInscrits(st.inscrits);
  };
  const handleSaveStage = async form => {
    await api.saveStage(form);
    await rechargerStages();
  };
  const handleSupprimerStage = async id => {
    await api.supprimerStage(id);
    await rechargerStages();
  };
  const handleInscrireStage = async (stageId, eleveId, tarif) => {
    await api.inscrireAuStage(stageId, eleveId, tarif);
    await rechargerStages();
  };
  const handleDesinscrireStage = async inscriptionId => {
    await api.desinscrireDuStage(inscriptionId);
    await rechargerStages();
  };
  // La facturation d'un stage crée de vraies factures : on recharge tout, pour
  // qu'elles apparaissent aussi dans l'onglet Factures sans rafraîchir la page.
  const handleFacturerStage = async (stage, inscriptions) => {
    const n = await api.facturerStage(stage, inscriptions);
    await rechargerStages();
    await reloadAll();
    return n;
  };
  const handleEmettreFacture = async (factureId, options) => {
    const numero = await api.emettreFacture(factureId);
    // Recharger prend une seconde ou deux : quand un partage suit immédiatement,
    // l'appelant diffère ce rechargement pour ne pas perdre l'autorisation de partage.
    if (!options || options.recharger !== false) await reloadAll();
    return numero;
  };
  // Sauvegarde : le plan gratuit de Supabase ne sauvegarde rien de lui-même.
  const handleExportComplet = async () => ({
    exporte_le: new Date().toISOString(),
    version: window.__APP_VERSION || null,
    eleves, groupes, appels, factures,
    comptes_rendus: await api.fetchComptesRendus().catch(() => [])
  });
  const handleSaveFacture = async (factureId, eleveId, data) => {
    await api.saveFacture(factureId, eleveId, data);
    await reloadAll();
  };
  const handleDeleteFacture = async factureId => {
    await api.deleteFacture(factureId);
    await reloadAll();
  };
  const handleDeleteFactureEnCours = async (factureId, eleveId, dates) => {
    await api.deleteFactureEnCours(factureId, eleveId, dates);
    await reloadAll();
  };
  if (initAuth) return /*#__PURE__*/React.createElement(LoadingScreen, null);
  if (!session) return /*#__PURE__*/React.createElement(LoginScreen, {
    onLogin: doLogin,
    error: authError,
    loading: authLoading
  });
  if (loadingData) return /*#__PURE__*/React.createElement(LoadingScreen, {
    msg: "Synchronisation des données…"
  });
  if (dataError) return /*#__PURE__*/React.createElement("div", {
    style: {
      minHeight: "100vh",
      background: C.fond,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 20
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "center",
      maxWidth: 340
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 44,
      marginBottom: 14
    }
  }, "⚠️"), /*#__PURE__*/React.createElement("div", {
    style: {
      color: C.red,
      fontSize: 15,
      fontWeight: 700,
      marginBottom: 8
    }
  }, "Erreur de chargement"), /*#__PURE__*/React.createElement("div", {
    style: {
      color: C.gray,
      fontSize: 13,
      marginBottom: 20
    }
  }, dataError), /*#__PURE__*/React.createElement(BtnPrimary, {
    label: "Réessayer",
    onClick: reloadAll,
    full: true
  })));
  const isAdmin = monRole === "admin";
  const nbAbsNJ = Object.entries(appels).filter(([k]) => k.split(":")[2]?.startsWith(nowYM())).reduce((s, [, p]) => s + Object.values(p).filter(v => v === "absent_nj").length, 0);
  const nbImpayes = factures.filter(f => f.statut === "en_attente" || f.statut === "impaye").length;
  // Un inscrit sans facture valide, c'est une recette qui dort : le badge le dit.
  const nbStagesAFacturer = inscrits.filter(i => {
    if (!i.factureId) return true;
    const f = factures.find(x => x.id === i.factureId);
    return !f || f.statut === "annulee";
  }).length;
  const conformiteIncomplete = isAdmin && champsManquants(parametres).length > 0;
  const TABS = isAdmin ? [{
    k: "dashboard",
    i: "📊",
    l: "Accueil"
  }, {
    k: "eleves",
    i: "👥",
    l: "Élèves"
  }, {
    k: "appel",
    i: "📋",
    l: "Appel",
    badge: nbAbsNJ > 0 ? nbAbsNJ : null
  }, {
    k: "suivi",
    i: "📝",
    l: "Suivi"
  }, {
    k: "factures",
    i: "💰",
    l: "Factures",
    badge: nbImpayes > 0 ? nbImpayes : null
  }, {
    k: "stages",
    i: "🏖️",
    l: "Stages",
    badge: nbStagesAFacturer > 0 ? nbStagesAFacturer : null
  }, {
    k: "reglages",
    i: "⚙️",
    l: "Réglages",
    badge: conformiteIncomplete ? "!" : null
  }] : [{
    k: "appel",
    i: "📋",
    l: "Appel"
  }, {
    k: "suivi",
    i: "📝",
    l: "Suivi"
  }];
  const TITRES = isAdmin ? {
    dashboard: "Vue d'ensemble",
    eleves: "Élèves",
    appel: "Feuille d'appel",
    suivi: "Suivi de séance",
    factures: "Facturation",
    stages: "Stages de vacances",
    reglages: "Réglages"
  } : {
    appel: "Feuille d'appel",
    suivi: "Suivi de séance"
  };
  // L'en-tête porte la marque et le nom de l'écran ; le titre est répété en
  // grand juste en dessous, sur le fond clair, là où l'œil le cherche.
  return /*#__PURE__*/React.createElement("div", {
    style: {
      minHeight: "100vh",
      background: C.fond,
      color: C.texte
    }
  }, /*#__PURE__*/React.createElement(PileBandeaux, null), /*#__PURE__*/React.createElement("div", {
    style: {
      background: C.navy,
      padding: "10px 16px",
      position: "sticky",
      top: 0,
      zIndex: 100,
      boxShadow: "0 1px 3px rgba(10,20,40,.2)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      gap: 10,
      maxWidth: 640,
      margin: "0 auto"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 9,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 32,
      height: 32,
      borderRadius: 9,
      background: "rgba(255,255,255,.14)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: 16,
      flexShrink: 0
    }
  }, "🎓"), /*#__PURE__*/React.createElement("div", {
    style: {
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14.5,
      fontWeight: 600,
      color: "#fff",
      fontFamily: FD,
      lineHeight: 1.15,
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis"
    }
  }, "Boost'Étude"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11.5,
      color: "rgba(255,255,255,.72)",
      lineHeight: 1.2
    }
  }, isAdmin ? "Espace gestion" : monProfil ? [monProfil.prenom, monProfil.nom].filter(Boolean).join(" ") : "Espace professeur"))), /*#__PURE__*/React.createElement("button", {
    onClick: () => setCompteOuvert(true),
    title: "Mon compte",
    style: {
      background: "rgba(255,255,255,.12)",
      border: "none",
      borderRadius: 999,
      padding: "6px 13px",
      color: "#fff",
      fontSize: 12.5,
      fontWeight: 600,
      cursor: "pointer",
      fontFamily: "inherit",
      flexShrink: 0
    }
  }, "Mon compte"))), compteOuvert && /*#__PURE__*/React.createElement(FenetreCompte, {
    profil: monProfil,
    email: (monProfil && monProfil.email) || (session && session.user && session.user.email) || "",
    onFermer: () => setCompteOuvert(false),
    onChanger: handleChangerMotDePasse,
    onDeconnexion: () => {
      setCompteOuvert(false);
      doLogout();
    }
  }), /*#__PURE__*/React.createElement("div", {
    key: tab,
    className: "fx-fade-slide-up",
    style: {
      padding: "14px 16px 94px",
      maxWidth: 640,
      margin: "0 auto"
    }
  }, /*#__PURE__*/React.createElement("h1", {
    style: {
      fontSize: 23,
      fontWeight: 700,
      color: C.texte,
      fontFamily: FD,
      lineHeight: 1.2,
      margin: "2px 0 14px"
    }
  }, TITRES[tab]), tab === "dashboard" && isAdmin && /*#__PURE__*/React.createElement(ModuleDashboard, {
    eleves: eleves,
    groupes: groupes,
    appels: appels,
    factures: factures
  }), tab === "eleves" && isAdmin && /*#__PURE__*/React.createElement(ModuleEleves, {
    eleves: eleves,
    groupes: groupes,
    onCreate: handleCreateEleve,
    onUpdate: handleUpdateEleve,
    onToggle: handleToggleEleve
  }), tab === "appel" && /*#__PURE__*/React.createElement(ModuleAppel, {
    eleves: eleves,
    groupes: groupes,
    appels: appels,
    comptesRendus: comptesRendus,
    monProfilId: monProfil?.id || null,
    onSaveAppel: handleSaveAppel,
    onSaveComptesRendus: handleSaveComptesRendus,
    onSaveGroupe: handleSaveGroupe,
    isAdmin: isAdmin,
    profs: profs,
    onAllerSuivi: () => setTab("suivi")
  }), tab === "factures" && isAdmin && /*#__PURE__*/React.createElement(ModuleFacturation, {
    eleves: eleves,
    groupes: groupes,
    appels: appels,
    factures: factures,
    onSaveFacture: handleSaveFacture,
    onDeleteFacture: handleDeleteFacture,
    onDeleteFactureEnCours: handleDeleteFactureEnCours,
    parametres: parametres,
    onEmettreFacture: handleEmettreFacture,
    onRecharger: reloadAll,
    encaissements: encaissements,
    onAjouterVersement: handleAjouterVersement,
    onSupprimerVersement: handleSupprimerVersement,
    onAnnulerFacture: handleAnnulerFacture,
    onRetablirFacture: handleRetablirFacture,
    onRelancer: handleRelancer
  }), tab === "suivi" && /*#__PURE__*/React.createElement(ModuleSuivi, {
    eleves: eleves,
    groupes: groupes,
    appels: appels,
    comptesRendus: comptesRendus,
    monProfilId: monProfil && monProfil.id ? monProfil.id : null,
    onSave: handleSaveComptesRendus
  }), tab === "stages" && isAdmin && /*#__PURE__*/React.createElement(ModuleStages, {
    stages: stages,
    inscrits: inscrits,
    eleves: eleves,
    factures: factures,
    onSaveStage: handleSaveStage,
    onSupprimerStage: handleSupprimerStage,
    onInscrire: handleInscrireStage,
    onDesinscrire: handleDesinscrireStage,
    onFacturerStage: handleFacturerStage
  }), tab === "reglages" && isAdmin && /*#__PURE__*/React.createElement(ModuleReglages, {
    parametres: parametres,
    eleves: eleves,
    groupes: groupes,
    appels: appels,
    factures: factures,
    profs: profs,
    onSaveParametres: handleSaveParametres,
    onExportComplet: handleExportComplet,
    onSaveTaux: handleSaveTaux,
    onSaveTel: handleSaveTel
  })), TABS.length > 1 && /*#__PURE__*/React.createElement("div", {
    // La barre du bas : blanche, posée sur un filet, avec des libellés lisibles.
    // Huit onglets tiennent sur un écran de téléphone à condition de resserrer
    // le texte — plutôt que d'en cacher un derrière un menu.
    style: {
      position: "fixed",
      bottom: 0,
      left: 0,
      right: 0,
      zIndex: 300,
      background: C.surface,
      borderTop: `1px solid ${C.bord}`,
      padding: "7px 0 calc(10px + env(safe-area-inset-bottom))",
      display: "flex",
      justifyContent: "space-around",
      boxShadow: "0 -1px 3px rgba(18,28,46,.05)"
    }
  }, TABS.map(({
    k,
    i,
    l,
    badge
  }) => /*#__PURE__*/React.createElement("button", {
    key: k,
    onClick: () => setTab(k),
    "aria-current": tab === k ? "page" : undefined,
    style: {
      background: "none",
      border: "none",
      cursor: "pointer",
      fontFamily: "inherit",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 2,
      padding: "2px 2px 0",
      flex: 1,
      minWidth: 0,
      position: "relative"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: TABS.length > 7 ? 19 : 21,
      filter: tab === k ? "none" : "grayscale(100%) opacity(0.55)",
      transform: tab === k ? "scale(1.08)" : "scale(1)",
      transition: "filter .2s,transform .2s"
    }
  }, i), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: TABS.length > 7 ? 9.5 : 10.5,
      fontWeight: tab === k ? 700 : 500,
      color: tab === k ? C.navy : C.gray,
      letterSpacing: TABS.length > 7 ? "0" : ".01em",
      whiteSpace: "nowrap",
      maxWidth: "100%",
      overflow: "hidden",
      textOverflow: "ellipsis"
    }
  }, l), tab === k && /*#__PURE__*/React.createElement("div", {
    className: "fx-pop-in",
    style: {
      position: "absolute",
      top: -7,
      left: "50%",
      transform: "translateX(-50%)",
      width: 26,
      height: 3,
      background: C.navy,
      borderRadius: "0 0 3px 3px"
    }
  }), badge && /*#__PURE__*/React.createElement("div", {
    className: "fx-pop-in",
    style: {
      position: "absolute",
      top: 0,
      right: 4,
      background: C.red,
      color: "#fff",
      borderRadius: 999,
      minWidth: 17,
      height: 17,
      padding: "0 4px",
      fontSize: 10,
      fontWeight: 700,
      display: "flex",
      alignItems: "center",
      justifyContent: "center"
    }
  }, badge)))));
}
