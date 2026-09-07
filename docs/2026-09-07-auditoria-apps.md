# Auditoría de Apps — y por qué no lleva ronda de diseño

**Fecha:** 2026-09-07 · **Medido contra:** el arnés `dev` con 4 apps instaladas,
una de ellas degradada a propósito para ver el estado «hay actualización», y la
tienda con sus 27 apps · **Referencia:** `apps.js` y `index.html:6149-6183` del
fork.

## El dictamen

**Apps no tiene el problema del árbol de dominios.** Aquel había heredado el
arquetipo equivocado —una colección paginada para lo que es un árbol— y eso sólo
se arregla dibujando. Aquí el arquetipo es correcto: una rejilla de fichas para
objetos con descripción larga, decidida en la fase 3 y ya aceptada.

Lo que Apps tenía eran **cuatro incumplimientos de reglas que esta consola ya
tiene escritas y ratificadas**, más una pérdida de paridad. Eso se arregla
aplicándolas, no dibujando: una ronda de Design habría costado una jornada para
devolver un dibujo que dijera «aplica las reglas que ya tienes».

## Lo que se ha medido

| | 1440 | 1280 | 768 | 390 |
|---|---|---|---|---|
| Rejilla | `582px 582px` | `502px 502px` | una columna | una columna |
| Scroll horizontal de página | no | no | no | no |
| Desbordes en `main` | 0 | 0 | 0 | 0 |

La rejilla iguala la altura de las fichas de una misma fila (253/253 y 369/369 a
1440) y el pie de cada ficha se ancla abajo, así que las acciones quedan
alineadas. Eso ya estaba bien.

## Los cuatro hallazgos, y qué se ha hecho

### 1 · `Uninstall` era un bloque rojo relleno por ficha

Y la propia primitiva dice que no. `ui/Button` lo escribe: *«no en una FILA de
tabla: ahí "Delete" se repite una vez por fila y un bloque rojo por fila convierte
la tabla en una alarma»*. Y `ui/Menu` dice dónde va: *«las cosas destructivas van
aquí… una fila no puede tener un "Delete" suelto al lado de un "Disable"»*.

Una rejilla de fichas **es** una lista de filas: a 1440 eran cuatro bloques rojos
en batería, y uno más por cada app instalada. Zones, Users, Groups, Sessions y
Cluster ponen su verbo destructivo en el menú; ésta era la única que no.

**Hecho:** `Uninstall` pasa al menú `⋮` de la ficha. `Config`, `Update` y
`Store Update` se quedan visibles: son inocuos y se repiten sin coste.

### 2 · `· installed` no decía nada

La línea de versión ponía `v11.1 · installed`, y *installed* es cierto de todas
las fichas de esa lista. Gastaba un renglón para no informar, en el mismo sitio
donde vive lo que sí informa (`Update v11.0`).

**Hecho:** fuera. Queda la versión, y la actualización al lado cuando la hay.

### 3 · La ordenación de la tienda se había perdido

Upstream tiene la cabecera `Store Apps` como enlace de ordenación
(`sortTable('tableStoreAppsBody', 0)`, `index.html:6166`). Nuestra tienda es una
`<ul>` sin ninguna. **Es una pérdida de paridad**, de la misma clase que la que
destapó About: `check-parity-controls.mjs` cuenta destinos, ayudas y ejemplos, y
una ordenación no es ninguna de las tres, así que le pasa por delante.

**Hecho:** restaurada con `useSort`, el mismo gancho que usa toda columna
ordenable de la consola.

### 4 · Castellano que la puerta no veía

`setPorDesinstalar`, `hayUpdate`, `after3`, `.nota`, `/* --- Tienda --- */` y
`anotacion` en `ui/text.module.css`. Buscar `por` con `\b` no lo encuentra dentro
de `setPorDesinstalar`, porque dentro de un identificador no hay límite de
palabra. **Hecho**, y la puerta arreglada aparte: ver el commit del barrido.

## Lo que NO se ha tocado, y por qué

- **La rejilla de fichas.** Es el arquetipo aceptado y funciona: alturas
  igualadas, pies alineados, cero desbordes en los cuatro anchos.
- **`Update` y `Store Update` siguen siendo dos acciones.** Upstream las tiene
  separadas (`apps.js:130-131`): la primera sube tu zip, la segunda baja la de la
  tienda. Fundirlas sería quitar funcionalidad.
- **La pastilla `1 update available`** no lleva a la ficha que la tiene. Con
  cuatro apps se encuentra; con veinte, no. No se toca porque llevar a algún sitio
  es navegación nueva, y eso es decisión de producto.

## La tienda — decidido por la vía que no añade control

**Era el problema real de esta superficie, medido:** 27 filas, **5.868 px** de
scroll a 1440 y **9.337 px** a 390. Once pantallas de rodillo para encontrar una
app. Cada fila imprimía nombre, la pastilla de versión en un renglón propio, la
descripción entera, la URL del zip —70 caracteres en monoespaciada— y el tamaño.

Y **upstream está igual**: misma densidad, mismos campos, y tampoco tiene filtro.
Así que **un campo de búsqueda quedaba descartado**: es un control que upstream no
tiene, y esa no es una decisión de diseño.

Lo que sí es una decisión de diseño es **qué enseña cada fila en reposo**, y son
dos trabajos con dos profundidades: **buscar** quiere filas cortas y **confirmar**
quiere la descripción. Así que:

- las **dos primeras líneas** de la descripción se quedan a la vista y el resto
  pasa detrás del mismo `More Details` que ya usa la ficha instalada de al lado;
- **la URL del zip y el tamaño** se van con él: importan cuando vas a instalar, y
  nunca mientras buscas;
- **la versión sube a la línea del nombre**. Sola costaba un renglón en cada una
  de las 27, y es una etiqueta del nombre, no un dato al lado.

Ni un literal cambia, ni un control aparece, ni uno desaparece.

| | antes | después | |
|---|---|---|---|
| Scroll a 1440 | 5.868 px | **3.450 px** | −41 % |
| Scroll a 390 | 9.337 px | **3.575 px** | −62 % |
| Filas por pantalla a 390 | ~2,5 | **~6** | |

## Una diferencia deliberada entre las dos listas

En la ficha instalada `Uninstall` se va al menú; **en la fila de la tienda se
queda a la vista**, y no es un descuido. La regla de `ui/Menu` dice que una fila
no puede llevar un verbo destructivo suelto **al lado de los inocuos**, y ahí está
la diferencia: en la ficha competía con `Config`, `Update` y `Store Update`; en la
tienda, una app instalada tiene ese verbo y ninguno más con el que competir.
Esconder la única acción de una fila detrás de un menú es peor que enseñarla.
