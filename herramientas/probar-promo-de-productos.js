/* El aviso de promoción y el cupón por producto, con lo que reportó Jesús.
 *
 * Sus tres quejas, textuales:
 *   1. "no le da un acceso al cliente de ver primero cuáles productos son"
 *      — el aviso solo mostraba foto y nombre si el cupón era de UN
 *        producto. Con varios decía "en productos seleccionados" y ya.
 *   2. "el descuento al hacer la factura dura en aplicarse"
 *      — y peor: la factura calculaba el porcentaje sobre el pedido
 *        ENTERO aunque el cupón fuera de un producto. Regalaba plata.
 *   3. "si el cliente quiere hacer otro pedido del mismo producto no le
 *      aplica el descuento nuevamente"
 *      — el formulario creaba los cupones con "1 uso por cliente".
 *
 * Y una cuarta que él notó sin saber por qué: "en ocasiones sale y otras
 * no". El aviso salía UNA vez por persona y nunca más.
 *
 * Necesita el emulador y el servidor local. Corré `npm run seed` antes.
 *
 *   node herramientas/probar-promo-de-productos.js
 */
const { chromium, devices } = require('playwright');
const pausa = ms => new Promise(r => setTimeout(r, ms));
const D = 'http://localhost:8080/v1/projects/chus-fish/databases/(default)/documents';
const api = (r, o) => fetch(D + r, Object.assign(
  { headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(15000) }, o || {}))
  .catch(e => { throw new Error('el emulador no contesto (' + e.name + '). Ver LEEME.md'); });

const COD = 'PROMOPROD';

(async () => {
  const b = await chromium.launch();
  let mal = 0; const errs = [];
  const chk = (d, ok, x) => { if (!ok) mal++; console.log('    ' + (ok ? 'OK  ' : 'MAL ') + d + (x ? '   ' + x : '')); };

  /* ── Jesús arma la promo con VARIOS productos ── */
  const cat = await (await api('/chusfish/catalog')).json();
  const lista = (((cat.fields || {}).products || {}).arrayValue || {}).values || [];
  const prods = lista.map(v => { const f = v.mapValue.fields || {};
    return { id: +((f.id || {}).integerValue || 0), name: (f.name || {}).stringValue || '',
             price: +((f.price || {}).integerValue || 0) };
  }).filter(x => x.price > 0);
  const elegidos = prods.slice(0, 3);
  console.log('  promo sobre ' + elegidos.length + ' productos: ' +
              elegidos.map(p => p.name).join(', '));

  await api('/coupons/' + COD, { method: 'PATCH', body: JSON.stringify({ fields: {
    type: { stringValue: 'percent' }, value: { integerValue: '20' },
    minOrder: { integerValue: '0' }, maxDiscount: { integerValue: '0' },
    usageLimit: { integerValue: '-1' },
    perUserLimit: { integerValue: '0' },
    firstOrderOnly: { booleanValue: false }, active: { booleanValue: true },
    promo: { booleanValue: true }, usedCount: { integerValue: '0' },
    productIds: { arrayValue: { values: elegidos.map(p => ({ integerValue: String(p.id) })) } }
  } }) });
  await api('/chusfish/config?updateMask.fieldPaths=promoCoupon', { method: 'PATCH',
    body: JSON.stringify({ fields: { promoCoupon: { stringValue: COD } } }) });
  const viejas = await (await api('/coupons/' + COD + '/redemptions')).json();
  for (const d of (viejas.documents || [])) await fetch('http://localhost:8080/v1/' + d.name,
    { method: 'DELETE', headers: { Authorization: 'Bearer owner' } });

  /* Esta prueba recarga el catalogo una docena de veces seguidas y el
     servidor de desarrollo a veces corta una conexion. Cuando eso pasa, la
     pagina se queda sin firebase y tira una cascada de errores que NO son
     del sitio. Se separan de los de verdad en vez de esconderlos: si hubo
     corte, se avisa; si no, cualquier error cuenta. */
  let corte = false;
  const CASCADA = /firebase (compat )?(is not defined|no está cargado)|productosListos is not defined/;
  const anotar = t => {
    if (/ERR_CONNECTION_CLOSED|ERR_ABORTED|ERR_EMPTY_RESPONSE|status of 50\d/.test(t)) { corte = true; return; }
    if (corte && CASCADA.test(t)) return;      // consecuencia del corte
    errs.push(t.slice(0, 110));
  };

  /* El service worker se deja ACTIVO a proposito. Bloquearlo hacia pasar la
     prueba escondiendo un fallo de verdad: el SW interceptaba las lecturas
     de Firestore (en local van por el mismo origen, proxeadas) y el aviso
     de promocion no salia. */
  const ctx = await b.newContext({ ...devices['iPhone 12'] });
  const p = await ctx.newPage();

  /* Ir al catalogo y ESPERAR a que este de verdad. Con un `pausa(9000)` a
     secas, un corte del servidor dejaba la pagina a medias y la prueba
     culpaba al sitio de algo que era del entorno. Se reintenta una vez. */
  const irAlCatalogo = async () => {
    for (let i = 1; i <= 2; i++) {
      try {
        await p.goto('http://localhost:5000/catalogo.html',
                     { waitUntil: 'load', timeout: 60000 });
        await p.waitForSelector('#promo-ov', { timeout: 20000, state: 'attached' });
        return true;
      } catch (e) {
        console.log('    (la pagina llego a medias; se reintenta ' + i + '/2)');
      }
    }
    return false;
  };

  /* ESPERA EL HECHO, NO EL RELOJ. El aviso sale 1,2s despues del load pero
     antes hace DOS lecturas a Firestore (la config y el cupon): con el
     emulador cargado eso puede tardar bastante mas. Con una pausa fija la
     prueba fallaba a ratos, que es peor que no tenerla — enseña a ignorar
     los fallos. Se sondea hasta 25s. */
  const esperarAviso = async (seg = 25) => {
    for (let i = 0; i < seg * 2; i++) {
      if (await p.evaluate(() => {
        const ov = document.getElementById('promo-ov');
        return !!ov && ov.classList.contains('open');
      })) return true;
      await pausa(500);
    }
    return false;
  };

  p.on('pageerror', e => anotar('JS ROTO: ' + e.message));
  p.on('console', m => { const t = m.text();
    if (m.type() === 'error' && !/client is offline|status of 400/.test(t)) anotar(t); });
  await ctx.route('**://wa.me/**', r => r.fulfill({ status: 200, body: 'ok' }));

  /* ═══ 1. EL AVISO DICE CUÁLES SON ═══ */
  console.log('\n  == 1. EL AVISO MUESTRA LOS PRODUCTOS (queja 1 de Jesus) ==');
  await irAlCatalogo();
  await esperarAviso(25);
  const aviso = await p.evaluate(() => {
    const ov = document.getElementById('promo-ov');
    return { abierto: ov ? ov.classList.contains('open') : false,
             txt: ov ? (ov.innerText || '').replace(/\s+/g, ' ').trim() : '',
             items: ov ? [...ov.querySelectorAll('.promo-it')].map(x => ({
               nombre: (x.querySelector('.promo-it-n') || {}).textContent || '',
               precio: (x.querySelector('.promo-it-p') || {}).textContent || '',
               foto: !!x.querySelector('img') })) : [],
             boton: (document.getElementById('promo-usar') || {}).textContent || '' };
  });
  chk('el aviso aparece', aviso.abierto === true, aviso.txt.slice(0, 60));
  chk('LISTA LOS PRODUCTOS, no "productos seleccionados"',
      aviso.items.length === elegidos.length,
      aviso.items.length + ' de ' + elegidos.length);
  chk('con el nombre de cada uno',
      elegidos.every(e => aviso.items.some(i => i.nombre === e.name)),
      aviso.items.map(i => i.nombre).join(' · '));
  chk('con su precio', aviso.items.length > 0 && aviso.items.every(i => /\d/.test(i.precio)),
      aviso.items.map(i => i.precio).join(' · '));
  chk('con su foto', aviso.items.length > 0 && aviso.items.every(i => i.foto));
  chk('el boton invita a verlos', /Ver estos productos/i.test(aviso.boton), aviso.boton);

  /* ═══ 2. "VER ESTOS PRODUCTOS" FILTRA EL CATÁLOGO ═══ */
  console.log('\n  == 2. Y LLEVA A ESOS PRODUCTOS ==');
  const filtro = await p.evaluate(async () => {
    document.getElementById('promo-usar').click();
    await new Promise(k => setTimeout(k, 2200));
    const vis = [...document.querySelectorAll('.p-card:not(.hidden)')].map(c => c.dataset.id);
    const barra = document.getElementById('promo-filtro');
    return { visibles: vis,
             cerrado: !document.getElementById('promo-ov').classList.contains('open'),
             barra: barra && !barra.hidden ? barra.innerText.replace(/\s+/g, ' ').trim() : null,
             pendiente: sessionStorage.getItem('chusfish_cupon_pendiente') };
  });
  chk('el aviso se cierra', filtro.cerrado === true);
  chk('SOLO quedan los productos de la promo',
      filtro.visibles.length === elegidos.length &&
      elegidos.every(e => filtro.visibles.indexOf(String(e.id)) >= 0),
      filtro.visibles.length + ' visibles de ' + elegidos.length);
  chk('avisa que se esta viendo solo un pedazo', !!filtro.barra, filtro.barra || '(sin barra)');
  chk('y el codigo queda guardado', filtro.pendiente === COD, String(filtro.pendiente));

  const salida = await p.evaluate(async () => {
    const btn = document.getElementById('promo-filtro-x');
    if (!btn) return null;
    btn.click();
    await new Promise(k => setTimeout(k, 1400));
    return { visibles: document.querySelectorAll('.p-card:not(.hidden)').length,
             barra: (document.getElementById('promo-filtro') || {}).hidden };
  });
  chk('se puede volver al catalogo entero',
      salida && salida.visibles > elegidos.length && salida.barra === true,
      salida ? salida.visibles + ' productos' : 'no hay salida');

  /* ═══ 3. EL DESCUENTO, SOLO SOBRE ESOS PRODUCTOS ═══ */
  console.log('\n  == 3. EL DESCUENTO SE CALCULA SOBRE SU LINEA ==');
  const cuentas = await p.evaluate(async d => {
    const enPromo = PRODUCTS.find(x => x.id === d.ids[0]);
    const fuera = PRODUCTS.find(x => x.price > 0 && d.ids.indexOf(x.id) < 0);
    addToCart(enPromo, 2); addToCart(fuera, 2);
    openCartOrderForm();
    await new Promise(k => setTimeout(k, 5000));
    return { subtotal: cart.reduce((s, i) => s + i.product.price * i.qty, 0),
             lineaPromo: enPromo.price * 2,
             aplicado: (typeof cuponAplicado !== 'undefined' && cuponAplicado)
               ? cuponAplicado.descuento : null };
  }, { ids: elegidos.map(e => e.id) });
  const esperado = Math.round(cuentas.lineaPromo * 0.20);
  console.log('    pedido ₡' + cuentas.subtotal.toLocaleString('es-CR') +
              ', linea en promo ₡' + cuentas.lineaPromo.toLocaleString('es-CR'));
  chk('se aplico solo, sin escribir el codigo', cuentas.aplicado !== null);
  chk('el 20% es de SU linea, no del pedido', cuentas.aplicado === esperado,
      'esperado ₡' + esperado + ', dio ₡' + cuentas.aplicado);

  /* ═══ 4. SE PUEDE USAR OTRA VEZ (queja 3 de Jesús) ═══ */
  console.log('\n  == 4. SE PUEDE VOLVER A USAR (queja 3 de Jesus) ==');
  await p.goto('http://localhost:5000/mi-cuenta.html', { waitUntil: 'commit', timeout: 60000 });
  await pausa(5500);
  await p.evaluate(async c => {
    await firebase.auth().signOut().catch(() => {});
    await CF.signUpEmail(c, 'clave1234', 'Repite Promo', '88009900', 'Casa azul', '');
  }, 'promo' + Date.now() + '@test.com');
  await pausa(4000);

  async function pedir() {
    await p.goto('http://localhost:5000/catalogo.html', { waitUntil: 'commit', timeout: 60000 });
    await pausa(9000);
    const r = await p.evaluate(async d => {
      const ov = document.getElementById('promo-ov');
      if (ov && ov.classList.contains('open')) document.getElementById('promo-no').click();
      await new Promise(k => setTimeout(k, 600));
      const x = PRODUCTS.find(q => q.id === d.ids[0]);
      addToCart(x, 2); openCartOrderForm();
      await new Promise(k => setTimeout(k, 4500));
      if (!(typeof cuponAplicado !== 'undefined' && cuponAplicado)) {
        document.getElementById('of-coupon').value = d.cod;
        await aplicarCupon();
        await new Promise(k => setTimeout(k, 2500));
      }
      const puesto = (typeof cuponAplicado !== 'undefined' && cuponAplicado)
        ? cuponAplicado.descuento : null;
      const msg = (document.getElementById('of-coupon-msg') || {}).innerText || '';
      const zOp = document.querySelector('#of-zone-list .of-op'); if (zOp) zOp.click();
      const fOp = document.querySelector('#of-date-list .of-op'); if (fOp) fOp.click();
      const pagos = document.getElementById('of-payment-chips');
      if (pagos && !pagos.querySelector('.selected')) {
        const t = pagos.querySelector('.zone-chip'); if (t) t.click();
      }
      document.getElementById('of-name').value = 'Repite Promo';
      document.getElementById('of-phone').value = '88009900';
      document.getElementById('of-address').value = 'Casa azul';
      document.getElementById('order-form').requestSubmit();
      return { puesto, msg: msg.trim() };
    }, { ids: elegidos.map(e => e.id), cod: COD });
    await pausa(12000);
    return r;
  }

  const v1 = await pedir();
  chk('primer pedido: aplica', v1.puesto > 0, v1.puesto ? '-₡' + v1.puesto : v1.msg);
  const v2 = await pedir();
  chk('SEGUNDO PEDIDO DEL MISMO PRODUCTO: TAMBIEN APLICA', v2.puesto > 0,
      v2.puesto ? '-₡' + v2.puesto : 'lo rechazo: "' + v2.msg + '"');
  const v3 = await pedir();
  chk('y un tercero', v3.puesto > 0,
      v3.puesto ? '-₡' + v3.puesto : 'lo rechazo: "' + v3.msg + '"');

  /* ═══ 5. EL AVISO VUELVE (la queja que no supo nombrar) ═══
     Ojo con el orden: tras enviar un pedido la pagina queda en wa.me, que
     es OTRO origen y por lo tanto otro localStorage. Hay que volver al
     catalogo ANTES de tocar la marca, o se escribe en el store equivocado
     y la prueba miente. */
  console.log('\n  == 5. EL AVISO VUELVE AL DIA SIGUIENTE ==');
  const abierto = () => p.evaluate(() => {
    const ov = document.getElementById('promo-ov');
    return ov ? ov.classList.contains('open') : null;
  });

  chk('el catalogo carga entero', await irAlCatalogo());
  // 12s de margen: si no salio en ese rato, es que de verdad no sale.
  chk('el mismo dia NO vuelve a molestar', (await esperarAviso(12)) === false);

  // Se envejece la marca a mano: es lo mismo que volver mañana.
  await p.evaluate(c => localStorage.setItem('chusfish_promo_' + c, '2020-01-01'), COD);
  const marca = await p.evaluate(c => localStorage.getItem('chusfish_promo_' + c), COD);
  chk('la marca quedo envejecida', marca === '2020-01-01', String(marca));
  chk('el catalogo vuelve a cargar entero', await irAlCatalogo());
  chk('con la marca de ayer, VUELVE a salir', await esperarAviso(25),
      'marca al volver: ' + await p.evaluate(c =>
        localStorage.getItem('chusfish_promo_' + c), COD));

  /* ═══ 5b. EL SEGMENTO DE DESCUENTOS DEL CATALOGO ═══
     El aviso sale una vez al dia y el carrito CONSUME el codigo guardado.
     Al segundo pedido del mismo dia no habia forma de volver a aplicarlo
     sin escribirlo a mano: Jesus lo vio como "solo se puede usar 1 vez
     porque ya no aparece mas". Este segmento esta siempre. */
  console.log('\n  == 5b. EL SEGMENTO DE DESCUENTOS, SIEMPRE A MANO ==');
  const seg = await p.evaluate(() => {
    const sec = document.getElementById('descuentos-section');
    const sep = document.getElementById('descuentos-sep');
    if (!sec) return { hay: false };
    const cards = [...sec.querySelectorAll('.desc-card')];
    return { hay: true,
             visible: sec.style.display !== 'none' && sep.style.display !== 'none',
             cuantos: cards.length,
             txt: sec.innerText.replace(/\s+/g, ' ').trim(),
             boton: (cards[0] && cards[0].querySelector('.desc-btn').textContent) || '' };
  });
  chk('el segmento existe y se ve', seg.hay && seg.visible === true, seg.txt.slice(0, 70));
  chk('muestra el descuento', /20%/.test(seg.txt), seg.txt.slice(0, 60));
  chk('dice sobre cuantos productos', /3 productos/.test(seg.txt), seg.txt.slice(0, 80));
  chk('y que se puede repetir', /las veces que quieras/i.test(seg.txt), seg.txt.slice(0, 110));
  chk('lleva el codigo a la vista', seg.txt.indexOf(COD) >= 0);

  /* Lo que de verdad importa: que sirva para volver a pedir. */
  const usar = await p.evaluate(async () => {
    sessionStorage.removeItem('chusfish_cupon_pendiente');   // como tras un pedido
    const btn = document.querySelector('#descuentos-section .desc-btn');
    if (!btn) return { err: 'sin boton' };
    btn.click();
    await new Promise(k => setTimeout(k, 2000));
    return { pendiente: sessionStorage.getItem('chusfish_cupon_pendiente'),
             etiqueta: btn.textContent.trim(),
             visibles: document.querySelectorAll('.p-card:not(.hidden)').length };
  });
  chk('el boton deja el codigo listo OTRA VEZ', usar.pendiente === COD, String(usar.pendiente));
  chk('y avisa que quedo puesto', /listo/i.test(usar.etiqueta), usar.etiqueta);
  chk('y filtra a los productos de la promo', usar.visibles === elegidos.length,
      usar.visibles + ' visibles de ' + elegidos.length);

  /* ═══ 6. LA FACTURA DE JESUS (queja 2) ═══ */
  console.log('\n  == 6. LA FACTURA CALCULA SOBRE LA LINEA, NO EL PEDIDO ==');
  const pa = await (await b.newContext({ viewport: { width: 1500, height: 1000 } })).newPage();
  pa.on('pageerror', e => errs.push('ADMIN JS ROTO: ' + e.message.slice(0, 110)));
  pa.on('dialog', d => d.accept());
  await pa.goto('http://localhost:5000/admin.html', { waitUntil: 'commit', timeout: 60000 });
  await pausa(4000);
  await pa.fill('#login-user', 'chussfish2022@gmail.com');
  await pa.fill('#login-pass', 'admin123');
  await pa.click('#login-btn');
  await pa.waitForFunction(() => firebase.auth().currentUser, { timeout: 30000 });
  await pausa(4000);
  await pa.evaluate(() => showView('pedidos'));
  await pausa(3500);

  const fac = await pa.evaluate(async d => {
    const o = orders.filter(x => (x.customer || {}).name === 'Repite Promo')[0];
    if (!o) return { err: 'no llego el pedido' };

    /* Se le mete una linea que NO esta en el cupon. Sin eso el pedido es
       todo promocion, los dos calculos dan igual y la prueba pasaria
       aunque la factura siguiera cobrando sobre el pedido entero. */
    o.items = (o.items || []).concat([{ id: d.fuera.id, name: d.fuera.name,
                                        qty: 2, unit: '/kg', price: d.fuera.price }]);

    const sub = (o.items || []).reduce((a, i) => a + (i.qty || 0) * (i.price || 0), 0);
    const enPromo = (o.items || []).reduce(
      (a, i) => d.ids.indexOf(i.id) >= 0 ? a + (i.qty || 0) * (i.price || 0) : a, 0);

    /* Se vacia el monto que trae el pedido para forzar el camino que Jesus
       vio: la factura recalculando el descuento a partir del cupon. */
    o.discount = { code: d.cod, type: 'percent', value: 20, amount: 0 };
    openInvoice(o.id);
    await new Promise(k => setTimeout(k, 3500));
    return { sub, enPromo, campo: document.getElementById('inv-discount').value,
             estado: invoiceState.discount };
  }, { ids: elegidos.map(e => e.id), cod: COD,
       fuera: prods.filter(x => elegidos.every(e => e.id !== x.id))[0] });

  chk('la factura abre con el pedido', !fac.err, fac.err || '');
  if (!fac.err) {
    const bien = Math.round(fac.enPromo * 0.20);
    const mal20 = Math.round(fac.sub * 0.20);
    console.log('    pedido ₡' + fac.sub.toLocaleString('es-CR') +
                ', en promo ₡' + fac.enPromo.toLocaleString('es-CR'));
    console.log('    la factura puso ₡' + Number(fac.campo || 0).toLocaleString('es-CR'));
    chk('el descuento es el 20% de SU LINEA', Number(fac.estado) === bien,
        'esperado ₡' + bien + ', puso ₡' + fac.estado);
    chk('NO es el 20% del pedido entero', Number(fac.estado) !== mal20 || bien === mal20,
        '20% del pedido serian ₡' + mal20);
    chk('y se ve en el campo', Number(fac.campo) === bien, String(fac.campo));
  }

  if (corte) {
    console.log('\n  (el servidor local cortó alguna conexión durante la corrida;');
    console.log('   sus errores en cascada no se cuentan — no son del sitio)');
  }
  console.log('  errores de JS: ' + (errs.length ? [...new Set(errs)].slice(0, 4).join(' | ') : 'ninguno'));
  chk('ni un error de JS', errs.length === 0, '');
  console.log('  ' + (mal ? '>>> ' + mal + ' FALLARON' : '>>> la promo por productos funciona'));
  await b.close();
  process.exit(mal ? 1 : 0);
})();
