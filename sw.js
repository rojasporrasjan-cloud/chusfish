const CACHE_NAME = 'chusfish-v-csp-fix-2';

self.addEventListener('install', (e) => {
  // Fuerza al SW a instalarse inmediatamente
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keyList) => {
      // Borrar todos los cachés anteriores para asegurar frescura
      return Promise.all(keyList.map((key) => caches.delete(key)));
    }).then(async () => {
      // Tomar el control de los clientes abiertos
      await self.clients.claim();
      
      // FORZAR RECARGA EN TODOS LOS CLIENTES ACTIVOS (Evita que la App se quede pegada)
      const clients = await self.clients.matchAll({ type: 'window' });
      clients.forEach(client => {
        // Redirigir a la misma URL fuerza una recarga de red
        if('navigate' in client) {
          client.navigate(client.url);
        }
      });
    })
  );
});

// Estrategia: Red primero (Network First), respaldada por caché
self.addEventListener('fetch', (e) => {
  // Ignorar peticiones que no sean GET (como Firebase/Firestore POSTs)
  if (e.request.method !== 'GET') return;

  e.respondWith(
    fetch(e.request)
      .then((response) => {
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }
        // Clonar para guardar en caché
        const responseToCache = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(e.request, responseToCache);
        });
        return response;
      })
      .catch(() => {
        // Si no hay red, buscar en el caché
        return caches.match(e.request);
      })
  );
});
