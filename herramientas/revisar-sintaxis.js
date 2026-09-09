/* ¿Compila el JavaScript de las páginas?
 *
 * Este proyecto tiene todo el JS metido en las páginas, así que un
 * paréntesis de más no lo caza ningún linter: lo caza el cliente, con la
 * página en blanco. Esto lo revisa en dos segundos.
 *
 * Salta los <script> que NO son JavaScript —el JSON-LD de SEO, sobre
 * todo—: son datos, y pasarlos por `new Function` da un falso "roto" que
 * ya me hizo perder el rato buscando un fallo que no existía.
 *
 *   node herramientas/revisar-sintaxis.js
 *   node herramientas/revisar-sintaxis.js catalogo.html
 */
const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..');
const POR_DEFECTO = ['index.html', 'catalogo.html', 'premios.html',
                     'mi-cuenta.html', 'admin.html'];
const SUELTOS = ['auth.js', 'ui.js', 'sw.js'];

/* Un <script> es JavaScript si no declara type, o si declara uno de estos.
   `application/ld+json`, `text/template` y demas NO se compilan. */
const ES_JS = t => !t || /^(text\/javascript|application\/javascript|module)$/i.test(t.trim());

let malos = 0;

function revisarPagina(archivo) {
  const ruta = path.join(RAIZ, archivo);
  if (!fs.existsSync(ruta)) return;
  const h = fs.readFileSync(ruta, 'utf8');
  const re = /<script([^>]*)>([\s\S]*?)<\/script>/g;
  let m, i = 0, revisados = 0;

  while ((m = re.exec(h))) {
    i++;
    const attrs = m[1] || '';
    const cuerpo = m[2] || '';
    if (/\ssrc\s*=/.test(attrs)) continue;          // externo: no hay nada que compilar
    const tipo = (attrs.match(/type\s*=\s*["']([^"']+)["']/) || [])[1];
    if (!ES_JS(tipo)) continue;                      // JSON-LD y compañía
    if (!cuerpo.trim()) continue;
    revisados++;

    try { new Function(cuerpo); }
    catch (e) {
      malos++;
      const linea = h.slice(0, m.index).split('\n').length;
      console.log('  ' + archivo + ': bloque ' + i + ' (linea ' + linea + ') NO COMPILA');
      console.log('     ' + e.message);
      /* Se parte el bloque para señalar la línea culpable: sin esto hay
         que ir a ojo por miles de líneas. */
      const L = cuerpo.split('\n');
      for (let k = 1; k <= L.length; k++) {
        try { new Function(L.slice(0, k).join('\n')); }
        catch (err) {
          if (!/Unexpected end|Unterminated/.test(err.message)) {
            console.log('     -> linea ' + (linea + k) + ': ' + L[k - 1].trim().slice(0, 90));
            break;
          }
        }
      }
    }
  }
  console.log('  ' + archivo.padEnd(18) + revisados + ' bloque(s) de JS');
}

function revisarSuelto(archivo) {
  const ruta = path.join(RAIZ, archivo);
  if (!fs.existsSync(ruta)) return;
  try { new Function(fs.readFileSync(ruta, 'utf8')); console.log('  ' + archivo.padEnd(18) + 'ok'); }
  catch (e) { malos++; console.log('  ' + archivo + ' NO COMPILA: ' + e.message); }
}

const pedidos = process.argv.slice(2);
const paginas = pedidos.length ? pedidos.filter(f => f.endsWith('.html')) : POR_DEFECTO;
const sueltos = pedidos.length ? pedidos.filter(f => f.endsWith('.js')) : SUELTOS;

paginas.forEach(revisarPagina);
sueltos.forEach(revisarSuelto);

console.log(malos ? '\n  >>> ' + malos + ' NO COMPILAN' : '\n  >>> todo compila');
process.exit(malos ? 1 : 0);
