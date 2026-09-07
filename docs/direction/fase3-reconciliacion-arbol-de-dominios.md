# Reconciliación — árbol de dominios (Cache, Allowed y Blocked)

**Fecha:** 2026-09-07 · **Entrega:** Claude Design, ficheros `19`–`22` +
`arbol.css` · **Se juzga contra:** `fase3-barra-aceptacion-arbol-de-dominios.md`

La entrega va en **cuatro ficheros y una hoja compartida**, no en uno. No es una
decisión de diseño: un `.dc.html` se sube con su contenido en la llamada, y la
entrega entera —154 KB con el cromo repetido en 23 dibujos— no cabe en una. Se
parte por tamaño, con el mismo índice en los cuatro. El CSS de la ronda vive en
`arbol.css` para que una corrección no obligue a reescribir los cuatro dibujos;
la primera ya se aprovechó de ello.

| | |
|---|---|
| `19-fase3-arbol-de-dominios` | Las decisiones, la identidad comparada, las seis confirmaciones, los dos diálogos de importar y los quince avisos |
| `20-fase3-arbol-1440-poblado` | El reparto: Cache en la raíz y en un nodo, Allowed y Blocked |
| `21-fase3-arbol-estados` | Vacío ×2, carga, fallo con dato previo y fallo sin él |
| `22-fase3-arbol-390` | Los seis dibujos a 390 |

## Lo que no podía faltar — comprobado

| Punto de la barra | Cómo queda |
|---|---|
| Las tres dibujadas y distinguibles sin leer el título | ✓ `b1a`–`b1d`, y la comparación lado a lado en `b4`. **Tres canales**: icono, segunda línea de la banda y filete de color |
| Los nueve verbos, cada uno en su pantalla | ✓ comprobado por script contra `Lists.tsx`: `>Flush Cache<`, `>Allow<`, `>Block<`, `>Import<`, `>Export<`, `>Flush<`, `>Refresh<`, `>Delete<`, `>Browse<` |
| `Domain` + `Browse` con `example.com` | ✓ en los doce dibujos de pantalla |
| Los dos textos del vacío, en filas distintas | ✓ `b2a` y `b2b`, y el segundo otra vez a 390 en `b3c` |
| Las seis confirmaciones y los avisos, verbatim | ✓ `b5a`–`b5f` y la tabla de quince avisos. Comprobado carácter a carácter contra `Lists.tsx` y `lib/notice.ts` |
| El diálogo de importar, los dos | ✓ `b5g` y `b5h`, con `into Allowed Zone` en mayúscula y `into blocked zone` en minúscula |
| DNSSEC sólo en Cache | ✓ la columna, el estado por registro, `RRSIG` y `show full` están en `b1a`/`b1b`/`b3a` y en ninguna otra |

## Lo que tenía que resolver — comprobado

1. **El árbol es el objeto principal.** Deja de ser un panel pequeño arriba a la
   izquierda: columna de 328 px de altura completa, con el campo arriba y el
   recuento debajo. Medido en el navegador: `328px 1054px` a 1440 sin raíl,
   `328px 838px` con él.
2. **Se ve dónde estás.** Tira de camino sobre la tabla —`NODE <ROOT> › net ›
   example.net › ads.example.net`—, ancestros en `--mute` y nodo actual en
   `--ink`. **No navega**: navegar es del árbol.
3. **`Flush` pesa más que `Delete`.** `Flush`/`Flush Cache` es el único botón
   relleno en rojo y va separado por un filete al final de la cabecera; el
   `Delete` del nodo sigue siendo `sm` de contorno en la barra de recuento.

## Los cuatro estados

Poblado, vacío, carga y fallo, en las tres pantallas y a los dos anchos. Carga se
dibuja con **borde continuo** y `role="status"`, nunca con el discontinuo del
vacío; el fallo se cuenta **una sola vez** —tira con hora y `Retry` si hay dato
previo, aviso con el mensaje del servidor si no—.

## Los dos anchos

- **1440.** Dos columnas de la misma altura.
- **390.** Se apilan, el árbol primero, y **no se esconde ninguno de los dos
  lados**: el panel del árbol deja de estirar y pasa a tope de 250 px con scroll
  propio, para que los registros no queden siempre bajo la línea de flotación. La
  tabla scrollea en horizontal dentro de su caja y el cuerpo de la página no.

## Lo único que hay que ratificar

`--ch-cache` (rosa) y `--ch-block` (violeta) **ya significan** «cached» y
«blocked» en el gráfico del Dashboard y en las filas de Logs: usarlos aquí es
decir lo mismo con el mismo color. **`Allowed` no tiene serie propia** —no es un
`RCODE`— y toma `--ch-ok` (verde), que hoy significa `NoError`. Es una extensión,
no un precedente, y es la única decisión de color de la ronda que no se apoya en
uno. Descartados a propósito: el ámbar (significa «esto es tuyo para cambiarlo»)
y el rojo (significa error, y aquí ya tiene dos trabajos).

## Dos defectos corregidos durante la verificación

- La clave pública de un `DNSKEY` es **un solo token** y se salía de su celda
  montándose sobre la columna DNSSEC. `overflow-wrap:anywhere` en el valor.
- A 390, con ese `overflow-wrap`, la columna `Data` se quedaba en ~70 px y el
  valor se partía carácter a carácter: la fila medía miles de píxeles. El ancho
  mínimo de la tabla sube de 520 a 760 px, que es lo que pide su contenido.

## Dos hallazgos que van al paso de construir, no a este

- **La barra de recuento de los registros dice `0 records at <ROOT>` con la
  petición en vuelo**, que es exactamente la imagen de una lista vacía. Al árbol
  se le arregló el 2026-09-07 y a este lado le faltaba. El dibujo (`b2c`, `b3d`)
  lo enseña ya corregido y va marcado **CAMBIA LO CONSTRUIDO**.
- **`src/screens/lists/Lists.tsx` conserva identificadores en castellano** —
  `esCache`, `esAllowed`, `pedirFlushCache`— que `dev/check-language.mjs` no ve.

## Lo que NO se ha tocado

Ni un control cambia de pantalla, no aparece un paso que upstream no tenga,
`Settings › Blocking` no se roza, y **ni un literal se reescribe**: las minúsculas
de `blocked zone`, `allowed zone` e `into blocked zone` van como están.
