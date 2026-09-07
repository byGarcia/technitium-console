# Piloto 2 — dos microcorrecciones, y ya está

> **Dónde va:** proyecto **«technitium-ui — consola DNS»** en Claude Design, sobre
> `14-piloto-zones.dc.html`, etag `1788352586844937`. Si el etag ya no es ése, el
> fichero se ha tocado y hay que volver a mirarlo antes de aplicar esto.

**La ronda anterior está bien y no se toca nada de ella.** Los seis puntos se
aplicaron, y dos volvieron con más de lo que se pidió: la fila repetible resolvió
el caso vacío sin que se le preguntara, y el selector de nodo pasó a encabezar su
regla en vez de ir de apéndice.

Quedan **dos cosas objetivas**, ninguna de diseño. No hay que redibujar nada ni
revisar nada más.

---

## 1 · En 5e, `Dynamic Updates` reordena sus opciones

El `<select>` de la maqueta nueva sube la opción seleccionada a la segunda
posición. El fuente (`src/screens/zones/options.ts`, `UPDATES`) la tiene **cuarta**,
y ese es el orden que hay que dibujar:

```
1  Deny (default)
2  Allow
3  Allow Only Name Servers In Zone
4  Use Specified Network Access Control List (ACL)   ← la seleccionada, y se queda aquí
5  Allow Zone Name Servers And Use Specified Network Access Control List (ACL)
```

En un `<select>` real las opciones no se recolocan por estar elegidas: la marcada
se marca donde esté. **Y el propio fichero ya lo hace bien un poco más arriba**:
5c pinta `TRANSFERS` en su orden exacto con `Allow` seleccionada en su sitio, sin
moverla. Por eso esto es un desliz y no una convención — basta con igualar 5e a lo
que 5c ya hace.

## 2 · Faltan las seis líneas de notas

El retorno anterior pedía **una línea por corrección** en las notas del fichero, y
el fichero no las trae. Son seis, una por punto:

1. `Zone Options` — las pestañas vuelven al orden del fuente, en las dos tiras.
2. El pie de los diálogos vuelve a `[ acciones… ] [ descarte ]`, en los cinco.
3. En `Confirm` el descarte pasa a `Cancel`, y no entra en textos propuestos.
4. `»` vuelve a la paginación de registros a 390.
5. **Nuevo:** el patrón de fila repetible, maqueta 5e y su regla.
6. El selector de nodo declara que no se dibuja sin `clusterInitialized`.

Sirve cualquier sitio visible del documento — una lista corta al principio o al
final—, con tal de que quien lo abra dentro de un mes sepa qué se tocó en esa
ronda y qué venía de la primera.

Si al aplicar el punto 1 cambia algo más, esa línea es la séptima.

---

## Qué devolver

El mismo fichero con esas dos cosas. Nada más: **lo demás está aceptado**, y esta
vez sólo se comprueban estos dos puntos.
