/* ══════════════════════════════════════════════════════════════
   Chus's Fish — Módulo compartido de cuentas y fidelidad
   ──────────────────────────────────────────────────────────────
   Se carga DESPUÉS de firebase-app / firebase-auth / firebase-firestore
   (versión compat 10.12.2). Expone todo bajo window.CF.

   ⚠️ netlify.toml cachea /*.js como immutable por 1 AÑO.
      Al cambiar este archivo hay que subir el ?v= en TODOS los HTML
      que lo cargan, si no los clientes quedan con la versión vieja.
      Versión actual: v11
   ══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  if (typeof firebase === 'undefined') {
    console.error('[CF] firebase compat no está cargado antes de auth.js');
    return;
  }

  var FB_CONFIG = {
    apiKey:            'AIzaSyCLFJ9xAWUw_M2UgkOUY467MmkbFe4lbIk',
    authDomain:        'chus-fish.firebaseapp.com',
    projectId:         'chus-fish',
    storageBucket:     'chus-fish.firebasestorage.app',
    messagingSenderId: '788310353696',
    appId:             '1:788310353696:web:16ca9bd3f934b915cb1945'
  };

  // Init defensivo: catalogo.html e index.html ya inicializaban Firebase
  // por su cuenta. Compat tira "app already exists" si se llama dos veces.
  if (!firebase.apps.length) firebase.initializeApp(FB_CONFIG);

  var auth = firebase.auth ? firebase.auth() : null;
  var db   = firebase.firestore();

  /* ═══ EMULADOR EN LOCAL ══════════════════════════════════════
     En localhost apuntamos a los emuladores: se trabaja con datos de
     mentira y NO se toca la base real ni se crean usuarios de verdad.
     En chusfish.com / netlify.app esto no corre nunca.
     Levantar con:  npm run emu  +  npm run dev

     También cuentan las IPs privadas (192.168.x.x, 10.x.x.x, 172.16-31.x.x),
     para poder abrir el sitio desde OTRO aparato de la misma red — el
     teléfono del cliente, por ejemplo — y que siga hablando con el emulador.
     Sin esto, entrar por http://192.168.1.50:5000 pegaba contra la base
     REAL: fallaba (las reglas no están publicadas) y encima podía escribir
     datos de verdad desde una demo. Una IP privada nunca es producción.

     `firebase.firestore()` devuelve siempre la misma instancia, así que
     configurarla acá alcanza para todas las páginas que cargan auth.js. */
  var CF_LOCAL =
    /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname) ||
    /^192\.168\.\d{1,3}\.\d{1,3}$/.test(location.hostname) ||
    /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(location.hostname) ||
    /^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/.test(location.hostname);
  if (CF_LOCAL) {
    try {
      // Mismo host y puerto que la pagina: dev-server.js hace de proxy a
      // Firestore (8080) y Auth (9099). Un solo origen, cero CORS.
      db.useEmulator(location.hostname, Number(location.port) || 80);
      if (auth) auth.useEmulator(location.origin, { disableWarnings: true });
      console.info('%c[CF] MODO LOCAL — emuladores Firebase (datos de prueba)',
                   'background:#c8a96e;color:#060e1c;padding:2px 6px;border-radius:3px');
    } catch (e) {
      console.warn('[CF] No se pudo conectar al emulador. ¿Corriste `npm run emu`?', e);
    }
  }

  /* ═══ NIVELES DE FIDELIDAD ═══════════════════════════════════
     `mult` multiplica los puntos que ganás por compra: es lo que hace que
     subir de nivel valga algo y no sea solo una etiqueta bonita.

     Se leen de chusfish/config.tiers para que Jesús los edite desde el
     panel. Estos valores son solo el respaldo si la config no los trae
     (o si Firestore todavía no respondió). */
  var TIERS_FALLBACK = [
    { id: 'bronce', name: 'Bronce', min: 0,    mult: 1.00, color: '#b87333',
      perk: 'Acumulás puntos en cada compra.' },
    { id: 'plata',  name: 'Plata',  min: 1000, mult: 1.10, color: '#c0c9d4',
      perk: '10% más de puntos en cada compra.' },
    { id: 'oro',    name: 'Oro',    min: 3000, mult: 1.25, color: '#e8c98a',
      perk: '25% más de puntos y prioridad en pedidos.' }
  ];
  var TIERS = TIERS_FALLBACK.slice();

  function rebuildTiers(cfg) {
    var raw = cfg && cfg.tiers;
    if (!raw || !raw.length) { TIERS = TIERS_FALLBACK.slice(); return; }
    TIERS = raw.map(function (t, i) {
      var base = TIERS_FALLBACK[Math.min(i, TIERS_FALLBACK.length - 1)];
      return {
        id:    t.id   || base.id,
        name:  t.name || base.name,
        min:   Number(t.min)  || 0,
        mult:  Number(t.mult) || 1,
        color: t.color || base.color,
        perk:  t.perk  || ''
      };
    }).sort(function (a, b) { return a.min - b.min; });
  }

  function tierOf(lifetimePoints) {
    var lp = Number(lifetimePoints) || 0, t = TIERS[0];
    for (var i = 0; i < TIERS.length; i++) if (lp >= TIERS[i].min) t = TIERS[i];
    return t;
  }
  function nextTier(lifetimePoints) {
    var lp = Number(lifetimePoints) || 0;
    for (var i = 0; i < TIERS.length; i++) if (lp < TIERS[i].min) return TIERS[i];
    return null; // ya está en el tope
  }

  /* Puntos que da un monto en un nivel dado. Con el programa apagado no
     da nada: si diera, el sitio prometería puntos que nadie va a acreditar. */
  function pointsForTier(amount, tier) {
    if ((siteCfg || {}).pointsEnabled === false) return 0;
    var rate = parseFloat((siteCfg || {}).pointsPer100);
    if (isNaN(rate)) rate = 1;
    var mult = tier ? (Number(tier.mult) || 1) : 1;
    return Math.floor((Number(amount) || 0) / 100 * rate * mult);
  }

  /* ═══ CONFIGURACIÓN DEL SITIO ════════════════════════════════
     Una sola suscripción para todas las páginas: zonas, niveles, reglas
     de puntos. Al llegar se reconstruyen los niveles y se re-renderiza. */
  var siteCfg = null, cfgResolve;
  var cfgPromise = new Promise(function (r) { cfgResolve = r; });

  db.collection('chusfish').doc('config').onSnapshot(function (snap) {
    siteCfg = snap.exists ? snap.data() : {};
    rebuildTiers(siteCfg);
    cfgResolve(siteCfg);
    emit();
  }, function (e) {
    console.error('[CF] config', e);
    siteCfg = {};
    cfgResolve(siteCfg);
  });

  /* ═══ UTILIDADES ═════════════════════════════════════════════ */

  // El proyecto NO usa toLocaleString para moneda: en es-CR separa miles con
  // espacio fino ("21 600") en vez de punto. Se mantiene el mismo criterio.
  function fmtNum(n) {
    return String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  }
  function fmtColones(n) { return '₡' + fmtNum(n); }

  /* Monograma: cuando no hay foto, dos iniciales en serif sobre el degradado.
     Es lo que hacen las marcas de lujo — un emoji ahi abarata la pieza.
     Descarta numeros y palabras cortas: "1 kg de Filete de Corvina" -> "FC". */
  function monograma(texto) {
    var t = String(texto || '');

    /* Un premio como "15% de descuento" no tiene inicial util: la "D" de
       "descuento" no informa nada. El porcentaje SI, y se ve deliberado
       en la misma serif que el monograma. */
    var pct = t.match(/([0-9]{1,3}) *%/);
    if (pct) return pct[1] + '%';

    var palabras = t.match(/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]{3,}/g) || [];
    if (!palabras.length) return '✦';
    return palabras.slice(0, 2).map(function (w) {
      return w.charAt(0).toUpperCase();
    }).join('');
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // Teléfono CR normalizado a 8 dígitos, para cruzar pedidos viejos.
  function normPhone(p) {
    var d = String(p || '').replace(/\D/g, '');
    if (d.length > 8) d = d.slice(-8);
    return d;
  }

  function toDate(v) {
    if (!v) return null;
    if (typeof v.toDate === 'function') return v.toDate();
    var d = new Date(v);
    return isNaN(d.getTime()) ? null : d;
  }
  function fmtDate(v) {
    var d = toDate(v);
    if (!d) return '—';
    return d.toLocaleDateString('es-CR', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  /* ═══ MENSAJES DE ERROR EN CASTELLANO ════════════════════════
     Los de Firebase vienen en inglés y con códigos; a un cliente de
     mariscos "auth/invalid-credential" no le dice nada. */
  var ERR = {
    'auth/invalid-email':          'Ese correo no parece válido.',
    'auth/user-disabled':          'Esta cuenta está deshabilitada. Escribinos por WhatsApp.',
    'auth/user-not-found':         'No encontramos una cuenta con ese correo.',
    'auth/wrong-password':         'Contraseña incorrecta.',
    'auth/invalid-credential':     'Correo o contraseña incorrectos.',
    'auth/email-already-in-use':   'Ya existe una cuenta con ese correo. Probá iniciando sesión.',
    'auth/weak-password':          'La contraseña debe tener al menos 6 caracteres.',
    'auth/popup-closed-by-user':   'Cerraste la ventana de Google antes de terminar.',
    'auth/cancelled-popup-request':'',
    'auth/popup-blocked':          'El navegador bloqueó la ventana de Google. Probá de nuevo.',
    'auth/network-request-failed': 'Falló la conexión. Revisá tu internet.',
    'auth/too-many-requests':      'Demasiados intentos. Esperá unos minutos.',
    'auth/unauthorized-domain':    'Este dominio no está autorizado en Firebase Auth.'
  };
  function errMsg(e) {
    if (!e) return 'Algo salió mal.';
    if (ERR[e.code] !== undefined) return ERR[e.code];
    return e.message || 'Algo salió mal.';
  }

  /* ═══ CUPONES ════════════════════════════════════════════════
     Una sola funcion de validacion para los dos lados: el carrito la usa
     para mostrar el descuento y el panel para confirmarlo en la factura.
     Si vive en dos lugares, tarde o temprano dicen cosas distintas. */

  function normCodigo(c) {
    return String(c || '').trim().toUpperCase().replace(/\s+/g, '');
  }

  // ctx: { subtotal, esPrimeraCompra, usosDelCliente }
  function validarCupon(cup, ctx) {
    ctx = ctx || {};
    var no = function (motivo) { return { ok: false, motivo: motivo, descuento: 0 }; };

    if (!cup)                 return no('Ese código no existe.');
    if (cup.active === false) return no('Ese código ya no está disponible.');

    var ahora = new Date();
    var desde = toDate(cup.validFrom), hasta = toDate(cup.validUntil);
    if (desde && ahora < desde) return no('Ese código todavía no está vigente.');
    if (hasta && ahora > hasta) return no('Ese código ya venció.');

    var limite = Number(cup.usageLimit);
    if (!isNaN(limite) && limite >= 0 && (Number(cup.usedCount) || 0) >= limite) {
      return no('Ese código ya se agotó.');
    }

    var porCliente = Number(cup.perUserLimit);
    if (!isNaN(porCliente) && porCliente > 0 &&
        (Number(ctx.usosDelCliente) || 0) >= porCliente) {
      return no('Ya usaste ese código.');
    }

    if (cup.firstOrderOnly && ctx.esPrimeraCompra === false) {
      return no('Ese código es solo para la primera compra.');
    }

    var subtotal = Number(ctx.subtotal) || 0;
    var minimo   = Number(cup.minOrder) || 0;
    if (minimo > 0 && subtotal < minimo) {
      return no('Este código aplica desde ' + fmtColones(minimo) + '.');
    }

    var desc = 0;
    if (cup.type === 'percent') {
      desc = subtotal * (Number(cup.value) || 0) / 100;
      var tope = Number(cup.maxDiscount) || 0;
      if (tope > 0) desc = Math.min(desc, tope);
    } else {
      desc = Number(cup.value) || 0;
    }
    // Nunca puede dejar el total en negativo.
    desc = Math.max(0, Math.min(Math.round(desc), subtotal));
    if (desc <= 0) return no('Ese código no aplica a este pedido.');

    return { ok: true, motivo: '', descuento: desc };
  }

  // Busca el cupon y lo valida. `allow get: if true` en las reglas permite
  // consultar un codigo que ya conoces, pero no listarlos todos.
  async function buscarCupon(codigo, ctx) {
    var cod = normCodigo(codigo);
    if (!cod) return { ok: false, motivo: 'Escribí un código.', descuento: 0 };
    try {
      var snap = await db.collection('coupons').doc(cod).get();
      var cup = snap.exists ? Object.assign({ id: snap.id }, snap.data()) : null;
      var r = validarCupon(cup, ctx);
      r.codigo = cod;
      r.cupon = cup;
      return r;
    } catch (e) {
      console.error('[cupon]', e);
      return { ok: false, motivo: 'No pudimos verificar el código.', descuento: 0 };
    }
  }


  /* ═══ ESTADO ═════════════════════════════════════════════════ */
  var state   = { user: null, profile: null, loaded: false };
  var subs    = [];
  var unsubProfile = null;
  var readyResolve;
  var readyPromise = new Promise(function (r) { readyResolve = r; });

  function emit() {
    subs.forEach(function (cb) {
      try { cb(state.user, state.profile); } catch (e) { console.error('[CF] sub', e); }
    });
  }

  function onUser(cb) {
    subs.push(cb);
    if (state.loaded) { try { cb(state.user, state.profile); } catch (e) {} }
    return function () { subs = subs.filter(function (f) { return f !== cb; }); };
  }

  /* ═══ PERFIL EN FIRESTORE ════════════════════════════════════ */

  // Los campos protegidos (points, tier, role…) los rechaza firestore.rules
  // si los manda el cliente. Acá se crean en cero, que es lo único permitido.
  function newProfileDoc(user, extra) {
    var d = {
      name:  (extra && extra.name)  || user.displayName || '',
      email: user.email || '',
      phone:   (extra && extra.phone)   || '',
      address: (extra && extra.address) || '',
      zone:    (extra && extra.zone)    || '',
      points: 0, lifetimePoints: 0, tier: 'bronce',
      ordersCount: 0, totalSpent: 0,
      role: 'customer',
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    if (user.photoURL) d.photoURL = user.photoURL;
    return d;
  }

  function watchProfile(uid) {
    if (unsubProfile) { unsubProfile(); unsubProfile = null; }
    if (!uid) return;
    unsubProfile = db.collection('users').doc(uid).onSnapshot(function (snap) {
      state.profile = snap.exists ? Object.assign({ id: snap.id }, snap.data()) : null;
      emit();
    }, function (err) {
      console.error('[CF] perfil', err);
      state.profile = null; emit();
    });
  }

  // Se llama desde dos lados a la vez: el propio signUp/signIn y el
  // onAuthStateChanged. Sin esta memoria las dos ven "no existe" y las dos
  // crean el documento; la que pierde la carrera ya cuenta como update, y
  // como su escritura borraria createdAt, las reglas la rechazan y el
  // registro muestra error aunque el perfil si se haya creado.
  var profileJobs = {};

  // Nombre y telefono que el cliente acaba de escribir en el registro.
  // Van aparte porque no se sabe cual de las dos llamadas a ensureProfile
  // va a ganar: si gana la de onAuthStateChanged (que no los recibe), el
  // perfil se crearia vacio.
  var pendingExtra = null;

  function ensureProfile(user, extra) {
    if (!user) return Promise.resolve();
    if (profileJobs[user.uid]) return profileJobs[user.uid];
    profileJobs[user.uid] = doEnsureProfile(user, extra || pendingExtra).catch(function (e) {
      delete profileJobs[user.uid];   // permitir reintento si fallo de verdad
      throw e;
    });
    return profileJobs[user.uid];
  }

  async function doEnsureProfile(user, extra) {
    var ref = db.collection('users').doc(user.uid);
    var snap = await ref.get();
    if (!snap.exists) {
      await ref.set(newProfileDoc(user, extra));
      return;
    }
    // Cuenta ya existente: completar huecos sin pisar lo que el cliente puso.
    var d = snap.data(), patch = {};
    if (!d.email && user.email)         patch.email    = user.email;
    if (!d.name  && user.displayName)   patch.name     = user.displayName;
    if (!d.photoURL && user.photoURL)   patch.photoURL = user.photoURL;
    if (extra && extra.phone   && !d.phone)   patch.phone   = extra.phone;
    if (extra && extra.zone    && !d.zone)    patch.zone    = extra.zone;
    if (extra && extra.address && !d.address) patch.address = extra.address;
    // OJO: nunca meter createdAt/points/tier acá — firestore.rules lo rechaza
    // (touchesProtectedUserFields) y el update entero falla.
    if (Object.keys(patch).length) await ref.update(patch);
  }

  /* Las zonas del registro salen de la configuracion, las mismas que usa
     el formulario de pedido. Una lista fija aca se desincronizaria el dia
     que Jesus agregue o quite una zona. */
  async function llenarZonasDelRegistro() {
    var sel = document.getElementById('cf-zona');
    if (!sel || sel.dataset.listo) return;
    try {
      var cfg = await cfgPromise;
      var zonas = (cfg && cfg.zones) || [];
      if (!zonas.length) { document.getElementById('cf-fzona').style.display = 'none'; return; }
      sel.innerHTML = '<option value="">Elegí tu zona…</option>' +
        zonas.map(function (z) {
          var nombre = typeof z === 'string' ? z : (z.name || z.zona || '');
          return nombre ? '<option value="' + esc(nombre) + '">' + esc(nombre) + '</option>' : '';
        }).join('');
      sel.dataset.listo = '1';
    } catch (e) {
      // Sin zonas no se le pide nada: mejor eso que un desplegable vacio.
      var f = document.getElementById('cf-fzona');
      if (f) f.style.display = 'none';
    }
  }

  /* ═══ ACCIONES DE AUTENTICACIÓN ══════════════════════════════ */

  async function signInGoogle() {
    var provider = new firebase.auth.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    var cred;
    try {
      cred = await auth.signInWithPopup(provider);
    } catch (e) {
      // En muchos navegadores móviles el popup no existe o lo bloquean.
      if (e && (e.code === 'auth/popup-blocked' ||
                e.code === 'auth/operation-not-supported-in-this-environment')) {
        await auth.signInWithRedirect(provider);
        return null;
      }
      throw e;
    }
    await ensureProfile(cred.user);
    return cred.user;
  }

  async function signUpEmail(email, pass, name, phone, zone, address) {
    pendingExtra = { name: name, phone: phone, zone: zone, address: address };
    var cred;
    try {
      cred = await auth.createUserWithEmailAndPassword(email, pass);
    } catch (e) { pendingExtra = null; throw e; }

    // El perfil en Firestore va PRIMERO. updateProfile() re-emite el token
    // y deja una ventana en la que Firestore ve la peticion sin auth: si se
    // llama antes, la creacion del perfil se cae con permission-denied.
    // Ademas el nombre real vive en users/{uid}.name, no en displayName.
    try {
      await ensureProfile(cred.user, { name: name, phone: phone,
                                       zone: zone, address: address });
    } finally { pendingExtra = null; }

    if (name) {
      cred.user.updateProfile({ displayName: name }).catch(function () {});
    }
    return cred.user;
  }

  async function signInEmail(email, pass) {
    var cred = await auth.signInWithEmailAndPassword(email, pass);
    await ensureProfile(cred.user);
    return cred.user;
  }

  function resetPassword(email) { return auth.sendPasswordResetEmail(email); }
  function signOutNow() { return auth.signOut(); }

  // Guarda solo los campos que el cliente tiene permitido editar.
  function saveProfile(fields) {
    if (!state.user) return Promise.reject(new Error('Sin sesión'));
    var allowed = ['name', 'phone', 'address', 'zone', 'favs', 'birthday'];
    var patch = {};
    allowed.forEach(function (k) { if (k in fields) patch[k] = fields[k]; });
    patch.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
    return db.collection('users').doc(state.user.uid).update(patch);
  }

  /* ═══ FAVORITOS ══════════════════════════════════════════════
     Viven en localStorage (para que anden sin cuenta) y en
     users/{uid}.favs (para que sobrevivan al cambio de teléfono).

     Los ids de producto son NÚMEROS en Firestore y en el catálogo, pero el
     DOM los devuelve como texto: `onclick="toggleFav('12')"` y
     `dataset.id`. Mezclar "12" con 12 hacía que el corazón saliera apagado
     al recargar y que el botón "Quitar" de Mi cuenta no quitara nada.
     Acá todo entra por favId() y se guarda SIEMPRE como número; las listas
     viejas con texto se arreglan solas al leerlas. */
  var FAVS_KEY   = 'chusfish_favs';
  var FUSION_KEY = 'chusfish_favs_fusion';

  function favId(v) { var n = parseInt(v, 10); return isNaN(n) ? null : n; }

  /* Cuántos cambios nuestros van viajando a Firestore. Mientras haya alguno,
     el perfil que tenemos en mano todavía es el de ANTES del cambio. */
  var favsEnVuelo = 0;

  function favs() {
    try {
      var raw = JSON.parse(localStorage.getItem(FAVS_KEY) || '[]');
      if (!Array.isArray(raw)) return [];
      var out = [];
      raw.forEach(function (v) {
        var n = favId(v);
        if (n !== null && out.indexOf(n) < 0) out.push(n);
      });
      return out;
    } catch (e) { return []; }
  }

  function guardarFavs(lista) {
    try { localStorage.setItem(FAVS_KEY, JSON.stringify(lista)); } catch (e) {}
  }

  function esFav(id) { return favs().indexOf(favId(id)) >= 0; }

  // Marca o desmarca, y lo guarda en los dos lados a la vez.
  function toggleFav(id) {
    var n = favId(id);
    if (n === null) return favs();
    var lista = favs(), i = lista.indexOf(n);
    if (i >= 0) lista.splice(i, 1); else lista.push(n);
    guardarFavs(lista);
    if (state.user) {
      favsEnVuelo++;
      saveProfile({ favs: lista })
        .catch(function (e) { console.error('[CF] favs', e); })
        .then(function () { favsEnVuelo--; });
    }
    return lista;
  }

  /* Pone de acuerdo al aparato con la cuenta.
     La cuenta MANDA. Antes era una unión ciega de local + remoto, y por eso
     quitar un favorito en un teléfono lo revivía el otro, que todavía lo
     tenía guardado. La lista que había en el aparato ANTES de iniciar sesión
     se suma una sola vez, para no perder lo que marcó sin cuenta. */
  function syncFavs() {
    if (!state.user || !state.profile) return favs();

    /* Con un cambio nuestro en vuelo, `state.profile.favs` está viejo:
       pisarlo encima resucitaría justo lo que el cliente acaba de quitar.
       Se espera a que vuelva el perfil de verdad. */
    if (favsEnVuelo > 0) return favs();

    var remotos = [];
    (state.profile.favs || []).forEach(function (v) {
      var n = favId(v);
      if (n !== null && remotos.indexOf(n) < 0) remotos.push(n);
    });

    var yaFusiono = false;
    try { yaFusiono = localStorage.getItem(FUSION_KEY) === state.user.uid; } catch (e) {}

    if (yaFusiono) { guardarFavs(remotos); return remotos; }

    var union = remotos.slice();
    favs().forEach(function (n) { if (union.indexOf(n) < 0) union.push(n); });
    guardarFavs(union);
    try { localStorage.setItem(FUSION_KEY, state.user.uid); } catch (e) {}
    if (union.length !== remotos.length) saveProfile({ favs: union }).catch(function () {});
    return union;
  }

  /* ═══ MODAL DE INGRESO ═══════════════════════════════════════ */

  var MODAL_CSS = ''
    + '.cf-ov{position:fixed;inset:0;z-index:10000;background:rgba(3,8,16,.82);'
    + 'backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);display:none;'
    + 'align-items:center;justify-content:center;padding:1.2rem;overflow-y:auto}'
    + '.cf-ov.open{display:flex}'
    + '.cf-modal{width:100%;max-width:400px;background:linear-gradient(150deg,#0d2137,#060e1c);'
    + 'border:1px solid rgba(200,169,110,.22);border-radius:16px;padding:1.9rem 1.6rem;'
    + 'box-shadow:0 30px 70px rgba(0,0,0,.6);position:relative;margin:auto}'
    + '.cf-x{position:absolute;top:.7rem;right:.9rem;background:none;border:0;color:#7a95aa;'
    + 'font-size:1.4rem;cursor:pointer;line-height:1;padding:.2rem}'
    + '.cf-x:hover{color:#e8c98a}'
    + '.cf-ttl{font-family:"Cormorant Garamond",Georgia,serif;font-size:1.75rem;color:#e8c98a;'
    + 'text-align:center;margin:0 0 .3rem;font-weight:400}'
    + '.cf-sub{text-align:center;color:#7a95aa;font-size:.74rem;margin:0 0 1.4rem;line-height:1.5}'
    /* Variante para fondo oscuro, que es la que Google publica para temas
       oscuros: superficie #131314, texto blanco y la G a color. El botón
       blanco entero era un bloque brillante en medio de un modal azul y
       dorado — se veía pegado de otro sitio. La G tiene que quedar a color
       sobre su pastilla blanca: es requisito de marca de Google. */
    + '.cf-gbtn{width:100%;display:flex;align-items:center;justify-content:center;gap:.65rem;'
    + 'padding:.78rem;border-radius:10px;border:1px solid rgba(255,255,255,.16);background:#131314;'
    + 'color:#f0f4f8;font-family:inherit;font-size:.78rem;font-weight:500;cursor:pointer;'
    + 'transition:border-color .2s,background .2s}'
    + '.cf-gbtn:hover{background:#1c1c1e;border-color:rgba(255,255,255,.3)}'
    + '.cf-gbtn:disabled{opacity:.55;cursor:default}'
    + '.cf-gmark{display:grid;place-items:center;width:19px;height:19px;flex-shrink:0;'
    + 'border-radius:50%;background:#fff}'
    + '.cf-or{display:flex;align-items:center;gap:.7rem;margin:1.1rem 0;'
    + 'color:#5b7a90;font-size:.62rem;letter-spacing:.16em;text-transform:uppercase}'
    + '.cf-or::before,.cf-or::after{content:"";flex:1;height:1px;background:rgba(200,169,110,.16)}'
    + '.cf-f{margin-bottom:.75rem}'
    + '.cf-f label{display:block;font-size:.62rem;letter-spacing:.13em;text-transform:uppercase;'
    + 'color:#7a95aa;margin-bottom:.32rem}'
    + '.cf-f input{width:100%;padding:.7rem .85rem;border-radius:9px;background:rgba(6,14,28,.75);'
    + 'border:1px solid rgba(200,169,110,.2);color:#f0f4f8;font-family:inherit;font-size:.85rem;'
    + 'outline:none;transition:.2s}'
    + '.cf-f input:focus{border-color:rgba(200,169,110,.6);background:rgba(6,14,28,.95)}'
    + '.cf-f input.cf-bad{border-color:#e05c4a}'
    + '.cf-go{width:100%;padding:.82rem;margin-top:.5rem;border:0;border-radius:10px;cursor:pointer;'
    + 'background:linear-gradient(135deg,#c8a96e,#9a7a48);color:#060e1c;font-family:inherit;'
    + 'font-size:.72rem;font-weight:700;letter-spacing:.14em;text-transform:uppercase;transition:.2s}'
    + '.cf-go:hover{filter:brightness(1.1)}.cf-go:disabled{opacity:.55;cursor:default}'
    + '.cf-alt{text-align:center;margin-top:1rem;font-size:.72rem;color:#7a95aa}'
    + '.cf-alt button{background:none;border:0;color:#c8a96e;cursor:pointer;font-family:inherit;'
    + 'font-size:.72rem;text-decoration:underline;padding:0}'
    + '.cf-msg{margin-top:.85rem;padding:.6rem .75rem;border-radius:8px;font-size:.72rem;'
    + 'line-height:1.45;display:none}'
    + '.cf-msg.err{display:block;background:rgba(224,92,74,.12);border:1px solid rgba(224,92,74,.3);color:#ff9b8c}'
    + '.cf-msg.ok{display:block;background:rgba(39,174,96,.12);border:1px solid rgba(39,174,96,.3);color:#6fe0a0}'
    + '.cf-perk{margin:0 0 1.3rem;padding:.75rem .85rem;border-radius:10px;'
    + 'background:rgba(200,169,110,.07);border:1px solid rgba(200,169,110,.16);'
    + 'font-size:.71rem;color:#b9c9d6;line-height:1.55;text-align:center}'
    + '.cf-perk b{color:#e8c98a}';

  var modalEl = null, modalMode = 'in', onSuccess = null;

  function buildModal() {
    if (modalEl) return modalEl;
    var st = document.createElement('style');
    st.textContent = MODAL_CSS;
    document.head.appendChild(st);

    var ov = document.createElement('div');
    ov.className = 'cf-ov';
    ov.id = 'cf-auth-overlay';
    ov.innerHTML =
      '<div class="cf-modal" role="dialog" aria-modal="true" aria-labelledby="cf-ttl">' +
        '<button class="cf-x" id="cf-x" aria-label="Cerrar">&times;</button>' +
        '<h2 class="cf-ttl" id="cf-ttl">Ingresar</h2>' +
        '<p class="cf-sub" id="cf-sub">Entrá a tu cuenta para ver tus pedidos y tus puntos.</p>' +
        '<div class="cf-perk">Acumulá <b>puntos</b> en cada compra y canjealos por <b>premios</b>.</div>' +
        '<button class="cf-gbtn" id="cf-google">' +
          '<span class="cf-gmark">' +
          '<svg width="13" height="13" viewBox="0 0 48 48" aria-hidden="true">' +
            '<path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.6 30.2 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.8 6.1C12.3 13.2 17.7 9.5 24 9.5z"/>' +
            '<path fill="#4285F4" d="M46.1 24.6c0-1.6-.1-3.1-.4-4.6H24v9.1h12.4c-.5 2.9-2.2 5.3-4.6 7l7.6 5.9c4.4-4.1 6.7-10.1 6.7-17.4z"/>' +
            '<path fill="#FBBC05" d="M10.4 28.7c-.5-1.4-.8-2.9-.8-4.7s.3-3.3.8-4.7l-7.8-6.1C.9 16.5 0 20.1 0 24s.9 7.5 2.6 10.8l7.8-6.1z"/>' +
            '<path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.6-5.9c-2.1 1.4-4.8 2.3-8.3 2.3-6.3 0-11.7-3.7-13.6-9.8l-7.8 6.1C6.5 42.6 14.6 48 24 48z"/>' +
          '</svg></span>' +
          '<span id="cf-glabel">Continuar con Google</span>' +
        '</button>' +
        '<div class="cf-or">o con tu correo</div>' +
        '<form id="cf-form" novalidate>' +
          '<div class="cf-f" id="cf-fname" style="display:none">' +
            '<label for="cf-name">Nombre completo</label>' +
            '<input id="cf-name" type="text" autocomplete="name" placeholder="Ej: María Rodríguez">' +
          '</div>' +
          '<div class="cf-f" id="cf-fphone" style="display:none">' +
            '<label for="cf-phone">Teléfono (WhatsApp)</label>' +
            '<input id="cf-phone" type="tel" inputmode="numeric" autocomplete="tel" placeholder="8888 8888">' +
          '</div>' +
          '<div class="cf-f" id="cf-fzona" style="display:none">' +
            '<label for="cf-zona">Zona de entrega <span style="opacity:.6">(opcional)</span></label>' +
            '<select id="cf-zona"><option value="">Elegí tu zona…</option></select>' +
          '</div>' +
          '<div class="cf-f" id="cf-fdir" style="display:none">' +
            '<label for="cf-dir">Dirección <span style="opacity:.6">(opcional)</span></label>' +
            '<input id="cf-dir" type="text" autocomplete="street-address" ' +
              'placeholder="Señas para la entrega">' +
          '</div>' +
          '<div class="cf-f" id="cf-femail">' +
            '<label for="cf-email">Correo</label>' +
            '<input id="cf-email" type="email" autocomplete="email" placeholder="tucorreo@gmail.com">' +
          '</div>' +
          '<div class="cf-f" id="cf-fpass">' +
            '<label for="cf-pass">Contraseña</label>' +
            '<input id="cf-pass" type="password" autocomplete="current-password" placeholder="Mínimo 6 caracteres">' +
          '</div>' +
          '<button type="submit" class="cf-go" id="cf-submit">Ingresar</button>' +
        '</form>' +
        '<div class="cf-msg" id="cf-msg"></div>' +
        '<div class="cf-alt" id="cf-alt"></div>' +
      '</div>';
    document.body.appendChild(ov);
    modalEl = ov;

    ov.addEventListener('click', function (e) { if (e.target === ov) closeModal(); });
    document.getElementById('cf-x').addEventListener('click', closeModal);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && ov.classList.contains('open')) closeModal();
    });
    document.getElementById('cf-google').addEventListener('click', doGoogle);
    document.getElementById('cf-form').addEventListener('submit', doSubmit);
    return ov;
  }

  function setMsg(text, kind) {
    var m = document.getElementById('cf-msg');
    if (!m) return;
    m.className = 'cf-msg' + (text ? ' ' + (kind || 'err') : '');
    m.textContent = text || '';
  }
  function busy(on) {
    ['cf-google', 'cf-submit'].forEach(function (id) {
      var b = document.getElementById(id); if (b) b.disabled = !!on;
    });
    var s = document.getElementById('cf-submit');
    if (s) s.textContent = on ? 'Un momento…'
      : (modalMode === 'up'    ? 'Crear mi cuenta'
      :  modalMode === 'reset' ? 'Enviar enlace'
      :  modalMode === 'phone' ? 'Guardar y entrar'
      :  'Ingresar');
  }

  function setMode(mode) {
    modalMode = mode;
    buildModal();
    var isUp = mode === 'up', isReset = mode === 'reset', isPhone = mode === 'phone';

    // Paso "teléfono": Google devuelve nombre, correo y foto, pero NUNCA el
    // teléfono — y sin teléfono Jesús no puede coordinar la entrega. Se pide
    // acá, que es el momento de mayor intención, no después.
    document.getElementById('cf-ttl').textContent =
      isPhone ? '¡Bienvenido!' : isUp ? 'Crear cuenta'
      : isReset ? 'Recuperar contraseña' : 'Ingresar';
    document.getElementById('cf-sub').textContent =
      isPhone ? 'Solo falta tu teléfono para poder coordinar las entregas.'
      : isUp    ? 'Creá tu cuenta y empezá a acumular puntos desde tu próxima compra.'
      : isReset ? 'Te mandamos un enlace al correo para poner una contraseña nueva.'
      : 'Entrá a tu cuenta para ver tus pedidos y tus puntos.';

    document.getElementById('cf-fname').style.display  = isUp ? '' : 'none';
    document.getElementById('cf-fphone').style.display = (isUp || isPhone) ? '' : 'none';
    document.getElementById('cf-fzona').style.display  = isUp ? '' : 'none';
    document.getElementById('cf-fdir').style.display   = isUp ? '' : 'none';
    if (isUp) llenarZonasDelRegistro();
    document.getElementById('cf-femail').style.display = isPhone ? 'none' : '';
    document.getElementById('cf-fpass').style.display  = (isReset || isPhone) ? 'none' : '';
    document.getElementById('cf-google').style.display = (isReset || isPhone) ? 'none' : '';
    document.querySelector('.cf-or').style.display     = (isReset || isPhone) ? 'none' : '';
    document.querySelector('.cf-perk').style.display   = isReset ? 'none' : '';
    document.getElementById('cf-pass').setAttribute('autocomplete', isUp ? 'new-password' : 'current-password');
    document.getElementById('cf-x').style.display = isPhone ? 'none' : '';

    var alt = document.getElementById('cf-alt');
    alt.innerHTML = isPhone
      ? '<button type="button" data-go="skip" style="color:#7a95aa">Lo pongo después</button>'
      : isUp
      ? '¿Ya tenés cuenta? <button type="button" data-go="in">Ingresá acá</button>'
      : isReset
        ? '<button type="button" data-go="in">Volver</button>'
        : '¿Primera vez? <button type="button" data-go="up">Creá tu cuenta</button>' +
          '<br><button type="button" data-go="reset" style="margin-top:.45rem">Olvidé mi contraseña</button>';
    Array.prototype.forEach.call(alt.querySelectorAll('button'), function (b) {
      b.addEventListener('click', function () {
        setMsg('');
        if (b.dataset.go === 'skip') { finish(state.user); return; }
        setMode(b.dataset.go);
      });
    });
    busy(false);
    setMsg('');
  }

  function openModal(mode, cb) {
    buildModal();
    onSuccess = cb || null;
    setMode(mode || 'in');
    modalEl.classList.add('open');
    setTimeout(function () {
      var f = document.getElementById(
        modalMode === 'up' ? 'cf-name' : modalMode === 'phone' ? 'cf-phone' : 'cf-email');
      if (f) f.focus();
    }, 60);
  }
  function closeModal() {
    if (modalEl) modalEl.classList.remove('open');
    setMsg('');

    /* El paso "solo falta tu teléfono" ya ocurre CON la sesión abierta: es
       opcional, no una cancelación. Cerrarlo con Escape o tocando afuera
       tiene que valer lo mismo que el botón "Lo pongo después".
       Si no, quien entraba con Google desde el carrito quedaba logueado
       pero el pedido que disparó el modal se perdía en silencio. */
    if (modalMode === 'phone') {
      var cb = onSuccess; onSuccess = null;
      if (cb) { try { cb(state.user); } catch (e) { console.error(e); } }
    }
  }

  function finish(user) {
    // Se toma el callback ANTES de cerrar: closeModal también puede dispararlo
    // (paso del teléfono) y así nunca corre dos veces.
    var cb = onSuccess; onSuccess = null;
    closeModal();
    if (cb) { try { cb(user); } catch (e) { console.error(e); } }
  }

  async function doGoogle() {
    setMsg(''); busy(true);
    try {
      var u = await signInGoogle();
      if (!u) return;                 // fue redirect: vuelve tras recargar
      if (!(await tienePhone(u))) { busy(false); setMode('phone'); return; }
      finish(u);
    } catch (e) {
      var m = errMsg(e); if (m) setMsg(m, 'err');
    } finally { busy(false); }
  }

  async function tienePhone(user) {
    try {
      var snap = await db.collection('users').doc(user.uid).get();
      return !!(snap.exists && snap.data().phone);
    } catch (e) { return true; }   // ante la duda no molestamos al cliente
  }

  async function doSubmit(ev) {
    ev.preventDefault();
    setMsg('');
    var email = (document.getElementById('cf-email').value || '').trim();
    var pass  = document.getElementById('cf-pass').value || '';
    var name  = (document.getElementById('cf-name').value || '').trim();
    var phone = (document.getElementById('cf-phone').value || '').trim();

    function bad(id, cond) {
      var el = document.getElementById(id);
      if (el) el.classList.toggle('cf-bad', !!cond);
      return cond;
    }
    var invalid = false;
    if (modalMode === 'phone') {
      if (bad('cf-phone', normPhone(phone).length < 8)) {
        setMsg('El teléfono va con 8 dígitos.', 'err');
        return;
      }
    } else {
      invalid = bad('cf-email', !email || email.indexOf('@') < 0) || invalid;
      if (modalMode !== 'reset') invalid = bad('cf-pass', pass.length < 6) || invalid;
      if (modalMode === 'up') {
        invalid = bad('cf-name', !name) || invalid;
        invalid = bad('cf-phone', normPhone(phone).length < 8) || invalid;
      }
      if (invalid) {
        setMsg(modalMode === 'up'
          ? 'Revisá los campos marcados. El teléfono va con 8 dígitos y la contraseña necesita 6 o más.'
          : 'Revisá el correo y la contraseña (mínimo 6 caracteres).', 'err');
        return;
      }
    }

    busy(true);
    try {
      if (modalMode === 'phone') {
        await saveProfile({ phone: normPhone(phone) });
        finish(state.user);
      } else if (modalMode === 'reset') {
        await resetPassword(email);
        setMsg('Listo. Revisá tu correo (y la carpeta de spam) para el enlace.', 'ok');
      } else if (modalMode === 'up') {
        var zonaEl = document.getElementById('cf-zona');
        var dirEl  = document.getElementById('cf-dir');
        var nu = await signUpEmail(email, pass, name, normPhone(phone),
          zonaEl ? zonaEl.value : '', dirEl ? dirEl.value.trim() : '');
        finish(nu);
      } else {
        var u = await signInEmail(email, pass);
        finish(u);
      }
    } catch (e) {
      var m = errMsg(e); if (m) setMsg(m, 'err');
    } finally { busy(false); }
  }

  /* ═══ ENLACE DE CUENTA EN EL NAV ═════════════════════════════
     El HTML trae el <a id="cf-account-link"> ya puesto (sin inyección,
     para que no salte el layout); acá solo se le cambia la etiqueta. */
  function paintNav() {
    var links = document.querySelectorAll('#cf-account-link, .cf-account-link');
    Array.prototype.forEach.call(links, function (a) {
      var label = a.querySelector('.cf-acc-label') || a;
      if (state.user) {
        var p = state.profile;
        var first = ((p && p.name) || state.user.displayName || '').trim().split(/\s+/)[0];
        label.textContent = first ? first : 'Mi cuenta';
        a.setAttribute('href', 'mi-cuenta.html');
        a.setAttribute('title', 'Mi cuenta · ' + ((p && p.points) || 0) + ' puntos');
      } else {
        label.textContent = 'Ingresar';
        a.setAttribute('href', 'mi-cuenta.html');
        a.setAttribute('title', 'Ingresar o crear cuenta');
      }
    });
  }

  /* ═══ ARRANQUE ═══════════════════════════════════════════════ */
  if (auth) {
    auth.onAuthStateChanged(function (user) {
      state.user = user || null;
      if (user) {
        watchProfile(user.uid);
        // Si volvió de un signInWithRedirect, el doc puede no existir todavía.
        ensureProfile(user).catch(function (e) { console.error('[CF] ensureProfile', e); });
      } else {
        if (unsubProfile) { unsubProfile(); unsubProfile = null; }
        state.profile = null;
      }
      state.loaded = true;
      emit();
      readyResolve(user || null);
    });
    onUser(paintNav);
  }

  /* ═══ API PÚBLICA ════════════════════════════════════════════ */
  window.CF = {
    auth: auth,
    db: db,
    config: FB_CONFIG,
    get TIERS()   { return TIERS; },       // getter: cambia al llegar la config
    get siteCfg() { return siteCfg || {}; },
    cfgReady: cfgPromise,
    tierOf: tierOf,
    nextTier: nextTier,

    /* ¿El programa de puntos está encendido?
       Lo apaga Jesús desde el panel (config.pointsEnabled). El panel ya lo
       respetaba —`if (!ptsEnabled()) return;` antes de acreditar— pero el
       sitio no lo miraba: con el programa apagado le seguía prometiendo al
       cliente "te va a sumar 687 puntos" y esos puntos no llegaban nunca. */
    get pointsEnabled() { return (siteCfg || {}).pointsEnabled !== false; },

    /* Puntos que da un monto en un nivel dado.
       Es LA fórmula: la comparten mi-cuenta.html (para el ejemplo de cada
       nivel) y el propio pointsFor. El panel tiene su copia en
       `pointsForAmount()` porque no puede cargar auth.js — si tocás una,
       tocá la otra, o el cliente ve un número y recibe otro. */
    pointsForTier: pointsForTier,

    // Puntos que daría un monto al dueño de esos puntos acumulados.
    pointsFor: function (amount, lifetimePoints) {
      return pointsForTier(amount, tierOf(lifetimePoints));
    },

    get user()    { return state.user; },
    get profile() { return state.profile; },
    get points()  { return (state.profile && state.profile.points) || 0; },
    ready: readyPromise,
    onUser: onUser,

    signInGoogle: signInGoogle,
    signUpEmail: signUpEmail,
    signInEmail: signInEmail,
    resetPassword: resetPassword,
    signOut: signOutNow,
    saveProfile: saveProfile,

    openAuth: openModal,
    closeAuth: closeModal,

    // Devuelve el usuario, abriendo el modal si hace falta.
    requireAuth: function () {
      return readyPromise.then(function () {
        if (state.user) return state.user;
        return new Promise(function (resolve) { openModal('in', resolve); });
      });
    },

    normCodigo: normCodigo,
    validarCupon: validarCupon,
    buscarCupon: buscarCupon,

    fmtNum: fmtNum,
    fmtColones: fmtColones,
    favs: favs,
    esFav: esFav,
    toggleFav: toggleFav,
    syncFavs: syncFavs,

    monograma: monograma,
    esc: esc,
    normPhone: normPhone,
    toDate: toDate,
    fmtDate: fmtDate,
    errMsg: errMsg
  };
})();
