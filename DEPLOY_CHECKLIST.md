# Checklist antes de subir a Netlify — Chus's Fish

## 1. Cloudinary — restringir dominios del preset (5 min)
- Ir a: https://cloudinary.com → Settings → Upload → Upload Presets
- Buscar el preset **"chus fish"** → editar
- En el campo **"Allowed origins"** agregar:
  ```
  https://TUNOMBRE.netlify.app
  https://www.chusfish.com   ← si tienen dominio propio
  ```
- Guardar.
- **Por qué:** los valores `dll3mpcmx` + `chus fish` son visibles en el código fuente.
  Sin este paso cualquiera podría subir imágenes a la cuenta.

---

## 2. Firebase — restringir el API key al dominio (5 min)
- Ir a: https://console.cloud.google.com
  → APIs & Services → Credentials → clic en el API key de Chus's Fish
- En **"Application restrictions"** elegir **HTTP referrers**
- Agregar:
  ```
  *.netlify.app/*
  www.chusfish.com/*    ← si tienen dominio propio
  localhost/*           ← para seguir trabajando local
  ```
- Guardar.
- **Por qué:** el Firebase config está expuesto en catalogo.html y admin.html.
  Restringir el key evita que alguien lo use desde otro origen.

---

## 3. Firestore — publicar reglas de seguridad ⚠️ REHECHO (ago-2026)

> Las reglas que había aquí antes (`allow write: if true`) dejaban a **cualquiera
> reescribir el catálogo completo** desde la consola del navegador. Restringir el
> API key por dominio (paso 2) **no** protege esto: el key se lee del propio sitio.
> Se reemplazan por [`firestore.rules`](firestore.rules), que ya contempla usuarios,
> cupones y puntos.

**El orden importa. Si se invierte, el panel de admin queda sin poder escribir.**

### 3.1 — Primero: crear el documento de admin
1. Firebase Console → **Authentication → Users**
2. Copiar el **User UID** de `chussfish2022@gmail.com`
3. Firestore Database → **Iniciar colección** → ID de colección: `admins`
4. ID del documento: **pegar el UID** · agregar un campo cualquiera, ej. `name` = `Jesus`
5. Guardar

### 3.2 — Después: publicar las reglas
- Firestore Database → **Reglas** → pegar el contenido de `firestore.rules` → **Publicar**
- O por CLI (ya están `firebase.json` y `.firebaserc`):
  ```
  npx firebase-tools deploy --only firestore:rules
  ```

### 3.3 — Verificar (2 min)
- [ ] El catálogo público sigue cargando productos
- [ ] El admin logueado puede editar y guardar un producto
- [ ] En una ventana de incógnito, la consola del navegador con
      `firebase.firestore().collection('chusfish').doc('catalog').set({})`
      devuelve **permission-denied**

### 3.4 — Pendiente que queda abierto a propósito
`firestore.rules` conserva un bloque marcado **LEGACY** que deja leer `orders`
públicamente, porque `pedido.html` busca pedidos por teléfono. Eso expone
nombre, teléfono y dirección de los clientes.

**Se borra en la Fase 1**, cuando `mi-cuenta.html` reemplace a `pedido.html`.
🚫 **No activar cuentas de clientes antes de borrar ese bloque.**

---

## 4. Renombrar admin.html (30 seg)
- Renombrar el archivo `admin.html` a algo menos obvio, ej: `gestion-cf2025.html`
- No rompe nada — ningún otro archivo lo enlaza.
- Guardar la nueva URL para uso interno.

---

## 5. Actualizar URL del Open Graph (1 min)
- En `index.html` y `catalogo.html` buscar el comentario `⚠️ Reemplazar la URL`
- Cambiar `https://chusfish.netlify.app` por tu URL real de Netlify (o dominio propio)
- Esto hace que al compartir el link en WhatsApp salga el logo y la descripción

---

## 6. Subir a Netlify
- Arrastrar la carpeta completa al dashboard de Netlify, o conectar el repositorio.
- Archivos que deben estar en la carpeta:
  ```
  index.html
  catalogo.html
  admin.html  (o el nombre nuevo)
  logo.png
  manifest.json
  sw.js
  _headers        ← caché + seguridad
  netlify.toml    ← configuración de build
  assets/         (si existe — hero.mp4, imágenes locales)
  ```
- Las imágenes de productos NO van en Netlify — están en Cloudinary.
- Los datos de productos NO van en Netlify — están en Firestore.

---

## 6. Verificar después de subir
- [ ] Catálogo carga productos desde Firestore
- [ ] Imágenes de productos se ven (Cloudinary CDN)
- [ ] Botón de WhatsApp funciona
- [ ] Admin: login funciona
- [ ] Admin: se puede agregar/editar un producto
- [ ] Admin: subida de imagen llega a Cloudinary
- [ ] Admin: cambios se reflejan en el catálogo

---

## Datos de configuración actuales
| Cosa | Valor |
|------|-------|
| Firebase Project | `chus-fish` |
| Firestore colección | `chusfish/catalog` |
| Cloudinary cloud | `dll3mpcmx` |
| Cloudinary preset | `chus fish` (debe ser Unsigned) |
| WhatsApp | `50660017370` |
| Contraseña admin | ⚠️ NO se guarda aquí — este archivo está en git. Ver 7.4 |

---

## 7. Seguridad — pendientes conocidos (ago-2026)

### 7.1 Reglas de Firestore
Ver paso 3. El bloque LEGACY de `orders` se borra en la Fase 1.

### 7.2 `admin.html` es público
Nunca se renombró (paso 4). Cualquiera puede abrir `chusfish.com/admin.html`
y ver la pantalla de login. No es crítico —el login es Firebase Auth real—
pero invita a que le prueben contraseñas.

### 7.3 El rol admin vive en `admins/{uid}`
Para dar acceso a otra persona: crear su usuario en Authentication y agregarle
su doc en `admins/`. Para quitarle acceso: borrar el doc. No hay que tocar código.

### 7.4 ⚠️ La contraseña del admin estuvo en este archivo, en git
Este repo tiene el historial completo. La contraseña vieja (`chusfish2025`)
sigue siendo recuperable con `git log -p` aunque ya no aparezca arriba.

**Hay que cambiarla en Firebase Console → Authentication → Users → chussfish2022@gmail.com.**
Borrarla de este archivo NO la borra del historial.

La nueva no se anota acá: va en el gestor de contraseñas de Jesús.
