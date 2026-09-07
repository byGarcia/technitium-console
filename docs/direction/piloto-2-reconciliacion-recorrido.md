# Piloto 2 — reconciliación del recorrido

`14-piloto-zones.dc.html`, devuelto el **2026-09-02**. 111 367 bytes, 1112 líneas,
etag **`1788348927968722`** — **comprobado antes de leer nada y sin cambios al
terminar**. Esta nota vale para esa versión y caduca en cuanto el fichero se toque.

> **La corrección volvió el mismo 2026-09-02.** Etag **`1788352586844937`**,
> 116 609 bytes y 1154 líneas. **Los seis puntos están aplicados** y hay **un
> defecto nuevo**, chico. El recorrido del delta está al final de esta nota, en
> «La corrección, recorrida». Lo que sigue es el recorrido original, que se deja
> tal cual porque es de donde salió la lista.

Recorrido punto por punto contra `piloto-2-contrato-zones.md` y
`piloto-2-dialogos.md`, y **todo hallazgo sobre el producto verificado contra el
fuente**, no contra el DOM ni contra una captura.

## Veredicto

**No pasa todavía. Vuelve a Claude Design con cinco cosas**, ninguna cara: tres
son defectos comprobables —un orden cambiado, una palabra cambiada y un control
que desaparece—, una es una decisión que hay que tomar a sabiendas y no de
callada, y la última es el único hueco de diseño que el piloto deja sin cubrir.

Lo que **no** hay: ninguna pérdida de funcionalidad en la lista de zonas ni en sus
menús. Las cuatro variantes de fila por tipo de zona son correctas contra
`ZoneList.tsx`, y el reparto por permisos también.

## La barra de aceptación, ocho puntos

| | Punto | Estado |
|---|---|---|
| 1 | Los quince `Confirm` con su frase literal | **Por regla, no por dibujo.** Se dibujan tres —`Delete Zone`, `Delete Zones`, `Delete Private Key`— con su frase literal exacta, y `Delete Zones` pregunta y **luego** lista, con su recuento. La regla «Anatomía de `Confirm`» generaliza al resto. Lo que no se ejercita: que `Resync` tiene **dos** frases según el tipo de zona; la regla dice «la frase literal del contrato», en singular |
| 2 | Las cinco pestañas de `Zone Options` | **Las cinco están, en orden equivocado.** Ver hallazgo 1. Se dibuja la superficie de una sola pestaña (`Zone Transfer`), lo cual es coherente con la declaración de cierre |
| 3 | Las 23 variantes de `AddEditRecord`, o la justificación | **Justificación en bloque, aceptada salvo un hueco.** No se dibuja ninguna; el cierre declara «una forma de cada [diálogo], no los once» y la regla de anchos coloca `Add Record` en 720. Eso basta para las ramas por tipo de registro — no basta para las filas repetibles. Ver hallazgo 5 |
| 4 | El selector de nodo: condicional, sin agregado, uno solo | **Tres de cuatro.** Sin agregado «Cluster» ✔, sin memoria ✔, **uno solo** para las dos vistas y dicho explícitamente contra upstream ✔. Falta que es condicional. Ver hallazgo 6 |
| 5 | Los dos vacíos distintos | **Cumplido, y bien.** Dos títulos, dos cuerpos y dos salidas distintas; los cuatro textos marcados como propuestos con su porqué |
| 6 | La marca de dato caducado | **Cumplido, y es lo mejor del piloto.** Tira con la hora del último dato bueno y `Retry`, borde `--dan`, filas atenuadas y selección deshabilitada, a 1440 y a 390. Es el caso que el piloto 1 no tuvo y está resuelto entero |
| 7 | Ordenan siete columnas, `Serial` incluida | **Cumplido.** Siete cabeceras ordenables y tres que no; `aria-sort` en la que ordena. Decide **cuándo se ve** —icono sólo al puntero o al foco, la que ordena siempre en ámbar— y realoja la cabecera a 390 como «Sorted by *columna*» con las siete |
| 8 | Los textos propuestos, marcados aparte | **Cumplido, y con el listón alto.** Once filas con dónde, qué y por qué, y el mensaje de validación marcado «Sólo de relleno para el dibujo». **Con una excepción**: ver hallazgo 3 |

## Los cinco que vuelven

### 1 · `Zone Options`: las pestañas 2 y 3 están intercambiadas

El fuente (`src/screens/zones/options.ts:23-29`) las declara
`General · Query Access · Zone Transfer · Notify · Dynamic Updates (RFC 2136)`, y
`ZoneOptions.tsx:139-142` las pinta en orden de array. El piloto (5c) dibuja
`General · Zone Transfer · Query Access · Notify · Dynamic Updates (RFC 2136)`.

Nada en el documento declara una reordenación ni la razona. Es un cambio por
descuido, y de los baratos de arreglar.

### 2 · El pie de los diálogos va al revés que el código, y sin decirlo

`ui/Dialog.tsx:7-18` no deja el pie a gusto de cada modal: el orden **pertenece al
componente**, y es `[ acciones… ] [ Close ]` — el verbo primero, el descarte en el
rincón derecho. El comentario dice por qué se consolidó: 23 modales ponían la
acción primero y 17 la ponían última, en cinco de ellos era destructiva, y
`Delete` y `Close` se intercambiaban entre dos diálogos **de la misma pantalla**.
El rincón derecho es donde upstream tiene el descarte en **los 40** suyos.

El piloto dibuja `[Close][Add]`, `[Close][Save]` y `[Close][Delete]` en los cinco
diálogos que pinta, y lo eleva a regla: «el destructivo va a la derecha y en rojo,
el descarte a su izquierda».

Es una convención defendible y el piloto es coherente consigo mismo. Pero la
consecuencia es concreta y no está escrita en ninguna parte del documento:
**`Delete` aterriza exactamente donde hoy está `Close`**, y donde lo tiene
upstream en sus cuarenta. Invertir una decisión que el código tomó a propósito y
dejó documentada se puede hacer; hacerlo sin nombrarla, no.

### 3 · El descarte de `Confirm` se llama `Cancel`, no `Close`

`ui/Confirm.tsx` pasa `close="Cancel"` a propósito, y `Dialog.tsx` lo explica:
«`Cancel` cuando el modal es una pregunta». El piloto escribe `Close` en sus tres
`Confirm` y **no lo lista entre los textos propuestos**.

Es exactamente la trampa del punto 8: un texto cambiado que no viene marcado es
una decisión de producto tomada por descuido. Aquí además va en la misma dirección
que el hallazgo 2 y se suma a él — el pie del `Confirm` pasa de
`[Delete][Cancel]` a `[Close][Delete]`: cambia la palabra **y** el sitio.

### 4 · `Last` desaparece a 390 en la paginación de registros

4a (1440) dibuja `1 2 3 4 › »`. 4b (390) dibuja `1 2 3 4 ›`.

`ui/Pagination.tsx:68-71` pinta `Last` siempre que haya última página, sin mirar el
ancho, y es **un solo componente compartido** por la lista de zonas, los registros
y Query Logs. Nada declara la pérdida, y contradice la regla que el propio piloto
escribe para 390: «Nada se pierde y nada se mete en un desplegable nuevo».

Con cuatro páginas `»` casi sobra; con cuarenta, no. El dibujo es de cuatro.

### 5 · La fila repetible no la decide nadie

Tres diálogos de esta pantalla la tienen, y salen los tres del contrato leído del
fuente:

- `AddEditRecord` — `Param key ${i+1}` / `Param value ${i+1}`, con `Add Param` y `Remove`
- `ZoneOptions` — `TSIG key name ${i+1}` / `Domain ${i+1}` / `Allowed types ${i+1}`, con `Add Policy` y `Remove`
- `ZonePermissions` — `Add User` y `Add Group`, con `Remove`, y **ojo: no seleccionan, AÑADEN fila**

El piloto no dibuja ninguno y su tabla de reglas no tiene fila para el patrón. La
declaración de cierre —«los que faltan se reparten entre los cuatro anchos según la
regla de arriba y no deberían necesitar decisión nueva»— **es cierta para todo
menos para esto**: la fila repetible no es una cuestión de ancho. Lo que falta por
decidir es dónde vive el `Add`, dónde vive el `Remove` de cada fila, y qué se ve
cuando no hay ninguna fila todavía. Se hereda a Settings, DHCP y Admin, igual que
el resto del sistema modal.

### 6 · El selector de nodo se dibuja siempre, y es condicional

`screens/zones/Zones.tsx:114-124`, con su comentario: *«Draws nothing without a
cluster»*, `initialised={clusterInitialised}`. El piloto lo dibuja en las tres
maquetas que llevan barra superior y su regla no dice que pueda no estar.

El riesgo real es bajo —el código ya lo condiciona y el piloto no lo contradice—,
pero es el hecho cuya ausencia hizo que la spec F10 pasara desapercibida, y
arreglarlo es una línea en la regla.

## Lo que el piloto acierta y conviene no perder

- **La escala de anchos no se inventa: se nombra la que ya existe.** 440 / 560 /
  720 / 880 son `compact` / `form` / `medium` / `wide` de `Dialog.module.css:70-73`,
  y el reparto por diálogo que propone coincide **uno a uno** con la talla actual
  de los once en el contrato. Cero deriva.
- **Las cuatro filas por tipo de zona son correctas contra `ZoneList.tsx`**:
  Primary/Forwarder con `Import` y `Clone`, los Secondary y `Stub` con `Resync`,
  `Stub` sin `Export` ni `Convert`, `Catalog` sólo con `Export`. Y `Zone Options`
  sale en las cuatro, que es lo correcto: `WITH_OPTIONS = [...ZONE_TYPES]`, los
  siete tipos.
- **Los tres textos de `DNSSEC`** —`Unsigned`, `Signed`, `Signed, no keys`— están
  los tres dibujados, en filas distintas.
- **El dato caducado** resuelve el hueco que el piloto 1 no tuvo, y lo resuelve
  como regla y no como parche.
- **`Delete Zones` se muda de la cabecera a la barra de selección**, declarado en
  dos sitios y razonado: el botón vive pegado al número que dice sobre cuánto
  actúa. Sin pérdida.

## Un defecto nuestro, no suyo

`piloto-2-contrato-zones.md:125-126` describe el menú de zona de la vista de
registros como `Import`, `Export`, `Convert`, `Clone`, `Zone Options`,
`Permissions`. **Le falta `Resync`, que en `ZoneRecords.tsx:371-378` es el primer
elemento de ese menú**, condicionado al tipo de zona — y es el que dispara el
`Confirm` de `ZoneRecords.tsx:285` que el propio contrato sí lista.

Esa omisión viajó a Claude Design dentro del prompt. El piloto dibujó una zona
`Primary`, donde `Resync` no aplica, así que **no perdió nada**; pero quien porte
el dibujo a código leyendo sólo el piloto puede dejar la vista de registros de una
`Secondary` sin `Resync`. Se corrige en el contrato, no en el piloto.

> **Y un segundo, encontrado el 2026-09-02 al preparar el piloto 3.** Ampliando el
> lector de contratos para que entendiera Settings salieron dos defectos suyos que
> sólo se veían desde allí: `jsxLiteralText` conocía `JsxElement` y no
> `JsxFragment`, así que **la ayuda de `AddZone.tsx:179` —«Select a Catalog zone to
> register as its member zone.»— nunca llegó al contrato del piloto 2**; y los dos
> párrafos de «This Server» estaban clasificados como prosa cuando son el `help`
> de un control. Una frase de menos y dos mal etiquetadas, ningún control perdido.
> `piloto-2-dialogos.md` está regenerado —2 líneas más, 5 menos, y ningún otro
> diálogo cambia— y las dos cosas tienen prueba de regresión. **No reabre el piloto
> 2**: nada de lo aceptado depende de esa frase.

## Estado

Escrito el **2026-09-02**. **Nada enviado a Claude Design**: el envío lo aprueba
Adrián. Nada aplicado a `tokens.css` — eso sigue siendo la fase 1.4, cuando estén
los tres pilotos.

---

# La corrección, recorrida

Etag **`1788352586844937`**, 116 609 bytes, 1154 líneas — **comprobado antes de
leer nada**. Recorrido **sólo el delta**, que es lo que se pidió, más una pasada
por lo que la lista declaraba intocable.

## Los seis, uno a uno

| # | Lo que se pidió | Estado |
|---|---|---|
| 1 | `Zone Options`: devolver `Query Access` a la segunda posición | **Hecho.** `General · Query Access · Zone Transfer · Notify · Dynamic Updates (RFC 2136)`, y **en las dos** tiras que ahora existen: 5c y la nueva 5e |
| 2 | El pie vuelve a `[ acciones… ] [ descarte ]` | **Hecho en los cinco.** 5a `[Delete][Cancel]` ×2, 5b `[Add][Close]`, 5c `[Save][Close]`, 5d `[Close]` sin tocar y `[Delete][Cancel]`. Y los dos enunciados invertidos están reescritos: el pie de texto de 5a y la fila «Anatomía de `Confirm`» |
| 3 | `Close` → `Cancel` en los tres `Confirm` | **Hecho en los tres**, y **no** se ha añadido a la tabla de textos propuestos, que era la otra mitad de la petición |
| 4 | Devolver `»` a 4b | **Hecho.** `1 2 3 4 › »` a 390, igual que a 1440 |
| 5 | El patrón de fila repetible | **Hecho, y bien.** Maqueta nueva 5e —`Zone Options › Dynamic Updates` con una política—, su CSS, su fila de regla y su pie de texto |
| 6 | El selector de nodo es condicional | **Hecho**, y además **encabeza** la regla en vez de ir de apéndice: «No se dibuja nada si el servidor no reporta `clusterInitialized`: ni el control ni su hueco» |

**El punto 5 merece una línea aparte porque es el único que era diseño nuevo.**
La caja lleva las etiquetas literales indexadas que el fuente ya nombra —`TSIG key
name 1`, `Domain 1`, `Allowed types 1`—, así que no inventa cabeceras de columna;
el `Remove` es un icono al final de la fila alineado con los campos y no con sus
etiquetas; el `Add Policy` va fuera de la caja y debajo, porque añade a la lista y
no a una fila. Y resuelve el caso vacío sin que se le pidiera, con la excepción
correcta: `Permissions` ya tiene su frase —`No permissions assigned.`, que es la
literal del contrato— y va en caja discontinua de una línea.

Lo declarado intocable sigue intocado: las diez columnas, la fila a 390, las siete
ordenables, el dato caducado, los dos vacíos, las cuatro filas por tipo, el reparto
por permisos y la escala de anchos.

## El defecto nuevo, y es de esta ronda

**En 5e, el `<select>` de `Dynamic Updates` reordena sus opciones.** El fuente
(`screens/zones/options.ts`, `UPDATES`) las declara:

```
Deny (default) · Allow · Allow Only Name Servers In Zone ·
Use Specified Network Access Control List (ACL) ·
Allow Zone Name Servers And Use Specified Network Access Control List (ACL)
```

y 5e dibuja la seleccionada hoisted a la segunda posición: `Deny (default)` ·
**`Use Specified…(ACL)`** · `Allow` · `Allow Only Name Servers In Zone` ·
`Allow Zone Name Servers And…`.

Es un desliz y no una convención, y lo demuestra el propio fichero: 5c pinta
`TRANSFERS` en su orden exacto con `Allow` marcada en su sitio, sin moverla. En un
`<select>` real las opciones no se recolocan por estar elegidas.

Es de la misma familia que el punto 1 que se acaba de arreglar. La diferencia es
el riesgo: esto vive dentro de la maqueta que ilustra **el patrón repetible**, que
es lo que se estaba decidiendo y está bien, y la lista de opciones es un hecho de
contrato que quien porte leerá del fuente y no del dibujo — que es exactamente la
lección del piloto 1: *un contrato no se lee del dibujo que se está juzgando.*

## Una cosa que no vino

El retorno pedía **una línea por corrección en las notas del fichero**. El fichero
no las trae: pasa del bloque de estilos a `z1` y cierra con la lede de siempre.
No es un defecto de diseño y las seis están verificadas aquí una a una, pero deja
sin registro dentro del artefacto qué se tocó en esta ronda.

## Recomendación

**Aceptar.** Los seis puntos están aplicados, el único que pedía diseño nuevo
volvió resuelto y con más de lo que se pidió, y no hay ninguna pérdida de control
ni en la versión original ni en ésta.

El `<select>` de 5e **no merece una ronda propia**: es una línea, está en un dibujo
cuya lista de opciones se leerá del fuente al portar, y el patrón que esa maqueta
existe para decidir es correcto. Se apunta y viaja con el prompt del piloto 3, que
hay que escribir de todas formas.

---

# Tercera vuelta — cerrado

Etag **`1788353202632538`**, 118 672 bytes, 1170 líneas — comprobado antes de leer
nada. Comprobados **sólo los dos puntos**, como se pidió, más que el resto siguiera
en su sitio.

| | Estado |
|---|---|
| **`UPDATES` al orden literal** | **Hecho.** `Deny (default)` · `Allow` · `Allow Only Name Servers In Zone` · **`Use Specified…(ACL)` marcada, en cuarta** · `Allow Zone Name Servers And…`. Exactamente `screens/zones/options.ts::UPDATES` |
| **Las líneas de notas** | **Hecho, y con la séptima.** Sección nueva `Z0`, «Qué cambió en la segunda ronda»: las seis pedidas, más una para la reordenación de opciones, tal como decía el retorno. Con enlaces a `5c`, `5e` y `4b`, y encabezada por «Todo lo demás viene de la primera entrega y no se ha tocado» |

**Y no se ha tocado nada más.** Las 16 líneas de crecimiento son exactamente la
sección `Z0`; el `»` de 4b sigue, el pie de 5a sigue en `[Delete][Cancel]` con su
frase literal intacta, y la tira de pestañas de 5e sigue en el orden del fuente.

## Aceptado

**El piloto 2 queda cerrado el 2026-09-02**, en la versión de etag
`1788353202632538`. Y esta reconciliación caduca igual que las otras dos: en cuanto
el fichero se toque.

Lo que deja resuelto, y que hereda todo lo que venga detrás: **el sistema modal
entero** —los cuatro anchos con su forma, dónde se pinta el error de validación,
qué pasa cuando un diálogo abre otro, la anatomía del `Confirm` y el patrón de fila
repetible—, más el arquetipo de colección con sus cinco estados, el dato caducado y
la ordenación.

**Ninguna decisión de éstas se ha aplicado todavía a `tokens.css`.** Eso es la fase
1.4, cuando esté el piloto 3.

## Lo que costó, para el que venga

Tres vueltas, y las tres por la misma clase de cosa: **el dibujo se desvía del
contrato en detalles que no se ven mirando**. Orden de pestañas, orden de opciones
de un `<select>`, una palabra en un botón, un control que desaparece a un ancho. Ni
uno solo era un problema de diseño; todos eran hechos del código dibujados de otra
manera.

De ahí las dos cosas que conviene repetir en el piloto 3:

1. **Comprobar el etag antes de leer nada**, las tres veces. Sirvió las tres.
2. **Recorrer punto por punto contra el fuente**, no de impresión y no contra el
   DOM. Los siete hallazgos salieron de leer `options.ts`, `Dialog.tsx`,
   `Confirm.tsx`, `Pagination.tsx`, `ZoneList.tsx` y `Zones.tsx`; ninguno se veía
   en una captura.

Y una decisión de método que corrigió a la sesión: **un defecto conocido no se
pospone al piloto siguiente**. Arrastrarlo convierte algo cerrable hoy en ruido del
contrato de mañana. Costó dos líneas cerrarlo aquí.
