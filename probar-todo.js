/* Corre TODAS las pruebas, cada una con semilla recién puesta.
 *
 *   npm run probar
 *
 * Cada herramienta se corre A SOLAS y con `npm run seed` antes, porque
 * varias se pisan entre sí: una deja al cliente con otro saldo, otra
 * escribe puntos a propósito, y la semilla NO limpia `coupons`. Correrlas
 * seguidas sin sembrar da fallos falsos que cuestan una tarde.
 *
 * Sale con código 1 si alguna falla, así que sirve tal cual antes de subir.
 */
const { spawnSync } = require('child_process');
const path = require('path');

/* Estas dos NO tocan la base ni abren un navegador: leen los archivos.
   Van PRIMERO y sin sembrar, porque tardan dos segundos y cazan lo que
   si no descubririas a los quince minutos: un parentesis de mas, o una
   funcion que se llama y no existe. */
const ESTATICAS = [
  ['revisar-sintaxis.js',   'compila el JS de las paginas'],
  ['revisar-conexiones.js', 'esta todo conectado: handlers e ids'],
];

const PRUEBAS = [
  ['probar-reglas.js',              'las reglas de Firestore hacen lo que dicen'],
  ['probar-alta-admin.js',          'entrar con Google da el panel solo a quien debe'],
  ['auditar-puntos-y-descuentos.js','la aritmetica de puntos y descuentos'],
  ['probar-cupon-un-solo-uso.js',   'el cupon no se puede usar dos veces'],
  ['probar-cupon-por-producto.js',  'el descuento por producto se calcula sobre su linea'],
  ['probar-promo-de-productos.js',  'el aviso de promocion y el cupon reutilizable'],
  ['probar-form-cupones.js',        'el formulario de cupones del panel no engaña'],
  ['probar-cupon-huerfano.js',      'un cupon configurado que ya no existe se avisa'],
  ['probar-canjes-whatsapp.js',     'la factura desglosa y el canje trae mensaje'],
  ['probar-editar-pedido.js',       'editar pedido y factura, con los puntos ajustandose'],
  ['probar-dashboard.js',           'las graficas dicen la verdad y se pueden leer sin raton'],
  ['probar-avisos-pedido.js',       'cada paso del pedido avisa y el hero no miente'],
  ['probar-devolucion-de-canjes.js','se pueden devolver canjes ya resueltos'],
  ['probar-cancelar-pedido.js',     'cancelar un pedido lo deshace TODO'],
  ['probar-datos-en-perfil.js',     'el pedido deja telefono y direccion guardados'],
  ['probar-formulario-pedido.js',   'el formulario de pedido se llena sin scrollear media hora'],
  ['probar-carrito-atras.js',       'el carrito no se duplica y el gesto de atras no saca del sitio'],
  ['probar-guia.js',                'la guia del perfil, en sus seis estados'],
  ['probar-textos.js',              'lo que se promete es lo que de verdad pasa'],
  ['probar-recorrido-completo.js',  'una persona de cero a canjear, con los numeros cuadrando']
];

const correr = (cmd, args) =>
  spawnSync(cmd, args, { stdio: 'inherit', shell: true, cwd: __dirname }).status;

/* El sembrado se cae solo cada tanto —una de cada quince, mas o menos— con
   un fallo NATIVO de gRPC en Windows (0xC0000409, "stack buffer overrun"):
   el proceso muere a media faena, sin excepcion de JavaScript que atrapar.
   No es la base ni el codigo, y no vale la pena tumbar veinte minutos de
   pruebas por eso. Se reintenta, que es seguro porque sembrar borra y
   recarga. Si falla dos veces seguidas, ahi si pasa algo de verdad. */
const CRASH_NATIVO = -1073740791;
function sembrar() {
  for (let intento = 1; intento <= 3; intento++) {
    const r = correr('node', ['seed-emulador.js']);
    if (r === 0) return true;
    const nativo = r === CRASH_NATIVO;
    console.log('  (el sembrado ' + (nativo ? 'se cayo solo' : 'fallo con codigo ' + r) +
                (intento < 3 ? '; reintentando ' + intento + '/2)' : ')'));
  }
  return false;
}

(async () => {
  const t0 = Date.now();
  const fallaron = [];

  /* Primero las que no necesitan nada. Si un archivo no compila, no
     tiene sentido arrancar el navegador diecinueve veces para ver
     fallos en cascada que no dicen nada. */
  for (const [archivo, que] of ESTATICAS) {
    console.log('\n' + '='.repeat(66));
    console.log('  ' + archivo + '  —  ' + que);
    console.log('='.repeat(66));
    if (correr('node', [path.join('herramientas', archivo)]) !== 0)
      fallaron.push(archivo);
  }
  if (fallaron.length) {
    console.log('\n  >>> hay algo roto en los archivos. Se para aca.');
    fallaron.forEach(f => console.log('    · ' + f));
    process.exit(1);
  }

  for (const [archivo, que] of PRUEBAS) {
    console.log('\n' + '═'.repeat(66));
    console.log('  ' + archivo);
    console.log('  ' + que);
    console.log('═'.repeat(66));

    // Semilla nueva para cada una. probar-textos no toca la base, pero
    // sembrar igual sale gratis y evita tener que acordarse de la excepcion.
    if (!sembrar()) {
      console.log('  >>> no se pudo sembrar ni al tercer intento.');
      console.log('      Casi siempre es el emulador atascado: ver herramientas/LEEME.md');
      fallaron.push(archivo + ' (sembrado)');
      continue;
    }
    const r = correr('node', [path.join('herramientas', archivo)]);
    if (r !== 0) fallaron.push(archivo);
  }

  const mins = ((Date.now() - t0) / 60000).toFixed(1);
  console.log('\n' + '═'.repeat(66));
  if (fallaron.length) {
    console.log('  FALLARON ' + fallaron.length + ' de ' + PRUEBAS.length + ':');
    fallaron.forEach(f => console.log('    · ' + f));
  } else {
    console.log('  LAS ' + (PRUEBAS.length + ESTATICAS.length) + ' PRUEBAS PASARON');
  }
  console.log('  (' + mins + ' minutos)');
  console.log('═'.repeat(66));
  process.exit(fallaron.length ? 1 : 0);
})();
