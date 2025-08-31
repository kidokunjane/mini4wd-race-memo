// sw.js
const VERSION = 'v1.0.17';
// Service Worker が管理できるスコープの先頭URL（例: https://user.github.io/repo/）
const BASE_URL = self.registration.scope;
const CACHE_NAME = `mini4wd-race-memo-${VERSION}`;

// 事前キャッシュ（相対にしない。常に BASE_URL からの絶対URLを作る）
const ASSETS = [
  new URL('./', BASE_URL).toString(),            // index.html の GET にもヒット
  new URL('./index.html', BASE_URL).toString(),
  new URL('./manifest.json', BASE_URL).toString(),
  new URL('./history.txt', BASE_URL).toString(),
  new URL('./sw.js', BASE_URL).toString()
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;

  // 同一オリジンのみ対象
  if (new URL(req.url).origin !== location.origin) return;

  event.respondWith((async () => {
    // まずキャッシュ
    const cached = await caches.match(req);
    if (cached) {
      // HTML は裏で最新化
      if (req.destination === 'document') {
        fetch(req).then(r => {
          if (r && r.ok) caches.open(CACHE_NAME).then(c => c.put(req, r.clone()));
        }).catch(()=>{});
      }
      return cached;
    }
    // なければネット → 成功したら静的っぽいものはキャッシュ
    try {
      const net = await fetch(req);
      if (net && net.ok && req.method === 'GET') {
        const url = req.url;
        if (url.includes('.html') || url.includes('.css') || url.includes('.js') || url.includes('.json') || url.endsWith('/')) {
          (await caches.open(CACHE_NAME)).put(req, net.clone());
        }
      }
      return net;
    } catch {
      // オフライン時のフォールバック（HTMLは index.html 相当へ）
      if (req.destination === 'document') {
        return caches.match(new URL('./index.html', BASE_URL).toString());
      }
      return new Response('オフラインです', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    }
  })());
});

// 通知・openWindow など BASE_URL を使う
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow(new URL('./', BASE_URL).toString()));
});
