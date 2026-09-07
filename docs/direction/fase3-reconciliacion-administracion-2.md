# Reconciliación del delta — Administración

Retorno aplicado sobre `18-fase3-administracion.dc.html`: 284.752 → **300.301
bytes**. Los cinco puntos del delta, comprobados uno a uno.

| # | Punto | Estado |
|---|---|---|
| 1 | El recuento a 41 | **Cerrado.** «Las 41 columnas — inventario por fichero» |
| 2 | Las 27 ayudas con su literal | **Cerrado** en lo comprobado (ver abajo) |
| 3 | Sustituir las inventadas | **Cerrado.** «Enable to allow Single Sign-On (SSO) with OpenID Connect (OIDC).» donde antes decía «Turns on OpenID Connect sign-in for this server.» |
| 4 | Las cuatro frases de `Force` | **Cerrado.** Literales exactas, **con el «and without inform it» de upstream sin corregir** |
| 5 | Las diez literales | **Cerrado** en lo comprobado |
| — | Adición 1 · `Cluster Options` | **Cerrada, y con más de lo pedido**: cinco campos con su ayuda y su sufijo, `Cluster Domain` deshabilitado y no escondido, `Save` sólo en el primario, y un campo dibujado **en su estado de validación** con la literal «Please enter a value for Config Retry Interval.» |
| — | Adición 2 · `Session Timeout` | **Cerrada.** «seconds (valid range 0-604800; default 1800; set 0 to disable)» |

**Alcance de la comprobación:** los puntos 1, 3, 4 y las dos adiciones se han
verificado **carácter a carácter** en el fichero devuelto. Los puntos 2 y 5 se han
comprobado **por muestra** —SSO entero y los diálogos de `Cluster` que se leyeron—,
no las 37 cadenas una a una: el fichero son 2.390 líneas y leerlo entero para esto
no sale a cuenta. Se dice, no se da por hecho.

Y una cosa que salió mejor de lo pedido y **conviene que se quede**: `Quick Add`
lleva escrito «No tiene ayuda propia: la nombra la del campo de arriba», en vez de
inventarle una para rellenar el hueco.

## Lo que queda, y no es del delta

### Hay castellano dibujado como interfaz del producto

En al menos dos sitios, dentro del ámbito `.pil` —el del producto, no el del
documento—:

1. **Los cuatro bloques de `Force`.** La mitad «con ella» es la literal de upstream,
   correcta. La mitad «sin ella» es **texto inventado y en castellano**: «El relevo
   se pacta con el primario actual, que pasa a secundario.», «La salida se pacta con
   el primario: si no contesta, no se hace.» Y los rótulos `sin ella` / `con ella`.
2. **La barra de sólo lectura de la decisión 6**: «Ninguna acción de Administración
   se apaga por permiso. Los seis verbos de esta tabla se enseñan siempre…»

**El motivo es mío**: el contrato está en castellano, y de él se levantan las
frases. Nunca dije que **toda la interfaz del producto está en inglés**, así que una
frase tomada del contrato entra en el dibujo tal cual. Es la segunda ronda seguida
con el mismo defecto — en la anterior fue la leyenda de los siete colores.

**Y hay un problema debajo del idioma**: la mitad «sin ella» **no existe en el
producto**. No hay literal que describa el caso sin forzar; la ayuda de upstream
sólo dice qué pasa al activar la casilla. Traducirla al inglés no lo arregla:
seguiría siendo texto inventado.

**Lo que hay que hacer**, y no toca la decisión 5: el bloque de consecuencia se
queda donde está, con su casilla, su rótulo literal, su estado armado y su verbo sin
cambiar. Lo que sale es **la mitad inventada**: basta la casilla con su rótulo y la
ayuda de upstream, que ya dice qué cambia. El contraste «sin ella / con ella» es
**razonamiento de diseño** y va en la prosa del documento, no dibujado como si el
producto lo dijera.

Lo mismo para la barra de la decisión 6: o lleva una frase en inglés que alguien
decida como copy nuevo —y entonces es una decisión de producto, no de diseño—, o no
lleva frase.

---

# Cierre — segundo retorno, 2026-09-04

Aplicado: 300.301 → **298.482 bytes**. Un delta sustractivo que efectivamente
restó, que es la primera señal de que se entendió.

Los tres borrados, comprobados en el fichero devuelto:

| # | Qué | Estado |
|---|---|---|
| 1 | Las mitades «sin ella» de los cuatro `Force` | **Cerrado.** El bloque queda con la casilla, su rótulo literal y la ayuda de upstream — nada más |
| 2 | La barra de sólo lectura de la decisión 6 | **Cerrado.** De las sub-pestañas se pasa directo a la tabla |
| 3 | La frase bajo `Quick Add` | **Cerrado.** El campo se queda con su rótulo y su desplegable |

Y el 3 volvió **mejor de lo pedido**: la observación no se perdió, se mudó al
`dv-olabel` —«`Quick Add` va pegado a su campo y **sin ayuda debajo**: en el
producto no la tiene, y la del campo de arriba ya lo nombra. Que un campo no lleve
ayuda se dibuja **no dibujando ninguna**»—. Eso es ámbito del documento, no del
producto: exactamente el sitio donde se pidió que fuera.

## El diseño de Administración queda aceptado

Seis sub-pantallas, cinco arquetipos, 41 columnas, 21 verbos, 24 superficies de
diálogo, 27 ayudas, 5 sufijos y 10 literales. Dos añadidos de primitiva declarados
y justificados: `Matrix` y `Confirm.force`.

## Lo que esta ronda deja aprendido

Tres correcciones seguidas fueron **del contrato, no del dibujo**, y las tres del
mismo tipo: una lista escrita a mano con un hueco. De ahí salieron los tres censos
—`censo-dialogos.mjs`, `censo-tablas.mjs`, `censo-ayudas.mjs`—, que producen las
cifras leyendo el fuente en vez de dejarlas escritas.

Y la regla que faltaba y costó dos rondas: **toda la interfaz del producto está en
inglés**, y este contrato está en castellano porque es documentación interna.
Ninguna de sus frases puede acabar dibujada. Las tres cosas que se han quitado en
este último retorno eran eso mismo — texto que la consola no dice, en castellano,
dibujado como si el producto lo dijera— y las tres entraron porque el contrato las
invitó: **pedí que el hueco del candado no se dejara en blanco, y me lo rellenaron**.
