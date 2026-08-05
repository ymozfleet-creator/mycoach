/* MyCOACH Service Worker: network-first（常に最新のindex.htmlを取りに行き、オフライン時のみキャッシュ） */
const CACHE = 'mycoach-v1';
self.addEventListener('install', e => { self.skipWaiting(); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || !req.url.startsWith('http')) return;
  const isShell = req.mode === 'navigate' || req.url.includes('index.html');
  if (isShell) {
    // ネットワーク優先：最新版を配信し、成功したらキャッシュ更新。失敗（オフライン）時のみキャッシュ
    e.respondWith(
      fetch(req).then(res => { const cp = res.clone(); caches.open(CACHE).then(c => c.put(req, cp)); return res; })
        .catch(() => caches.match(req))
    );
  } else if (req.url.includes('/icons/') || req.url.includes('manifest.json') || req.url.includes('gstatic.com') || req.url.includes('googleapis.com/css')) {
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => { const cp = res.clone(); caches.open(CACHE).then(c => c.put(req, cp)); return res; })));
  }
});
