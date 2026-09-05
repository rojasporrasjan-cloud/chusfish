/* Que ningún texto siga prometiendo lo que el código ya no hace.
 *
 * Esta prueba nació porque una revisión encontró CUATRO textos que habían
 * quedado de versiones viejas. No rompen nada: la página carga igual. Solo
 * mienten, y siempre en el peor momento —justo donde la persona decide.
 *
 *   · Los puntos pasaron de acreditarse AL ENTREGAR a AL CONFIRMAR, y
 *     cuatro sitios seguían diciendo "al entregarse". Uno de ellos es el
 *     que lee JESÚS en el panel.
 *   · Los puntos del canje pasaron de salir AL APROBAR a salir AL
 *     CONFIRMAR, pero la ficha del premio prometía lo contrario.
 *   · Un canje rechazado decía "Tus puntos no se descontaron". Sí se
 *     descontaron, y se devolvieron.
 *
 * Necesita el servidor local (`npm run dev`). No toca la base.
 *
 *   node herramientas/probar-textos.js
 */
const { chromium, devices } = require('playwright');
const fs = require('fs');
const path = require('path');
const pausa = ms => new Promise(r => setTimeout(r, ms));
const RAIZ = path.join(__dirname, '..');
const PAGINAS = ['index.html', 'catalogo.html', 'premios.html', 'mi-cuenta.html', 'admin.html'];

/* Texto viejo -> por qué ya no es cierto. Se busca en el HTML, ignorando
   comentarios (ahí el texto viejo se cita a propósito para explicarlo). */
const VIEJOS = [
  ['al entregarse',
   'los puntos se acreditan al CONFIRMAR, no al entregar'],
  ['marcas el pedido como <b>entregado</b>',
   'lo mismo, en la pantalla que lee Jesus'],
  ['solo cuando Jesús aprueba el canje',
   'los puntos del canje salen al CONFIRMARLO'],
  ['Tus puntos no se descontaron',
   'si se descontaron al pedir el canje, y se devuelven al rechazarlo'],
  ['no al solicitarlo',
   'es justo al solicitarlo cuando salen']
];

(async () => {
  let mal = 0;
  const chk = (d, ok, x) => { if (!ok) mal++; console.log('    ' + (ok ? 'OK  ' : 'MAL ') + d + (x ? '   ' + x : '')); };

  /* ── 1. Ningún texto viejo quedó suelto ── */
  console.log('  == NINGUN TEXTO VIEJO QUEDO SUELTO ==');
  const limpio = {};
  for (const f of PAGINAS) {
    limpio[f] = fs.readFileSync(path.join(RAIZ, f), 'utf8')
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/\/\*[\s\S]*?\*\//g, '');
  }
  for (const [texto, porque] of VIEJOS) {
    const donde = PAGINAS.filter(f => limpio[f].indexOf(texto) >= 0);
    chk('"' + texto.slice(0, 40) + '"', donde.length === 0,
        donde.length ? 'sigue en ' + donde.join(', ') + '  —  ' + porque : '');
  }

  /* ── 2. Y los tres sitios dicen lo mismo ── */
  console.log('\n  == LOS TRES SITIOS CUENTAN LO MISMO ==');
  const b = await chromium.launch();
  const ctx = await b.newContext({ ...devices['iPhone 12'] });
  const p = await ctx.newPage();
  const rotos = [];
  p.on('pageerror', e => rotos.push(e.message.slice(0, 90)));

  const texto = async (url, sel) => {
    await p.goto('http://localhost:5000/' + url, { waitUntil: 'commit' });
    await pausa(7000);
    return p.evaluate(s => {
      const e = document.querySelector(s);
      return e ? (e.innerText || '').replace(/\s+/g, ' ') : '';
    }, sel);
  };

  const reserva = await texto('premios.html', '.how');
  chk('La Reserva: los puntos caen al confirmar el pedido',
      /confirma el pedido/i.test(reserva), reserva.slice(0, 70));
  chk('La Reserva: al canjear, los puntos salen ahi mismo',
      /salen ahí mismo/i.test(reserva));

  const perfil = await texto('mi-cuenta.html', '#p-puntos .pasos');
  chk('Perfil: los puntos caen al confirmar el pedido',
      /confirma el pedido/i.test(perfil), perfil.slice(0, 70));

  const puerta = await texto('mi-cuenta.html', '#gate-ganar');
  chk('La puerta explica La Reserva de punta a punta',
      /salen de tu saldo/i.test(puerta) && /devuelve/i.test(puerta),
      puerta.slice(-70));
  chk('La puerta dice cuando se acreditan',
      /confirmamos el pedido/i.test(puerta));

  /* ── 3. La ficha del premio, que es donde se decide ── */
  console.log('\n  == LA FICHA DEL PREMIO (donde se decide) ==');
  await p.goto('http://localhost:5000/premios.html', { waitUntil: 'commit' });
  await pausa(8000);
  const ficha = await p.evaluate(async () => {
    const c = document.querySelector('[data-abrir]');
    if (!c) return null;
    c.click();
    await new Promise(k => setTimeout(k, 1800));
    const q = [...document.querySelectorAll('.fact-q')].find(x => /Sobre los puntos/i.test(x.textContent));
    if (!q) return '';
    q.click();
    await new Promise(k => setTimeout(k, 500));
    return (q.parentElement.querySelector('.fact-a').innerText || '').replace(/\s+/g, ' ');
  });
  chk('la ficha se puede abrir', ficha !== null, ficha === null ? 'no hay premios sembrados' : '');
  if (ficha) {
    chk('dice que los puntos salen AL CONFIRMAR', /al confirmar el canje/i.test(ficha));
    chk('NO promete lo contrario', !/solo cuando Jesús aprueba/i.test(ficha));
    chk('avisa que si no se entrega se devuelven', /devuelve/i.test(ficha));
    chk('recuerda que canjear no baja de nivel', /no te baja de nivel/i.test(ficha));
  }

  chk('ninguna pagina tiro errores de JS', rotos.length === 0, rotos.slice(0, 2).join(' | '));

  console.log('\n  ' + (mal ? '>>> ' + mal + ' FALLARON' : '>>> lo que se promete es lo que pasa'));
  await b.close();
  process.exit(mal ? 1 : 0);
})();
