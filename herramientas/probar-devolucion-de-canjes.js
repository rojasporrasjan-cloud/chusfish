const { chromium } = require('playwright');
const pausa = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch();
  let mal=0; const errs=[];
  const chk=(d,ok,x)=>{if(!ok)mal++;console.log('    '+(ok?'OK  ':'MAL ')+d+(x?'   '+x:''));};
  const p = await (await b.newContext({ viewport:{width:1500,height:1000} })).newPage();
  p.on('pageerror', e=>errs.push('PAGEERROR '+e.message.slice(0,90)));
  p.on('console', m=>{if(m.type()==='error')errs.push(m.text().slice(0,90));});
  p.on('dialog', d=>d.accept('Salio malo'));

  await p.goto('http://localhost:5000/admin.html',{waitUntil:'commit'});
  await pausa(3000);
  await p.fill('#login-user','chussfish2022@gmail.com');
  await p.fill('#login-pass','admin123');
  await p.click('#login-btn');
  await p.waitForFunction(()=>firebase.auth().currentUser,{timeout:30000});
  await pausa(3000);

  const saldo = () => p.evaluate(async ()=>(await db.collection('users').doc('cliente-maria').get()).data().points);

  // canje ya ENTREGADO (el caso que antes no tenia salida)
  // El canje lo crea el CLIENTE por regla (uid == auth.uid), asi que desde
  // el panel no se puede: se siembra por la API del emulador.
  const REST='http://localhost:8080/v1/projects/chus-fish/databases/(default)/documents/redemptions';
  const crea = await (await fetch(REST+'?documentId=DEVOL-TEST',{method:'POST',
    headers:{Authorization:'Bearer owner','Content-Type':'application/json'},
    body:JSON.stringify({fields:{
      uid:{stringValue:'cliente-maria'}, userName:{stringValue:'Maria Rodriguez'},
      rewardName:{stringValue:'Premio X'}, cost:{integerValue:'600'},
      status:{stringValue:'entregado'}, createdAt:{stringValue:new Date().toISOString()}}})})).json();
  const id = 'DEVOL-TEST';
  await p.evaluate(async ()=>{ await db.collection('users').doc('cliente-maria').update({ points: 1250 }); });
  await pausa(1500);
  await p.evaluate(()=>showView('canjes'));
  await pausa(3000);

  console.log('  == 1. HAY BOTON EN UN CANJE ENTREGADO ==');
  // La vista abre en PENDIENTES y este canje esta ENTREGADO: hay que
  // cambiar de pestaña para que aparezca.
  const hay = await p.evaluate(async ()=> {
    const b = document.querySelector('.rd-filter[data-filter="entregado"]');
    if (b) { b.click(); await new Promise(r=>setTimeout(r,1500)); }
    const v = document.getElementById('view-canjes');
    return (v.innerHTML||'').indexOf('devolverCanje') >= 0;
  });
  chk('aparece "Devolver puntos"', hay===true);

  console.log('\n  == 2. DEVUELVE LOS PUNTOS ==');
  const antes = await saldo();
  await p.evaluate(async i => { await devolverCanje(i); await new Promise(r=>setTimeout(r,3500)); }, id);
  await pausa(3000);
  const desp = await saldo();
  chk('el saldo sube en el costo del canje', desp === antes + 600, antes+' -> '+desp);

  const est = await p.evaluate(async i => (await db.collection('redemptions').doc(i).get()).data().status, id);
  chk('el canje queda marcado como devuelto', est==='devuelto', est);

  const libro = await p.evaluate(async ()=>{
    const s = await db.collection('users').doc('cliente-maria').collection('ledger')
      .orderBy('createdAt','desc').limit(1).get();
    return s.docs.map(d=>{const x=d.data();return (x.points>0?'+':'')+x.points+' '+x.reason;});
  });
  chk('queda el asiento en su libro', libro.length && /Canje devuelto/.test(libro[0]), libro.join(''));

  console.log('\n  == 3. NO SE PUEDE DEVOLVER DOS VECES ==');
  const antes2 = await saldo();
  await p.evaluate(async i => { await devolverCanje(i); await new Promise(r=>setTimeout(r,2500)); }, id);
  await pausa(2500);
  const desp2 = await saldo();
  chk('el segundo intento no regala nada', desp2===antes2, antes2+' -> '+desp2);

  console.log('\n  errores: '+(errs.length?errs.slice(0,3).join(' | '):'ninguno'));
  console.log('  '+(mal?'>>> '+mal+' FALLARON':'>>> se pueden devolver canjes ya resueltos'));
  await b.close(); process.exit(0);
})();
