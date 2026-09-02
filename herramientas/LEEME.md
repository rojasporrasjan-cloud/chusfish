# Herramientas

Scripts sueltos que **no** forman parte del sitio: se corren a mano cuando hace
falta. Estaban tirados en la raíz junto a `auth.js` y `ui.js`, lo que hacía
difícil ver de un vistazo qué archivos usa la web de verdad.

| Archivo | Para qué |
|---|---|
| `remove_bg.ps1`, `remove_bg_v2.ps1` | Quitar el fondo de una foto de producto |
| `compose.ps1`, `compose_v2.ps1` | Montar una foto sobre otra |
| `composite_feathered.ps1` | Lo mismo, con el borde difuminado |
| `optimize-images.js` | Comprimir imágenes del catálogo |
| `fix_icons.js` | Regenerar los iconos de la app |

Los `.ps1` se corren desde PowerShell; los `.js`, con `node archivo.js`.

## probar-reglas.js — comprobar las reglas ANTES de publicarlas

Necesita el emulador y el servidor local corriendo (`npm run emu` y `npm run dev`).

```
node herramientas/probar-reglas.js
```

Corre 22 comprobaciones contra el emulador con tres identidades —sin sesión,
cliente y admin— y verifica que cada una pueda **exactamente** lo que debe:
que cualquiera lea el catálogo pero no lo borre, que un cliente no pueda
regalarse puntos ni espiar otra cuenta, y que el admin sí pueda todo.

Sale con código 1 si alguna falla, así que sirve tal cual antes de publicar.
Esto es lo que faltó en agosto, cuando se publicaron reglas sin probar y
Jesús se quedó un día sin panel.

## probar-alta-admin.js — el alta automática de admin

```
node herramientas/probar-alta-admin.js
```

10 comprobaciones sobre la parte más delicada del sistema: que entrar con
Google **te dé el panel solo si tu correo está en la lista de
`firestore.rules`**, y que no haya forma de colarse.

Incluye los cuatro intentos de abuso que importan: darse de alta con una
cuenta de **contraseña** creada con el correo del dueño (Firebase deja crear
esa cuenta, no comprueba que el correo sea tuyo), crear el documento de otro
UID, y modificar o borrar el de un admin que ya existe.

Deja el emulador como estaba al terminar.
