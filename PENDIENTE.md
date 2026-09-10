# Lo que queda pendiente

Última revisión: **9 de septiembre de 2026**. Todo lo de abajo está
**fuera del código** — publicar de nuevo no lo arregla.

---

## 1. La promoción de Jesús no está saliendo

`chusfish/config.promoCoupon` apunta al código **`CUP0N2`**, y ese cupón
**no existe** en la base. Se borró o se le cambió el nombre después de
configurarlo.

**Consecuencia:** ni el aviso de promoción ni el segmento de descuentos del
catálogo aparecen. Jesús cree que la tiene corriendo.

**No rompe nada** — se comprobó: el catálogo carga sus 87 productos, el
checkout abre, cero errores. Simplemente no se muestra.

**Cómo se arregla** (lo hace Jesús, en el panel ▸ Cupones — ahí sale un
aviso amarillo diciéndoselo):

- crear el cupón con el código `CUP0N2`, **o**
- marcar como "promoción" el cupón que sí quiere usar.

---

## 2. El convertidor de fotos está apagado

Montado y probado, pero le falta la llave. En **Netlify ▸ Site settings ▸
Environment variables**:

```
GEMINI_API_KEY = la llave de Google AI Studio    (obligatoria, es gratis sacarla)
ESTILO_CORREOS = correo1,correo2                 (opcional; por defecto solo Jan)
```

Sin la llave el botón contesta *"Falta la llave de Gemini"* — no falla en
silencio. Detalle completo en `herramientas/LEEME.md`.

Costo esperado: **~$6 por los 87 productos**, una sola vez. Cada "Probar
otra vez" cuesta otro tanto.

---

## 3. Restos de pruebas en producción

En la colección `users` quedaron filas de diagnóstico de sesiones viejas,
con correos que empiezan por:

- `zz-diag-…@chusfish.com`
- `zz-reglas-…@chusfish.com`

Las cuentas de Auth ya se borraron; faltan estas filas. No molestan a
nadie, pero ensucian la lista de clientes y las cuentas del dashboard.

---

## Lo que NO está pendiente, aunque lo parezca

**El cupón `BIENVENIDO` con `perUserLimit: 1` está BIEN así.** Un cupón de
bienvenida se usa una vez, y además tiene `firstOrderOnly: true`. El límite
que había que quitar era el del cupón de **promoción**, que es otro.

*(Se anota porque durante un tiempo se estuvo pidiendo lo contrario.)*
