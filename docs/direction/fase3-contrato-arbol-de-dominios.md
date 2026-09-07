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
