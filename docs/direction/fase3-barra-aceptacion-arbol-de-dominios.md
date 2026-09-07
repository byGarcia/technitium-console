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
