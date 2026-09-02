const { chromium } = require('playwright');
const pausa = ms => new Promise(r => setTimeout(r, ms));
const COL = 'http://localhost:8080/v1/projects/chus-fish/databases/(default)/documents/admins';

const borrar = uid => fetch(COL + '/' + uid, { method:'DELETE', headers:{Authorization:'Bearer owner'} });
async function listar() {
  const j = await (await fetch(COL, { headers:{Authorization:'Bearer owner'} })).json();
  return (j.documents||[]).map(d => ({ uid: d.name.split('/').pop(),
    email: ((d.fields||{}).email||{}).stringValue || '?' }));
}

async function conGoogle(b, correo, nombre) {
  const ctx = await b.newContext({ viewport:{width:1300,height:900} });
  const p = await ctx.newPage();
  await p.goto('http://localhost:5000/admin.html', { waitUntil:'commit' });
  await pausa(4000);
  const [pop] = await Promise.all([
    ctx.waitForEvent('page',{timeout:15000}).catch(()=>null), p.click('#login-google')]);
  if (!pop) { await ctx.close(); return { err:'sin popup' }; }
  await pop.waitForLoadState('domcontentloaded');
  await pausa(1600);
  const txt = await pop.innerText('body').catch(()=>'');
  if (txt.indexOf(correo) >= 0) await pop.click('text=' + correo);
  else {
    await pop.click('text=Add new account'); await pausa(1200);
    await pop.fill('#email-input', correo);
    await pop.fill('#display-name-input', nombre);
    await pop.click('#sign-in');
  }
  await pausa(7000);
  const r = await p.evaluate(() => {
    const u = firebase.auth().currentUser;
    return { entro: getComputedStyle(document.getElementById('app')).display !== 'none',
             uid: u ? u.uid : null };
  });
  await ctx.close(); return r;
}

(async () => {
  const b = await chromium.launch();
  let mal = 0;
  const chk = (d, ok, x) => { if(!ok) mal++; console.log('    '+(ok?'OK  ':'MAL ')+d+(x?'   '+x:'')); };

  for (const a of await listar()) await borrar(a.uid);
  console.log('  admins/ vaciado -> ' + (await listar()).length + ' documentos');

  console.log('\n  ══ 1. Correo DE LA LISTA, con Google ══');
  let r = await conGoogle(b, 'rojasporrasjan@gmail.com', 'Jan Rojas');
  chk('entra al panel sin tocar la consola', r.entro === true);
  let a = await listar();
  chk('quedo dado de alta solo', a.length===1 && a[0].uid===r.uid, a[0] ? a[0].email : '');

  console.log('\n  ══ 2. Correo FUERA de la lista, con Google ══');
  r = await conGoogle(b, 'curioso@gmail.com', 'Curioso');
  chk('NO entra', r.entro === false);
  chk('NO se dio de alta', (await listar()).length === 1);

  console.log('\n  ══ 3. Correo DE LA LISTA pero con CONTRASEÑA ══');
  const ctx = await b.newContext(); const p2 = await ctx.newPage();
  await p2.goto('http://localhost:5000/admin.html', { waitUntil:'commit' });
  await pausa(4000);
  const r3 = await p2.evaluate(async () => {
    const au = firebase.auth(), d = firebase.firestore();
    await au.signOut().catch(()=>{});
    const u = (await au.signInWithEmailAndPassword('chussfish2022@gmail.com','admin123')).user;
    const prov = u.providerData.map(x=>x.providerId).join(',');
    try { await d.collection('admins').doc(u.uid).set({name:'yo'}); return {creo:true, prov}; }
    catch(e){ return {creo:false, code:e.code, prov}; }
  });
  chk('NO se da de alta entrando con contraseña', r3.creo === false, r3.code + '  (proveedor: ' + r3.prov + ')');

  console.log('\n  ══ 4. Intentos de abuso ══');
  const r4 = await p2.evaluate(async () => {
    const au = firebase.auth(), d = firebase.firestore();
    await au.signOut().catch(()=>{});
    await au.signInWithEmailAndPassword('maria@test.com','test123');
    const mio = au.currentUser.uid, res = {};
    try { await d.collection('admins').doc(mio).set({name:'x'}); res.propio='CREO'; } catch(e){ res.propio='bloqueado'; }
    try { await d.collection('admins').doc('otro-uid').set({name:'x'}); res.ajeno='CREO'; } catch(e){ res.ajeno='bloqueado'; }
    return res;
  });
  chk('un cliente no se da de alta a si mismo', r4.propio === 'bloqueado');
  chk('nadie crea el documento de OTRO uid', r4.ajeno === 'bloqueado');

  const uidAdmin = (await listar())[0].uid;
  const r5 = await p2.evaluate(async (uid) => {
    const d = firebase.firestore(), res = {};
    try { await d.collection('admins').doc(uid).update({name:'secuestrado'}); res.mod='MODIFICO'; } catch(e){ res.mod='bloqueado'; }
    try { await d.collection('admins').doc(uid).delete(); res.del='BORRO'; } catch(e){ res.del='bloqueado'; }
    return res;
  }, uidAdmin);
  chk('nadie modifica un admin existente', r5.mod === 'bloqueado');
  chk('nadie borra un admin existente', r5.del === 'bloqueado');

  console.log('\n  ══ 5. Volver a entrar no duplica nada ══');
  r = await conGoogle(b, 'rojasporrasjan@gmail.com', 'Jan Rojas');
  chk('entra igual', r.entro === true);
  chk('sigue habiendo un solo documento', (await listar()).length === 1);
  await ctx.close();

  console.log('\n  ' + (mal ? '>>> ' + mal + ' FALLARON' : '>>> las 10 correctas'));
  console.log('  admins/ al final: ' + JSON.stringify(await listar()));
  await b.close(); process.exit(mal?1:0);
})();
