// Service worker desactivado — se auto-elimina y limpia el caché
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k))))
      .then(() => self.registration.unregister())
  );
  self.clients.claim();
});
