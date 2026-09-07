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

**Se pegan aquí enteros al enviar el prompt**: Claude Design no ve este repositorio, así que una referencia a
una ruta es una referencia a nada. Lo mismo con las capturas del baseline, que se
adjuntan. En titulares:

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
