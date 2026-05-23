/* ═══════════════════════════════════════════
   Chus's Fish — Service Worker v4
   Network-first: nunca sirve caché vieja
═══════════════════════════════════════════ */

const CACHE = 'chusfish-v4';

/* Al instalar, limpia todo caché anterior y activa inmediatamente */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k))))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k))))
  );
  self.clients.claim();
});

/* Fetch: siempre red primero, sin cachear */
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
});
