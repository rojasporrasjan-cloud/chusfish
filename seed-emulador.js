/* ══════════════════════════════════════════════════════════════
   Chus's Fish — Sembrado de datos para el EMULADOR
   ──────────────────────────────────────────────────────────────
   Llena el emulador con datos de mentira para poder probar cuentas,
   puntos y canjes sin tocar la base real.

   Uso:
     1) npm run emu     (en otra terminal, dejalo corriendo)
     2) npm run seed

   Se puede correr las veces que quieras: pisa lo que haya.

   ⚠️ Tiene una guarda para que NUNCA escriba en produccion: si no
      detecta FIRESTORE_EMULATOR_HOST, se niega a correr.
   ══════════════════════════════════════════════════════════════ */

process.env.FIRESTORE_EMULATOR_HOST  = process.env.FIRESTORE_EMULATOR_HOST  || '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099';

// firebase-admin v14 ya no expone admin.firestore(): hay que usar los
// subpaths modulares.
const { initializeApp }            = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { getAuth }                  = require('firebase-admin/auth');

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  console.error('ABORTADO: no hay emulador. Este script jamas debe correr contra produccion.');
  process.exit(1);
}

initializeApp({ projectId: 'chus-fish' });
const db   = getFirestore();
const auth = getAuth();

/* ── Cuentas de prueba ──────────────────────────────────────── */
const CUENTAS = [
  { uid:'admin-jesus',  email:'chussfish2022@gmail.com', pass:'admin123', name:'Jesus (admin)', admin:true },
  { uid:'cliente-maria',email:'maria@test.com',  pass:'test123', name:'Maria Rodriguez', phone:'88881111',
    points:1250, lifetimePoints:1250, ordersCount:4, totalSpent:125000 },
  { uid:'cliente-carlos',email:'carlos@test.com',pass:'test123', name:'Carlos Jimenez', phone:'87772222',
    points:180,  lifetimePoints:180,  ordersCount:1, totalSpent:18000 },
  { uid:'cliente-nuevo',email:'nuevo@test.com', pass:'test123', name:'Ana Nueva', phone:'86663333',
    points:0,    lifetimePoints:0,    ordersCount:0, totalSpent:0 },
];

const PREMIOS = [
  // Ojo: NO hay premio de "envio gratis" — en Chus's Fish el envio ya es
  // gratis siempre, asi que regalarlo no seria ningun premio.
  // Los premios que son producto se llaman IGUAL que en el catalogo real:
  // asi `traer-catalogo.js` les encuentra su foto de verdad. Un premio que
  // no existe en el catalogo tampoco se lo podria entregar a nadie.
  { id:'p-desc2000', name:'₡2.000 de descuento',           cost:650,  stock:-1,
    cat:'Descuentos', order:1,
    desc:'₡2.000 menos en el total de tu proximo pedido.' },

  // El escalon de entrada: alcanzable en unos 6 pedidos. Sin algo barato
  // abajo, el programa se ve inalcanzable y la gente deja de mirarlo.
  { id:'p-desc5000', name:'₡5.000 de descuento',           cost:1650, stock:-1,
    cat:'Descuentos', order:2,
    desc:'₡5.000 menos en el total de tu proximo pedido.' },

  { id:'p-ceviche-medio', name:'1/2 kg de Picadura de Corvina', cost:2150, stock:-1,
    cat:'Producto gratis', order:3, img:'assets/ceviche_chus.jpg',
    desc:'Medio kilo de picadura fresca, lista para tu ceviche.' },

  { id:'p-pargo',    name:'Pargo entero de 1 kg',          cost:2650, stock:5,
    cat:'Producto gratis', order:4, img:'assets/pargo_entero.jpg',
    desc:'Un pargo entero fresco, listo para el horno o la parrilla.' },

  { id:'p-camaron',  name:'1/2 kg de Camaron Yumbo',       cost:4250, stock:10,
    cat:'Producto gratis', order:5, featured:true, img:'assets/camarones_gourmet.jpg',
    desc:'Medio kilo de camaron nacional, sin quimicos. El favorito de la casa.' },

  { id:'p-corvina',  name:'1 kg de Filete de Corvina P.P.',cost:4250, stock:3,
    cat:'Producto gratis', order:6, img:'assets/filete_corvina.jpg',
    desc:'El filete mas pedido del catalogo, de regalo.' },

  { id:'p-ceviche',  name:'1 kg de Picadura de Corvina',   cost:4350, stock:-1,
    cat:'Producto gratis', order:7, img:'assets/ceviche_chus.jpg',
    desc:'Un kilo de picadura fresca, lista para tu ceviche.' },

  { id:'p-agotado',  name:'Langosta entera',               cost:5600, stock:0,
    cat:'Experiencias', order:8, img:'assets/langosta_hielo.png',
    desc:'Para probar el estado "agotado" en la tienda.' },
];

const PRODUCTOS = [
  { id:1,  cat:'camarones-imp',  name:'Camaron Pelado Cultivado Semi-Mediano', price:8500,  unit:'/kg', badge:'Importado', img:'assets/camarones_gourmet.jpg', desc:'Listo para cocinar.' },
  { id:6,  cat:'camarones-nac',  name:'Camaron con Cabeza Yumbo',             price:21600, unit:'/kg', badge:'Nacional',  img:'assets/camarones_gourmet.jpg', desc:'14 piezas por kilo.' },
  { id:7,  cat:'camarones-nac',  name:'Camaron Yumbo',                        price:25500, unit:'/kg', badge:'Nacional',  img:'assets/camarones_gourmet.jpg', desc:'22 piezas por kilo.' },
  { id:11, cat:'filetes-premium',name:'Filete de Corvina P.P.',               price:18500, unit:'/kg', badge:'Premium',   img:'assets/filete_corvina.jpg',   desc:'El mas solicitado.' },
  { id:13, cat:'filetes-premium',name:'Filete de Mero',                       price:15500, unit:'/kg', badge:'Premium',   img:'assets/filete_corvina.jpg',   desc:'Textura superior.' },
  { id:20, cat:'pescado-entero', name:'Pargo Rojo Entero',                    price:12000, unit:'/kg', badge:'Nacional',  img:'assets/pargo_entero.jpg',     desc:'Fresco, para horno o parrilla.' },
  { id:30, cat:'picadura',       name:'Picadura para Ceviche',                price:7800,  unit:'/kg', badge:'Nacional',  img:'assets/ceviche_chus.jpg',     desc:'Lista para preparar.' },
  { id:59, cat:'mariscos',       name:'Pulpo Entero',                         price:14000, unit:'/kg', badge:'Nacional',  img:'assets/langosta_hielo.png',   desc:'Limpio y listo.' },
];

const ts = FieldValue.serverTimestamp;

// El campo `tier` es solo cache: la interfaz siempre lo recalcula desde
// lifetimePoints. Aun asi el sembrado lo deja coherente para no confundir.
function nivelDe(lp) {
  lp = Number(lp) || 0;
  if (lp >= 3000) return 'oro';
  if (lp >= 1000) return 'plata';
  return 'bronce';
}

async function limpiar(col) {
  const snap = await db.collection(col).get();
  const b = db.batch();
  snap.forEach(d => b.delete(d.ref));
  if (snap.size) await b.commit();
  return snap.size;
}

/* Borra las cuentas sueltas que van quedando de tanto probar el registro.
   Solo toca el emulador. */
async function limpiarCuentasHuerfanas() {
  const conocidos = CUENTAS.map(c => c.uid);
  let borrados = 0;

  const lista = await auth.listUsers(1000);
  for (const u of lista.users) {
    if (conocidos.includes(u.uid)) continue;
    try { await auth.deleteUser(u.uid); } catch (e) {}
    const led = await db.collection('users').doc(u.uid).collection('ledger').get();
    if (led.size) { const b = db.batch(); led.forEach(d => b.delete(d.ref)); await b.commit(); }
    await db.collection('users').doc(u.uid).delete().catch(() => {});
    borrados++;
  }

  // Y los perfiles sin usuario de Auth detras.
  const perfiles = await db.collection('users').get();
  for (const d of perfiles.docs) {
    if (conocidos.includes(d.id)) continue;
    await d.ref.delete().catch(() => {});
  }
  if (borrados) console.log('  (se borraron ' + borrados + ' cuentas sueltas de pruebas anteriores)');
}

async function main() {
  console.log('Sembrando el emulador (proyecto chus-fish)...\n');
  await limpiarCuentasHuerfanas();

  /* Usuarios de Auth + su doc en users/ */
  for (const c of CUENTAS) {
    try { await auth.deleteUser(c.uid); } catch (e) { /* no existia */ }

    // Un .set() sobre el doc NO borra sus subcolecciones: sin esto el ledger
    // arrastra movimientos de corridas anteriores y los totales salen mal.
    const viejos = await db.collection('users').doc(c.uid).collection('ledger').get();
    if (viejos.size) {
      const b = db.batch();
      viejos.forEach(d => b.delete(d.ref));
      await b.commit();
    }
    await auth.createUser({ uid:c.uid, email:c.email, password:c.pass, displayName:c.name });

    if (c.admin) {
      await db.collection('admins').doc(c.uid).set({ name:c.name, createdAt: ts() });
      console.log(`  admin    ${c.email}  /  ${c.pass}`);
    } else {
      await db.collection('users').doc(c.uid).set({
        name:c.name, email:c.email, phone:c.phone, address:'100m sur de la escuela', zone:'San Jose Centro',
        points:c.points, lifetimePoints:c.lifetimePoints, tier:nivelDe(c.lifetimePoints),
        ordersCount:c.ordersCount, totalSpent:c.totalSpent,
        role:'customer', createdAt: ts(),
        favs: c.uid === 'cliente-maria' ? [7, 11, 59] : [],
      });
      // Un asiento inicial para que el historial no salga vacio
      if (c.points > 0) {
        await db.collection('users').doc(c.uid).collection('ledger').add({
          type:'earn', points:c.points, reason:'Saldo inicial de prueba', createdAt: ts(),
        });
      }
      console.log(`  cliente  ${c.email}  /  ${c.pass}   (${c.points} pts)`);
    }
  }

  /* Catalogo y configuracion */
  await db.collection('chusfish').doc('catalog').set({ products: PRODUCTOS });
  await db.collection('chusfish').doc('config').set({
    closingEnabled:true,
    closingMessage:'MODO LOCAL · datos de prueba',
    bannerColor:'#c8a96e',
    // Envio GRATIS: las zonas existen para saber a donde se entrega,
    // no para cobrar. price 0 en todas.
    zones:[ { name:'San Jose Centro', active:true, price:0 },
            { name:'Desamparados',    active:true, price:0 },
            { name:'Escazu',          active:true, price:0 } ],
    featuredIds:[11,7,59,13],
    shippingFee:0,
    pointsEnabled:true,
    pointsPer100:1,
    welcomeBonus:100,
    tiers:[
      { id:'bronce', name:'Bronce', min:0,    mult:1.00, color:'#b87333',
        perk:'Acumulas puntos en cada compra.' },
      { id:'plata',  name:'Plata',  min:1000, mult:1.10, color:'#c0c9d4',
        perk:'10% mas de puntos en cada compra.' },
      { id:'oro',    name:'Oro',    min:3000, mult:1.25, color:'#e8c98a',
        perk:'25% mas de puntos y prioridad en tus pedidos.' },
    ],
    invoicePrefix:'Factura ', invoiceNext:1, invoicePad:6,
  });

  /* Premios */
  await limpiar('rewards');
  for (const p of PREMIOS) {
    const { id, ...rest } = p;
    await db.collection('rewards').doc(id).set({ ...rest, active:true, createdAt: ts() });
  }

  /* Pedidos de ejemplo, incluido uno listo para probar la acreditacion */
  await limpiar('orders');
  await limpiar('redemptions');

  await db.collection('orders').add({
    uid:'cliente-maria',
    customer:{ name:'Maria Rodriguez', phone:'88881111', address:'100m sur de la escuela',
               zone:'San Jose Centro', fecha:null, payment:'SINPE Movil' },
    items:[ { id:7, name:'Camaron Yumbo', qty:1, unit:'/kg', price:25500 },
            { id:11,name:'Filete de Corvina P.P.', qty:2, unit:'/kg', price:18500 } ],
    deliveryFee:0, status:'confirmado', createdAt: ts(),
  });

  await db.collection('orders').add({
    uid:'cliente-carlos',
    customer:{ name:'Carlos Jimenez', phone:'87772222', address:'Frente al parque',
               zone:'Desamparados', fecha:null, payment:'Efectivo' },
    items:[ { id:6, name:'Camaron con Cabeza Yumbo', qty:1, unit:'/kg', price:21600 } ],
    deliveryFee:0, status:'pendiente', createdAt: ts(),
  });

  /* Un canje pendiente para ver la vista de aprobacion */
  await db.collection('redemptions').add({
    uid:'cliente-maria', userName:'Maria Rodriguez', userPhone:'88881111',
    userEmail:'maria@test.com', rewardId:'p-ceviche-medio', rewardName:'1/2 kg de Picadura de Corvina',
    cost:2150, status:'solicitado', createdAt: ts(),
  });

  console.log('\nListo.');
  console.log('  Panel admin:  http://localhost:5000/admin.html   (usuario: admin)');
  console.log('  Emulador UI:  http://127.0.0.1:4000');
  process.exit(0);
}

main().catch(e => { console.error('Fallo el sembrado:', e); process.exit(1); });
