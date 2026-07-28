/* 猪猪鲨手 Service Worker - 离线缓存 + 及时更新 */
const CACHE = 'zzsk_v6';
const ASSETS = [
  './', './index.html', './manifest.webmanifest', './icon.svg',
  './icon-192.png', './icon-512.png', './icon-maskable-512.png',
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
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return; // 只处理同源资源
  const isNav = e.request.mode === 'navigate';
  const isCode = url.pathname.endsWith('.js') || url.pathname.endsWith('.css');
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(e.request);
    const netPromise = fetch(e.request).then((res) => {
      if (res && res.status === 200 && res.type !== 'opaque') cache.put(e.request, res.clone());
      return res;
    }).catch(() => cached);
    // 页面骨架与脚本：网络优先，保证更新即时生效；失败再回退缓存
    if (isNav || isCode) {
      try {
        return await netPromise;
      } catch (_) {
        return cached || (isNav ? cache.match('./index.html') : null);
      }
    }
    // 其余资源：stale-while-revalidate（先用缓存，后台更新）
    return cached || netPromise;
  })());
});
