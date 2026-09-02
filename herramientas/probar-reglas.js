const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext()).newPage();
  await p.goto('http://localhost:5000/mi-cuenta.html', { waitUntil:'commit' });
  await p.waitForTimeout(4000);

  const r = await p.evaluate(async () => {
    const auth = firebase.auth();
    const db = firebase.firestore();
    const res = [];

    async function probar(quien, desc, esperado, fn) {
      let ok, detalle = '';
      try { await fn(); ok = 'PERMITIDO'; }
      catch (e) { ok = 'BLOQUEADO'; detalle = (e.code || e.message || '').slice(0, 40); }
      res.push({ quien, desc, esperado, real: ok, bien: ok === esperado, detalle });
    }

    async function entrar(mail, pass) {
      await auth.signOut().catch(()=>{});
      if (!mail) return null;
      const c = await auth.signInWithEmailAndPassword(mail, pass);
      return c.user.uid;
    }

    // ═══ SIN SESION (cualquiera en internet) ═══
    await entrar(null);
    await probar('nadie', 'leer el catalogo', 'PERMITIDO',
      () => db.collection('chusfish').doc('catalog').get());
    await probar('nadie', 'leer la configuracion', 'PERMITIDO',
      () => db.collection('chusfish').doc('config').get());
    await probar('nadie', 'BORRAR el catalogo', 'BLOQUEADO',
      () => db.collection('chusfish').doc('catalog').set({ hackeado: true }));
    await probar('nadie', 'leer los clientes', 'BLOQUEADO',
      () => db.collection('users').get());
    await probar('nadie', 'leer los pedidos', 'BLOQUEADO',
      () => db.collection('orders').get());
    await probar('nadie', 'hacerse admin', 'BLOQUEADO',
      () => db.collection('admins').doc('yo').set({ name: 'hacker' }));

    // ═══ CLIENTE (Maria, 1250 puntos) ═══
    const uid = await entrar('maria@test.com', 'test123');
    await probar('cliente', 'ver su propia cuenta', 'PERMITIDO',
      () => db.collection('users').doc(uid).get());
    await probar('cliente', 'cambiar su telefono', 'PERMITIDO',
      () => db.collection('users').doc(uid).update({ phone: '88881111' }));
    await probar('cliente', 'REGALARSE puntos', 'BLOQUEADO',
      () => db.collection('users').doc(uid).update({ points: 999999 }));
    await probar('cliente', 'subirse el nivel', 'BLOQUEADO',
      () => db.collection('users').doc(uid).update({ lifetimePoints: 999999 }));
    await probar('cliente', 'escribir en su libro de puntos', 'BLOQUEADO',
      () => db.collection('users').doc(uid).collection('ledger').add({ points: 5000 }));
    await probar('cliente', 'espiar la cuenta de otro', 'BLOQUEADO',
      () => db.collection('users').doc('cliente-carlos').get());
    await probar('cliente', 'ver los premios', 'PERMITIDO',
      () => db.collection('rewards').get());
    await probar('cliente', 'crear/editar un premio', 'BLOQUEADO',
      () => db.collection('rewards').doc('premio-trucho').set({ name:'x', cost:1 }));
    await probar('cliente', 'hacerse admin', 'BLOQUEADO',
      () => db.collection('admins').doc(uid).set({ name: 'yo' }));
    await probar('cliente', 'tocar el catalogo', 'BLOQUEADO',
      () => db.collection('chusfish').doc('catalog').set({ x: 1 }));

    // ═══ ADMIN (tiene su documento en admins/) ═══
    const auid = await entrar('chussfish2022@gmail.com', 'admin123');
    await probar('admin', 'ver todos los clientes', 'PERMITIDO',
      () => db.collection('users').get());
    await probar('admin', 'ver todos los pedidos', 'PERMITIDO',
      () => db.collection('orders').get());
    await probar('admin', 'dar puntos a un cliente', 'PERMITIDO',
      () => db.collection('users').doc('cliente-carlos').update({ points: 496 }));
    await probar('admin', 'editar el catalogo', 'PERMITIDO',
      () => db.collection('chusfish').doc('catalog').update({ _prueba: Date.now() }));
    await probar('admin', 'editar un premio', 'PERMITIDO',
      () => db.collection('rewards').limit(1).get().then(s =>
            s.empty ? null : s.docs[0].ref.update({ _prueba: Date.now() })));
    await probar('admin', 'escribir en el libro de puntos', 'PERMITIDO',
      () => db.collection('users').doc('cliente-carlos').collection('ledger')
              .add({ type:'adjust', points:0, reason:'prueba de reglas' }));

    await auth.signOut().catch(()=>{});
    return res;
  });

  const mal = r.filter(x => !x.bien);
  let quien = '';
  r.forEach(x => {
    if (x.quien !== quien) { quien = x.quien; console.log('\n  ── ' + quien.toUpperCase() + ' ──'); }
    console.log('    ' + (x.bien ? 'OK  ' : 'MAL ') + x.desc.padEnd(32) +
      x.real.padEnd(11) + (x.bien ? '' : '(esperaba ' + x.esperado + ') ' + x.detalle));
  });
  console.log('\n  ' + (r.length - mal.length) + '/' + r.length + ' correctas' +
    (mal.length ? '   >>> ' + mal.length + ' MAL' : '   >>> las reglas hacen lo que dicen'));
  await b.close(); process.exit(mal.length ? 1 : 0);
})();
