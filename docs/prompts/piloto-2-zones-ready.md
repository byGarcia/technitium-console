# Piloto 2 — Zones, y el sistema modal que hereda toda la consola

> **Dónde va:** proyecto **«technitium-ui — consola DNS»** en Claude Design.
> Lee antes `13-iconos-y-color.html` (los iconos y la paleta, ya decididos) y
> `12-piloto-dashboard.dc.html` (el piloto 1 corregido: de ahí salen el cromo, el
> raíl, el cajón, el foco visible y las reglas de vacío, carga y error).
>
> Es un piloto de la Fase 1: decide dirección, no entrega pantalla.

## La regla que gobierna todo

**Sólo diseño, cero funcionalidad.** Mismos controles, mismos textos, mismos
pasos. Reorganiza, reagrupa, cambia densidad, jerarquía y qué componente lleva
qué. No quites un control, no reescribas una etiqueta, no añadas un paso, no
inventes una ruta.

Los tooltips sólo pueden presentar un nombre que ya existe. Nunca explican algo
nuevo ni sustituyen a una etiqueta visible.

### La excepción, autorizada y acotada

Esa regla y lo que se pide más abajo se contradicen si no se dice esto: **hay
cuatro sitios donde SÍ se autoriza añadir superficie**, porque en los cuatro falta
la forma de decir algo que la pantalla ya hace o ya sabe.

| Autorizado | Por qué no es funcionalidad nueva |
|---|---|
| Un **contador de selección** y su barra | La selección ya existe y `Delete Zones` ya opera sobre ella; hoy no hay dónde leer cuántas hay |
| Una **salida del vacío** cuando hay filtro | Limpiar el filtro ya se puede, borrando el campo. Es un atajo a algo existente, no un paso nuevo |
| Una **marca de dato caducado** | El fallo ya se comunica; lo que falta es decir que lo de debajo ya no vale |
| El **mensaje de validación junto a su campo** | El mensaje ya existe y ya lleva el foco al campo; lo que se decide es dónde se dibuja |

Fuera de esos cuatro, nada nuevo.

**De los textos:** propón el de esos cuatro y **márcalos como propuestos**, en una
lista aparte al final. Todo lo demás va literal. Un texto inventado que se cuela
sin marcar es una decisión de producto tomada por descuido.

## Por qué esta pantalla es el piloto 2

Es la #2 del menú y es el arquetipo **colección**, que se repite cinco veces
seguidas (Zones, Cache, Allowed, Blocked, Apps). Lo que se decida aquí lo heredan
las otras cuatro.

Y arrastra **once diálogos**, que no son una parada aparte del recorrido: el
sistema modal se resuelve aquí y todo lo que venga después lo hereda.

## Lo que hay que decidir aquí, y no en otro sitio

### De la colección

1. **Diez columnas que no caben.** A 1024 ya van justas y a 390 no entran. Qué
   se apila, qué se esconde y **qué no se esconde nunca**.
2. **Qué aspecto tiene seleccionar filas.** Hay casilla por fila, una de
   seleccionar todo y un `Delete Zones` que opera sobre lo marcado — y **nada
   dice cuántas hay marcadas**. No hay barra de selección. Es el hueco que la
   lista B señala literalmente.
3. **Ordenar por columna.** **Siete** de las diez ordenan, `Serial` incluida. El
   gesto y la marca **ya existen** —`aria-sort`, icono `sort` en reposo y
   `chevronDown` en la activa—, así que esto **no es un hueco que rellenar sino
   una decisión de peso visual**: siete cabeceras con icono en una tabla de diez
   columnas es mucho ruido si el icono se ve siempre. Decide cuándo aparece.

3 bis. **El selector de nodo de cluster.** Es cromo y **cambia qué zonas se
   listan**. No se dibuja si el servidor no reporta cluster; aquí **no** ofrece el
   agregado «Cluster» ni recuerda la elección, al contrario que en el Dashboard.
   Y **es uno solo para la lista y para la vista de registros**, mientras upstream
   tiene dos: esa es la única diferencia de comportamiento conocida en esta
   pantalla, deliberada, y el dibujo tiene que sostenerla.
4. **La cabecera al hacer scroll.** Con 500 zonas por página —es una de las
   opciones— la cabecera se va y las diez columnas se quedan sin rótulo.
5. **Una fila a 390 px**, que hoy no está resuelta.

### De los estados, que es donde esta pantalla está peor

El baseline los tiene capturados y **los tres están mal, en la misma dirección**:

6. **Cargando no existe.** `busy` deshabilita botones y nada más: la tabla
   mantiene las filas anteriores sin marca. El piloto 1 ya decidió la regla —el
   dato anterior a `opacity:.42` y una barra ámbar de 3 px colgando del control
   que provocó la espera—; aplícala aquí, o di por qué una tabla necesita otra.
7. **El error se lee como éxito.** Sale la alerta arriba y **la tabla sigue
   enseñando seis zonas como si fueran actuales**. En el Dashboard el fallo se
   pintaba como «no hay nada que contar»; aquí se pinta como «aquí están tus
   datos». Hace falta decidir **cómo se marca que lo que se ve ya no es válido**,
   que es un caso que el piloto 1 no tuvo: allí la superficie que fallaba se
   sustituía entera, y aquí hay datos viejos que siguen en pantalla.
8. **Vacío es una línea suelta.** `No Zone Found` centrado en una celda, sin usar
   `ui/Empty` —el vacío que este proyecto sí tenía resuelto, con su caja
   discontinua, su frase y su salida—. Y **la misma línea aparece cuando el
   filtro no encuentra nada y cuando el servidor no tiene zonas**, que son cosas
   distintas: la primera tiene salida (limpiar el filtro) y hoy no se ofrece.

### Del sistema modal

**Tres cosas ya están resueltas en el código y no hay que rehacerlas ni darlas
por ausentes**: la altura máxima con cuerpo que rueda
(`max-height: calc(100vh - 64px)`, `.body { overflow-y: auto }`), los cuatro
anchos que ya encogen solos a 390 px (`min(440|560|720|880px, calc(100vw - 32px))`)
y los errores de validación, que existen y además llevan el foco al campo.

Lo que queda abierto, que es más fino:

9. **Dónde va el mensaje de validación respecto a su campo.** Hoy es un aviso
   arriba del diálogo y el foco salta al control; el aviso y el campo no están
   unidos por nada visible. Con un formulario largo, el mensaje queda fuera de
   pantalla mientras se mira el campo.
10. **Un diálogo que abre otro**, y el caso real es **`DNSSEC Properties` →
    `Confirm`**. Qué pasa con el de debajo: se queda, se atenúa, se apila.
11. **`Confirm` como patrón**, que es el modal más repetido de la consola:
    **quince contratos distintos sólo en Zones**, en tres sitios: cuatro en la
    lista, **cinco en la vista de registros** —dos de ellos sobre un registro y no
    sobre una zona— y seis en DNSSEC Properties. Uno de ellos, `Delete Zones`, actúa sobre una selección
    múltiple y tiene que decir sobre cuántas.
12. **Qué anchura le toca a cada uno de los once**, ahora que hay cuatro y no una.

## Todo lo que hay en la pantalla, y tiene que seguir estando

**Inventario sin orden visual y con sus relaciones**: el orden y la agrupación
son lo que se está pidiendo decidir, así que no se entregan como entrada.

Los contratos completos son **dos ficheros** y los dos van enteros:

- `docs/direction/piloto-2-contrato-zones.md` — la lista y la vista de registros.
- `docs/direction/piloto-2-dialogos.md` — los once diálogos y los quince usos de
  `Confirm`. Se genera desde el AST, lleva las resoluciones manuales declaradas y
  se contrasta con aperturas limpias y **50 estados variantes reales** del DOM.

La reconciliación está en `docs/direction/piloto-2-reconciliacion.md`: da cero
diferencias de **nombres** en los estados capturados. No se presenta como una
prueba de toda la lógica de ramas; esa limitación queda escrita en el informe.

**Y van pegados enteros más abajo, en este mismo documento**: Claude Design no ve
este repositorio, así que una referencia a una ruta sería una referencia a nada.
Las capturas del baseline se adjuntan aparte. En titulares:

- **Barra de filtros:** `Name` (marcador literal `abc or a* or *b* or a?c`),
  `Type` (vacío + los siete tipos de zona), `Page Number` (Enter aplica),
  `Zones Per Page` (10/25/50/100/250/500) y `Go`.
- **Verbos de pantalla:** `Add Zone` y `Delete Zones`, este último atado a las
  casillas.
- **Tabla:** casillas · `#` · `Zone` · `Type` · `DNSSEC` · `Status` · `Serial` ·
  `Expiry` · `Last Modified` · acciones. **Ordenan siete**, `Serial` incluida, y
  el gesto y la marca ya existen. La celda de zona lleva el nombre como botón que
  abre los registros y, sólo cuando aplica, **la etiqueta de pertenencia a
  catálogo**; `Unsigned` **no** va ahí, va en la columna `DNSSEC`, que nunca queda
  en blanco y distingue tres estados con tres textos.
- **Acciones de fila:** `Zone Options` y `Enable`/`Disable` sueltas, y un menú con
  `Edit Zone`, `Resync`, `Import`, `Export`, `Convert`, `Clone`, `Permissions` y,
  tras separador y en rojo, `Delete Zone`. **Cuáles aparecen depende del tipo de
  zona** — la tabla de condiciones está en el contrato, y es la razón por la que
  esta pantalla no se puede dibujar con una fila de ejemplo.
- **Selector de nodo de cluster**, condicional y sin agregado.
- **La vista de registros**, que es la otra mitad de esta superficie: sus tres
  filtros, sus **seis columnas** —cinco de datos más la de acciones— con la celda
  `Data` de altura variable y su
  `show full`, sus dos menús —el de zona y el de `DNSSEC`— y su paginación.
- **Once diálogos más `Confirm`:** `AddZone`, `AddEditRecord`, `CloneZone`,
  `ConvertZone`, `DnssecProperties`, `ImportZone`, `SignZone`, `UnsignZone`,
  `ViewDs`, `ZoneOptions`, `ZonePermissions`. Cuáles se abren desde la lista y
  cuáles sólo desde los registros está en el contrato, y decide qué maqueta lleva
  cada uno.
- **Add Record no tiene “19 tipos” fijos:** ofrece 18 o 19 según la zona; la unión
  de ramas del componente cubre 23 tipos, y `SOA` sólo aparece al editar.
- **Dos variantes por permisos:** sin `canModify` y sin `canDelete`.

## Los estados que hay que contestar

`populated` · `loading` · `error` y **dos vacíos distintos**:

- **sin resultados**, porque el filtro no encuentra nada — tiene salida;
- **sin zonas**, porque el servidor no tiene ninguna — no la tiene, y lo que
  procede es la que las crea.

Hoy los dos dan la misma línea, y ese es el hallazgo. El baseline está adjunto.

## Dónde difiere upstream

**En una cosa, y cae justo aquí:** upstream tiene **dos** selectores de nodo en
esta superficie —uno para la lista y otro para los registros— y aquí son **uno
solo**, con estado compartido. Es deliberado y está anotado; el dibujo tiene que
sostenerlo.

En lo demás, `check-parity-controls.mjs` da verde —28 destinos, 112 textos de
ayuda, 94 ejemplos—, con el límite que el propio comprobador declara: busca en
todo el código y no pantalla a pantalla.

## Qué devolver

A **1440 y 390**, con todo lo de arriba colocado:

1. **Una maqueta por estado**: poblado, los **dos** vacíos, cargando y error.
2. **Las dos variantes por permisos**, y basta con **una maqueta con las dos
   superpuestas** —marcando qué cae con `canModify` y qué con `canDelete`— si el
   reparto no cambia.
3. **La fila, dibujada cuatro veces**, una por familia de acciones, porque el menú
   cambia con el tipo: `Primary`/`Forwarder` (con `Import` y `Clone`), `Secondary*`
   (con `Resync`), `Stub` (sin `Export` ni `Convert`) y `Catalog`.
4. **La vista de registros**, poblada, con sus dos menús abiertos.
5. Del sistema modal, **un diálogo de cada forma que haga falta** —no los once—,
   el caso anidado `DNSSEC Properties → Confirm`, y un `Confirm` de selección
   múltiple. Más **las reglas escritas**, que es lo que heredan las demás
   pantallas.
6. **Una línea por decisión de agrupación**, diciendo qué mantiene unido a cada
   grupo.
7. **La lista de textos propuestos**, aparte y marcada como tal.

---

# ANEXO A — contrato completo de lista y registros

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
  menús**: uno de zona (`Import`, `Export`, `Convert`, `Clone`, `Zone Options`,
  `Permissions`) y otro **`DNSSEC`** (`Sign Zone`, `Show`/`Hide DNSSEC Records`,
  `View DS Info`, `DNSSEC Properties`, `Unsign Zone`).
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

---

# ANEXO B — contrato completo de diálogos

# Piloto 2 — los diálogos de Zones, leídos del fuente

**Generado de forma reproducible desde el AST** por `dev/dialog-contract-doc.mjs`
sobre `dev/static-contract.mjs`, que lee el código con el parser de TypeScript,
**y completado con resoluciones manuales auditables**.

Las manuales son dos y están declaradas en tablas del propio generador, no
diluidas en la prosa, para que una equivocada se vea: `OPENED_FROM` —de dónde
se abre cada diálogo, que su fuente no dice— y `RESOLVED_BY_HAND` —los valores
que el AST ve pero no evalúa: un ternario, una prop hilada a un bloque que se
instancia dos veces, una etiqueta que llega a un ayudante local—. La tercera
fuente, declarada aparte, es `dialog-variants.json`: los estados abiertos de
uno en uno en el navegador para comprobar las ramas que el AST no debe fingir
que entiende.

## Lo que este documento SÍ garantiza, y lo que no

El lector reconoce exactamente esto:

- onConfirm({ title, text, label, danger }) — top-level properties only
- const NAME = [ … ] — array elements, objects counted as objects
- literal JSX label attributes, aria-labels and native <label><input>text</label>
- local helpers whose first argument is threaded into a JSX label
- MATRIX.map() and options={MATRIX} bindings to their surrounding control
- <Dialog> title, size, footer actions and close label
- literal help, prose, section headings, definition terms and outgoing links
- tab === 'literal' — the branches of a tab strip

Dentro de esas formas, lo que no puede resolver lo dice. **Fuera de ellas no
mira**, así que esto es un suelo y no un techo: lo que aparece está; lo que no
aparece puede estar igualmente. Cerrar ese hueco es la lectura manual por
componente y la comprobación contra el harness, que van aparte.

## `Confirm` — quince contratos, y son el patrón más repetido de la consola

No tienen campos: **su contrato entero es la frase que preguntan**. El barrido
los reportaba como «sin campos» y seguía.

| Título | Verbo | Destructivo | Dónde |
|---|---|---|---|
| Disable Zone | `Disable` | no | `screens/zones/ZoneList.tsx:192` |
| Delete Zone | `Delete` | **sí** | `screens/zones/ZoneList.tsx:207` |
| Resync Zone | `Resync` | no | `screens/zones/ZoneList.tsx:229` |
| Delete Zones | `Delete` | **sí** | `screens/zones/ZoneList.tsx:260` |
| Disable Record | `Disable` | no | `screens/zones/ZoneRecords.tsx:197` |
| Delete Record | `Delete` | **sí** | `screens/zones/ZoneRecords.tsx:211` |
| Disable Zone | `Disable` | no | `screens/zones/ZoneRecords.tsx:250` |
| Delete Zone | `Delete` | **sí** | `screens/zones/ZoneRecords.tsx:264` |
| Resync Zone | `Resync` | no | `screens/zones/ZoneRecords.tsx:285` |
| Delete Private Key | `Delete` | **sí** | `screens/zones/modals/DnssecProperties.tsx:175` |
| Activate KSK | `Activate` | no | `screens/zones/modals/DnssecProperties.tsx:190` |
| Rollover DNS Key | `Rollover` | no | `screens/zones/modals/DnssecProperties.tsx:204` |
| Retire DNS Key | `Retire` | no | `screens/zones/modals/DnssecProperties.tsx:218` |
| Publish All Keys | `Publish` | no | `screens/zones/modals/DnssecProperties.tsx:232` |
| Change Proof of Non-Existence | `Change` | no | `screens/zones/modals/DnssecProperties.tsx:292` |

**5 invocaciones destructivas** sobre 4 acciones distintas: `Delete Zone` existe en la lista y en los registros.

### Las frases, literales

**Disable Zone** — `screens/zones/ZoneList.tsx:192`

> Are you sure you want to disable the zone '${name}'?

**Delete Zone** — `screens/zones/ZoneList.tsx:207`

> Are you sure you want to permanently delete the zone '${name}' and all its records?

**Resync Zone** — `screens/zones/ZoneList.tsx:229`

> The resync action will perform a full zone transfer (AXFR). You will need to check the logs to confirm if the resync action was successful.
> 
> Are you sure you want to resync the '${name}' zone?
>
> _cuando_ `z.type === 'Secondary'`

> The resync action will perform a full zone refresh. You will need to check the logs to confirm if the resync action was successful.
> 
> Are you sure you want to resync the '${name}' zone?
>
> _cuando_ `!(z.type === 'Secondary')`

**Delete Zones** — `screens/zones/ZoneList.tsx:260`

> Are you sure you want to permanently delete the following zones and all of their records?
> 
> ${list.join('\n')}

**Disable Record** — `screens/zones/ZoneRecords.tsx:197`

> Are you sure to disable the ${r.type} record '${name}'?

**Delete Record** — `screens/zones/ZoneRecords.tsx:211`

> Are you sure to permanently delete the ${r.type} record '${name}'?

**Disable Zone** — `screens/zones/ZoneRecords.tsx:250`

> Are you sure you want to disable the zone '${zone}'?

**Delete Zone** — `screens/zones/ZoneRecords.tsx:264`

> Are you sure you want to permanently delete the zone '${zone}' and all its records?

**Resync Zone** — `screens/zones/ZoneRecords.tsx:285`

> The resync action will perform a full zone transfer (AXFR). You will need to check the logs to confirm if the resync action was successful.
> 
> Are you sure you want to resync the '${zone}' zone?
>
> _cuando_ `zoneInfo.type === 'Secondary'`

> The resync action will perform a full zone refresh. You will need to check the logs to confirm if the resync action was successful.
> 
> Are you sure you want to resync the '${zone}' zone?
>
> _cuando_ `!(zoneInfo.type === 'Secondary')`

**Delete Private Key** — `screens/zones/modals/DnssecProperties.tsx:175`

> Are you sure to permanently delete the private key (${k.keyTag})?

**Activate KSK** — `screens/zones/modals/DnssecProperties.tsx:190`

> Are you sure you want to activate the KSK DNS Key (${k.keyTag})?

**Rollover DNS Key** — `screens/zones/modals/DnssecProperties.tsx:204`

> Are you sure you want to rollover the DNS Key (${k.keyTag})?

**Retire DNS Key** — `screens/zones/modals/DnssecProperties.tsx:218`

> Are you sure you want to retire the DNS Key (${k.keyTag})?

**Publish All Keys** — `screens/zones/modals/DnssecProperties.tsx:232`

> Are you sure you want to publish all generated DNSSEC private keys?

**Change Proof of Non-Existence** — `screens/zones/modals/DnssecProperties.tsx:292`

> Are you sure you want to change the proof of non-existence options for the zone?

---

## Los once diálogos

### `AddEditRecord`

**Dónde se abre:** **Sólo registros** · `Add Record` y `Edit Record` de fila

**Título:** `Add Record` al crear; `Edit Record` al editar

**Talla actual:** `medium` — 720 px máximo, siempre limitado a `100vw - 32px`.

**Pie:** `Save` → `Close`. El verbo va antes del descarte.

**Textos de botón encontrados (pie y cuerpo):** `Save` · `Remove` · `Add Param`

**Controles y etiquetas de grupo leídos del fuente (77):**

- `Name`  _(Field)_
- `Type`  _(Field)_
- `TTL`  _(Field)_
- `Overwrite existing records`  _(checkbox)_
- `Comments`  _(Field)_
- `Expiry TTL`  _(Field)_
- `Add reverse (PTR) record`  _(checkbox)_
- `Create reverse zone if it does not exists`  _(checkbox)_
- `Glue Addresses`  _(Field)_
- `Use Serial Date Scheme`  _(checkbox)_
- `Text Data`  _(Field)_
- `Split text into multiple character strings`  _(checkbox)_
- `Certificate Association Data`  _(Field)_
- `Param key ${i + 1}`  _(Input)_
- `Param value ${i + 1}`  _(Input)_
- `Use Automatic IPv4 Hint`  _(checkbox)_
- `Use Automatic IPv6 Hint`  _(checkbox)_
- `Protocol`  _(GroupRow)_
- `Enable DNSSEC Validation`  _(checkbox)_
- `Network Proxy`  _(GroupRow)_
- `Proxy Server Address`  _(Field)_
- `Proxy Server Port`  _(Field)_
- `Proxy Server Username`  _(Field)_
- `Proxy Server Password`  _(Field)_
- `App Name`  _(Field)_
- `Class Path`  _(Field)_
- `Record Data (if any)`  _(Field)_
- `IPv4 Address`  _(helperArg)_
- `IPv6 Address`  _(helperArg)_
- `Name Server`  _(helperArg)_
- `Primary Name Server`  _(helperArg)_
- `Responsible Person`  _(helperArg)_
- `Serial`  _(helperArg)_
- `Refresh`  _(helperArg)_
- `Retry`  _(helperArg)_
- `Expire`  _(helperArg)_
- `Minimum`  _(helperArg)_
- `Canonical Name`  _(helperArg)_
- `Domain Name`  _(helperArg)_
- `Delegation Name`  _(helperArg)_
- `ANAME`  _(helperArg)_
- `Preference`  _(helperArg)_
- `Exchange`  _(helperArg)_
- `Mailbox`  _(helperArg)_
- `TXT Domain`  _(helperArg)_
- `Priority`  _(helperArg)_
- `Weight`  _(helperArg)_
- `Port`  _(helperArg)_
- `Target`  _(helperArg)_
- `Order`  _(helperArg)_
- `Preference`  _(helperArg)_
- `Flags`  _(helperArg)_
- `Services`  _(helperArg)_
- `Regular Expression`  _(helperArg)_
- `Replacement`  _(helperArg)_
- `Key Tag`  _(helperArg)_
- `DNSSEC Algorithm`  _(helperArg)_
- `Digest Type`  _(helperArg)_
- `Digest`  _(helperArg)_
- `Algorithm`  _(helperArg)_
- `Fingerprint Type`  _(helperArg)_
- `Fingerprint`  _(helperArg)_
- `Certificate Usage`  _(helperArg)_
- `Selector`  _(helperArg)_
- `Matching Type`  _(helperArg)_
- `Priority`  _(helperArg)_
- `Target Name`  _(helperArg)_
- `Priority`  _(helperArg)_
- `Weight`  _(helperArg)_
- `URI`  _(helperArg)_
- `Flags`  _(helperArg)_
- `Tag`  _(helperArg)_
- `Authority`  _(helperArg)_
- `Forwarder`  _(helperArg)_
- `Forwarder Priority`  _(helperArg)_
- `RR Type`  _(helperArg)_
- `Value`  _(helperArg)_

**Opciones ligadas a su control:**

- `Protocol` ← `PROTOCOLOS_FORWARDER`: `DNS-over-UDP (default)` · `DNS-over-TCP` · `DNS-over-TLS` · `DNS-over-HTTPS` · `DNS-over-QUIC`
- `Network Proxy` ← `PROXY_TYPES`: `No Proxy` · `Default Proxy (default)` · `HTTP Proxy` · `SOCKS5 Proxy`
- `Type (union; actual availability depends on zone)` ← `RECORD_TYPES`: `A` · `NS` · `SOA` · `CNAME` · `PTR` · `MX` · `TXT` · `RP` · `AAAA` · `SRV` · `NAPTR` · `DNAME` · `DS` · `SSHFP` · `TLSA` · `SVCB` · `HTTPS` · `URI` · `CAA` · `ANAME` · `FWD` · `APP` · `Unknown`
- `DNSSEC Algorithm (DS)` ← `DS_ALGORITHMS`: `RSAMD5 (1)` · `RSASHA1 (5)` · `RSASHA256 (8)` · `RSASHA512 (10)` · `ECDSAP256SHA256 (13)` · `ECDSAP384SHA384 (14)` · `ED25519 (15)` · `ED448 (16)`
- `Digest Type (DS)` ← `DIGESTS_DS`: `SHA1 (1)` · `SHA256 (2)` · `SHA384 (4)`
- `Algorithm (SSHFP)` ← `SSHFP_ALGORITHMS`: `RSA` · `DSA` · `ECDSA` · `Ed25519` · `Ed448`
- `Fingerprint Type (SSHFP)` ← `HUELLAS_SSHFP`: `SHA1` · `SHA256`
- `Certificate Usage (TLSA)` ← `USOS_TLSA`: `PKIX-TA` · `PKIX-EE` · `DANE-TA` · `DANE-EE`
- `Selector (TLSA)` ← `SELECTORES_TLSA`: `Cert` · `SPKI`
- `Matching Type (TLSA)` ← `COINCIDENCIAS_TLSA`: `Full` · `SHA2-256` · `SHA2-512`

**Secciones:** `Params`

**Textos de ayuda, literales y que sobreviven tal cual:**

> Set to automatically delete the record when the value in seconds elapses since the record’s last modified time.
> Forwarders are sorted by priority value i.e. forwarder with low priority value will be queried before trying for forwarder with high priority value. Forwarders with the same priority value will be queried concurrently.

**Resoluciones manuales auditables:**

| Valor calculado | Lo que es en realidad |
|---|---|
| `Field label computed: {label} ×2` | Ayudantes locales `text(label, …)` y `dropdown(label, …)`: la etiqueta llega desde las ramas de tipo de registro. El diálogo ofrece 18 o 19 tipos según el tipo/estado de la zona; la unión del componente son 23 variantes más SOA sólo al editar. |

### `AddZone`

**Dónde se abre:** La lista · verbo de pantalla `Add Zone`

**Título:** `Add Zone`

**Talla actual:** `medium` — 720 px máximo, siempre limitado a `100vw - 32px`.

**Pie:** `Add` → `Close`. El verbo va antes del descarte.

**Textos de botón encontrados (pie y cuerpo):** `Add`

**Controles y etiquetas de grupo leídos del fuente (22):**

- `Zone`  _(Field)_
- `Zone Type`  _(GroupRow)_
- `Catalog Zone`  _(Row)_
- `Conditional Forwarder`  _(GroupRow)_
- `Initialize Forwarder (FWD) Record`  _(checkbox)_
- `Import Zone File (Optional)`  _(Row)_
- `Zone Serial`  _(GroupRow)_
- `Use SOA Serial Date Scheme`  _(checkbox)_
- `Zone Transfer Protocol`  _(GroupRow)_
- `TSIG Key Name (Optional)`  _(Row)_
- `Zone Validation`  _(GroupRow)_
- `Use ZONEMD to Validate Zone`  _(checkbox)_
- `Protocol`  _(GroupRow)_
- `Forwarder`  _(Row)_
- `Use "This Server"`  _(checkbox)_
- `DNSSEC`  _(GroupRow)_
- `Enable DNSSEC Validation`  _(checkbox)_
- `Network Proxy`  _(GroupRow)_
- `Proxy Server Address`  _(Field)_
- `Proxy Server Port`  _(Field)_
- `Proxy Server Username`  _(Field)_
- `Proxy Server Password`  _(Field)_

**Opciones ligadas a su control:**

- `Zone Type` ← `ADD_TYPES`: `Primary Zone (default)` · `Secondary Zone` · `Stub Zone` · `Conditional Forwarder Zone` · `Secondary Conditional Forwarder Zone` · `Catalog Zone` · `Secondary Catalog Zone` · `Secondary ROOT Zone`
- `Zone Transfer Protocol` ← `TRANSFER_PROTOCOLS`: `XFR-over-TCP (default)` · `XFR-over-TLS` · `XFR-over-QUIC`
- `Protocol` ← `PROTOCOLOS_FORWARDER`: `DNS-over-UDP (default)` · `DNS-over-TCP` · `DNS-over-TLS` · `DNS-over-HTTPS` · `DNS-over-QUIC`
- `Network Proxy` ← `PROXY_TYPES`: `No Proxy` · `Default Proxy (default)` · `HTTP Proxy` · `SOCKS5 Proxy`

**Prosa que forma parte de la superficie:**

> When using "This Server", if a record does not exists in the zone then the request is forwarded to the DNS Server's resolver internally. This allows you to override any record for the forwarded domain name or control its DNSSEC validation.
> Enter a forwarder server address above. You can add more forwarders by adding FWD records after the zone is added.

**Textos de ayuda, literales y que sobreviven tal cual:**

> When enabled, the secondary zone will be validated using the ZONEMD record after every zone transfer. The zone will get disabled if the validation fails. The zone must be DNSSEC signed for the validation to work.

**Enlaces salientes:** `https://blog.technitium.com/2022/06/how-to-self-host-your-own-domain-name.html`

**Resoluciones manuales auditables:**

| Valor calculado | Lo que es en realidad |
|---|---|
| `Row label computed: {v.servidoresPrimariosObligatorios ? …}` | `Primary Name Server Addresses` cuando el tipo los exige, `Primary Name Server Addresses (Optional)` cuando no — **y la ayuda cambia con ella**: «Enter the primary name server addresses to sync the zone from.» frente a «…to sync the zone from. When unspecified, the SOA Primary Name Server will be resolved and used.» |

### `CloneZone`

**Dónde se abre:** Menú de fila y menú de zona · sólo `Primary` y `Forwarder`

**Título:** `Clone Zone - ${zone === '.' ? '<root>' : zone}`

**Talla actual:** `form` — 560 px máximo, siempre limitado a `100vw - 32px`.

**Pie:** `Clone Zone` → `Close`. El verbo va antes del descarte.

**Textos de botón encontrados (pie y cuerpo):** `Clone Zone`

**Controles y etiquetas de grupo leídos del fuente (2):**

- `Source Zone`  _(LabeledInput)_
- `New Zone`  _(LabeledInput)_

### `ConvertZone`

**Dónde se abre:** Menú de fila y menú de zona · todos menos `Stub` y `Catalog`

**Título:** `Convert Zone - ${zone === '.' ? '<root>' : zone}`

**Talla actual:** `form` — 560 px máximo, siempre limitado a `100vw - 32px`.

**Pie:** `Convert Zone` → `Close`. El verbo va antes del descarte.

**Textos de botón encontrados (pie y cuerpo):** `Convert Zone`

**Controles y etiquetas de grupo leídos del fuente (4):**

- `Convert To`  _(GroupRow)_
- `Primary Zone`  _(labelTable)_
- `Conditional Forwarder Zone`  _(labelTable)_
- `Catalog Zone`  _(labelTable)_

**Prosa que forma parte de la superficie:**

> Note!: The conversion process may take a while depending on the number of records the zone has. When converting a Secondary Catalog zone to a Catalog zone, all member zones too will be converted to either Primary or Conditional Forwarder zone depending on their existing zone type. Please be patient till the conversion process completes.

**Resoluciones manuales auditables:**

| Valor calculado | Lo que es en realidad |
|---|---|
| `native radio label computed: {LABELS[d]}` | Las tres etiquetas están en la tabla `LABELS`: `Primary Zone`, `Conditional Forwarder Zone` y `Catalog Zone`. El tipo actual aparece presente y deshabilitado. |

### `DnssecProperties`

**Dónde se abre:** **Sólo registros** · menú `DNSSEC`, si está firmada

**Título:** `DNSSEC Properties - ${zone === '.' ? '<root>' : zone}`

**Talla actual:** `wide` — 880 px máximo, siempre limitado a `100vw - 32px`.

**Pie:** `Close`. El verbo va antes del descarte.

**Textos de botón encontrados (pie y cuerpo):** `Add Private Key` · `Publish All Keys` · `Add Key` · `Change` · `Save` · `Delete` · `Activate` · `Rollover` · `Retire`

**Controles y etiquetas de grupo leídos del fuente (10):**

- `Key Type`  _(Field)_
- `Algorithm`  _(Field)_
- `Hash Algorithm`  _(Field)_
- `Key Size`  _(Field)_
- `Private Key`  _(Field)_
- `Automatic Key Rollover`  _(Field)_
- `NSEC3 Iterations`  _(Field)_
- `NSEC3 Salt Length`  _(Field)_
- `DNSKEY TTL`  _(Field)_
- `Rollover days for ${k.keyTag}`  _(Input)_

**Opciones ligadas a su control:**

- `Key Type` ← `KEY_TYPES`: `Key Signing Key (KSK)` · `Zone Signing Key (ZSK)`
- `Algorithm` ← `ALGORITHMS`: `RSA` · `ECDSA (recommended)` · `EdDSA`
- `Hash Algorithm` ← `HASHES_RSA`: `MD5 (obsolete)` · `SHA1 (obsolete)` · `SHA256 (default)` · `SHA512`
- `Key Size` ← `TAMANOS_RSA`: `1024` · `1280` · `1536` · `2048` · `3072` · `4096`
- `Private Key Generation` ← `GENERATIONS`: `Automatic Private Key Generation (default)` · `Use Specified Private Key`
- `Proof of Non-Existence` ← `NX_PROOFS`: `Next Secure (NSEC) (recommended)` · `Next Secure 3 (NSEC3)`

**Secciones:** `Add Private Key` · `Proof of Non-Existence`

**Prosa que forma parte de la superficie:**

> Note!

**Textos de ayuda, literales y que sobreviven tal cual:**

> Enter a private key in PEM format.
> The frequency at which the DNS Server must automatically rollover the key.
> The TTL value to be used for DNSKEY records. A lower value will allow quicker addition or rollover to a new DNS Key at the cost of increased frequency of DNSKEY queries by resolvers.

**Resoluciones manuales auditables:**

| Valor calculado | Lo que es en realidad |
|---|---|
| `Field label computed: {newKey.algorithm === …}` | `EdDSA Curve` con EdDSA, `ECDSA Curve` con ECDSA |

### `ImportZone`

**Dónde se abre:** Menú de fila y menú de zona · sólo `Primary` y `Forwarder`

**Título:** `Import - ${zone}`

**Talla actual:** `medium` — 720 px máximo, siempre limitado a `100vw - 32px`.

**Pie:** `Import` → `Close`. El verbo va antes del descarte.

**Textos de botón encontrados (pie y cuerpo):** `Import`

**Controles y etiquetas de grupo leídos del fuente (9):**

- `Import Options`  _(GroupRow)_
- `Overwrite Existing Records`  _(checkbox)_
- `Overwrite Zone`  _(checkbox)_
- `Overwrite SOA Serial`  _(checkbox)_
- `Import Type`  _(GroupRow)_
- `Zone File`  _(radio)_
- `Text Editor`  _(radio)_
- `Zone File`  _(Row)_
- `Text Editor`  _(LabeledTextarea)_

**Prosa que forma parte de la superficie:**

> Note!: The $ORIGIN and $TTL values will be automatically set if not specified.
> Warning!: Overwrite SOA serial option when used to set a lower SOA serial value than the current SOA serial will cause secondary zones to fail to sync.

**Textos de ayuda, literales y que sobreviven tal cual:**

> Enable this option to overwrite existing records for the record types being imported.
> Enable this option to delete all existing records from the zone before importing new records.
> Enable this option to overwrite existing SOA record serial with the imported SOA record serial.
> Enter the records to be imported above in standard zone file format.

### `SignZone`

**Dónde se abre:** **Sólo registros** · menú `DNSSEC`, si la zona no está firmada

**Título:** `Sign Zone - ${zone === '.' ? '<root>' : zone}`

**Talla actual:** `form` — 560 px máximo, siempre limitado a `100vw - 32px`.

**Pie:** `Sign Zone` → `Close`. El verbo va antes del descarte.

**Textos de botón encontrados (pie y cuerpo):** `Sign Zone`

**Controles y etiquetas de grupo leídos del fuente (7):**

- `DNSKEY Algorithm`  _(GroupRow)_
- `Hash Algorithm`  _(Field)_
- `Proof of Non-Existence`  _(GroupRow)_
- `NSEC3 Iterations`  _(Field)_
- `NSEC3 Salt Length`  _(Field)_
- `DNSKEY TTL`  _(Field)_
- `ZSK Automatic Rollover`  _(Field)_

**Opciones ligadas a su control:**

- `DNSKEY Algorithm` ← `ALGORITHMS`: `RSA` · `ECDSA (recommended)` · `EdDSA`
- `Hash Algorithm` ← `HASHES_RSA`: `MD5 (obsolete)` · `SHA1 (obsolete)` · `SHA256 (default)` · `SHA512`
- `Proof of Non-Existence` ← `NX_PROOFS`: `Next Secure (NSEC) (recommended)` · `Next Secure 3 (NSEC3)`
- `KSK Private Key Generation` ← `GENERATIONS`: `Automatic Private Key Generation (default)` · `Use Specified Private Key`
- `ZSK Private Key Generation` ← `GENERATIONS`: `Automatic Private Key Generation (default)` · `Use Specified Private Key`
- `KSK Size / ZSK Size` ← `TAMANOS_RSA`: `1024` · `1280` · `1536` · `2048` · `3072` · `4096`

**Textos de ayuda, literales y que sobreviven tal cual:**

> With NSEC, all the records in your zone can be discovered by anyone using "zone walking" technique. NSEC3 makes it difficult since it uses hashing with a random salt.
> The TTL value to be used for DNSKEY records. A lower value will allow quicker addition or rollover to a new DNS Key at the cost of increased frequency of DNSKEY queries by resolvers.
> The frequency at which the DNS Server must automatically rollover the Zone Signing Key (ZSK).
> Enter a private key in PEM format.

**Resoluciones manuales auditables:**

| Valor calculado | Lo que es en realidad |
|---|---|
| `Field label computed: {f.algorithm === …}` | `EdDSA Curve` con EdDSA, `ECDSA Curve` con ECDSA |
| `Field label computed: {sizeLabel}` | Prop del bloque de clave, instanciado dos veces: **`KSK Size`** y **`ZSK Size`** |
| `Field label computed: {pemLabel}` | Igual: **`KSK Private Key`** y **`ZSK Private Key`** |
| `help text computed (NSEC3 iterations)` | «The number of iterations used by NSEC3 for hashing the domain names. It is recommended to use 0 iterations since more iterations will increase computational costs for both the DNS Server and resolver while not providing much value against "zone walking" [RFC 9276].» — lleva un enlace externo dentro |
| `help text computed (NSEC3 salt)` | «The number of bytes of random salt to generate to be used with the NSEC3 hash computation. It is recommended to not use salt by setting the length to 0 [RFC 9276].» — lleva un enlace externo dentro |

### `UnsignZone`

**Dónde se abre:** **Sólo registros** · menú `DNSSEC`, si está firmada

**Título:** `Unsign Zone - ${zone === '.' ? '<root>' : zone}`

**Talla actual:** `form` — 560 px máximo, siempre limitado a `100vw - 32px`.

**Pie:** `Unsign Zone` → `Close`. El verbo va antes del descarte.

**Textos de botón encontrados (pie y cuerpo):** `Unsign Zone`

**Prosa que forma parte de la superficie:**

> Warning!: Unsigning the zone without removing all DS records from its parent zone will cause DNSSEC validating recursive resolvers to mark the zone as bogus and fail to resolve it.
> Warning!: Make sure that you have removed all of the DS records from the parent zone and sufficient time has passed before unsigning this zone. You MUST wait for at least the number of seconds specified by the DS record's TTL value to elapse before unsigning the zone to ensure that all recursive resolvers would have expired the DS records from its cache. For example, if you have DS records at the parent zone with TTL value set to 86400 then you must wait for 86400 seconds (24 hours) to pass after you delete the DS records from the parent zone. Once you have ensured that you have waited for the appropriate time then you can unsign the zone safely.
> Note!: You can find out the TTL value of DS records for your zone by querying for DS records using the DNS Client tab.
> Warning!: Unsigning the zone will permanently delete all of the private keys associated with it. Consider taking a backup before proceeding.
> Are you sure you want to proceed to unsign the zone now?

### `ViewDs`

**Dónde se abre:** **Sólo registros** · menú `DNSSEC`, si está firmada

**Título:** `View DS Info - ${zone === '.' ? '<root>' : zone}`

**Talla actual:** `wide` — 880 px máximo, siempre limitado a `100vw - 32px`.

**Pie:** `Close`. El verbo va antes del descarte.

**Términos de datos mostrados:** `Key Tag` · `Key State` · `Algorithm` · `Public Key`

**Prosa que forma parte de la superficie:**

> Use the DNS Key data given below to add DS records for your zone. Before adding the DS records, you must read and understand the following points:
> The Key State for a newly published DNS Key must be Ready before you can add a DS record for it. Adding DS record for a DNS Key with Published Key State may cause DNSSEC validation to fail for some DNS resolvers. A "ready by" timestamp is displayed to let you know when a DS record can be added for a DNS Key that is not "Ready" yet.
> You should add only one DS record for each Key Tag. That is, do not create multiple DS records for each Digest Type, instead use the Digest Type that is supported by your Domain Register.
> Use the provided Public Key if the Domain Register requires it instead of the Digest.
> When doing a Key Signing Key (KSK) rollover, you can immediately delete the old DS record after adding the new DS record.

### `ZoneOptions`

**Dónde se abre:** **Las dos vistas** · botón de fila y menú de zona

**Título:** `Zone Options - ${zone === '.' ? '<root>' : zone}`

**Talla actual:** `medium` — 720 px máximo, siempre limitado a `100vw - 32px`.

**Pie:** `Save` → `Close`. El verbo va antes del descarte.

**Textos de botón encontrados (pie y cuerpo):** `Save` · `Remove` · `Add Policy`

**Pestañas (5):** `General` · `Query Access` · `Zone Transfer` · `Notify` · `Dynamic Updates`

Cada una es una superficie con sus propios campos. Un dibujo de una sola no
es un dibujo de este diálogo.

**Controles y etiquetas de grupo leídos del fuente (14):**

- `Zone options`  _(Segmented)_
- `Catalog Zone`  _(Field)_
- `Override Query Access Option`  _(checkbox)_
- `Override Zone Transfer Option`  _(checkbox)_
- `Override Notify Option`  _(checkbox)_
- `Zone Transfer Protocol`  _(GroupRow)_
- `TSIG Key Name (Optional)`  _(Field)_
- `Use ZONEMD to Validate Zone`  _(checkbox)_
- `Zone Transfer TSIG Key Names`  _(Field)_
- `Quick Add`  _(Field)_
- `Secondary Catalog Name Servers`  _(Field)_
- `TSIG key name ${i + 1}`  _(Select)_
- `Domain ${i + 1}`  _(Input)_
- `Allowed types ${i + 1}`  _(Input)_

**Opciones ligadas a su control:**

- `Zone Transfer Protocol` ← `PROTOCOLOS_XFR`: `XFR-over-TCP (default)` · `XFR-over-TLS` · `XFR-over-QUIC`
- `Zone options` ← `TABS`: `General` · `Query Access` · `Zone Transfer` · `Notify` · `Dynamic Updates (RFC 2136)`
- `Query Access` ← `QUERY_ACCESS`: `Deny` · `Allow (default)` · `Allow Only Private Networks` · `Allow Only Name Servers In Zone` · `Use Specified Network Access Control List (ACL)` · `Allow Zone Name Servers And Use Specified Network Access Control List (ACL)`
- `Zone Transfer` ← `TRANSFERS`: `Deny` · `Allow` · `Allow Only Name Servers In Zone` · `Use Specified Network Access Control List (ACL)` · `Allow Zone Name Servers And Use Specified Network Access Control List (ACL)`
- `Notify` ← `NOTIFICATIONS`: `None` · `Name Servers In Zone` · `Specified Name Servers` · `Both Zone Name Servers And Specified Name Servers` · `Separate Name Servers For Catalog And Member Zones`
- `Dynamic Updates` ← `UPDATES`: `Deny (default)` · `Allow` · `Allow Only Name Servers In Zone` · `Use Specified Network Access Control List (ACL)` · `Allow Zone Name Servers And Use Specified Network Access Control List (ACL)`

**Secciones:** `Security Policy`

**Prosa que forma parte de la superficie:**

> Notify Failed For:

**Resoluciones manuales auditables:**

| Valor calculado | Lo que es en realidad |
|---|---|
| `Field label computed` | `Primary Name Server Addresses` cuando el tipo lo exige, `Primary Name Server Addresses (Optional)` cuando no |
| `Field label computed: {listLabel}` | `Network Access Control List (ACL)` en Query Access, Zone Transfer y Dynamic Updates; `Specified Name Servers` en Notify |

### `ZonePermissions`

**Dónde se abre:** Menú de fila y menú de zona · siempre

**Título:** `Zone Permissions - ${zone}`

**Talla actual:** `medium` — 720 px máximo, siempre limitado a `100vw - 32px`.

**Pie:** `Save` → `Close`. El verbo va antes del descarte.

**Textos de botón encontrados (pie y cuerpo):** `Save` · `Remove`

**Controles y etiquetas de grupo leídos del fuente (1):**

- `${key} for ${f.name}`  _(input)_

**Textos de ayuda, literales y que sobreviven tal cual:**

> No permissions assigned.

**Resoluciones manuales auditables:**

| Valor calculado | Lo que es en realidad |
|---|---|
| `Field label computed: {addLabel}` | Prop de `PermissionsTable`, instanciada dos veces: **`Add User`** y **`Add Group`**. Ojo: **no selecciona, AÑADE una fila** al cambiar |

---

## Evidencia DOM multirama

Estas no son ausencias “explicadas” por un analizador: son estados que se
abrieron de uno en uno en el harness. Los nombres entre corchetes describen el
estado del control; no cambian su etiqueta. `Add Record` no tiene una lista fija
de 19: ofrece **18 o 19 según la zona**, y la unión de ramas del componente más
el SOA editable cubre sus 23 tipos de registro.

### `AddZone` — 9 estados

**Comunes:** `Zone` · `Primary Zone (default)` · `Secondary Zone` · `Stub Zone` · `Conditional Forwarder Zone` · `Secondary Conditional Forwarder Zone` · `Catalog Zone` · `Secondary Catalog Zone` · `Secondary ROOT Zone (RFC 8806)`

- **Primary:** `Catalog Zone` · `Import Zone File (Optional)` · `Use SOA Serial Date Scheme`
- **Secondary:** `Catalog Zone` · `Primary Name Server Addresses (Optional)` · `XFR-over-TCP (default)` · `XFR-over-TLS` · `XFR-over-QUIC` · `TSIG Key Name (Optional)` · `Use ZONEMD to Validate Zone`
- **Stub:** `Catalog Zone` · `Primary Name Server Addresses (Optional)`
- **Forwarder / initialize:** `Catalog Zone` · `Initialize Forwarder (FWD) Record` · `DNS-over-UDP (default)` · `DNS-over-TCP` · `DNS-over-TLS` · `DNS-over-HTTPS` · `DNS-over-QUIC` · `Forwarder` · `Use "This Server"` · `Enable DNSSEC Validation` · `No Proxy` · `Default Proxy (default)` · `HTTP Proxy` · `SOCKS5 Proxy` · `Proxy Server Address [disabled with Default Proxy]` · `Proxy Server Port [disabled with Default Proxy]` · `Proxy Server Username [disabled with Default Proxy]` · `Proxy Server Password [disabled with Default Proxy]`
- **Forwarder / do not initialize:** `Catalog Zone` · `Initialize Forwarder (FWD) Record` · `Import Zone File (Optional)`
- **SecondaryForwarder:** `Primary Name Server Addresses` · `XFR-over-TCP (default)` · `XFR-over-TLS` · `XFR-over-QUIC` · `TSIG Key Name (Optional)`
- **Catalog:** _sin controles adicionales_
- **SecondaryCatalog:** `Primary Name Server Addresses` · `XFR-over-TCP (default)` · `XFR-over-TLS` · `XFR-over-QUIC` · `TSIG Key Name (Optional)`
- **SecondaryRoot:** `Zone [disabled and fixed to .]` · `Catalog Zone`

### `AddEditRecord` — 24 estados

The Add dialog exposes 18 types on an unsigned Primary, 19 on a signed Primary and 19 on a Forwarder. Their union plus the edit-only SOA covers the 23 source variants.

**Comunes:** `Name` · `Type` · `TTL` · `Overwrite existing records` · `Comments` · `Expiry TTL` · `Name` · `Type [disabled]` · `TTL` · `Comments` · `Expiry TTL`

- **A:** `IPv4 Address` · `Add reverse (PTR) record` · `Create reverse zone if it does not exists`
- **NS:** `Name Server` · `Glue Addresses`
- **CNAME:** `Canonical Name`
- **PTR:** `Domain Name`
- **MX:** `Preference` · `Exchange`
- **TXT:** `Text Data` · `Split text into multiple character strings`
- **RP:** `Mailbox` · `TXT Domain`
- **AAAA:** `IPv6 Address` · `Add reverse (PTR) record` · `Create reverse zone if it does not exists`
- **SRV:** `Priority` · `Weight` · `Port` · `Target`
- **NAPTR:** `Order` · `Preference` · `Flags` · `Services` · `Regular Expression` · `Replacement`
- **DNAME:** `Delegation Name`
- **SVCB:** `Priority` · `Target Name` · `Use Automatic IPv4 Hint` · `Use Automatic IPv6 Hint`
- **SVCB / one parameter row:** `Priority` · `Target Name` · `Param key 1` · `Param value 1` · `Use Automatic IPv4 Hint` · `Use Automatic IPv6 Hint`
- **HTTPS:** `Priority` · `Target Name` · `Use Automatic IPv4 Hint` · `Use Automatic IPv6 Hint`
- **URI:** `Priority` · `Weight` · `URI`
- **CAA:** `Flags` · `Tag` · `Authority`
- **ANAME:** `ANAME`
- **DS [signed Primary]:** `Key Tag` · `DNSSEC Algorithm` · `Digest Type` · `Digest`
- **SSHFP [signed Primary]:** `Algorithm` · `Fingerprint Type` · `Fingerprint`
- **TLSA [signed Primary]:** `Certificate Usage` · `Selector` · `Matching Type` · `Certificate Association Data`
- **FWD [Forwarder zone]:** `DNS-over-UDP (default)` · `DNS-over-TCP` · `DNS-over-TLS` · `DNS-over-HTTPS` · `DNS-over-QUIC` · `Forwarder` · `Forwarder Priority` · `Enable DNSSEC Validation` · `No Proxy` · `Default Proxy (default)` · `HTTP Proxy` · `SOCKS5 Proxy` · `Proxy Server Address` · `Proxy Server Port` · `Proxy Server Username` · `Proxy Server Password`
- **APP:** `App Name` · `Class Path` · `Record Data (if any)`
- **Unknown:** `RR Type` · `Value`
- **SOA [Edit Record]:** `Primary Name Server` · `Responsible Person` · `Serial` · `Refresh` · `Retry` · `Expire` · `Minimum` · `Use Serial Date Scheme`

### `ZoneOptions` — 6 estados

- **General:** `Catalog Zone` · `Override Query Access Option [disabled]` · `Override Zone Transfer Option [disabled]` · `Override Notify Option [disabled]`
- **Query Access:** `Deny` · `Allow (default)` · `Allow Only Private Networks` · `Allow Only Name Servers In Zone` · `Use Specified Network Access Control List (ACL)` · `Allow Zone Name Servers And Use Specified Network Access Control List (ACL)` · `Network Access Control List (ACL) [disabled for current choice]`
- **Zone Transfer:** `Deny` · `Allow` · `Allow Only Name Servers In Zone` · `Use Specified Network Access Control List (ACL)` · `Allow Zone Name Servers And Use Specified Network Access Control List (ACL)` · `Network Access Control List (ACL) [disabled for current choice]` · `Zone Transfer TSIG Key Names` · `Quick Add`
- **Notify:** `None` · `Name Servers In Zone` · `Specified Name Servers` · `Both Zone Name Servers And Specified Name Servers` · `Specified Name Servers [disabled for current choice]`
- **Dynamic Updates (RFC 2136):** `Deny (default)` · `Allow` · `Allow Only Name Servers In Zone` · `Use Specified Network Access Control List (ACL)` · `Allow Zone Name Servers And Use Specified Network Access Control List (ACL)` · `Network Access Control List (ACL) [disabled for current choice]`
- **Dynamic Updates / one policy row:** `Deny (default)` · `Allow` · `Allow Only Name Servers In Zone` · `Use Specified Network Access Control List (ACL)` · `Allow Zone Name Servers And Use Specified Network Access Control List (ACL)` · `Network Access Control List (ACL) [disabled for current choice]` · `TSIG key name 1` · `Domain 1` · `Allowed types 1`

### `SignZone` — 6 estados

**Comunes:** `RSA` · `ECDSA (recommended)` · `EdDSA` · `Automatic Private Key Generation (default) [KSK]` · `Use Specified Private Key [KSK]` · `Automatic Private Key Generation (default) [ZSK]` · `Use Specified Private Key [ZSK]` · `Next Secure (NSEC) (recommended)` · `Next Secure 3 (NSEC3)` · `DNSKEY TTL` · `ZSK Automatic Rollover`

- **RSA / automatic:** `Hash Algorithm` · `KSK Size` · `ZSK Size`
- **ECDSA / automatic:** `ECDSA Curve`
- **EdDSA / automatic:** `EdDSA Curve`
- **ECDSA / KSK specified:** `ECDSA Curve` · `KSK Private Key`
- **ECDSA / ZSK specified:** `ECDSA Curve` · `ZSK Private Key`
- **ECDSA / NSEC3:** `ECDSA Curve` · `NSEC3 Iterations` · `NSEC3 Salt Length`

### `DnssecProperties` — 5 estados

**Comunes:** `Rollover days for 16958` · `Next Secure (NSEC) (recommended)` · `Next Secure 3 (NSEC3)` · `NSEC3 Iterations` · `NSEC3 Salt Length` · `DNSKEY TTL`

- **key form closed:** _sin controles adicionales_
- **RSA / automatic:** `Key Type` · `Algorithm` · `Hash Algorithm` · `Automatic Private Key Generation (default)` · `Use Specified Private Key` · `Automatic Key Rollover`
- **ECDSA / automatic:** `Key Type` · `Algorithm` · `ECDSA Curve` · `Automatic Private Key Generation (default)` · `Use Specified Private Key` · `Automatic Key Rollover`
- **EdDSA / automatic:** `Key Type` · `Algorithm` · `EdDSA Curve` · `Automatic Private Key Generation (default)` · `Use Specified Private Key` · `Automatic Key Rollover`
- **ECDSA / specified:** `Key Type` · `Algorithm` · `ECDSA Curve` · `Automatic Private Key Generation (default)` · `Use Specified Private Key` · `Private Key` · `Automatic Key Rollover`

---

## Las matrices que alimentan los diálogos

**50** constantes en mayúsculas bajo `screens/zones`, de las cuales
**38 son arrays** —36 leídos y 2 no— y
**12 no son array** en absoluto.

- `screens/zones/DataCell.tsx::LONG_ONES` = `Public Key:` · `Signature:` · `Digest:` · `Fingerprint:` · `Certificate Association Data:` · `Computed Digests:`
- `screens/zones/ZoneList.tsx::RESYNC` = `Secondary` · `SecondaryForwarder` · `SecondaryCatalog` · `Stub`
- `screens/zones/ZoneList.tsx::IMPORT` = `Primary` · `Forwarder`
- `screens/zones/ZoneList.tsx::EXPORT` = `Primary` · `Forwarder` · `Secondary` · `SecondaryForwarder` · `SecondaryCatalog` · `Catalog`
- `screens/zones/ZoneList.tsx::CONVERT` = `Primary` · `Secondary` · `SecondaryForwarder` · `Forwarder` · `SecondaryCatalog`
- `screens/zones/ZoneList.tsx::CLONE` = `Primary` · `Forwarder`
- `screens/zones/ZoneRecords.tsx::RECORDS_PER_PAGE` = `10` · `25` · `50`
- `screens/zones/modals/AddEditRecord.tsx::DS_ALGORITHMS` = `RSAMD5 (1)` · `RSASHA1 (5)` · `RSASHA256 (8)` · `RSASHA512 (10)` · `ECDSAP256SHA256 (13)` · `ECDSAP384SHA384 (14)` · `ED25519 (15)` · `ED448 (16)`
- `screens/zones/modals/AddEditRecord.tsx::DIGESTS_DS` = `SHA1 (1)` · `SHA256 (2)` · `SHA384 (4)`
- `screens/zones/modals/AddEditRecord.tsx::SSHFP_ALGORITHMS` = `RSA` · `DSA` · `ECDSA` · `Ed25519` · `Ed448`
- `screens/zones/modals/AddEditRecord.tsx::HUELLAS_SSHFP` = `SHA1` · `SHA256`
- `screens/zones/modals/AddEditRecord.tsx::USOS_TLSA` = `PKIX-TA` · `PKIX-EE` · `DANE-TA` · `DANE-EE`
- `screens/zones/modals/AddEditRecord.tsx::SELECTORES_TLSA` = `Cert` · `SPKI`
- `screens/zones/modals/AddEditRecord.tsx::COINCIDENCIAS_TLSA` = `Full` · `SHA2-256` · `SHA2-512`
- `screens/zones/modals/add-zone.ts::ADD_TYPES` — **8 entradas**: `Primary Zone (default)` · `Secondary Zone` · `Stub Zone` · `Conditional Forwarder Zone` · `Secondary Conditional Forwarder Zone` · `Catalog Zone` · `Secondary Catalog Zone` · `Secondary ROOT Zone`
- `screens/zones/modals/add-zone.ts::TRANSFER_PROTOCOLS` — **3 entradas**: `XFR-over-TCP (default)` · `XFR-over-TLS` · `XFR-over-QUIC`
- `screens/zones/modals/add-zone.ts::PROTOCOLOS_FORWARDER` — **5 entradas**: `DNS-over-UDP (default)` · `DNS-over-TCP` · `DNS-over-TLS` · `DNS-over-HTTPS` · `DNS-over-QUIC`
- `screens/zones/modals/add-zone.ts::PROXY_TYPES` — **4 entradas**: `No Proxy` · `Default Proxy (default)` · `HTTP Proxy` · `SOCKS5 Proxy`
- `screens/zones/modals/dnssec-options.ts::ALGORITHMS` — **3 entradas**: `RSA` · `ECDSA (recommended)` · `EdDSA`
- `screens/zones/modals/dnssec-options.ts::HASHES_RSA` — **4 entradas**: `MD5 (obsolete)` · `SHA1 (obsolete)` · `SHA256 (default)` · `SHA512`
- `screens/zones/modals/dnssec-options.ts::CURVAS_ECDSA` — **2 entradas**: `P256 (default)` · `P384`
- `screens/zones/modals/dnssec-options.ts::CURVAS_EDDSA` — **2 entradas**: `Ed25519 (default)` · `Ed448`
- `screens/zones/modals/dnssec-options.ts::TAMANOS_RSA` = `1024` · `1280` · `1536` · `2048` · `3072` · `4096`
- `screens/zones/modals/dnssec-options.ts::KEY_TYPES` — **2 entradas**: `Key Signing Key (KSK)` · `Zone Signing Key (ZSK)`
- `screens/zones/modals/dnssec-options.ts::NX_PROOFS` — **2 entradas**: `Next Secure (NSEC) (recommended)` · `Next Secure 3 (NSEC3)`
- `screens/zones/modals/dnssec-options.ts::GENERATIONS` — **2 entradas**: `Automatic Private Key Generation (default)` · `Use Specified Private Key`
- `screens/zones/options.ts::TABS` — **5 entradas**: `General` · `Query Access` · `Zone Transfer` · `Notify` · `Dynamic Updates (RFC 2136)`
- `screens/zones/options.ts::QUERY_ACCESS` — **6 entradas**: `Deny` · `Allow (default)` · `Allow Only Private Networks` · `Allow Only Name Servers In Zone` · `Use Specified Network Access Control List (ACL)` · `Allow Zone Name Servers And Use Specified Network Access Control List (ACL)`
- `screens/zones/options.ts::TRANSFERS` — **5 entradas**: `Deny` · `Allow` · `Allow Only Name Servers In Zone` · `Use Specified Network Access Control List (ACL)` · `Allow Zone Name Servers And Use Specified Network Access Control List (ACL)`
- `screens/zones/options.ts::NOTIFICATIONS` — **5 entradas**: `None` · `Name Servers In Zone` · `Specified Name Servers` · `Both Zone Name Servers And Specified Name Servers` · `Separate Name Servers For Catalog And Member Zones`
- `screens/zones/options.ts::UPDATES` — **5 entradas**: `Deny (default)` · `Allow` · `Allow Only Name Servers In Zone` · `Use Specified Network Access Control List (ACL)` · `Allow Zone Name Servers And Use Specified Network Access Control List (ACL)`
- `screens/zones/options.ts::PROTOCOLOS_XFR` — **3 entradas**: `XFR-over-TCP (default)` · `XFR-over-TLS` · `XFR-over-QUIC`
- `screens/zones/options.ts::SECONDARIES` = `Secondary` · `SecondaryForwarder` · `SecondaryCatalog`
- `screens/zones/record-form.ts::RECORD_TYPES` = `A` · `NS` · `SOA` · `CNAME` · `PTR` · `MX` · `TXT` · `RP` · `AAAA` · `SRV` · `NAPTR` · `DNAME` · `DS` · `SSHFP` · `TLSA` · `SVCB` · `HTTPS` · `URI` · `CAA` · `ANAME` · `FWD` · `APP` · `Unknown`
- `screens/zones/record-view.ts::DNSSEC_TYPES` = `RRSIG` · `NSEC` · `DNSKEY` · `NSEC3` · `NSEC3PARAM`
- `screens/zones/zone-view.ts::SECONDARIES` = `Secondary` · `SecondaryForwarder` · `SecondaryCatalog`

**Arrays que el lector no resuelve, dichos y no omitidos:**

- `screens/zones/ZoneList.tsx::WITH_OPTIONS` — elements not all literal: [...ZONE_TYPES]
- `screens/zones/zone-view.ts::KNOWN` — elements not all literal: [...SECONDARIES, 'Primary', 'Stub', 'Forwarder', '
