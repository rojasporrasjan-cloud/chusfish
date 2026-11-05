/* meta-capi.js — Conversions API de Meta (lado servidor)
 *
 * ¿POR QUÉ ESTO VIVE EN EL SERVIDOR Y NO EN catalogo.html?
 * El Access Token del CAPI da acceso total al Pixel. Si lo ponemos en el
 * HTML cualquiera con "ver código fuente" lo ve y puede falsificar eventos.
 * Acá vive en una variable de entorno de Netlify y nunca sale al navegador.
 *
 * ¿QUÉ HACE?
 * El browser ya dispara el Pixel clásico (lado cliente). Este endpoint
 * recibe los mismos eventos y los reenvía a Meta desde el servidor.
 * Meta llama a esto "deduplicación": si llegan los dos (browser + servidor),
 * Meta los cuenta UNA sola vez gracias al event_id que mandamos igual en ambos.
 *
 * CONFIGURACIÓN EN NETLIFY:
 *   Site settings ▸ Environment variables ▸ Agregar:
 *     META_CAPI_TOKEN  = el token que empieza con EAA... (de Events Manager)
 *
 * PIXEL ID: 934181449682569 (Pixel Chuss Fish)
 * API version: v21.0 (vigente)
 */

const PIXEL_ID  = '934181449682569';
const API_VER   = 'v21.0';
const CAPI_URL  = `https://graph.facebook.com/${API_VER}/${PIXEL_ID}/events`;

/* Eventos que aceptamos del browser. Lista blanca explícita: si alguien
   intenta mandar un evento inventado, simplemente no lo pasamos. */
const EVENTOS_VALIDOS = new Set([
  'PageView', 'ViewContent', 'AddToCart', 'InitiateCheckout',
  'Purchase', 'Search', 'Lead', 'CompleteRegistration'
]);

const json = (code, obj) => ({
  statusCode: code,
  headers: {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': 'https://chusfish.com',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  },
  body: JSON.stringify(obj),
});

exports.handler = async (evento) => {
  /* Preflight CORS */
  if (evento.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: json(204, {}).headers, body: '' };
  }

  if (evento.httpMethod !== 'POST') return json(405, { error: 'Solo POST' });

  const token = process.env.META_CAPI_TOKEN;
  if (!token) {
    console.error('[CAPI] Falta META_CAPI_TOKEN en las variables de entorno.');
    return json(503, {
      error: 'CAPI no configurado.',
      detalle: 'Agrega META_CAPI_TOKEN en Netlify › Site settings › Environment variables.'
    });
  }

  let cuerpo;
  try { cuerpo = JSON.parse(evento.body || '{}'); }
  catch (e) { return json(400, { error: 'Cuerpo JSON inválido.' }); }

  const {
    event_name,   // string: 'PageView', 'AddToCart', etc.
    event_id,     // string: UUID que también se mandó en fbq() en el browser
    event_time,   // número: Unix timestamp (segundos)
    event_source_url, // string: URL completa de la página
    custom_data,  // objeto: { value, currency, content_name, content_ids, ... }
    user_data,    // objeto: { client_ip_address, client_user_agent, fbc, fbp }
  } = cuerpo;

  /* Validación mínima */
  if (!event_name || !EVENTOS_VALIDOS.has(event_name)) {
    return json(400, { error: `Evento inválido: ${event_name}` });
  }

  /* Construimos el payload para Meta.
     user_data siempre incluye IP y user-agent del request real del servidor:
     esto es más confiable que lo que manda el browser. */
  const payload = {
    data: [{
      event_name,
      event_time:        event_time || Math.floor(Date.now() / 1000),
      event_id:          event_id   || `cf_${Date.now()}`,
      event_source_url:  event_source_url || 'https://chusfish.com/catalogo',
      action_source:     'website',
      user_data: {
        /* IP y user-agent del visitante real, tomados del request al servidor.
           Son más confiables porque no pasan por el browser ni por adblockers. */
        client_ip_address: evento.headers['x-forwarded-for']?.split(',')[0]?.trim()
                           || evento.headers['client-ip']
                           || '',
        client_user_agent: evento.headers['user-agent'] || '',
        /* fbc y fbp (cookies de Meta) si el browser los mandó */
        ...(user_data?.fbc && { fbc: user_data.fbc }),
        ...(user_data?.fbp && { fbp: user_data.fbp }),
      },
      /* custom_data: valor, moneda, nombre del producto, IDs, etc. */
      ...(custom_data && Object.keys(custom_data).length > 0 && { custom_data }),
    }],
    /* test_event_code: 'TEST12345',  ← descomenta solo para probar en Events Manager */
  };

  let res;
  try {
    res = await fetch(`${CAPI_URL}?access_token=${token}`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    });
  } catch (e) {
    console.error('[CAPI] Error de red al llamar a Meta:', e.message);
    return json(502, { error: 'No se pudo conectar con Meta.', detalle: String(e.message) });
  }

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    const msg = data?.error?.message || `HTTP ${res.status}`;
    console.error('[CAPI] Meta rechazó el evento:', msg);
    return json(502, { error: 'Meta rechazó el evento.', detalle: msg });
  }

  /* events_received: cuántos eventos Meta confirmó haber recibido */
  return json(200, {
    ok: true,
    events_received: data?.events_received ?? 1,
  });
};
