/* El cupón configurado que ya no existe.
 *
 * Pasó de verdad, y se descubrió revisando producción antes de una
 * entrega: `config.promoCoupon` apuntaba a un código que ya no estaba —
 * borrado o renombrado después de configurarlo. El sitio hacía lo
 * correcto (no mostrar nada) pero NADIE se enteraba: la promoción
 * llevaba días sin salir y Jesús creía que estaba corriendo.
 *
 * Esta prueba comprueba las dos mitades:
 *   1. Que un cupón fantasma NO rompa el catálogo. Que no salga la
 *      promoción está bien; que se caiga la página, no.
 *   2. Que el panel lo DIGA. Fallar en silencio es lo que costó los días.
 *
 * Necesita el emulador y el servidor local. Corré `npm run seed` antes.
 *
 *   node herramientas/probar-cupon-huerfano.js
 */
const { chromium, devices } = require('playwright');
const pausa = ms => new Promise(r => setTimeout(r, ms));
const D = 'http://localhost:8080/v1/projects/chus-fish/databases/(default)/documents';
const api = (r, o) => fetch(D + r, Object.assign(
  { headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(15000) }, o || {}))
  .catch(e => { throw new Error('el emulador no contesto (' + e.name + '). Ver LEEME.md'); });

const FANTASMA = 'NOEXISTE9';

(async () => {
  const b = await chromium.launch();
  let mal = 0; const errs = [];
  const chk = (d, ok, x) => { if (!ok) mal++; console.log('    ' + (ok ? 'OK  ' : 'MAL ') + d + (x ? '   ' + x : '')); };

  await api('/chusfish/config?updateMask.fieldPaths=promoCoupon', { method: 'PATCH',
    body: JSON.stringify({ fields: { promoCoupon: { stringValue: FANTASMA } } }) });

  /* ═══ 1. EL CATÁLOGO AGUANTA ═══ */
  console.log('  == 1. UN CUPON FANTASMA NO ROMPE EL CATALOGO ==');
  const ctx = await b.newContext({ ...devices['iPhone 12'] });
  const p = await ctx.newPage();
  p.on('pageerror', e => errs.push('CATALOGO JS ROTO: ' + e.message.slice(0, 110)));
  p.on('console', m => { const t = m.text();
    if (m.type() === 'error' && !/client is offline|status of 400/.test(t)) errs.push(t.slice(0, 110)); });
  await ctx.route('**://wa.me/**', r => r.fulfill({ status: 200, body: 'ok' }));

  await p.goto('http://localhost:5000/catalogo.html', { waitUntil: 'load', timeout: 60000 });
  await p.waitForFunction(() => typeof PRODUCTS !== 'undefined' && PRODUCTS.length > 0,
    { timeout: 30000 });
  await pausa(9000);

  const cat = await p.evaluate(async () => {
    const x = PRODUCTS.find(q => q.price > 0);
    addToCart(x, 1); openCartOrderForm();
    await new Promise(k => setTimeout(k, 4000));
    return {
      productos: PRODUCTS.length,
      tarjetas: document.querySelectorAll('.p-card').length,
      aviso: (() => { const o = document.getElementById('promo-ov');
        return o ? o.classList.contains('open') : null; })(),
      segmento: (() => { const s = document.getElementById('descuentos-section');
        return s ? (s.style.display !== 'none') : null; })(),
      checkout: document.getElementById('order-form-overlay').classList.contains('open')
    };
  });
  console.log('    ' + JSON.stringify(cat));
  chk('el catalogo carga entero', cat.productos > 0 && cat.tarjetas > 0,
      cat.tarjetas + ' tarjetas');
  chk('el checkout abre igual', cat.checkout === true);
  chk('NO se muestra una promo que no existe', cat.aviso === false);
  chk('ni el segmento de descuentos', cat.segmento === false);
  chk('sin un solo error de JS', errs.length === 0, errs.slice(0, 2).join(' | '));
  await ctx.close();

  /* ═══ 2. EL PANEL LO DICE ═══ */
  console.log('\n  == 2. EL PANEL AVISA (lo que faltaba) ==');
  const pa = await (await b.newContext({ viewport: { width: 1500, height: 1100 } })).newPage();
  pa.on('pageerror', e => errs.push('ADMIN JS ROTO: ' + e.message.slice(0, 110)));
  await pa.goto('http://localhost:5000/admin.html', { waitUntil: 'load', timeout: 60000 });
  await pausa(3500);
  await pa.fill('#login-user', 'chussfish2022@gmail.com');
  await pa.fill('#login-pass', 'admin123');
  await pa.click('#login-btn');
  await pa.waitForFunction(() => firebase.auth().currentUser, { timeout: 30000 });
  await pausa(3000);
  await pa.evaluate(() => showView('cupones'));
  await pausa(4000);

  const av = await pa.evaluate(() => {
    const c = document.getElementById('cup-huerfano');
    return { hay: !!c, visible: c ? !c.hidden : false,
             txt: c ? c.innerText.replace(/\s+/g, ' ').trim() : '' };
  });
  console.log('    "' + av.txt.slice(0, 130) + '"');
  chk('el aviso aparece', av.visible === true);
  chk('dice QUE cupon es', /promoci[oó]n/i.test(av.txt), av.txt.slice(0, 50));
  chk('dice el codigo que falta', av.txt.indexOf(FANTASMA) >= 0);
  chk('dice que no se le muestra a nadie', /no se le muestra a nadie/i.test(av.txt));
  chk('y dice como arreglarlo', /Creá el cupón|cambiá cuál es/i.test(av.txt));

  /* ═══ 3. UN CUPON APAGADO TAMBIÉN CUENTA ═══ */
  console.log('\n  == 3. UNO QUE EXISTE PERO ESTA APAGADO ==');
  await api('/coupons/' + FANTASMA, { method: 'PATCH', body: JSON.stringify({ fields: {
    type: { stringValue: 'percent' }, value: { integerValue: '10' },
    minOrder: { integerValue: '0' }, maxDiscount: { integerValue: '0' },
    usageLimit: { integerValue: '-1' }, perUserLimit: { integerValue: '0' },
    active: { booleanValue: false }, usedCount: { integerValue: '0' }
  } }) });
  await pausa(2000);
  const apagado = await pa.evaluate(async () => {
    await avisarCuponHuerfano();
    await new Promise(k => setTimeout(k, 800));
    const c = document.getElementById('cup-huerfano');
    return { visible: !c.hidden, txt: c.innerText.replace(/\s+/g, ' ').trim() };
  });
  console.log('    "' + apagado.txt.slice(0, 120) + '"');
  chk('tambien avisa si esta apagado', apagado.visible === true);
  chk('y lo distingue de "no existe"', /desactivado/i.test(apagado.txt), apagado.txt.slice(0, 60));

  /* ═══ 4. CON TODO BIEN, NO MOLESTA ═══ */
  console.log('\n  == 4. SI ESTA TODO BIEN, NO DICE NADA ==');
  await api('/coupons/' + FANTASMA + '?updateMask.fieldPaths=active', { method: 'PATCH',
    body: JSON.stringify({ fields: { active: { booleanValue: true } } }) });
  await pausa(2000);
  const bien = await pa.evaluate(async () => {
    await avisarCuponHuerfano();
    await new Promise(k => setTimeout(k, 800));
    return document.getElementById('cup-huerfano').hidden;
  });
  chk('el aviso desaparece', bien === true);

  console.log('\n  errores de JS: ' + (errs.length ? [...new Set(errs)].slice(0, 3).join(' | ') : 'ninguno'));
  chk('ni un error de JS', errs.length === 0, '');
  console.log('  ' + (mal ? '>>> ' + mal + ' FALLARON' : '>>> un cupon fantasma no rompe nada, y se avisa'));
  await b.close();
  process.exit(mal ? 1 : 0);
})();
