// Garage service worker: opens instantly from the saved copy, then checks for a newer version in the background.
const C = 'garage-v3', A = ['./', 'index.html', 'manifest.json', 'icon-192.png', 'icon-512.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(C).then(c => c.addAll(A))); self.skipWaiting(); });
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== C).map(x => caches.delete(x)))).then(() => self.clients.claim())));
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  const nav = e.request.mode === 'navigate', key = nav ? './' : e.request;
  const net = caches.open(C).then(async c => {
    const r = await fetch(e.request, { cache: 'no-cache' });
    if (!r.ok) return r;
    if (nav) {
      const old = await c.match(key);
      const [a, b] = await Promise.all([old ? old.text() : Promise.resolve(null), r.clone().text()]);
      await c.put(key, r.clone());
      if (a !== null && a !== b) (await self.clients.matchAll()).forEach(cl => cl.postMessage('updated'));
    } else await c.put(e.request, r.clone());
    return r;
  });
  e.waitUntil(net.catch(() => {}));
  e.respondWith(caches.match(key, { ignoreSearch: true }).then(hit => hit || net).catch(() => caches.match('./')));
});
// The page asks which version is saved, so it can offer a reload when a newer one has been downloaded.
self.addEventListener('message', e => {
  if (e.data !== 'ver') return;
  e.waitUntil(caches.match('./').then(r => (r ? r.text() : '')).then(t => {
    const m = /APP_V='([^']+)'/.exec(t);
    if (e.source) e.source.postMessage({ ver: m ? m[1] : '' });
  }));
});
