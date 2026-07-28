/* 猪猪鲨手 Service Worker - 离线缓存静态资源 */
const CACHE = 'zzsk_v5';
const ASSETS = [
  './', './index.html', './manifest.webmanifest', './icon.svg',
  './css/style.css',
  './js/db.js', './js/app.js', './js/ai.js',
  './js/sections/placeholder.js', './js/sections/dashboard.js', './js/sections/daily-plan.js',
  './js/sections/notes.js', './js/sections/new-task.js',
  './js/sections/words.js', './js/sections/health.js', './js/sections/english.js',
  './js/sections/review.js', './js/sections/sidehustle.js', './js/sections/inspiration.js',
  './js/sections/podcast.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then((hit) => hit ||
      fetch(e.request).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
        return res;
      }).catch(() => hit)
    )
  );
});
