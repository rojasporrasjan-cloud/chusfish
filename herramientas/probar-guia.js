/* Comprueba la guía de primeros pasos del perfil.
 *
 * La guía no es un texto fijo: cada paso se marca con datos reales del
 * cliente y se mueve sola cuando Jesús confirma un pedido. Eso es
 * justamente lo que se puede romper sin que nadie lo note, porque la
 * página sigue cargando igual.
 *
 * Necesita el emulador y el servidor local (`npm run emu` y `npm run dev`).
 * Corré `npm run seed` antes.
 *
 *   node herramientas/probar-guia.js
 */
const { chromium, devices } = require('playwright');
const pausa = ms => new Promise(r => setTimeout(r, ms));
const D = 'http://localhost:8080/v1/projects/chus-fish/databases/(default)/documents';

(async () => {
  const b = await chromium.launch();
  let mal = 0; const errs = [];
  const chk = (d, ok, x) => { if (!ok) mal++; console.log('    ' + (ok ? 'OK  ' : 'MAL ') + d + (x ? '   ' + x : '')); };

  async function abrir(etiqueta) {
    const ctx = await b.newContext({ ...devices['iPhone 12'] });
    const p = await ctx.newPage();
    p.on('pageerror', e => errs.push(etiqueta + ' ' + e.message.slice(0, 90)));
    p.on('console', m => {
      // "client is offline" es ruido del emulador al reconectar, no un fallo.
      const t = m.text();
      if (m.type() === 'error' && !/client is offline/.test(t)) errs.push(etiqueta + ' ' + t.slice(0, 90));
    });
    await p.goto('http://localhost:5000/mi-cuenta.html', { waitUntil: 'commit' });
    await pausa(5000);
    return { ctx, p };
  }
  const entrar = (p, correo, clave) => p.evaluate(async a => {
    await firebase.auth().signOut().catch(() => {});
    await firebase.auth().signInWithEmailAndPassword(a.c, a.k);
  }, { c: correo, k: clave || 'test123' });

  const leer = p => p.evaluate(() => {
    const g = document.querySelector('.guia');
    if (!g) return { hay: false };
    return {
      hay: true,
      encogida: g.classList.contains('lista'),
      contador: (g.querySelector('.guia-h b') || {}).textContent || '',
      alto: Math.round(g.getBoundingClientRect().height),
      avisoVisible: (function(){ var f = document.getElementById('fill-box');
        return f ? (!f.hidden && f.innerHTML.trim() !== '') : false; })(),
      pasos: [...g.querySelectorAll('.guia-paso')].map(x => ({
        t: (x.querySelector('b') || {}).textContent || '',
        d: (x.querySelector('small') || {}).textContent || '',
        ok: x.classList.contains('ok'), ahora: x.classList.contains('ahora'),
        btn: (x.querySelector('.guia-btn') || {}).textContent || null
      }))
    };
  });
  const dibujo = r => r.pasos.map(x => (x.ok ? '✓' : x.ahora ? '→' : '·') + ' ' + x.t).join('  |  ');

  /* ═══ 1. RECIÉN REGISTRADO, SIN TELÉFONO NI DIRECCIÓN ═══ */
  console.log('  == 1. RECIEN REGISTRADO, SIN DATOS ==');
  let s = await abrir('NUEVO');
  const uid = await s.p.evaluate(async c => {
    await firebase.auth().signOut().catch(() => {});
    const u = await CF.signUpEmail(c, 'clave1234', 'Guia', '', '', '');
    return (u && u.uid) || firebase.auth().currentUser.uid;
  }, 'guia' + Date.now() + '@test.com');
  await pausa(7000);
  let r = await leer(s.p);
  chk('la guia aparece', r.hay === true);
  chk('son 5 pasos', r.pasos.length === 5, r.pasos.length + ' pasos');
  chk('la cuenta ya cuenta como hecha', r.pasos[0] && r.pasos[0].ok === true);
  chk('el pendiente es completar los datos', r.pasos[1] && r.pasos[1].ahora === true, r.contador);
  chk('y DICE QUE LE FALTA, no "completá tus datos" a secas',
      /teléfono/i.test(r.pasos[1].d) && /dirección/i.test(r.pasos[1].d), r.pasos[1].d);
  chk('no repite el aviso de arriba', r.avisoVisible === false);
  chk('lleva el contador', /1 de 5/.test(r.contador), r.contador);
  console.log('    ' + dibujo(r));

  /* ═══ 2. EL BOTÓN LLEVA A MIS DATOS ═══ */
  console.log('\n  == 2. EL BOTON LLEVA A DONDE DICE ==');
  const salto = await s.p.evaluate(async () => {
    const b = document.querySelector('.guia-btn[data-ir]');
    if (!b) return { hay: false };
    b.click();
    await new Promise(k => setTimeout(k, 900));
    const on = document.querySelector('.mi.on');
    return { hay: true, menuActivo: on ? on.getAttribute('data-tab') : null };
  });
  chk('el paso actual trae boton', salto.hay === true);
  chk('deja Mis datos como la opcion activa', salto.menuActivo === 'datos', String(salto.menuActivo));

  /* ═══ 3. LA EXPLICACIÓN ═══ */
  console.log('\n  == 3. "¿COMO FUNCIONA?" ==');
  const txt = await s.p.evaluate(async () => {
    const m = document.getElementById('guia-mas');
    if (!m) return null;
    m.click();
    await new Promise(k => setTimeout(k, 500));
    const d = document.getElementById('guia-det');
    return { abierto: !d.hidden, etiqueta: m.textContent.trim(),
             txt: (d.innerText || '').replace(/\s+/g, ' ') };
  });
  chk('se abre', txt && txt.abierto === true);
  chk('el boton cambia a "Ocultar"', txt.etiqueta === 'Ocultar', txt.etiqueta);
  chk('explica cuanto vale un punto', /₡100/.test(txt.txt) && /1 punto/.test(txt.txt));
  chk('explica que se acreditan al confirmar', /confirma/.test(txt.txt));
  chk('explica que canjear no baja de nivel', /no<?/.test(txt.txt) && /nivel/.test(txt.txt));
  chk('explica La Reserva de punta a punta',
      /salen de tu saldo/.test(txt.txt) && /devuelve los puntos/.test(txt.txt));

  /* ═══ 4. SE MUEVE SOLA CUANDO JESÚS CONFIRMA ═══ */
  console.log('\n  == 4. SE MUEVE SOLA ==');
  await fetch(D + '/users/' + uid +
    '?updateMask.fieldPaths=phone&updateMask.fieldPaths=address' +
    '&updateMask.fieldPaths=ordersCount&updateMask.fieldPaths=lifetimePoints&updateMask.fieldPaths=points',
    { method: 'PATCH', headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields: {
        phone: { stringValue: '88887777' }, address: { stringValue: 'Frente al parque' },
        ordersCount: { integerValue: '1' }, lifetimePoints: { integerValue: '400' },
        points: { integerValue: '400' } } }) });
  await pausa(6000);
  r = await leer(s.p);
  chk('marca datos, pedido y puntos sin recargar',
      r.pasos[1].ok && r.pasos[2].ok && r.pasos[3].ok, dibujo(r));
  chk('el pendiente pasa a ser La Reserva', r.pasos[4] && r.pasos[4].ahora === true);
  chk('con su boton a los premios', /Reserva/.test(r.pasos[4].btn || ''), String(r.pasos[4].btn));
  chk('el contador va en 4 de 5', /4 de 5/.test(r.contador), r.contador);
  await s.ctx.close();

  /* ═══ 5. QUIEN YA RECORRIÓ TODO ═══ */
  console.log('\n  == 5. CLIENTA COMPLETA (Maria) ==');
  s = await abrir('MARIA');
  await entrar(s.p, 'maria@test.com');
  await pausa(8000);
  r = await leer(s.p);
  chk('SE ENCOGE a una linea', r.encogida === true && r.alto < 60, r.alto + 'px de alto');
  chk('no le repite los pasos', r.pasos.length === 0);
  const abre = await s.p.evaluate(async () => {
    const m = document.getElementById('guia-mas');
    if (!m) return false;
    m.click();
    await new Promise(k => setTimeout(k, 400));
    return !document.getElementById('guia-det').hidden;
  });
  chk('pero puede abrir la explicacion', abre === true);

  /* ═══ 6. SIN SESIÓN NO ESTORBA ═══ */
  console.log('\n  == 6. SIN SESION ==');
  await s.p.evaluate(() => firebase.auth().signOut());
  await pausa(2500);
  const fuera = await s.p.evaluate(() => {
    const bx = document.getElementById('guia-box');
    return { visible: bx ? bx.offsetParent !== null : null,
             puertaGanar: (document.getElementById('gate-ganar') || {}).innerText || '' };
  });
  chk('la guia no se le muestra a quien no entro', fuera.visible === false);
  chk('pero la PUERTA si explica La Reserva',
      /Reserva/.test(fuera.puertaGanar) && /devuelve/.test(fuera.puertaGanar),
      fuera.puertaGanar.replace(/\s+/g, ' ').slice(-90));
  await s.ctx.close();

  console.log('\n  errores: ' + (errs.length ? errs.slice(0, 3).join(' | ') : 'ninguno'));
  console.log('  ' + (mal ? '>>> ' + mal + ' FALLARON' : '>>> la guia funciona en los seis estados'));
  await b.close();
  process.exit(mal ? 1 : 0);
})();
