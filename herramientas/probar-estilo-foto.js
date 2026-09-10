/* Pasar la foto de un producto al estilo de la casa.
 *
 * Lo que de verdad hay que vigilar acá NO es que la IA dibuje bonito —eso
 * lo juzga un ojo— sino tres cosas que sí se pueden comprobar:
 *
 *  1. QUE LA LLAVE NO ESTÉ EN EL NAVEGADOR. `admin.html` es una página
 *     estática: todo lo que tenga dentro se ve con "ver código fuente".
 *     Una llave de Gemini ahí es una llave regalada, y la factura llega
 *     igual. Tiene que vivir en la función de Netlify.
 *
 *  2. QUE SOLO UN ADMIN PUEDA LLAMARLA. Si no, cualquiera con la URL le
 *     gasta el saldo a Jesús.
 *
 *  3. QUE NO SE GUARDE NADA SOLO. La IA a veces cambia el producto —el
 *     corte, cuántas piezas hay—. Una foto que no corresponde a lo que se
 *     entrega trae reclamos, así que hay que verla y aceptarla.
 *
 * La función se prueba con un doble: no se gasta saldo de Gemini ni hace
 * falta llave para saber si el circuito está bien armado.
 *
 *   node herramientas/probar-estilo-foto.js
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const pausa = ms => new Promise(r => setTimeout(r, ms));

const RAIZ = path.join(__dirname, '..');
/* Un PNG de 1x1 valido, para que el navegador lo pinte sin quejarse. */
const PNG_1x1 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

(async () => {
  const b = await chromium.launch();
  let mal = 0; const errs = [];
  const chk = (d, ok, x) => { if (!ok) mal++; console.log('    ' + (ok ? 'OK  ' : 'MAL ') + d + (x ? '   ' + x : '')); };

  /* ═══ 1. LA LLAVE NO PUEDE ESTAR EN EL NAVEGADOR ═══ */
  console.log('  == 1. LA LLAVE NO VIAJA AL NAVEGADOR ==');
  const publicos = ['admin.html', 'index.html', 'catalogo.html', 'premios.html',
                    'mi-cuenta.html', 'auth.js', 'ui.js'];
  let filtrada = [];
  publicos.forEach(f => {
    const r = path.join(RAIZ, f);
    if (!fs.existsSync(r)) return;
    const t = fs.readFileSync(r, 'utf8');
    /* OJO con no confundirse: la `apiKey` de FIREBASE tambien empieza por
       AIza y es PUBLICA a proposito — la seguridad de Firebase vive en las
       reglas, no en esa llave, y el navegador la necesita para conectarse.
       La de Gemini es lo contrario: un secreto de facturacion. Asi que se
       busca una llave AIza que NO este dentro del bloque de config de
       Firebase, y cualquier mencion a la variable de Gemini con valor. */
    const sinFirebase = t.replace(/apiKey\s*:\s*['"][^'"]+['"]/g, 'apiKey:FIREBASE');
    if (/AIza[0-9A-Za-z_-]{30,}/.test(sinFirebase))
      filtrada.push(f + ': una llave AIza fuera de la config de Firebase');
    if (/GEMINI[_A-Z]*\s*[:=]\s*['"][^'"]{10,}['"]/.test(t))
      filtrada.push(f + ': una llave de Gemini escrita a mano');
  });
  chk('ningun archivo publico lleva la llave', filtrada.length === 0, filtrada.join(' | '));

  const fn = path.join(RAIZ, 'netlify', 'functions', 'estilo-foto.js');
  chk('la funcion de Netlify existe', fs.existsSync(fn));
  const src = fs.existsSync(fn) ? fs.readFileSync(fn, 'utf8') : '';
  chk('la funcion lee la llave del entorno', /process\.env\.GEMINI_API_KEY/.test(src));
  chk('y comprueba que quien llama sea admin', /puedeTransformar\s*\(/.test(src));
  /* No basta con ser admin: Jesus lo es y NO debe poder gastar la API. */
  chk('ADEMAS mira el correo, no solo que sea admin',
      /correosPermitidos\s*\(/.test(src) && /ESTILO_CORREOS/.test(src));
  chk('por defecto solo Jan', /rojasporrasjan@gmail\.com/.test(src));
  /* El estilo tiene que describir el catalogo DE VERDAD (pizarra, hielo,
     limon, lima, eneldo), no el hielo blanco y plano de la langosta. */
  chk('el estilo describe el catalogo de verdad',
      /slate/i.test(src) && /crushed ice/i.test(src) &&
      /lemon/i.test(src) && /lime/i.test(src) && /dill/i.test(src),
      'pizarra + hielo + limon + lima + eneldo');
  chk('y manda NO cambiar el producto',
      /KEEP EXACTLY AS-IS/i.test(src) && /number of pieces/i.test(src));
  chk('el modelo NO es el que se apaga en octubre',
      !/gemini-2\.5-flash-image['"]/.test(src.replace(/\/\*[\s\S]*?\*\//g, '')),
      'gemini-2.5-flash-image cierra el 2-oct-2026');

  const toml = fs.readFileSync(path.join(RAIZ, 'netlify.toml'), 'utf8');
  chk('netlify.toml declara la carpeta de funciones',
      /\[functions\]/.test(toml) && /netlify\/functions/.test(toml));

  /* ═══ 2. EL PANEL: EL CIRCUITO COMPLETO, CON UN DOBLE ═══ */
  console.log('\n  == 2. EL CIRCUITO EN EL PANEL ==');
  const pa = await (await b.newContext({ viewport: { width: 1500, height: 1200 } })).newPage();
  pa.on('pageerror', e => errs.push('JS ROTO: ' + e.message.slice(0, 110)));
  pa.on('console', m => { const t = m.text();
    /* El 503 de la seccion 3 lo provoca esta misma prueba a proposito:
       no es un fallo del panel. */
    if (m.type() === 'error' && !/client is offline|status of 400|status of 503|status of 403/.test(t))
      errs.push(t.slice(0, 110)); });

  /* El doble de la funcion. Guarda lo que le mandaron para poder mirarlo. */
  let loQueLlego = null;
  await pa.route('**/.netlify/functions/estilo-foto', async route => {
    const req = route.request();
    loQueLlego = {
      metodo: req.method(),
      auth: req.headers()['authorization'] || '',
      cuerpo: JSON.parse(req.postData() || '{}'),
    };
    await route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ ok: true, modelo: 'doble',
                             imagen: 'data:image/png;base64,' + PNG_1x1 }) });
  });

  await pa.goto('http://localhost:5000/admin.html', { waitUntil: 'load', timeout: 60000 });
  await pausa(3500);
  await pa.fill('#login-user', 'chussfish2022@gmail.com');
  await pa.fill('#login-pass', 'admin123');
  await pa.click('#login-btn');
  await pa.waitForFunction(() => firebase.auth().currentUser, { timeout: 30000 });
  await pausa(3000);
  await pa.evaluate(() => showView('productos'));
  await pausa(2500);

  /* Se abre un producto que ya tiene foto. */
  const abrio = await pa.evaluate(async () => {
    const p = (products || []).find(x => x.img);
    if (!p) return { err: 'ningun producto con foto' };
    openProductModal(p.id);
    await new Promise(k => setTimeout(k, 1200));
    const btn = document.getElementById('estilo-btn');
    /* La sesion de prueba es la de Jesus, que NO ve el boton — eso esta
       bien y lo comprueba la seccion 4. Aca se prueba el CIRCUITO, asi
       que se fuerza a la vista. Esconder el boton nunca fue la
       proteccion: la puerta esta en el servidor. */
    const veniaEscondido = btn ? btn.style.display === 'none' : null;
    if (btn) btn.style.display = 'inline-flex';
    return { nombre: p.name,
             hayBoton: !!btn,
             veniaEscondido,
             texto: btn ? btn.textContent.trim() : '' };
  });
  console.log('    ' + JSON.stringify(abrio));
  chk('el producto abre', !abrio.err, abrio.err || abrio.nombre);
  chk('hay boton de estilo', abrio.hayBoton === true);
  chk('venia escondido para Jesus (la seccion 4 lo confirma)',
      abrio.veniaEscondido === true, abrio.texto);

  /* Se pulsa. */
  const tras = await pa.evaluate(async () => {
    document.getElementById('estilo-btn').click();
    for (let i = 0; i < 40; i++) {
      const c = document.getElementById('estilo-caja');
      if (c && !c.hidden && c.querySelector('.estilo-par')) break;
      await new Promise(k => setTimeout(k, 300));
    }
    const c = document.getElementById('estilo-caja');
    return {
      abierta: c ? !c.hidden : false,
      dosFotos: c ? c.querySelectorAll('.estilo-col img').length : 0,
      botones: c ? [...c.querySelectorAll('button')].map(x => x.textContent.trim()) : [],
      aviso: c ? (c.querySelector('.estilo-aviso') || {}).innerText || '' : '',
    };
  });
  console.log('    ' + JSON.stringify({ abierta: tras.abierta, dosFotos: tras.dosFotos, botones: tras.botones }));
  chk('llego la peticion a la funcion', !!loQueLlego);
  if (loQueLlego) {
    chk('va por POST', loQueLlego.metodo === 'POST', loQueLlego.metodo);
    chk('LLEVA EL TOKEN del admin', /^Bearer .{20,}/.test(loQueLlego.auth),
        loQueLlego.auth.slice(0, 22) + '…');
    chk('manda la foto de origen',
        !!(loQueLlego.cuerpo.imagenUrl || loQueLlego.cuerpo.imagenBase64),
        Object.keys(loQueLlego.cuerpo).join(', '));
    chk('y el nombre del producto, para no confundir la especie',
        !!loQueLlego.cuerpo.nombre, loQueLlego.cuerpo.nombre);
  }
  chk('se muestran LAS DOS fotos para comparar', tras.dosFotos === 2, tras.dosFotos + '');
  chk('con sus tres botones', tras.botones.length === 3, tras.botones.join(' · '));
  chk('NO se guarda solo: hay que aceptar',
      tras.botones.some(t => /Usar esta/i.test(t)) &&
      tras.botones.some(t => /Dejar la de antes/i.test(t)));
  chk('avisa que la IA puede cambiar el producto',
      /cambia el producto|no es lo mismo/i.test(tras.aviso), tras.aviso.slice(0, 70));

  /* Se acepta: la vista previa cambia y queda un archivo por subir. */
  const acepto = await pa.evaluate(async () => {
    const b = [...document.querySelectorAll('#estilo-caja button')]
      .find(x => /Usar esta/i.test(x.textContent));
    b.click();
    await new Promise(k => setTimeout(k, 800));
    return {
      previa: (document.getElementById('img-preview').src || '').slice(0, 30),
      hayArchivo: !!pendingImgFile,
      tipo: pendingImgFile ? pendingImgFile.type : null,
      cerro: document.getElementById('estilo-caja').hidden,
    };
  });
  console.log('    tras aceptar: ' + JSON.stringify(acepto));
  chk('la vista previa pasa a ser la nueva', /^data:image/.test(acepto.previa), acepto.previa);
  chk('queda lista para subirse al guardar', acepto.hayArchivo === true, String(acepto.tipo));

  /* ═══ 3. SI LA FUNCION SE QUEJA, SE EXPLICA ═══ */
  console.log('\n  == 3. SI FALLA, LO EXPLICA ==');
  await pa.unroute('**/.netlify/functions/estilo-foto');
  await pa.route('**/.netlify/functions/estilo-foto', route =>
    route.fulfill({ status: 503, contentType: 'application/json',
      body: JSON.stringify({ error: 'Falta la llave de Gemini.',
        detalle: 'Ponela en Netlify como GEMINI_API_KEY.' }) }));

  const falla = await pa.evaluate(async () => {
    document.getElementById('estilo-btn').click();
    /* Se espera el mensaje DE VERDAD, no el de "Mandando la foto…": ese
       tambien es .estilo-msg, y salir con el hacia que la prueba leyera
       la pantalla antes de que llegara la respuesta. */
    for (let i = 0; i < 40; i++) {
      const m = document.querySelector('#estilo-caja .estilo-msg');
      if (m && !/Mandando la foto/i.test(m.textContent)) break;
      await new Promise(k => setTimeout(k, 300));
    }
    const c = document.getElementById('estilo-caja');
    return { txt: c ? c.innerText.replace(/\s+/g, ' ') : '',
             botonVive: !document.getElementById('estilo-btn').disabled };
  });
  console.log('    "' + falla.txt.slice(0, 100) + '"');
  chk('dice que falta la llave', /llave de Gemini/i.test(falla.txt), falla.txt.slice(0, 60));
  chk('y dice DONDE ponerla', /Netlify/i.test(falla.txt));
  chk('el boton vuelve a quedar usable', falla.botonVive === true);

  /* ═══ 4. JESUS NO LO VE ═══
     Es admin de verdad, asi que la unica cosa que lo deja fuera es el
     correo. Si esto falla, Jesus le gasta la API a Jan sin querer. */
  console.log('\n  == 4. JESUS NO VE EL CONVERTIDOR ==');
  const quien = await pa.evaluate(() => {
    const u = firebase.auth().currentUser;
    return { correo: u ? u.email : null, puede: puedoTransformarFotos() };
  });
  console.log('    entrando como ' + quien.correo + ' -> puede: ' + quien.puede);
  chk('la sesion de prueba es la de Jesus', quien.correo === 'chussfish2022@gmail.com',
      String(quien.correo));
  chk('Y NO PUEDE transformar fotos', quien.puede === false);

  const escondidos = await pa.evaluate(async () => {
    showView('productos');
    await new Promise(k => setTimeout(k, 2500));
    const bs = [...document.querySelectorAll('[data-estilo]')];
    return { cuantos: bs.length,
             visibles: bs.filter(b => b.style.display !== 'none').length };
  });
  console.log('    ' + JSON.stringify(escondidos));
  chk('los botones de la lista existen pero estan escondidos',
      escondidos.cuantos > 0 && escondidos.visibles === 0,
      escondidos.visibles + ' visibles de ' + escondidos.cuantos);

  /* Y si llama a la funcion A MANO, la funcion lo rechaza. Esconder un
     boton no protege nada: la puerta esta en el servidor. */
  await pa.unroute('**/.netlify/functions/estilo-foto');
  let llegoComoJesus = null;
  await pa.route('**/.netlify/functions/estilo-foto', async route => {
    llegoComoJesus = true;
    await route.fulfill({ status: 403, contentType: 'application/json',
      body: JSON.stringify({ error: 'Esta cuenta no tiene el convertidor de fotos habilitado.' }) });
  });
  const aMano = await pa.evaluate(async () => {
    const u = firebase.auth().currentUser;
    const t = await u.getIdToken();
    const r = await fetch('/.netlify/functions/estilo-foto', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t },
      body: JSON.stringify({ imagenUrl: 'https://ejemplo/x.jpg', nombre: 'X' }),
    });
    return { codigo: r.status, cuerpo: await r.json().catch(() => ({})) };
  });
  console.log('    llamando a mano: ' + JSON.stringify(aMano));
  chk('llamarla a mano la rechaza', aMano.codigo === 403, String(aMano.codigo));
  chk('y dice por que', /no tiene el convertidor/i.test(aMano.cuerpo.error || ''),
      aMano.cuerpo.error);

  console.log('\n  errores de JS: ' + (errs.length ? [...new Set(errs)].slice(0, 3).join(' | ') : 'ninguno'));
  chk('ni un error de JS', errs.length === 0, '');
  console.log('  ' + (mal ? '>>> ' + mal + ' FALLARON' : '>>> el circuito esta bien armado y la llave no se filtra'));
  await b.close();
  process.exit(mal ? 1 : 0);
})();
