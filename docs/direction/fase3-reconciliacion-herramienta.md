# Reconciliación — arquetipo herramienta (DNS Client + Logs)

Entrega: `17-fase3-herramienta-dnsclient-logs.dc.html`, 2026-09-03, ocho secciones
H0–H8. **Una sola reconciliación**, como se acordó.

## Lo que pasa la barra, y no se vuelve a tocar

- **Los 23 controles**, con su rótulo literal, sus opciones completas —28 tipos, 5
  transportes— y los dos placeholders (`example.com or *.com`, `A, AAAA, etc.`).
  Comprobado uno a uno contra el volcado.
- **Los 9 verbos**, incluidos los tres que hoy desaparecen sin permiso.
- **Los 20 estados**, con las diez no observadas marcadas como tales en su rótulo.
- **Los dos anchos** para las tres pantallas.
- **La extensión de primitiva, declarada y justificada**: una segunda polaridad de
  la pastilla, `While {interruptor}` junto a `Needs {interruptor}`, sin color nuevo
  ni tratamiento nuevo. Es exactamente lo que la barra pedía que se hiciera así.
- **La regla de la salida cruda** —altura fija, dos ejes, `white-space:pre`, nunca
  crece— con el argumento correcto: una línea partida deja de estar indentada.
- **El plegable en sus tres formas**, y que con cero **no se dibuje**.
- **Maestro–detalle con estado por panel**, y que a 390 **no** se convierta en
  navegación.
- **Vacío ≠ error** en los dos paneles de View Logs.

## Lo que hay que corregir

### Bloqueantes

**B1 · La tabla apilada a 390 no es una decisión de esta ronda.**
`5b` dibuja Query Logs como tarjetas apiladas. La `Table` construida **no hace
eso**: medido a 390 en `/zones/`, sigue siendo tabla —853 px dentro de un
contenedor de 350 con desplazamiento horizontal—. Apilarla es un patrón nuevo para
una primitiva cerrada, no está entre los seis, y decide por todas las colecciones
de la consola o deja a Query Logs como la única que se comporta distinto. **Se
retira**: a 390 va la tabla con su desplazamiento, como Zones. Si el apilado
merece existir, es una ronda suya y afecta a seis pantallas.

**B2 · Los siete colores de fila colisionan a la opacidad a la que se usan.**
Mandarlos a los tokens de serie del piloto 1 es la decisión correcta —misma
palabra, mismo color— pero **está medida sobre el chip, no sobre la fila**. Con la
propia función de `dev/palette-distance.mjs`:

| | peor par | veredicto |
|---|---|---|
| chip a color pleno | 11,6 (`Refused`/`Authoritative`) | 0 de 21 pares colisionan |
| **fondo de fila al 13 %** | **3,9** (`Refused`/`Authoritative`) | **5 de 21 por debajo de 10** |

Y **no lo arregla la opacidad**: al 100 % el peor par sigue en 11,6, y a partir del
50 % el texto de la celda baja de 4,5:1 y se cae de AA. El problema es que dos de
los siete tokens son la misma familia —cian `#22d3ee` y azul cielo `#38bdf8`—.
**Hace falta separar ese par**, y comprobar después los otros cuatro que quedan por
debajo del umbral: `Server Failure`/`Cached`, `Blocked`/`Cached`,
`Server Failure`/`Recursive` y `Server Failure`/`Blocked`.

Esto no invalida la leyenda: la leyenda es lo que hacía falta. Invalida que se
prometa que siete colores se distinguen cuando cinco pares no.

**B3 · El botón sin permiso está redibujado.**
La primitiva cerrada el 2026-09-03 pone **el candado dentro del botón** y el
permiso **en un tooltip**. La entrega lo cambia por una pastilla siempre visible
al lado, y el botón se queda sin candado. Estaba en la lista de lo heredado.

El cambio tiene argumento —un tooltip no existe en táctil— pero **no es de esta
ronda**: aceptarlo obliga a rehacer también `Settings`, que ya está construido y
desplegado con la otra forma. **Se vuelve a la primitiva.** Que el texto del
permiso deba ser visible sin puntero se anota como pendiente, con su motivo, y se
decide cuando toque las dos pantallas a la vez.

### Literales — cuatro, y ninguno es opinable

**L1 · `Failed!` no existe.** El título del aviso de fallo de DNS Client es
`Error!`; lo pone `noticeFromFailure`. Rama `2h`.

**L2 · Los dos `Missing!` no son rojos.** El fuente los emite con `type: 'warning'`
y la entrega los dibuja en `--dan`. Ramas `2f` y `2g`. El tono es contrato: rojo
dice «ha fallado» donde el producto dice «te falta un dato».

**L3 · Los tres avisos de éxito están reescritos.** «The log file was deleted.»
contra «Log file was deleted successfully.», y los otros dos igual. Y la propia
entrega dice al lado que el cuerpo «se copia del fuente al implementar, y no se
redacta aquí» — que es lo correcto, pero se redactó. **El contrato los trae
enteros**, así que se ponen tal cual.

**L4 · La leyenda está en castellano.** «NXDOMAIN y tipo bloqueado», «tipo
autoritativo». Toda la interfaz del producto está en inglés; esa leyenda sería el
único texto en castellano de la consola. Las descripciones del contrato están en
castellano porque el contrato es documentación interna, no porque vayan a pantalla.

### Añadidos — dos

**A1 · `Retry` no existe en View Logs.** La rama `4c` añade un botón que el fuente
no tiene: al fallar la lista se pinta el texto y nada más. Añadir un control es lo
único que esta consola no puede hacer.

**A2 · El recuento en la cabecera de `Log Files`.** La pastilla con `0` / `3` no
está en el contrato. Es defendible —*cero es un dato*— pero es un elemento nuevo, y
se decide diciéndolo, no colándolo con el dibujo.

### Menor

**M1 · Los nombres de fichero llevan `.log`.** El servidor del arnés devuelve
`2026-09-03`, sin extensión. Es dato volátil y no cambia el dibujo, pero conviene
no fijarlo así en la referencia.

## Lo que esta reconciliación NO pide

- No se toca ninguna de las ocho reglas nuevas de `H8` salvo la del color, y de
  ésa sólo la elección de dos tokens.
- No se rediscute la extensión de la pastilla: está bien planteada y bien
  justificada.
- No se pide dibujar el megabyte de verdad. La entrega ya dice que el dibujo no
  puede afirmar lo que no ejecuta, y tiene razón.
- No se pide el menú de fila de upstream: sigue fuera de alcance.

---

# Cierre de la reconciliación — 2026-09-03

Retorno aplicado sobre el mismo fichero (`etag 1788461344940467`, +3.998 bytes).
**Ocho de los nueve puntos, cerrados**; comprobado uno a uno en el fichero
devuelto:

| # | Punto | Estado |
|---|---|---|
| 1 | Tabla apilada a 390 | **Cerrado.** `5b` vuelve a la tabla de diez columnas en `tabwrap sx`. El apilado va como propuesta de ronda propia, con las seis colecciones que arrastra y dos preguntas concretas —qué columna titula la tarjeta y dónde vive la ordenación— |
| 3 | Botón sin permiso | **Cerrado.** Candado dentro del botón, permiso en `role="tooltip"`, envoltorio `tipw`. Y el caso táctil queda anotado con una alternativa que no se me había ocurrido: **una sola frase para los cuatro verbos** en vez de cuatro pastillas |
| 4 | `Failed!` | **Cerrado.** Ahora `Error!` |
| 5 | Los dos `Missing!` | **Cerrado.** `nt warn`, y el borde `--dan` del campo se conserva |
| 6 | Avisos de éxito | **Cerrado.** Los tres literales enteros |
| 7 | Leyenda en castellano | **Cerrado.** `Row Colours` y las siete condiciones en inglés |
| 8 | `Retry` inventado | **Cerrado.** Retirado |
| 9 | Recuento de `Log Files` | **Cerrado.** Retirado, y declarado como propuesta |
| — | `.log` en los nombres | **Cerrado.** Ahora `2026-09-03` |

## El punto 2 sigue abierto, y ahora se sabe por qué

La entrega hizo lo correcto: **no afirmó los números** y pidió volver a pasar la
herramienta. Pasada, dice que **la dirección acierta y el valor no llega**.

`--c-ref: #155e75` (cyan-800), fondo al 30 %:

| comprobación | criterio | `#155e75` |
|---|---|---|
| par como línea, deuteranopia | separar | **22,6 → 34,6** ✔ arregla el defecto del piloto 1 |
| par como fondo de fila al 30 % | ΔE00 ≥ 10 | **9,8** ✘ |
| **línea sobre el panel** | **WCAG 1.4.11 ≥ 3:1** | **2,35:1** ✘ |

La tercera es la que importa, y es una comprobación que **hace la propia
`dev/palette-distance.mjs`**: «una línea de 2 px y un chip de 9 px son objetos
gráficos no textuales y quieren 3:1». Oscurecer el cian arregla la deuteranopia y
apaga la línea: el par se distingue y deja de verse. Cambia un fallo medido por
otro fallo medido.

**Y hay un valor que pasa las tres.** Barriendo la familia cian de oscuro a claro,
ninguno la cumple —`cyan-700` da 3,19:1 pero deja la fila en 7,8—: hay que mover
**el tono además de la claridad**.

`--c-ref: #0d9488` (teal-600):

| comprobación | criterio | resultado |
|---|---|---|
| línea sobre el panel | ≥ 3:1 | **4,57:1** ✔ |
| par como línea, deuteranopia | separar | **22,6** ✔ |
| par como fondo al 30 % | ≥ 10 | **12,1** ✔ |
| contra las otras nueve series, deuteranopia | sin colisión | peor **12,5** (`Dropped`) ✔ |
| texto `--ink` sobre el fondo más claro | ≥ 4,5:1 | **6,5:1** ✔ |

## Lo que el barrido destapa además, y no es del retoque

Al 30 %, con `#0d9488` puesto, **quedan dos pares por debajo de 10**, y ninguno es
el que se estaba arreglando:

- `Server Failure` / `Cached` — **8,5**
- `Blocked` / `Cached` — **9,6**

Los dos son contra `Cached` (`#f472b6`, rosa) desde el rojo y el morado. Es el
mismo defecto de familia y también viene de los tokens de serie: **no es de esta
pantalla**. Se anota como **segunda pieza de la deuda del piloto 1**, junto al par
ya identificado, y no se resuelve aquí — resolverlo sería tocar la paleta de la
gráfica desde la reconciliación de otra pantalla.

**Con `Cached` sin tocar, la leyenda sigue siendo honesta**: el color es refuerzo y
`RCODE` y `Response Type` van escritos en su celda, que es la regla de la fase 1.
Lo que no puede decirse es que los siete se distingan.
