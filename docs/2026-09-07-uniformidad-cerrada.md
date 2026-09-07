# Las cuatro familias partidas — y por qué ninguna estaba en la consola

**Fecha:** 2026-09-07 · **Encargo:** «ciérralas, y revisa que no haya nada más»

## El dictamen

`dev/uniformity.js` llevaba meses diciendo **«4 familias de 15 con más de un
aspecto»**. Las cuatro se han medido una a una, con la evidencia de qué elemento
producía cada firma. **Ninguna era deriva de la consola. Las cuatro eran la
herramienta midiendo dos objetos como uno.**

| Familia | Los dos aspectos | Qué eran de verdad |
|---|---|---|
| `tabla` | `th rgb(33,37,41) · td 9px 10px` / `th transparente · td 6px 8px 6px 0px` / `td —` | La tabla de datos (`ui/Table`) y la **tabla editable** (`ui/EditableTable`), que son **dos primitivas** por diseño, y una **tabla vacía** cuya única celda es la del «No Lease Found» |
| `row-checkbox` | `40px` / `0px` | La celda de datos y la de **cabecera**, con 40 px de área de acierto la primera y ninguna la segunda, **documentado en `ui/Table.module.css`** |
| `campo-num-ancho` | `104px` (×14) / `151px` (×15) | Los 14 son campos de **formulario** y los 15 son campos **dentro de una celda** de la tabla editable. Medido: los 104 tienen `id`, los 151 no |
| `campo-area-alto` | `66px` / `98px` | `rows=3` y `rows=5`. **La misma fórmula**: 16 px de línea dentro de 18 px de marco. Comprobado, no supuesto |

## Por qué importaba, y no era cosmético

Una herramienta que enseña cuatro problemas permanentes **enseña a no leerla**. No
es hipotético: esta misma mañana el panel perdió su sombra en tres pantallas
—`--edge` local pisando el token global— y lo único que lo dijo fue **una quinta
partición apareciendo entre las cuatro de siempre**. Si hubieran sido seis, no se
habría visto.

Y hay una pérdida de potencia además del ruido, que el propio fichero ya
advertía: *«una familia que junta dos objetos no puede decir si uno de ellos ha
cambiado»*. Mientras `tabla` valía por las dos primitivas, la tabla editable podía
derivar sola sin que nada lo dijera.

## Qué se ha cambiado, y es la herramienta

- **`tabla` y `tabla-editable` aparte**, por la clase `_editable_`.
- **Una tabla sin celda de datos no firma nada.** El filtro de `_noRows_` ya
  existía y era correcto; lo que faltaba era rendirse cuando el filtro no deja
  ninguna celda. `td —` no era «nada»: era una tercera firma.
- **`campo-num-ancho-form` y `campo-num-ancho-celda`** aparte, por `closest('td')`.
- **`campo-area-alto` mide la fórmula y no el resultado**: `line 16px + frame
  18px`, con lo que `rows` desaparece de la firma.
- **`row-checkbox-th` y `row-checkbox-td`** aparte, por la celda en que vive.
- **Un número de aspectos esperado por familia**, para que el informe sea
  aprobado/suspenso en vez de una lista que juzgar. El mapa de excepciones
  **está vacío**, y eso es lo que se buscaba: cada familia que necesitaba una
  excepción era una familia que medía dos objetos, y todas se han partido en los
  dos que llevaban dentro. Una entrada en ese mapa es una deuda, no una función.

## El resultado

> **18 familias, una sola apariencia cada una, y cero excepciones declaradas.**

Antes: 15 familias, 4 partidas, un mapa mental de cuáles ignorar.

Probado rompiéndolo: devolviendo `campo-num-ancho` a su forma sin contexto, el
informe da 1 hallazgo con las dos firmas y sus rutas.

Las pruebas del propio fichero (`dev/uniformity.test.mjs`) se han puesto al
contrato nuevo: la que existía para la fila vacía ahora exige que **no firme nada**
en vez de que firme `td —`.
