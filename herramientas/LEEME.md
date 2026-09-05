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

## auditar-puntos-y-descuentos.js — la aritmética de la plata

```
npm run seed && node herramientas/auditar-puntos-y-descuentos.js
```

Comprueba los NÚMEROS, no que "funcione": que la fórmula de puntos dé lo
mismo en el sitio y en el panel (36 combinaciones de monto × nivel), los
casos borde de los descuentos (porcentaje, tope, mínimo, vencido, valor
negativo), que el descuento se reste antes de dar puntos, que el libro de
cada cliente cuadre con su saldo, y los invariantes: nada negativo, el saldo
nunca supera el histórico, el nivel cuadra con los puntos.

**Correr siempre con semilla recién puesta y a solas.** `probar-reglas.js`
escribe puntos a propósito, así que si va antes deja a Carlos descuadrado y
la auditoría marca un falso positivo.

## probar-cupon-un-solo-uso.js — que el cupón no se use dos veces

```
npm run seed && node herramientas/probar-cupon-un-solo-uso.js
```

Recorre lo que hace un cliente de verdad: se registra, ve su cupón, pide con
él, intenta usarlo otra vez (ofrecido **y escrito a mano**), Jesús confirma, y
vuelve a intentarlo ya sin ser primera compra.

**Corré cada herramienta A SOLAS y con semilla recién puesta.** `npm run seed`
NO limpia la colección `coupons`, así que las reservas de una corrida anterior
hacen fallar a la siguiente con un falso positivo.

## probar-guia.js — la guía de primeros pasos del perfil

```
npm run seed && node herramientas/probar-guia.js
```

La guía no es un texto fijo: cada paso se marca con datos reales y se mueve
sola cuando Jesús confirma un pedido. Esta prueba recorre los seis estados
—recién registrado sin datos, el botón que lleva a *Mis datos*, la
explicación desplegable, la guía moviéndose sola al confirmar el pedido, la
clienta que ya recorrió todo (la guía se encoge a una línea) y el visitante
sin sesión— y comprueba que la puerta explique La Reserva de punta a punta.

## Si de golpe falla todo

Es casi siempre el emulador, no el código. El proceso `java` crece hasta
~4 GB tras muchas corridas y empieza a devolver `DEADLINE_EXCEEDED` a los
60 s; a partir de ahí todo falla en cadena. Se reinicia así:

```powershell
Get-Process java | Stop-Process -Force
Get-CimInstance Win32_Process -Filter "Name='node.exe'" |
  Where-Object { $_.CommandLine -match 'emulators' } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
npm run emu
```

Ojo: el puerto 9099 (auth) puede seguir contestando 200 con el 8080 ya
muerto. **El que hay que sondear es el 8080.**
