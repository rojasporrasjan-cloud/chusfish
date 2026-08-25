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
const fs   = require('fs');
const path = require('path');
const url  = require('url');

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
  let rel = decodeURIComponent(pathname);
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
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Content-Length': st.size,
      // En desarrollo nunca cacheamos: si no, editas y no ves el cambio.
      'Cache-Control': 'no-store, must-revalidate',
    });
    fs.createReadStream(file).pipe(res);
  };

  tryNext(0);
}

http.createServer((req, res) => {
  const pathname = url.parse(req.url).pathname || '/';
  const target = emulatorTarget(pathname);
  if (target) proxy(req, res, target);
  else serveStatic(req, res, pathname);
}).listen(PORT, () => {
  console.log('');
  console.log('  Chus\'s Fish — desarrollo local');
  console.log('  ────────────────────────────────────────');
  console.log('  Sitio        http://localhost:' + PORT);
  console.log('  Mi cuenta    http://localhost:' + PORT + '/mi-cuenta.html');
  console.log('  Premios      http://localhost:' + PORT + '/premios.html');
  console.log('  Admin        http://localhost:' + PORT + '/admin.html');
  console.log('  Emulador UI  http://127.0.0.1:4000');
  console.log('');
  console.log('  Firestore y Auth van por proxy en este mismo puerto.');
  console.log('');
});
