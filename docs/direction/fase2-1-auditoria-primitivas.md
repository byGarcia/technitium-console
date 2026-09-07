# Fase 2.1 — auditoría de las primitivas

Contra la dirección que cerró la fase 1: `DESIGN.md` y los tokens. **No se reabre
dirección visual**; esto sólo dice, para cada primitiva, si la decisión de fase 1
la toca o no.

## Lo primero: la cifra del plan estaba mal

El plan dice «los 24 módulos de `src/ui/`». Son **25 componentes**, y además hay
**8 módulos CSS compartidos sin componente** —`count`, `interaccion`, `kv`,
`list`, `record`, `rotulo`, `text`, `tones`—, que también son superficie de
primitiva y también heredan la dirección.

**33 unidades, no 24.** Se corrige aquí y en el plan.

### Los dos denominadores, que no se contradicen

En este documento aparecen **33** y **29**, y son dos cosas distintas:

```
25 componentes .tsx
 −  4 sin CSS propio    ClusterNodeSelect · Confirm · Icon · Notifier
 = 21 CSS de componente
 +  8 CSS compartidos   count · interaccion · kv · list · record · rotulo · text · tones
 = 29 módulos .module.css   ← el denominador de la MEDICIÓN de px

25 componentes + 8 CSS compartidos = 33 unidades  ← el denominador de la CLASIFICACIÓN
```

Los cuatro sin CSS no salen en la medición de px porque no tienen dónde tenerlos:
`Icon` son SVG, `Confirm` y `Notifier` envuelven a `Dialog` y `Alert`, y
`ClusterNodeSelect` usa los campos de `Field`. **Sí entran en la clasificación**,
porque una primitiva sin CSS propio hereda igual la dirección.

## La línea base medida, antes de tocar nada

La regla que `tokens.css` se puso a sí mismo es que **en un `.module.css` no se
escribe un px que no sea token**. Medido hoy:

**37 px sueltos en 12 de los 29 módulos CSS** —21 de componente y 8 compartidos— (sin contar `0`, `1px` de filete, ni lo
que sale de un `var()`). La consolidación anterior hizo su trabajo: lo que queda
es acotado y casi todo tiene explicación.

| Módulo | Sueltos | Qué son |
|---|---|---|
| `Dialog` | 11 | Los cuatro anchos —440/560/720/880— y el `calc(100vh - 64px)`. **La fase 1 los confirmó**: no son deriva, son decisión sin declarar |
| `Check` | 7 | `min-height: 26px` y **`max-width: 720px`** para la prosa |
| `Form` | 5 | `210px` y `180px` como ancho de la columna de rótulo. **NO es deriva** — ver la corrección de abajo |
| `PanelForm` | 3 | `max-width: 560px`, `.tdel { width: 74px }` |
| `Alert`, `Pagination`, `Table`, `Menu` | 2/2/2/1 | alturas mínimas de destino táctil |

**Un hallazgo, no dos. Y la corrección importa más que el hallazgo:**

> ### ⚠ Corregido el 2026-09-03: los 210/180 de `Form` NO son deriva
>
> Esta auditoría los declaró «la misma idea resuelta dos veces». **Es falso**, y el
> error es de método: salieron de un **grep de px sueltos** y se clasificaron sin
> abrir el fichero. `Form.module.css:23` lo dice literalmente —*«Inside a modal
> there is less room and fewer rows: no separator, no 210 px»*— y la distinción va
> atada a la prop `modal`: **`.row` es 210 y `.mrow` es 180**, dos contextos
> distintos a propósito.
>
> Es exactamente el fallo que esta fase lleva corrigiendo en otros sitios: **una
> cifra sin su inventario, o una clasificación sin su lectura**. Aquí lo cometió la
> auditoría misma.
>
> Consecuencia para la fase 2: **la geometría del modal no se toca**, y `--help-col`
> se aplica **sólo a `.row`**. El piloto 3 dibujó un formulario denso, no un
> diálogo; autoriza la tercera columna donde midió, y no en los 560 px de ancho de
> un modal.

1. **`720px` aparece siete veces** como ancho máximo de prosa. La fase 1 declaró
   `--notice-max: 880px` para un aviso y `--help-col: 360px` para la ayuda: hay
   que decidir cuál de los dos es cada uno de esos siete, o si sobrevive un
   tercero — pero ya no puede quedarse sin nombre.

## La clasificación

**Con evidencia: 11 a retocar.** Cada una porque una decisión concreta de fase 1
la toca, y se dice cuál.

| Primitiva | Usos | Qué decisión la toca |
|---|---|---|
| **`PanelForm`** (337 lín.) | 3 | La que más. Ayuda a tercera columna (`--help-col`), `Warning!` antes y `Note!` después, filete ámbar del maestro, barra pegajosa abajo, anchos de control (`--ctrl-num`, `--area-min`) |
| **`Table`** (200) | 18 | El icono de ordenación sólo al puntero o al foco y la columna que ordena en ámbar; filas atenuadas a `--dim` con el dato caducado |
| **`Alert`** (58) | 19 | `Warning!` relleno **en `--warn`** con triángulo, `Note!` sin relleno en `--info` con círculo. ⚠ **Corregido el 2026-09-03: aquí decía `--dan`, y es falso.** La fase 1 decidió **posición y tratamiento**, no reasignar la semántica del color: `--dan` queda reservado para error, validación y acción destructiva. Un `Warning!` en rojo habría hecho que la advertencia y el fallo se pintaran igual, que es el defecto que esta misma primitiva registra haber arreglado |
| **`Empty`** (59) | 24 | Exporta los tres estados. **Discontinuo = vacío, continuo = error**. ~~Y `Loading` estrena `--dim`~~ — **corregido al implementarlo el 2026-09-02**: `--dim` significa «esto está aquí y no es actual», y es para el **dato anterior** mientras se refresca. El slot de `Loading` no tiene dato anterior dentro; atenuarlo diría algo que no es cierto. La regla del piloto 1 es de pantalla, no de esta primitiva |
| **`Field`** (71) | 33 | El mensaje de validación **junto a su campo**, no arriba |
| **`Form`** (74) | 10 | La fila rótulo·control·ayuda. ⚠ **Corregido el 2026-09-03: aquí decía «la deriva de 210/180», y no es deriva** — ver el bloque de abajo. `Form` los distingue a propósito según `modal` |
| **`Dialog`** (77) | 31 | Declarar los cuatro anchos, y `--dim` en el de debajo cuando se apila |
| **`Button`** (36) | 43 | *Deshabilitado, nunca escondido*, y el candado que dice **qué** permiso falta |
| **`Icon`** (243) | 2 | Los dos tamaños, `--ico` y `--ico-rail` |
| **`Check`** (49) | 1 | «El control es su rótulo», y el `720px` sin nombre |
| **`EditableTable`** (35) | 2 | El patrón de fila repetible que cerró el piloto 2 |

**Las 14 restantes, leídas y clasificadas.** Cuatro salen a *retocar* y diez a
*mantener*.

### Las cuatro que sí toca la fase 1

| Primitiva | Usos | Qué decisión la toca |
|---|---|---|
| **`Panel`** (86 lín.) | 6 | Es la caja con borde de la consola, y el piloto 3 decidió que **la sección es una caja con su rótulo pegajoso y su recuento**. Aquí aterriza |
| **`SectionHeader`** (83) | 19 | Ya tiene la ruta sobre el título (`DHCP ›` / `Leases`). El piloto 3 **saca las nueve subpestañas del lateral y las pone sobre el título a todos los anchos**: es este componente |
| **`Tag`** (31) | 12 | Declara cinco tonos y la regla de que **una pastilla dice UN estado**. El piloto 3 estrena una que dice de qué interruptor depende un control: o es un sexto tono, o es primitiva nueva y lo decide la 2.2 |
| **`Details`** (24) | 2 | ⚠ **Resuelto el 2026-09-03, y la pregunta estaba mal hecha.** Decía que `Details` pintaba «un tercer tamaño de icono»; medido, `size={12}` tiene **nueve** sitios en cinco módulos —`Details`, `SectionHeader`, `Menu`, `Table`, `Tree`— y **los nueve son un chevron o la flecha de ordenación**. No es un tamaño suelto suyo: es **el chevron en línea**. Se justifica como excepción y no se nombra. Mismo error de método que los 210/180: clasificar desde un fichero sin mirar los otros cuatro |

### Las diez que no

`ClusterNodeSelect` · `Confirm` · `Externo` · `FooterLinks` · `Menu` ·
`Notifier` · `Pagination` · `Segmented` · `Select` · `SessionCells`

Cuatro merecen una línea porque **parecía que les tocaba y no**:

- **`Confirm`** y **`Pagination`** ya cumplen lo que decidió el piloto 2 —`Cancel`
  con el pie en su orden, y `Last` a cualquier ancho—. Comprobado leyéndolas.
- **`Menu`** ya trae el `Separator`, y la regla de que **lo destructivo vive
  dentro del menú** está escrita en su propia cabecera desde antes del piloto 2,
  que la confirmó en vez de cambiarla.
- **`ClusterNodeSelect`** ya condiciona su dibujo a `clusterInitialized`, que es
  justo lo que el piloto 2 tuvo que pedir que se declarara.

**`Segmented` queda marcada para la 2.2**, no para retocar: el índice de secciones
que el piloto 3 convierte en tira de pastillas por debajo de `--bp-index` se le
parece mucho, y hay que decidir si es ella, una variante suya o un `SectionIndex`
aparte.

## Recuento final de la 2.1

**15 a retocar · 18 a mantener · 0 a reemplazar**, sobre las 33 unidades — 25
componentes y los 8 CSS compartidos, que se mantienen todos porque ninguno
declara forma, sólo la comparten.

Que la dirección no obligue a tirar **ninguna** primitiva es el resultado de que
los tres pilotos se dibujaran **contra el contrato de estas pantallas** y no
contra un moodboard.

## Una advertencia de secuencia para la 2.3

`dev/uniformity.js` responde si el mismo objeto se pinta igual en todas las
pantallas, y la 2.3 dice que **no puede empeorar**. Para eso hace falta la foto
de **antes**, y hoy no está tomada.

Es un tool de navegador (`await firmas()`) y necesita sesión en el harness. **La
línea base se toma antes de tocar la primera primitiva**, o la 2.3 se queda sin
nada contra lo que comparar. Es lo primero de la fase, antes que cualquier
cambio.

## Lo que esta auditoría NO hace

- **No reabre dirección.** Donde la fase 1 decidió, aquí sólo se anota quién lo
  implementa.
- **No decide primitivas nuevas**: eso es la 2.2, y cada candidata hay que
  justificarla o tirarla.
- **No toca ningún fichero.** Es una pasada de lectura y medición.


## Reconciliación de las 15 — 2026-09-03

La fase 2 tocó **cinco** de las quince. Las otras diez no desaparecen del
inventario: cada una queda como **ya cumplía** (con la línea citada) o **aplazada
a una superficie concreta** del recorrido, por ser cableado de pantalla y no
trabajo de primitiva.

Está en [`fase2-reconciliacion-de-las-15.md`](fase2-reconciliacion-de-las-15.md).

Y no se cuenta por primitiva sino **por decisión**, porque esta auditoría no asignó
una a cada una: a `PanelForm` le asignó cinco. Son **26 decisiones** sobre las 15
primitivas — **6 implementadas · 7 ya cumplían · 11 aplazadas · 2 anuladas**.
Contar por primitiva escondía que a `PanelForm` le falta el filete ámbar del
maestro.

De las dos disyuntivas que esta auditoría dejó abiertas, **una queda resuelta y la
otra a medias**: el chevron de `Details` se justifica como el chevron en línea —la
pregunta estaba mal hecha, tiene nueve sitios de llamada en cinco módulos—; el
sexto tono de `Tag` sigue sin decidir, acotado a dos opciones y aplazado a la
superficie donde la pastilla se dibujará por primera vez.
