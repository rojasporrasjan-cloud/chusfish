/* El formulario de pedido: que se pueda llenar sin scrollear media hora.
 *
 * De dónde viene: con la config REAL de producción (18 zonas y 8 fechas),
 * el formulario medía 2.290px sobre una pantalla de 664px — 3,4 pantallas
 * de scroll. Las zonas solas eran 847px y las fechas 244px: entre las dos,
 * el 48% del formulario. Y el total vivía arriba del todo, así que para
 * ver cuánto se iba a pagar había que volver a subir.
 *
 * Ahora zona y fecha son desplegables de 62px, y el total vive en una
 * barra pegada abajo que se despliega para ver el desglose.
 *
 * **Corré `npm run catalogo` antes para probarlo con las zonas de verdad.**
 * Con la semilla hay solo 3 zonas y el problema no se ve.
 *
 *   npm run seed && node herramientas/probar-formulario-pedido.js
 */
const { chromium, devices } = require('playwright');
const pausa = ms => new Promise(r => setTimeout(r, ms));
const D = 'http://localhost:8080/v1/projects/chus-fish/databases/(default)/documents';

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

  await p.goto('http://localhost:5000/catalogo.html', { waitUntil: 'commit' });
  await pausa(9000);

  /* ── 1. Cuánto scroll ── */
  console.log('  == CUANTO SCROLL HAY QUE HACER ==');
  const m = await p.evaluate(async () => {
    const x = PRODUCTS.find(q => q.price > 0);
    addToCart(x, 2); openCartOrderForm();
    await new Promise(k => setTimeout(k, 4500));
    const inner = document.querySelector('.order-form-inner');
    const bar = document.getElementById('of-bar');
    const caja = document.querySelector('.order-form-box').getBoundingClientRect();
    return {
      pantalla: innerHeight,
      formulario: Math.round(inner.scrollHeight),
      barra: Math.round(bar.getBoundingClientRect().height),
      pegada: bar.getBoundingClientRect().bottom <= caja.bottom + 2,
      total: (document.getElementById('of-bar-tot') || {}).textContent || '',
      puntos: (document.getElementById('of-bar-pts') || {}).innerText.replace(/\s+/g, ' ').trim(),
      zona: Math.round(document.getElementById('of-zone-field').getBoundingClientRect().height),
      fecha: (() => { const f = document.getElementById('of-date-field');
        return f.style.display === 'none' ? null : Math.round(f.getBoundingClientRect().height); })()
    };
  });
  const pantallas = m.formulario / m.pantalla;
  console.log('    formulario ' + m.formulario + 'px / pantalla ' + m.pantalla + 'px = ' +
              pantallas.toFixed(1) + ' pantallas');
  console.log('    zona ' + m.zona + 'px  ·  fecha ' + (m.fecha === null ? 'sin fechas' : m.fecha + 'px') +
              '  ·  barra ' + m.barra + 'px');
  chk('el formulario cabe en menos de 2 pantallas', pantallas < 2.0, pantallas.toFixed(1));
  chk('la zona ocupa UNA linea, no una pantalla', m.zona < 110, m.zona + 'px');
  chk('la fecha tambien', m.fecha === null || m.fecha < 110, (m.fecha || 0) + 'px');
  chk('la barra no se come la pantalla', m.barra < m.pantalla * 0.32,
      m.barra + 'px = ' + Math.round(m.barra / m.pantalla * 100) + '%');
  chk('el TOTAL se ve sin scrollear', /\d/.test(m.total), m.total);
  chk('los PUNTOS se ven sin scrollear', /puntos/i.test(m.puntos), m.puntos.slice(0, 55));
  chk('la barra queda pegada abajo', m.pegada === true);

  /* ── 2. El desplegable de zonas ── */
  console.log('\n  == EL DESPLEGABLE DE ZONAS ==');
  const cuantasZonas = await p.evaluate(() => (window.ZONAS_PEDIDO || []).length);
  const z = await p.evaluate(async () => {
    document.getElementById('of-zone-btn').click();
    await new Promise(k => setTimeout(k, 900));   // el scroll suave tarda
    const lista = document.getElementById('of-zone-list');
    const barra = document.getElementById('of-bar').getBoundingClientRect();
    const r = lista.getBoundingClientRect();
    return { abierto: !document.getElementById('of-zone-pop').hidden,
             opciones: lista.querySelectorAll('.of-op').length,
             primera: (lista.querySelector('.of-op') || {}).innerText || '',
             /* Lo que de verdad importa: que se VEA. Estar en el DOM no
                basta — la lista llegó a abrirse debajo de la barra del
                total, y no se veía nada. */
             visible: Math.round(Math.min(r.bottom, barra.top) - Math.max(r.top, 0)),
             alto: Math.round(r.height) };
  });
  console.log('    ' + z.opciones + ' zonas, se ven ' + z.visible + ' de ' + z.alto + 'px de lista');
  chk('abre la lista', z.abierto === true);
  chk('estan todas las zonas', z.opciones === cuantasZonas, z.opciones + ' de ' + cuantasZonas);
  chk('cada zona dice su costo de envio', /gratis|₡/i.test(z.primera), z.primera.replace(/\n/g, ' · '));
  /* Con pocas zonas la lista es corta y se ve entera; con muchas, la
     propia lista scrollea y basta con que se vea un buen pedazo. */
  chk('LA LISTA SE VE (no tapada por la barra)',
      z.visible >= Math.min(z.alto - 4, 140),
      'se ven ' + z.visible + ' de ' + z.alto + 'px');

  /* ── 3. El buscador, sin tildes ── */
  console.log('\n  == EL BUSCADOR ==');
  const busca = q => p.evaluate(async t => {
    const inp = document.getElementById('of-zone-q');
    inp.value = t;
    inp.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise(k => setTimeout(k, 350));
    return [...document.querySelectorAll('#of-zone-list .of-op')]
      .map(o => o.childNodes[0].textContent.trim());
  }, q);
  const primeraZona = z.primera.split('\n')[0].trim();
  const pedazo = primeraZona.slice(0, 4).toLowerCase();
  const r1 = await busca(pedazo);
  chk('busca por pedacito', r1.length > 0, '"' + pedazo + '" -> ' + r1.join(', '));
  /* Sin tildes: se busca la version sin acentos de la primera zona. */
  const sinAcento = primeraZona.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const r2 = await busca(sinAcento);
  chk('encuentra aunque se escriba sin tildes', r2.length > 0,
      '"' + sinAcento + '" -> ' + r2.join(', '));
  await busca('zzzzz');
  const nada = await p.evaluate(() => (document.querySelector('.of-nada') || {}).innerText || '');
  chk('si no hay, lo explica en vez de dejar el hueco', /No encontramos/i.test(nada),
      nada.replace(/\s+/g, ' ').slice(0, 60));

  /* ── 4. Elegir aplica el envío ── */
  console.log('\n  == ELEGIR ZONA ==');
  const el = await p.evaluate(async () => {
    const inp = document.getElementById('of-zone-q');
    inp.value = ''; inp.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise(k => setTimeout(k, 300));
    const op = document.querySelector('#of-zone-list .of-op');
    const nombre = op.childNodes[0].textContent.trim();
    op.click();
    await new Promise(k => setTimeout(k, 700));
    return { nombre, texto: document.getElementById('of-zone-txt').textContent,
             cerrado: document.getElementById('of-zone-pop').hidden,
             valor: document.getElementById('of-zone-val').value };
  });
  chk('se cierra al elegir', el.cerrado === true);
  chk('el boton muestra la zona elegida', el.texto === el.nombre, el.texto);
  chk('queda guardada para el pedido', el.valor === el.nombre, el.valor);

  /* ── 5. La fecha ── */
  console.log('\n  == LA FECHA ==');
  const f = await p.evaluate(async () => {
    const campo = document.getElementById('of-date-field');
    if (campo.style.display === 'none') return { sinFechas: true };
    document.getElementById('of-date-btn').click();
    await new Promise(k => setTimeout(k, 800));
    const ops = [...document.querySelectorAll('#of-date-list .of-op')];
    const texto = ops.map(o => o.innerText.replace(/\s+/g, ' ').trim());
    ops[0].click();
    await new Promise(k => setTimeout(k, 600));
    return { cuantas: ops.length, texto: texto.slice(0, 3),
             elegida: document.getElementById('of-date-txt').textContent,
             valor: document.getElementById('of-date-val').value,
             cerrado: document.getElementById('of-date-pop').hidden };
  });
  if (f.sinFechas) console.log('    (la config no tiene dias de entrega)');
  else console.log('    ' + f.cuantas + ' fechas: ' + f.texto.join(' | '));
  chk('se lee el dia entero, no un numero suelto',
      f.sinFechas || /lunes|martes|miércoles|jueves|viernes|sábado|domingo/i.test(f.texto[0] || ''),
      (f.texto || [])[0]);
  chk('se cierra al elegir', f.sinFechas || f.cerrado === true);
  /* El valor que viaja a WhatsApp sigue siendo el corto de siempre: si
     cambia, a Jesus le cambia el mensaje que lee todos los dias. */
  chk('el valor que viaja sigue siendo el corto',
      f.sinFechas || /^\S{3} \d+ \S{3}$/.test(f.valor), f.valor);

  /* ── 6. El desglose ── */
  console.log('\n  == EL DESGLOSE SE ABRE Y SE CIERRA ==');
  const d = await p.evaluate(async () => {
    const tap = document.getElementById('of-bar-tap');
    const det = document.getElementById('of-bar-det');
    tap.click();
    await new Promise(k => setTimeout(k, 400));
    const abierto = { visible: !det.hidden, txt: det.innerText.replace(/\s+/g, ' '),
                      etiqueta: document.getElementById('of-bar-ver').textContent };
    tap.click();
    await new Promise(k => setTimeout(k, 400));
    return { abierto, cerrado: det.hidden,
             etiquetaFinal: document.getElementById('of-bar-ver').textContent };
  });
  chk('se abre', d.abierto.visible === true);
  chk('muestra los productos y el desglose',
      /Tu pedido/.test(d.abierto.txt) && /Subtotal/.test(d.abierto.txt) && /Env/.test(d.abierto.txt),
      d.abierto.txt.slice(0, 70));
  chk('la etiqueta cambia a Ocultar', d.abierto.etiqueta === 'Ocultar', d.abierto.etiqueta);
  chk('se vuelve a cerrar', d.cerrado === true);
  chk('y la etiqueta vuelve', d.etiquetaFinal === 'Ver desglose', d.etiquetaFinal);

  /* ── 7. Si falta algo, lo sube a la vista ── */
  console.log('\n  == SI FALTA UN DATO, LO LLEVA A LA VISTA ==');
  const v = await p.evaluate(async () => {
    document.getElementById('of-name').value = '';
    document.getElementById('of-address').value = 'Casa amarilla';
    document.getElementById('of-phone').value = '86001122';
    document.querySelector('.order-form-inner').scrollTop = 9999;
    await new Promise(k => setTimeout(k, 300));
    const antes = document.querySelector('.order-form-inner').scrollTop;
    document.querySelector('.order-form-submit').click();
    await new Promise(k => setTimeout(k, 1000));
    const nom = document.getElementById('of-name');
    const r = nom.getBoundingClientRect();
    return { antes, despues: document.querySelector('.order-form-inner').scrollTop,
             marcado: nom.classList.contains('of-error'),
             aLaVista: r.top > 0 && r.bottom < innerHeight };
  });
  chk('marca el campo que falta', v.marcado === true);
  chk('Y LO SUBE A LA VISTA', v.aLaVista === true, 'scroll ' + v.antes + ' -> ' + v.despues);

  /* ── 8. El pedido sale con zona y fecha ── */
  console.log('\n  == EL PEDIDO SALE CON ZONA Y FECHA ==');
  await p.evaluate(() => { document.getElementById('of-name').value = 'Prueba Formulario'; });
  await p.evaluate(() => document.querySelector('.order-form-submit').click()).catch(() => {});
  await pausa(12000);
  const j = await (await fetch(D + '/orders', { headers: { Authorization: 'Bearer owner' },
    signal: AbortSignal.timeout(15000) })).json();
  const mio = (j.documents || []).filter(o => {
    const c = ((o.fields || {}).customer || {}).mapValue;
    return c && ((c.fields || {}).name || {}).stringValue === 'Prueba Formulario'; })[0];
  chk('el pedido se guardo', !!mio);
  if (mio) {
    const c = mio.fields.customer.mapValue.fields || {};
    const zona = (c.zone || {}).stringValue || '';
    const fec  = (c.fecha || {}).stringValue || '';
    console.log('    zona "' + zona + '"  ·  fecha "' + fec + '"');
    chk('lleva la ZONA que se eligio', zona === el.nombre, zona || '(vacia)');
    chk('lleva la FECHA que se eligio', f.sinFechas || !!fec, fec || '(vacia)');
  }

  console.log('\n  errores de JS: ' + (errs.length ? [...new Set(errs)].slice(0, 4).join(' | ') : 'ninguno'));
  chk('ni un error de JS', errs.length === 0, '');
  console.log('  ' + (mal ? '>>> ' + mal + ' FALLARON' : '>>> el formulario se llena sin pelear'));
  await b.close();
  process.exit(mal ? 1 : 0);
})();
