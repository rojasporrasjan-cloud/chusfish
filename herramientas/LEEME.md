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

---

# Las pruebas

## Correrlas TODAS

```
npm run emu     # en otra terminal, y dejarlo
npm run dev     # en otra terminal, y dejarlo
npm run probar  # las once, cada una con semilla nueva
```

Siembra antes de cada prueba y sale con código 1 si alguna falla, así que
sirve tal cual antes de subir. Tarda unos 10 minutos.

**Ojo en un clon nuevo:** `package.json` está en `.gitignore` (esto es un
sitio estático; el npm es solo herramienta local), así que los `npm run`
no existen recién clonado. Los scripts sí están en el repo y se corren
directo:

```
node probar-todo.js          # = npm run probar
node seed-emulador.js        # = npm run seed
node dev-server.js           # = npm run dev
```

**Por qué siembra entre cada una:** varias se pisan. Una deja al cliente
con otro saldo, otra escribe puntos a propósito, y `npm run seed` **no
limpia la colección `coupons`** — las reservas de una corrida anterior
hacen fallar a la siguiente con un falso positivo. Si corrés una a mano,
sembrá antes.

**El sembrado se cae solo cada tanto** (una de cada quince, más o menos) con
`0xC0000409` / salida `-1073740791`: un fallo **nativo** de gRPC en Windows.
El proceso muere a media faena y no hay excepción de JavaScript que atrapar.
No es la base ni el código. `npm run probar` lo reintenta hasta tres veces,
así que no tumba la corrida; si lo ves corriendo `npm run seed` a mano,
volvé a correrlo y ya.

| Prueba | Qué vigila |
|---|---|
| `probar-reglas.js` | Las reglas de Firestore hacen lo que dicen |
| `probar-alta-admin.js` | Entrar con Google da el panel solo a quien debe |
| `auditar-puntos-y-descuentos.js` | La aritmética de puntos y descuentos |
| `probar-cupon-un-solo-uso.js` | El cupón no se puede usar dos veces |
| `probar-cupon-por-producto.js` | El descuento se calcula sobre su línea |
| `probar-promo-de-productos.js` | El aviso de promoción y el cupón reutilizable |
| `probar-form-cupones.js` | El formulario de cupones del panel no engaña |
| `probar-canjes-whatsapp.js` | La factura desglosa y el canje trae mensaje |
| `probar-editar-pedido.js` | Editar pedido y factura, con los puntos ajustandose |
| `probar-dashboard.js` | Las graficas dicen la verdad y se pueden leer sin raton |
| `probar-avisos-pedido.js` | Cada paso del pedido avisa y el hero no miente |
| `probar-devolucion-de-canjes.js` | Se pueden devolver canjes ya resueltos |
| `probar-cancelar-pedido.js` | Cancelar un pedido lo deshace TODO |
| `probar-datos-en-perfil.js` | El pedido deja teléfono y dirección guardados |
| `probar-formulario-pedido.js` | El pedido se llena sin scrollear media hora |
| `probar-carrito-atras.js` | El carrito no se duplica y el gesto de atras no saca del sitio |
| `revisar-sintaxis.js` | ¿Compila el JS de las paginas? (2 segundos) |
| `probar-guia.js` | La guía del perfil, en sus seis estados |
| `probar-textos.js` | Lo que se promete es lo que de verdad pasa |
| `probar-recorrido-completo.js` | Una persona de cero a canjear, con los números cuadrando |

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

## probar-cancelar-pedido.js — que cancelar lo deshaga TODO

```
npm run seed && node herramientas/probar-cancelar-pedido.js
```

Cancelar tiene que revertir cuatro cosas, no una: los puntos, los
acumulados (el nivel), `ordersCount` y `totalSpent`, más liberar el cupón.

El fallo que motivó esta prueba: se devolvían los puntos y se liberaba el
cupón, pero `ordersCount` quedaba en 1. Con eso el cliente dejaba de ser
"primera compra", así que **el cupón que la cancelación acababa de
liberar no se podía usar**. Por eso la prueba no se conforma con ver el
cupón libre: lo aplica de verdad en un pedido nuevo.

## probar-datos-en-perfil.js — que el pedido deje los datos guardados

```
npm run seed && node herramientas/probar-datos-en-perfil.js
```

Vigila el fallo que **ya mordió tres veces** en este proyecto: lanzar una
escritura a Firestore y acto seguido hacer `location.href = waLink`. Al
abrir WhatsApp el celular congela la página y la escritura, que iba a
medias, se muere. Pasó con el pedido, con la reserva del cupón, y con los
datos del perfil.

Es silencioso: el pedido llega bien, nadie se queja, y la persona
simplemente vuelve a escribir su dirección en cada pedido.

**Ojo con lo que esta prueba puede y no puede.** La parte de punta a punta
NO reproduce el congelamiento — se comprobó quitando el `await`, y seguía
pasando, porque en Chromium con la ruta de `wa.me` interceptada la página
no se congela. Quien caza el fallo es la **parte estructural**: lee
`catalogo.html` y exige que el pedido, el cupón y el perfil se esperen
antes de la navegación. Esa sí falla al quitar el arreglo.

## probar-promo-de-productos.js — el aviso de promoción

```
npm run seed && node herramientas/probar-promo-de-productos.js
```

Nació de tres cosas que reportó Jesús probando su primera promoción de
productos, y una cuarta que notó sin poder nombrarla:

1. **"No le da acceso al cliente de ver primero cuáles productos son."**
   El aviso solo mostraba foto y nombre si el cupón era de UN producto.
   Con varios decía *"en productos seleccionados"* y nada más, así que
   nadie podía decidir si le servía.
2. **El descuento en la factura.** Lo grave no era la demora: la factura
   calculaba el porcentaje sobre el **pedido entero** aunque el cupón
   fuera de un producto. Un 20% sobre un camarón de ₡17.000 dentro de un
   pedido de ₡54.000 descontaba **₡10.800 en vez de ₡3.400**. El sitio ya
   lo hacía bien; era la factura la que regalaba plata.
3. **"No le aplica el descuento nuevamente."** El formulario creaba los
   cupones con *1 uso por cliente*, y una promoción se arma justo para lo
   contrario.
4. **"En ocasiones sale y otras no."** Salía una vez por persona y nunca
   más. Ahora vuelve **una vez al día**.

La prueba recorre las seis: que el aviso liste los productos con foto y
precio, que el botón filtre el catálogo a esos productos y se pueda
volver, que el descuento salga de su línea, que el mismo cliente lo use
tres veces seguidas, que el aviso vuelva al día siguiente, y que la
factura de Jesús calcule sobre la línea y no sobre el pedido.

**Ojo con el `load`:** el aviso se dispara 1,2 s *después* del load. Con
una pausa fija, la comprobación de "no vuelve a salir" pasaba sola aunque
el aviso ni se hubiera ejecutado. Por eso se espera el evento de verdad.

## probar-form-cupones.js — el formulario que toca Jesús

```
npm run seed && node herramientas/probar-form-cupones.js
```

Las otras pruebas de cupones comprobaban la **aritmética**, pero nadie
tocaba el formulario — y ahí estaba la trampa que le costó a Jesús su
primera promoción: *"Usos por cliente"* venía en **1**, así que el cupón
dejaba de aplicar en el segundo pedido del mismo cliente.

Comprueba que encender *"Avisar al entrar al catálogo"* lo pase a 0, que
un valor puesto a mano (2, 3…) **no** se pise, que la nota de abajo lo
diga en castellano, y que abrir un cupón viejo y volver a guardarlo lo
deje sin límite en la base sin perder el mínimo ni la promoción.

**Dónde vive el interruptor:** en `chusfish/config.promoCoupon`, no en el
campo `promo` del cupón. `editCupon()` lo lee de la config; guardar
escribe los dos. Si montás un caso de prueba, poné la config o el
interruptor sale apagado y no probás nada.

## probar-formulario-pedido.js — llenar el pedido sin pelear

```
npm run catalogo && npm run seed && node herramientas/probar-formulario-pedido.js
```

**Corré `npm run catalogo` antes.** Con la semilla hay 3 zonas y el
problema no se ve; con las 18 de producción, sí.

De dónde viene: el formulario medía **2.290px sobre una pantalla de
664px — 3,4 pantallas de scroll**. Las zonas solas eran 847px y las
fechas 244px: entre las dos, el **48%** del formulario. Y el total vivía
arriba del todo, así que para ver cuánto se iba a pagar había que subir.

Ahora zona y fecha son desplegables de 62px y el total vive en una barra
pegada abajo. Quedó en **1,3 pantallas**.

La prueba vigila que no se vuelva a inflar: mide el alto real, que el
total y los puntos se vean sin scrollear, que la lista de zonas **se vea
de verdad** (llegó a abrirse debajo de la barra, invisible), que el
buscador aguante sin tildes, y que la zona y la fecha elegidas lleguen
al pedido guardado.

## probar-textos.js — que no se prometa lo que ya no pasa

```
node herramientas/probar-textos.js
```

No toca la base; solo necesita `npm run dev`.

Nació porque una revisión encontró **cuatro** textos que habían quedado de
versiones viejas. No rompen nada —la página carga igual— pero mienten, y
siempre en el peor momento: justo donde la persona decide.

- Los puntos pasaron de acreditarse **al entregar** a **al confirmar**, y
  cuatro sitios seguían diciendo "al entregarse". Uno es el que lee
  **Jesús** en el panel.
- Los puntos del canje pasaron de salir **al aprobar** a salir **al
  confirmarlo**, pero la ficha del premio prometía lo contrario.
- Un canje rechazado decía "Tus puntos no se descontaron". Sí se
  descontaron, y se devolvieron.

**Al cambiar CUÁNDO pasa algo con la plata, corré esta prueba.** Y si
agregás una promesa nueva, agregala a la lista `VIEJOS` cuando la cambies.

## probar-recorrido-completo.js — una persona, de cero a canjear

```
npm run seed && node herramientas/probar-recorrido-completo.js
```

La prueba más real que hay acá. No comprueba funciones sueltas: recorre lo
que hace un cliente y exige que **el mismo número aparezca igual en todas
partes** — carrito, perfil, La Reserva, panel de Jesús y libro de puntos.
Los fallos caros de este proyecto siempre fueron eso: dos pantallas
contando cosas distintas.

Cubre registro con cupón, el pedido con descuento, la confirmación de
Jesús, el bono de bienvenida, el libro cuadrando con el saldo, el canje y
la guía completándose.

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
