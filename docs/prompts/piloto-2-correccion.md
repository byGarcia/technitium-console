# Piloto 2 — corrección, no rediseño

> **Dónde va:** proyecto **«technitium-ui — consola DNS»** en Claude Design, sobre
> `14-piloto-zones.dc.html`, etag `1788348927968722`. Si el etag ya no es ése, el
> fichero se ha tocado desde el recorrido y esta lista hay que rehacerla antes de
> aplicarla.

**El piloto está bien y casi todo se queda exactamente como está.** El recorrido
punto por punto contra el contrato no encontró **ni un control perdido**, que era
lo único innegociable.

Se quedan intactos, y conviene decirlo para que no se toquen al corregir: las diez
columnas y su orden de sacrificio; la fila que deja de ser fila a 390; las siete
columnas ordenables con `Serial` y la decisión de cuándo se ve el icono; la
cabecera realojada como «Sorted by *columna*»; la barra de selección con
`Delete Zones` dentro; los dos vacíos distintos con sus cuatro textos propuestos;
**el dato caducado entero**, que es lo mejor del piloto; las cuatro filas por tipo
de zona; el reparto por permisos; la celda `Data` y `show full`; y **la escala de
anchos**, que acierta al no inventarse nada — 440/560/720/880 son `compact`,
`form`, `medium` y `wide` tal como ya existen, y el reparto por diálogo coincide
uno a uno con la talla actual de los once.

Si al aplicar esto aparece la tentación de recolocar algo más, es señal de que se
está rediseñando. No.

Son **cinco correcciones y una línea que falta**. Cuatro son reversiones a algo que
ya está decidido en el código; sólo la quinta pide diseño nuevo.

---

## 1 · `Zone Options`: las pestañas 2 y 3 están intercambiadas

El fuente (`src/screens/zones/options.ts:23-29`) las declara en este orden, y
`src/screens/zones/modals/ZoneOptions.tsx:139-142` las pinta en orden de array:

```
General · Query Access · Zone Transfer · Notify · Dynamic Updates (RFC 2136)
```

En 5c están dibujadas `General · Zone Transfer · Query Access · Notify · Dynamic
Updates (RFC 2136)`. Basta con devolver `Query Access` a la segunda posición. La
superficie dibujada —la de `Zone Transfer`— se queda como está; sólo cambia el
orden de la tira.

## 2 · El pie de los diálogos vuelve al orden del contrato

Esto es lo único importante de la lista, y **no es una discusión de convención: es
una reversión**.

El orden del pie no es libre. `src/ui/Dialog.tsx` se lo quitó a los modales y se lo dio
al componente, y dejó escrito por qué: cuando era libre, **23 modales ponían la
acción primero y 17 la ponían última**, en cinco de ellos la acción era destructiva,
y `Delete` y `Close` **se intercambiaban entre dos diálogos de la misma pantalla**.
El rincón derecho es donde upstream tiene el descarte en **los 40** modales suyos.

El piloto dibuja el orden contrario en los cinco diálogos que pinta y lo eleva a
regla. La consecuencia es que **`Delete` aterriza exactamente en el punto de la
pantalla donde hoy está `Close`**, y donde lleva estando siempre.

Cambiar una convención de cuarenta modales y poner el botón destructivo donde
estaba el descarte puede ser defendible, pero **es una decisión de producto y no
cabe dentro de un piloto de dirección visual**. Se revierte:

| Diálogo | Ahora | A qué |
|---|---|---|
| 5a · `Delete Zone` | `[Close][Delete]` | **`[Delete][Cancel]`** |
| 5a · `Delete Zones` | `[Close][Delete]` | **`[Delete][Cancel]`** |
| 5b · `Add Zone` | `[Close][Add]` | **`[Add][Close]`** |
| 5c · `Zone Options` | `[Close][Save]` | **`[Save][Close]`** |
| 5d · `DNSSEC Properties` | `[Close]` | sin cambio, no tiene acciones |
| 5d · `Delete Private Key` | `[Close][Delete]` | **`[Delete][Cancel]`** |

La regla general es `[ acciones… ] [ descarte ]`: el verbo primero, el descarte
siempre en el rincón derecho.

**El destructivo sigue en rojo.** Lo que cambia es dónde se sienta, no su color.

Y hay que corregir con ellos los dos sitios donde el documento enuncia el orden
invertido: el pie de texto de 5a («el destructivo va a la derecha y en rojo, el
descarte a su izquierda») y la fila **«Anatomía de `Confirm`»** de la tabla de
decisiones («pie = descarte a la izquierda y verbo a la derecha»).

## 3 · En `Confirm` el descarte se llama `Cancel`, no `Close`

Va con el anterior y es la otra mitad del mismo pie. `src/ui/Confirm.tsx` pasa
`close="Cancel"` a propósito, y `src/ui/Dialog.tsx` lo explica en una línea: **`Cancel`
cuando el modal es una pregunta**, `Close` cuando no lo es.

El piloto escribe `Close` en sus tres `Confirm` — y, sobre todo, **no lo lista
entre los textos propuestos**. Esa tabla es lo que separa un texto que se decide
de un texto que se hereda; un cambio de palabra que no aparece en ella es una
decisión tomada por descuido, que es justo lo que la tabla existe para evitar.

En los tres `Confirm` de 5a y 5d: `Close` → **`Cancel`**. No se añade a la tabla de
textos propuestos, porque deja de ser un texto propuesto.

## 4 · `Last` desaparece a 390 en la paginación de registros

4a (1440) dibuja `1 2 3 4 › »`. 4b (390) dibuja `1 2 3 4 ›`.

`src/ui/Pagination.tsx:68-71` pinta `Last` siempre que haya última página, **sin mirar
el ancho**, y es un solo componente compartido por la lista de zonas, los registros
y Query Logs. Que `First` y `Previous` no salgan es correcto —se está en la página
1 y el componente no los pinta ahí—, pero `»` sí debería estar.

Además contradice la regla que el propio piloto escribe para 390: «Nada se pierde
y nada se mete en un desplegable nuevo». Con cuatro páginas `»` casi sobra; el
dibujo es de cuatro, la pantalla no.

Devolver `»` a 4b.

## 5 · Falta el patrón de fila repetible — y esto sí es diseño nuevo

Es lo único de la lista que no es una reversión, y el único hueco real que deja el
piloto.

Tres diálogos de esta pantalla tienen filas que el usuario añade y quita, y salen
los tres del contrato leído del fuente:

| Diálogo | Las filas | Añadir | Quitar |
|---|---|---|---|
| `AddEditRecord` | `Param key ${i+1}` · `Param value ${i+1}` | `Add Param` | `Remove` por fila |
| `ZoneOptions` | `TSIG key name ${i+1}` · `Domain ${i+1}` · `Allowed types ${i+1}` | `Add Policy` | `Remove` por fila |
| `ZonePermissions` | usuarios y grupos | `Add User` · `Add Group` | `Remove` por fila |

El cierre del documento dice que los diálogos no dibujados «se reparten entre los
cuatro anchos según la regla de arriba y no deberían necesitar decisión nueva».
Es cierto para todo menos para esto: **la fila repetible no es una cuestión de
ancho**. Lo que falta por decidir es dónde se sienta el `Add`, dónde se sienta el
`Remove` de cada fila y qué se ve cuando todavía no hay ninguna fila.

Ojo con `ZonePermissions`, porque tiene una trampa anotada en el contrato:
`Add User` y `Add Group` **no seleccionan, AÑADEN una fila** al cambiar.

Una maqueta basta —`ZoneOptions` en la pestaña `Dynamic Updates` con una política,
que es la más cargada de las tres— más su fila en la tabla de reglas. Como el resto
del sistema modal, esto lo heredan Settings, DHCP y Admin, así que se decide una
vez aquí.

## 6 · Una línea que falta: el selector de nodo es condicional

`src/screens/zones/Zones.tsx:114` lo dice en su comentario: *«Draws nothing without a
cluster»*. Sin `clusterInitialized` **no se dibuja nada**, ni el selector ni un
hueco.

El piloto lo dibuja en las tres maquetas que llevan barra superior y su regla no
dice que pueda no estar. Todo lo demás del selector está bien y no se toca: sin el
agregado «Cluster», sin memoria, y **uno solo** para las dos vistas contra los dos
de upstream.

Es añadir la condición a la fila «Selector de nodo» de la tabla de decisiones. No
hace falta dibujar la variante sin cluster: la barra superior ya se cierra sola sin
él.

Se pide porque es exactamente el hecho cuya ausencia hizo que este selector
estuviera perdido en la consola sin que nadie lo notara.

---

## Qué devolver

**El mismo fichero corregido**, y en las notas **una línea por corrección** diciendo
qué cambió.

Sólo se revisará el delta: lo que no está en esta lista no hace falta volver a
mirarlo, y si cambia, hay que decirlo en esa misma línea.
