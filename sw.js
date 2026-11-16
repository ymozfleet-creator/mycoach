/* MyCOACH-MyTEAM Service Worker
   - ページ(HTML)：ネットワーク優先で常に最新版を表示。3秒以内に返らない／オフライン時のみ保存版を表示
   - アイコン等の静的ファイル：保存版を即表示し、裏で更新
   - 版を上げると古いキャッシュはすべて削除される */
const VERSION = 'mcmt-2026-11-16-9';
const SHELL = ['./', './index.html', './manifest.json', './icons/icon-192.png'];

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).catch(() => {}));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

function networkFirst(req, timeoutMs) {
  return new Promise(resolve => {
    let done = false;
    const fallback = () => caches.match(req, { ignoreSearch: true }).then(hit => hit || fetch(req));
    const timer = setTimeout(() => { if (!done) { done = true; resolve(fallback()); } }, timeoutMs);
    fetch(req, { cache: 'no-store' }).then(res => {
      if (res && res.ok) { const cp = res.clone(); caches.open(VERSION).then(c => c.put(req, cp)); }
      if (!done) { done = true; clearTimeout(timer); resolve(res); }
    }).catch(() => { if (!done) { done = true; clearTimeout(timer); resolve(fallback()); } });
  });
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;              // 外部（フォント・気象API・決済）は触らない
  if (url.pathname.includes('/app/')) return;              // 新アプリ（app/）は専用のService Workerに任せる
  if (req.mode === 'navigate' || url.pathname.endsWith('.html') || url.pathname.endsWith('/')) {
    e.respondWith(networkFirst(req, 3000));
    return;
  }
  e.respondWith(caches.match(req).then(hit => {
    const net = fetch(req).then(res => { if (res && res.ok) { const cp = res.clone(); caches.open(VERSION).then(c => c.put(req, cp)); } return res; });
    return hit || net;
  }));
});
