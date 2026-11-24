// ─── COURS EN LIGNE : ENREGISTRER SA VOIX ────────────────────
// Réglages → « 🎙 Cours en ligne ». Fouad choisit un cours, voit la diapo et le
// texte à lire (préparé à l'avance), s'enregistre au micro, réécoute, garde.
// L'élève entend ensuite SA voix sur chaque diapo de l'espace élève.
// Fichiers : bucket privé « cours », dossier audio/<cours>/<n°>.<ext> ;
// chemins rangés dans documents.audios (une case par diapo).
const PDFJS_URL = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
const PDFJS_WORKER = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
let pdfjsPromesse = null;
const chargerPdfjs = () => pdfjsPromesse || (pdfjsPromesse = new Promise((ok, ko) => {
  if (window.pdfjsLib) return ok(window.pdfjsLib);
  const s = document.createElement("script");
  s.src = PDFJS_URL;
  s.onload = () => { window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER; ok(window.pdfjsLib); };
  s.onerror = () => { pdfjsPromesse = null; ko(new Error("Lecteur de diapos indisponible (réseau)")); };
  document.head.appendChild(s);
}));

// Format d'enregistrement lisible partout : mp4 (iPhone, Chrome récent), sinon webm.
const formatAudio = () => {
  const R = window.MediaRecorder;
  if (!R || !R.isTypeSupported) return { type: "", ext: "webm" };
  for (const [type, ext] of [["audio/mp4", "m4a"], ["audio/webm;codecs=opus", "webm"], ["audio/webm", "webm"], ["audio/ogg;codecs=opus", "ogg"]])
    if (R.isTypeSupported(type)) return { type, ext };
  return { type: "", ext: "webm" };
};
const cheminAudio = (doc, n, ext) => `audio/${(doc.url || doc.id).replace(/\.pdf$/i, "")}/${String(n).padStart(2, "0")}-${Date.now().toString(36)}.${ext}`;

const apiCours = {
  async liste() {
    const { data, error } = await sb.from("documents")
      .select("id,titre,niveau,matiere,url,ordre,nb_pages,narration,audios").order("niveau").order("ordre");
    if (error) throw error;
    return data || [];
  },
  async urlSignee(chemin) {
    const { data, error } = await sb.storage.from("cours").createSignedUrl(chemin, 3600);
    if (error) throw error;
    return data.signedUrl;
  },
  async enregistrerAudio(doc, n, blob, ext) {
    const chemin = cheminAudio(doc, n, ext);
    const { error } = await sb.storage.from("cours").upload(chemin, blob, { contentType: (blob.type || "audio/webm").split(";")[0], upsert: true });
    if (error) throw error;
    const audios = Array.from({ length: Math.max(doc.nb_pages || 0, n, (doc.audios || []).length) }, (_, i) => (doc.audios || [])[i] || null);
    const ancien = audios[n - 1];
    audios[n - 1] = chemin;
    const { error: e2 } = await sb.from("documents").update({ audios }).eq("id", doc.id);
    if (e2) throw e2;
    if (ancien) sb.storage.from("cours").remove([ancien]).catch(() => {});
    return audios;
  },
  async retirerAudio(doc, n) {
    const audios = [...(doc.audios || [])];
    const ancien = audios[n - 1];
    audios[n - 1] = null;
    const { error } = await sb.from("documents").update({ audios }).eq("id", doc.id);
    if (error) throw error;
    if (ancien) sb.storage.from("cours").remove([ancien]).catch(() => {});
    return audios;
  }
};
const nbAudios = d => (d.audios || []).filter(Boolean).length;

function OngletCoursEnLigne() {
  const [cours, setCours] = useState(null);
  const [erreur, setErreur] = useState("");
  const [choisi, setChoisi] = useState(null);
  const recharger = () => apiCours.liste().then(setCours).catch(e => setErreur(e.message || String(e)));
  useEffect(() => { recharger(); }, []);
  if (choisi) return h(StudioEnregistrement, {
    doc: choisi,
    onMaj: d => { setChoisi(d); setCours(l => (l || []).map(x => x.id === d.id ? d : x)); },
    onRetour: () => setChoisi(null)
  });
  if (erreur) return h("div", { style: { color: C.red, fontSize: 14 } }, "Impossible de charger les cours : ", erreur);
  if (!cours) return h("div", { style: { color: C.gray, fontSize: 14 } }, "Chargement des cours…");
  const parNiveau = {};
  cours.forEach(d => { (parNiveau[d.niveau] ||= []).push(d); });
  return h("div", null,
    h("div", { style: { fontSize: 13, color: C.gray, marginBottom: 12, lineHeight: 1.5 } },
      "Enregistre ta voix diapo par diapo : tes élèves l'entendront dans leur espace élève en appuyant sur « Écouter ». ",
      "Les diapos sans enregistrement sont lues par la voix du téléphone quand un texte est prévu."),
    Object.entries(parNiveau).map(([niv, l]) => h("div", { key: niv, style: { marginBottom: 14 } },
      h("div", { style: { fontSize: 12, fontWeight: 700, color: C.gold, margin: "4px 0 8px" } }, niv),
      l.map(d => h("button", {
        key: d.id, onClick: () => setChoisi(d),
        style: { display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left", background: C.surface,
          border: `1px solid ${C.bord}`, borderRadius: 12, padding: "12px 14px", marginBottom: 8, cursor: "pointer",
          fontFamily: "inherit", color: C.texte }
      },
        h("span", { style: { flex: 1 } },
          h("div", { style: { fontWeight: 700, fontSize: 14.5 } }, d.titre),
          h("div", { style: { fontSize: 12, color: C.gray, marginTop: 2 } },
            `${d.nb_pages || "?"} diapos`,
            Array.isArray(d.narration) && d.narration.length ? " · texte prêt" : "",
            nbAudios(d) ? ` · 🎙 ${nbAudios(d)}/${d.nb_pages || "?"} enregistrées` : "")),
        h("span", { style: { color: C.gold, fontSize: 20 } }, "›"))))));
}

function StudioEnregistrement({ doc, onMaj, onRetour }) {
  const [pdf, setPdf] = useState(null);
  const [page, setPage] = useState(1);
  const [etat, setEtat] = useState("pret"); // pret | enregistre | apercu | envoi
  const [apercu, setApercu] = useState(null); // { blob, url, ext }
  const [secondes, setSecondes] = useState(0);
  const [message, setMessage] = useState("");
  const [urlExistante, setUrlExistante] = useState(null);
  const canvasRef = React.useRef(null);
  const enreg = React.useRef(null);
  const n = doc.nb_pages || (pdf ? pdf.numPages : 0);
  const texte = (doc.narration || [])[page - 1];
  const dejaEnregistree = !!(doc.audios || [])[page - 1];

  useEffect(() => {
    let annule = false;
    (async () => {
      try {
        const lib = await chargerPdfjs();
        const url = await apiCours.urlSignee(doc.url);
        const p = await lib.getDocument({ url }).promise;
        if (!annule) setPdf(p);
      } catch (e) { if (!annule) setMessage(e.message || String(e)); }
    })();
    return () => { annule = true; arreterMicro(); };
  }, [doc.id]);

  useEffect(() => {
    if (!pdf || !canvasRef.current) return;
    let annule = false;
    pdf.getPage(page).then(pg => {
      if (annule) return;
      const c = canvasRef.current;
      const largeur = Math.min(c.parentElement.clientWidth || 600, 900);
      const base = pg.getViewport({ scale: 1 });
      const vp = pg.getViewport({ scale: (largeur / base.width) * Math.min(window.devicePixelRatio || 1, 2) });
      c.width = vp.width; c.height = vp.height; c.style.width = largeur + "px";
      pg.render({ canvasContext: c.getContext("2d"), viewport: vp });
    });
    return () => { annule = true; };
  }, [pdf, page]);

  useEffect(() => {
    setUrlExistante(null);
    const chemin = (doc.audios || [])[page - 1];
    if (chemin) apiCours.urlSignee(chemin).then(setUrlExistante).catch(() => {});
  }, [page, (doc.audios || [])[page - 1]]);

  const arreterMicro = () => {
    const e = enreg.current;
    if (e) { clearInterval(e.minuteur); try { if (e.rec.state !== "inactive") e.rec.stop(); } catch (_) {} e.flux.getTracks().forEach(t => t.stop()); }
    enreg.current = null;
  };
  const demarrer = async () => {
    setMessage("");
    if (apercu) { URL.revokeObjectURL(apercu.url); setApercu(null); }
    try {
      const flux = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      const f = formatAudio();
      const rec = new MediaRecorder(flux, f.type ? { mimeType: f.type } : undefined);
      const morceaux = [];
      rec.ondataavailable = ev => { if (ev.data && ev.data.size) morceaux.push(ev.data); };
      rec.onstop = () => {
        const blob = new Blob(morceaux, { type: rec.mimeType || f.type || "audio/webm" });
        const ext = /mp4|m4a|aac/.test(blob.type) ? "m4a" : /ogg/.test(blob.type) ? "ogg" : "webm";
        setApercu({ blob, url: URL.createObjectURL(blob), ext });
        setEtat("apercu");
      };
      const debut = Date.now();
      setSecondes(0);
      enreg.current = { rec, flux, minuteur: setInterval(() => setSecondes(Math.round((Date.now() - debut) / 1000)), 500) };
      rec.start();
      setEtat("enregistre");
    } catch (e) {
      setMessage("Micro indisponible : autorise l'accès au micro pour cette page, puis réessaie.");
    }
  };
  const arreter = () => arreterMicro();
  const garder = async (suivante) => {
    if (!apercu) return;
    setEtat("envoi");
    try {
      const audios = await apiCours.enregistrerAudio(doc, page, apercu.blob, apercu.ext);
      onMaj({ ...doc, audios });
      URL.revokeObjectURL(apercu.url);
      setApercu(null); setEtat("pret");
      signalerSucces(`Diapo ${page} enregistrée ✔`);
      if (suivante && page < n) setPage(page + 1);
    } catch (e) { setEtat("apercu"); setMessage("Envoi impossible : " + (e.message || e)); }
  };
  const recommencer = () => { if (apercu) URL.revokeObjectURL(apercu.url); setApercu(null); setEtat("pret"); };
  const retirer = async () => {
    if (!window.confirm(`Supprimer l'enregistrement de la diapo ${page} ?`)) return;
    try { const audios = await apiCours.retirerAudio(doc, page); onMaj({ ...doc, audios }); }
    catch (e) { setMessage(e.message || String(e)); }
  };
  const aller = d => { if (etat === "enregistre" || etat === "envoi") return; recommencer(); setPage(p => Math.min(n || 1, Math.max(1, p + d))); };

  const btn = (label, onClick, style = {}, disabled) => h("button", {
    onClick, disabled,
    style: { flex: 1, padding: "13px 12px", borderRadius: 12, border: `1px solid ${C.bord}`, background: C.surface,
      color: C.texte, fontSize: 15, fontWeight: 700, cursor: disabled ? "default" : "pointer", fontFamily: "inherit",
      opacity: disabled ? .5 : 1, ...style }
  }, label);

  return h("div", null,
    h("button", { onClick: () => { arreterMicro(); onRetour(); },
      style: { background: "none", border: "none", color: C.gold, cursor: "pointer", fontSize: 15, padding: 0, marginBottom: 10, fontFamily: "inherit" } },
      "← Tous les cours"),
    h("div", { style: { fontWeight: 800, fontSize: 18, color: C.texte } }, doc.titre),
    h("div", { style: { fontSize: 12.5, color: C.gray, margin: "2px 0 10px" } },
      `${doc.niveau} · 🎙 ${nbAudios(doc)}/${n || "?"} diapos enregistrées`),
    h("div", { style: { background: "#11151f", borderRadius: 12, padding: 6, marginBottom: 10, minHeight: 80 } },
      pdf ? h("canvas", { ref: canvasRef, style: { display: "block", maxWidth: "100%", margin: "0 auto", borderRadius: 6, background: "#fff" } })
          : h("div", { style: { color: "#c9cfdb", textAlign: "center", padding: 30, fontSize: 13 } }, message || "Ouverture des diapos…")),
    h("div", { style: { display: "flex", alignItems: "center", gap: 8, marginBottom: 10 } },
      btn("‹", () => aller(-1), { flex: "0 0 56px" }, page <= 1),
      h("div", { style: { flex: 1, textAlign: "center", fontWeight: 800, color: C.texte } },
        `Diapo ${page} / ${n || "?"}`, dejaEnregistree ? h("span", { style: { color: C.green } }, "  ✔") : null),
      btn("›", () => aller(1), { flex: "0 0 56px" }, page >= n)),
    texte && h("div", { style: { background: C.goldPale || "#fbf6e6", border: `1px solid ${C.goldBord || C.bord}`, borderRadius: 12,
      padding: "12px 14px", fontSize: 16, lineHeight: 1.6, color: C.texte, marginBottom: 10, maxHeight: 260, overflowY: "auto" } },
      h("div", { style: { fontSize: 11.5, fontWeight: 700, color: C.gold, marginBottom: 4 } }, "TEXTE À LIRE (tu peux t'en écarter librement)"),
      texte),
    etat === "pret" && h("div", { style: { display: "flex", gap: 8, flexWrap: "wrap" } },
      btn(dejaEnregistree ? "⏺ Réenregistrer" : "⏺ Enregistrer", demarrer, { background: C.red, color: "#fff", border: "none" })),
    etat === "enregistre" && h("div", { style: { display: "flex", gap: 8 } },
      btn(`⏹ Arrêter (${Math.floor(secondes / 60)}:${String(secondes % 60).padStart(2, "0")})`, arreter, { background: C.navy, color: "#fff", border: "none" })),
    etat === "apercu" && apercu && h("div", null,
      h("audio", { src: apercu.url, controls: true, style: { width: "100%", marginBottom: 8 } }),
      h("div", { style: { display: "flex", gap: 8, flexWrap: "wrap" } },
        btn("↺ Recommencer", recommencer),
        btn(page < n ? "✅ Garder et diapo suivante" : "✅ Garder", () => garder(true), { background: C.green, color: "#fff", border: "none" }))),
    etat === "envoi" && h("div", { style: { color: C.gray, textAlign: "center", padding: 12 } }, "Envoi en cours…"),
    etat === "pret" && urlExistante && h("div", { style: { marginTop: 10 } },
      h("div", { style: { fontSize: 12, color: C.gray, marginBottom: 4 } }, "Enregistrement actuel de cette diapo :"),
      h("audio", { src: urlExistante, controls: true, style: { width: "100%" } }),
      h("button", { onClick: retirer, style: { background: "none", border: "none", color: C.red, fontSize: 13, cursor: "pointer", padding: "6px 0", fontFamily: "inherit" } },
        "Supprimer cet enregistrement")),
    message && pdf && h("div", { style: { color: C.red, fontSize: 13, marginTop: 8 } }, message),
    h("div", { style: { fontSize: 12, color: C.gray, marginTop: 14, lineHeight: 1.5 } },
      "Astuce : enregistre dans une pièce calme, téléphone à 20 cm de la bouche. Une diapo = un enregistrement : si tu te trompes, appuie sur « Recommencer »."));
}
