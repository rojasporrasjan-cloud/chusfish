
/* ═══ CONFIG: Banner y Zonas de entrega ═══ */
function showBanner(msg) {
  var bannerColorEl = document.getElementById('closing-banner');
  if (arguments[1] && bannerColorEl) {
    var _bc = arguments[1];
    var _r = parseInt(_bc.slice(1,3),16), _g = parseInt(_bc.slice(3,5),16), _b = parseInt(_bc.slice(5,7),16);
    var _lum = (0.299*_r + 0.587*_g + 0.114*_b) / 255;
    bannerColorEl.style.background = _bc;
    bannerColorEl.style.color = _lum > 0.5 ? '#060e1c' : '#ffffff';
  }
  const bannerEl    = document.getElementById('closing-banner');
  const bannerTrack = document.getElementById('closing-banner-track');
  document.getElementById('closing-banner-text').textContent = msg;
  bannerEl.classList.add('show');
  document.body.classList.add('banner-visible');
  requestAnimationFrame(() => {
    if (bannerTrack.scrollWidth > bannerEl.clientWidth) {
      const dur = Math.max(12, Math.round(msg.length * 0.22));
      bannerEl.style.setProperty('--banner-dur', dur + 's');
      bannerEl.classList.add('scrolling');
    }
  });
}

(async function loadSiteConfig() {
  try {
    const cfgSnap = await db_cat.collection('chusfish').doc('config').get();
    if (!cfgSnap.exists) return;
    const cfg = cfgSnap.data();

    if (cfg.closingEnabled && cfg.closingMessage) {
      showBanner(cfg.closingMessage, cfg.bannerColor);
    }

    startCountdown(cfg);

    if (cfg.scheduleEnabled && cfg.openTime && cfg.closeTime) {
      const now = new Date();
      const [oh, om] = cfg.openTime.split(':').map(Number);
      const [ch, cm] = cfg.closeTime.split(':').map(Number);
      const nowMin  = now.getHours() * 60 + now.getMinutes();
      const openMin = oh * 60 + om;
      const closeMin = ch * 60 + cm;
      const isClosed = nowMin < openMin || nowMin >= closeMin;
      if (isClosed) {
        const waBtn = document.getElementById('cart-wa-btn');
        if (waBtn) {
          waBtn.disabled = true;
          waBtn.style.opacity = '0.45';
          waBtn.style.cursor = 'not-allowed';
          waBtn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg> Pedidos hasta las ${cfg.closeTime}`;
        }
        if (!cfg.closingEnabled) {
          showBanner(`Pedidos cerrados · Horario: ${cfg.openTime} - ${cfg.closeTime}`);
        }
      }
    }

    if (cfg.zones && cfg.zones.length > 0) {
      const activeZones = cfg.zones.filter(z => z.active !== false);
      if (activeZones.length > 0) {
        const chipsWrap = document.getElementById('of-zone-chips');
        activeZones.forEach(z => {
          const chip = document.createElement('div');
          chip.className = 'zone-chip';
          chip.dataset.value = z.name;
          chip.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>${z.name}`;
          chip.addEventListener('click', () => {
            chipsWrap.querySelectorAll('.zone-chip').forEach(c => c.classList.remove('selected'));
            chip.classList.add('selected');
            chipsWrap.classList.remove('of-error');
            updateDeliveryFee(z.price || 0);
          });
          chipsWrap.appendChild(chip);
        });
        document.getElementById('of-zone-field').style.display = '';
      }
    }
    if (typeof cfg.shippingFee === 'number' && cfg.shippingFee > 0) {
      updateDeliveryFee(cfg.shippingFee);
    }

        if (cfg.deliveryDays && cfg.deliveryDays.length > 0) {
      const DAY_NAMES = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
      const MON_NAMES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
      const dateChipsWrap = document.getElementById('of-date-chips');
      const today = new Date(); today.setHours(0,0,0,0);
      const dates = [];
      for (let offset = 1; offset <= 14; offset++) {
        const d = new Date(today); d.setDate(today.getDate() + offset);
        if (cfg.deliveryDays.includes(d.getDay())) dates.push(d);
      }
      if (dates.length > 0) {
        dates.forEach(d => {
          const chip = document.createElement('div');
          chip.className = 'date-chip';
          const label = `${DAY_NAMES[d.getDay()]} ${d.getDate()} ${MON_NAMES[d.getMonth()]}`;
          chip.dataset.value = label;
          chip.innerHTML = `<span class="dc-day">${DAY_NAMES[d.getDay()]}</span><span class="dc-num">${d.getDate()}</span><span class="dc-mon">${MON_NAMES[d.getMonth()]}</span>`;
          chip.addEventListener('click', () => {
            dateChipsWrap.querySelectorAll('.date-chip').forEach(c => c.classList.remove('selected'));
            chip.classList.add('selected');
            dateChipsWrap.classList.remove('of-error');
          });
          dateChipsWrap.appendChild(chip);
        });
        document.getElementById('of-date-field').style.display = '';
      }
    }
    /* ═══ OFERTAS ESPECIALES ═══ */
    (function renderOfertas() {
      // Soportar formato nuevo (especiales[]) y antiguo (especial{}) al mismo tiempo
      const rawList = cfg.especiales ||
        (cfg.especial && cfg.especial.productId ? [cfg.especial] : []);
      const actives = rawList.filter(function(e){ return e && e.productId && e.enabled !== false; });
      if (!actives.length) return;
      const sec = document.getElementById('especial-section');
      if (!sec) return;
      const cards = actives.map(function(esp) {
        const prod = PRODUCTS.find(function(p){ return p.id === +esp.productId; });
        if (!prod) return '';
        const specialPrice = esp.price || null;
        const origPrice    = (esp.showOriginal && esp.originalPrice) ? esp.originalPrice : null;
        const fallbackPrice = (!specialPrice && prod.price) ? prod.price : null;
        const imgHtml = (prod.img || getStoredImage(prod.id))
          ? '<img class="especial-img" src="' + (prod.img || getStoredImage(prod.id)) + '" alt="' + prod.name + '" loading="lazy">'
          : '<div class="especial-img-placeholder">&#128031;</div>';
        const ctaName = prod.name.replace(/'/g, "\'");
        return '<div class="especial-card">' +
          imgHtml +
          '<div style="flex:1">' +
            '<div class="especial-badge">&#11088; Oferta especial</div>' +
            '<div class="especial-name">' + prod.name + '</div>' +
            (esp.msg ? '<div class="especial-msg">' + esp.msg + '</div>' : '') +
            '<div class="especial-price-wrap">' +
              (specialPrice ? '<div class="especial-price-new">&#8353;' + specialPrice.toLocaleString() + '</div>' : '') +
              (origPrice    ? '<div class="especial-price-old">&#8353;' + origPrice.toLocaleString() + '</div>' : '') +
              (fallbackPrice ? '<div class="especial-price-new">&#8353;' + fallbackPrice.toLocaleString() + ' <small style="font-size:0.55em;opacity:0.7">' + prod.unit + '</small></div>' : '') +
            '</div>' +
            '<button class="especial-cta" onclick="(function(){var p=PRODUCTS.find(function(x){return x.id===' + prod.id + '});if(p)addToCart(p,getMin(p.unit));showToast(\'' + ctaName + ' agregado al carrito ✅\')})()">Agregar al carrito</button>' +
          '</div>' +
        '</div>';
      }).join('');
      sec.innerHTML = '<div class="especiales-flex">' + cards + '</div>';
      sec.style.display = '';
      const espSep = document.getElementById('especial-sep');
      if (espSep) espSep.style.display = '';
    })();

    /* ═══ PRODUCTOS DESTACADOS ═══ */
    (function renderDestacados() {
      // Usa los destacados configurados en el admin; si no hay, mismo respaldo que la landing.
      const ids = (Array.isArray(cfg.featuredIds) && cfg.featuredIds.length) ? cfg.featuredIds : [11, 7, 59, 13];
      if (!ids.length) return;
      const featured = ids
        .map(function(id){ return PRODUCTS.find(function(p){ return p.id === +id; }); })
        .filter(function(p){ return p && p.available !== false; });
      if (!featured.length) return;
      const row = document.getElementById('destacados-row');
      if (!row) return;
      row.innerHTML = featured.map(function(p) {
        const imgSrc = p.img || getStoredImage(p.id);
        const imgHtml = imgSrc
          ? '<img src="' + imgSrc + '" alt="' + p.name + '" loading="lazy">'
          : '<div class="dest-img-placeholder">&#128031;</div>';
        const priceHtml = (p.price == null)
          ? '<span style="font-size:0.8rem;color:var(--muted)">Consultar</span>'
          : '<small>&#8353;</small>' + p.price.toLocaleString() + ' <small>' + p.unit + '</small>';
        const safeName = p.name.replace(/'/g, "\\'");
        return '<div class="dest-card">' +
          '<span class="dest-star">&#11088; Destacado</span>' +
          '<div class="dest-img" onclick="openModal(' + p.id + ')">' + imgHtml + '</div>' +
          '<div class="dest-body">' +
            '<div class="dest-name">' + p.name + '</div>' +
            '<div class="dest-price">' + priceHtml + '</div>' +
            '<div class="dest-actions">' +
              '<button class="dest-more" onclick="openModal(' + p.id + ')">Ver más</button>' +
              '<button class="dest-add" onclick="(function(){var p=PRODUCTS.find(function(x){return x.id===' + p.id + '});if(p){addToCart(p,getMin(p.unit));showToast(\'' + safeName + ' agregado al carrito ✅\')}})()">+ Agregar</button>' +
            '</div>' +
          '</div>' +
        '</div>';
      }).join('');
      document.getElementById('destacados-section').style.display = '';
      const sep = document.getElementById('destacados-sep');
      if (sep) sep.style.display = '';
    })();

    /* ═══ COMBOS Y PROMOCIONES ═══ */
    (function renderPromos() {
      if (!cfg.promotions || !cfg.promotions.length) return;
      const activePromos = cfg.promotions.filter(function(p){ return p.enabled !== false && p.items && p.items.length > 0; });
      if (!activePromos.length) return;
      const grid = document.getElementById('promos-grid');
      if (!grid) return;
      grid.innerHTML = activePromos.map(function(promo, pi) {
        const isCombo = promo.items.length > 1;
        const badgeText = isCombo ? '&#127881; Combo especial' : '&#127991; Promoción';
        const itemsHtml = promo.items.map(function(item) {
          return '<div class="promo-item-pill">' +
            (item.qty ? '<span class="promo-item-qty">' + item.qty + '</span>' : '') +
            item.name + '</div>';
        }).join('');
        const priceHtml = promo.price
          ? '<div class="promo-price-wrap"><div class="promo-price">&#8353;' + parseInt(promo.price).toLocaleString() + '</div><div class="promo-price-label">' + (isCombo ? 'precio del combo' : 'precio especial') + '</div></div>'
          : '';
        const promoImgs = (promo.images && promo.images.length) ? promo.images : (promo.img ? [promo.img] : []);
        const promoImgHtml = promoImgs.length === 0 ? ''
          : promoImgs.length === 1
          ? '<img class="promo-card-img" src="' + promoImgs[0] + '" alt="' + promo.name + '" loading="lazy">'
          : buildCarousel(promoImgs, promo.name);
        return '<div class="promo-card">' +
          promoImgHtml +
          '<div class="promo-badge">' + badgeText + '</div>' +
          '<div class="promo-name">' + promo.name + '</div>' +
          (promo.desc ? '<div class="promo-desc">' + promo.desc + '</div>' : '') +
          '<div class="promo-items">' + itemsHtml + '</div>' +
          priceHtml +
          '<button class="promo-add-btn" onclick="addPromoToCart(' + pi + ')">+ Agregar al carrito</button>' +
        '</div>';
      }).join('');
      document.getElementById('promos-section').style.display = '';
      const sep = document.getElementById('promos-sep');
      if (sep) sep.style.display = '';
      window._promos = activePromos;
    })();

    /* ═══ RECETAS DE LA SEMANA ═══ */
    if (cfg.recipes && cfg.recipes.length > 0) {
      const grid = document.getElementById('recetas-grid');
      grid.innerHTML = cfg.recipes.map((r, ri) => {
        const ingsHtml = (r.ingredients || []).map(function(ing) {
          const badge = ing.productId ? '<span style="font-size:0.6rem;color:var(--gold-dk);margin-left:4px;opacity:0.8">✓</span>' : '';
          return '<div class="receta-ing-row"><span class="receta-ing-name">' + ing.name + badge + '</span><span class="receta-ing-qty">' + (ing.qty || '') + '</span></div>';
        }).join('');
        const icons = ['🍤','🐟','🦐','🦑','🐙','🍽️','🐠'];
        const recImgs = (r.images && r.images.length) ? r.images : (r.img ? [r.img] : []);
        const recHeaderHtml = recImgs.length === 0
          ? '<div class="receta-header-icon">' + icons[ri % icons.length] + '</div>'
          : recImgs.length === 1
          ? '<img class="receta-card-img" src="' + recImgs[0] + '" alt="' + r.name + '" loading="lazy">'
          : buildCarousel(recImgs, r.name);
        return '<div class="receta-card">' +
          recHeaderHtml +
          '<div class="receta-card-title">' + r.name + '</div>' +
          (r.desc ? '<div class="receta-card-desc">' + r.desc + '</div>' : '') +
          '<div class="receta-ingredientes-label">Ingredientes</div>' +
          '<div class="receta-ingredientes">' + ingsHtml + '</div>' +
          '<button class="receta-add-btn" onclick="addRecipeToCart(' + ri + ')">+ Agregar ingredientes al carrito</button>' +
        '</div>';
      }).join('');
      document.getElementById('recetas-section').style.display = '';
      const recSep = document.getElementById('recetas-sep');
      if (recSep) recSep.style.display = '';
      window._recipes = cfg.recipes;
    }

  } catch(e) {
  }
})();


/* ── Carrusel ── */
function buildCarousel(imgs, alt) {
  var id = 'car-' + Math.random().toString(36).slice(2, 7);
  var slides = imgs.map(function(src) {
    return '<img src="' + src + '" alt="' + alt + '" loading="lazy">';
  }).join('');
  var dots = imgs.map(function(_, i) {
    return '<button class="carousel-dot' + (i === 0 ? ' active' : '') + '" onclick="carGo(\'' + id + '\',' + i + ')"></button>';
  }).join('');
  return '<div class="card-carousel" id="' + id + '" data-idx="0"' +
    ' ontouchstart="carTouch(this,event)" ontouchend="carSwipe(this,event)">' +
    '<div class="carousel-track">' + slides + '</div>' +
    '<div class="carousel-dots">' + dots + '</div>' +
  '</div>';
}
function carGo(id, idx) {
  var el = document.getElementById(id);
  if (!el) return;
  el.dataset.idx = idx;
  el.querySelector('.carousel-track').style.transform = 'translateX(-' + (idx * 100) + '%)';
  el.querySelectorAll('.carousel-dot').forEach(function(d, i) { d.classList.toggle('active', i === idx); });
}
function carTouch(el, e) { el._tx = e.touches[0].clientX; }
function carSwipe(el, e) {
  var dx = e.changedTouches[0].clientX - (el._tx || 0);
  if (Math.abs(dx) < 30) return;
  var total = el.querySelectorAll('.carousel-track img').length;
  var idx = Math.max(0, Math.min(total - 1, (+el.dataset.idx || 0) + (dx < 0 ? 1 : -1)));
  carGo(el.id, idx);
}

function addPromoToCart(promoIdx) {
  var promo = (window._promos || [])[promoIdx];
  if (!promo || !promo.items) return;
  var added = 0;
  promo.items.forEach(function(item) {
    var p = (item.productId ? PRODUCTS.find(function(x){ return x.id === +item.productId; }) : null)
            || PRODUCTS.find(function(x){ return x.name.toLowerCase().includes((item.name||'').toLowerCase()); });
    if (p && p.available !== false) {
      var qty = parseFloat(item.qty) || getMin(p.unit);
      addToCart(p, qty); added++;
    }
  });
  showToast(added > 0
    ? '&#127881; "' + promo.name + '" agregado al carrito (' + added + ' producto' + (added>1?'s':'') + ')'
    : 'No se encontraron productos disponibles del combo');
}

function addRecipeToCart(recipeIdx) {
  const r = (window._recipes || [])[recipeIdx];
  if (!r || !r.ingredients) return;
  let added = 0;
  r.ingredients.forEach(function(ing) {
    // Preferir búsqueda por ID exacto, fallback a nombre fuzzy para recetas antiguas
    const p = (ing.productId ? PRODUCTS.find(function(x){ return x.id === +ing.productId; }) : null)
              || PRODUCTS.find(function(x){ return x.name.toLowerCase().includes((ing.name||'').toLowerCase()); });
    if (p && p.available !== false) {
      const qty = parseFloat(ing.qty) || getMin(p.unit);
      addToCart(p, qty); added++;
    }
  });
  showToast(added > 0 ? added + ' ingrediente' + (added>1?'s':'') + ' de "' + r.name + '" al carrito ✅' : 'No se encontraron productos disponibles');
}

/* ═══ ORDER FORM (carrito) ═══ */
function openCartOrderForm() {
  const cartItems = cart; // cart is defined in the main script
  if (!cartItems || cartItems.length === 0) return;

  const total = cartItems.reduce((sum, i) => sum + (i.product.price || 0) * i.qty, 0);

  const summary = document.getElementById('order-form-summary');
  summary.style.display = 'block';

  const itemCount = cartItems.length;
  const itemsHtml = cartItems.map(i => {
    const priceHtml = i.product.price
      ? '<span class="ofs-item-price">₡ ' + fmt(i.product.price * i.qty) + '</span>'
      : '';
    const tag = i.product.preorder
      ? ' <span class="ofs-item-tag">· Previo</span>'
      : '';
    return '<div class="ofs-item"><span class="ofs-item-name">' +
      fmtQty(i.qty, i.product.unit) + ' ' + i.product.name + tag +
      '</span>' + priceHtml + '</div>';
  }).join('');

  let totalsHtml = '';
  if (total > 0) {
    const grandTotal = total + currentDeliveryFee;
    totalsHtml = '<div class="ofs-totals">';
    totalsHtml += '<div class="ofs-row"><span>Subtotal productos</span><span>₡ ' + fmt(total) + '</span></div>';
    if (currentDeliveryFee > 0) {
      totalsHtml += '<div class="ofs-row"><span>Envío</span><span>₡ ' + fmt(currentDeliveryFee) + '</span></div>';
    }
    totalsHtml += '<div class="ofs-row-total"><span>Total estimado</span><span>₡ ' + fmt(grandTotal) + '</span></div>';
    totalsHtml += '</div>';
    totalsHtml += '<p class="ofs-note">* Monto de referencia. El total final puede variar según el peso y se confirma por WhatsApp.</p>';
  }

  summary.innerHTML =
    '<div class="ofs-header">' +
      '<span class="ofs-icon">🛒</span>' +
      '<span class="ofs-title">Tu pedido</span>' +
      '<span class="ofs-count">' + itemCount + (itemCount === 1 ? ' producto' : ' productos') + '</span>' +
    '</div>' +
    '<div class="ofs-items">' + itemsHtml + '</div>' +
    totalsHtml;

  ['of-name','of-phone','of-address'].forEach(id => {
    const el = document.getElementById(id);
    el.value = '';
    el.classList.remove('of-error');
  });
  const zoneChips = document.getElementById('of-zone-chips');
  if (zoneChips) { zoneChips.querySelectorAll('.zone-chip').forEach(c => c.classList.remove('selected')); zoneChips.classList.remove('of-error'); }
  const dateChips = document.getElementById('of-date-chips');
  if (dateChips) { dateChips.querySelectorAll('.date-chip').forEach(c => c.classList.remove('selected')); dateChips.classList.remove('of-error'); }
  // Default payment to SINPE
  const payChips = document.getElementById('of-payment-chips');
  if (payChips) {
    payChips.querySelectorAll('.zone-chip').forEach(c => c.classList.remove('selected'));
    payChips.querySelector('.zone-chip').classList.add('selected');
  }

  const ov = document.getElementById('order-form-overlay');
  ov.classList.add('open');
  document.body.style.overflow = 'hidden';
  setTimeout(() => document.getElementById('of-name').focus(), 420);
}

function closeOrderForm() {
  document.getElementById('order-form-overlay').classList.remove('open');
  document.body.style.overflow = '';
}

// Payment chips click handler
document.getElementById('of-payment-chips').addEventListener('click', e => {
  const chip = e.target.closest('.zone-chip');
  if (!chip) return;
  document.querySelectorAll('#of-payment-chips .zone-chip').forEach(c => c.classList.remove('selected'));
  chip.classList.add('selected');
});

document.getElementById('order-form-close').addEventListener('click', closeOrderForm);
document.getElementById('order-form-overlay').addEventListener('click', function(e) {
  if (e.target === this) closeOrderForm();
});
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') closeOrderForm();
});

document.getElementById('order-form').addEventListener('submit', async function(e) {
  e.preventDefault();
  const name    = document.getElementById('of-name').value.trim();
  const phone   = document.getElementById('of-phone').value.trim();
  const address = document.getElementById('of-address').value.trim();
  const zoneField   = document.getElementById('of-zone-field');
  const zoneChipsEl = document.getElementById('of-zone-chips');
  const dateField   = document.getElementById('of-date-field');
  const dateChipsEl = document.getElementById('of-date-chips');
  const payChipsEl  = document.getElementById('of-payment-chips');
  const zoneVisible = zoneField && zoneField.style.display !== 'none';
  const dateVisible = dateField && dateField.style.display !== 'none';
  const selectedZone    = zoneChipsEl ? zoneChipsEl.querySelector('.zone-chip.selected') : null;
  const selectedDate    = dateChipsEl ? dateChipsEl.querySelector('.date-chip.selected') : null;
  const selectedPayment = payChipsEl  ? payChipsEl.querySelector('.zone-chip.selected')  : null;
  const payment = selectedPayment ? selectedPayment.dataset.value : 'SINPE Móvil';
  const zone  = selectedZone ? selectedZone.dataset.value : '';
  const fecha = selectedDate ? selectedDate.dataset.value : '';

  let valid = true;
  [['of-name', name], ['of-phone', phone], ['of-address', address]].forEach(([id, val]) => {
    const el = document.getElementById(id);
    if (!val) { el.classList.add('of-error'); valid = false; }
    else el.classList.remove('of-error');
  });
  if (zoneVisible && !zone) { if (zoneChipsEl) zoneChipsEl.classList.add('of-error'); valid = false; }
  else if (zoneChipsEl) zoneChipsEl.classList.remove('of-error');
  if (dateVisible && !fecha) { if (dateChipsEl) dateChipsEl.classList.add('of-error'); valid = false; }
  else if (dateChipsEl) dateChipsEl.classList.remove('of-error');
  if (!valid) return;

  let finalMsg = "Hola Chus's Fish! 🛒🐟 Quiero hacer un pedido a domicilio:\n\n";
  finalMsg += '📋 *Mis datos:*\n';
  finalMsg += '*Nombre:* ' + name + '\n';
  finalMsg += '*Teléfono:* ' + phone + '\n';
  if (zoneVisible && zone) finalMsg += '*Zona de entrega:* ' + zone + '\n';
  if (currentDeliveryFee > 0) finalMsg += '*Costo de envío:* ₡' + currentDeliveryFee.toLocaleString() + '\n';
  if (dateVisible && fecha) finalMsg += '*Fecha de entrega:* ' + fecha + '\n';
  finalMsg += '*Dirección:* ' + address + '\n';
  finalMsg += '*Pago:* ' + payment + '\n\n';
  finalMsg += '📦 *Mi pedido:*\n';

  const itemsForOrder = [];
  if (window._cartWaMsg) {
    const itemsOnly = window._cartWaMsg
      .replace(/^Hola Chus's Fish!.*?\n\n/s, '')
      .replace(/\nPor favor confirmar.*$/s, '');
    finalMsg += itemsOnly;
  }
  cart.forEach(i => itemsForOrder.push({ id: i.product.id, name: i.product.name, qty: i.qty, unit: i.product.unit, price: i.product.price }));

  finalMsg += '\nPor favor confirmar disponibilidad y coordinar la entrega. ¡Muchas gracias!';

  const waLink = 'https://wa.me/50660017370?text=' + encodeURIComponent(finalMsg);

  // Guardamos el pedido en segundo plano, sin bloquear la apertura de WhatsApp.
  const saveOrder = db_cat.collection('orders').add({
    customer: { name, phone, address, zone: zone || null, fecha: fecha || null, payment },
    items: itemsForOrder,
    deliveryFee: currentDeliveryFee || 0,
    status: 'pendiente',
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  }).then(() => {
    if (window.fbq) {
      const orderTotal = itemsForOrder.reduce((s,i) => s + (i.price||0)*i.qty, 0);
      fbq('track','Purchase',{ value: orderTotal, currency:'CRC', num_items: itemsForOrder.length });
    }
  }).catch(() => {});

  // Abrimos WhatsApp DENTRO del gesto del usuario (antes de cualquier await) para que
  // el navegador no bloquee la ventana emergente. Esa era la causa de los pedidos sin aviso.
  const waWin = window.open(waLink, '_blank');

  cart = [];
  saveCart();
  closeOrderForm();

  // Si el navegador bloqueó la ventana emergente, esperamos a guardar y navegamos a WhatsApp.
  if (!waWin) saveOrder.finally(() => { window.location.href = waLink; });
});

/* ═══ PRELOADER LOGIC ═══ */
window.addEventListener('load', () => {
  const preloader = document.getElementById('preloader');
  if (preloader) {
    // Delay de 2.5 segundos para garantizar que las imágenes JS tengan tiempo de cargar y que la animación se disfrute.
    setTimeout(() => {
      preloader.classList.add('fade-out');
      setTimeout(() => preloader.remove(), 800); // Quitar del DOM tras la animación
    }, 2500);
  }
});
