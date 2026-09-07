# Piloto 2 — el contrato de Zones

Tomado el **2026-09-02** con `dev/screen-contract.mjs` contra la instancia `dev`
del harness, con seis zonas reales de los tipos Primary, Secondary, Forwarder y
Catalog. Es la lista de lo que **no se puede perder**, y viaja al prompt entera:
lo que se resume es lo que desaparece.

> El volcado crudo salió `state: populated`, 11 campos y 38 botones. Los dos
> defectos que la primera pasada destapó en la propia herramienta —nombres
> perdidos y el dato leído como estado— están arreglados y verificados; sin eso,
> siete de estos once campos habrían viajado sin nombre.

> **Corregido el 2026-09-02, tras una revisión externa que encontró ocho fallos y
> tenía razón en los ocho.** Dos causas, y las dos vale la pena dejarlas escritas:
>
> 1. **Un contrato tomado de la pantalla no ve lo que el harness no puede
>    dibujar.** El selector de nodo de cluster no aparecía porque
>    `clusterInitialized` es falso en una instancia suelta, así que no se dibuja
>    nada. Es exactamente la trampa que la spec F10 documenta —«por eso es
>    invisible en cualquier instalación de un servidor, y por eso llevaba perdido
>    sin que nadie lo notara»— y volvió a morder. **El contrato se toma de la
>    pantalla Y del código**, no de una de las dos.
> 2. **Importé hallazgos de la lista B como si fueran del código.** La auditoría
>    1.1 describe el **proyecto de diseño**: allí no hay señal de ordenación, ni
>    errores de validación, ni diálogo con altura máxima. En el código las tres
>    cosas están. Un hueco del dibujo no es un hueco de la consola.

## Lo que hay, sin orden visual

### La barra de filtros — cuatro controles y un verbo

| Control | Tipo | Opciones / ayuda |
|---|---|---|
| `Name` | texto | Marcador de posición, **literal**: `abc or a* or *b* or a?c` |
| `Type` | select | Vacío (todos) · `Primary` · `Secondary` · `Stub` · `Forwarder` · `SecondaryForwarder` · `Catalog` · `SecondaryCatalog` |
| `Page Number` | texto, monoespaciada | `Enter` aplica los filtros |
| `Zones Per Page` | select | `10` · `25` · `50` · `100` · `250` · `500` |
| `Go` | botón primario | Aplica los cuatro de arriba |

### El selector de nodo de cluster — cromo, y la parte que más fácil se pierde

Vive en `Zones.tsx:118`. **No se dibuja nada si el servidor no reporta
`clusterInitialized`**, que es por lo que no salió en el primer volcado: el
harness es una instancia suelta.

- Zones **no ofrece el agregado «Cluster»**: arranca en este servidor. Sólo
  Dashboard y Settings ofrecen el agregado.
- **No recuerda la elección** entre visitas; sólo Dashboard y Settings lo hacen.
- Cada nodo se lista como `nombre (tipo)`, el tipo en minúscula.
- **Cambia el significado de toda la pantalla**: las zonas que se listan son las
  de ese nodo.

### Los dos verbos de la pantalla

`Add Zone` (primario) y `Delete Zones` (destructivo). **`Delete Zones` opera sobre
lo marcado con las casillas**, no sobre una selección aparte: esa es la relación
que ata la columna de casillas al botón, y sin ella la columna no se explica.

### La tabla — diez columnas

`(casillas)` · `#` · `Zone` · `Type` · `DNSSEC` · `Status` · `Serial` · `Expiry` ·
`Last Modified` · `(acciones)`

**Ordenan siete** —`Zone`, `Type`, `DNSSEC`, `Status`, **`Serial`**, `Expiry` y
`Last Modified`— y tres no: las casillas, `#` y la columna de acciones.

**Y la ordenación sí tiene gesto y marca**, al contrario de lo que decía la
primera versión de este contrato: `ui/Table.tsx:144` da a cada cabecera ordenable
un `<button>` con `aria-sort`, el icono `sort` en reposo y `chevronDown` con
`data-desc` cuando esa columna está ordenando. Lo que no hay es señal en una
**captura estática**, que es otra cosa. El hueco de la lista B era del proyecto de
diseño, no del código.

La celda de zona lleva el nombre como botón que abre sus registros y, debajo y
sólo cuando aplica, **la etiqueta de pertenencia a catálogo** (`ZoneList.tsx:557`).
`Unsigned` **no** va ahí: va en la columna `DNSSEC`, que nunca queda en blanco y
distingue tres estados con tres textos —`Unsigned`, `Signed` y `Signed, no keys`—
porque una zona firmada sin claves privadas no es lo mismo que una firmada.

### Selección

`Select all zones` en la cabecera y `Select <zona>` en cada fila. Se desmarcan
solas en cada refresco. **Hoy no hay barra de selección**: nada dice cuántas hay
marcadas ni ofrece lo que se puede hacer con ellas — es uno de los huecos que la
lista B señala para este arquetipo.

### Las acciones de fila, y lo que las condiciona

Dos botones sueltos y un menú. **Lo que aparece depende del tipo de zona**, y eso
es lo que hace que esta pantalla no se pueda dibujar con una fila de ejemplo:

| Acción | Dónde | Sólo si |
|---|---|---|
| `Zone Options` | botón de fila | el tipo la admite |
| `Enable Zone` / `Disable Zone` | botón de fila | el mismo icono para los dos estados: cuál toca lo dice `Status`, tres columnas a la izquierda |
| `Edit Zone` | menú | siempre |
| `Resync` | menú | `Secondary`, `SecondaryForwarder`, `SecondaryCatalog`, `Stub` |
| `Import Zone` | menú | `Primary`, `Forwarder` |
| `Export Zone` | menú | todos menos `Stub` |
| `Convert Zone` | menú | todos menos `Stub` y `Catalog` |
| `Clone Zone` | menú | `Primary`, `Forwarder` |
| `Permissions` | menú | siempre |
| `Delete Zone` | menú, tras separador y en rojo | siempre |

**`Delete Zone` está en el menú a propósito, y la razón está escrita en el
código**: una fila no es una pantalla de detalle. Allí se actúa sobre un objeto
que se está mirando; aquí sobre una de doscientas cuarenta, con `Disable` al lado
y sin deshacer en ninguna parte de esta consola.

## La vista de registros, que es parte de esta superficie

El plan dice **«Zones *(+ its records view)*»** y la primera versión de este
contrato la omitió. Es la mitad de la superficie, y varios diálogos **sólo se
alcanzan desde ahí**.

- **Título:** el nombre de la zona. Migas: `Zones` a la izquierda.
- **Filtros:** `Name`, `Type` y `Records Per Page`. El filtro de nombre tiene tres
  reglas replicadas de upstream y escritas en `filter.ts`: sin comodín la
  comparación es **exacta**, `@` es el ápex, y un filtro que empieza por `*` busca
  el comodín **literal**.
- **Tabla, seis columnas:** `#` · `Name` · `Type` · `TTL` · `Data` y la de
  acciones. La celda `Data` es de altura variable y lleva `show full` cuando el
  valor no cabe.
- **Verbos:** `Add Record`, `Enable`/`Disable Zone`, `Delete Zone`, y **dos
  menús**: uno de zona (**`Resync`**, `Import`, `Export`, `Convert`, `Clone`,
  `Zone Options`, `Permissions`) y otro **`DNSSEC`** (`Sign Zone`,
  `Show`/`Hide DNSSEC Records`, `View DS Info`, `DNSSEC Properties`,
  `Unsign Zone`).

  > **Corregido el 2026-09-02**, al recorrer el piloto 2. Esta lista omitía
  > `Resync`, que en `ZoneRecords.tsx:371-378` es el **primer** elemento del menú
  > de zona, condicionado al tipo igual que en la lista — y es el que dispara el
  > `Confirm` de `ZoneRecords.tsx:285` que este mismo contrato sí lista. La
  > omisión viajó a Claude Design dentro del prompt del piloto 2.
- **Acciones de fila:** `Edit Record`, `Disable Record` y un menú por registro.
- **Paginación numerada** con `Next` y `Last`.

## Los diálogos: once, más `Confirm`

`AddZone` · `AddEditRecord` · `CloneZone` · `ConvertZone` · `DnssecProperties` ·
`ImportZone` · `SignZone` · `UnsignZone` · `ViewDs` · `ZoneOptions` ·
`ZonePermissions`.

**Y `Confirm`, que la primera versión olvidó** y es el patrón modal más repetido:
**quince** contratos distintos sólo en Zones, y en **tres** sitios y no en dos:

- **Cuatro en la lista** — `Disable Zone`, `Delete Zone`, `Resync Zone`,
  `Delete Zones`.
- **Cinco en la vista de registros** — `Disable Record`, `Delete Record`, y otra
  vez `Disable Zone`, `Delete Zone` y `Resync Zone`, que existen en las dos
  vistas. **Los dos primeros son los únicos que actúan sobre un registro** y no
  sobre una zona.
- **Seis en `DNSSEC Properties`** — `Delete Private Key`, `Activate KSK`,
  `Rollover DNS Key`, `Retire DNS Key`, `Publish All Keys`,
  `Change Proof of Non-Existence`.

**Dónde se abre cada uno importa**, porque determina qué hay que dibujar en qué
maqueta: `Zone Options` se abre **desde las dos** vistas (`Zones.tsx:146` y
`:180`); `DNSSEC Properties`, `Sign`, `Unsign` y `View DS` **sólo desde la vista
de registros** (`:184`); y el único caso de **diálogo que abre diálogo** es
**`DNSSEC Properties` → `Confirm`**, no `Zone Options` → `DNSSEC Properties`.

**Vienen con esta pantalla y no son una parada aparte del recorrido.** Es la
decisión de plan que más pesa aquí: el sistema modal se resuelve en el piloto 2 y
todo lo que venga después lo hereda.

### Lo que el sistema modal ya tiene resuelto en el código

Escrito aquí para que el piloto **no lo vuelva a inventar ni lo dé por ausente**:

- **Altura máxima y cuerpo que rueda**: `.content` va a
  `max-height: calc(100vh - 64px)` con `overflow: hidden`, y `.body` a
  `overflow-y: auto` (`Dialog.module.css:37,96`).
- **Cuatro anchos, y ninguno fijo**: `min(440|560|720|880px, calc(100vw - 32px))`.
  A 390 px ya encogen solos.
- **Errores de validación**: existen. `AddZone.tsx:86-91` los saca como aviso
  `warning` con título y texto, **y lleva el foco al campo** que falla.

Lo que sigue abierto del sistema modal es más fino, y es lo que hay que decidir:
dónde va el mensaje de validación **respecto al campo** —hoy es un aviso arriba y
no una marca junto al control—, y cómo se comporta el apilamiento cuando
`DNSSEC Properties` abre su `Confirm`.

### Los estados y las variantes por permisos

`populated` · `empty` · `loading` · `error`, y dos variantes de permiso que
cambian el dibujo, no sólo lo que se puede pulsar:

- **sin `canModify`**: `Add Zone`, `Zone Options`, `Enable`/`Disable`, `Resync`,
  `Import`, `Convert` y `Clone` quedan deshabilitados.
- **sin `canDelete`**: `Delete Zones` y `Delete Zone` quedan deshabilitados.

## Dónde difiere upstream

**Una diferencia conocida y deliberada, y está justo en esta pantalla.** Upstream
tiene **dos** selectores de nodo aquí —`optZonesClusterNode` para la lista y
`optEditZoneClusterNode` para la vista de registros— y **aquí son uno solo**, con
estado compartido (`docs/phase0-upstream-diff.md:474`). Upstream puede así leer la
lista en un nodo y los registros de una zona en otro; esta consola no. Se decidió
que preguntar dos veces lo mismo en una pantalla es peor interfaz que preguntarlo
una, y quedó anotado en vez de escondido. **El piloto tiene que saberlo antes de
dibujar el selector.**

Fuera de eso, `dev/check-parity-controls.mjs` (2026-09-02) da verde: los **28**
destinos de upstream presentes, sus **112** textos de ayuda y sus **94** ejemplos.
**Lo que ese verde no dice**, y lo documenta él mismo: busca en todo el código y
no en esta pantalla, así que un texto que exista en dos sitios y se caiga de uno
no lo detecta; no dice si un destino presente en las dos apunta a lo mismo; y no
dice si un botón que existe en las dos hace lo mismo —eso es
`check-parity-actions.sh`, que compara el estado del servidor—. «No difiere en
nada» era demasiado fuerte y queda retirado.

## Una corrección al plan

El bucle dice «`contract()` v2 sobre la nuestra y sobre `ref`». **No se puede**:
`contract()` busca un `<main>` y la consola de serie es Bootstrap 3, no lo tiene,
así que ahí devuelve `{error: 'no main element'}`. Quien compara contra upstream
es `check-parity-controls.mjs`, por lista y sin navegador, leyendo el `index.html`
de upstream contra nuestro código fuente. La frase del plan queda corregida.
