/* Pasa la foto de un producto al estilo del catalogo: fondo de pizarra
 * oscura, hielo picado, limon, lima y eneldo.
 *
 * ¿POR QUÉ ESTO VIVE EN EL SERVIDOR Y NO EN admin.html?
 * Porque `admin.html` es una página estática: todo lo que tenga dentro lo
 * ve cualquiera con "ver código fuente". Una llave de Gemini ahí es una
 * llave regalada — y la factura llega igual. Acá la llave vive en una
 * variable de entorno de Netlify y nunca sale al navegador.
 *
 * ¿QUIÉN PUEDE LLAMARLA?
 * Solo Jan, no todo admin. Jesús sube el producto con la foto que tenga;
 * Jan la pasa por el molde después. Son dos trabajos distintos y este
 * gasta plata de una API.
 *
 * Se comprueban DOS cosas, y hay que pasar las dos:
 *   · que Firestore acepte el token y exista `admins/{uid}` — así un token
 *     falso o caducado no sirve de nada, y es la misma regla que protege
 *     el panel;
 *   · que el correo esté en la lista.
 *
 * PARA QUE FUNCIONE, en Netlify ▸ Site settings ▸ Environment variables:
 *     GEMINI_API_KEY  = la llave de Google AI Studio (obligatoria)
 *     ESTILO_CORREOS  = quién puede usarlo, separados por coma
 *                       (opcional; por defecto solo Jan)
 */

/* gemini-2.5-flash-image SE APAGA el 2 de octubre de 2026. Este es el
   vigente. El "lite" cuesta la mitad (~$0.034 vs ~$0.067 por imagen) si
   algun dia el gasto importa; para 87 productos la diferencia son $3. */
const MODELO = 'gemini-3.1-flash-image';
const PROYECTO = 'chus-fish';


/* Descrito a partir de las fotos que YA estan en el catalogo: fondo de
   pizarra oscura, hielo picado, limon en rodajas, lima en gajos y eneldo,
   con luz baja. (La primera version salio de assets/langosta_hielo.png,
   que es hielo blanco y plano: ESE no es el estilo de la tienda.)

   Lo que mas pesa de este texto no es el hielo, es la insistencia en no
   tocar el producto. Una foto bonita de un pescado que no es el que se
   entrega trae reclamos. */
const ESTILO = [
  'Restyle this seafood product photo to match a specific catalog look,',
  'WITHOUT changing the product itself.',
  '',
  'KEEP EXACTLY AS-IS: the species, the cut, the colour, the texture, the',
  'thickness, the size and the number of pieces. Do not add, remove,',
  'substitute or idealise any piece of seafood. A customer will receive this',
  'exact item — it must still be recognisable as the same product.',
  '',
  'RESTYLE THE SCENE LIKE THIS:',
  '- Dark slate / dark stone surface as the background, moody and low-key.',
  '- The product rests on a bed of crushed ice, centred, filling most of the frame.',
  '- Garnish around it: a few round lemon slices, one or two lime wedges,',
  '  and sprigs of fresh dill. Keep the garnish to the sides, never covering',
  '  the product.',
  '- Cool, directional light: bright specular highlights on the ice, deep',
  '  shadows in the background. Fresh and premium, not flat or bright.',
  '- Slightly elevated three-quarter angle, close to overhead.',
  '- Square 1:1 composition.',
  '- No text, no logos, no watermarks, no hands, no plates, no cutlery.',
  '',
  'The result must look like it belongs in the same catalog as photos of',
  'fish fillets on crushed ice with lemon, lime and dill on dark slate.'
].join('\n');

/* ── Utilidades ── */
const json = (code, obj) => ({
  statusCode: code,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(obj),
});

/* Quien puede transformar fotos. NO es "cualquier admin": Jesus sube el
   producto con su foto y Jan la pasa por el molde despues. Son dos
   trabajos distintos y el segundo gasta plata de una API.

   Se puede cambiar sin tocar codigo con la variable de entorno
   ESTILO_CORREOS (correos separados por coma) en Netlify. */
const CORREOS_POR_DEFECTO = ['rojasporrasjan@gmail.com'];
function correosPermitidos() {
  const v = String(process.env.ESTILO_CORREOS || '').trim();
  if (!v) return CORREOS_POR_DEFECTO;
  return v.split(',').map(x => x.trim().toLowerCase()).filter(Boolean);
}

/* Lo de dentro del token. Se lee SIN verificar a proposito: no se confia
   en el, solo sirve para saber a quien preguntarle a Firestore. Quien
   verifica de verdad es Firestore, que rechaza el token si es falso o
   esta caducado. */
function datosDelToken(token) {
  try {
    return JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString('utf8'));
  } catch (e) { return null; }
}

/* Dos puertas, y hay que pasar las dos:
     1. Que Firestore acepte el token Y el documento admins/{uid} exista.
        Esto es lo que hace que un token falso no sirva de nada.
     2. Que el correo este en la lista. Esto es lo que deja fuera a
        Jesus, que SI es admin pero no es quien retoca fotos. */
async function puedeTransformar(token) {
  const t = datosDelToken(token);
  if (!t || !(t.user_id || t.sub)) return { ok: false, por: 'token' };
  const uid = t.user_id || t.sub;
  const correo = String(t.email || '').toLowerCase();

  const url = 'https://firestore.googleapis.com/v1/projects/' + PROYECTO +
              '/databases/(default)/documents/admins/' + encodeURIComponent(uid);
  try {
    const r = await fetch(url, { headers: { Authorization: 'Bearer ' + token } });
    if (!r.ok) return { ok: false, por: 'token' };   // token malo o rechazado
    const d = await r.json();
    if (!(d && d.fields)) return { ok: false, por: 'noadmin' };
  } catch (e) {
    return { ok: false, por: 'token' };
  }

  if (correosPermitidos().indexOf(correo) < 0) return { ok: false, por: 'nolista' };
  return { ok: true };
}

/* La foto de origen puede venir como URL de Cloudinary (lo normal) o ya en
   base64 (cuando todavia no se ha subido). */
async function traerImagen(cuerpo) {
  if (cuerpo.imagenBase64) {
    const m = String(cuerpo.imagenBase64).match(/^data:([^;]+);base64,(.+)$/);
    if (m) return { tipo: m[1], datos: m[2] };
    return { tipo: 'image/jpeg', datos: cuerpo.imagenBase64 };
  }
  if (!cuerpo.imagenUrl) return null;
  const r = await fetch(cuerpo.imagenUrl);
  if (!r.ok) return null;
  const buf = Buffer.from(await r.arrayBuffer());
  /* 7 MB de tope: mas que eso no es una foto de catalogo, es un error. */
  if (buf.length > 7 * 1024 * 1024) return null;
  return { tipo: r.headers.get('content-type') || 'image/jpeg',
           datos: buf.toString('base64') };
}

exports.handler = async (evento) => {
  if (evento.httpMethod !== 'POST') return json(405, { error: 'Solo POST' });

  const llave = process.env.GEMINI_API_KEY;
  if (!llave) {
    return json(503, { error: 'Falta la llave de Gemini.',
      detalle: 'Ponela en Netlify ▸ Site settings ▸ Environment variables como GEMINI_API_KEY.' });
  }

  const auth = evento.headers.authorization || evento.headers.Authorization || '';
  const token = auth.replace(/^Bearer\s+/i, '').trim();
  if (!token) return json(401, { error: 'Hay que entrar al panel primero.' });
  const permiso = await puedeTransformar(token);
  if (!permiso.ok) {
    const porque = permiso.por === 'nolista'
      ? 'Esta cuenta no tiene el convertidor de fotos habilitado.'
      : permiso.por === 'noadmin'
        ? 'Solo el administrador puede transformar fotos.'
        : 'La sesión caducó. Volvé a entrar al panel.';
    return json(403, { error: porque });
  }

  let cuerpo;
  try { cuerpo = JSON.parse(evento.body || '{}'); }
  catch (e) { return json(400, { error: 'Cuerpo invalido' }); }

  const img = await traerImagen(cuerpo);
  if (!img) return json(400, { error: 'No se pudo leer la foto de origen.' });

  /* El nombre del producto ayuda al modelo a no confundirse de especie. */
  const nombre = String(cuerpo.nombre || '').slice(0, 120);
  const instruccion = ESTILO + (nombre ? '\n\nThe product is: ' + nombre + '.' : '');

  const url = 'https://generativelanguage.googleapis.com/v1beta/models/' +
              MODELO + ':generateContent';
  let r;
  try {
    r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': llave },
      body: JSON.stringify({
        contents: [{ parts: [
          { text: instruccion },
          { inline_data: { mime_type: img.tipo, data: img.datos } },
        ] }],
      }),
    });
  } catch (e) {
    return json(502, { error: 'No se pudo hablar con Gemini.', detalle: String(e.message || e) });
  }

  const data = await r.json().catch(() => null);
  if (!r.ok) {
    /* El mensaje de Google se pasa tal cual: si es la cuota, o la llave, o
       el modelo, que se vea — adivinar cuesta mas que leerlo. */
    const msg = (data && data.error && data.error.message) || ('HTTP ' + r.status);
    return json(502, { error: 'Gemini rechazo la peticion.', detalle: msg });
  }

  const partes = (((data.candidates || [])[0] || {}).content || {}).parts || [];
  const salida = partes.find(p => p.inline_data || p.inlineData);
  if (!salida) {
    /* A veces contesta con texto en vez de imagen (por ejemplo si cree que
       la foto no se puede editar). Ese texto dice por que. */
    const texto = partes.map(p => p.text).filter(Boolean).join(' ').slice(0, 300);
    return json(502, { error: 'Gemini no devolvio una imagen.',
                       detalle: texto || 'Sin detalle.' });
  }

  const inline = salida.inline_data || salida.inlineData;
  return json(200, {
    ok: true,
    modelo: MODELO,
    imagen: 'data:' + (inline.mime_type || inline.mimeType || 'image/png') +
            ';base64,' + (inline.data),
  });
};
