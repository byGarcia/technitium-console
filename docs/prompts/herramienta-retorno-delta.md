# Herramienta — retorno: nueve puntos, y sólo el delta

Recorrido `17-fase3-herramienta-dnsclient-logs.dc.html` contra el contrato y la
barra, punto por punto. **La entrega está bien**: los 23 controles con sus
literales y opciones, los 9 verbos, los 20 estados con las diez no observadas
marcadas como tales, los dos anchos y la extensión de primitiva **declarada y
justificada**. Esto es lo único que falla.

Son **nueve**, y no son nueve literales: **tres son decisiones que se salen del
encargo acotado**, cuatro son literales o tonos, y dos son controles añadidos.

**Se pide sólo el delta.** No hay que rehacer nada ni volver a dibujar ninguna
rama que no aparezca aquí.

---

## Lo que NO se toca

Va primero para que no haya duda: **todo lo demás queda intocable.**

- Los 23 controles, sus rótulos, sus 28 tipos, sus 5 transportes y los dos
  placeholders.
- Los 9 verbos y dónde vive cada uno.
- Las 8 ramas de DNS Client, las 7 de View Logs y los 5 estados de Query Logs, con
  sus marcas de no observado.
- Los cuatro grupos del filtro —*Source · Mode · Match · Paging*—, que `Page
  Number` esté en *Mode* con los otros tres que el modo fija, y que los verbos
  vayan en pie propio.
- **La regla de la salida cruda entera**: caja propia, altura fija, dos ejes,
  `white-space:pre`, `overscroll-behavior:contain`, `tabindex=0`, y que **no se
  ofrezca interruptor de ajuste** porque sería añadir un control. El argumento es
  correcto: una línea partida deja de estar indentada.
- **El plegable en sus tres formas**, y que con cero no se dibuje ni la fila.
- **El maestro–detalle**: los dos paneles a la vez, cada uno con su estado, y que a
  390 **no** se convierta en navegación.
- **La extensión de la pastilla** —`While {interruptor}` junto a `Needs
  {interruptor}`, mismo filete, misma opacidad, una sola pastilla por grupo—. Está
  bien planteada, bien justificada y es la única que hacía falta. **No se
  rediscute.**
- Que haya **leyenda de siete entradas, siempre completa**, cada una con su
  condición, y que el color **nunca sea el único canal**.
- Las ocho reglas nuevas de `H8`, salvo lo que dice el punto 2.
- Que el dibujo **no afirme** cómo se desplaza un megabyte real. Es la respuesta
  correcta.

Y una cosa que salió mejor de lo pedido y **conviene que se quede**: dibujar el
`Cluster Node` de DNS Client marcándolo como no observado, y decir que sin clúster
el campo no existe y la retícula corre a la izquierda.

---

## Los tres que se salen del encargo

Ninguno de los tres se cierra de lado: los tres necesitan **una respuesta
explícita** en el retorno, no un dibujo cambiado en silencio.

### 1 · La tabla apilada a 390 no es una decisión de esta ronda

`5b` dibuja Query Logs a 390 como **tarjetas apiladas**. La `Table` construida no
hace eso: **medido a 390 en `/zones/`**, sigue siendo tabla — 853 px dentro de un
contenedor de 350, con desplazamiento horizontal.

El encargo declaraba la tabla heredada y decía «Query Logs usa la MISMA tabla que
Zones». Apilarla es un patrón nuevo para una primitiva cerrada, y no es local:
**decide por las seis colecciones de la consola** —Zones, Cache, Allowed, Blocked,
Apps, DHCP— o deja a Query Logs siendo la única que se comporta distinto a 390.

**Qué tiene que volver:** `5b` con la tabla y su desplazamiento horizontal, como
Zones.

**Y qué hay que responder, aparte:** si el apilado es mejor —que puede serlo, diez
columnas en 350 px son muchas—, **dilo como propuesta de ronda propia**, con qué
seis pantallas arrastra y qué se rompe en cada una. Se decide entonces, no aquí. Lo
que no vale es que entre por una pantalla.

### 2 · Los siete colores colisionan a la opacidad a la que se usan

Mandarlos a los tokens de serie del piloto 1 es **la decisión correcta** —misma
palabra, mismo color en toda la consola— y la leyenda era justo lo que faltaba.
Pero la elección **está medida sobre el chip, no sobre la fila**. Con la función de
`dev/palette-distance.mjs`, que es la que fija el umbral de este proyecto:

| | peor par | resultado |
|---|---|---|
| chip a color pleno | ΔE00 **11,6** — `Refused`/`Authoritative` | 0 de 21 pares colisionan |
| **fondo de fila al 13 %** | ΔE00 **3,9** — `Refused`/`Authoritative` | **5 de 21 por debajo de 10** |

Los cinco: `Refused`/`Authoritative` 3,9 · `Server Failure`/`Cached` 4,8 ·
`Blocked`/`Cached` 5,0 · `Server Failure`/`Recursive` 7,7 ·
`Server Failure`/`Blocked` 8,9.

**Y no lo arregla subir la opacidad.** Medido en barrido:

| opacidad | 13 % | 30 % | 50 % | 80 % | 100 % |
|---|---|---|---|---|---|
| peor par | 3,9 | 6,9 | 8,6 | 10,3 | **11,6** |
| texto `--ink` sobre el fondo más claro | 10,5:1 | 6,5:1 | **3,7:1** | — | — |

Ni al 100 % separa, y pasado el 50 % el texto de la celda **cae por debajo de
4,5:1**. La causa no es la mezcla: **dos de los siete tokens son la misma familia**
—`Refused` cian `#22d3ee` y `Authoritative` azul cielo `#38bdf8`—.

**Qué tiene que volver:** ese par separado, y los otros cuatro pares comprobados
después del cambio. Los siete siguen saliendo de los tokens de serie: lo que se
pide es elegir otro token para uno de los dos, no inventar un color.

**Y hay un dato más, que cambia dónde está el problema.** Ese par **ya convive en
la gráfica de líneas del Dashboard**, y la misma herramienta ya lo marcaba:

- visión normal: ΔE00 **11,6 — «en riesgo»**
- deuteranopia: ΔE00 **6,5 — COLISIÓN**

Es decir: `Refused` y `Authoritative` no se distinguen bien **ni como líneas de la
gráfica**, y para quien tiene deuteranopia no se distinguen en absoluto. El defecto
**es del piloto 1**, y esta pantalla sólo lo ha destapado poniéndolos a convivir en
una superficie donde el color pesa menos.

**Qué hay que responder:** si el par se separa **en los tokens de serie** —o sea,
también en el Dashboard, que es donde nació— o si se separa sólo para la fila y se
acepta que la misma palabra tenga dos colores. **Las dos respuestas son legítimas y
tienen coste distinto**; lo que no vale es arreglarlo aquí callando que allí sigue
roto.

### 3 · El botón sin permiso está redibujado

La primitiva se cerró el 2026-09-03 y pone **el candado dentro del botón**, con el
permiso **en un tooltip**. `4h` lo cambia por una **pastilla siempre visible al
lado**, y el botón se queda sin candado. Estaba en la lista de lo heredado.

**El cambio tiene un argumento bueno**: un tooltip no existe en táctil, así que el
nombre del permiso es invisible en un móvil. Pero **no es de esta ronda**:
`Settings` ya está construido con la otra forma —commit `d8983de`—, y aceptarlo aquí
dejaría dos pantallas diciendo lo mismo de dos maneras.

**Qué tiene que volver:** `4h` con la primitiva tal como está — candado dentro,
permiso en tooltip.

**Y qué hay que responder, aparte:** el caso táctil **queda anotado como pendiente
real**, no descartado. Si crees que la pastilla visible debe ganar, **escríbelo como
propuesta que toca las dos pantallas**, con qué pasa cuando hay cuatro verbos
seguidos con pastilla —la barra de `Settings` tiene cuatro— y cuánto ocupa eso a
390. Se decide con las dos delante.

---

## Los cuatro literales

Ninguno es opinable: los cuatro están en el contrato o en el fuente.

**4 · `Failed!` no existe.** El título del aviso de fallo de DNS Client es
**`Error!`** — lo pone `noticeFromFailure`. Rama `2h`.

**5 · Los dos `Missing!` no son rojos.** El fuente los emite con
`type: 'warning'` y `2f`/`2g` los dibujan en `--dan`. **Van en `warn`.** El tono es
contrato: rojo dice «ha fallado» donde el producto dice «te falta un dato». El
borde `--dan` del campo que lo provoca **sí se queda**: eso está bien.

**6 · Los tres avisos de éxito están reescritos.** El contrato los trae enteros:

- `Log Deleted!` → **«Log file was deleted successfully.»**
- `Logs Deleted!` → **«All log files were deleted successfully.»**
- `Stats Deleted!` → **«All stats files were deleted successfully.»**

La entrega dibuja «The log file was deleted.» y los otros dos abreviados, y **al
lado dice que el cuerpo no se redacta aquí**. Lo segundo es lo correcto; lo primero
contradice a lo segundo.

**7 · La leyenda está en castellano.** «NXDOMAIN y tipo bloqueado», «tipo
autoritativo», «tipo cacheado». **Toda la interfaz del producto está en inglés**;
esa leyenda sería el único texto en castellano de la consola. Las descripciones del
contrato están en castellano porque el contrato es documentación interna, no porque
vayan a pantalla. **Las siete condiciones, en inglés.**

---

## Los dos añadidos

**8 · `Retry` no existe en View Logs.** La rama `4c` añade un botón que el fuente no
tiene: al fallar la lista se pinta el texto y nada más. Añadir un control es lo
único que esta consola no puede hacer. **Fuera.**

**9 · El recuento en la cabecera de `Log Files`.** La pastilla con `0` / `3` no está
en el contrato. Es defendible —*cero es un dato*— pero es un elemento nuevo. **O se
retira, o se declara** como lo que es: una propuesta, con su motivo, para decidir
igual que se decidió el recuento por sección de `Settings`.

---

## Menor

**Los nombres de fichero llevan `.log`** y el servidor devuelve `2026-09-03`, sin
extensión. Es dato volátil y no cambia el dibujo; conviene no fijarlo así.

---

## Qué se entrega

Sólo lo que tocan estos nueve puntos, **a los anchos donde aparezca cada uno**, más
**las tres respuestas explícitas** de los puntos 1, 2 y 3. Nada más se vuelve a
dibujar.
