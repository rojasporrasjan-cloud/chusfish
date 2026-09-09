/* ¿Está todo conectado? Los cables sueltos que este proyecto ya pagó.
 *
 * Tres veces se llamó a algo que no existía, y las tres el navegador se
 * lo tragó en silencio:
 *
 *   · `renderInvoice()` — no existía. Tiraba ReferenceError, el catch se
 *     lo comía, y la factura no se repintaba NUNCA. El descuento estaba
 *     en el campo pero no salía en el documento.
 *   · `lineasCarrito` — se llamaba y no estaba definida: un patch se
 *     abortó a mitad y se perdió el bloque.
 *   · `editarCupon` vs `editCupon` — el nombre de verdad tenía otra
 *     forma. La prueba "pasaba" sin comprobar nada.
 *
 * Un linter normal no los ve porque el JS vive dentro del HTML y los
 * handlers son atributos (`onclick="..."`), que son texto hasta que
 * alguien los toca.
 *
 * Revisa tres cosas:
 *   1. Cada `onclick`/`oninput`/… llama a una función que existe.
 *   2. Cada `getElementById('x')` tiene su elemento con ese id.
 *   3. Cada id del HTML está escrito una sola vez (dos elementos con el
 *      mismo id: el segundo es invisible para el código).
 *
 * No toca la base ni necesita servidor.
 *
 *   node herramientas/revisar-conexiones.js
 *   node herramientas/revisar-conexiones.js admin.html
 */
const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..');
const PAGINAS = ['index.html', 'catalogo.html', 'premios.html', 'mi-cuenta.html', 'admin.html'];
const COMPARTIDOS = ['auth.js', 'ui.js'];

/* Lo que el navegador trae puesto y no hay que declarar. */
const DEL_NAVEGADOR = new Set([
  'alert','confirm','prompt','open','close','print','fetch','setTimeout','setInterval',
  'clearTimeout','clearInterval','encodeURIComponent','decodeURIComponent','parseInt',
  'parseFloat','isNaN','String','Number','Boolean','Array','Object','JSON','Math','Date',
  'RegExp','Promise','Map','Set','console','document','window','history','location',
  'localStorage','sessionStorage','navigator','requestAnimationFrame','event','this',
  'firebase','return','if','else','var','let','const','function','new','typeof','void',
  'true','false','null','undefined'
]);

const ES_JS = t => !t || /^(text\/javascript|application\/javascript|module)$/i.test(t.trim());

/* El JS de una página: los <script> que de verdad son JavaScript. */
function jsDe(html) {
  let out = '';
  const re = /<script([^>]*)>([\s\S]*?)<\/script>/g;
  let m;
  while ((m = re.exec(html))) {
    if (/\ssrc\s*=/.test(m[1] || '')) continue;
    const tipo = ((m[1] || '').match(/type\s*=\s*["']([^"']+)["']/) || [])[1];
    if (!ES_JS(tipo)) continue;
    out += '\n' + m[2];
  }
  return out;
}

/* Los nombres que ese JS define: funciones, consts, lets, vars y
   asignaciones a window. */
function definidosEn(js) {
  const s = new Set();
  const patrones = [
    /\bfunction\s+([A-Za-z_$][\w$]*)/g,
    /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:function|\()/g,
    /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)/g,
    /\bwindow\.([A-Za-z_$][\w$]*)\s*=/g,
  ];
  patrones.forEach(re => { let m; while ((m = re.exec(js))) s.add(m[1]); });
  return s;
}

let problemas = 0;

function revisar(archivo, extra) {
  const ruta = path.join(RAIZ, archivo);
  if (!fs.existsSync(ruta)) return;
  const html = fs.readFileSync(ruta, 'utf8');
  const js = jsDe(html);
  const define = definidosEn(js);
  extra.forEach(n => define.add(n));

  const linea = i => html.slice(0, i).split('\n').length;
  const fallos = [];

  /* ── 1. Los handlers de los atributos ── */
  const vistos = new Set();
  const reH = /\son(?:click|input|change|submit|focus|blur|keyup|keydown)\s*=\s*"([^"]*)"/g;
  let m;
  while ((m = reH.exec(html))) {
    const cuerpo = m[1];
    /* Solo las llamadas SUELTAS. `algo.find(...)` es un metodo del
       objeto, no una funcion global: el punto de delante lo delata. */
    let f; const reF = /(^|[^.\w$])([A-Za-z_$][\w$]*)\s*\(/g;
    while ((f = reF.exec(cuerpo))) {
      const nombre = f[2];
      if (DEL_NAVEGADOR.has(nombre) || define.has(nombre)) continue;
      const clave = nombre + '@' + linea(m.index);
      if (vistos.has(clave)) continue;
      vistos.add(clave);
      fallos.push({ tipo: 'handler', que: nombre + '()', linea: linea(m.index),
                    ctx: cuerpo.trim().slice(0, 50) });
    }
  }

  /* ── 2. getElementById contra los ids del documento ── */
  const ids = new Set();
  let i2; const reId = /\sid\s*=\s*["']([^"']+)["']/g;
  while ((i2 = reId.exec(html))) ids.add(i2[1]);

  /* Los ids que el propio JS crea con innerHTML/createElement no están en
     el HTML: se recogen de las plantillas para no dar falsos positivos. */
  const reIdJs = /id\s*=\s*(?:\\?["'])([A-Za-z][\w-]*)/g;
  let i3; while ((i3 = reIdJs.exec(js))) ids.add(i3[1]);
  const reIdProp = /\.id\s*=\s*['"]([A-Za-z][\w-]*)['"]/g;
  let i4; while ((i4 = reIdProp.exec(js))) ids.add(i4[1]);

  const reGet = /getElementById\(\s*['"]([^'"]+)['"]\s*\)/g;
  const vistosId = new Set();
  let g;
  while ((g = reGet.exec(js))) {
    const id = g[1];
    if (ids.has(id) || vistosId.has(id)) continue;
    vistosId.add(id);
    fallos.push({ tipo: 'id', que: '#' + id, linea: null,
                  ctx: 'getElementById sin elemento' });
  }

  /* ── 3. Ids repetidos ──
     Solo en el HTML DE VERDAD. Dentro de una plantilla de JS dos ramas
     pueden llevar el mismo id —la guia del perfil tiene una version
     entera y otra encogida— y solo una se pinta: eso no es un choque. */
  const sinScripts = html.replace(/<script[\s\S]*?<\/script>/g, '');
  const cuenta = {};
  let i5; const reId2 = /\sid\s*=\s*["']([^"']+)["']/g;
  while ((i5 = reId2.exec(sinScripts))) cuenta[i5[1]] = (cuenta[i5[1]] || 0) + 1;
  Object.keys(cuenta).filter(k => cuenta[k] > 1).forEach(k => {
    fallos.push({ tipo: 'dup', que: '#' + k, linea: null,
                  ctx: cuenta[k] + ' veces — el código solo ve el primero' });
  });

  if (!fallos.length) {
    console.log('  ' + archivo.padEnd(18) + 'todo conectado');
    return;
  }
  problemas += fallos.length;
  console.log('  ' + archivo);
  fallos.forEach(f => {
    const donde = f.linea ? ' (linea ' + f.linea + ')' : '';
    console.log('     ' + (f.tipo === 'handler' ? 'NO EXISTE  ' :
                           f.tipo === 'id' ? 'SIN ELEMENTO ' : 'ID REPETIDO ') +
                f.que + donde + '  —  ' + f.ctx);
  });
}

/* auth.js y ui.js exponen cosas que las paginas usan. */
const deFuera = [];
COMPARTIDOS.forEach(f => {
  const r = path.join(RAIZ, f);
  if (!fs.existsSync(r)) return;
  definidosEn(fs.readFileSync(r, 'utf8')).forEach(n => deFuera.push(n));
});
/* Y lo que se publica por objeto (CF.x, CFUI.x) se usa con punto, que el
   detector de handlers no confunde con una funcion suelta. */

const pedidas = process.argv.slice(2);
(pedidas.length ? pedidas : PAGINAS).forEach(f => revisar(f, deFuera));

console.log(problemas ? '\n  >>> ' + problemas + ' CABLES SUELTOS'
                      : '\n  >>> no hay cables sueltos');
process.exit(problemas ? 1 : 0);
