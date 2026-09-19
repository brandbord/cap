/* Service worker : Cap fonctionne hors ligne une fois ouvert une première fois.
   Stratégie : on sert le cache tout de suite et on le rafraîchit en arrière-plan (les mises à jour arrivent au lancement suivant).
   Les données ne passent JAMAIS par ici : elles restent dans le navigateur. */
const VERSION = 'cap-v1.6';
const SHELL = ['./', 'index.html', 'style.css', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-180.png',
  'js/core.js', 'js/ops.js', 'js/autosave.js', 'js/sync.js', 'js/views-today.js', 'js/views-lists.js', 'js/views-extra.js', 'js/track-core.js', 'js/track-charts.js', 'js/track-evo.js', 'js/track-views.js', 'js/track-evo-view.js', 'js/track-views2.js', 'js/views-misc.js', 'js/app.js'];

self.addEventListener('install', e => { e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET') return;
  const ok = url.origin === location.origin || /fonts\.(googleapis|gstatic)\.com$/.test(url.hostname);
  if (!ok) return;
  e.respondWith(caches.open(VERSION).then(async c => {
    const hit = await c.match(req, { ignoreSearch: true });
    const net = fetch(req).then(r => { if (r && r.ok) c.put(req, r.clone()); return r; }).catch(() => hit);
    return hit || net;
  }));
});
