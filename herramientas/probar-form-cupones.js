/* El formulario de cupones del panel. Lo que Jesús toca de verdad.
 *
 * Las pruebas de cupones comprobaban la ARITMÉTICA pero nadie tocaba el
 * formulario, y ahí estaba la trampa que le costó a Jesús su primera
 * promoción: el campo "Usos por cliente" venía en 1, así que el cupón
 * dejaba de aplicar en el segundo pedido del mismo cliente.
 *
 * También comprueba la instrucción que se le dio: que abrir su cupón ya
 * creado y volver a guardarlo lo deje sin límite. Si eso no fuera cierto,
 * la instrucción sería falsa y él se quedaría igual.
 *
 * Necesita el emulador y el servidor local. Corré `npm run seed` antes.
 *
 *   node herramientas/probar-form-cupones.js
 */
const { chromium } = require('playwright');
const pausa = ms => new Promise(r => setTimeout(r, ms));
const D = 'http://localhost:8080/v1/projects/chus-fish/databases/(default)/documents';
const api = (r, o) => fetch(D + r, Object.assign(
  { headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(15000) }, o || {}))
  .catch(e => { throw new Error('el emulador no contesto (' + e.name + '). Ver LEEME.md'); });

const VIEJO = 'PROMOVIEJA';

(async () => {
  const b = await chromium.launch();
  let mal = 0; const errs = [];
  const chk = (d, ok, x) => { if (!ok) mal++; console.log('    ' + (ok ? 'OK  ' : 'MAL ') + d + (x ? '   ' + x : '')); };

  /* El cupón tal como lo dejó Jesús: promoción, pero con 1 uso por cliente. */
  await api('/coupons/' + VIEJO, { method: 'PATCH', body: JSON.stringify({ fields: {
    type: { stringValue: 'percent' }, value: { integerValue: '5' },
    minOrder: { integerValue: '6400' }, maxDiscount: { integerValue: '0' },
    usageLimit: { integerValue: '-1' }, perUserLimit: { integerValue: '1' },
    firstOrderOnly: { booleanValue: false }, active: { booleanValue: true },
    promo: { booleanValue: true }, usedCount: { integerValue: '0' },
    productIds: { arrayValue: { values: [] } }
  } }) });
  /* Y la config apuntandolo, que es de donde el panel saca el interruptor
     de "avisar al entrar al catalogo" (el campo `promo` del cupon no lo
     lee nadie: el que manda es chusfish/config.promoCoupon). Sin esto el
     montaje no seria el de Jesus. */
  await api('/chusfish/config?updateMask.fieldPaths=promoCoupon', { method: 'PATCH',
    body: JSON.stringify({ fields: { promoCoupon: { stringValue: VIEJO } } }) });

  const pa = await (await b.newContext({ viewport: { width: 1500, height: 1100 } })).newPage();
  pa.on('pageerror', e => errs.push('JS ROTO: ' + e.message.slice(0, 110)));
  pa.on('console', m => { const t = m.text();
    if (m.type() === 'error' && !/client is offline|status of 400/.test(t)) errs.push(t.slice(0, 110)); });
  pa.on('dialog', d => d.accept());

  await pa.goto('http://localhost:5000/admin.html', { waitUntil: 'load', timeout: 60000 });
  await pausa(3500);
  await pa.fill('#login-user', 'chussfish2022@gmail.com');
  await pa.fill('#login-pass', 'admin123');
  await pa.click('#login-btn');
  await pa.waitForFunction(() => firebase.auth().currentUser, { timeout: 30000 });
  await pausa(4000);
  await pa.evaluate(() => showView('cupones'));
  await pausa(3000);

  /* ═══ 1. LOS CAMPOS ESTÁN ═══ */
  console.log('  == 1. EL FORMULARIO TIENE LO QUE HACE FALTA ==');
  const campos = await pa.evaluate(() => ({
    peruser: !!document.getElementById('cup-peruser'),
    nota:    !!document.getElementById('cup-peruser-nota'),
    promo:   !!document.getElementById('cup-promo'),
    prods:   !!document.getElementById('cup-prods-abrir'),
    ayuda:   [...document.querySelectorAll('.help-tip')]
               .map(x => x.getAttribute('data-tip') || '').join(' | ')
  }));
  chk('esta el campo de usos por cliente', campos.peruser);
  chk('y su nota explicativa', campos.nota);
  chk('esta el interruptor de promocion', campos.promo);
  chk('el aviso del interruptor dice lo que HOY pasa',
      /una vez al día/i.test(campos.ayuda), 'decia "una vez por persona"');
  chk('y que filtra el catalogo', /filtra el catálogo/i.test(campos.ayuda));

  /* ═══ 2. UN CUPÓN NUEVO: ENCENDER PROMO LO DEJA SIN LÍMITE ═══ */
  console.log('\n  == 2. CUPON NUEVO: ENCENDER PROMO = SIN LIMITE ==');
  const nuevo = await pa.evaluate(async () => {
    if (typeof resetCuponForm === 'function') resetCuponForm();
    await new Promise(k => setTimeout(k, 600));
    const antes = document.getElementById('cup-peruser').value;
    const t = document.getElementById('cup-promo');
    t.checked = true;
    t.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise(k => setTimeout(k, 600));
    return { antes, despues: document.getElementById('cup-peruser').value,
             nota: (document.getElementById('cup-peruser-nota') || {}).textContent || '' };
  });
  console.log('    usos por cliente: ' + nuevo.antes + ' -> ' + nuevo.despues);
  chk('venia en 1 (la trampa vieja)', nuevo.antes === '1', nuevo.antes);
  chk('al encender la promo PASA A 0', nuevo.despues === '0', nuevo.despues);
  chk('y lo explica en castellano', /sin límite/i.test(nuevo.nota), nuevo.nota);

  /* Si lo pone a mano en 2, la nota lo dice y NO se lo pisa */
  const aMano = await pa.evaluate(async () => {
    const c = document.getElementById('cup-peruser');
    c.value = '2';
    c.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise(k => setTimeout(k, 600));
    return { valor: c.value,
             nota: (document.getElementById('cup-peruser-nota') || {}).textContent || '' };
  });
  chk('si lo pone en 2 a mano, NO se lo pisa', aMano.valor === '2', aMano.valor);
  chk('y la nota lo dice', /2 veces/i.test(aMano.nota), aMano.nota);

  /* El -1 se cuela facil: es lo que dice el campo de ARRIBA (usos totales).
     El validador lo acepta como sin limite —comprueba `> 0`— asi que la
     nota tiene que decir eso y no "-1 veces". */
  const menosUno = await pa.evaluate(async () => {
    const c = document.getElementById('cup-peruser');
    c.value = '-1';
    c.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise(k => setTimeout(k, 600));
    return (document.getElementById('cup-peruser-nota') || {}).textContent || '';
  });
  chk('el -1 se entiende como SIN LIMITE', /sin límite/i.test(menosUno), menosUno);
  chk('y NO dice la tonteria de "-1 veces"', !/-1 veces/.test(menosUno), menosUno);

  /* ═══ 3. LA INSTRUCCIÓN QUE SE LE DIO A JESÚS ═══ */
  console.log('\n  == 3. ABRIR SU CUPON VIEJO Y GUARDARLO LO ARREGLA ==');
  const abierto = await pa.evaluate(async cod => {
    // La funcion se llama editCupon (sin "ar"); es la del boton "Editar".
    if (typeof editCupon !== 'function') return { err: 'no existe editCupon' };
    /* editCupon sale sin hacer nada si el cupon todavia no llego a la
       lista local (cfCoupons se llena por snapshot). Con el emulador
       cargado eso tarda mas, y la prueba leia el formulario con lo que
       tuviera puesto de antes: dio un falso fallo en la bateria. Se
       espera el DATO, no el reloj. */
    for (let i = 0; i < 40; i++) {
      if ((cfCoupons || []).some(x => x.id === cod)) break;
      await new Promise(k => setTimeout(k, 300));
    }
    if (!(cfCoupons || []).some(x => x.id === cod))
      return { err: 'el cupon no llego a la lista del panel' };
    editCupon(cod);
    await new Promise(k => setTimeout(k, 1800));
    return { code: document.getElementById('cup-code').value,
             promo: document.getElementById('cup-promo').checked,
             peruser: document.getElementById('cup-peruser').value,
             nota: (document.getElementById('cup-peruser-nota') || {}).textContent || '' };
  }, VIEJO);
  console.log('    ' + JSON.stringify(abierto));
  chk('se abrio el cupon de Jesus', abierto.code === VIEJO, abierto.err || abierto.code);
  chk('sigue marcado como promocion', abierto.promo === true);
  chk('AL ABRIRLO YA QUEDA EN 0 (la instruccion es cierta)',
      abierto.peruser === '0', 'quedo en ' + abierto.peruser);

  const guardado = await pa.evaluate(async () => {
    const b = [...document.querySelectorAll('button')]
      .find(x => /guardar/i.test(x.textContent) && x.offsetParent !== null);
    if (!b) return { err: 'no encontre el boton de guardar' };
    b.click();
    await new Promise(k => setTimeout(k, 4000));
    return { ok: true };
  });
  chk('se pudo guardar', !guardado.err, guardado.err || '');
  await pausa(2500);

  const enBase = await (await api('/coupons/' + VIEJO)).json();
  const pu = ((enBase.fields || {}).perUserLimit || {}).integerValue;
  console.log('    en la base quedo perUserLimit = ' + pu);
  chk('Y EN LA BASE QUEDA SIN LIMITE', Number(pu) === 0, String(pu));
  chk('sin perder que es promocion',
      (((enBase.fields || {}).promo || {}).booleanValue) === true);
  chk('ni el minimo de compra',
      Number(((enBase.fields || {}).minOrder || {}).integerValue) === 6400,
      String(((enBase.fields || {}).minOrder || {}).integerValue));

  console.log('\n  errores de JS: ' + (errs.length ? [...new Set(errs)].slice(0, 4).join(' | ') : 'ninguno'));
  chk('ni un error de JS en el panel', errs.length === 0, '');
  console.log('  ' + (mal ? '>>> ' + mal + ' FALLARON' : '>>> el formulario de cupones no engaña'));
  await b.close();
  process.exit(mal ? 1 : 0);
})();
