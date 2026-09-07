# Dashboard, alineado con el dibujo aceptado

**Fecha:** 2026-09-07 · **Dibujo:** `16-fase3-dashboard-cromo-login.dc.html`, artboard
*Dashboard* a 1440 · **Reconciliación:** `fase3-recorrido-dashboard-cromo.md`, aceptada
el 2026-09-03

> Adrián comparó la pantalla con el dibujo y dijo que no estaban iguales. Lo estaban
> en la mitad de arriba y no en la de abajo. Esto es lo que había, lo que hay y con
> qué se midió.

## Lo que estaba mal, y por qué es deriva y no decisión

El dibujo pone la mitad inferior en **tres filas**: `Queries` con `Server` al lado,
después los **tres paneles de sectores en fila**, y después los **tres top-N en
fila**. Lo construido era otra cosa: un **raíl derecho de 310 px** que apilaba
`Server`, los tres dónuts y `Top Clients`, con sólo dos paneles a la izquierda.

**No hay ningún registro de ese cambio.** El contrato no fija la disposición, la
reconciliación aceptó el dibujo y el commit de construcción no menciona haberla
cambiado. Es exactamente la lección que Administración dejó escrita, al revés: allí
se decidió **no** construir seis cosas del dibujo y se razonó cada una; aquí se
construyó otra y no se razonó ninguna.

Y costaba, que es lo que se ve a 1440:

- un dónut dentro de 310 px sale como un anillo enorme y centrado con la leyenda
  debajo, en vez de anillo a la izquierda y leyenda a la derecha;
- `Server` sólo cabía a dos columnas —`auto-fill minmax(92px,1fr)` dentro de 310 px
  no puede dar tres—, cuando son seis contadores en dos filas de tres;
- `Top Clients` quedaba fuera del grupo al que pertenece, al final del raíl;
- y **media página vacía abajo a la izquierda**.

## Lo que hay ahora

| Pieza | Dibujo | App |
|---|---|---|
| Barra de periodo | bajo el título, a la izquierda | igual |
| `Queries` + `Server` | fila 1 | igual |
| Tres paneles de sectores | fila 2, en fila | igual |
| Tres top-N | fila 3, en fila | igual |
| `Server` | 6 contadores, 3 columnas | igual |
| Dónut | anillo a la izquierda, leyenda a la derecha | igual |

La barra de periodo salía de `actions` de `SectionHeader`, que la empuja al extremo
derecho de la fila del título. Ahí se lee como **una acción de la pantalla** —igual
que `Add Zone` o `Flush Cache`— y no lo es: reencuadra todas las cifras de debajo,
que es la misma razón por la que el selector de nodo subió a la slot del cromo.

## La composición responsiva, medida

Siete anchos, sin desbordes y sin una sola entrada de leyenda recortada:

| Ancho | Desborde | `trio` | Recortes |
|---|---|---|---|
| 1440 | no | 3 columnas | 0 |
| 1280 | no | 3 columnas | 0 |
| 1024 | no | 3 columnas | 0 |
| 900 | no | 1 columna | 0 |
| 768 | no | 1 columna | 0 |
| 560 | no | 1 columna | 0 |
| 390 | no | 1 columna | 0 |

Los escalones, y por qué están donde están:

- **1080** — `Server` deja de caber al lado de `Queries` (a 1024 la gráfica bajaba a
  425 px y a 390 se salía). Los dos pasan a ancho completo, y `Server` **conserva sus
  tres columnas**: seis contadores en tres columnas es lo que son.
- **980** — los dos tríos pasan de tres columnas a **una**, no a dos: dos dejarían un
  huérfano en una segunda fila, y los paneles son altos, así que una columna se lee
  mejor que un 2+1.
- **El dónut no tiene escalón.** Anillo y leyenda son un `flex` con `wrap`: van al
  lado mientras quepan y la leyenda cae debajo cuando no. La primera versión sí tenía
  rejilla con `minmax(0,1fr)` para la leyenda y **a 1024 recortaba cinco entradas**
  —`Author…`, `Recurs…`, `Cache…`—, porque una columna `minmax(0,1fr)` puede ser más
  estrecha que su contenido. Ahora la leyenda conserva su ancho, el anillo cede hasta
  110 px, y pasado eso la fila envuelve. Ningún ancho hay que adivinarlo por delante.
- **560** — con la leyenda ya envuelta debajo, vuelve a ser fila: una columna de
  cinco entradas bajo un anillo dobla el alto del panel para nada.

## Las dos diferencias con el dibujo que se DEJAN, y por qué

1. **Los títulos de panel van en versalitas** (`QUERIES`) y el dibujo los pone en caja
   normal (`Queries`). Eso **no es del Dashboard**: lo pone `ui/Panel`, que compone
   `smallCaps` para las **once pantallas** que llevan paneles. Especializar aquí la
   caja tipográfica crearía dos clases de panel en la consola por una pantalla, que es
   justo lo que `dev/uniformity.js` existe para impedir. Queda como **desviación
   declarada del dibujo**: si se quiere la caja normal, se decide en la primitiva y se
   audita en las once, no aquí.
2. **La gráfica de líneas lleva eje Y y rejilla**, y el dibujo no los dibuja. Es
   configuración de `Chart` y afecta a las cuatro gráficas de la pantalla; se anota y
   no se toca en esta ronda, que es de composición.

## Portón

31 rutas de barrido a 1440: **las quince familias idénticas cadena a cadena** al
último barrido registrado. Ninguna se mueve, que es lo que había que demostrar de un
cambio que sólo reordena. Y typecheck, lint, `lint:language`, `css-dead`, paridad de
upstream y **1.103 pruebas** por código de salida 0.
