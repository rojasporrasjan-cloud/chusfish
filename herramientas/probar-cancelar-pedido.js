/* Cancelar un pedido tiene que deshacerlo TODO, no solo los puntos.
 *
 * El fallo que motivó esta prueba: al cancelar se devolvían los puntos y se
 * liberaba el cupón, pero `ordersCount` quedaba en 1. Con eso el cliente
 * dejaba de ser "primera compra", así que el cupón de bienvenida que la
 * cancelación acababa de liberar **no se podía usar**. Se lo devolvíamos
 * con una mano y se lo bloqueábamos con la otra. `totalSpent` también
 * quedaba inflado, y la guía del perfil daba por hecho un pedido caído.
 *
 * Necesita el emulador y el servidor local. Corré `npm run seed` antes.
 *
 *   node herramientas/probar-cancelar-pedido.js
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

  /* El cupon de bienvenida, igual que en produccion */
  await api('/coupons/BIENVENIDO', { method: 'PATCH', body: JSON.stringify({ fields: {
    type: { stringValue: 'percent' }, value: { integerValue: '5' },
    minOrder: { integerValue: '0' }, maxDiscount: { integerValue: '0' },
    usageLimit: { integerValue: '-1' }, perUserLimit: { integerValue: '1' },
    firstOrderOnly: { booleanValue: true }, active: { booleanValue: true },
    welcome: { booleanValue: true }, usedCount: { integerValue: '0' } } }) });
  await api('/chusfish/config?updateMask.fieldPaths=welcomeCoupon', { method: 'PATCH',
    body: JSON.stringify({ fields: { welcomeCoupon: { stringValue: 'BIENVENIDO' } } }) });
  for (const sub of ['redemptions', 'orders']) {
    const q = await (await api('/coupons/BIENVENIDO/' + sub)).json();
    for (const d of (q.documents || [])) await fetch('http://localhost:8080/v1/' + d.name,
      { method: 'DELETE', headers: { Authorization: 'Bearer owner' } });
  }

  const usuario = async uid => {
    const j = await (await api('/users/' + uid)).json();
    const f = j.fields || {};
    const n = k => Number((f[k] || {}).integerValue || (f[k] || {}).doubleValue || 0);
    return { pts: n('points'), lp: n('lifetimePoints'),
             pedidos: n('ordersCount'), gasto: n('totalSpent') };
  };
  const reservas = async () => {
    const j = await (await api('/coupons/BIENVENIDO/redemptions')).json();
    return (j.documents || []).map(d => d.name.split('/').pop());
  };

  const ctx = await b.newContext({ ...devices['iPhone 12'] });
  const p = await ctx.newPage();
  p.on('pageerror', e => errs.push('JS ' + e.message.slice(0, 100)));
  await ctx.route('**://wa.me/**', r => r.fulfill({ status: 200, body: 'ok' }));

  /* ── 1. Se registra y pide con el cupon ── */
  console.log('  == PIDE CON EL CUPON DE BIENVENIDA ==');
  await p.goto('http://localhost:5000/mi-cuenta.html', { waitUntil: 'commit' });
  await pausa(5500);
  const uid = await p.evaluate(async c => {
    await firebase.auth().signOut().catch(() => {});
    const u = await CF.signUpEmail(c, 'clave1234', 'Cancela Prueba', '', '', '');
    return (u && u.uid) || firebase.auth().currentUser.uid;
  }, 'cancela' + Date.now() + '@test.com');
  await pausa(4500);
  const cero = await usuario(uid);
  chk('arranca en cero', cero.pts === 0 && cero.pedidos === 0 && cero.gasto === 0,
      JSON.stringify(cero));

  await p.goto('http://localhost:5000/catalogo.html', { waitUntil: 'commit' });
  await pausa(8000);
  const cup = await p.evaluate(async () => {
    const x = PRODUCTS.filter(q => q.price > 0).sort((a, b) => a.price - b.price)[0];
    addToCart(x, 2); openCartOrderForm();
    await new Promise(k => setTimeout(k, 4500));
    const btn = document.querySelector('.cupon-mio-btn');
    if (btn && !btn.disabled) { btn.click(); await new Promise(k => setTimeout(k, 3000)); }
    ['of-zone-chips','of-date-chips','of-payment-chips'].forEach(id => {
      const c = document.getElementById(id);
      if (c && !c.querySelector('.selected')) { const t = c.querySelector('.zone-chip,.date-chip'); if (t) t.click(); }
    });
    document.getElementById('of-name').value = 'Cancela Prueba';
    document.getElementById('of-phone').value = '84443333';
    document.getElementById('of-address').value = 'Calle vieja';
    return (typeof cuponAplicado !== 'undefined' && cuponAplicado) ? cuponAplicado.codigo : null;
  });
  chk('usa el cupon', cup === 'BIENVENIDO', String(cup));
  await p.evaluate(() => document.getElementById('order-form').requestSubmit()).catch(() => {});
  await pausa(12000);
  chk('el cupon queda apartado', (await reservas()).indexOf(uid) >= 0);

  /* ── 2. Jesus confirma ── */
  console.log('\n  == JESUS CONFIRMA ==');
  const pa = await (await b.newContext({ viewport: { width: 1500, height: 1000 } })).newPage();
  pa.on('pageerror', e => errs.push('ADMIN ' + e.message.slice(0, 100)));
  pa.on('dialog', d => d.accept());
  await pa.goto('http://localhost:5000/admin.html', { waitUntil: 'commit' });
  await pausa(3500);
  await pa.fill('#login-user', 'chussfish2022@gmail.com');
  await pa.fill('#login-pass', 'admin123');
  await pa.click('#login-btn');
  await pa.waitForFunction(() => firebase.auth().currentUser, { timeout: 30000 });
  await pausa(4000);
  await pa.evaluate(() => showView('pedidos'));
  await pausa(3000);

  const conf = await pa.evaluate(async u => {
    const o = orders.filter(x => x.uid === u)[0];
    if (!o) return { err: 'no llego el pedido' };
    await setOrderStatus(o.id, 'confirmado');
    await new Promise(r => setTimeout(r, 6000));
    return { id: o.id };
  }, uid);
  chk('el pedido llego al panel', !conf.err, conf.err || '');
  await pausa(2000);
  const conPuntos = await usuario(uid);
  console.log('    ' + JSON.stringify(conPuntos));
  chk('le acredita puntos', conPuntos.pts > 0, conPuntos.pts + ' pts');
  chk('le cuenta el pedido', conPuntos.pedidos === 1);
  chk('le suma al total comprado', conPuntos.gasto > 0, String(conPuntos.gasto));

  /* ── 3. Y lo cancela ── */
  console.log('\n  == Y LO CANCELA: TIENE QUE DESHACERSE TODO ==');
  await pa.evaluate(async id => {
    await setOrderStatus(id, 'cancelado');
    await new Promise(r => setTimeout(r, 7000));
  }, conf.id);
  await pausa(3000);
  const fin = await usuario(uid);
  console.log('    ' + JSON.stringify(fin));
  chk('devuelve los puntos', fin.pts === 0, String(fin.pts));
  chk('devuelve los acumulados (el nivel baja)', fin.lp === 0, String(fin.lp));
  chk('BAJA ordersCount', fin.pedidos === 0, 'quedo en ' + fin.pedidos);
  chk('BAJA totalSpent', fin.gasto === 0, 'quedo en ' + fin.gasto);
  chk('libera el cupon', (await reservas()).indexOf(uid) < 0);

  /* ── 4. Lo que de verdad importa: puede volver a usarlo ── */
  console.log('\n  == VUELVE A SER PRIMERA COMPRA ==');
  await p.goto('http://localhost:5000/catalogo.html', { waitUntil: 'commit' });
  await pausa(9000);
  const otra = await p.evaluate(async () => {
    const x = PRODUCTS.filter(q => q.price > 0).sort((a, b) => a.price - b.price)[0];
    addToCart(x, 2); openCartOrderForm();
    await new Promise(k => setTimeout(k, 4500));
    const inp = document.getElementById('of-coupon');
    inp.value = 'BIENVENIDO';
    await aplicarCupon();
    await new Promise(k => setTimeout(k, 3000));
    return { aplicado: (typeof cuponAplicado !== 'undefined' && cuponAplicado) ? cuponAplicado.codigo : null,
             msg: (document.getElementById('of-coupon-msg') || {}).innerText || '' };
  });
  chk('EL CUPON LIBERADO SE PUEDE USAR DE VERDAD', otra.aplicado === 'BIENVENIDO',
      otra.msg.trim() || '(sin mensaje)');

  console.log('\n  errores: ' + (errs.length ? errs.slice(0, 3).join(' | ') : 'ninguno'));
  console.log('  ' + (mal ? '>>> ' + mal + ' FALLARON' : '>>> cancelar deshace todo'));
  await b.close();
  process.exit(mal ? 1 : 0);
})();
