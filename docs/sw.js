/* QwenOS Service Worker — офлайн-кэш v6 (структура public/, network-first) */
const CACHE = "qwenos-v6";
const ASSETS = [
  './', 'index.html', 'manifest.webmanifest',
  'css/style.css', 'assets/icon.svg',
  'js/games.js', 'js/shop.js', 'js/doom.js',
  'js/apps2.js', 'js/apps.js', 'js/os.js'
];

self.addEventListener('install', () => self.skipWaiting());

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
  if (url.origin !== location.origin) return; // внешние API (погода и т.п.) не трогаем
  // network-first для всех ресурсов: всегда свежая версия, офлайн — из кэша
  e.respondWith(
    fetch(e.request).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(e.request, copy));
      return res;
    }).catch(() => caches.match(e.request).then(hit => hit || caches.match('index.html')))
  );
});
