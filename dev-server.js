/* ══════════════════════════════════════════════════════════════
   Chus's Fish — Servidor de desarrollo
   ──────────────────────────────────────────────────────────────
   Sirve los archivos del sitio Y hace de proxy a los emuladores de
   Firebase, todo por el mismo puerto (5000).

   Por que un proxy y no pegarle directo a 8080/9099:
     - un solo origen => nada de CORS ni de puertos sueltos
     - algunos navegadores (y el navegador integrado del editor)
       bloquean conexiones a otros puertos de localhost
     - se arranca todo con un comando y se recuerda una sola URL

   Uso:
     1) npm run emu    (en otra terminal, dejalo corriendo)
     2) npm run dev
     3) abrir http://localhost:5000
   ══════════════════════════════════════════════════════════════ */

const http = require('http');
const zlib = require('zlib');
const fs   = require('fs');
const path = require('path');
const url  = require('url');
const os   = require('os');

function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return '127.0.0.1';
}

const PORT           = Number(process.env.PORT || 5000);
const FIRESTORE_PORT = 8080;
const AUTH_PORT      = 9099;
const ROOT           = __dirname;

const MIME = {
  '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8',
  '.css':'text/css; charset=utf-8',   '.json':'application/json; charset=utf-8',
  '.png':'image/png',  '.jpg':'image/jpeg', '.jpeg':'image/jpeg',
  '.gif':'image/gif',  '.svg':'image/svg+xml', '.webp':'image/webp',
  '.ico':'image/x-icon', '.mp4':'video/mp4', '.webmanifest':'application/manifest+json',
  '.woff':'font/woff', '.woff2':'font/woff2', '.txt':'text/plain; charset=utf-8',
  '.xml':'application/xml; charset=utf-8',
};

/* Que peticiones son de los emuladores y a cual van.
   Auth usa rutas con el nombre del host de Google adentro; Firestore usa
   /v1/... y /google.firestore.v1.Firestore/... (el canal de tiempo real). */
function emulatorTarget(pathname) {
  if (pathname.startsWith('/identitytoolkit.googleapis.com/') ||
      pathname.startsWith('/securetoken.googleapis.com/')) return AUTH_PORT;

  // /emulator/v1/projects/{p}/databases/... es de Firestore;
  // el resto de /emulator/... (config, accounts, oobCodes) es de Auth.
  if (pathname.startsWith('/emulator/')) {
    return pathname.includes('/databases/') ? FIRESTORE_PORT : AUTH_PORT;
  }

  if (pathname.startsWith('/v1/') ||
      pathname.startsWith('/google.firestore.') ||
      pathname.startsWith('/google.firebase.')) return FIRESTORE_PORT;

  return null;
}

function proxy(req, res, port) {
  const headers = Object.assign({}, req.headers);
  headers.host = '127.0.0.1:' + port;

  const up = http.request(
    { host: '127.0.0.1', port, path: req.url, method: req.method, headers },
    (upRes) => {
      res.writeHead(upRes.statusCode, upRes.headers);
      upRes.pipe(res);   // pipe: el canal de tiempo real es streaming
    }
  );

  up.on('error', (e) => {
    res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({
      error: 'No se pudo hablar con el emulador en el puerto ' + port +
             '. Corriste `npm run emu`?',
      detail: e.message,
    }));
  });

  req.pipe(up);
}

function serveStatic(req, res, pathname) {
  let rel = '/index.html';
  try {
    rel = decodeURIComponent(pathname);
  } catch (e) {
    rel = pathname;
  }
  if (rel === '/' || rel === '') rel = '/index.html';

  // No dejar salir de la carpeta del proyecto.
  const file = path.join(ROOT, path.normalize(rel).replace(/^(\.\.[\\/])+/, ''));
  if (!file.startsWith(ROOT)) { res.writeHead(403); res.end('Prohibido'); return; }

  // netlify.toml tiene pretty_urls=true, asi que /premios tiene que servir
  // premios.html igual que en produccion.
  const candidates = path.extname(file) ? [file] : [file, file + '.html'];

  const tryNext = (i) => {
    if (i >= candidates.length) {
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end('<h1>404</h1><p>No existe <code>' + rel + '</code></p>');
      return;
    }
    fs.stat(candidates[i], (err, st) => {
      if (err || !st.isFile()) { tryNext(i + 1); return; }
      send(candidates[i], st);
    });
  };

  const send = (file, st) => {
    const ext  = path.extname(file).toLowerCase();
    const tipo = MIME[ext] || 'application/octet-stream';

    /* Comprimir el texto.
       En produccion Netlify lo hace solo; aca no lo hacia nadie, y el
       telefono se bajaba catalogo.html entero (218 KB) mas auth.js y ui.js
       en CADA navegacion, por WiFi. Con gzip son unos 35 KB.
       Las imagenes y el video quedan fuera: ya vienen comprimidos. */
    const comprimible = /^(text\/|application\/(javascript|json|xml|manifest))/.test(tipo);
    const aceptaGzip  = /\bgzip\b/.test(req.headers['accept-encoding'] || '');

    if (comprimible && aceptaGzip && st.size > 1024) {
      res.writeHead(200, {
        'Content-Type': tipo,
        'Content-Encoding': 'gzip',
        'Vary': 'Accept-Encoding',
        'Cache-Control': 'no-store, must-revalidate',
      });
      fs.createReadStream(file).pipe(zlib.createGzip({ level: 6 })).pipe(res);
      return;
    }

    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Content-Length': st.size,
      // En desarrollo nunca cacheamos: si no, editas y no ves el cambio.
      'Cache-Control': 'no-store, must-revalidate',
    });
    fs.createReadStream(file).pipe(res);
  };

  tryNext(0);
}

const server = http.createServer((req, res) => {
  let pathname = '/';
  try {
    const u = new URL(req.url || '/', 'http://localhost');
    pathname = u.pathname || '/';
  } catch (e) {
    pathname = (req.url || '/').split('?')[0] || '/';
  }
  const target = emulatorTarget(pathname);
  if (target) proxy(req, res, target);
  else serveStatic(req, res, pathname);
});

server.on('error', (err) => {
  console.error('Error en servidor HTTP:', err.message);
});

process.on('uncaughtException', (err) => {
  console.error('Excepción no capturada:', err.message);
});

server.listen(PORT, '0.0.0.0', () => {
  const localIP = getLocalIP();
  console.log('');
  console.log('  Chus\'s Fish — desarrollo local');
  console.log('  ────────────────────────────────────────');
  console.log('  Local (PC):      http://localhost:' + PORT);
  console.log('  Red (Teléfono):  http://' + localIP + ':' + PORT);
  console.log('  Mi cuenta:       http://localhost:' + PORT + '/mi-cuenta.html');
  console.log('  Premios:         http://localhost:' + PORT + '/premios.html');
  console.log('  Admin:           http://localhost:' + PORT + '/admin.html');
  console.log('  Emulador UI:     http://127.0.0.1:4000');
  console.log('');
  console.log('  Firestore y Auth van por proxy en este mismo puerto.');
  console.log('');
});
