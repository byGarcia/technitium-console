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
