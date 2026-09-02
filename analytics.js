/* ══════════════════════════════════════════════════════════════════
   CHUS'S FISH — MEDICION DE VISITAS
   ─────────────────────────────────────────────────────────────────
   PARA ENCENDERLO (una sola vez, ~5 minutos):

   1. Entrar a analytics.google.com con la cuenta del negocio.
   2. Crear una propiedad para chusfish.com.
   3. Copiar el "ID de medición". Empieza con G- y sigue con letras
      y numeros (por ejemplo G-ABC1234XYZ).
   4. Pegarlo aca abajo, entre las comillas, reemplazando el vacio.

   Eso es todo: las 5 paginas ya cargan este archivo.

   Mientras esta vacio NO se descarga nada de Google — la pagina no
   pesa ni un byte mas y no se recolecta ningun dato.

   ─────────────────────────────────────────────────────────────────
   SEARCH CONSOLE (para ver como aparece el sitio en Google):
   search.google.com/search-console → agregar chusfish.com. Verificar
   por DNS es lo mas simple con Netlify. Despues, en "Sitemaps",
   enviar:  https://chusfish.com/sitemap.xml
   ══════════════════════════════════════════════════════════════════ */

(function () {
  var ID = '';        // <<< PEGAR AQUI EL ID (ejemplo: 'G-ABC1234XYZ')

  if (!ID) return;                       // apagado: no carga nada
  if (location.hostname !== 'chusfish.com' &&
      location.hostname !== 'www.chusfish.com') return;  // no medir pruebas locales

  var s = document.createElement('script');
  s.async = true;
  s.src = 'https://www.googletagmanager.com/gtag/js?id=' + ID;
  document.head.appendChild(s);

  window.dataLayer = window.dataLayer || [];
  function gtag(){ dataLayer.push(arguments); }
  window.gtag = gtag;
  gtag('js', new Date());
  gtag('config', ID, { anonymize_ip: true });
})();
