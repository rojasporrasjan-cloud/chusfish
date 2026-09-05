/* El pedido tiene que dejar el teléfono y la dirección en el perfil.
 *
 * Es la tercera vez que el mismo patrón muerde en este proyecto: se lanza
 * una escritura a Firestore y acto seguido se hace `location.href = waLink`.
 * Al abrir WhatsApp el navegador del celular congela la página y la
 * escritura, que iba a medias, se muere. Pasó con el pedido, pasó con la
 * reserva del cupón, y pasó con los datos del perfil.
 *
 * El síntoma es silencioso: el pedido llega bien, nadie se queja, y la
 * persona simplemente tiene que volver a escribir su dirección en cada
 * pedido. Por eso hace falta una prueba: a ojo no se ve.
 *
 * ── LO QUE ESTA PRUEBA **NO** HACE ──────────────────────────────────
 * NO reproduce el congelamiento del celular. Se comprobó: quitando el
 * `await` del guardado, esta prueba sigue pasando, porque en Chromium con
 * la ruta de wa.me interceptada la página no se congela y la escritura
 * suelta llega igual. Confiar en la parte de punta a punta para vigilar
 * ese fallo sería engañarse.
 *
 * Por eso van dos partes:
 *   1. La estructural, que sí lo caza: mira el código y exige que el
 *      guardado del perfil se espere antes de irse a WhatsApp.
 *   2. La de punta a punta, que comprueba que la función sirve: los datos
 *      quedan, el siguiente pedido viene lleno y la guía se marca.
 *
 * Necesita el emulador y el servidor local. Corré `npm run seed` antes.
 *
 *   node herramientas/probar-datos-en-perfil.js
 */
const { chromium, devices } = require('playwright');
const fs = require('fs');
const path = require('path');
const pausa = ms => new Promise(r => setTimeout(r, ms));
const D = 'http://localhost:8080/v1/projects/chus-fish/databases/(default)/documents';
const CORREO = 'datos' + Date.now() + '@test.com';

const TEL = '87654321';
const DIR = 'Del super 200 metros sur, casa verde';

(async () => {
  const b = await chromium.launch();
  let mal = 0; const errs = [];
  const chk = (d, ok, x) => { if (!ok) mal++; console.log('    ' + (ok ? 'OK  ' : 'MAL ') + d + (x ? '   ' + x : '')); };

  /* ── LA PARTE QUE SI CAZA EL FALLO ──────────────────────────────
     Lee el código del formulario de pedido y exige que las tres escrituras
     se esperen antes de la navegación a WhatsApp. Es la única forma fiable
     de vigilarlo: el navegador de escritorio no reproduce el congelamiento
     que las mata en el celular. */
  console.log('  == EL CODIGO ESPERA ANTES DE IRSE A WHATSAPP ==');
  const src = fs.readFileSync(path.join(__dirname, '..', 'catalogo.html'), 'utf8');
  const envio = src.slice(
    src.indexOf("document.getElementById('order-form').addEventListener('submit'"),
    src.indexOf('window.location.href = waLink'));
  chk('el codigo del envio se encontro', envio.length > 500, envio.length + ' caracteres');
  chk('el PEDIDO se espera',   /await\s+guardarPedido\s*\(/.test(envio));
  chk('el CUPON se espera',    /await\s+apartarCupon\s*\(/.test(envio));
  chk('el PERFIL se espera (si no, se reescribe la direccion en cada pedido)',
      /await\s+(perfilGuardado|guardarDatosEnPerfil\s*\()/.test(envio));
  chk('el perfil NO volvio al patron "lanzar y seguir"',
      !/CF\.saveProfile\([^)]*\)\s*\.catch\(\s*\(\s*\)\s*=>\s*\{\s*\}\s*\)\s*;/.test(envio));

  const ctx = await b.newContext({ ...devices['iPhone 12'] });
  const p = await ctx.newPage();
  p.on('pageerror', e => errs.push('JS ' + e.message.slice(0, 100)));
  /* WhatsApp se intercepta: hay que dejar que la navegación OCURRA, porque
     es justo la navegación la que mataba la escritura. */
  await ctx.route('**://wa.me/**', r => r.fulfill({ status: 200, body: 'ok' }));

  /* ── Se registra SIN teléfono ni dirección ── */
  console.log('\n  == SE REGISTRA SIN DATOS ==');
  await p.goto('http://localhost:5000/mi-cuenta.html', { waitUntil: 'commit' });
  await pausa(5000);
  const uid = await p.evaluate(async c => {
    await firebase.auth().signOut().catch(() => {});
    const u = await CF.signUpEmail(c, 'clave1234', 'Datos Perfil', '', '', '');
    return (u && u.uid) || firebase.auth().currentUser.uid;
  }, CORREO);
  await pausa(3500);

  const leerPerfil = async () => {
    const j = await (await fetch(D + '/users/' + uid,
      { headers: { Authorization: 'Bearer owner' }, signal: AbortSignal.timeout(15000) })).json();
    const f = j.fields || {};
    return { tel: (f.phone || {}).stringValue || '', dir: (f.address || {}).stringValue || '' };
  };
  let perfil = await leerPerfil();
  chk('arranca sin telefono ni direccion', !perfil.tel && !perfil.dir,
      JSON.stringify(perfil));

  /* ── Pide, escribiendo sus datos en el formulario ── */
  console.log('\n  == PIDE, ESCRIBIENDO SUS DATOS ==');
  await p.goto('http://localhost:5000/catalogo.html', { waitUntil: 'commit' });
  await pausa(7000);
  await p.evaluate(async d => {
    const x = PRODUCTS.find(q => q.price > 0);
    addToCart(x, 1); openCartOrderForm();
    await new Promise(k => setTimeout(k, 4000));
    ['of-zone-chips', 'of-date-chips', 'of-payment-chips'].forEach(id => {
      const c = document.getElementById(id);
      if (c && !c.querySelector('.selected')) { const t = c.querySelector('.zone-chip,.date-chip'); if (t) t.click(); }
    });
    document.getElementById('of-name').value    = 'Datos Perfil';
    document.getElementById('of-phone').value   = d.tel;
    document.getElementById('of-address').value = d.dir;
    document.getElementById('order-form').requestSubmit();
  }, { tel: TEL, dir: DIR });
  // Le damos el tiempo que le daria una persona: manda y se va a WhatsApp.
  await pausa(12000);

  perfil = await leerPerfil();
  console.log('    perfil despues del pedido: ' + JSON.stringify(perfil));
  chk('EL TELEFONO QUEDO GUARDADO', perfil.tel === TEL, perfil.tel || '(vacio)');
  chk('LA DIRECCION QUEDO GUARDADA', perfil.dir === DIR, perfil.dir || '(vacio)');

  /* ── Y por eso el proximo pedido viene lleno ── */
  console.log('\n  == EL PROXIMO PEDIDO VIENE LLENO ==');
  await p.goto('http://localhost:5000/catalogo.html', { waitUntil: 'commit' });
  await pausa(7000);
  const lleno = await p.evaluate(async () => {
    const x = PRODUCTS.find(q => q.price > 0);
    addToCart(x, 1); openCartOrderForm();
    await new Promise(k => setTimeout(k, 4000));
    return { tel: document.getElementById('of-phone').value,
             dir: document.getElementById('of-address').value };
  });
  chk('el telefono viene puesto', lleno.tel === TEL, lleno.tel || '(vacio)');
  chk('la direccion viene puesta', lleno.dir === DIR, lleno.dir || '(vacio)');

  /* ── Y la guia del perfil ya no se los pide ── */
  console.log('\n  == LA GUIA YA NO SE LOS PIDE ==');
  await p.goto('http://localhost:5000/mi-cuenta.html', { waitUntil: 'commit' });
  await pausa(8000);
  const paso2 = await p.evaluate(() => {
    const pasos = [...document.querySelectorAll('.guia-paso')];
    const d = pasos[1];
    return d ? { ok: d.classList.contains('ok'),
                 txt: (d.querySelector('small') || {}).textContent || '' } : null;
  });
  chk('"Completa tus datos" queda marcado', paso2 && paso2.ok === true,
      paso2 ? paso2.txt : 'no hay guia');

  console.log('\n  errores: ' + (errs.length ? errs.slice(0, 3).join(' | ') : 'ninguno'));
  console.log('  ' + (mal ? '>>> ' + mal + ' FALLARON' : '>>> el pedido deja los datos en el perfil'));
  await b.close();
  process.exit(mal ? 1 : 0);
})();
