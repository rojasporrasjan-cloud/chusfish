/* ══════════════════════════════════════════════════════════════
   Chus's Fish — Traer el catálogo REAL al emulador
   ──────────────────────────────────────────────────────────────
   Copia `chusfish/catalog` y `chusfish/config` de produccion al
   emulador, para que en local se vea el sitio de verdad (los 68
   productos, sus fotos, las zonas, el banner) en vez de datos
   inventados.

   Qué NO se toca:
     · Produccion: solo se LEE. Nunca se escribe.
     · Clientes, pedidos, puntos y canjes siguen siendo de mentira,
       en el emulador. Nada de lo que pruebes sale de tu maquina.

   Solo se copian los dos documentos PUBLICOS del sitio (los que ya
   lee cualquier visitante). Ningun dato de clientes.

   Uso:
     1) npm run emu     (dejalo corriendo)
     2) node traer-catalogo.js
     3) npm run dev
   ══════════════════════════════════════════════════════════════ */

process.env.FIRESTORE_EMULATOR_HOST =
  process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';

const { initializeApp } = require('firebase-admin/app');
const { getFirestore }  = require('firebase-admin/firestore');

const PROYECTO = 'chus-fish';
const API_KEY  = 'AIzaSyCLFJ9xAWUw_M2UgkOUY467MmkbFe4lbIk';
const BASE = `https://firestore.googleapis.com/v1/projects/${PROYECTO}/databases/(default)/documents`;

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  console.error('ABORTADO: no hay emulador. Este script jamas debe escribir en produccion.');
  process.exit(1);
}

initializeApp({ projectId: PROYECTO });
const db = getFirestore();

/* La API REST devuelve cada valor etiquetado con su tipo
   ({stringValue}, {integerValue}, {arrayValue}...). Hay que
   desenvolverlo a JavaScript normal. */
function aJs(v) {
  if (v === null || v === undefined) return null;
  if ('nullValue'    in v) return null;
  if ('booleanValue' in v) return v.booleanValue;
  if ('stringValue'  in v) return v.stringValue;
  if ('integerValue' in v) return parseInt(v.integerValue, 10);
  if ('doubleValue'  in v) return Number(v.doubleValue);
  if ('timestampValue' in v) return new Date(v.timestampValue);
  if ('arrayValue'   in v) return (v.arrayValue.values || []).map(aJs);
  if ('mapValue'     in v) {
    const out = {};
    const f = v.mapValue.fields || {};
    for (const k of Object.keys(f)) out[k] = aJs(f[k]);
    return out;
  }
  return null;
}

async function traer(doc) {
  const r = await fetch(`${BASE}/chusfish/${doc}?key=${API_KEY}`);
  if (!r.ok) throw new Error(`No se pudo leer chusfish/${doc}: HTTP ${r.status}`);
  const j = await r.json();
  const campos = j.fields || {};
  const out = {};
  for (const k of Object.keys(campos)) out[k] = aJs(campos[k]);
  return out;
}

/* Busca el producto del catalogo que corresponde a un premio.
   Los premios se llaman "1 kg de Filete de Corvina P.P." o "1/2 kg de
   Camaron Yumbo": hay que quitarles la cantidad y comparar por palabras,
   sin tildes, porque el catalogo escribe "Camarón" y el premio "Camaron". */
function normalizar(s) {
  return String(s || '').toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')   // fuera tildes
    .replace(/\b\d+([.,/]\d+)?\s*(kg|g|kilos?|gramos?|lb|libras?|unidades?|und?)\b/g, '')
    .replace(/\bde\b|\bel\b|\bla\b|\blos\b|\blas\b|\bpara\b|\bcon\b|\bp\.?p\.?\b/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ').trim();
}

function productoParaPremio(nombrePremio, productos) {
  const pedido = normalizar(nombrePremio).split(' ').filter(w => w.length > 2);
  if (!pedido.length) return null;

  let mejor = null, mejorPunt = 0;
  for (const p of productos) {
    if (!p.img) continue;
    const palabras = normalizar(p.name).split(' ');
    // Cuantas palabras del premio aparecen en el nombre del producto.
    const aciertos = pedido.filter(w => palabras.includes(w)).length;
    if (aciertos > mejorPunt) { mejorPunt = aciertos; mejor = p; }
  }
  // Con una sola palabra suelta se equivoca ("descuento" no es un producto).
  return mejorPunt >= 2 ? mejor : null;
}

async function main() {
  console.log('Trayendo el catalogo real de produccion (solo lectura)...\n');

  /* ── Catalogo ── */
  const catalogo = await traer('catalog');
  const productos = catalogo.products || [];
  await db.collection('chusfish').doc('catalog').set({ products: productos });

  const conFoto = productos.filter(p => p.img).length;
  const cats = [...new Set(productos.map(p => p.cat))].filter(Boolean);
  console.log(`  Catalogo   ${productos.length} productos, ${conFoto} con foto, ${cats.length} categorias`);

  /* ── Configuracion ──
     Se conserva lo de fidelidad que ya tenga el emulador: en produccion
     todavia no existe, y si lo pisamos con vacio se rompe la prueba. */
  const realCfg = await traer('config');
  const snap = await db.collection('chusfish').doc('config').get();
  const local = snap.exists ? snap.data() : {};

  const CLAVES_FIDELIDAD = ['tiers', 'pointsPer100', 'pointsEnabled', 'welcomeBonus'];
  const cfg = Object.assign({}, realCfg);
  for (const k of CLAVES_FIDELIDAD) {
    if (cfg[k] === undefined && local[k] !== undefined) cfg[k] = local[k];
  }
  await db.collection('chusfish').doc('config').set(cfg);

  const zonas = cfg.zones || [];
  const cobran = zonas.filter(z => Number(z.price) > 0);
  console.log(`  Config     ${zonas.length} zonas, envio base ${cfg.shippingFee ?? '(sin definir)'}`);
  console.log(`  Fidelidad  ${CLAVES_FIDELIDAD.filter(k => realCfg[k] !== undefined).length}/4 claves ya en produccion`);

  /* ── Fotos de los premios ──
     El sembrado les pone imagenes de `assets/` (fondos y fotos de ambiente
     de la web), que NO son fotos de producto de Chus. En una demo delante
     del dueño eso canta: "15% de descuento" salia con un fondo decorativo.
     Como casi todo premio ES un producto del catalogo, se le pone la foto
     real del producto que le corresponde. */
  const premios = await db.collection('rewards').get();
  let repintados = 0, sinFoto = [];

  for (const doc of premios.docs) {
    const r = doc.data();
    const prod = productoParaPremio(r.name, productos);
    if (prod && prod.img && prod.img !== r.img) {
      await doc.ref.update({ img: prod.img });
      repintados++;
    } else if (!prod || !prod.img) {
      sinFoto.push(r.name);
    }
  }
  console.log(`  Premios    ${repintados} con foto real del catalogo`);
  if (sinFoto.length) {
    console.log(`             sin producto que calce: ${sinFoto.join(', ')}`);
    console.log(`             (normal en los que no son producto, como los descuentos)`);
  }

  console.log('\nListo. Los clientes, pedidos y puntos siguen siendo de prueba.');

  if (cobran.length) {
    console.log('\n  OJO: en produccion hay ' + cobran.length + ' zona(s) con costo de envio:');
    cobran.forEach(z => console.log(`        · ${z.name}: ${z.price}`));
    console.log('        Si el envio es gratis, hay que ponerlas en 0 desde el panel.');
  }
  if (Number(cfg.shippingFee) > 0) {
    console.log(`\n  OJO: shippingFee en produccion es ${cfg.shippingFee}, no 0.`);
  }
  process.exit(0);
}

main().catch(e => { console.error('Fallo:', e.message); process.exit(1); });
