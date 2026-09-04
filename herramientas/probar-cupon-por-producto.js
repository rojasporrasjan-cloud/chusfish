const { chromium, devices } = require('playwright');
const pausa = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch();
  let mal=0; const chk=(d,ok,x)=>{if(!ok)mal++;console.log('    '+(ok?'OK  ':'MAL ')+d+(x?'   '+x:''));};
  const p = await (await b.newContext({ ...devices['iPhone 12'] })).newPage();
  await p.goto('http://localhost:5000/catalogo.html',{waitUntil:'commit'});
  await pausa(6000);
  const r = await p.evaluate(()=>{
    const C = (extra) => Object.assign({ type:'percent', value:20, active:true }, extra);
    // pedido: camaron 12.000 + corvina 38.000 = 50.000
    const lineas = [{id:7,total:12000},{id:11,total:38000}];
    const v = (cup, sub, li) => CF.validarCupon(cup, { subtotal:sub, lineas:li||lineas, usosDelCliente:0, esPrimeraCompra:true });
    return {
      sinProducto:     v(C({}), 50000).descuento,
      soloCamaron:     v(C({productIds:[7]}), 50000).descuento,
      soloCorvina:     v(C({productIds:[11]}), 50000).descuento,
      dosProductos:    v(C({productIds:[7,11]}), 50000).descuento,
      productoAusente: v(C({productIds:[99]}), 50000),
      montoMayorQueLinea: v(C({type:'amount', value:30000, productIds:[7]}), 50000).descuento,
      conMinimoOk:     v(C({productIds:[7], minOrder:20000}), 50000).descuento,
      conMinimoNo:     v(C({productIds:[7], minOrder:60000}), 50000).ok
    };
  });
  console.log('    pedido: camaron ₡12.000 + corvina ₡38.000 = ₡50.000');
  Object.entries(r).forEach(([k,v])=>console.log('      '+k.padEnd(20)+JSON.stringify(v)));
  chk('sin productos: 20% del pedido = ₡10.000', r.sinProducto===10000);
  chk('solo camaron: 20% de ₡12.000 = ₡2.400', r.soloCamaron===2400);
  chk('solo corvina: 20% de ₡38.000 = ₡7.600', r.soloCorvina===7600);
  chk('los dos: 20% de ₡50.000 = ₡10.000', r.dosProductos===10000);
  chk('si el producto no esta, se rechaza y lo explica',
      r.productoAusente.ok===false && /producto/i.test(r.productoAusente.motivo), r.productoAusente.motivo);
  chk('monto fijo no se pasa de la linea (₡30.000 sobre ₡12.000)', r.montoMayorQueLinea===12000);
  chk('el minimo mira el PEDIDO, no la linea', r.conMinimoOk===2400);
  chk('bajo el minimo del pedido se rechaza', r.conMinimoNo===false);
  console.log('  '+(mal?'>>> '+mal+' FALLARON':'>>> la aritmetica por producto es correcta'));
  await b.close(); process.exit(0);
})();
