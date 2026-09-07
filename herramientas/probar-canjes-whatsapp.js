/* El mensaje de WhatsApp de los canjes, y el desglose del descuento en la
 * factura. Dos cosas que Jesús reportó el mismo día:
 *
 *   "el mensaje de whatsapp de cuando se aprueban canjes no hay mensaje"
 *      — el enlace era wa.me/506XXXX SIN ?text=, así que abría el chat en
 *        blanco y había que escribirlo a mano cada vez. Los pedidos ya
 *        llevaban plantilla; los canjes no.
 *
 *   "en la factura no me saca el desglose con descuentos"
 *      — la factura llamaba a renderInvoice(), que NO EXISTE. Tiraba
 *        ReferenceError, el catch se lo tragaba, y el documento no se
 *        repintaba: el campo mostraba el descuento pero la factura salía
 *        sin él.
 *
 * Necesita el emulador y el servidor local. Corré `npm run seed` antes.
 *
 *   node herramientas/probar-canjes-whatsapp.js
 */
const { chromium } = require('playwright');
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

  /* ── Un pedido con cupón de producto, SIN el monto guardado ──
     Ese es el camino que reventaba: la factura tiene que recalcularlo. */
  const cat = await (await api('/chusfish/catalog')).json();
  const lista = (((cat.fields || {}).products || {}).arrayValue || {}).values || [];
  const prods = lista.map(v => { const f = v.mapValue.fields || {};
    return { id: +((f.id || {}).integerValue || 0), name: (f.name || {}).stringValue || '',
             price: +((f.price || {}).integerValue || 0) };
  }).filter(x => x.price > 0);
  const A = prods[0], B = prods[1];

  await api('/coupons/FACTPROD', { method: 'PATCH', body: JSON.stringify({ fields: {
    type: { stringValue: 'percent' }, value: { integerValue: '20' },
    minOrder: { integerValue: '0' }, maxDiscount: { integerValue: '0' },
    usageLimit: { integerValue: '-1' }, perUserLimit: { integerValue: '0' },
    active: { booleanValue: true }, usedCount: { integerValue: '0' },
    productIds: { arrayValue: { values: [{ integerValue: String(A.id) }] } }
  } }) });

  await api('/orders', { method: 'POST', body: JSON.stringify({ fields: {
    uid: { nullValue: null },
    customer: { mapValue: { fields: {
      name: { stringValue: 'Cliente Factura' }, phone: { stringValue: '88990011' },
      address: { stringValue: 'Casa 1' }, zone: { stringValue: 'San Jose Centro' },
      payment: { stringValue: 'SINPE Móvil' } } } },
    items: { arrayValue: { values: [
      { mapValue: { fields: { id: { integerValue: String(A.id) }, name: { stringValue: A.name },
        qty: { integerValue: '2' }, unit: { stringValue: '/kg' }, price: { integerValue: String(A.price) } } } },
      { mapValue: { fields: { id: { integerValue: String(B.id) }, name: { stringValue: B.name },
        qty: { integerValue: '2' }, unit: { stringValue: '/kg' }, price: { integerValue: String(B.price) } } } }
    ] } },
    deliveryFee: { integerValue: '0' },
    // SIN monto: es lo que obliga a la factura a recalcularlo.
    discount: { mapValue: { fields: { code: { stringValue: 'FACTPROD' },
      type: { stringValue: 'percent' }, value: { integerValue: '20' },
      amount: { integerValue: '0' } } } },
    status: { stringValue: 'confirmado' },
    createdAt: { timestampValue: new Date().toISOString() }
  } }) });

  const pa = await (await b.newContext({ viewport: { width: 1500, height: 1200 } })).newPage();
  pa.on('pageerror', e => errs.push('JS ROTO: ' + e.message.slice(0, 110)));
  pa.on('console', m => { const t = m.text();
    if (m.type() === 'error' && !/client is offline|status of 400/.test(t)) errs.push(t.slice(0, 110)); });
  pa.on('dialog', d => d.accept());

  await pa.goto('http://localhost:5000/admin.html', { waitUntil: 'load', timeout: 60000 });
  await pausa(3500);
  await pa.fill('#login-user', 'chussfish2022@gmail.com');
  await pa.fill('#login-pass', 'admin123');
  await pa.click('#login-btn');
  await pa.waitForFunction(() => firebase.auth().currentUser, { timeout: 30000 });
  await pausa(4000);

  /* ═══ 1. LA FACTURA SACA EL DESGLOSE ═══ */
  console.log('  == 1. LA FACTURA SACA EL DESGLOSE (queja de Jesus) ==');
  await pa.evaluate(() => showView('pedidos'));
  await pausa(3500);
  const fac = await pa.evaluate(async () => {
    const o = orders.filter(x => (x.customer || {}).name === 'Cliente Factura')[0];
    if (!o) return { err: 'no llego el pedido' };
    openInvoice(o.id);
    await new Promise(k => setTimeout(k, 3500));
    const doc = document.getElementById('inv-doc-total-lines');
    return { campo: document.getElementById('inv-discount').value,
             lineas: doc ? doc.innerText.replace(/\s+/g, ' ').trim() : '(sin bloque de totales)',
             total: (document.getElementById('inv-doc-grand') || {}).textContent || '' };
  });
  chk('la factura abre', !fac.err, fac.err || '');
  if (!fac.err) {
    console.log('    ' + fac.lineas + '  ·  total ' + fac.total);
    chk('el campo trae el descuento recalculado', Number(fac.campo) > 0, fac.campo);
    chk('Y LA FACTURA LO MUESTRA', /Descuento/.test(fac.lineas), fac.lineas.slice(0, 60));
    chk('con el codigo del cupon', /FACTPROD/.test(fac.lineas));
    chk('y sobre que se aplico', /en /.test(fac.lineas), fac.lineas);
    chk('el total ya lo resta', /\d/.test(fac.total), fac.total);
  }

  /* ═══ 2. EL WHATSAPP DE LOS CANJES ═══ */
  console.log('\n  == 2. EL WHATSAPP DE LOS CANJES (queja de Jesus) ==');
  const msgs = await pa.evaluate(() => {
    const r = { userName: 'Maria Rodriguez', userPhone: '88881111',
                rewardName: '1/2 kg de Camarón', cost: 4250,
                adminNote: 'Se nos acabó por hoy' };
    const leer = st => {
      const url = waCanjeLink(r, st);
      const t = decodeURIComponent((url.split('?text=')[1] || ''));
      return { url: url.split('?')[0], txt: t };
    };
    return { solicitado: leer('solicitado'), aprobado: leer('aprobado'),
             entregado: leer('entregado'), rechazado: leer('rechazado'),
             sinTel: waCanjeLink({ userName: 'X', rewardName: 'Y', cost: 1 }, 'aprobado') };
  });

  chk('el enlace lleva el numero', /wa\.me\/50688881111/.test(msgs.aprobado.url), msgs.aprobado.url);
  for (const st of ['solicitado', 'aprobado', 'entregado', 'rechazado']) {
    chk('hay mensaje para "' + st + '"', msgs[st].txt.length > 20, '');
    console.log('    ── ' + st + ' ──');
    msgs[st].txt.split('\n').forEach(l => console.log('       ' + l));
  }
  chk('el aprobado dice que va con el proximo pedido',
      /próximo pedido/i.test(msgs.aprobado.txt));
  chk('el aprobado nombra el premio y los puntos',
      /Camarón/.test(msgs.aprobado.txt) && /4.250 puntos/.test(msgs.aprobado.txt));
  chk('el rechazado dice que se devolvieron los puntos',
      /devolvimos/i.test(msgs.rechazado.txt) && /4.250/.test(msgs.rechazado.txt));
  chk('y repite el motivo que escribio Jesus',
      /acabó por hoy/.test(msgs.rechazado.txt));
  chk('sin telefono no arma un enlace roto',
      /web\.whatsapp\.com/.test(msgs.sinTel), msgs.sinTel);

  /* ═══ 3. EL BOTON DE LA TARJETA LO USA ═══ */
  console.log('\n  == 3. EL BOTON DE LA TARJETA LO USA ==');
  await pa.evaluate(() => showView('canjes'));
  await pausa(3500);
  const boton = await pa.evaluate(() => {
    /* SOLO dentro de #rd-list. Buscando en todo el documento se agarraba
       un enlace de la vista de pedidos, que sigue en el DOM aunque este
       escondida, y la prueba culpaba al codigo equivocado. */
    const lista = document.getElementById('rd-list');
    if (!lista) return { hay: false, err: 'no existe #rd-list' };
    const a = [...lista.querySelectorAll('a.order-act-wa')]
      .find(x => /wa\.me/.test(x.getAttribute('href') || ''));
    if (!a) return { hay: false };
    const href = a.getAttribute('href');
    return { hay: true, conTexto: href.indexOf('?text=') >= 0,
             texto: decodeURIComponent((href.split('?text=')[1] || '')).slice(0, 90) };
  });
  chk('hay un boton de WhatsApp en un canje', boton.hay === true);
  if (boton.hay) {
    chk('Y YA NO ABRE EL CHAT EN BLANCO', boton.conTexto === true,
        boton.conTexto ? boton.texto : 'sigue sin ?text=');
  }

  console.log('\n  errores de JS: ' + (errs.length ? [...new Set(errs)].slice(0, 4).join(' | ') : 'ninguno'));
  chk('ni un error de JS en el panel', errs.length === 0, '');
  console.log('  ' + (mal ? '>>> ' + mal + ' FALLARON' : '>>> la factura desglosa y el canje trae mensaje'));
  await b.close();
  process.exit(mal ? 1 : 0);
})();
