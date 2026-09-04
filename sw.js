const CACHE = 'gentaury-v4';

self.addEventListener('install', e => {
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = e.request.url;

  // Google APIs: siempre red directa
  if (url.includes('googleapis.com') || url.includes('accounts.google.com') || url.includes('gstatic.com')) {
    return;
  }

  // HTML y JS de la app: SIEMPRE red primero (para recibir actualizaciones)
  if (e.request.mode === 'navigate' || url.endsWith('.html') || url.endsWith('/') || url.endsWith('sw.js') || url.endsWith('manifest.json')) {
    e.respondWith(
      fetch(e.request, { cache: 'no-store' })
        .then(res => {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
          return res;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  // Iconos y fuentes: caché primero (no cambian)
  e.respondWith(
    caches.match(e.request).then(cached =>
      cached || fetch(e.request).then(res => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      })
    )
  );
});
