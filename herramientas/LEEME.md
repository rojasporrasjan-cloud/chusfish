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
