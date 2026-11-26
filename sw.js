const CACHE = 'gentaury-v49';
// v4.26 · Abrir rápido y con la última versión:
//  · La página se pide a GitHub preguntando «¿ha cambiado?» (revalidación con ETag: si no cambió, la respuesta es mínima).
//  · Si la red tarda más de 3,5 s, se abre al momento la copia guardada y la nueva se guarda por detrás; si era distinta,
//    se avisa a la app, que se recarga sola en cuanto no estés escribiendo.

self.addEventListener('install', e => {
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function avisarNuevaVersion() {
  return self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    list.forEach(c => { try { c.postMessage({ tipo: 'nueva-version' }); } catch (e) {} });
  });
}
function huella(res) {
  if (!res) return '';
  return (res.headers.get('etag') || '') + '|' + (res.headers.get('last-modified') || '') + '|' + (res.headers.get('content-length') || '');
}

self.addEventListener('fetch', e => {
  const url = e.request.url;

  // APIs externas y CDNs: siempre red directa (no interceptar)
  if (url.includes('googleapis.com') || url.includes('accounts.google.com') || url.includes('gstatic.com') || url.includes('cdnjs.cloudflare.com')) {
    return;
  }
  if (e.request.method !== 'GET') return;

  // El service worker y el manifiesto: siempre de la red
  if (url.endsWith('sw.js') || url.endsWith('manifest.json')) {
    e.respondWith(fetch(e.request, { cache: 'no-store' }).catch(() => caches.match(e.request)));
    return;
  }

  // La app (HTML): red con revalidación; si tarda, la copia guardada al momento y la nueva por detrás
  if (e.request.mode === 'navigate' || url.endsWith('.html') || url.endsWith('/')) {
    const clave = new Request(url.split('#')[0].split('?')[0]);
    let tarde = false;
    const previa = caches.match(clave).then(r => huella(r), () => '');   // la versión guardada al empezar
    const red = fetch(e.request, { cache: 'no-cache' }).then(async res => {
      if (res && res.ok) {
        const cache = await caches.open(CACHE);
        await cache.put(clave, res.clone());
        const h0 = await previa;
        if (tarde && h0 && h0 !== huella(res)) await avisarNuevaVersion();
      }
      return res;
    });
    e.waitUntil(red.then(() => {}, () => {}));
    e.respondWith((async () => {
      const guardada = await caches.match(clave);
      if (!guardada) return red.catch(() => caches.match(clave));
      const r = await Promise.race([red.catch(() => null), new Promise(ok => setTimeout(() => ok('tarde'), 3500))]);
      if (r && r !== 'tarde') return r;
      tarde = true;
      return guardada;
    })());
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
