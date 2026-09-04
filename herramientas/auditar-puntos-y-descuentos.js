const { chromium, devices } = require('playwright');
const pausa = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const b = await chromium.launch();
  let mal = 0; const errs = [];
  const chk = (d, ok, x) => { if (!ok) mal++; console.log('    ' + (ok ? 'OK  ' : 'MAL ') + d + (x ? '   ' + x : '')); };

  const pa = await (await b.newContext({ viewport: { width: 1400, height: 900 } })).newPage();
  pa.on('pageerror', e => errs.push('ADMIN ' + e.message.slice(0, 90)));
  await pa.goto('http://localhost:5000/admin.html', { waitUntil: 'commit' });
  await pausa(3000);
  await pa.fill('#login-user', 'chussfish2022@gmail.com');
  await pa.fill('#login-pass', 'admin123');
  await pa.click('#login-btn');
  await pa.waitForFunction(() => firebase.auth().currentUser, { timeout: 30000 });
  await pausa(2500);

  const pc = await (await b.newContext({ ...devices['iPhone 12'] })).newPage();
  pc.on('pageerror', e => errs.push('CLIENTE ' + e.message.slice(0, 90)));
  await pc.goto('http://localhost:5000/catalogo.html', { waitUntil: 'commit' });
  await pausa(6000);

  // ─── 1. LA FORMULA DE PUNTOS COINCIDE EN LOS DOS LADOS ───
  console.log('  == 1. LA FORMULA DE PUNTOS: SITIO vs PANEL ==');
  const montos = [0, 1, 99, 100, 101, 999, 1000, 12500, 30000, 51000, 123456, 999999];
  const niveles = ['bronce', 'plata', 'oro'];
  const enSitio = await pc.evaluate(async d => {
    const out = {};
    for (const t of d.niveles) {
      const tier = (await CF.cfgReady).tiers.find(x => x.id === t);
      out[t] = d.montos.map(m => CF.pointsForTier(m, tier));
    }
    return out;
  }, { montos, niveles });
  const enPanel = await pa.evaluate(d => {
    const out = {};
    for (const t of d.niveles) {
      const tier = (appConfig.tiers || []).find(x => x.id === t);
      out[t] = d.montos.map(m => pointsForAmount(m, tier));
    }
    return out;
  }, { montos, niveles });
  let difs = [];
  niveles.forEach(t => montos.forEach((m, i) => {
    if (enSitio[t][i] !== enPanel[t][i]) difs.push(t + ' ₡' + m + ': sitio ' + enSitio[t][i] + ' vs panel ' + enPanel[t][i]);
  }));
  chk('coinciden en ' + (montos.length * niveles.length) + ' combinaciones', difs.length === 0, difs.slice(0, 3).join(' | '));
  chk('nunca dan puntos negativos', !niveles.some(t => enSitio[t].some(v => v < 0)));
  chk('₡99 no da puntos, ₡100 da 1', enSitio.bronce[2] === 0 && enSitio.bronce[3] === 1,
      '₡99→' + enSitio.bronce[2] + '  ₡100→' + enSitio.bronce[3]);
  chk('oro da 25% mas que bronce', enSitio.oro[9] === Math.floor(enSitio.bronce[9] * 1.25),
      'bronce ' + enSitio.bronce[9] + ' → oro ' + enSitio.oro[9]);

  // ─── 2. LOS DESCUENTOS ───
  console.log('\n  == 2. LOS DESCUENTOS, EN LOS CASOS BORDE ==');
  const casos = await pc.evaluate(async () => {
    const P = (tipo, valor, extra) => Object.assign({ type: tipo, value: valor, active: true }, extra || {});
    const v = (cup, sub) => CF.validarCupon(cup, { subtotal: sub, usosDelCliente: 0, esPrimeraCompra: true });
    return {
      pct5de51000:      v(P('percent', 5), 51000).descuento,
      pct100:           v(P('percent', 100), 30000).descuento,
      pctConTope:       v(P('percent', 50, { maxDiscount: 5000 }), 100000).descuento,
      pctTope0:         v(P('percent', 10, { maxDiscount: 0 }), 50000).descuento,
      montoMayorQueTotal: v(P('amount', 90000), 30000).descuento,
      montoExacto:      v(P('amount', 30000), 30000).descuento,
      bajoMinimo:       v(P('amount', 5000, { minOrder: 20000 }), 10000).ok,
      justoEnMinimo:    v(P('amount', 5000, { minOrder: 20000 }), 20000).descuento,
      vencido:          v(P('amount', 5000, { validUntil: new Date(Date.now() - 86400000) }), 50000).ok,
      inactivo:         v(P('amount', 5000, { active: false }), 50000).ok,
      topeUsos:         v(P('amount', 5000, { usageLimit: 3, usedCount: 3 }), 50000).ok,
      valorNegativo:    v(P('amount', -5000), 50000).descuento
    };
  });
  Object.entries(casos).forEach(([k, val]) => console.log('      ' + k.padEnd(20) + JSON.stringify(val)));
  chk('5% de ₡51.000 = ₡2.550', casos.pct5de51000 === 2550);
  chk('100% no deja el total negativo', casos.pct100 === 30000);
  chk('el tope de descuento se respeta', casos.pctConTope === 5000);
  chk('tope 0 = SIN tope (no descuento 0)', casos.pctTope0 === 5000);
  chk('monto mayor que el total se recorta', casos.montoMayorQueTotal === 30000);
  chk('bajo el minimo se rechaza', casos.bajoMinimo === false);
  chk('justo en el minimo se acepta', casos.justoEnMinimo === 5000);
  chk('vencido se rechaza', casos.vencido === false);
  chk('inactivo se rechaza', casos.inactivo === false);
  chk('con el tope de usos lleno se rechaza', casos.topeUsos === false);
  chk('un valor negativo no suma plata', casos.valorNegativo === 0);

  // ─── 3. PUNTOS SOBRE EL MONTO CON DESCUENTO ───
  console.log('\n  == 3. ¿LOS PUNTOS SE DAN SOBRE LO QUE PAGO? ==');
  const sobreQue = await pa.evaluate(() => {
    const o = { items: [{ price: 10000, qty: 5 }], deliveryFee: 0,
                discount: { code: 'X', type: 'amount', value: 20000, amount: 20000 } };
    return { total: orderAmountForPoints(o) };
  });
  chk('el descuento se resta antes de dar puntos', sobreQue.total === 30000,
      '₡50.000 con ₡20.000 de descuento → base ₡' + sobreQue.total);

  // ─── 4. EL LIBRO CUADRA CON EL SALDO ───
  console.log('\n  == 4. EL LIBRO DE PUNTOS CUADRA CON EL SALDO ==');
  const cuadre = await pa.evaluate(async () => {
    const out = [];
    const us = await db.collection('users').get();
    for (const d of us.docs) {
      const l = await d.ref.collection('ledger').get();
      const suma = l.docs.reduce((s, x) => s + (Number(x.data().points) || 0), 0);
      const saldo = Number(d.data().points) || 0;
      if (l.size && suma !== saldo) out.push((d.data().email || d.id) + ': libro ' + suma + ' vs saldo ' + saldo);
    }
    return out;
  });
  chk('todos los clientes cuadran', cuadre.length === 0, cuadre.slice(0, 3).join(' | '));

  // ─── 5. INVARIANTES QUE NUNCA SE PUEDEN ROMPER ───
  console.log('\n  == 5. INVARIANTES ==');
  const inv = await pa.evaluate(async () => {
    const us = await db.collection('users').get();
    const out = { negativos: [], saldoMayor: [], nivelMal: [] };
    const tiers = (appConfig.tiers || []).slice().sort((a, b) => b.min - a.min);
    us.docs.forEach(d => {
      const u = d.data();
      const p = Number(u.points) || 0, lp = Number(u.lifetimePoints) || 0;
      if (p < 0 || lp < 0) out.negativos.push(u.email || d.id);
      if (p > lp) out.saldoMayor.push((u.email || d.id) + ' ' + p + '>' + lp);
      const esperado = (tiers.find(t => lp >= t.min) || {}).id;
      if (u.tier && esperado && u.tier !== esperado) out.nivelMal.push((u.email || d.id) + ' dice ' + u.tier);
    });
    return out;
  });
  chk('ningun saldo negativo', inv.negativos.length === 0, inv.negativos.join());
  chk('el saldo nunca supera el historico', inv.saldoMayor.length === 0, inv.saldoMayor.join());
  chk('el nivel cuadra con los puntos', inv.nivelMal.length === 0, inv.nivelMal.join());

  console.log('\n  errores: ' + (errs.length ? errs.slice(0, 3).join(' | ') : 'ninguno'));
  console.log('  ' + (mal ? '>>> ' + mal + ' FALLARON' : '>>> la aritmetica de puntos y descuentos es correcta'));
  await b.close(); process.exit(0);
})();
