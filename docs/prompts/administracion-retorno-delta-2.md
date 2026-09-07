<!-- delta: quita -->
# Administración — segundo retorno: quitar TRES cosas, y nada más

El delta anterior volvió cerrado: los cinco puntos están, y `Cluster Options` y
`Session Timeout` volvieron con más de lo pedido. **Este retorno sólo QUITA.** No
se dibuja nada nuevo, no se traduce nada y no se decide nada.

---

## Lo que NO se toca

- **Las seis decisiones, enteras.** Ninguna se rediscute, **incluidas la 5 y la 6**,
  que son las que este retorno roza: el bloque de `Force` sigue donde está y la
  sección sigue sin candado.
- **`Matrix`** y **`Confirm.force`**, con sus dos justificaciones.
- **Toda la mecánica del bloque de `Force`**: su sitio al final del cuerpo, la
  casilla, **su rótulo literal**, la ayuda de upstream, el **estado armado** con
  filete `--dan`, y que **el verbo del pie no cambie de rótulo**.
- Las 41 columnas, los 21 verbos, las 24 superficies, las 27 ayudas, los 5 sufijos
  y las 10 literales, tal como quedaron.
- `Cluster Options` con sus cinco campos y su campo en estado de validación, y
  `Session Timeout` con su sufijo. **El campo `Quick Add` se queda**; lo que sale es
  la frase que lleva debajo (punto 3).

---

## 1 · Fuera la mitad inventada de los cuatro bloques `Force`

Cada bloque lleva hoy dos mitades. **La de «con ella» es correcta**: es la ayuda
literal de upstream y se queda tal cual, con su «and without inform it» sin
corregir.

**La de «sin ella» se va entera**, y con ella los rótulos `sin ella` / `con ella`.
Dos motivos, y el segundo es el que manda:

1. Está **en castellano**, y toda la interfaz del producto está en inglés. Este
   contrato está en castellano porque es documentación interna; ninguna de sus
   frases puede acabar dibujada.
2. **No existe en el producto.** No hay literal que describa el caso sin forzar —la
   ayuda de upstream sólo dice qué pasa al ACTIVAR la casilla—, así que traducirla
   no lo arregla: seguiría siendo texto que la consola no dice.

Las cuatro frases que se van:

- «El relevo se pacta con el primario actual, que pasa a secundario.»
- «La salida se pacta con el primario: si no contesta, no se hace.»
- Y las dos equivalentes de `Delete Cluster` y `Remove Node`.

**Qué queda en el bloque:** la casilla, su rótulo literal —`Force Delete Cluster`,
`Force Leave Cluster`, `Force Remove Node`, `Force Delete Current Primary Node`—, la
ayuda de upstream, y el estado armado al marcarla.

**La ayuda ya dice lo que hace**, y por eso la mitad inventada sobra. Las cuatro,
enteras:

- «Enabling this option will cause the Secondary node to be deleted from the Cluster without asking the node to leave gracefully.»
- «Enabling this option will cause the current Primary node to be deleted from the Cluster without resyncing complete configuration from it and without inform it.»
- «Enabling this option will cause this Secondary node to leave the Cluster without informing the Primary node.»
- «Enabling this option will cause this Primary node to delete the Cluster for itself even when other Secondary nodes still exist, orphaning them.»

El contraste entre hacerlo y no hacerlo es **razonamiento de diseño** y va en la
prosa del documento, no dibujado como si el producto lo dijera.

---

## 2 · Fuera la barra de sólo lectura de la decisión 6 — **no se traduce**

Hoy lleva: «Ninguna acción de Administración se apaga por permiso. Los seis verbos
de esta tabla se enseñan siempre; si falta el permiso, la respuesta del servidor lo
dice.»

**Se quita, y no se sustituye por una versión en inglés.** La decisión 6 sigue
siendo la correcta —aquí no hay candado— pero su consecuencia se dibuja **no
dibujando nada**:

- **Todos los verbos permanecen visibles y habilitados.**
- **No aparece candado ni explicación añadida.**
- **Un rechazo real se comunica por el `Notifier`**, que ya está dibujado en su caso
  de rechazo y es donde el usuario se entera.

**La ausencia de restricción visual no es un hueco que haya que rellenar con copy.**
Una barra que explica que no hay restricción es una restricción explicada: ocupa
sitio en las seis sub-pantallas para decir que no pasa nada. El `Notifier` ya cubre
el único momento en que el usuario necesita saberlo.

---

## 3 · Fuera la frase de `Quick Add`

En `Edit Node - {nodo}`, bajo el campo `Quick Add`, hay escrito: «No tiene ayuda
propia: la nombra la del campo de arriba, que es la que se copia.»

**La observación es acertada** —ese campo no tiene ayuda en el producto, y la del
campo de arriba ya lo menciona—. El problema es **dónde está**: lleva la clase
`hlp`, la misma que la ayuda real que hay justo encima, así que **se dibuja como
ayuda del producto**. Y entonces es lo mismo que las otras dos: copy inventado, y
en castellano.

Que un campo no tenga ayuda **se dibuja no dibujando ninguna**. Si merece decirse
—y merece—, va como **anotación fuera del producto**: en la etiqueta de la opción o
en la prosa del documento, donde ya viven el resto de las explicaciones.

---

## Qué se entrega

Tres borrados, y nada más:

1. Las cuatro mitades «sin ella» de los bloques `Force`, con sus rótulos.
2. La barra de sólo lectura de la decisión 6, entera.
3. La frase bajo `Quick Add`.

**Nada se traduce, nada se sustituye y nada se dibuja nuevo.** Los tres son el mismo
defecto: texto que la consola no dice, escrito en castellano, dibujado como si el
producto lo dijera.
