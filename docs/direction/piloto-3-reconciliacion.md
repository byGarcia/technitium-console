# Piloto 3 — reconciliación

`15-piloto-settings.dc.html`, devuelto el **2026-09-02**. 149 301 bytes, 1 455
líneas, etag **`1788358640023496`** — comprobado antes de leer nada y sin cambios
al terminar. Esta nota vale para esa versión y caduca en cuanto el fichero se
toque.

Recorrido contra `piloto-3-contrato-general.md` y la barra de ocho puntos escrita
**antes** de enviarlo. Todo hallazgo sobre el producto, verificado contra el
fuente.

## Veredicto

**Pasa.** Y el censo no es de palabra: se renderizó el piloto y se contaron los
nombres uno a uno.

No hay que devolverle nada. **El único defecto que sale de este recorrido es del
contrato, no del dibujo** — y lo encontró el propio piloto.

## El censo, nombre a nombre

Hecho sobre la maqueta `2a` (1440) y repetido sobre `3a` (390), **que dan
exactamente lo mismo**: a 390 no se pierde nada.

| | Contrato | Dibujado | |
|---|---|---|---|
| Controles | 39 | **39** | 30 con rótulo de fila + **9 casillas y radios**, que por regla propia no llevan rótulo a la izquierda porque el control **es** su rótulo |
| Ayudas | 41 | **41** | las 39 de control y las 2 de las listas |
| Sufijos | 19 | **19** | literales y completos, con su rango y su valor por defecto |
| Avisos | 12 | **12** | 8 `Note!` y 4 `Warning!`, cada uno en su sección |
| Secciones | 10 | **10** | en el orden del fuente, sin tocar |
| Listas | 2 | **2** | con sus 15 celdas y la **etiqueta indexada** del patrón del piloto 2 (`IPv4 Prefix 1`…) |
| Subpestañas | 9 | **9** | en orden de fuente |
| Barra | 4 botones | **4** | `Save Settings` · `Flush Cache` · `Backup Settings` · `Restore Settings` |

Los recuentos que el propio piloto pone en cada rótulo de sección **suman 39**, así
que el dibujo se comprueba a sí mismo: 4+9+2+3+2+1+1+5+3+9.

## Los ocho puntos

| | Punto | Estado |
|---|---|---|
| 1 | Los 39 controles | **Cumplido**, contados uno a uno |
| 2 | Las 41 ayudas con su control | **Cumplido, y es lo mejor de la entrega.** Tercera columna a 360 px, **siempre visible, nunca plegada ni resumida**; a 1180 baja a segunda línea, a 560 bajo su control. Y no lo afirma: dibuja **tres variantes** —la elegida, la de hoy y la plegada— y **descarta la plegada con su anuncio dibujado**, para poder descartarla con justicia |
| 3 | Los 19 sufijos | **Cumplido**, literales, y con regla propia: nunca bajan a la columna de ayuda |
| 4 | Los 12 avisos, `Note!` contra `Warning!` | **Cumplido, y con una idea que no estaba en el contrato**: el `Warning!` va **antes** de los controles y el `Note!` **después**, «uno puede cambiar tu decisión, el otro la explica». Más relleno contra contorno, y a ancho de sección porque **un aviso no es de ningún control** |
| 5 | Los dos grises | **Cumplido.** Maestro = local y reversible (filete ámbar, opacidad, una pastilla que **nombra** el interruptor); permiso = global e irreversible (un aviso arriba, candado, **valores legibles y ayuda sin atenuar**, porque leer no requiere permiso). Si coinciden, gana el permiso. **«Ámbar = puedes; candado = no puedes»** |
| 6 | La barra y sus composiciones | **Cumplido.** Cuatro botones siempre presentes; las ocho combinaciones dan **una barra con hasta cuatro apagados**, no ocho barras, aplicando la regla heredada *deshabilitado, nunca escondido*. `5a` las superpone anotando las tres puertas, y **cada candado dice qué permiso falta** |
| 7 | Subpestañas y validación | **Cumplido.** Las nueve salen del lateral y viven sobre el título a todos los anchos; el aviso de validación **nace en la barra**, dice subpestaña y campo, y al seguirlo el error se pinta junto a su campo — **nunca en los dos sitios** |
| 8 | 390 px | **Cumplido**, y es lo que más tranquiliza: `3a` da **la misma lista** que `2a` en las ocho filas de la tabla de arriba |

## El defecto, que es del contrato

El piloto declaró abierto «cuatro rótulos de grupo» porque **el contrato decía
seis `GroupRow` y sólo nombraba dos**. Verificado contra el fuente: **tenía
razón**. Los seis son

`Zone Defaults` · `Software Update` · `IPv6 Support` · `UDP Socket Pool` ·
`DNSSEC` · `EDNS Client Subnet (ECS)`

y `evidencia/general-dom.json` sólo llevaba dos, porque el extractor del DOM
emitía el nombre del control y, dentro de un grupo, ganaba el del control —
aunque `GroupRow` pinta su rótulo con **la misma clase** que el extractor ya
miraba. **Una cifra sin su inventario**: el mismo error que ya se había corregido
horas antes con los sufijos, en otro sitio.

**El piloto hizo exactamente lo correcto: no inventarse los cuatro que no podía
nombrar**, dibujar los dos nombrados y declararlo abierto.

Arreglado, y de forma que no vuelva: la evidencia los lleva los seis; el snippet
de `verify-evidencia.mjs` aprendió a capturarlos; hay **tres pruebas de
regresión** que fijan los seis, los dos de lista y la separación de las tres
poblaciones (30 en verde); y `pane-contract-doc.mjs` tiene un **guardián que
revienta si la evidencia no nombra toda etiqueta estructural que el AST ve**,
probado en negativo.

### Y al nombrarlos aparece una decisión que el contrato escondía

**Cinco de los seis repiten el título de su sección** —`Software Update` bajo la
sección `Software Update`, `DNSSEC` bajo `DNSSEC`, `UDP Socket Pool` bajo
`UDP Socket Pool`, `IPv6 Support` bajo `IPv6`, `EDNS Client Subnet (ECS)` bajo
`EDNS Client Subnet`—. Hoy la pantalla pinta los dos, uno debajo del otro. **Sólo
`Zone Defaults` dice algo que su sección no dice.**

Es una redundancia real de la consola de hoy, y **el piloto no pudo verla porque
el contrato no se la enseñó**. No es motivo de devolución: es material para la
fase 1.4.

## Una decisión que el piloto dibujó y que NO se adopta

El piloto pinta el `Warning!` **relleno en `--dan`**. Se adopta el relleno y **no
el tono**: `Warning!` se queda en `--warn`.

No es reabrir dirección, es delimitar lo que se cerró. Esta misma reconciliación
registró en su día «relleno contra contorno» **sin tono**, y `DESIGN.md` tampoco
lo recogió: lo que la fase 1 consolidó es **la posición y el tratamiento**
—`Warning!` antes y relleno, `Note!` después y con contorno—, no una reasignación
semántica.

Y el precio de reasignarlo no compra nada. **`--dan` está reservado al error, a la
validación y a lo destructivo**; un `Warning!` en rojo lo haría significar dos
cosas a la vez, justo en una consola donde `tones.module.css` distingue
explícitamente «algo pide atención pero funciona» de «está roto o apagado». Un
aviso de upstream como «Enable IPv6 support only if this DNS Server has native
IPv6 Internet access» es lo primero, no lo segundo.

La diferencia entre los dos avisos ya la cargan **tres** cosas —dónde va, si lleva
relleno y qué icono—, que es más de lo que la barra de aceptación pedía.

## Una frase suya que conviene precisar

Dice que las nueve subpestañas «hoy sólo existen ahí por debajo de 1180 px». En
el fuente, hoy viven en el lateral (`app/Shell.tsx:220`, visibles sólo con su
sección activa y sin desplegable). Lo que sí es cierto, y es el buen argumento:
**el raíl de 60 px del piloto 1 esconde las etiquetas por debajo de 1180**, así
que ahí las nueve se quedarían sin sitio. Sacarlas del lateral **arregla algo que
el piloto 1 rompía** — mérito suyo, mal explicado.

## Lo que declara abierto, y que vale

Seis cosas, dichas por él. Dos merecen quedar escritas:

- **La columna de ayuda de 360 px está medida contra los 41 párrafos de
  `General` y no contra los de DHCP**, que hereda el mismo kit. Si allí hay
  párrafos mucho más largos, ese número es lo primero que hay que volver a mirar.
- **Los ocho paneles restantes** heredan las reglas, pero los interruptores
  maestros y las listas editables **sólo existen en `General`**; si otro panel
  tiene condicionales de render de verdad —`General` no tiene ni uno—, aparecer y
  desaparecer es un hueco que este piloto no cubre.

## Nota de método

El error de consola que aparece al renderizarlo es un `favicon.ico` 404 del
previsualizador, no del piloto.

La rama nueva del verificador —la que captura los rótulos de grupo— **no se ha
probado contra la consola viva**, porque hacía falta abrir sesión otra vez. Los
seis nombres salen del AST, que es la fuente autorizada y tiene pruebas; queda
pendiente pasar el verificador entero cuando haya sesión.

## Con esto se cierra la fase 1.3

Los tres pilotos están cerrados. **Ahora sí toca la 1.4**: escribir la dirección
en `tokens.css` y en un `DESIGN.md` corto — con los tres delante, que es la razón
por la que no se escribió con uno.
