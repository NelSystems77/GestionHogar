const CACHE = 'gestionhogar-v10';
const ASSETS = [
  './', './index.html', './manifest.json', './css/styles.css',
  './js/app.js', './js/db.js', './js/utils.js', './js/charts.js', './js/interest.js', './js/firebase-config.js', './js/modules/interest-ui.js', './js/pdf.js', './js/vendor/jspdf.umd.min.js',
  './js/modules/dashboard.js', './js/modules/finance.js', './js/modules/obligations.js',
  './js/modules/shopping.js', './js/modules/tasks.js', './js/modules/settings.js',
  './assets/logo.png', './assets/monkey.png', './icons/icon-192.png', './icons/icon-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Cache-first con actualización en segundo plano
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    caches.match(e.request).then(cached => {
      const net = fetch(e.request).then(res => {
        if (res.ok) caches.open(CACHE).then(c => c.put(e.request, res.clone()));
        return res;
      }).catch(() => cached);
      return cached || net;
    })
  );
});
