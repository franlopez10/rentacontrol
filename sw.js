const CACHE = 'gentaury-v22';

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

  // APIs externas y CDNs: siempre red directa (no interceptar)
  if (url.includes('googleapis.com') || url.includes('accounts.google.com') || url.includes('gstatic.com') || url.includes('cdnjs.cloudflare.com')) {
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

// Al tocar una notificación de avisos: abre la app (o la trae al frente) en la sección de avisos
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || self.registration.scope;
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const c of list) {
        if (c.url.startsWith(self.registration.scope) && 'focus' in c) {
          c.postMessage({ tipo: 'abrir-avisos' });
          return c.focus();
        }
      }
      return self.clients.openWindow(url.split('#')[0] + '#avisos');
    })
  );
});
