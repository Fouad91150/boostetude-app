// Service worker — stratégie « réseau d'abord ».
// L'application dialogue en direct avec Supabase : le cache ne sert qu'à ouvrir
// l'écran quand la connexion manque, jamais à figer une vieille version. C'est
// délibéré : un cache trop zélé rejouerait exactement la panne de septembre,
// où une ancienne version continuait de s'afficher.
// Remplacé au build par le numéro de version : chaque version a son propre cache.
const CACHE = "boostetude-3.5.2";
// Chemins relatifs à l'emplacement du service worker : l'appli peut vivre à la
// racine (Netlify) comme sous /boostetude-app/ (GitHub Pages).
const ICI = p => new URL(p, self.location).href;
const COQUILLE = ["./", "index.html", "manifest.json", "icon-192.png", "icon-512.png"].map(ICI);

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(COQUILLE)).catch(() => {}).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(noms => Promise.all(noms.filter(n => n !== CACHE).map(n => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  // Supabase et les CDN doivent toujours répondre en direct.
  if (new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    fetch(req)
      .then(res => {
        const copie = res.clone();
        caches.open(CACHE).then(c => c.put(req, copie)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(req).then(m => m || caches.match(ICI("index.html"))))
  );
});
