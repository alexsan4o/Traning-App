/* Service worker веб-версии: приложение открывается без сети после первого визита.
 * Страница — «сначала сеть» (чтобы получать обновления), статика с хэшами в именах — «сначала кэш». */
const CACHE = 'athlete-coach-web-v1';
const SCOPE = self.registration.scope; // например https://user.github.io/Traning-App/

// Файлы, на которые ссылается страница (бандлы JS/CSS), — чтобы офлайн работал уже со второго открытия.
async function precache() {
  const cache = await caches.open(CACHE);
  const res = await fetch(SCOPE, { cache: 'no-store' });
  if (!res.ok && res.status !== 404) return;
  const html = await res.clone().text();
  await cache.put(SCOPE, res);
  const urls = Array.from(html.matchAll(/(?:src|href)="([^"]+\.(?:js|css|png|webmanifest))"/g), (m) => new URL(m[1], SCOPE).href);
  await Promise.all(
    urls.map((url) =>
      fetch(url)
        .then((r) => (r.ok ? cache.put(url, r) : undefined))
        .catch(() => undefined),
    ),
  );
  // Удаляем бандлы прошлых версий.
  const keep = new Set(urls);
  for (const req of await cache.keys()) {
    if (req.url.includes('/_expo/static/') && !keep.has(req.url)) await cache.delete(req);
  }
}

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(precache().catch(() => undefined));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || !req.url.startsWith(SCOPE)) return;

  if (req.mode === 'navigate') {
    // GitHub Pages отдаёт приложение для любых путей через 404.html — такой ответ тоже годится.
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok || res.status === 404) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(SCOPE, copy));
          }
          return res;
        })
        .catch(() => caches.match(SCOPE).then((hit) => hit || Response.error())),
    );
    return;
  }

  event.respondWith(
    caches.match(req).then(
      (hit) =>
        hit ||
        fetch(req).then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        }),
    ),
  );
});
