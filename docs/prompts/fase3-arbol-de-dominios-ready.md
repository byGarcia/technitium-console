# Rediseño: Cache + Allowed + Blocked — arquetipo: árbol de dominios

Tres pantallas en **una sola ronda**, porque son **el mismo componente** con tres
envoltorios: `screens/lists/Lists.tsx`, 569 líneas. Diseñarlas por separado es cómo
se desalinean, y ya pasó una vez: heredaron el arquetipo de colección de Zones sin
ronda propia y sin validar, en un solo commit.

## La regla que gobierna esta consola

Sustituye a la consola que trae Technitium DNS Server, y **el comportamiento no
puede cambiar**. Se puede recolocar, reagrupar, cambiar el aspecto, cambiar qué
componente lleva qué, y cambiar densidad y jerarquía. **No** se puede quitar un
campo, dejar caer una ayuda, reescribir un rótulo, añadir un paso ni inventar una
ruta.

La paridad se juzga **contra upstream**, no contra esta consola.

## ESTE ENCARGO ESTÁ ACOTADO. Léelo antes que nada

Es la sexta ronda. Las cinco anteriores decidieron casi todo y **este encargo no
vuelve a abrir nada de eso**.

### Lo que se HEREDA y no se discute

- **La dirección** de la fase 1 (anexo A). Es la entrada, no material opinable.
- **Las primitivas** de la fase 2 y las que las rondas posteriores cerraron. Se
  usan, no se rediseñan: `Alert` · `Button` · `Check` · `ClusterNodeSelect` ·
  `Confirm` · `Details` · `Dialog` · `EditableTable` · `Empty` · `External` ·
  `Field` · `FooterLinks` · `Form` · `Icon` · `Matrix` · `Menu` · `Notifier` ·
  `Pagination` · `Panel` · `PanelForm` · `PermissionButton` · `Raw` ·
  `SectionHeader` · `SectionIndex` · `Segmented` · `Select` · `SessionCells` ·
  `StaleData` · `SubTabs` · `Table` · `Tag` · `Tooltip`.
- **El cromo**: lateral de **doce entradas** sin anidar, cabecera, pie y menú de
  cuenta. La sub-navegación de una sección va en una barra bajo el título
  (`SubTabs`) — estas tres pantallas **no tienen sub-navegación**, son tres
  secciones distintas del lateral.
- **La tira de dato caducado** (`StaleData`), con su hora y su `Retry`, y la regla
  que la gobierna: con dato previo habla la tira y calla el aviso; sin dato previo
  habla el aviso.
- **El estado de carga** con `role="status"`, y la regla que lo hizo falta:
  *cargar no es estar vacío*.
- **La regla del vacío contra el error**: *discontinuo = vacío, continuo = error, y
  no se intercambian nunca*.

Si algo de esa lista aparece redibujado en el retorno, el retorno se rechaza por eso
solo. No es rigidez: es que ya se pagó decidirlo.

### Lo que hay que diseñar — CUATRO problemas, y nada más

1. **El árbol como objeto principal.** Hoy vive en un panel pequeño arriba a la
   izquierda y a la derecha hay una caja enorme que a menudo dice
   `0 records at <ROOT>`. La pantalla está vacía en su mayor parte y el objeto que
   la explica es lo más pequeño. Hay que decidir el reparto de las dos mitades —el
   árbol y los registros del nodo— a 1440 y a 390.
2. **Caché contra política, distinguibles sin leer el título.** `Cache` es lo que el
   servidor ha resuelto y guarda: se vacía sin consecuencias. `Allowed` y `Blocked`
   son decisiones del administrador: lo que se borra ahí cambia lo que la casa
   resuelve. Hoy las tres se dibujan idénticas. **Sin inventar vocabulario**: con
   los tokens y las primitivas que ya hay.
3. **Dónde estás dentro del árbol.** El nodo actual sólo aparece dentro de la frase
   `N records at <ROOT>`, en monoespaciada y sin camino. En un árbol de tres niveles
   no se sabe de dónde cuelga lo que se está mirando.
4. **El peso de los verbos destructivos.** `Delete` borra un nodo; `Flush` vacía la
   zona entera y no tiene vuelta atrás. Hoy son la misma pastilla roja. Hay que
   separarlos sin inventar un tono nuevo.

### Lo que se mantiene completo aunque no se rediseñe

**Las tres pantallas enteras**, con sus nueve verbos, su campo `Domain` con
`Browse`, su árbol, su barra de registros, sus dos textos de vacío, sus seis
confirmaciones, sus diez avisos y el diálogo de importar. El encargo son los cuatro
problemas; **la entrega es la pantalla completa**, porque un patrón suelto no dice
dónde va.

### Los anchos

**1440 y 390**, las tres pantallas, los **cuatro estados** (poblado, vacío, carga,
fallo). A 390 el reparto de dos columnas no cabe: hay que decir qué pasa, y **no se
puede esconder ninguno de los dos lados**.

### Cómo se juzga

Con la barra de aceptación que va en el anexo C. Está dentro del encargo a
propósito: una barra que sólo conoce quien corrige convierte la reconciliación en
una sorpresa, y esta ronda tiene **una sola**.

---

# Anexo A — la dirección (fase 1)

# DESIGN.md — la dirección, en una página

Lo que decidieron los tres pilotos de la fase 1, escrito aquí porque **no es un
número**. Lo que sí es un número está en `src/theme/tokens.css`, con su porqué al
lado.

Esto no es un moodboard: cada regla salió de una superficie real y de un contrato
que no se podía perder. La restricción que gobierna el proyecto sigue mandando
sobre todo lo de abajo — **diseño solamente, cero funcionalidad**.

## Los tres arquetipos, y qué cerró cada uno

| Piloto | Superficie | Qué dejó decidido |
|---|---|---|
| 1 | Dashboard dentro de su cromo | La vista de conjunto, el lateral y su raíl, el foco visible, la carga y el error, los colores de serie **medidos** |
| 2 | Zones | La colección, y **el sistema modal entero** que hereda todo lo demás |
| 3 | `Settings › General` | El formulario denso, y **dónde vive el texto** |

Un cuarto arquetipo no se ha dibujado. Cuando aparezca, hereda esto.

## El vocabulario, que es de dos palabras

**Ámbar = puedes. Candado = no puedes.**

Todo lo demás sale de ahí:

- **Ámbar** es lo accionable, lo activo y lo que el usuario puede cambiar por su
  cuenta: la columna que ordena, la fila marcada, el filete del control apagado
  por su interruptor maestro, la barra de carga.
- **Candado** es lo que no depende del usuario: falta permiso. Se anuncia **una
  vez arriba** y no 39 veces, y dice **qué** permiso falta, no sólo que falta.
- Si los dos coinciden, **gana el candado** y el ámbar no se dibuja: lo que no
  puedes tocar no necesita explicarte dos veces por qué está apagado.

## Cinco reglas que no se negocian

1. **Un texto no se resume ni se esconde.** En una colección la superficie son
   los controles; en un formulario denso **la superficie es el texto**. La ayuda
   va en su propia columna, siempre visible; ningún ancho la pliega. Si alguna vez
   se plegara, el anuncio tiene que decir **cuántos párrafos** hay escondidos.
2. **Deshabilitado, nunca escondido.** Un control que desaparece según quién mire
   hace que la pantalla cambie de forma y que nadie sepa que la acción existe.
3. **Un dato viejo nunca se ve como uno nuevo.** `--dim` sobre el dato anterior,
   y cuando además falló el refresco, borde `--dan`, la hora del último dato bueno
   y `Retry`.
4. **Discontinuo = vacío. Continuo = error.** No se intercambian nunca. Y **cero
   es un dato verdadero**: se dibuja `0`, no la caja de vacío.
5. **Toda leyenda rotula todas las etiquetas que manda el servidor**, valgan cero
   o no. Salió de perder una serie entera en el piloto 1; y **ninguna serie puede
   ser el color de un token de texto**.

## El tooltip, que la fase 2 tiene que construir

Tres condiciones, y ninguna es estética:

- **Nunca sustituye al nombre accesible.** Es un refuerzo visual de algo que ya
  tiene nombre, no la única forma de saber qué es un control. Un icono cuyo
  significado sólo vive en su tooltip es un icono sin nombre.
- **Funciona con foco y con puntero**, no sólo al pasar el ratón. Si sólo
  responde al puntero, el raíl de 60 px queda inservible para quien navega con
  teclado.
- **Muestra un texto que YA existe**: el rótulo del icono, o el permiso que falta
  (`Requires Cache: Delete`). No inventa una segunda redacción de lo mismo, que es
  como se acaba con dos verdades para un control.

## El sistema modal — cerrado en el piloto 2

- **Cuatro anchos, por contenido y no por gusto**: 440 una pregunta · 560
  formulario corto en una columna · 720 formulario con ramas o pestañas · 880 el
  que muestra una tabla.
- **El pie es siempre `[ acciones… ] [ descarte ]`**: el verbo primero, el
  descarte en el rincón derecho. No es una convención elegida hoy: es la que
  upstream tiene en sus cuarenta modales, y la que el código consolidó después de
  encontrar 23 de una forma y 17 de la otra. El descarte se llama **`Cancel`
  cuando el diálogo es una pregunta** y `Close` cuando no.
- **El error de validación va junto a su campo** —borde `--dan` y la frase
  debajo—, y **nunca en dos sitios a la vez**.
- **Dos niveles como máximo.** El de debajo se queda y se atenúa a `--dim`. Si
  hiciera falta un tercero, es que el segundo debía ser una sección.
- **La fila repetible**: caja propia bajo el rótulo de sección, cada campo con su
  etiqueta literal indexada, `Remove` al final de su fila, y el `Add` **fuera de
  la caja**, porque añade a la lista y no a una fila. Sin filas no hay caja.

## El formulario denso — cerrado en el piloto 3

- **La ayuda en una tercera columna**, a `--help-col`. A `--bp-rail` baja a
  segunda línea de su fila; a `--bp-stack`, bajo su control. Nunca desaparece.
  Implementado el 2026-09-03 en `ui/Form`, y con una consecuencia que conviene
  saber: **`.row` y `.mrow` ya no comparten escalón.** El formulario denso usa los
  dos que midió el piloto —1180 y 560— y el diálogo se queda en su **720**, que
  desde entonces es **deuda modal y sólo eso**. Medido a 721 y 720: el panel da la
  misma retícula, ya no escalona ahí.
- **El sufijo va pegado a su control**, en su línea, y **nunca baja a la columna
  de ayuda**: es el único sitio donde se lee el rango admitido y el valor por
  defecto. Un número sin su rango es una caja vacía.
- **El índice de secciones**, a `--index-col`, al lado del formulario; por debajo
  de `--bp-index`, tira horizontal que se desplaza sin perder ninguna entrada.
  **No es `Segmented`, y es la distinción que sostiene la primitiva**: `Segmented`
  elige un valor y lo que había deja de estar; el índice no cambia nada, mueve la
  rueda. Por eso son enlaces y no botones, y por eso la activa lleva
  `aria-current="location"` y no `aria-selected`. Y por eso se marca con un
  **filo** en ámbar y no con el relleno: el relleno diría «has escogido ésta».
- **`Warning!` antes de los controles; `Note!` después.** Uno puede cambiar tu
  decisión, el otro la explica. Y se distinguen por **tratamiento**: el `Warning!`
  va **relleno**, el `Note!` **con contorno**. El aviso ocupa su sección hasta
  `--notice-max`, fuera de la columna de ayuda: **un aviso no es de ningún
  control**.

  **El tono no cambia: `Warning!` es `--warn`.** El piloto lo dibujó en `--dan`,
  pero eso no llegó a consolidarse ni aquí ni en la reconciliación, que registró
  «relleno contra contorno» **sin tono** — y lo que la fase 1 decidió es la
  posición y el tratamiento, no una reasignación semántica.

  Reasignarlo tendría un precio que no compra nada: **`--dan` queda reservado
  para el error, la validación y lo destructivo**, y un `Warning!` en rojo lo
  haría significar dos cosas a la vez. La distinción de un aviso que avisa y uno
  que informa ya la cargan tres diferencias —dónde va, si lleva relleno y qué
  icono—, que es más de lo que hacía falta.
- **La barra de guardado se pega abajo** y no se trocea por pestaña, porque
  `Save Settings` guarda los nueve paneles — y eso **se dice en la barra**.

## Cómo se decide, cuando hay discusión

Lo que más ha ahorrado en esta fase no es ninguna regla de arriba:

- **Medir en vez de discutir.** Los colores de serie se decidieron con CIEDE2000
  entre los pares que comparten gráfica (`dev/palette-distance.mjs`), y el
  resultado salió al revés de lo que parecía a ojo.
- **El contrato se lee del fuente, no del dibujo.** Un contrato leído del dibujo
  que se está juzgando no comprueba nada. Los siete hallazgos del piloto 2 y el
  del 3 salieron de leer código; **ninguno se veía en una captura**.
- **Un recuento sin su inventario no es un contrato.** Costó dos correcciones en
  un mismo día: «veintitantos sufijos» eran 19, y «seis rótulos de grupo» venían
  sin nombrar cuatro.
- **Una herramienta sólo puede afirmar lo que de verdad vuelve a ejecutar.**

## Lo que sigue abierto

- **El tramo entre `--bp-stack` y `--bp-rail`** no se ha visto en una tableta de
  verdad. Los tres pilotos lo declararon abierto, los tres por su cuenta.
- ~~**`--help-col` medido sólo contra `Settings › General`**~~ — cerrado el
  2026-09-03 midiendo DHCP: `Add Scope` da la misma retícula `210px 542px 360px`
  en sus 29 filas, con sus 29 ayudas visibles y sin ningún control recortado, a
  1440 y a 390. La columna aguanta el otro consumidor del kit.
- **Los cinco rótulos de grupo que repiten el título de su sección** —`DNSSEC`
  bajo `DNSSEC`, `UDP Socket Pool` bajo `UDP Socket Pool`…—. Hoy la pantalla pinta
  los dos. Sólo `Zone Defaults` dice algo que su sección no dice.

---

# Anexo B — el contrato, entero

# Contrato del ARQUETIPO ÁRBOL DE DOMINIOS — Cache, Allowed y Blocked

**Fecha:** 2026-09-07 · **Superficies:** `/cache/`, `/allowed/`, `/blocked/` ·
**Medido con:** `dev/screen-contract.mjs` contra el arnés a 1440, sello
`2501a438…`

> Las tres son **el mismo componente** —`screens/lists/Lists.tsx`, 569 líneas— con
> tres envoltorios. Se diseñan juntas o se desalinean: es lo que ya pasó una vez,
> cuando heredaron el arquetipo de colección de Zones sin ronda propia y sin
> validar, en un solo commit.

## La regla que gobierna, y que esta ronda no puede tocar

**Diseño solamente, cero funcionalidad.** Ni un control cambia de pantalla, ni
aparece un paso que upstream no tenga, ni se junta esto con `Settings › Blocking`.
Los textos son literales de upstream y viajan **verbatim**.

Y una que es de esta ronda: **caché y política no son lo mismo, y tienen que
distinguirse**. `Cache` es lo que el servidor ha resuelto y guarda; `Allowed` y
`Blocked` son decisiones del administrador. Hoy las tres se dibujan idénticas, y
eso es lo primero que hay que resolver: la caché se vacía sin consecuencias, una
política borrada cambia lo que la casa resuelve.

## Qué hay hoy en cada una, medido

| | Cache | Allowed | Blocked |
|---|---|---|---|
| Acciones de pantalla | 1 | 4 | 4 |
| Verbos | `Flush Cache` | `Allow` · `Import` · `Export` · `Flush` | `Block` · `Import` · `Export` · `Flush` |
| Campo suelto | `Domain` (`example.com`) | igual | igual |
| Tabla de registros | sí, con DNSSEC | sí, sin DNSSEC | sí, sin DNSSEC |
| Recuentos | 3 | 3 | 3 |

Comunes a las tres, y ninguno se puede perder:

- El selector `Cluster Node`, sobre el título.
- `Domain` + **`Browse`** — literal de upstream en las tres. No es «Go».
- El árbol, con su recuento: `1 zone` / `N zones`.
- La barra del lado de registros: `N records at <nodo>`, `Refresh`, y `Delete`
  cuando el nodo se puede borrar.
- El vacío, con **dos textos distintos** según por qué está vacío:
  `This node only contains sub-domains. Open one in the tree to see its records.`
  y `This node has no records and no sub-domains.`
- La tira de dato caducado con su hora y su `Retry`.

### Los literales de Allowed y Blocked, verbatim

| Momento | Allowed | Blocked |
|---|---|---|
| Añadir | `Allowed!` · `Domain '<d>' was added to Allowed Zone successfully.` | `Blocked!` · `Domain '<d>' was added to Blocked Zone successfully.` |
| Borrar (confirmación) | `Delete Allowed Zone` · `Are you sure you want to delete the allowed zone '<n>'?` · `Delete` | `Delete Blocked Zone` · `Are you sure you want to delete the blocked zone '<n>'?` · `Delete` |
| Borrado | `Deleted!` · `Domain '<n>' was deleted from Allowed Zone successfully.` | `Deleted!` · `Blocked zone '<n>' was deleted successfully.` |
| Vaciar (confirmación) | `Flush Allowed Zone` · `Are you sure you want to flush the entire Allowed zone?` · `Flush` | `Flush Blocked Zone` · `Are you sure you want to flush the entire Blocked zone?` · `Flush` |
| Vaciado | `Flushed!` · `Allowed zone was flushed successfully.` | `Flushed!` · `Blocked zone was flushed successfully.` |
| Exportar | `Exported!` · `Allowed zones were exported successfully.` | `Exported!` · `Blocked zones were exported successfully.` |
| Importar (diálogo) | `Import Allowed Zones` · `Enter domain names one below other to import into Allowed Zone:` · área `Allowed Zones` · botón `Import` | `Import Blocked Zones` · `Enter domain names one below other to import into blocked zone:` · área `Blocked Zones` · botón `Import` |
| Importado | `Imported!` · `Domain names were imported into allowed zone successfully.` | `Imported!` · `Domain names were imported into blocked zone successfully.` |
| Sin dominio | `Missing!` · `Please enter allowed zones to import.` | `Missing!` · `Please enter blocked zones to import.` |

**La minúscula de `blocked zone` y `allowed zone` es de upstream y se respeta**: no
se «arregla» la capitalización, porque el contrato dice verbatim y porque una
diferencia de texto es la forma más barata de perder la paridad.

### Los de Cache

- `Flush Cache` · `Are you sure to flush the DNS Server cache?` · `Flush Cache`
- `Delete Cached Zone` · `Are you sure you want to delete the cached zone '<n>' and
  all its records?` · `Delete`
- `Flushed!` · `Deleted!`
- Los registros llevan **DNSSEC**: estado por registro, `RRSIG` y `show full`, que
  las otras dos no tienen.

## Los estados que tiene que contestar

Los cuatro, por pantalla, y **medidos hoy**: 96 celdas el 2026-09-07, sin desbordes
y con los 24 fallos anunciados con `role=alert`.

| | poblado | vacío | carga | fallo |
|---|---|---|---|---|
| Qué se ve | árbol y registros | árbol vacío o nodo sin registros | `Loading…` con `role=status` | aviso con el mensaje del servidor |

Dos que la ronda **no puede volver a romper**, porque se arreglaron esta semana:

- **Cargar no es estar vacío.** Hasta el 2026-09-07 dibujaban «0 zones» con la
  petición en vuelo, que es lo mismo que enseña una lista vacía de verdad.
- **Fallar no es estar vacío**: con dato previo habla la tira de caducado, sin dato
  previo habla el aviso. Nunca los dos.

## Qué está mal hoy, y es lo que la ronda viene a arreglar

1. **El arquetipo heredado no es el suyo.** Zones es una colección paginada con
   filtros y tabla; esto es un **árbol**. Lo que se ve a 1440: un panel pequeño
   arriba a la izquierda con el árbol y, a la derecha, una caja enorme que dice
   `0 records at <ROOT>`. La pantalla está vacía en su mayor parte y el objeto
   principal —el árbol— es lo más pequeño.
2. **Las tres son indistinguibles.** Misma cabecera, mismo reparto, mismos colores.
   Una es la caché del servidor y dos son política de bloqueo; nada lo dice.
3. **El árbol no dice dónde estás.** El nodo actual sólo aparece en la barra de
   recuento del otro lado (`records at <ROOT>`), en tipografía monoespaciada y sin
   camino: en un árbol de tres niveles no se sabe de dónde cuelga lo que se mira.
4. **`Delete` y `Flush` no se distinguen por peso.** Borrar un nodo y vaciar la
   zona entera son la misma pastilla roja; el segundo no tiene vuelta atrás.

## Qué se pide de vuelta

Las tres pantallas a **1440 y 390**, en sus cuatro estados, con:

- el árbol como objeto principal y el camino del nodo actual visible;
- caché y política distinguidas **sin inventar vocabulario**: con los tokens y las
  primitivas que ya existen;
- los cuatro verbos de Allowed/Blocked con su peso —`Flush` es el destructivo de
  toda la zona— y el `Delete` del nodo en su sitio;
- el diálogo de importar, con su texto y su área;
- y **ni un literal cambiado**.

Nada de esto puede añadir un control, mover uno a otra pantalla, ni tocar
`Settings › Blocking`.

---

# Anexo C — la barra de aceptación

# Barra de aceptación — árbol de dominios (Cache, Allowed, Blocked)

Esto es contra lo que se juzga el retorno. Va dentro del encargo a propósito: una
barra que sólo conoce quien corrige convierte la reconciliación en una sorpresa, y
esta ronda tiene **una sola**.

Un dibujo que vuelva se acepta si, y sólo si:

## Lo que no puede faltar

- **Las tres pantallas están dibujadas**, y se distinguen entre sí sin leer el
  título. `Cache` es lo que el servidor guardó; `Allowed` y `Blocked` son decisiones
  del administrador. Si las tres siguen siendo la misma pantalla con otro rótulo, el
  retorno no cumple lo que esta ronda existe para resolver.
- **Los nueve verbos están, cada uno en su pantalla**: `Flush Cache` en Cache;
  `Allow`/`Block`, `Import`, `Export` y `Flush` en las otras dos; y el `Delete` y el
  `Refresh` de la barra de registros en las tres.
- **`Domain` y `Browse`** están, con ese literal y no otro, y el campo conserva su
  `example.com` de marcador.
- **Los dos textos del vacío** están los dos, en filas distintas del dibujo:
  `This node only contains sub-domains…` y `This node has no records and no
  sub-domains.` Son dos situaciones y no una.
- **Las seis confirmaciones y los diez avisos** de la tabla de literales del
  contrato, verbatim — minúsculas de upstream incluidas.
- **El diálogo de importar**, con su título, su párrafo, su área rotulada y su
  botón.
- **La tabla de registros de Cache lleva DNSSEC** —estado, `RRSIG`, `show full`— y
  las otras dos no. Es la diferencia real entre las tres y tiene que verse.

## Lo que tiene que resolver

- **El árbol es el objeto principal.** Hoy ocupa un panel pequeño arriba a la
  izquierda con media pantalla vacía a la derecha. Si el retorno deja esa
  proporción, no ha resuelto el encargo.
- **Se ve dónde estás.** El camino del nodo actual, legible, y no sólo dentro de la
  frase `records at <ROOT>` del otro lado.
- **`Flush` pesa más que `Delete`.** Uno borra un nodo, el otro vacía la zona
  entera y no tiene vuelta atrás. Hoy son la misma pastilla roja.

## Los cuatro estados, en las tres

Poblado, vacío, **carga** y **fallo**, dibujados y distinguibles entre sí:

- carga **no** se dibuja como vacío —lo estuvo hasta el 2026-09-07—;
- fallo **no** se dibuja como vacío: *discontinuo = vacío, continuo = error*, y el
  fallo se cuenta **una vez**: con dato previo lo dice la tira de caducado con su
  hora y su `Retry`, sin dato previo lo dice el aviso.

## Lo que NO puede hacer

- **Mover un control a otra pantalla.** `Settings › Blocking` no se toca y no se
  mezcla: las suscripciones a listas, el tipo de bloqueo y el `Quick Add` viven
  allí y allí se quedan.
- **Añadir un control, un paso o una navegación** que upstream no tenga.
- **Reescribir un literal.** Ni traducir, ni resumir, ni corregir mayúsculas.
- **Inventar vocabulario**: los tokens y las primitivas que hay. Una primitiva
  nueva se justifica por escrito o no entra.

## Los anchos

**1440 y 390**, las tres pantallas, los cuatro estados. A 390 el reparto de dos
columnas no cabe: el retorno tiene que decir qué hace —apilar, o convertir el árbol
en navegación— y **no puede esconder ninguno de los dos lados**.
