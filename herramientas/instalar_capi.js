// instalar_capi.js
// Inserta el helper sendCAPI() en catalogo.html y conecta
// InitiateCheckout y Purchase que quedaron sin CAPI.
const fs   = require('fs');
const path = require('path');

const catFile = path.join(__dirname, '..', 'catalogo.html');
let content   = fs.readFileSync(catFile, 'utf8');

// ── 1. Bloque CAPI despues de "End Meta Pixel" ──────────────────────────────
const marker = '  <!-- End Meta Pixel -->';

const capiScript = `
  <!-- CAPI (Conversions API de Meta) — refuerzo servidor del Pixel del browser.
       Cada evento se manda en paralelo: browser (fbq) + servidor (sendCAPI).
       Meta los deduplica por event_id y cuenta solo uno en sus reportes.
       Token: Netlify > Site settings > Environment variables > META_CAPI_TOKEN -->
  <script>
  (function() {
    function getCookie(name) {
      var m = document.cookie.match('(?:^|;)\\\\s*' + name + '=([^;]*)');
      return m ? decodeURIComponent(m[1]) : undefined;
    }
    function uuid() {
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0;
        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
      });
    }
    // Envia el evento al servidor Netlify en paralelo con el Pixel del browser.
    // event_id compartido -> Meta lo cuenta UNA sola vez (deduplicacion).
    window.sendCAPI = function(event_name, custom_data, event_id) {
      var eid = event_id || uuid();
      var payload = {
        event_name: event_name,
        event_id: eid,
        event_time: Math.floor(Date.now() / 1000),
        event_source_url: location.href,
        user_data: { fbc: getCookie('_fbc'), fbp: getCookie('_fbp') }
      };
      if (custom_data && Object.keys(custom_data).length > 0) {
        payload.custom_data = custom_data;
      }
      fetch('/.netlify/functions/meta-capi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        keepalive: true  // funciona incluso si la pagina se cierra justo despues
      }).catch(function() { /* silencioso: el Pixel del browser ya lo mando */ });
      return eid;
    };
    // PageView al cargar la pagina
    window.sendCAPI('PageView');
  })();
  </script>`;

if (content.includes(marker)) {
  content = content.replace(marker, marker + capiScript);
  console.log('OK: bloque CAPI insertado despues de "End Meta Pixel"');
} else {
  console.log('AVISO: marcador "End Meta Pixel" no encontrado.');
}

// ── 2. InitiateCheckout ─────────────────────────────────────────────────────
const oldIC = `    fbq('track','InitiateCheckout',{ num_items: cart.length, value: total, currency:'CRC' });`;
const newIC = `    var _eid_ic = (window.sendCAPI || function(){return '';})('InitiateCheckout',{ num_items: cart.length, value: total, currency:'CRC' });
    fbq('track','InitiateCheckout',{ num_items: cart.length, value: total, currency:'CRC', eventID: _eid_ic });`;

if (content.includes(oldIC)) {
  content = content.replace(oldIC, newIC);
  console.log('OK: InitiateCheckout conectado al CAPI');
} else {
  console.log('AVISO: InitiateCheckout no encontrado con texto exacto (puede ya estar actualizado).');
}

// ── 3. Purchase ─────────────────────────────────────────────────────────────
const oldPur = `      fbq('track', 'Purchase', { value: orderTotal, currency: 'CRC', num_items: itemsForOrder.length });`;
const newPur = `      var _eid_pur = (window.sendCAPI || function(){return '';})('Purchase',{ value: orderTotal, currency: 'CRC', num_items: itemsForOrder.length });
      fbq('track', 'Purchase', { value: orderTotal, currency: 'CRC', num_items: itemsForOrder.length, eventID: _eid_pur });`;

if (content.includes(oldPur)) {
  content = content.replace(oldPur, newPur);
  console.log('OK: Purchase conectado al CAPI');
} else {
  console.log('AVISO: Purchase no encontrado con texto exacto (puede ya estar actualizado).');
}

// ── Verificacion final ───────────────────────────────────────────────────────
const checks = ['sendCAPI', 'InitiateCheckout', 'Purchase', 'meta-capi', '_eid_ic', '_eid_pur'];
console.log('\nVerificacion:');
checks.forEach(c => {
  console.log('  ' + c + ': ' + (content.includes(c) ? 'ENCONTRADO ✓' : 'NO ENCONTRADO ✗'));
});

// ── Guardar ─────────────────────────────────────────────────────────────────
fs.writeFileSync(catFile, content, 'utf8');
console.log('\nArchivo guardado: ' + catFile);
console.log('\nProximo paso: agregar META_CAPI_TOKEN en Netlify > Site settings > Environment variables');
