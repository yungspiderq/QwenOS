/* QwenOS Service Worker — офлайн-кэш v4 */
const CACHE = "qwenos-v4";
const ASSETS = ['./', 'index.html', 'style.css', 'apps.js', 'apps2.js', 'games.js', 'shop.js', 'doom.js', 'os.js', 'manifest.webmanifest', 'icon.svg'];

self.addEventListener('install', e => {
  // не ждём addAll — иначе первая установка упала бы и кэш остался битым навсегда
  self.skipWaiting();
});
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => caches.open(CACHE).then(c => c.addAll(ASSETS)))
      .then(() => self.clients.claim())
  );
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return; // сеть (погода и т.п.) не трогаем
  // сетевой приоритет для HTML/JS/CSS: всегда свежая версия, офлайн — из кэша
  const fresh = /\.(html?|js|css|webmanifest)$/.test(url.pathname);
  e.respondWith(
    (fresh
      ? fetch(e.request).then(res => {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, copy));
          return res;
        })
      : caches.match(e.request).then(hit => hit || fetch(e.request).then(res => {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, copy));
          return res;
        })))
    .catch(() => caches.match(e.request).then(hit => hit || caches.match('index.html')))
  );
});
