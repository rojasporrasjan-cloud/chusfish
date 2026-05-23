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

## 3. Firestore — publicar reglas de seguridad
- Ir a: https://console.firebase.google.com → Firestore → Reglas
- Pegar y publicar:
  ```
  rules_version = '2';
  service cloud.firestore {
    match /databases/{database}/documents {
      match /chusfish/catalog {
        allow read: if true;
        allow write: if true;
      }
    }
  }
  ```
- **Nota:** con las restricciones del API key del paso 2, esto queda suficientemente
  seguro para un sitio de este tipo.

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
| Contraseña admin | `chusfish2025` |
