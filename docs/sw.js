/* ==========================================================================
   QwenOS — service worker
   Стратегия: network-first для документов, cache-first для ассетов.
   Позволяет системе работать полностью офлайн (PWA).
   ========================================================================== */
const VERSION = 'qwenos-sw-v3.0.0-20';
const CORE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './favicon.svg',
  './version.json',
  './css/base.css',
  './css/desktop.css',
  './css/windows.css',
  './css/apps.css',
  './js/core.js',
  './js/fs.js',
  './js/wm.js',
  './js/updater.js',
  './js/apartment.js',
  './js/work.js',
  './js/vendor/three.min.js',
  './js/desktop.js',
  './js/taskbar.js',
  './js/boot.js',
  './js/apps/system.js',
  './js/apps/system-ui.js',
  './js/apps/explorer.js',
  './js/apps/steam.js',
  './js/apps/bank.js',
    './js/apps/productivity.js',
  './js/apps/media.js',
  './js/apps/games.js',
  './assets/icon-192.png',
  './assets/icon-512.png',
  './assets/icon-maskable-512.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(VERSION).then((c) => c.addAll(CORE)).catch(() => {}).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (e) => {
  if (e.data === 'skipWaiting') self.skipWaiting();
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Единая стратегия network-first с фолбэком в кэш:
  // обновления применяются сразу, а офлайн работает из кэша.
  e.respondWith(
    (async () => {
      const cache = await caches.open(VERSION);
      try {
        const res = await fetch(req);
        if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
        if (req.mode === 'navigate') cache.put('./index.html', res.clone());
        return res;
      } catch (err) {
        const hit = await cache.match(req, { ignoreSearch: req.mode === 'navigate' });
        if (hit) return hit;
        const nav = await cache.match('./index.html');
        return nav || Response.error();
      }
    })()
  );
});
