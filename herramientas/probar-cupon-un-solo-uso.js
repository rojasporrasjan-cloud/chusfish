const { chromium, devices } = require('playwright');
const pausa = ms => new Promise(r => setTimeout(r, ms));
const D = 'http://localhost:8080/v1/projects/chus-fish/databases/(default)/documents';
const CORREO = 'real' + Date.now() + '@test.com';

const api = (ruta, opts) => fetch(D + ruta, Object.assign(
  { headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' } }, opts || {}));

(async () => {
  const b = await chromium.launch();
  let mal = 0; const errs = [];
  const chk = (d, ok, x) => { if (!ok) mal++; console.log('    ' + (ok ? 'OK  ' : 'MAL ') + d + (x ? '   ' + x : '')); };

  // ── Jesus deja el cupon de bienvenida como en produccion ──
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

  const ctx = await b.newContext({ ...devices['iPhone 12'] });
  const pc = await ctx.newPage();
  pc.on('pageerror', e => errs.push('CLIENTE ' + e.message.slice(0, 90)));
  pc.on('console', m => { if (m.type() === 'error') errs.push('CLIENTE ' + m.text().slice(0, 90)); });
  await ctx.route('**://wa.me/**', r => r.fulfill({ status: 200, body: 'ok' }));

  const reservas = async () => {
    const q = await (await api('/coupons/BIENVENIDO/redemptions')).json();
    return (q.documents || []).map(d => d.name.split('/').pop());
  };

  // ─── 1. SE REGISTRA ───
  console.log('  == 1. SE REGISTRA ==');
  await pc.goto('http://localhost:5000/mi-cuenta.html', { waitUntil: 'commit' });
  await pausa(5000);
  const uid = await pc.evaluate(async c => {
    await firebase.auth().signOut().catch(() => {});
    const u = await CF.signUpEmail(c, 'clave1234', 'Cliente Real', '88885555', 'Frente al parque', 'Alajuela');
    return (u && u.uid) || firebase.auth().currentUser.uid;
  }, CORREO);
  await pausa(3500);
  const perfil = await pc.evaluate(() => {
    const card = document.querySelector('.cupon-card');
    return { cupon: card ? (card.innerText || '').replace(/\s+/g, ' ').trim() : null };
  });
  chk('ve su cupon en el perfil', !!perfil.cupon && /5%/.test(perfil.cupon), (perfil.cupon || '').slice(0, 55));

  // ─── 2. HACE SU PRIMER PEDIDO USANDO EL CUPON ───
  console.log('\n  == 2. PRIMER PEDIDO, CON EL CUPON ==');
  const pedir = async (etiqueta) => {
    await pc.goto('http://localhost:5000/catalogo.html', { waitUntil: 'commit' });
    await pausa(7000);
    const r = await pc.evaluate(async () => {
      const x = PRODUCTS.find(q => q.price > 0);
      addToCart(x, 2); openCartOrderForm();
      await new Promise(k => setTimeout(k, 4000));
      const btn = document.querySelector('.cupon-mio-btn');
      const ofrecido = !!btn;
      if (btn && !btn.disabled) { btn.click(); await new Promise(k => setTimeout(k, 3000)); }
      const puesto = (typeof cuponAplicado !== 'undefined' && cuponAplicado) ? cuponAplicado.codigo : null;
      ['of-zone-chips', 'of-date-chips', 'of-payment-chips'].forEach(id => {
        const c = document.getElementById(id);
        if (c && !c.querySelector('.selected')) { const t = c.querySelector('.zone-chip,.date-chip'); if (t) t.click(); }
      });
      document.getElementById('of-name').value = 'Cliente Real';
      document.getElementById('of-phone').value = '88885555';
      document.getElementById('of-address').value = 'Frente al parque';
      document.getElementById('order-form').requestSubmit();
      return { ofrecido, puesto };
    }).catch(() => ({ ofrecido: null, puesto: null }));
    await pausa(10000);
    return r;
  };

  const p1 = await pedir('1');
  chk('se le ofrece y lo aplica', p1.puesto === 'BIENVENIDO', String(p1.puesto));

  // La reserva puede llegar por la escritura o por la cola: se le da la
  // oportunidad de reintentar, como haria al volver a entrar.
  await pc.goto('http://localhost:5000/catalogo.html', { waitUntil: 'commit' });
  await pausa(9000);
  const r1 = await reservas();
  chk('EL CUPON QUEDA APARTADO', r1.indexOf(uid) >= 0, r1.length + ' reserva(s)');

  // ─── 3. INTENTA USARLO OTRA VEZ ───
  console.log('\n  == 3. INTENTA USARLO DE NUEVO ==');
  const p2 = await pc.evaluate(async () => {
    const x = PRODUCTS.find(q => q.price > 0);
    addToCart(x, 2); openCartOrderForm();
    await new Promise(k => setTimeout(k, 4000));
    const ofrecido = !!document.querySelector('.cupon-mio-btn');
    const inp = document.getElementById('of-coupon');
    inp.value = 'BIENVENIDO';
    await aplicarCupon();
    await new Promise(k => setTimeout(k, 2500));
    return {
      ofrecido,
      aplicado: (typeof cuponAplicado !== 'undefined' && cuponAplicado) ? cuponAplicado.codigo : null,
      mensaje: (document.getElementById('of-coupon-msg') || {}).innerText || ''
    };
  });
  chk('ya no se le ofrece', p2.ofrecido === false);
  chk('ESCRITO A MANO LO RECHAZA', p2.aplicado === null, p2.mensaje.trim());

  // ─── 4. JESUS CONFIRMA EL PEDIDO ───
  console.log('\n  == 4. JESUS CONFIRMA ==');
  const pa = await (await b.newContext({ viewport: { width: 1500, height: 1000 } })).newPage();
  pa.on('pageerror', e => errs.push('ADMIN ' + e.message.slice(0, 90)));
  pa.on('console', m => { if (m.type() === 'error') errs.push('ADMIN ' + m.text().slice(0, 90)); });
  await pa.goto('http://localhost:5000/admin.html', { waitUntil: 'commit' });
  await pausa(3000);
  await pa.fill('#login-user', 'chussfish2022@gmail.com');
  await pa.fill('#login-pass', 'admin123');
  await pa.click('#login-btn');
  await pa.waitForFunction(() => firebase.auth().currentUser, { timeout: 30000 });
  await pausa(3500);
  await pa.evaluate(() => showView('pedidos'));
  await pausa(3000);

  const conf = await pa.evaluate(async u => {
    const o = orders.filter(x => x.uid === u)[0];
    if (!o) return { err: 'no llego el pedido' };
    const base = orderAmountForPoints(o);
    await setOrderStatus(o.id, 'confirmado');
    await new Promise(r => setTimeout(r, 6000));
    const us = (await db.collection('users').doc(u).get()).data();
    const c = (await db.collection('coupons').doc('BIENVENIDO').get()).data();
    return { base, desc: (o.discount || {}).amount, puntos: us.points,
             pedidos: us.ordersCount, usedCount: c.usedCount };
  }, uid);
  chk('el pedido llego al panel', !conf.err, conf.err || '');
  if (!conf.err) {
    const sub = conf.base + (conf.desc || 0);
    chk('los puntos se calculan sobre lo COBRADO', conf.puntos === Math.floor(conf.base / 100) + 100,
        'base ₡' + conf.base + ' (sub ₡' + sub + ' − desc ₡' + conf.desc + ') → ' + conf.puntos + ' pts');
    chk('le cuenta el pedido', conf.pedidos === 1, 'ordersCount ' + conf.pedidos);
    chk('el cupon suma al contador de usos', conf.usedCount >= 1, 'usedCount ' + conf.usedCount);
  }

  // ─── 5. YA NO ES PRIMERA COMPRA ───
  console.log('\n  == 5. YA NO ES SU PRIMERA COMPRA ==');
  const p3 = await pc.evaluate(async () => {
    await new Promise(k => setTimeout(k, 1500));
    const inp = document.getElementById('of-coupon');
    if (inp) inp.value = 'BIENVENIDO';
    if (typeof limpiarCupon === 'function') limpiarCupon();
    inp.value = 'BIENVENIDO';
    await aplicarCupon();
    await new Promise(k => setTimeout(k, 2500));
    return {
      aplicado: (typeof cuponAplicado !== 'undefined' && cuponAplicado) ? cuponAplicado.codigo : null,
      mensaje: (document.getElementById('of-coupon-msg') || {}).innerText || ''
    };
  });
  chk('sigue rechazandolo', p3.aplicado === null, p3.mensaje.trim());

  console.log('\n  errores: ' + (errs.length ? errs.slice(0, 4).join(' | ') : 'ninguno'));
  console.log('  ' + (mal ? '>>> ' + mal + ' FALLARON' : '>>> el cupon no se puede usar dos veces'));
  await b.close(); process.exit(mal ? 1 : 0);
})();
