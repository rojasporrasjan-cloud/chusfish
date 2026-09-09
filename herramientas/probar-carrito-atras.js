/* El carrito y el gesto de "atrás" en el teléfono.
 *
 * Tres cosas que reportó Jan, las tres del mismo rato de uso real:
 *
 *   1. Al volver atrás desde el checkout, EL PEDIDO SE DUPLICABA.
 *      `restoreCart()` hacía push y se llama DOS veces en initCatalog():
 *      una al pintar con el catálogo en caché y otra cuando llegan los
 *      productos frescos de Firestore y son distintos.
 *
 *   2. El gesto de atrás SACABA DE LA PÁGINA. La ficha, el carrito y el
 *      cajón registran su capa de historial; el checkout no lo hacía.
 *
 *   3. El botón de quitar del carrito era un carácter «·». Existía, pero
 *      nadie lo leía como "quitar".
 *
 * Necesita el emulador y el servidor local. Corré `npm run seed` antes.
 *
 *   node herramientas/probar-carrito-atras.js
 */
const { chromium, devices } = require('playwright');
const pausa = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const b = await chromium.launch();
  let mal = 0; const errs = [];
  const chk = (d, ok, x) => { if (!ok) mal++; console.log('    ' + (ok ? 'OK  ' : 'MAL ') + d + (x ? '   ' + x : '')); };

  const ctx = await b.newContext({ ...devices['iPhone 12'] });
  const p = await ctx.newPage();
  p.on('pageerror', e => errs.push('JS ROTO: ' + e.message.slice(0, 110)));
  p.on('console', m => { const t = m.text();
    if (m.type() === 'error' && !/client is offline|status of 400/.test(t)) errs.push(t.slice(0, 110)); });
  await ctx.route('**://wa.me/**', r => r.fulfill({ status: 200, body: 'ok' }));

  const irAlCatalogo = async () => {
    await p.goto('http://localhost:5000/catalogo.html', { waitUntil: 'commit', timeout: 60000 });
    await p.waitForFunction(
      () => typeof PRODUCTS !== 'undefined' && PRODUCTS.length > 0 &&
            typeof addToCart === 'function',
      { timeout: 30000 });
    await pausa(1500);
  };
  const enCarrito = () => p.evaluate(() => ({
    lineas: cart.length,
    total: cart.reduce((s, i) => s + i.qty, 0),
    guardado: JSON.parse(localStorage.getItem('chusfish_cart') || '[]').length
  }));

  /* ═══ 1. RESTAURAR EL CARRITO NO LO DUPLICA ═══ */
  console.log('  == 1. EL CARRITO NO SE DUPLICA ==');
  await irAlCatalogo();
  await p.evaluate(() => {
    localStorage.removeItem('chusfish_cart');
    cart = [];
    const dos = PRODUCTS.filter(q => q.price > 0).slice(0, 2);
    addToCart(dos[0], 2);
    addToCart(dos[1], 1);
  });
  await pausa(800);
  const puesto = await enCarrito();
  chk('arranca con 2 productos', puesto.lineas === 2, JSON.stringify(puesto));

  /* Se llama restoreCart() otra vez, que es justo lo que hace initCatalog
     cuando llegan los productos frescos de Firestore. */
  const tras = await p.evaluate(() => {
    restoreCart();
    return { lineas: cart.length, total: cart.reduce((s, i) => s + i.qty, 0) };
  });
  console.log('    tras restaurar de nuevo: ' + JSON.stringify(tras));
  chk('SIGUEN SIENDO 2, no 4', tras.lineas === 2, tras.lineas + ' lineas');
  chk('y las cantidades no cambian', tras.total === puesto.total,
      puesto.total + ' -> ' + tras.total);

  /* Y tres veces mas, por si acaso. */
  const tres = await p.evaluate(() => {
    restoreCart(); restoreCart(); restoreCart();
    return cart.length;
  });
  chk('llamarlo cinco veces da lo mismo', tres === 2, tres + ' lineas');

  /* ═══ 2. VOLVER ATRAS DE VERDAD, CON EL NAVEGADOR ═══ */
  console.log('\n  == 2. EL RECORRIDO REAL: CARRITO -> CHECKOUT -> ATRAS ==');
  await p.evaluate(() => { openCart(); });
  await pausa(1200);
  await p.evaluate(() => document.getElementById('cart-wa-btn').click());
  await pausa(3000);
  const abierto = await p.evaluate(() => ({
    checkout: document.getElementById('order-form-overlay').classList.contains('open'),
    capas: (window.CFUI && CFUI.capas) ? CFUI.capas() : null
  }));
  chk('el checkout se abre', abierto.checkout === true);

  await p.goBack({ waitUntil: 'commit' }).catch(() => {});
  await pausa(2500);
  const trasAtras = await p.evaluate(() => ({
    url: location.pathname,
    checkout: (document.getElementById('order-form-overlay') || {}).classList
      ? document.getElementById('order-form-overlay').classList.contains('open') : null,
    lineas: typeof cart !== 'undefined' ? cart.length : -1
  }));
  console.log('    ' + JSON.stringify(trasAtras));
  chk('SIGUE EN EL CATALOGO, no se fue del sitio',
      /catalogo/.test(trasAtras.url), trasAtras.url);
  chk('el checkout se cerro', trasAtras.checkout === false);
  chk('Y EL CARRITO SIGUE CON 2, no 4', trasAtras.lineas === 2,
      trasAtras.lineas + ' lineas');

  /* ═══ 3. LA X DE QUITAR ═══ */
  console.log('\n  == 3. LA X PARA QUITAR ==');
  await p.evaluate(() => { if (!document.getElementById('cart-panel').classList.contains('open')) openCart(); });
  await pausa(1500);
  const x = await p.evaluate(() => {
    const btn = document.querySelector('.cart-remove');
    if (!btn) return { hay: false };
    const r = btn.getBoundingClientRect();
    return { hay: true, svg: !!btn.querySelector('svg'),
             texto: btn.textContent.trim(),
             ancho: Math.round(r.width), alto: Math.round(r.height),
             etiqueta: btn.getAttribute('aria-label') || btn.getAttribute('title') || '' };
  });
  console.log('    ' + JSON.stringify(x));
  chk('el boton existe', x.hay === true);
  chk('ES UNA X DE VERDAD, no un punto', x.svg === true && x.texto === '',
      'antes ponia "' + '·' + '"');
  chk('se puede tocar con el dedo (>=28px)', x.ancho >= 28 && x.alto >= 28,
      x.ancho + 'x' + x.alto + 'px');
  chk('dice para que es', /quitar/i.test(x.etiqueta), x.etiqueta);

  const quito = await p.evaluate(async () => {
    const antes = cart.length;
    document.querySelector('.cart-remove').click();
    await new Promise(k => setTimeout(k, 800));
    return { antes, despues: cart.length,
             guardado: JSON.parse(localStorage.getItem('chusfish_cart') || '[]').length };
  });
  console.log('    ' + JSON.stringify(quito));
  chk('QUITA EL PRODUCTO', quito.despues === quito.antes - 1,
      quito.antes + ' -> ' + quito.despues);
  chk('y lo quita tambien de lo guardado', quito.guardado === quito.despues,
      'guardado ' + quito.guardado);

  /* Y al recargar sigue quitado: si no, vuelve solo. */
  await irAlCatalogo();
  const trasRecargar = await enCarrito();
  chk('al recargar NO vuelve', trasRecargar.lineas === quito.despues,
      JSON.stringify(trasRecargar));

  console.log('\n  errores de JS: ' + (errs.length ? [...new Set(errs)].slice(0, 4).join(' | ') : 'ninguno'));
  chk('ni un error de JS', errs.length === 0, '');
  console.log('  ' + (mal ? '>>> ' + mal + ' FALLARON' : '>>> el carrito y el atras se portan'));
  await b.close();
  process.exit(mal ? 1 : 0);
})();
