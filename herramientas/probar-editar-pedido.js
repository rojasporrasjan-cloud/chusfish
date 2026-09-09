/* Editar un pedido y editar su factura, con los números cuadrando.
 *
 * Dos cosas que reportó Jesús:
 *
 *   1. En la FACTURA, quitar un producto no reajustaba el descuento. Se
 *      calculaba una sola vez al abrir y quedaba congelado como número
 *      fijo: con un cupón del 20% terminaba descontando sobre un pedido
 *      que ya no existía. Regalaba plata.
 *
 *   2. No se podía editar el PEDIDO. Los productos solo se tocaban al
 *      facturar, que es tarde: el cliente llama para cambiar algo mucho
 *      antes, y a Jesús no le quedaba más que rehacerlo a mano.
 *
 * Lo que más importa acá: si el pedido YA acreditó puntos, editarlo tiene
 * que ajustarlos. Sin eso el cliente se queda con los puntos del total
 * viejo y el libro deja de cuadrar.
 *
 * Necesita el emulador y el servidor local. Corré `npm run seed` antes.
 *
 *   node herramientas/probar-editar-pedido.js
 */
const { chromium } = require('playwright');
const pausa = ms => new Promise(r => setTimeout(r, ms));
const D = 'http://localhost:8080/v1/projects/chus-fish/databases/(default)/documents';
const api = (r, o) => fetch(D + r, Object.assign(
  { headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(15000) }, o || {}))
  .catch(e => { throw new Error('el emulador no contesto (' + e.name + '). Ver LEEME.md'); });

const COD = 'EDIT20';

(async () => {
  const b = await chromium.launch();
  let mal = 0; const errs = [];
  const chk = (d, ok, x) => { if (!ok) mal++; console.log('    ' + (ok ? 'OK  ' : 'MAL ') + d + (x ? '   ' + x : '')); };

  const cat = await (await api('/chusfish/catalog')).json();
  const lista = (((cat.fields || {}).products || {}).arrayValue || {}).values || [];
  const P = lista.map(v => { const f = v.mapValue.fields || {};
    return { id: +((f.id || {}).integerValue || 0), name: (f.name || {}).stringValue || '',
             price: +((f.price || {}).integerValue || 0) };
  }).filter(x => x.price > 0);
  const EN_PROMO = P[0], OTRO = P[1];

  /* Un cupon del 20% SOLO sobre el primer producto. */
  await api('/coupons/' + COD, { method: 'PATCH', body: JSON.stringify({ fields: {
    type: { stringValue: 'percent' }, value: { integerValue: '20' },
    minOrder: { integerValue: '0' }, maxDiscount: { integerValue: '0' },
    usageLimit: { integerValue: '-1' }, perUserLimit: { integerValue: '0' },
    active: { booleanValue: true }, usedCount: { integerValue: '0' },
    productIds: { arrayValue: { values: [{ integerValue: String(EN_PROMO.id) }] } }
  } }) });

  const descInicial = Math.round(EN_PROMO.price * 2 * 0.20);
  const crear = async (nombre, uid, estado) => {
    const r = await api('/orders', { method: 'POST', body: JSON.stringify({ fields: {
      uid: uid ? { stringValue: uid } : { nullValue: null },
      customer: { mapValue: { fields: {
        name: { stringValue: nombre }, phone: { stringValue: '88991122' },
        address: { stringValue: 'Casa 1' }, zone: { stringValue: 'San Jose Centro' },
        payment: { stringValue: 'SINPE Móvil' } } } },
      items: { arrayValue: { values: [
        { mapValue: { fields: { id: { integerValue: String(EN_PROMO.id) }, name: { stringValue: EN_PROMO.name },
          qty: { integerValue: '2' }, unit: { stringValue: '/kg' }, price: { integerValue: String(EN_PROMO.price) } } } },
        { mapValue: { fields: { id: { integerValue: String(OTRO.id) }, name: { stringValue: OTRO.name },
          qty: { integerValue: '1' }, unit: { stringValue: '/kg' }, price: { integerValue: String(OTRO.price) } } } }
      ] } },
      deliveryFee: { integerValue: '0' },
      discount: { mapValue: { fields: { code: { stringValue: COD },
        type: { stringValue: 'percent' }, value: { integerValue: '20' },
        amount: { integerValue: String(descInicial) } } } },
      status: { stringValue: estado },
      createdAt: { timestampValue: new Date().toISOString() }
    } }) });
    const j = await r.json();
    return (j.name || '').split('/').pop();
  };

  await crear('Fac Prueba', null, 'confirmado');
  await crear('Ped Prueba', 'cliente-maria', 'confirmado');

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
  await pausa(3500);
  await pa.evaluate(() => showView('pedidos'));
  await pa.waitForFunction(
    () => typeof orders !== 'undefined' &&
          orders.some(o => (o.customer || {}).name === 'Fac Prueba'),
    { timeout: 30000 });
  await pausa(1500);

  console.log('  promo: ' + EN_PROMO.name + ' ₡' + EN_PROMO.price.toLocaleString('es-CR') +
              ' x2  ·  otro: ' + OTRO.name + ' ₡' + OTRO.price.toLocaleString('es-CR'));

  /* ═══ 1. LA FACTURA REAJUSTA EL DESCUENTO ═══ */
  console.log('\n  == 1. EN LA FACTURA, QUITAR UN PRODUCTO REAJUSTA EL DESCUENTO ==');
  const fac = await pa.evaluate(async d => {
    const o = orders.filter(x => (x.customer || {}).name === 'Fac Prueba')[0];
    openInvoice(o.id);
    // Se espera a que llegue el cupon de Firestore.
    for (let i = 0; i < 40; i++) {
      if (invoiceState && invoiceState.cuponData) break;
      await new Promise(k => setTimeout(k, 500));
    }
    const alAbrir = { desc: invoiceState.discount, total: calcInvoiceTotals().total };

    /* Se quita la linea que NO esta en promocion: el descuento no deberia
       moverse, porque su base son solo las lineas del cupon. */
    const iOtro = invoiceState.items.findIndex(i => i.id === d.otro);
    toggleInvoiceItem(iOtro);
    await new Promise(k => setTimeout(k, 700));
    const sinOtro = { desc: invoiceState.discount, total: calcInvoiceTotals().total };

    /* Ahora se quita la que SI esta en promocion: el descuento tiene que
       irse a cero, porque ya no hay sobre que aplicarlo. */
    const iPromo = invoiceState.items.findIndex(i => i.id === d.promo);
    toggleInvoiceItem(iPromo);
    await new Promise(k => setTimeout(k, 700));
    const sinPromo = { desc: invoiceState.discount, total: calcInvoiceTotals().total,
                       campo: document.getElementById('inv-discount').value };

    // Se devuelve la de promocion: el descuento tiene que volver.
    toggleInvoiceItem(iPromo);
    await new Promise(k => setTimeout(k, 700));
    const vuelve = { desc: invoiceState.discount };

    /* Y si Jesus lo escribe A MANO, manda el suyo. */
    const campo = document.getElementById('inv-discount');
    campo.value = '999';
    campo.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise(k => setTimeout(k, 600));
    toggleInvoiceItem(iPromo);            // se vuelve a quitar
    await new Promise(k => setTimeout(k, 700));
    const manual = { desc: invoiceState.discount };
    return { alAbrir, sinOtro, sinPromo, vuelve, manual };
  }, { promo: EN_PROMO.id, otro: OTRO.id });

  console.log('    al abrir:            desc ₡' + fac.alAbrir.desc + '  total ₡' + fac.alAbrir.total);
  console.log('    sin el otro:         desc ₡' + fac.sinOtro.desc + '  total ₡' + fac.sinOtro.total);
  console.log('    sin el de promocion: desc ₡' + fac.sinPromo.desc + '  total ₡' + fac.sinPromo.total);
  chk('al abrir trae el descuento del pedido', fac.alAbrir.desc === descInicial,
      '₡' + fac.alAbrir.desc);
  chk('quitar una linea AJENA al cupon no lo mueve', fac.sinOtro.desc === descInicial,
      '₡' + fac.sinOtro.desc);
  chk('QUITAR LA LINEA DEL CUPON LO PONE EN CERO', fac.sinPromo.desc === 0,
      '₡' + fac.sinPromo.desc + ' (antes se quedaba en ₡' + descInicial + ')');
  chk('y el campo tambien se limpia', !fac.sinPromo.campo || fac.sinPromo.campo === '0',
      String(fac.sinPromo.campo));
  chk('devolver el producto devuelve el descuento', fac.vuelve.desc === descInicial,
      '₡' + fac.vuelve.desc);
  chk('si lo escribe A MANO, no se lo pisan', fac.manual.desc === 999,
      '₡' + fac.manual.desc);

  await pa.evaluate(() => { if (typeof closeInvoice === 'function') closeInvoice(); });
  await pausa(1200);

  /* ═══ 2. EDITAR EL PEDIDO ═══ */
  console.log('\n  == 2. EDITAR EL PEDIDO DESDE EL PANEL ==');
  const ed = await pa.evaluate(async () => {
    const o = orders.filter(x => (x.customer || {}).name === 'Ped Prueba')[0];
    openEditOrder(o.id);
    for (let i = 0; i < 40; i++) {
      if (edPedido && edPedido.cuponData) break;
      await new Promise(k => setTimeout(k, 500));
    }
    return {
      lineas: document.querySelectorAll('#ed-items .ed-row').length,
      haySelector: !!document.getElementById('ed-add-sel'),
      opciones: document.querySelectorAll('#ed-add-sel option').length,
      total: (document.getElementById('ed-total') || {}).textContent,
      desc: document.getElementById('ed-desc').value,
      cupon: (document.getElementById('ed-cupon-lbl') || {}).textContent,
      aviso: (document.getElementById('ed-aviso') || {}).innerText || ''
    };
  });
  console.log('    ' + JSON.stringify(ed));
  chk('muestra los 2 productos', ed.lineas === 2, ed.lineas + ' lineas');
  chk('hay selector para agregar', ed.haySelector && ed.opciones > 1, ed.opciones + ' opciones');
  chk('trae el descuento del cupon', Number(ed.desc) === descInicial, ed.desc);
  chk('dice de que cupon sale', ed.cupon.indexOf(COD) >= 0, ed.cupon);
  chk('AVISA que va a mover los puntos', /ajustan los puntos/i.test(ed.aviso), ed.aviso);

  /* Se quita el producto en promocion: el descuento tiene que irse. */
  const trasQuitar = await pa.evaluate(async d => {
    const i = edPedido.items.findIndex(x => x.id === d.promo);
    edQuitar(i);
    await new Promise(k => setTimeout(k, 600));
    return { lineas: edPedido.items.length, desc: edPedido.desc,
             campo: document.getElementById('ed-desc').value,
             total: document.getElementById('ed-total').textContent };
  }, { promo: EN_PROMO.id });
  console.log('    tras quitar el de promocion: ' + JSON.stringify(trasQuitar));
  chk('queda una linea', trasQuitar.lineas === 1, trasQuitar.lineas + '');
  chk('Y EL DESCUENTO SE VA', trasQuitar.desc === 0, '₡' + trasQuitar.desc);

  /* Se agrega un producto nuevo. */
  const trasAgregar = await pa.evaluate(async d => {
    document.getElementById('ed-add-sel').value = String(d.promo);
    edAgregar();
    await new Promise(k => setTimeout(k, 600));
    return { lineas: edPedido.items.length, desc: edPedido.desc };
  }, { promo: EN_PROMO.id });
  console.log('    tras agregarlo de nuevo: ' + JSON.stringify(trasAgregar));
  chk('vuelve a haber 2 lineas', trasAgregar.lineas === 2, trasAgregar.lineas + '');
  chk('y el descuento vuelve solo', trasAgregar.desc === Math.round(EN_PROMO.price * 0.20),
      '₡' + trasAgregar.desc + ' (1 unidad, no 2)');

  /* ═══ 3. AL GUARDAR, LOS PUNTOS SE AJUSTAN ═══ */
  console.log('\n  == 3. AL GUARDAR SE AJUSTAN LOS PUNTOS ==');
  const usuario = async () => {
    const j = await (await api('/users/cliente-maria')).json();
    const f = j.fields || {};
    return { pts: Number((f.points || {}).integerValue || 0),
             gasto: Number((f.totalSpent || {}).integerValue ||
                           (f.totalSpent || {}).doubleValue || 0) };
  };
  /* Primero se acredita el pedido tal como esta, para tener de donde partir. */
  await pa.evaluate(async () => {
    const o = orders.filter(x => (x.customer || {}).name === 'Ped Prueba')[0];
    await awardPointsForOrder(o.id);
    await new Promise(k => setTimeout(k, 3000));
  });
  await pausa(2500);
  const antes = await usuario();
  console.log('    antes de editar: ' + JSON.stringify(antes));

  /* Maria ya trae puntos y compras del sembrado, asi que lo que se
     comprueba es la DIFERENCIA: cuanto cambio el pedido y cuanto se le
     movio a ella. Comparar contra cero seria comparar con otra cosa. */
  const guardado = await pa.evaluate(async () => {
    const o0 = orders.filter(x => (x.customer || {}).name === 'Ped Prueba')[0];
    const baseAntes = orderAmountForPoints(o0);
    document.getElementById('ed-add-sel').value = '';
    await saveEditOrder();
    await new Promise(k => setTimeout(k, 5000));
    const o = orders.filter(x => (x.customer || {}).name === 'Ped Prueba')[0];
    return { items: (o.items || []).length, desc: (o.discount || {}).amount || 0,
             base: orderAmountForPoints(o), baseAntes };
  });
  console.log('    tras guardar: ' + JSON.stringify(guardado));
  await pausa(3000);
  const despues = await usuario();
  console.log('    despues: ' + JSON.stringify(despues));

  chk('el pedido guardo los productos', guardado.items === 2, guardado.items + '');
  chk('y el descuento nuevo', guardado.desc === Math.round(EN_PROMO.price * 0.20),
      '₡' + guardado.desc);
  const bajoPedido = guardado.baseAntes - guardado.base;
  const bajoGasto  = antes.gasto - despues.gasto;
  const bajoPuntos = antes.pts - despues.pts;
  console.log('    el pedido bajo ₡' + bajoPedido + '  ·  su gasto bajo ₡' + bajoGasto +
              '  ·  sus puntos bajaron ' + bajoPuntos);

  chk('EL TOTAL COMPRADO BAJA LO MISMO QUE EL PEDIDO', bajoGasto === bajoPedido,
      '₡' + bajoGasto + ' vs ₡' + bajoPedido);
  /* Los puntos bajan lo mismo, por el multiplicador de su nivel: se
     comprueba que sea coherente, no un numero fijo que dependa del
     nivel que le toque a Maria ese dia. */
  const sinNivel = Math.floor(bajoPedido / 100);
  chk('LOS PUNTOS BAJAN EN PROPORCION', bajoPuntos >= sinNivel && bajoPuntos <= sinNivel * 1.6,
      bajoPuntos + ' puntos por ₡' + bajoPedido + ' (sin nivel serian ' + sinNivel + ')');
  chk('y no se los regala ni se los cobra de mas', bajoPuntos > 0 && despues.pts >= 0,
      antes.pts + ' -> ' + despues.pts);

  console.log('\n  errores de JS: ' + (errs.length ? [...new Set(errs)].slice(0, 4).join(' | ') : 'ninguno'));
  chk('ni un error de JS', errs.length === 0, '');
  console.log('  ' + (mal ? '>>> ' + mal + ' FALLARON' : '>>> la factura y el pedido se editan bien'));
  await b.close();
  process.exit(mal ? 1 : 0);
})();
