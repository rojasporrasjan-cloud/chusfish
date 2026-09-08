/* Los avisos de WhatsApp de cada paso del pedido, y la línea del hero.
 *
 * Lo que había: solo "confirmado" llevaba mensaje. Los botones "En camino"
 * y "Entregado" cambiaban el estado y ya, así que avisarle al cliente
 * había que escribirlo a mano cada vez. Y sin teléfono el enlace salía
 * como wa.me/506 — un chat con un número inválido.
 *
 * OJO con lo que esto NO hace: abre WhatsApp con el mensaje escrito;
 * mandarlo lo hace Jesús. Enviar solo, sin que nadie toque nada, necesita
 * la API de WhatsApp Business, que es otra cosa y se paga.
 *
 * Necesita el emulador y el servidor local. Corré `npm run seed` antes.
 *
 *   node herramientas/probar-avisos-pedido.js
 */
const { chromium, devices } = require('playwright');
const pausa = ms => new Promise(r => setTimeout(r, ms));
const D = 'http://localhost:8080/v1/projects/chus-fish/databases/(default)/documents';
const api = (r, o) => fetch(D + r, Object.assign(
  { headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(15000) }, o || {}))
  .catch(e => { throw new Error('el emulador no contesto (' + e.name + '). Ver LEEME.md'); });

(async () => {
  const b = await chromium.launch();
  let mal = 0; const errs = [];
  const chk = (d, ok, x) => { if (!ok) mal++; console.log('    ' + (ok ? 'OK  ' : 'MAL ') + d + (x ? '   ' + x : '')); };

  const cat = await (await api('/chusfish/catalog')).json();
  const lista = (((cat.fields || {}).products || {}).arrayValue || {}).values || [];
  const P = lista.map(v => { const f = v.mapValue.fields || {};
    return { id: +((f.id || {}).integerValue || 0), name: (f.name || {}).stringValue || '',
             price: +((f.price || {}).integerValue || 0) };
  }).filter(x => x.price > 0)[0];

  const mk = (nombre, tel, estado) => api('/orders', { method: 'POST', body: JSON.stringify({ fields: {
    uid: { nullValue: null },
    customer: { mapValue: { fields: Object.assign({
      name: { stringValue: nombre }, address: { stringValue: 'Casa 1' },
      zone: { stringValue: 'San Jose Centro' }, fecha: { stringValue: 'Mié 10 Sep' },
      payment: { stringValue: 'SINPE Móvil' } }, tel ? { phone: { stringValue: tel } } : {}) } },
    items: { arrayValue: { values: [
      { mapValue: { fields: { id: { integerValue: String(P.id) }, name: { stringValue: P.name },
        qty: { integerValue: '2' }, unit: { stringValue: '/kg' }, price: { integerValue: String(P.price) } } } }
    ] } },
    deliveryFee: { integerValue: '0' },
    status: { stringValue: estado },
    createdAt: { timestampValue: new Date().toISOString() }
  } }) });

  await mk('Ana Pendiente', '88991122', 'pendiente');
  await mk('Beto Confirmado', '88993344', 'confirmado');
  await mk('Caro EnCamino', '88995566', 'en_camino');
  await mk('Dani SinTel', null, 'pendiente');

  const pa = await (await b.newContext({ viewport: { width: 1500, height: 1100 } })).newPage();
  pa.on('pageerror', e => errs.push('JS ROTO: ' + e.message.slice(0, 110)));
  pa.on('console', m => { const t = m.text();
    if (m.type() === 'error' && !/client is offline|status of 400/.test(t)) errs.push(t.slice(0, 110)); });
  await pa.goto('http://localhost:5000/admin.html', { waitUntil: 'load', timeout: 60000 });
  await pausa(3500);
  await pa.fill('#login-user', 'chussfish2022@gmail.com');
  await pa.fill('#login-pass', 'admin123');
  await pa.click('#login-btn');
  await pa.waitForFunction(() => firebase.auth().currentUser, { timeout: 30000 });
  await pausa(4000);
  await pa.evaluate(() => showView('pedidos'));
  await pausa(4000);

  /* ═══ 1. CADA PASO TIENE SU MENSAJE ═══ */
  console.log('  == 1. CADA PASO DEL PEDIDO LLEVA MENSAJE ==');
  const msgs = await pa.evaluate(() => {
    const o = orders.filter(x => (x.customer || {}).name === 'Ana Pendiente')[0];
    if (!o) return { err: 'no llego el pedido' };
    const leer = st => {
      const url = waPedidoLink(o, st);
      return { url: url.split('?')[0],
               txt: decodeURIComponent((url.split('?text=')[1] || '')) };
    };
    return { confirmado: leer('confirmado'), en_camino: leer('en_camino'),
             entregado: leer('entregado'), cancelado: leer('cancelado') };
  });
  chk('el pedido llego al panel', !msgs.err, msgs.err || '');
  if (!msgs.err) {
    for (const st of ['confirmado', 'en_camino', 'entregado', 'cancelado']) {
      chk('hay mensaje para "' + st + '"', msgs[st].txt.length > 25, '');
      console.log('    ── ' + st + ' ──');
      msgs[st].txt.split('\n').forEach(l => console.log('       ' + l));
    }
    /* El de confirmar es CORTO a proposito: el detalle y el monto de
       verdad van en la factura, que es una imagen y se lee mejor. */
    chk('el confirmado dice que quedo confirmado', /confirmado/i.test(msgs.confirmado.txt));
    chk('y que se prepara pronto', /En breve lo preparamos/i.test(msgs.confirmado.txt));
    chk('y que el monto final va segun el peso', /seg\u00fan el peso/i.test(msgs.confirmado.txt));
    chk('NO repite la lista de productos', !/Tu pedido:/.test(msgs.confirmado.txt),
        'el detalle va en la factura');
    chk('lleva la fecha de entrega', /Mié 10 Sep/.test(msgs.confirmado.txt));
    chk('el de en camino lo dice', /en camino/i.test(msgs.en_camino.txt));
    chk('el de entregado agradece', /entregado/i.test(msgs.entregado.txt));
    chk('el de cancelado se disculpa y ofrece rearmarlo',
        /cancelarlo/i.test(msgs.cancelado.txt) && /volvemos a armar/i.test(msgs.cancelado.txt));
  }

  /* ═══ 2. LOS BOTONES LO USAN ═══ */
  console.log('\n  == 2. LOS BOTONES LO USAN ==');
  const bts = await pa.evaluate(() => {
    const buscar = nombre => {
      const cards = [...document.querySelectorAll('.order-card, [class*=order-card]')];
      const c = cards.find(x => (x.innerText || '').indexOf(nombre) >= 0);
      if (!c) return null;
      return [...c.querySelectorAll('a.order-act-btn')].map(a => ({
        txt: a.textContent.trim(),
        conTexto: (a.getAttribute('href') || '').indexOf('?text=') >= 0,
        numero: (a.getAttribute('href') || '').split('?')[0]
      }));
    };
    return { pendiente: buscar('Ana Pendiente'), confirmado: buscar('Beto Confirmado'),
             enCamino: buscar('Caro EnCamino'), sinTel: buscar('Dani SinTel') };
  });
  const tiene = (arr, frag) => (arr || []).find(a => a.txt.indexOf(frag) >= 0);
  const conf = tiene(bts.pendiente, 'Confirmar');
  chk('pendiente: "Confirmar" lleva su texto', conf && conf.conTexto === true, conf ? conf.txt : 'sin boton');
  const cam = tiene(bts.confirmado, 'En camino');
  chk('confirmado: "En camino" lleva su texto', cam && cam.conTexto === true,
      cam ? cam.txt : 'sin boton');
  const ent = tiene(bts.enCamino, 'Entregado');
  chk('en camino: "Entregado" lleva su texto', ent && ent.conTexto === true,
      ent ? ent.txt : 'sin boton');

  /* Se quitaron los dos botones sueltos de WhatsApp: cada paso ya manda su
     mensaje, y la factura en imagen reemplaza al "Texto WA". La tarjeta
     paso de 8 botones a 6. */
  const todos = (bts.confirmado || []).map(a => a.txt);
  const sobran = todos.filter(t => t === '\u{1F4AC} WA' || /Texto WA/.test(t));
  chk('ya no estan los botones sueltos de WhatsApp', sobran.length === 0, sobran.join(', '));
  console.log('    botones que quedan: ' + todos.join(' | '));

  /* ═══ 3. SIN TELÉFONO NO ARMA UN ENLACE ROTO ═══ */
  console.log('\n  == 3. SIN TELEFONO ==');
  const roto = (bts.sinTel || []).find(a => /wa\.me\/506$/.test(a.numero));
  chk('ningun boton apunta a wa.me/506', !roto,
      roto ? roto.txt + ' -> ' + roto.numero : 'ninguno');

  /* ═══ 4. LA LINEA DEL HERO ═══ */
  console.log('\n  == 4. LA LINEA DEBAJO DE "VER CATALOGO" ==');
  const pc = await (await b.newContext({ ...devices['iPhone 12'] })).newPage();
  pc.on('pageerror', e => errs.push('LANDING JS ROTO: ' + e.message.slice(0, 110)));
  await pc.goto('http://localhost:5000/index.html', { waitUntil: 'load', timeout: 60000 });
  await pausa(7000);
  const hero = await pc.evaluate(() => {
    const el = document.getElementById('hero-nota');
    const btn = document.querySelector('.hero-actions .btn-primary');
    if (!el || !btn) return { hay: false };
    const re = el.getBoundingClientRect(), rb = btn.getBoundingClientRect();
    return { hay: true, txt: el.innerText.trim(), debajo: re.top >= rb.bottom - 2 };
  });
  chk('la linea existe', hero.hay === true);
  chk('dice algo', (hero.txt || '').length > 10, hero.txt);
  chk('esta DEBAJO del boton', hero.debajo === true);
  chk('menciona WhatsApp', /WhatsApp/i.test(hero.txt || ''), hero.txt);

  /* Con envío cobrado NO puede prometer que es gratis. */
  const antes = await (await api('/chusfish/config')).json();
  const zonasAntes = ((antes.fields || {}).zones || {}).arrayValue;
  await api('/chusfish/config?updateMask.fieldPaths=shippingFee', { method: 'PATCH',
    body: JSON.stringify({ fields: { shippingFee: { integerValue: '2500' } } }) });
  await pc.reload({ waitUntil: 'load', timeout: 60000 });
  await pausa(7000);
  const conCobro = await pc.evaluate(() =>
    (document.getElementById('hero-nota') || {}).innerText || '');
  chk('con envio cobrado NO promete que es gratis', !/gratis/i.test(conCobro), conCobro);
  await api('/chusfish/config?updateMask.fieldPaths=shippingFee', { method: 'PATCH',
    body: JSON.stringify({ fields: { shippingFee: { integerValue: '0' } } }) });

  console.log('\n  errores de JS: ' + (errs.length ? [...new Set(errs)].slice(0, 4).join(' | ') : 'ninguno'));
  chk('ni un error de JS', errs.length === 0, '');
  console.log('  ' + (mal ? '>>> ' + mal + ' FALLARON' : '>>> cada paso avisa y el hero no miente'));
  await b.close();
  process.exit(mal ? 1 : 0);
})();
