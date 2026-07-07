
  if (window.location.search.includes('print=true')) {
    setTimeout(() => {
      // Forzar carga de imágenes quitando el lazy loading
      document.querySelectorAll('img').forEach(img => {
        img.removeAttribute('loading');
      });
      
      // Pequeño truco: hacer scroll hacia abajo para asegurar que el navegador registre las imágenes
      window.scrollTo(0, document.body.scrollHeight);
      
      setTimeout(() => {
        window.scrollTo(0, 0);
        setTimeout(() => {
          window.print();
        }, 2000); // Dar 2 segundos para descargar las fotos
      }, 500);
    }, 3000); // Esperar a Firebase
  }

/* ════════════════════════════════════════ */
function startCountdown(cfg) {
  if (!cfg.scheduleEnabled || !cfg.openTime || !cfg.closeTime) return;
  const chip = document.getElementById('schedule-chip');
  if (!chip) return;

  function tick() {
    const now = new Date();
    const [oh, om] = cfg.openTime.split(':').map(Number);
    const [ch, cm] = cfg.closeTime.split(':').map(Number);
    const openMins  = oh * 60 + om;
    const closeMins = ch * 60 + cm;
    const nowMins   = now.getHours() * 60 + now.getMinutes();

    chip.style.display = 'inline-flex';
    if (nowMins >= openMins && nowMins < closeMins) {
      const rem = closeMins - nowMins;
      const h = Math.floor(rem / 60), m = rem % 60;
      chip.className = 'schedule-chip open';
      chip.innerHTML = `<span class="sched-dot"></span> Pedidos abiertos · cierra en ${h > 0 ? h + 'h ' : ''}${m}m`;
    } else {
      chip.className = 'schedule-chip closed';
      chip.innerHTML = `<span class="sched-dot"></span> Pedidos cerrados · Abrimos a las ${cfg.openTime}`;
    }
  }
  tick();
  setInterval(tick, 60000);
}

/* ════════════════════════════════════════ */
const PORCIONES = {
  ceviche:  { label: 'Ceviche / Tiradito',   g: 180 },
  frito:    { label: 'Frito / Apanado',       g: 220 },
  parrilla: { label: 'Parrilla / Grill',      g: 300 },
  sopa:     { label: 'Sopa / Arroz marino',   g: 250 },
};
let calcType = 'ceviche';

function openCalc() {
  document.getElementById('calc-overlay').classList.add('open');
  renderCalcResult();
}
function closeCalc() {
  document.getElementById('calc-overlay').classList.remove('open');
}
function renderCalcResult() {
  const guests = Math.max(1, parseInt(document.getElementById('calc-guests').value) || 1);
  const p = PORCIONES[calcType];
  const totalG = guests * p.g;
  const label  = totalG >= 1000 ? (totalG / 1000).toFixed(2) + ' kg' : totalG + ' g';
  document.getElementById('calc-result').innerHTML = `
    <div class="calc-row"><span class="calc-rl">Preparación</span><span class="calc-rv">${p.label}</span></div>
    <div class="calc-row"><span class="calc-rl">Personas</span><span class="calc-rv">${guests}</span></div>
    <div class="calc-row"><span class="calc-rl">Porción recomendada</span><span class="calc-rv">${p.g} g c/u</span></div>
    <div class="calc-row"><span class="calc-rl">Total a comprar</span><span class="calc-rv">${label}</span></div>
    <div class="calc-row" style="font-size:0.62rem"><span class="calc-rl" style="color:rgba(122,149,170,0.65)">Para entrada, reducí un 30%</span><span></span></div>
  `;
}

document.querySelectorAll('.calc-type').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.calc-type').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    calcType = btn.dataset.type;
    renderCalcResult();
  });
});
document.getElementById('calc-guests').addEventListener('input', renderCalcResult);

/* ════════════════════════════════════════ */
async function submitNotify() {
  const p = currentProduct;
  if (!p) return;
  const phone = (document.getElementById('notify-phone')?.value || '').trim();
  if (!phone) { showToast('Ingresá tu número de WhatsApp'); return; }
  try {
    await db_cat.collection('notifications').add({
      productId:   p.id || p.name,
      productName: p.name,
      phone,
      createdAt:   new Date(),
    });
    const nb = document.getElementById('notify-box');
    if (nb) nb.innerHTML = '<p style="color:#4ade80;font-size:0.78rem;text-align:center;padding:0.3rem 0">✅ ¡Listo! Te avisamos cuando vuelva a estar disponible.</p>';
  } catch(e) {
    showToast('Error al guardar. Intentá de nuevo.');
  }
}

/* ════════════════════════════════════════ */
let deferredInstall = null;
const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;
const isInstalled = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;

window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  deferredInstall = e;
  /* Auto-banner solo si nunca se instaló y no fue descartado */
  if (!isInstalled && !localStorage.getItem('chusfish_pwa_dismissed')) {
    setTimeout(() => document.getElementById('pwa-banner')?.classList.add('show'), 5000);
  }
});

async function triggerInstall() {
  /* Ya instalada */
  if (isInstalled) { showToast('¡La app ya está instalada! 📲'); return; }
  /* Android/Chrome con prompt disponible */
  if (deferredInstall) {
    document.getElementById('pwa-banner')?.classList.remove('show');
    deferredInstall.prompt();
    const { outcome } = await deferredInstall.userChoice;
    if (outcome === 'accepted') {
      deferredInstall = null;
      localStorage.setItem('chusfish_pwa_dismissed', '1');
    }
    return;
  }
  /* iOS → mostrar instrucciones manuales */
  if (isIOS) {
    document.getElementById('ios-modal-overlay')?.classList.add('show');
    return;
  }
  /* Otros (prompt aún no listo o ya instalado) */
  showToast('Abrí este sitio en Chrome/Safari para instalar la app');
}

/* X del banner */
document.getElementById('pwa-no-btn')?.addEventListener('click', () => {
  document.getElementById('pwa-banner')?.classList.remove('show');
  localStorage.setItem('chusfish_pwa_dismissed', '1');
});

/* Cerrar modal iOS tocando fuera */
document.getElementById('ios-modal-overlay')?.addEventListener('click', function(e) {
  if (e.target === this) this.classList.remove('show');
});

window.addEventListener('appinstalled', () => {
  document.getElementById('pwa-banner')?.classList.remove('show');
  deferredInstall = null;
  localStorage.setItem('chusfish_pwa_dismissed', '1');
});
