# instalar_capi.ps1
# Inserta el helper sendCAPI() en catalogo.html y conecta los eventos
# InitiateCheckout y Purchase que quedaron sin CAPI.

$root    = Split-Path -Parent $PSScriptRoot
$catFile = Join-Path $root "catalogo.html"

Write-Host "Leyendo $catFile ..."
$content = [System.IO.File]::ReadAllText($catFile, [System.Text.Encoding]::UTF8)

# ── 1. Bloque CAPI despues de "End Meta Pixel" ──────────────────────────────
$marker = "  <!-- End Meta Pixel -->"

$capiScript = @"

  <!-- CAPI (Conversions API de Meta) — refuerzo servidor del Pixel del browser.
       Cada evento se manda en paralelo: browser (fbq) + servidor (sendCAPI).
       Meta los deduplica por event_id y cuenta solo uno en sus reportes.
       Token guardado en Netlify > Site settings > Environment variables: META_CAPI_TOKEN -->
  <script>
  (function() {
    function getCookie(name) {
      var m = document.cookie.match('(?:^|;)\\s*' + name + '=([^;]*)');
      return m ? decodeURIComponent(m[1]) : undefined;
    }
    function uuid() {
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0;
        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
      });
    }
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
        keepalive: true
      }).catch(function() {});
      return eid;
    };
    window.sendCAPI('PageView');
  })();
  </script>
"@

if ($content.Contains($marker)) {
    $content = $content.Replace($marker, $marker + $capiScript)
    Write-Host "OK: bloque CAPI insertado despues de End Meta Pixel"
} else {
    Write-Host "AVISO: marcador 'End Meta Pixel' no encontrado. Busca manualmente."
}

# ── 2. InitiateCheckout ─────────────────────────────────────────────────────
$oldIC = "    fbq('track','InitiateCheckout',{ num_items: cart.length, value: total, currency:'CRC' });"
$newIC = "    const _eid_ic = (window.sendCAPI || function(){return '';})('InitiateCheckout',{ num_items: cart.length, value: total, currency:'CRC' });
    fbq('track','InitiateCheckout',{ num_items: cart.length, value: total, currency:'CRC', eventID: _eid_ic });"

if ($content.Contains($oldIC)) {
    $content = $content.Replace($oldIC, $newIC)
    Write-Host "OK: InitiateCheckout conectado al CAPI"
} else {
    Write-Host "AVISO: texto de InitiateCheckout no encontrado exacto — puede que ya este actualizado o tenga formato distinto."
}

# ── 3. Purchase ─────────────────────────────────────────────────────────────
$oldPur = "      fbq('track', 'Purchase', { value: orderTotal, currency: 'CRC', num_items: itemsForOrder.length });"
$newPur = "      const _eid_pur = (window.sendCAPI || function(){return '';})('Purchase',{ value: orderTotal, currency: 'CRC', num_items: itemsForOrder.length });
      fbq('track', 'Purchase', { value: orderTotal, currency: 'CRC', num_items: itemsForOrder.length, eventID: _eid_pur });"

if ($content.Contains($oldPur)) {
    $content = $content.Replace($oldPur, $newPur)
    Write-Host "OK: Purchase conectado al CAPI"
} else {
    Write-Host "AVISO: texto de Purchase no encontrado exacto — puede que ya este actualizado."
}

# ── Verificacion final ───────────────────────────────────────────────────────
$checks = @("sendCAPI", "InitiateCheckout", "Purchase", "meta-capi", "_eid_ic", "_eid_pur")
Write-Host "`nVerificacion:"
foreach ($check in $checks) {
    $found = $content.Contains($check)
    Write-Host "  $check : $( if ($found) { 'ENCONTRADO' } else { 'NO ENCONTRADO' } )"
}

# ── Guardar ─────────────────────────────────────────────────────────────────
[System.IO.File]::WriteAllText($catFile, $content, [System.Text.Encoding]::UTF8)
Write-Host "`nArchivo guardado: $catFile"
Write-Host "`nProximo paso: Agregar META_CAPI_TOKEN en Netlify > Site settings > Environment variables"
