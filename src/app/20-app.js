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
  const [bilans, setBilans] = useState([]);
  const [loadingData, setLoadingData] = useState(true);
  const [dataError, setDataError] = useState("");
  const [tab, setTab] = useState("dashboard");
  const [monRole, setMonRole] = useState(null);
  const [profs, setProfs] = useState([]);
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
      if (role === "admin") setParametres(await api.fetchParametres());
      setComptesRendus(await api.fetchComptesRendus());
      setBilans(await api.fetchBilansEnvoyes());
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
      setBilans(await api.fetchBilansEnvoyes());
      if (role === "admin") {
        setParametres(await api.fetchParametres());
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
  // La trace d'envoi est un confort (badge « ✓ envoyé »), jamais un préalable :
  // si elle échoue, le message part quand même.
  const handleLogBilan = async row => {
    try {
      await api.logBilan(row);
      setBilans(await api.fetchBilansEnvoyes());
    } catch (e) {}
  };
  const handleSaveParametres = async form => {
    await api.saveParametres(form);
    setParametres(await api.fetchParametres());
  };
  // L'émission attribue le numéro définitif côté base ; on recharge pour
  // que la facture affichée porte tout de suite son numéro.
  const handleEmettreFacture = async factureId => {
    await api.emettreFacture(factureId);
    await reloadAll();
  };
  // Sauvegarde : le plan gratuit de Supabase ne sauvegarde rien de lui-même.
  const handleExportComplet = async () => ({
    exporte_le: new Date().toISOString(),
    version: window.__APP_VERSION || null,
    eleves, groupes, appels, factures,
    comptes_rendus: await api.fetchComptesRendus().catch(() => []),
    bilans_envoyes: await api.fetchBilansEnvoyes().catch(() => [])
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
      background: C.navy,
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
  const conformiteIncomplete = isAdmin && champsManquants(parametres).length > 0;
  const lundiCourant = lundiDe(todayStr());
  const dimancheCourant = addJours(lundiCourant, 6);
  const semaineCouranteId = isoSemaine(lundiCourant);
  const vusCetteSemaine = new Set();
  Object.entries(appels).forEach(([k, p]) => {
    const parts = k.split(":");
    if (parts[0] !== "ap") return;
    if (parts[2] < lundiCourant || parts[2] > dimancheCourant) return;
    Object.entries(p).forEach(([eid, st]) => { if (st) vusCetteSemaine.add(eid); });
  });
  const bilansFaits = new Set(bilans.filter(b => b.semaine === semaineCouranteId).map(b => b.eleve_id));
  const nbBilansDus = [...vusCetteSemaine].filter(id => !bilansFaits.has(id)).length;
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
    k: "bilans",
    i: "📨",
    l: "Bilans",
    badge: nbBilansDus > 0 ? nbBilansDus : null
  }, {
    k: "factures",
    i: "💰",
    l: "Factures",
    badge: nbImpayes > 0 ? nbImpayes : null
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
  }, {
    k: "bilans",
    i: "📨",
    l: "Bilans",
    badge: nbBilansDus > 0 ? nbBilansDus : null
  }];
  const TITRES = isAdmin ? {
    dashboard: "Dashboard",
    eleves: "Élèves",
    appel: "Feuille d'appel",
    suivi: "Suivi de séance",
    bilans: "Bilans hebdo",
    factures: "Facturation",
    reglages: "Réglages"
  } : {
    appel: "Feuille d'appel",
    suivi: "Suivi de séance",
    bilans: "Bilans hebdo"
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      minHeight: "100vh",
      background: C.navy,
      fontFamily: FD,
      color: C.cream
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: `linear-gradient(135deg,${C.navyM},${C.navyL})`,
      borderBottom: "1px solid rgba(212,175,55,.2)",
      padding: "14px 20px",
      position: "sticky",
      top: 0,
      zIndex: 100
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "flex-start"
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 10,
      fontWeight: 700,
      color: C.gold,
      letterSpacing: "2px",
      textTransform: "uppercase"
    }
  }, "Boost'Étude", !isAdmin && monProfil ? ` — ${[monProfil.prenom, monProfil.nom].filter(Boolean).join(" ")}` : ""), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 20,
      fontWeight: 800,
      color: C.cream,
      fontFamily: FD,
      lineHeight: 1.2
    }
  }, TITRES[tab])), /*#__PURE__*/React.createElement("button", {
    onClick: doLogout,
    style: {
      background: "rgba(255,255,255,.08)",
      border: "none",
      borderRadius: 8,
      padding: "6px 10px",
      color: C.gray,
      fontSize: 11,
      fontWeight: 700,
      cursor: "pointer",
      fontFamily: "inherit"
    }
  }, "Déconnexion"))), /*#__PURE__*/React.createElement("div", {
    key: tab,
    className: "fx-fade-slide-up",
    style: {
      padding: "16px 16px 90px",
      maxWidth: 600,
      margin: "0 auto"
    }
  }, tab === "dashboard" && isAdmin && /*#__PURE__*/React.createElement(ModuleDashboard, {
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
    onSaveAppel: handleSaveAppel,
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
    onEmettreFacture: handleEmettreFacture
  }), tab === "suivi" && /*#__PURE__*/React.createElement(ModuleSuivi, {
    eleves: eleves,
    groupes: groupes,
    appels: appels,
    comptesRendus: comptesRendus,
    monProfilId: monProfil && monProfil.id ? monProfil.id : null,
    onSave: handleSaveComptesRendus
  }), tab === "bilans" && /*#__PURE__*/React.createElement(ModuleBilans, {
    eleves: eleves,
    groupes: groupes,
    appels: appels,
    comptesRendus: comptesRendus,
    bilans: bilans,
    monProfilId: monProfil && monProfil.id ? monProfil.id : null,
    onLog: handleLogBilan
  }), tab === "reglages" && isAdmin && /*#__PURE__*/React.createElement(ModuleReglages, {
    parametres: parametres,
    eleves: eleves,
    groupes: groupes,
    appels: appels,
    factures: factures,
    onSaveParametres: handleSaveParametres,
    onExportComplet: handleExportComplet
  })), TABS.length > 1 && /*#__PURE__*/React.createElement("div", {
    style: {
      position: "fixed",
      bottom: 0,
      left: 0,
      right: 0,
      zIndex: 300,
      background: `linear-gradient(to top,${C.navyM},rgba(10,20,40,.98))`,
      borderTop: "1px solid rgba(212,175,55,.2)",
      padding: "8px 0 14px",
      display: "flex",
      justifyContent: "space-around"
    }
  }, TABS.map(({
    k,
    i,
    l,
    badge
  }) => /*#__PURE__*/React.createElement("button", {
    key: k,
    onClick: () => setTab(k),
    style: {
      background: "none",
      border: "none",
      cursor: "pointer",
      fontFamily: "inherit",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 3,
      padding: "0 3px",
      flex: 1,
      minWidth: 0,
      position: "relative"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 22,
      filter: tab === k ? "none" : "grayscale(100%) opacity(0.5)",
      transform: tab === k ? "scale(1.12)" : "scale(1)",
      transition: "filter .2s,transform .2s"
    }
  }, i), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 9,
      fontWeight: 700,
      color: tab === k ? C.gold : C.gray,
      letterSpacing: ".2px",
      textTransform: "uppercase",
      whiteSpace: "nowrap"
    }
  }, l), tab === k && /*#__PURE__*/React.createElement("div", {
    className: "fx-pop-in",
    style: {
      position: "absolute",
      top: -8,
      left: "50%",
      transform: "translateX(-50%)",
      width: 32,
      height: 3,
      background: C.gold,
      borderRadius: "0 0 3px 3px"
    }
  }), badge && /*#__PURE__*/React.createElement("div", {
    className: "fx-pop-in",
    style: {
      position: "absolute",
      top: -2,
      right: 2,
      background: C.red,
      color: "#fff",
      borderRadius: "50%",
      width: 18,
      height: 18,
      fontSize: 10,
      fontWeight: 800,
      display: "flex",
      alignItems: "center",
      justifyContent: "center"
    }
  }, badge)))));
}
