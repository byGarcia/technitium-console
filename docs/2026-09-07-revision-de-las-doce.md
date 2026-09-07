# Revisión de las doce pantallas — medida, no supuesta

**Fecha:** 2026-09-07 · **Encargo:** «revisa que todas las demás ya estén hechas»

La revisión no se hizo mirando pantallas una a una: se hizo **buscando la clase de
defecto que Apps acababa de destapar**, en las doce a la vez. Apps perdió la
ordenación de la tienda y ninguna puerta lo vio, porque
`check-parity-controls.mjs` cuenta destinos, ayudas y ejemplos y una ordenación no
es ninguna de las tres. Si pasó una vez, la pregunta correcta no es «¿está bien
Apps?» sino **«¿cuántas más hay?»**.

## Lo que salió, y no se veía

### Un control muerto desde hace una semana

`src/screens/admin/Permissions.tsx` tenía `<Th field="nombre">` contra un objeto de
claves que dice `{ name: … }`. `useSort` busca la clave, no la encuentra y **se
calla**:

```js
function toggle(field) {
  const read = keys[field]
  if (read == null) return          // la columna simplemente no ordena
```

Resultado: en el modal `Edit Permissions`, las dos cabeceras se podían pulsar
eternamente sin que pasara nada. Lo dejó así el barrido al inglés del
**2026-08-31**, que renombró la clave del objeto y no la cadena de dentro del
atributo —porque una cadena entre comillas dobles es donde va el dato, no el
identificador—, y desde entonces han pasado por encima typecheck, lint, 1.100
pruebas, `css-dead`, la paridad de controles y una auditoría de las cinco
entregas de diseño. Ninguna podía verlo: `field` es una cadena, así que TypeScript
no tiene nada que comprobar; la columna se pinta, así que ninguna prueba que
busque la cabecera falla.

### Una segunda ordenación perdida

La **lista de apps instaladas**. Upstream la tiene como tabla y su cabecera
`Installed Apps` ordena (`sortTable('tableAppsBody', 0)`); aquí es una rejilla de
fichas y se había quedado sin nada. Restaurada con el mismo control que la tienda.

## Las dos herramientas que quedan, para que no vuelva a pasar

**`dev/check-parity-sort.mjs`** — cuenta las columnas ordenables de upstream
leyendo sus `sortTable('<tabla>', <n>)` del HTML, y las compara con las nuestras
tabla a tabla. Cada hueco tiene que estar **declarado con su razón**; un hueco sin
declarar es un hallazgo, y una razón que ya no hace falta también, porque una
razón que nadie necesita es una que nadie relee.

> **64 de las 66 columnas ordenables de upstream, en 17 tablas. Las 2 que faltan
> están declaradas**, y son la misma: la columna `#` de Zones y la de los
> registros de una zona. Ordenar por el número de fila que la propia ordenación
> acaba de repartir no lleva a ningún sitio, y además ordena como texto: 1, 10,
> 11, 2.

**`dev/check-sort-fields.mjs`** — comprueba que cada `<Th field="x">` nombra una
clave que existe en el objeto `Keys` de su fichero. Ambos lados se leen del código,
así que no hay lista que mantener.

> **Las 61 columnas ordenables de 13 ficheros nombran una clave que existe.**

Probada rompiéndola a propósito: devolviendo `field="nombre"` a su sitio, sale el
hallazgo y el código de salida es 1.

## El estado de las doce

| Pantalla | Ronda que la cubrió | Ordenación |
|---|---|---|
| Dashboard | 4 (cromo) + alineación con el dibujo | — |
| Zones | piloto 2 + alineación | 7 de 8, la que falta declarada |
| Cache · Allowed · Blocked | ronda del árbol de dominios (hoy) | — |
| Apps | auditoría (hoy) | **2 restauradas hoy** |
| DNS Client · Logs | ronda del arquetipo de herramienta | — |
| Settings | piloto 3 + alineación | — |
| DHCP | fase 3 | 11 de 11 |
| Administration | ronda de Administración | 27 de 27, **una desatascada hoy** |
| About | cierre de fase 3 | — |

## Portón

- **1.121 pruebas** en verde.
- **48 celdas** —12 pantallas × 4 anchos— con cero desbordes y cero scroll lateral.
- `src/` entero en inglés, `composes` todos resueltos, paridad 28/112/94.
- Uniformidad: `panel` con una sola apariencia. Quedan cuatro familias partidas de
  quince —`tabla` en Settings y DHCP, `row-checkbox` en Zones y los dos anchos de
  campo de Settings—, todas anteriores a estas rondas y **medidas, no supuestas**.
