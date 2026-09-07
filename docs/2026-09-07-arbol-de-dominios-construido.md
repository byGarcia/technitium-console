# Construido — el árbol de dominios (Cache, Allowed y Blocked)

**Fecha:** 2026-09-07 · **Dibujo:** ficheros `19`–`22` de Claude Design ·
**Barra:** `docs/direction/fase3-barra-aceptacion-arbol-de-dominios.md`

Los cuatro problemas del contrato, resueltos y medidos contra el arnés `dev`, no
contra el dibujo. Ni un control cambia de pantalla, no aparece un paso que
upstream no tenga, `Settings › Blocking` no se toca y ni un literal se reescribe.

## Medido, no estimado

| | 1440 | 1280 | 768 | 390 |
|---|---|---|---|---|
| Reparto | `328px 832px` | `328px 672px` | una columna | una columna |
| Scroll horizontal de página | no | no | no | no |
| Filete de Cache | `rgb(244,114,182)` | ídem | ídem | ídem |
| Filete de Allowed | `rgb(52,211,153)` | ídem | ídem | ídem |
| Filete de Blocked | `rgb(161,58,232)` | ídem | ídem | ídem |

Las dos columnas miden **exactamente lo mismo** a 1440: 3290 px las dos. A 390 el
árbol se queda en 283 px con tope y scroll propio, los registros van debajo y la
tabla scrollea **dentro de su caja** (`tableScrolls: true`) mientras la página no.

Los cuatro «desbordes» de 768 y 390 son el raíl plegado del cromo de la ronda 4,
que sale del viewport por diseño. No son de esta ronda.

### Los estados, medidos con la petición interceptada

| | `role=status` | `role=alert` | «Loading…» | barras de recuento | `Error!` |
|---|---|---|---|---|---|
| Carga | 1 | 0 | 2 | **ninguna** | no |
| Fallo sin dato previo | 0 | 1 | 0 | sí | **sí** |
| Fallo con dato previo | 0 | 1 | 0 | sí | **no** |

El fallo se cuenta **una sola vez**: con dato previo habla la tira y el aviso
calla; sin dato previo habla el aviso.

## Lo que cambió respecto a lo construido

- **La barra de recuento de los registros decía `0 records at <ROOT>` con la
  petición en vuelo.** Es exactamente lo que dice un nodo sin registros. Al árbol
  se le arregló el 2026-09-07 y a este lado le faltaba: ahora no se dibuja
  ninguna de las dos mientras se carga.
- **`Delete` no llevaba variante.** El contrato lo diagnosticó al revés —dijo que
  `Delete` y `Flush` eran «la misma pastilla roja»— y no lo eran: `Flush` ya era
  `variant="danger"` (relleno) y `Delete` no era **nada**, un botón gris para la
  acción destructiva de la barra. Ahora es `size="sm" variant="danger"`, que en
  este kit es texto rojo que se rellena al pasar por encima: el peso de fila, no
  el de cabecera. **No hace falta ninguna variante nueva**; la que faltaba ya
  existía.
- **`Loading` acepta `announce={false}`.** Dos huecos de la misma petición
  anunciaban la espera dos veces. El ojo necesita un relleno en cada hueco; el
  oído, uno.

## Tres diferencias con el dibujo, declaradas

1. **El nodo actual del árbol NO se tiñe** con el color de la pantalla. «Estás
   aquí» ya lo dice `ui/list.module.css` en ámbar, en todas las listas de la
   consola: repintarlo por pantalla haría que una señal signifique dos cosas, y
   lo haría pisando una primitiva compartida desde un fichero local. La identidad
   tiene tres canales en el lado de los registros y no necesita un cuarto.
2. **La segunda línea de la banda va en inglés.** La dibujé en castellano —«Lo
   que el servidor ha resuelto y guarda»— dentro del producto, que es el mismo
   defecto que se cerró en la ronda de Administración. La interfaz de esta
   consola es inglesa y nuestras adiciones la siguen.
3. **Las filas de la tabla son mucho más altas que en el dibujo.** El dibujo sólo
   pintó `Name Server`; la pantalla real pinta además el `nameServerMetadata`
   entero —seis pares por registro— porque es lo que hace `extras()`. Es
   comportamiento existente, no una regresión.

## El defecto que sólo vio la herramienta

`--edge` **ya era un token** —el reflejo interior del panel,
`inset 0 1px 0 rgba(255,255,255,.055)`— y la variable local de la ronda se llamaba
igual. Ponerla a un color sustituyó en silencio el `box-shadow` de **todos** los
paneles de las tres pantallas. En la pantalla no se veía; `dev/uniformity.js` lo
dijo: `panel | no-shadow` en Cache, Allowed y Blocked contra `shadow` en las otras
siete. Renombrada a `--kind`, la familia `panel` vuelve a tener **una sola
apariencia**.

Quedan cuatro familias partidas de las quince, todas anteriores y ajenas a esta
ronda: `tabla` (Settings y DHCP), `row-checkbox` (Zones) y los dos anchos de campo
de Settings.

## Portón

1.119 pruebas en verde (13 nuevas), typecheck limpio, `composes` todos resueltos,
paridad de destinos 28/28, de ayudas 112/112 y de ejemplos 94/94, e `src/` entero
en inglés.
