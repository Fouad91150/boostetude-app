// ─── PWA SERVICE WORKER ──────────────────────────────────────
// Le service worker garde une copie de l'écran pour que l'application s'ouvre
// quand le réseau manque. Mais une copie, par nature, vieillit : après une mise
// à jour, l'appareil peut continuer d'afficher l'ancienne page — ou pire, mélanger
// l'ancienne coquille et le nouveau code, ce qui donne un écran blanc.
//
// Trois précautions, donc : on vérifie à chaque ouverture s'il existe une nouvelle
// version, on recharge une fois quand elle prend la main, et on ne recharge jamais
// deux fois de suite — une boucle de rechargement serait pire que le mal.
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").then(enregistrement => {
      // Au retour sur l'application, demander au navigateur s'il y a du neuf.
      enregistrement.update().catch(() => {});
      document.addEventListener("visibilitychange", () => {
        if (!document.hidden) enregistrement.update().catch(() => {});
      });
    }).catch(() => {});

    let rechargement = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (rechargement) return;
      rechargement = true;
      window.location.reload();
    });
  });
}
