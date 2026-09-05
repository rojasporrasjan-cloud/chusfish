/* UNA PERSONA, DE CERO A CANJEAR. La prueba más real que hay acá.
 *
 * No comprueba funciones sueltas: recorre lo que hace un cliente de verdad
 * y exige que **el mismo número aparezca igual en todas partes** — en el
 * carrito, en el perfil, en La Reserva, en el panel de Jesús y en el libro
 * de puntos. Los fallos caros de este proyecto siempre fueron eso: dos
 * pantallas contando cosas distintas.
 *
 * Necesita el emulador y el servidor local. Corré `npm run seed` antes.
 *
 *   node herramientas/probar-recorrido-completo.js
 */
const { chromium, devices } = require('playwright');
const pausa = ms => new Promise(r => setTimeout(r, ms));
const D = 'http://localhost:8080/v1/projects/chus-fish/databases/(default)/documents';
const api = (r, o) => fetch(D + r, Object.assign(
  { headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(15000) }, o || {}))
  .catch(e => { throw new Error('el emulador no contesto (' + e.name + '). Ver LEEME.md'); });

const TEL = '87778888';
const DIR = 'Del parque 300 sur, porton azul';

(async () => {
  const b = await chromium.launch();
  let mal = 0; const errs = [];
  const chk = (d, ok, x) => { if (!ok) mal++; console.log('    ' + (ok ? 'OK  ' : 'MAL ') + d + (x ? '   ' + x : '')); };
  const num = t => Number(String(t).replace(/[^\d]/g, '')) || 0;

  /* El cupon de bienvenida, tal como esta en produccion */
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
    return { pts: n('points'), lp: n('lifetimePoints'), pedidos: n('ordersCount'),
             gasto: n('totalSpent'), tel: (f.phone || {}).stringValue || '',
             dir: (f.address || {}).stringValue || '' };
  };
  const libro = async uid => {
    const j = await (await api('/users/' + uid + '/ledger')).json();
    return (j.documents || []).map(d => {
      const f = d.fields || {};
      return { tipo: (f.type || {}).stringValue || '',
               pts: Number((f.points || {}).integerValue || 0),
               razon: (f.reason || {}).stringValue || '' };
    });
  };

  const ctx = await b.newContext({ ...devices['iPhone 12'] });
  const p = await ctx.newPage();
  p.on('pageerror', e => errs.push('JS ROTO: ' + e.message.slice(0, 100)));
  p.on('console', m => { const t = m.text();
    if (m.type() === 'error' && !/client is offline|status of 400/.test(t)) errs.push(t.slice(0, 100)); });
  await ctx.route('**://wa.me/**', r => r.fulfill({ status: 200, body: 'ok' }));

  /* ═══ 1. SE REGISTRA ═══ */
  console.log('  ══ 1. SE REGISTRA ══');
  await p.goto('http://localhost:5000/mi-cuenta.html', { waitUntil: 'commit' });
  await pausa(6000);
  const uid = await p.evaluate(async c => {
    await firebase.auth().signOut().catch(() => {});
    const u = await CF.signUpEmail(c, 'clave1234', 'Ana Solis', '', '', '');
    return (u && u.uid) || firebase.auth().currentUser.uid;
  }, 'recorrido' + Date.now() + '@test.com');
  await pausa(7000);

  const regalo = await p.evaluate(() => {
    const ov = document.getElementById('regalo-ov');
    const abierto = ov && ov.classList.contains('on');
    const btn = [...document.querySelectorAll('.regalo-btn')].find(x => x.offsetParent !== null);
    return { abierto, boton: btn ? btn.textContent.trim() : null,
             cod: (document.getElementById('regalo-cod') || {}).textContent || '' };
  });
  chk('le dan el cupon de bienvenida al registrarse', regalo.abierto === true, regalo.cod);
  chk('el boton del modal dice lo que hace', regalo.boton === 'Ver mis primeros pasos', String(regalo.boton));
  await p.evaluate(() => { const b = [...document.querySelectorAll('.regalo-btn')]
    .find(x => x.offsetParent !== null); if (b) b.click(); });
  await pausa(2000);
  const traeGuia = await p.evaluate(() => {
    const g = document.querySelector('.guia');
    if (!g) return null;
    const r = g.getBoundingClientRect();
    // ¿quedó a la vista tras cerrar el regalo?
    return { visible: r.top < innerHeight && r.bottom > 0,
             contador: (g.querySelector('.guia-h b') || {}).textContent || '' };
  });
  chk('al cerrarlo, la guia queda a la vista', traeGuia && traeGuia.visible === true,
      traeGuia ? traeGuia.contador : 'no hay guia');

  /* ═══ 2. PIDE, Y EL CARRITO PROMETE UN NUMERO ═══ */
  console.log('\n  ══ 2. PIDE, Y EL CARRITO LE PROMETE PUNTOS ══');
  await p.goto('http://localhost:5000/catalogo.html', { waitUntil: 'commit' });
  await pausa(8000);
  const carrito = await p.evaluate(async d => {
    const x = PRODUCTS.filter(q => q.price > 0).sort((a, b) => a.price - b.price)[0];
    addToCart(x, 2); openCartOrderForm();
    await new Promise(k => setTimeout(k, 4500));
    const btn = document.querySelector('.cupon-mio-btn');
    if (btn && !btn.disabled) { btn.click(); await new Promise(k => setTimeout(k, 3000)); }
    ['of-zone-chips','of-date-chips','of-payment-chips'].forEach(id => {
      const c = document.getElementById(id);
      if (c && !c.querySelector('.selected')) { const t = c.querySelector('.zone-chip,.date-chip'); if (t) t.click(); }
    });
    document.getElementById('of-name').value    = 'Ana Solis';
    document.getElementById('of-phone').value   = d.tel;
    document.getElementById('of-address').value = d.dir;
    const txt = (document.querySelector('#order-form-overlay') || document.body).innerText;
    const m = txt.match(/Ganás\s+([\d.,]+)\s+puntos/i);
    return {
      producto: x.name, precio: x.price,
      subtotal: cart.reduce((s, i) => s + i.product.price * i.qty, 0),
      cupon: (typeof cuponAplicado !== 'undefined' && cuponAplicado)
        ? { cod: cuponAplicado.codigo, desc: cuponAplicado.descuento } : null,
      prometidos: m ? Number(m[1].replace(/[^\d]/g, '')) : null
    };
  }, { tel: TEL, dir: DIR });
  console.log('    ' + carrito.producto + ' x2 = ₡' + carrito.subtotal.toLocaleString('es-CR') +
              (carrito.cupon ? '  −₡' + carrito.cupon.desc.toLocaleString('es-CR') + ' (' + carrito.cupon.cod + ')' : ''));
  chk('le ofrecen su cupon y lo aplica', carrito.cupon && carrito.cupon.cod === 'BIENVENIDO');
  chk('el 5% esta bien calculado', carrito.cupon &&
      carrito.cupon.desc === Math.round(carrito.subtotal * 0.05),
      '5% de ' + carrito.subtotal + ' = ' + Math.round(carrito.subtotal * 0.05) +
      ', dio ' + (carrito.cupon || {}).desc);
  const cobrado = carrito.subtotal - (carrito.cupon ? carrito.cupon.desc : 0);
  chk('le PROMETE puntos sobre lo que va a pagar', carrito.prometidos === Math.floor(cobrado / 100),
      'esperado ' + Math.floor(cobrado / 100) + ', prometio ' + carrito.prometidos);

  await p.evaluate(() => document.getElementById('order-form').requestSubmit()).catch(() => {});
  await pausa(12000);

  const trasPedir = await usuario(uid);
  chk('el pedido le guarda telefono y direccion', trasPedir.tel === TEL && trasPedir.dir === DIR,
      trasPedir.tel + ' / ' + trasPedir.dir);
  chk('todavia NO tiene puntos (falta que confirmen)', trasPedir.pts === 0, String(trasPedir.pts));

  /* ═══ 3. JESUS CONFIRMA ═══ */
  console.log('\n  ══ 3. JESUS CONFIRMA ══');
  const pa = await (await b.newContext({ viewport: { width: 1500, height: 1000 } })).newPage();
  pa.on('pageerror', e => errs.push('ADMIN JS ROTO: ' + e.message.slice(0, 100)));
  pa.on('dialog', d => d.accept());
  await pa.goto('http://localhost:5000/admin.html', { waitUntil: 'commit' });
  await pausa(3500);
  await pa.fill('#login-user', 'chussfish2022@gmail.com');
  await pa.fill('#login-pass', 'admin123');
  await pa.click('#login-btn');
  await pa.waitForFunction(() => firebase.auth().currentUser, { timeout: 30000 });
  await pausa(4000);
  await pa.evaluate(() => showView('pedidos'));
  await pausa(3500);

  const conf = await pa.evaluate(async u => {
    const o = orders.filter(x => x.uid === u)[0];
    if (!o) return { err: 'el pedido no llego al panel' };
    const base = orderAmountForPoints(o);
    await setOrderStatus(o.id, 'confirmado');
    await new Promise(r => setTimeout(r, 7000));
    return { id: o.id, base, desc: (o.discount || {}).amount || 0 };
  }, uid);
  chk('el pedido llego al panel', !conf.err, conf.err || '');
  chk('el panel cobra lo mismo que el carrito', conf.base === cobrado,
      'carrito ₡' + cobrado + ', panel ₡' + conf.base);
  await pausa(3000);

  const conPuntos = await usuario(uid);
  const bono = conPuntos.pts - carrito.prometidos;
  console.log('    puntos: ' + carrito.prometidos + ' del pedido + ' + bono + ' de bono = ' + conPuntos.pts);
  chk('LE ACREDITA LO PROMETIDO (mas el bono)', conPuntos.pts >= carrito.prometidos,
      'prometio ' + carrito.prometidos + ', dio ' + conPuntos.pts);
  chk('le cuenta el pedido', conPuntos.pedidos === 1, String(conPuntos.pedidos));
  chk('el total comprado es lo COBRADO, no lo pedido', conPuntos.gasto === cobrado,
      'esperado ₡' + cobrado + ', anoto ₡' + conPuntos.gasto);

  /* ═══ 4. EL LIBRO DE PUNTOS CUADRA ═══ */
  console.log('\n  ══ 4. EL LIBRO CUADRA CON EL SALDO ══');
  const mov = await libro(uid);
  const suma = mov.reduce((s, m) => s + m.pts, 0);
  mov.forEach(m => console.log('    ' + (m.pts > 0 ? '+' : '') + m.pts + '  ' + m.razon));
  chk('la suma del libro es el saldo', suma === conPuntos.pts,
      'libro ' + suma + ', saldo ' + conPuntos.pts);

  /* ═══ 5. LO MISMO EN TODAS LAS PANTALLAS ═══ */
  console.log('\n  ══ 5. EL MISMO NUMERO EN TODAS PARTES ══');
  await p.goto('http://localhost:5000/mi-cuenta.html', { waitUntil: 'commit' });
  await pausa(9000);
  const enPerfil = await p.evaluate(() => ({
    saldo: (document.getElementById('u-pts') || {}).textContent || '',
    pedidos: (document.getElementById('s-orders') || {}).textContent || '',
    gastado: (document.getElementById('s-spent') || {}).textContent || '',
    guia: (function(){ const g = document.querySelector('.guia');
      return g ? (g.querySelector('.guia-h b') || {}).textContent || '' : ''; })()
  }));
  console.log('    perfil: ' + JSON.stringify(enPerfil));
  chk('el perfil muestra el saldo real', num(enPerfil.saldo) === conPuntos.pts,
      enPerfil.saldo + ' vs ' + conPuntos.pts);
  chk('el perfil muestra el pedido', num(enPerfil.pedidos) === 1, enPerfil.pedidos);
  chk('el perfil muestra lo cobrado', num(enPerfil.gastado) === cobrado,
      enPerfil.gastado + ' vs ₡' + cobrado);
  chk('la guia va en 4 de 5', /4 de 5/.test(enPerfil.guia), enPerfil.guia);

  await p.goto('http://localhost:5000/premios.html', { waitUntil: 'commit' });
  await pausa(8000);
  const enReserva = await p.evaluate(() => {
    const t = document.body.innerText;
    const m = t.match(/([\d.,]+)\s*PUNTOS/i);
    return { saldo: m ? m[1] : '', falta: (t.match(/Faltan[^\n]*/i) || [''])[0] };
  });
  console.log('    La Reserva: ' + enReserva.saldo + ' pts  ·  "' + enReserva.falta + '"');
  chk('La Reserva muestra el MISMO saldo', num(enReserva.saldo) === conPuntos.pts,
      enReserva.saldo + ' vs ' + conPuntos.pts);

  /* ═══ 6. CANJEA ═══ */
  console.log('\n  ══ 6. CANJEA ══');
  // Jesus le confirma mas pedidos para que le alcance
  await api('/users/' + uid + '?updateMask.fieldPaths=points&updateMask.fieldPaths=lifetimePoints',
    { method: 'PATCH', body: JSON.stringify({ fields: {
      points: { integerValue: '6000' }, lifetimePoints: { integerValue: '6000' } } }) });
  await pausa(4000);
  await p.goto('http://localhost:5000/premios.html', { waitUntil: 'commit' });
  await pausa(9000);

  const antesCanje = await usuario(uid);
  const canje = await p.evaluate(async () => {
    const vistos = new Set();
    for (const c of [...document.querySelectorAll('[data-abrir]')]) {
      if (vistos.has(c.dataset.abrir)) continue;
      vistos.add(c.dataset.abrir);
      c.click();
      await new Promise(k => setTimeout(k, 1800));
      const go = document.getElementById('f-go');
      if (go) {
        const costo = Number((go.textContent.replace(/\./g, '').match(/(\d+)/) || [0, 0])[1]);
        const nombre = (document.getElementById('sheet-n') || {}).textContent || '';
        go.click();
        await new Promise(k => setTimeout(k, 1800));
        const si = document.getElementById('c-si');
        if (!si) return { err: 'no pidio confirmar' };
        si.click();
        await new Promise(k => setTimeout(k, 7000));
        return { costo, nombre,
                 cierre: (document.getElementById('sheet-scroll') || {}).innerText || '' };
      }
      const x = document.getElementById('sheet-x'); if (x) x.click();
      await new Promise(k => setTimeout(k, 800));
    }
    return { err: 'no le alcanza para ningun premio' };
  });
  chk('puede canjear', !canje.err, canje.err || canje.nombre + ' (' + canje.costo + ' pts)');
  if (!canje.err) {
    chk('el cierre le dice que los puntos ya salieron',
        /ya salieron de tu saldo/i.test(canje.cierre));
    await pausa(3000);
    const trasCanje = await usuario(uid);
    console.log('    saldo ' + antesCanje.pts + ' -> ' + trasCanje.pts + '  (premio ' + canje.costo + ')');
    chk('LE DESCUENTA EXACTO', trasCanje.pts === antesCanje.pts - canje.costo,
        'esperado ' + (antesCanje.pts - canje.costo));
    chk('el nivel NO baja', trasCanje.lp === antesCanje.lp,
        antesCanje.lp + ' -> ' + trasCanje.lp);

    /* ═══ 7. LA GUIA SE COMPLETA ═══ */
    console.log('\n  ══ 7. LA GUIA, YA RECORRIDA ENTERA ══');
    await p.goto('http://localhost:5000/mi-cuenta.html', { waitUntil: 'commit' });
    await pausa(9000);
    const fin = await p.evaluate(() => {
      const g = document.querySelector('.guia');
      return g ? { encogida: g.classList.contains('lista'),
                   alto: Math.round(g.getBoundingClientRect().height),
                   pasos: g.querySelectorAll('.guia-paso').length } : null;
    });
    chk('SE ENCOGE a una linea', fin && fin.encogida === true && fin.alto < 60,
        fin ? fin.alto + 'px, ' + fin.pasos + ' pasos' : 'no hay guia');
    const abre = await p.evaluate(async () => {
      const m = document.getElementById('guia-mas');
      if (!m) return false;
      m.click();
      await new Promise(k => setTimeout(k, 400));
      return !document.getElementById('guia-det').hidden;
    });
    chk('pero sigue pudiendo abrir la explicacion', abre === true);
  }

  console.log('\n  errores de JS: ' + (errs.length ? [...new Set(errs)].slice(0, 4).join(' | ') : 'ninguno'));
  chk('ni un error de JS en todo el recorrido', errs.length === 0, '');
  console.log('  ' + (mal ? '>>> ' + mal + ' FALLARON' : '>>> el recorrido entero cuadra'));
  await b.close();
  process.exit(mal ? 1 : 0);
})();
