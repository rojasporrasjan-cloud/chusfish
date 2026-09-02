/* ══════════════════════════════════════════════════════════════
   Chus's Fish — Service Worker
   ──────────────────────────────────────────────────────────────
   Estrategia: RED PRIMERO, caché como respaldo.
   Para una tienda es lo correcto: precios y disponibilidad cambian
   todos los días, así que nunca se sirve una página vieja si hay red.

   ⚠️ Al tocar este archivo hay que subir CACHE_VERSION.
   ══════════════════════════════════════════════════════════════ */

const CACHE_VERSION = 'chusfish-v2';

/* Lo que vale la pena tener guardado para cuando no hay red. Los productos
   vienen de Firestore y NO se pueden cachear acá, así que sin internet se ve
   el marco del sitio, no el catálogo. */
const BASICOS = [
  '/',
  '/index.html',
  '/catalogo.html',
  '/logo-256.jpg',
  '/manifest.json',
];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_VERSION)
      .then((c) => c.addAll(BASICOS))
      .catch(() => {})   // si alguno falla, el SW se instala igual
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    /* Se borran SOLO los cachés de versiones anteriores.
       Antes se borraban todos, incluido el que se acababa de crear: el sitio
       quedaba sin nada guardado justo después de cada publicación, que es
       cuando más falta hace. */
    const claves = await caches.keys();
    await Promise.all(
      claves.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))
    );

    await self.clients.claim();

    /* Antes, al activarse, este SW recargaba a la fuerza TODAS las pestañas
       abiertas (`client.navigate(client.url)`). Si alguien estaba llenando el
       formulario de pedido —nombre, teléfono, dirección— se le borraba todo
       en medio de la compra, sin explicación.

       Ahora solo se avisa. La página decide: si no hay nada escrito, se
       recarga sola; si el cliente está escribiendo, se le muestra un aviso
       para que recargue cuando quiera. */
    const clientes = await self.clients.matchAll({ type: 'window' });
    clientes.forEach((c) => c.postMessage({ tipo: 'sw-actualizado', version: CACHE_VERSION }));
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;

  // Solo GET. Los POST de Firestore/Auth no pasan por acá.
  if (req.method !== 'GET') return;

  // Nada de otros dominios: Firestore, Cloudinary y las fuentes se manejan
  // solas y guardarlas acá solo llenaría el caché.
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  e.respondWith((async () => {
    try {
      const res = await fetch(req);
      if (res && res.status === 200 && res.type === 'basic') {
        const copia = res.clone();
        caches.open(CACHE_VERSION).then((c) => c.put(req, copia)).catch(() => {});
      }
      return res;
    } catch (err) {
      // Sin red: lo que haya guardado.
      const guardado = await caches.match(req);
      if (guardado) return guardado;
      // Si es una navegación y no hay nada, al menos la portada.
      if (req.mode === 'navigate') {
        const inicio = await caches.match('/index.html');
        if (inicio) return inicio;
      }
      throw err;
    }
  })());
});
