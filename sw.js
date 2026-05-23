const CACHE = 'rentacontrol-v1';
const ASSETS = [
  '/rentacontrol/',
  '/rentacontrol/index.html',
  '/rentacontrol/manifest.json',
  '/rentacontrol/icon-192.png',
  '/rentacontrol/icon-512.png',
  '/rentacontrol/icon-180.png'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  // Network first for Google APIs, cache first for app assets
  if (e.request.url.includes('googleapis.com') || e.request.url.includes('accounts.google.com')) {
    e.respondWith(fetch(e.request).catch(() => new Response('', {status: 503})));
    return;
  }
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      }).catch(() => caches.match('/rentacontrol/'));
    })
  );
});
