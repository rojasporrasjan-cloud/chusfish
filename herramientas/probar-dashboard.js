/* Las gráficas del dashboard: que digan la verdad y se puedan leer.
 *
 * Jesús pidió ver resultados, no inventario: qué se vende más, cómo van
 * las ventas, de dónde sale la plata y qué está agotado.
 *
 * Lo que esta prueba vigila, y por qué:
 *
 *  · LOS NÚMEROS. Una gráfica bonita con la cuenta mal es peor que no
 *    tenerla. Se comparan los kilos y los montos contra los pedidos.
 *  · Que cuenten solo lo VENDIDO. Un pedido pendiente es intención, no
 *    venta; uno cancelado no es nada.
 *  · Que todo lo del globito esté TAMBIÉN en "Ver tabla". El hover no
 *    puede ser el único camino a un número: no existe en un teléfono.
 *  · Que el rojo de "agotado" lleve icono y palabra. Rojo y verde no se
 *    distinguen bajo daltonismo — medido, ΔE 4.1.
 *
 * Necesita el emulador y el servidor local. Corré `npm run seed` antes.
 *
 *   node herramientas/probar-dashboard.js
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

  const cat = await (await api('/chusfish/catalog')).json();
  const vals = (((cat.fields || {}).products || {}).arrayValue || {}).values || [];
  const P = vals.map(v => { const f = v.mapValue.fields || {};
    return { id: +((f.id || {}).integerValue || 0), name: (f.name || {}).stringValue || '',
             price: +((f.price || {}).integerValue || 0) };
  }).filter(x => x.price > 0);
  const A = P[0], B = P[1];

  /* Un montaje donde la cuenta correcta se sabe de antemano:
       A: 2kg vendidos + 3kg vendidos = 5kg     ·  B: 1kg
     y ADEMAS un pendiente y un cancelado con A, que NO deben contar. */
  const pedir = (nombre, estado, items, hace) => {
    const d = new Date(); d.setDate(d.getDate() - (hace || 0));
    return api('/orders', { method: 'POST', body: JSON.stringify({ fields: {
      uid: { nullValue: null },
      customer: { mapValue: { fields: { name: { stringValue: nombre },
        phone: { stringValue: '88990000' }, address: { stringValue: 'Casa' } } } },
      items: { arrayValue: { values: items.map(i => ({ mapValue: { fields: {
        id: { integerValue: String(i.p.id) }, name: { stringValue: i.p.name },
        qty: { doubleValue: i.q }, unit: { stringValue: '/kg' },
        price: { integerValue: String(i.p.price) } } } })) } },
      deliveryFee: { integerValue: '0' },
      status: { stringValue: estado },
      createdAt: { timestampValue: d.toISOString() }
    } }) });
  };
  await pedir('Vendido 1', 'entregado',  [{ p: A, q: 2 }], 1);
  await pedir('Vendido 2', 'confirmado', [{ p: A, q: 3 }, { p: B, q: 1 }], 3);
  await pedir('NO cuenta', 'pendiente',  [{ p: A, q: 50 }], 2);
  await pedir('NO cuenta', 'cancelado',  [{ p: A, q: 90 }], 2);

  /* Y A se marca agotado: es el que mas vende, o sea el caso que importa. */
  const v2 = JSON.parse(JSON.stringify(vals));
  const iA = v2.findIndex(v => +((v.mapValue.fields.id || {}).integerValue || 0) === A.id);
  if (iA >= 0) v2[iA].mapValue.fields.available = { booleanValue: false };
  await api('/chusfish/catalog?updateMask.fieldPaths=products', { method: 'PATCH',
    body: JSON.stringify({ fields: { products: { arrayValue: { values: v2 } } } }) });

  const pa = await (await b.newContext({ viewport: { width: 1500, height: 1400 } })).newPage();
  pa.on('pageerror', e => errs.push('JS ROTO: ' + e.message.slice(0, 110)));
  pa.on('console', m => { const t = m.text();
    if (m.type() === 'error' && !/client is offline|status of 400/.test(t)) errs.push(t.slice(0, 110)); });
  await pa.goto('http://localhost:5000/admin.html', { waitUntil: 'load', timeout: 60000 });
  await pausa(3500);
  await pa.fill('#login-user', 'chussfish2022@gmail.com');
  await pa.fill('#login-pass', 'admin123');
  await pa.click('#login-btn');
  await pa.waitForFunction(() => firebase.auth().currentUser, { timeout: 30000 });
  await pausa(3500);
  await pa.evaluate(() => showView('dashboard'));
  await pa.waitForFunction(() => document.querySelectorAll('#viz-top .viz-bar').length > 0,
    { timeout: 30000 });
  await pausa(1500);

  /* ═══ 1. LOS NÚMEROS ═══ */
  console.log('  == 1. LA CUENTA ES CORRECTA ==');
  const cuenta = await pa.evaluate(a => {
    const t = vizDatos().top.find(x => String(x.id) === String(a));
    return t ? { qty: t.qty, monto: t.monto } : null;
  }, A.id);
  console.log('    ' + A.name + ': ' + JSON.stringify(cuenta));
  chk('suma los kilos de los pedidos vendidos', cuenta && cuenta.qty === 5,
      (cuenta || {}).qty + ' kg (esperado 5)');
  chk('NO cuenta el pendiente ni el cancelado', cuenta && cuenta.qty === 5,
      'con ellos serian 145 kg');
  chk('el monto cuadra', cuenta && cuenta.monto === A.price * 5,
      '₡' + (cuenta || {}).monto + ' vs ₡' + (A.price * 5));

  /* ═══ 2. LA GRÁFICA MUESTRA ESO ═══ */
  console.log('\n  == 2. LA GRAFICA MUESTRA LA CUENTA ==');
  const g = await pa.evaluate(() => ({
    barras: [...document.querySelectorAll('#viz-top .viz-bar')].map(x => ({
      nombre: (x.querySelector('.viz-bar-n') || {}).textContent,
      valor: (x.querySelector('.viz-bar-v') || {}).textContent,
      ancho: (x.querySelector('.viz-bar-f') || {}).style.width,
      color: getComputedStyle(x.querySelector('.viz-bar-f')).backgroundColor
    })),
    sub: (document.getElementById('viz-top-sub') || {}).textContent,
    haySvg: !!document.querySelector('#viz-sem svg'),
    puntos: document.querySelectorAll('#viz-sem .punto').length,
    ejes: [...document.querySelectorAll('#viz-sem .eje')].map(e => e.textContent)
  }));
  chk('la primera barra es la que mas vende', g.barras[0] && /5 kg/.test(g.barras[0].valor),
      g.barras[0] ? g.barras[0].nombre + ' ' + g.barras[0].valor : '');
  chk('la barra mas alta llena el 100%', g.barras[0] && g.barras[0].ancho === '100%',
      (g.barras[0] || {}).ancho);
  /* Un solo color para todas: pintar cada una segun su tamaño doblaria lo
     que el largo ya dice, y quema el unico canal libre. */
  const colores = new Set(g.barras.map(x => x.color));
  chk('TODAS LAS BARRAS DEL MISMO COLOR', colores.size === 1,
      colores.size + ' colores distintos');
  chk('el dato de la linea existe', g.haySvg && g.puntos === 8, g.puntos + ' puntos');
  chk('la linea rotula solo los extremos, no cada punto', g.ejes.length === 2,
      g.ejes.join(' … '));

  /* ═══ 3. LA TABLA: EL MISMO DATO SIN RATÓN ═══ */
  console.log('\n  == 3. "VER TABLA" DA LO MISMO QUE EL GLOBITO ==');
  const tabla = await pa.evaluate(async () => {
    vizTabla('top');
    await new Promise(k => setTimeout(k, 400));
    const t = document.getElementById('viz-top-tabla');
    const filas = [...t.querySelectorAll('tbody tr')].map(r =>
      [...r.querySelectorAll('td')].map(c => c.textContent));
    const btn = t.parentElement.querySelector('.viz-tabla-btn');
    return { visible: !t.hidden, filas, etiqueta: btn.textContent,
             cabeceras: [...t.querySelectorAll('th')].map(h => h.textContent) };
  });
  chk('la tabla se abre', tabla.visible === true);
  chk('con sus cabeceras', tabla.cabeceras.length === 3, tabla.cabeceras.join(' · '));
  chk('y trae el mismo numero que la barra',
      tabla.filas[0] && tabla.filas[0][1] === '5 kg', (tabla.filas[0] || [])[1]);
  chk('trae ADEMAS lo que solo estaba en el globito (el monto)',
      tabla.filas[0] && /₡/.test(tabla.filas[0][2]), (tabla.filas[0] || [])[2]);
  chk('el boton cambia a "Ocultar tabla"', /Ocultar/.test(tabla.etiqueta), tabla.etiqueta);

  /* ═══ 4. EL GLOBITO ═══ */
  console.log('\n  == 4. EL GLOBITO AL PASAR ==');
  const tip = await pa.evaluate(async () => {
    const bar = document.querySelector('#viz-top .viz-bar');
    const r = bar.getBoundingClientRect();
    bar.dispatchEvent(new PointerEvent('pointermove', { bubbles: true,
      clientX: r.left + 40, clientY: r.top + 5 }));
    await new Promise(k => setTimeout(k, 300));
    const t = document.querySelector('.viz-tip');
    const res = { on: t && t.classList.contains('on'), txt: t ? t.innerText.replace(/\n/g, ' · ') : '' };
    bar.dispatchEvent(new PointerEvent('pointerleave', { bubbles: true }));
    await new Promise(k => setTimeout(k, 200));
    res.seFue = !document.querySelector('.viz-tip').classList.contains('on');
    return res;
  });
  console.log('    ' + JSON.stringify(tip));
  chk('aparece al pasar por encima', tip.on === true);
  chk('lleva el valor y el nombre', /kg/.test(tip.txt) && tip.txt.length > 8, tip.txt.slice(0, 60));
  chk('y se va al salir', tip.seFue === true);

  /* ═══ 5. AGOTADOS: EL ROJO NUNCA VA SOLO ═══ */
  console.log('\n  == 5. AGOTADOS ==');
  const ago = await pa.evaluate(() => {
    const filas = [...document.querySelectorAll('#viz-agotados .viz-ago')];
    return {
      cuantos: filas.length,
      primero: filas[0] ? filas[0].innerText.replace(/\n/g, ' ') : '',
      tieneIcono: !!(filas[0] && filas[0].querySelector('.viz-ago-chip svg')),
      tienePalabra: !!(filas[0] && /agotado/i.test(filas[0].querySelector('.viz-ago-chip').textContent)),
      sub: (document.getElementById('viz-ago-sub') || {}).textContent
    };
  });
  console.log('    ' + JSON.stringify(ago));
  chk('lista el agotado', ago.cuantos >= 1, ago.cuantos + '');
  chk('EL ROJO LLEVA ICONO', ago.tieneIcono === true, 'sin icono, el color solo no se ve bajo daltonismo');
  chk('Y LLEVA LA PALABRA', ago.tienePalabra === true);
  chk('dice cuanto vendia (que es lo accionable)', /vendía ₡/.test(ago.primero), ago.primero);
  chk('y lo resume arriba', /se vendían/.test(ago.sub), ago.sub);

  /* ═══ 6. SIN VENTAS NO MIENTE ═══ */
  console.log('\n  == 6. SIN DATOS, LO DICE ==');
  const vacio = await pa.evaluate(() => {
    const guardados = orders.slice();
    orders.length = 0;
    renderVisualizaciones();
    const r = {
      top: (document.querySelector('#viz-top .viz-vacio') || {}).textContent || '',
      sem: (document.querySelector('#viz-sem .viz-vacio') || {}).textContent || ''
    };
    guardados.forEach(o => orders.push(o));
    renderVisualizaciones();
    return r;
  });
  chk('sin ventas lo explica en vez de dibujar cero',
      /Todavía no hay ventas/.test(vacio.top), vacio.top.slice(0, 60));
  chk('y la linea tambien', /Sin ventas/.test(vacio.sem), vacio.sem.slice(0, 50));

  console.log('\n  errores de JS: ' + (errs.length ? [...new Set(errs)].slice(0, 4).join(' | ') : 'ninguno'));
  chk('ni un error de JS', errs.length === 0, '');
  console.log('  ' + (mal ? '>>> ' + mal + ' FALLARON' : '>>> las graficas dicen la verdad y se pueden leer'));
  await b.close();
  process.exit(mal ? 1 : 0);
})();
