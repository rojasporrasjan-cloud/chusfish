/* ══════════════════════════════════════════════════════════════
   Chus's Fish — Navegación móvil compartida
   ──────────────────────────────────────────────────────────────
   Inyecta en TODAS las páginas:
     · barra de pestañas abajo (solo móvil): Inicio · Catálogo · Buscar · Mi cuenta
     · hoja de búsqueda a pantalla completa, con las categorías visibles
     · barra de carrito flotante sobre las pestañas

   Se carga DESPUÉS de auth.js (necesita CF.db y CF.esc).

   ⚠️ netlify.toml cachea /*.js como immutable por 1 AÑO.
      Al tocar este archivo hay que subir el ?v= en TODOS los HTML.
      Versión actual: v13
   ══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* Sin CF (el SDK de Firebase no llego) igual se dibuja la barra de
     pestañas: navegar es lo minimo que tiene que seguir funcionando.
     Antes ui.js se rendia entero y el telefono quedaba sin menu abajo,
     sin forma de ir a otra seccion.
     Lo que necesita datos —buscar y el carrito— se apaga solo. */
  var HAY_CF = typeof window.CF !== 'undefined';
  if (false) {
    console.error('[CFUI] auth.js no está cargado antes de ui.js');
    return;
  }

  var WA = 'https://wa.me/50660017370';

  /* Las mismas categorías del catálogo y del panel. Sin emoji: cada tarjeta
     usa la foto real del primer producto de la categoría, y si no hay foto
     cae en un monograma en serif.

     `ico` marca las que NO son categorías sino estados (Favoritos, Más
     vendidos): esas llevan icono de línea en vez de foto, para que se lean
     distinto de las categorías de producto. */
  var ICO_FAVS = '<svg viewBox="0 0 24 24"><path d="M12 20s-7-4.5-7-9.5A3.5 3.5 0 0 1 12 8a3.5 3.5 0 0 1 7 2.5c0 5-7 9.5-7 9.5z"/></svg>';
  var ICO_TOP  = '<svg viewBox="0 0 24 24"><path d="M12 3l2.4 6.3H21l-5.3 3.9 2 6.4-5.7-4.1-5.7 4.1 2-6.4L3 9.3h6.6z"/></svg>';

  var CATS = [
    { id:'favs',            name:'Favoritos',     ico:ICO_FAVS },
    { id:'top',             name:'Más vendidos',  ico:ICO_TOP  },
    { id:'camarones-imp',   name:'Camarones Importados' },
    { id:'camarones-nac',   name:'Camarones Nacionales' },
    { id:'filetes-premium', name:'Filete Premium' },
    { id:'filetes-trad',    name:'Filetes Tradicionales' },
    { id:'pescado-entero',  name:'Pescado Entero' },
    { id:'picadura',        name:'Picadura Ceviche' },
    { id:'mariscos',        name:'Mariscos Varios' },
    { id:'mariscadas',      name:'Mariscadas y Paellas' },
    { id:'gourmet',         name:'Gourmet' },
    { id:'marinados',       name:'Marinados y Empanizadores' }
  ];

  var TABS = [
    { id:'inicio',   label:'Inicio',    href:'index.html',
      svg:'<path d="M3 10.2 12 3l9 7.2V21a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/>' },
    { id:'catalogo', label:'Catálogo',  href:'catalogo.html',
      svg:'<path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z"/>' },
    { id:'buscar',   label:'Buscar',    href:'#buscar',
      svg:'<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.6-3.6"/>' },
    { id:'premios',  label:'Reserva',   href:'premios.html',
      svg:'<rect x="3" y="9" width="18" height="11" rx="1"/>' +
          '<path d="M3 13h18M12 9v11"/>' +
          '<path d="M12 9S9.5 4 7.5 5.5 9 9 12 9zM12 9s2.5-5 4.5-3.5S15 9 12 9z"/>' },
    { id:'cuenta',   label:'Mi cuenta', href:'mi-cuenta.html',
      svg:'<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7"/>' }
  ];

  var CSS =
    'html{touch-action:manipulation}'
  + '@media(max-width:860px){'
  +   'input:not([type=checkbox]):not([type=radio]):not([type=range]),'
  +   'textarea,select{font-size:16px!important}'
  + '}'
  + ''
  /* ── barra de pestañas ── */
  + '.cfui-tabs{position:fixed;left:0;right:0;bottom:0;top:auto!important;z-index:250;display:none;'
  /* Fondo solido, sin desenfoque: la barra esta fija y visible durante
     todo el desplazamiento, asi que el navegador tendria que volver a
     desenfocar el fondo en cada cuadro. Medido: costaba unos 6 fps. */
  + 'background:#070f1e;'
  /* Capa propia en el compositor. Sin esto la barra se repinta junto con
     la pagina y se ve "subir" mientras se desplaza (se nota en iOS).
     Antes se la daba el backdrop-filter, que quitamos por rendimiento. */
  + 'transform:translateZ(0);will-change:transform;'
  + '-webkit-backdrop-filter:blur(18px) saturate(140%);'
  + 'border-top:1px solid rgba(200,169,110,.14);'
  + 'padding-bottom:env(safe-area-inset-bottom)}'
  + '.cfui-tabs::after{content:"";position:absolute;left:0;right:0;top:100%;'
  + 'height:120px;background:inherit;pointer-events:none}'
  + '.cfui-tabs-in{display:grid;grid-template-columns:repeat(5,1fr)}'
  + '.cfui-tab{background:none;border:0;cursor:pointer;font-family:inherit;'
  + 'display:flex;flex-direction:column;align-items:center;gap:.28rem;'
  + 'padding:.6rem .2rem .55rem;color:#4d6478;position:relative;'
  + 'transition:color .3s cubic-bezier(.22,.61,.36,1);text-decoration:none}'
  + '.cfui-tab svg{width:21px;height:21px;fill:none;stroke:currentColor;'
  + 'stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round}'
  + '.cfui-tab{padding-left:.1rem;padding-right:.1rem}'
  + '.cfui-tab span{font-size:.5rem;letter-spacing:.06em;text-transform:uppercase;'
  + 'font-weight:600;white-space:nowrap}'
  + '@media(max-width:360px){.cfui-tab span{font-size:.46rem;letter-spacing:.03em}}'
  + '.cfui-tab.on{color:#e8c98a}'
  + '.cfui-tab.on::before{content:"";position:absolute;top:0;left:50%;transform:translateX(-50%);'
  + 'width:26px;height:2px;background:#c8a96e}'
  + '.cfui-tab:active{color:#c8a96e}'
  /* ── barra de carrito ── */
  + '.cfui-cart{position:fixed;left:.7rem;right:.7rem;z-index:260;display:flex;'
  + 'transform:translateZ(0);'
  + 'align-items:center;gap:.8rem;padding:.75rem .9rem .75rem 1rem;'
  + 'background:linear-gradient(135deg,#c8a96e,#a8874e);color:#050c18;'
  + 'border:0;cursor:pointer;font-family:inherit;text-align:left;'
  + 'box-shadow:0 10px 30px rgba(0,0,0,.45);'
  + 'opacity:0;visibility:hidden;transform:translateY(130%);pointer-events:none;'
  + 'transition:transform .5s cubic-bezier(.22,.61,.36,1),opacity .35s ease,'
  + 'visibility 0s linear .5s}'
  + '.cfui-cart.on{opacity:1;visibility:visible;transform:translateY(0);'
  + 'pointer-events:auto;transition:transform .5s cubic-bezier(.22,.61,.36,1),'
  + 'opacity .35s ease,visibility 0s}'
  + '.cfui-cart-n{width:26px;height:26px;flex-shrink:0;display:grid;place-items:center;'
  + 'background:rgba(5,12,24,.85);color:#e8c98a;font-size:.7rem;font-weight:700}'
  + '.cfui-cart-b{flex:1;min-width:0}'
  + '.cfui-cart-t{display:block;font-size:.6rem;letter-spacing:.16em;text-transform:uppercase;'
  + 'font-weight:700;opacity:.75}'
  + '.cfui-cart-m{display:block;font-family:"Cormorant Garamond",Georgia,serif;font-size:1.25rem;'
  + 'line-height:1.1;font-weight:600}'
  + '.cfui-cart-go{font-size:.58rem;letter-spacing:.18em;text-transform:uppercase;'
  + 'font-weight:700;white-space:nowrap}'
  /* Con \`bottom\` explicito, no \`inset:0\`: la hoja va en z-index 350 y la
     barra de pestañas en 250, asi que la tapaba entera. Al abrir "Buscar"
     desaparecia el menu de abajo y no se podia ir a otra seccion sin
     cerrar primero. */
  + '.cfui-sheet{position:fixed;top:0;left:0;right:0;bottom:0;z-index:350;background:#050c18;'
  + 'display:flex;flex-direction:column;opacity:0;pointer-events:none;'
  + 'transform:translateY(14px);'
  + 'transition:opacity .4s cubic-bezier(.22,.61,.36,1),transform .4s cubic-bezier(.22,.61,.36,1)}'
  + '.cfui-sheet.on{opacity:1;pointer-events:auto;transform:none}'
  + '.cfui-sheet-top{display:flex;align-items:center;gap:.7rem;padding:1rem 1rem .9rem;'
  + 'padding-top:calc(1rem + env(safe-area-inset-top));'
  + 'border-bottom:1px solid rgba(255,255,255,.06)}'
  + '.cfui-sheet-in{flex:1;display:flex;align-items:center;gap:.6rem;'
  + 'border:1px solid rgba(200,169,110,.22);padding:.65rem .9rem;background:rgba(12,28,48,.6)}'
  + '.cfui-sheet-in svg{width:16px;height:16px;flex-shrink:0;fill:none;stroke:#6f8599;stroke-width:1.8}'
  + '.cfui-sheet-in input{flex:1;min-width:0;background:none;border:0;outline:none;'
  + 'color:#f2f5f8;font-family:inherit;font-size:.92rem}'
  + '.cfui-sheet-in input::placeholder{color:#4d6478}'
  + '.cfui-sheet-x{background:none;border:0;cursor:pointer;color:#6f8599;'
  + 'font-family:inherit;font-size:.62rem;letter-spacing:.16em;text-transform:uppercase;padding:.5rem .2rem}'
  + '.cfui-sheet-body{flex:1;overflow-y:auto;padding:1.2rem 1rem 2.5rem;'
  + 'padding-bottom:calc(2.5rem + env(safe-area-inset-bottom))}'
  + '.cfui-h{font-size:.56rem;letter-spacing:.24em;text-transform:uppercase;'
  + 'color:#4d6478;margin:0 0 .9rem}'
  + '.cfui-cats{display:grid;gap:.6rem;grid-template-columns:repeat(2,1fr)}'
  + '@media(min-width:520px){.cfui-cats{grid-template-columns:repeat(3,1fr)}}'
  + '.cfui-cat{position:relative;aspect-ratio:16/9;overflow:hidden;cursor:pointer;'
  + 'border:1px solid rgba(255,255,255,.06);background:#0c1c30;padding:0;'
  + 'font-family:inherit;text-align:left;display:block;'
  + 'transition:border-color .4s cubic-bezier(.22,.61,.36,1)}'
  + '.cfui-cat:active{border-color:rgba(200,169,110,.5)}'
  + '.cfui-cat img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:.42}'
  + '.cfui-cat i{position:absolute;inset:0;display:grid;place-items:center;'
  + 'font-style:normal;font-family:"Cormorant Garamond",Georgia,serif;'
  + 'font-size:2rem;font-weight:300;color:#c8a96e;letter-spacing:.08em;opacity:.45}'
  /* Estados (Favoritos, Más vendidos): icono en vez de foto, sobre un fondo
     apenas dorado, para que no se confundan con una categoría de producto. */
  + '.cfui-cat.est{background:linear-gradient(150deg,#12283f,#0a1728)}'
  + '.cfui-cat.est::before{content:"";position:absolute;inset:0;'
  + 'background:radial-gradient(circle at 30% 25%,rgba(200,169,110,.14),transparent 60%)}'
  + '.cfui-cat.est i{opacity:1}'
  + '.cfui-cat.est i svg{width:26px;height:26px;fill:none;stroke:#c8a96e;stroke-width:1.4;'
  + 'stroke-linecap:round;stroke-linejoin:round;opacity:.85}'
  + '.cfui-cat-b{position:absolute;left:0;right:0;bottom:0;padding:.65rem .7rem;'
  + 'background:linear-gradient(to top,rgba(5,12,24,.95),transparent)}'
  /* display:block — sin esto los dos <span> caen en la misma línea y se lee
     "Camarones Importados5 productos". Vale para todos los pares de abajo. */
  + '.cfui-cat-n{display:block;font-size:.72rem;color:#f2f5f8;line-height:1.3;font-weight:500}'
  + '.cfui-cat-c{display:block;font-size:.58rem;color:#c8a96e;letter-spacing:.1em;margin-top:.15rem}'
  /* resultados */
  + '.cfui-res{display:flex;flex-direction:column;border-top:1px solid rgba(255,255,255,.06)}'
  + '.cfui-r{display:flex;align-items:center;gap:.85rem;padding:.8rem .2rem;'
  + 'border-bottom:1px solid rgba(255,255,255,.06);cursor:pointer;background:none;'
  + 'border-left:0;border-right:0;border-top:0;font-family:inherit;text-align:left;width:100%}'
  + '.cfui-r-img{width:52px;height:52px;flex-shrink:0;overflow:hidden;'
  + 'background:linear-gradient(150deg,#102438,#081426);display:grid;place-items:center}'
  + '.cfui-r-img i{font-style:normal;font-family:"Cormorant Garamond",Georgia,serif;'
  + 'font-size:1.15rem;font-weight:300;color:#c8a96e;letter-spacing:.06em;opacity:.7}'
  + '.cfui-r-img img{width:100%;height:100%;object-fit:cover}'
  + '.cfui-r-b{flex:1;min-width:0}'
  + '.cfui-r-n{display:block;font-size:.82rem;color:#f2f5f8;line-height:1.35}'
  + '.cfui-r-c{display:block;font-size:.6rem;color:#4d6478;letter-spacing:.1em;'
  + 'text-transform:uppercase;margin-top:.2rem}'
  + '.cfui-r-p{font-family:"Cormorant Garamond",Georgia,serif;font-size:1.05rem;'
  + 'color:#e8c98a;white-space:nowrap}'
  + '.cfui-r-p.cfui-r-cons{font-family:inherit;font-size:.62rem;letter-spacing:.12em;'
  + 'text-transform:uppercase;color:#6f8599}'
  + '.cfui-empty{text-align:center;padding:3rem 1rem;color:#6f8599;font-size:.8rem;line-height:1.8}'
  + '.cfui-empty b{display:block;font-family:"Cormorant Garamond",Georgia,serif;'
  + 'font-size:1.8rem;color:#c8a96e;font-weight:400;margin-bottom:.7rem}'
  /* ── solo móvil ── */
  + '@media(max-width:860px){'
  +   '.cfui-tabs{display:block}'
  +   'body{padding-bottom:calc(60px + env(safe-area-inset-bottom))}'
  +   'body.cfui-locked{overflow:hidden}'
  /* El flotante de WhatsApp sube y se achica para no pelear con la barra */
  +   '.wa-float{bottom:calc(74px + env(safe-area-inset-bottom))!important;'
  +     'width:44px!important;height:44px!important;z-index:240!important;'
  +     'animation:none!important;opacity:.92}'
  +   '.wa-float svg{width:20px!important;height:20px!important}'
  /* El carrito viejo (círculo) se reemplaza por la barra */
  +   '.cart-float{display:none!important}'
  /* Solo donde la barra de pestañas existe. */
  +   '.cfui-sheet{bottom:calc(59px + env(safe-area-inset-bottom))}'
  + '}'
  + '@media(min-width:861px){.cfui-cart{display:none!important}}'
  + '@media (prefers-reduced-motion: reduce){'
  +   '.cfui-sheet,.cfui-cart,.cfui-tab{transition-duration:.001ms!important}}';

  /* ═══ Utilidades ═══ */
  function fmt(n){
    return '₡' + String(Math.round(Number(n)||0)).replace(/\B(?=(\d{3})+(?!\d))/g,'.');
  }
  function esc(s){
    if (HAY_CF) return CF.esc(s);
    return String(s == null ? '' : s)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }

  /* Rango U+0300..U+036F: las tildes y la virgulilla que `normalize('NFD')`
     deja sueltas como caracteres aparte.
     OJO: entre los corchetes hay dos caracteres combinantes reales, que
     muchos editores dibujan vacíos o pegados al corchete. Está bien así,
     no lo "arregles" borrándolos. */
  var COMBINANTES = new RegExp('[̀-ͯ]', 'g');

  /* Sin tildes y en minúscula. En una tienda tica la gente escribe "camaron",
     no "camarón": sin esto la búsqueda por nombre no encuentra nada. */
  function normTxt(s){
    return String(s == null ? '' : s).toLowerCase()
      .normalize('NFD').replace(COMBINANTES, '');
  }

  function paginaActual(){
    var f = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
    if (f === '' ) f = 'index.html';
    if (f.indexOf('catalogo') === 0) return 'catalogo';
    if (f.indexOf('mi-cuenta') === 0 || f.indexOf('pedido') === 0) return 'cuenta';
    if (f.indexOf('index') === 0) return 'inicio';
    if (f.indexOf('premios') === 0) return 'premios';
    return '';
  }

  /* ═══ Productos (para buscar y para el carrito) ═══ */
  var productos = null, cargando = null;
  function cargarProductos(){
    if (productos) return Promise.resolve(productos);
    if (cargando) return cargando;
    // Si la página ya los tiene en memoria (catalogo.html), no se vuelve a pedir.
    if (window.PRODUCTS && window.PRODUCTS.length){
      productos = window.PRODUCTS;
      return Promise.resolve(productos);
    }
    // Sin base no hay productos que buscar; la barra igual se dibuja.
    if (!HAY_CF) { productos = []; return Promise.resolve(productos); }
    cargando = CF.db.collection('chusfish').doc('catalog').get()
      .then(function(s){
        productos = (s.exists && s.data().products) || [];
        return productos;
      })
      .catch(function(){ productos = []; return productos; });
    return cargando;
  }

  /* ═══ Montaje ═══ */

  var elTabs, elCart, elSheet, elInput, elBody;

  function montar(){
    var st = document.createElement('style');
    st.textContent = CSS;
    document.head.appendChild(st);

    // Pestañas
    // OJO: <div>, no <nav>. catalogo.html e index.html tienen reglas globales
    // por etiqueta (body.banner-visible nav{top:42px}) que agarraban esta barra
    // y la mandaban arriba de la pantalla. Misma trampa que las tablas del admin.
    elTabs = document.createElement('div');
    elTabs.className = 'cfui-tabs';
    elTabs.setAttribute('role','navigation');
    elTabs.setAttribute('aria-label','Navegación principal');
    var actual = paginaActual();
    elTabs.innerHTML = '<div class="cfui-tabs-in">' + TABS.map(function(t){
      var on = t.id === actual ? ' on' : '';
      var tag = t.id === 'buscar' ? 'button' : 'a';
      var attr = t.id === 'buscar' ? 'type="button"' : 'href="'+t.href+'"';
      return '<'+tag+' class="cfui-tab'+on+'" '+attr+' data-tab="'+t.id+'">'+
             '<svg viewBox="0 0 24 24" aria-hidden="true">'+t.svg+'</svg>'+
             '<span>'+t.label+'</span></'+tag+'>';
    }).join('') + '</div>';
    document.body.appendChild(elTabs);

    // Barra de carrito
    elCart = document.createElement('button');
    elCart.className = 'cfui-cart';
    elCart.type = 'button';
    elCart.innerHTML =
      '<span class="cfui-cart-n" id="cfui-cart-n">0</span>'+
      '<span class="cfui-cart-b"><span class="cfui-cart-t">Tu pedido</span>'+
      '<span class="cfui-cart-m" id="cfui-cart-m">₡0</span></span>'+
      '<span class="cfui-cart-go">Ver →</span>';
    document.body.appendChild(elCart);
    elCart.addEventListener('click', irAlCarrito);

    // Hoja de búsqueda
    elSheet = document.createElement('div');
    elSheet.className = 'cfui-sheet';
    elSheet.setAttribute('role','dialog');
    elSheet.setAttribute('aria-modal','true');
    elSheet.innerHTML =
      '<div class="cfui-sheet-top">'+
        '<label class="cfui-sheet-in">'+
          '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.6-3.6"/></svg>'+
          '<input type="search" id="cfui-q" placeholder="Buscar pescado, camarón…" '+
          'autocomplete="off" enterkeyhint="search" />'+
        '</label>'+
        '<button class="cfui-sheet-x" id="cfui-close">Cerrar</button>'+
      '</div>'+
      '<div class="cfui-sheet-body" id="cfui-body"></div>';
    document.body.appendChild(elSheet);

    elInput = document.getElementById('cfui-q');
    elBody  = document.getElementById('cfui-body');

    document.getElementById('cfui-close').addEventListener('click', cerrarBusqueda);
    elInput.addEventListener('input', function(){ pintarBusqueda(elInput.value); });
    elInput.addEventListener('keydown', function(e){
      if (e.key === 'Enter'){ e.preventDefault(); elInput.blur(); }
    });

    elTabs.querySelector('[data-tab="buscar"]').addEventListener('click', function(){
      abrirBusqueda();
    });

    document.addEventListener('keydown', function(e){
      if (e.key === 'Escape' && elSheet.classList.contains('on')) cerrarBusqueda();
    });

    refrescarCarrito();
    // Otra pestaña del navegador puede cambiar el carrito.
    window.addEventListener('storage', function(e){
      if (e.key === 'chusfish_cart') refrescarCarrito();
    });
  }

  /* ═══ Carrito ═══ */
  function leerCarrito(){
    try { return JSON.parse(localStorage.getItem('chusfish_cart') || '[]'); }
    catch(e){ return []; }
  }

  function irAlCarrito(){
    // En el catálogo el carrito ya existe: se abre ahí mismo.
    if (typeof window.openCart === 'function'){ window.openCart(); return; }
    var b = document.querySelector('.cart-float');
    if (b){ b.click(); return; }
    location.href = 'catalogo.html?carrito=1';
  }

  async function refrescarCarrito(){
    /* La barra puede no existir todavia. `catalogo.html` llama a esto en
       cuanto tiene productos, y desde que el catalogo se guarda en el
       aparato eso ocurre en ~450 ms: antes de que montar() haya corrido.
       No es un problema — montar() vuelve a llamar a refrescarCarrito() al
       final. Solo hay que no reventar mientras tanto. */
    if (!elCart) return;

    var items = leerCarrito();
    if (!items.length){ elCart.classList.remove('on'); posicionarCarrito(false); return; }

    var prods = await cargarProductos();
    var total = 0, n = 0;
    items.forEach(function(it){
      var p = prods.filter(function(x){ return x.id === it.id; })[0];
      n += 1;
      if (p && typeof p.price === 'number') total += p.price * (Number(it.qty)||0);
    });

    document.getElementById('cfui-cart-n').textContent = n;
    document.getElementById('cfui-cart-m').textContent = total ? fmt(total) : 'Consultar';
    elCart.classList.add('on');
    posicionarCarrito(true);
  }

  function posicionarCarrito(visible){
    if (window.innerWidth > 860){ document.body.style.paddingBottom = ''; return; }
    // La barra del carrito se apoya justo encima de las pestañas.
    var altoTabs = elTabs ? Math.round(elTabs.getBoundingClientRect().height) : 56;
    elCart.style.bottom = 'calc(' + altoTabs + 'px + .55rem)';
    if (visible){
      var altoCart = Math.round(elCart.getBoundingClientRect().height) || 60;
      document.body.style.paddingBottom =
        'calc(' + (altoTabs + altoCart + 18) + 'px + env(safe-area-inset-bottom))';
    } else {
      document.body.style.paddingBottom = '';   // vuelve al valor del CSS
    }
  }

  /* ═══ Búsqueda ═══ */
  function abrirBusqueda(prefill){
    elSheet.classList.add('on');
    document.body.classList.add('cfui-locked');
    if (prefill) elInput.value = prefill;
    pintarBusqueda(elInput.value);
    // El foco va después de la transición para que el teclado no corte la animación.
    /* A proposito NO se pone el foco aqui: el teclado tapaba media
       pantalla apenas se abria "Buscar", justo cuando lo que la persona
       quiere es VER las categorias. Sale cuando toca la barrita. */
  }
  function cerrarBusqueda(){
    elSheet.classList.remove('on');
    document.body.classList.remove('cfui-locked');
    elInput.blur();
  }

  async function pintarBusqueda(q){
    q = (q || '').trim().toLowerCase();
    var prods = await cargarProductos();

    if (!q){
      // Sin texto: se muestran las categorías, que es lo que reemplaza al
      // desplegable. Con foto real del primer producto de cada una.
      var tiles = CATS.map(function(c){
        var enCat = prods.filter(function(p){
          if (c.id === 'camarones') return p.cat === 'camarones-imp' || p.cat === 'camarones-nac';
          return p.cat === c.id;
        });
        var n = enCat.length;
        if (c.id === 'favs' || c.id === 'top') n = null;   // no tienen conteo fijo
        else if (!n) return '';                            // categoría vacía: no se muestra

        // Los estados llevan icono; las categorías, la foto de su producto.
        var visual = c.ico
          ? '<i>' + c.ico + '</i>'
          : (function(){
              var foto = enCat.filter(function(p){ return p.img; })[0];
              return foto ? '<img src="'+esc(foto.img)+'" alt="" loading="lazy" />'
                          : '<i>'+esc(HAY_CF ? CF.monograma(c.name) : '✦')+'</i>';
            })();

        return '<button class="cfui-cat'+(c.ico?' est':'')+'" data-cat="'+esc(c.id)+'">'+
          visual+
          '<span class="cfui-cat-b"><span class="cfui-cat-n">'+esc(c.name)+'</span>'+
          (n !== null ? '<span class="cfui-cat-c">'+n+(n===1?' producto':' productos')+'</span>' : '')+
          '</span></button>';
      }).filter(Boolean).join('');

      elBody.innerHTML = '<p class="cfui-h">Explorá por categoría</p>'+
        '<div class="cfui-cats">'+tiles+'</div>';
      elBody.querySelectorAll('[data-cat]').forEach(function(b){
        b.addEventListener('click', function(){ irA(b.dataset.cat, ''); });
      });
      return;
    }

    /* Relevancia, no orden de catálogo. Buscando "camaron" salían primero
       cuatro salsas y empanizadores (porque nombran el camarón en la
       descripción) y los camarones aparecían quintos.
         0 · el nombre empieza con lo buscado
         1 · alguna palabra del nombre empieza con lo buscado
         2 · el nombre lo contiene en cualquier parte
         3 · solo aparece en la descripción o el badge
       A igual puntaje se respeta el orden del catálogo. */
    var qn = normTxt(q);
    var hits = prods.map(function(p, i){
      var nombre = normTxt(p.name);
      var resto  = normTxt((p.desc || '') + ' ' + (p.badge || ''));
      var punt;
      if (nombre.indexOf(qn) === 0) punt = 0;
      else if (new RegExp('(^|\\s)' + qn.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).test(nombre)) punt = 1;
      else if (nombre.indexOf(qn) >= 0) punt = 2;
      else if (resto.indexOf(qn) >= 0) punt = 3;
      else return null;
      return { p: p, punt: punt, i: i };
    }).filter(Boolean)
      .sort(function(a, b){ return a.punt - b.punt || a.i - b.i; })
      .slice(0, 40)
      .map(function(x){ return x.p; });

    if (!hits.length){
      elBody.innerHTML = '<div class="cfui-empty"><b>✦</b>'+
        'No encontramos nada con «'+esc(q)+'».<br>Probá con otra palabra, '+
        'o escribinos por <a href="'+WA+'" target="_blank" rel="noopener" '+
        'style="color:#c8a96e;text-decoration:underline">WhatsApp</a>.</div>';
      return;
    }

    var nombreCat = {};
    CATS.forEach(function(c){ nombreCat[c.id] = c.name; });

    elBody.innerHTML = '<p class="cfui-h">'+hits.length+
      (hits.length===1?' resultado':' resultados')+'</p>'+
      '<div class="cfui-res">'+ hits.map(function(p){
        return '<button class="cfui-r" data-id="'+esc(String(p.id))+'">'+
          '<span class="cfui-r-img">'+
            (p.img ? '<img src="'+esc(p.img)+'" alt="" loading="lazy" />'
                   : '<i>'+esc(CF.monograma(p.name))+'</i>')+
          '</span>'+
          '<span class="cfui-r-b"><span class="cfui-r-n">'+esc(p.name)+'</span>'+
            '<span class="cfui-r-c">'+esc(nombreCat[p.cat]||'')+'</span></span>'+
          // Precio 0 o sin precio es lo mismo: hay que preguntarlo. "₡0"
          // parecia que el producto era gratis.
          (p.price
            ? '<span class="cfui-r-p">'+fmt(p.price)+'</span>'
            : '<span class="cfui-r-p cfui-r-cons">Consultar</span>')+
        '</button>';
      }).join('') + '</div>';

    elBody.querySelectorAll('[data-id]').forEach(function(b){
      b.addEventListener('click', function(){ irA('all', q, b.dataset.id); });
    });
  }

  /* Aplica el filtro en la página si esta sabe hacerlo (catalogo.html),
     si no navega al catálogo con los parámetros. */
  function irA(cat, q, id){
    cerrarBusqueda();
    if (typeof window.CF_FILTER === 'function'){
      window.CF_FILTER(cat, q, id);
      return;
    }
    var p = [];
    if (cat && cat !== 'all') p.push('cat=' + encodeURIComponent(cat));
    if (q)  p.push('q=' + encodeURIComponent(q));
    if (id) p.push('id=' + encodeURIComponent(id));
    location.href = 'catalogo.html' + (p.length ? '?' + p.join('&') : '');
  }

  /* ═══ API ═══ */
  window.CFUI = {
    abrirBusqueda: abrirBusqueda,
    cerrarBusqueda: cerrarBusqueda,
    refrescarCarrito: refrescarCarrito,
    CATS: CATS
  };

  if (document.readyState === 'loading')
    document.addEventListener('DOMContentLoaded', montar);
  else montar();
})();
