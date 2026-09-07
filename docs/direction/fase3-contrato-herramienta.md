# Contrato del arquetipo HERRAMIENTA — DNS Client, View Logs y Query Logs

Fase 3, superficies 7 y 11 del plan. Las tres van en **una ronda** porque son el
mismo arquetipo y es el único que no tiene piloto: los tres que hay dibujaron
vista general, colección y formulario denso.

Tomado el **2026-09-03**. Regla del proyecto: *sólo diseño, cero funcionalidad*.
Nada de lo que hay aquí puede desaparecer del dibujo que vuelva.

## Cómo leer las marcas de procedencia

Cada hecho lleva de dónde sale, porque no todos valen lo mismo:

| Marca | Qué significa |
|---|---|
| **DOM** | Medido en el navegador contra el bundle `index-Rly3niO_.css` / `index-B76MCc8F.js` |
| **API** | Leído de una respuesta real del servidor del arnés |
| **FUENTE** | Leído del código; incluye las ramas que el arnés no puede provocar |
| **NO OBSERVADO** | Existe en el código y **no se ha visto**. Se dice; no se simula |

Sello del lector: `25508b9bd0ec…`, `dev/screen-contract.mjs` tras la ampliación
del 2026-09-03 (`buttons`, que nombra todos los botones — antes `/dnsclient/`
declaraba `screenActions: []` con cuatro botones en pantalla).

**Valores volátiles**: las cifras del arnés —2826 registros, tres ficheros de log,
1 MB de texto— son de una instancia sembrada a mano. Son magnitudes reales para
dimensionar el dibujo, **no literales del producto**.

---

## 1. DNS Client — `/dnsclient/`

Una barra de consulta y una respuesta. Es la pantalla que se abre **cuando algo ya
ha ido mal**, así que su trabajo es enseñar la respuesta cruda sin interpretarla.

### Controles — 7

| Rótulo | Tipo | Detalle | Procedencia |
|---|---|---|---|
| Cluster Node | desplegable | Sin agregado y **sin persistencia** — al revés que Dashboard y Settings. No se dibuja si no hay clúster | FUENTE · **NO OBSERVADO**: el arnés no lo pintó |
| Server | texto + `datalist` | Valor inicial `This Server {this-server}`. La lista **rellena**, no restringe: se puede escribir una dirección que no esté | DOM |
| Domain | texto | `placeholder: example.com` | DOM |
| Type | desplegable | **28 opciones**: A, NS, CNAME, SOA, PTR, MX, TXT, RP, AAAA, SRV, NAPTR, DNAME, DS, SSHFP, RRSIG, NSEC, DNSKEY, NSEC3, NSEC3PARAM, TLSA, ZONEMD, SVCB, HTTPS, URI, CAA, ANY, AXFR, ANAME | DOM |
| DNS-over- | desplegable | **5**: UDP, TCP, TLS, HTTPS, QUIC. El rótulo está **cortado a propósito**: se lee con el valor, «DNS-over-UDP» | DOM |
| EDNS Client Subnet | texto | Sin ayuda ni placeholder | DOM |
| Enable DNSSEC Validation | casilla | **Marcada por defecto** | DOM |

Ninguno de los seis observados tiene texto de ayuda. **No es un olvido del
volcado: no lo hay.** En una pantalla con 28 tipos de registro y 5 transportes, es un hueco que
el dibujo puede querer llenar — pero llenarlo es *añadir*, y eso no lo decide el
diseño.

### Verbos — 2

`Resolve` (primario) e `Import`. **Llaman al mismo endpoint**; `Import` sólo añade
`import=true`, y lo que importa son los registros resueltos al servidor. Los dos
se apagan mientras la consulta está en vuelo. FUENTE + DOM.

### Ramas — 8, y sólo tres observadas

| # | Rama | Qué se ve | Procedencia |
|---|---|---|---|
| 1 | vacía | `Run a query to see the response.` | **DOM** |
| 2 | respuesta | Panel `Response`, con `{protocolo} · {tipo}` como acción, y un `<pre>` de JSON | **DOM** |
| 3 | respuesta + crudas | Desplegable `Raw Responses (N)`, **plegado**, sólo si hay. Es lo que enseña qué contestó cada servidor del camino | FUENTE · **NO OBSERVADO** |
| 4 | aviso | `Warning!` + el `warningMessage` del servidor, **con la respuesta debajo** | **DOM** + API |
| 5 | importado | `Records Imported!` — «Resource records resolved by this DNS client query were successfully imported into this server.» Sólo en `Import` y **sólo si no hubo aviso** | FUENTE · **NO OBSERVADO** |
| 6 | falta servidor | `Missing!` — «Please enter a valid Name Server.» | FUENTE · **NO OBSERVADO** |
| 7 | falta dominio | `Missing!` — «Please enter a domain name to query.» | FUENTE · **NO OBSERVADO** |
| 8 | fallo | El aviso del fallo, y **la respuesta anterior se borra** | FUENTE · **NO OBSERVADO** |

El **orden de validación es de upstream**: primero el servidor, luego el dominio.
Cambiarlo es cambiar comportamiento.

La rama 4 es la que hay que mirar con cuidado: **un `Warning!` y una respuesta
válida conviven**. No es «o error o dato».

---

## 2. Logs › View Logs — `/logs/view-logs/`

Maestro–detalle: la lista de ficheros a la izquierda, el visor a la derecha.
Medido a 1440: `250px 910px`. DOM.

### Verbos — 4, y tres de ellos con condiciones distintas

| Verbo | Dónde | Condición | Permiso |
|---|---|---|---|
| Delete All Logs | encabezado, destructivo | **Sólo si hay ficheros** (`logs.js:121`) | `Logs.canDelete` |
| Delete All Stats | encabezado, destructivo | **Siempre** (`logs.js:117`) | `Dashboard.canDelete` — **de otra sección** |
| Download | panel del visor | Con un fichero abierto | — |
| Delete | panel del visor, destructivo | Con un fichero abierto | `Logs.canDelete` |

**Los tres con permiso DESAPARECEN hoy si falta.** Es el mismo defecto que se
corrigió en `Settings` el 2026-09-03 y la misma regla de la fase 1 —*deshabilitado,
nunca escondido*—, así que **entra en el alcance de esta ronda**: siguen estando,
apagados, con candado y nombrando el permiso. FUENTE.

### Ramas

| Rama | Qué se ve | Procedencia |
|---|---|---|
| cargando | `Loading` mientras llega la lista | FUENTE · **NO OBSERVADO** |
| sin ficheros | `No Log File Was Found` | FUENTE · NO OBSERVADO |
| **fallo al listar** | `Unable to load the log files.` — texto **distinto** del vacío, en el mismo sitio. Es la distinción «vacío ≠ error» de la fase 1, ya resuelta aquí | FUENTE · NO OBSERVADO |
| lista | Tres ficheros, cada uno `nombre [tamaño]`, y el abierto marcado con `aria-current` | **DOM** |
| visor cargando | `Loading` dentro del panel del visor | FUENTE · **NO OBSERVADO** |
| visor | `<pre>` con el texto del fichero | **DOM** |
| **error dentro del visor** | El error del servidor se pinta **en el visor, como JSON**, no como aviso. No es un descuido: el endpoint devuelve texto y ése es el único sitio (`logs.js:170-172`) | FUENTE · NO OBSERVADO |

### El dato que el dibujo no puede ignorar

El visor cargó **1.051.921 caracteres en un solo `<pre>`**. DOM. Upstream pide
sólo 2 MB al servidor precisamente por esto, y `Download` es otra llamada distinta
para el fichero entero. Un dibujo que trate ese panel como un párrafo está
dibujando otra cosa.

### Confirmaciones — 3, con literales propios

- `Delete Log` — «Are you sure you want to permanently delete the log file '{nombre}'?» · botón `Delete`
- `Delete All Logs` — «…permanently delete all log files?» · botón `Delete All Logs`
- `Delete All Stats` — «…permanently delete all stats files?» · botón `Delete All Stats`

Y tres avisos de éxito: `Log Deleted!`, `Logs Deleted!`, `Stats Deleted!`. FUENTE.

---

## 3. Logs › Query Logs — `/logs/query-logs/`

Un **formulario de filtro de 14 controles** sobre una tabla de 10 columnas con
paginación. Es la superficie más densa de las tres.

### Controles — 15 con `Live Update`

`Live Update` · `App Name` · `Class Path` · `From` · `To` · `Order` · `Domain`
(placeholder `example.com or *.com`) · `Type` (placeholder `A, AAAA, etc.`) ·
`Class` · `Client IP Address` · `Protocol` · `Response Type` · `RCODE` ·
`Page Number` · `Logs Per Page`. DOM.

### Verbos — 3

`Query` (primario) · `Export` · `Reset`. DOM.

### Las cinco reglas de upstream que son contrato

1. **Los dos avisos de «falta la app» NO dicen lo mismo.** El de `Query` termina
   en «…from the Apps section.»; el de `Export`, no (`logs.js:391` vs `614`).
   Uniformarlos sería cambiar un texto.
2. **Orden de validación de `Query`**: app, clase, `From`, `To`. `Export` sólo
   valida los dos primeros — **no mira las fechas**.
3. **`Live Update` no es refrescar: es un MODO.** Al marcarlo fija página 1 y
   orden descendente, **vacía `From` y `To`**, apaga esos cuatro controles y el
   botón `Query`, y vuelve a consultar cada 2 s. Al desmarcarlo **reinicia el
   formulario entero**, no sólo esos campos.
4. **`Logs Per Page` se recuerda** en `localStorage` (`optQueryLogsEntriesPerPage`)
   y se relee en cada reset. El valor por defecto del formulario es **10**, no el
   25 del servidor.
5. **La última página se pide con `pageNumber=-1`** y la resuelve el servidor.

La 3 es la que toca este rediseño de frente: **cuatro controles y un verbo
apagados por un interruptor maestro** es exactamente la señal que se cerró en
`Settings` el 2026-09-03 —filete ámbar, opacidad y una pastilla que NOMBRA el
interruptor—. Aquí la pastilla diría `Needs Live Update` al revés: están apagados
porque el maestro está ENCENDIDO. El dibujo tiene que resolver ese caso, que la
primitiva hoy no cubre.

### La tabla — 10 columnas

`#` · `Timestamp` · `Client IP Address` · `Protocol` · `Response Type` · `RCODE` ·
`Domain` · `Type` · `Class` · `Answer`. DOM.

`Response Type` lleva además el tiempo de ida y vuelta debajo, entre paréntesis y
en ms, cuando lo hay. La raíz se escribe con un punto (`logs.js:518`). FUENTE.

### El código de color de las filas — SIETE, y sin leyenda

| Clase | Cuándo | Color |
|---|---|---|
| `rServerFailure` | RCODE ServerFailure | `rgba(217, 83, 79, .1)` |
| `rBlocked` | NXDOMAIN **y** tipo bloqueado | `rgba(255, 165, 0, .1)` |
| `rNxDomain` | NXDOMAIN sin bloqueo | `rgba(120, 120, 120, .1)` |
| `rRefused` | RCODE Refused | `rgba(91, 192, 222, .1)` |
| `rAuthoritative` | tipo autoritativo | `rgba(150, 150, 0, .1)` |
| `rRecursive` | tipo recursivo | `rgba(23, 162, 184, .1)` |
| `rCached` | tipo cacheado | `rgba(111, 84, 153, .1)` |

**Cuatro observadas en el arnés** (ServerFailure, Cached, NxDomain, Authoritative);
las otras tres, FUENTE.

Dos cosas que esto plantea, y las dos son de diseño:

- **Ninguna tiene leyenda.** La regla de la fase 1 es explícita: *toda etiqueta
  del servidor lleva su entrada de leyenda*. Aquí hay siete colores que el usuario
  ve y nada que los explique.
- **Los siete valores están escritos a mano, fuera de la escala de tokens.** Es
  deuda de la fase 2 que no se tocó porque vive en una pantalla que aún no se
  había rediseñado.

### Sus estados

Los quince del reparto —ocho de DNS Client y siete de View Logs— **no incluyen los
de ésta**, y hay que decirlo en vez de dejar que el número lo tape. Query Logs
responde por cinco más:

| Estado | Qué se ve | Procedencia |
|---|---|---|
| reposo | El formulario **sin tabla**: los resultados no existen hasta consultar | **DOM** |
| con resultados | Tabla de 10 columnas, estado arriba y abajo, paginación arriba | **DOM** |
| sin resultados | Consulta válida que no devuelve nada | FUENTE · **NO OBSERVADO** |
| falta la app | Dos avisos **distintos** según el verbo | FUENTE · **NO OBSERVADO** |
| modo `Live Update` | Cuatro controles y `Query` apagados, `From` y `To` vaciados, consulta cada 2 s | FUENTE · **NO OBSERVADO** |

### El estado y la paginación

`2826-2817 (10) of 2826 logs (page 1 of 283)` — literal medido, con las cifras
volátiles. Va **arriba y abajo de la tabla**, y la paginación **sólo arriba**. DOM.

### Lo que NO está, y se dice

El menú de cada fila de upstream —`Query DNS Server`, `Allow Domain` /
`Block Domain` (`logs.js:539-552`)— **no existe en esta consola**. Sus tres
acciones viven en otras pantallas y no hay forma de invocarlas desde aquí sin
tocar el Shell. Está anotado como hueco de integración, no medio resuelto. **No es
alcance de esta ronda**: dibujarlo sería inventar funcionalidad.

---

## Lo que este contrato tiene de nuevo frente a los tres pilotos

Esto es lo que decide que la ronda haga falta. Ninguno de los tres pilotos
—vista general, colección, formulario denso— dibujó nada de esto:

1. **Una superficie de salida cruda.** Un `<pre>` de JSON en DNS Client y uno de
   texto de un megabyte en View Logs. No hay precedente.
2. **Un plegable** — `Raw Responses (N)`.
3. **Maestro–detalle a dos paneles a la vez.** El piloto 2 navega de la lista al
   detalle; aquí conviven.
4. **Un formulario de filtro de 14 controles** encima de una tabla. El piloto 2
   dibujó una barra de filtro, no un formulario.
5. **Un modo que apaga controles**, con la polaridad invertida respecto a la señal
   del maestro que ya existe.
6. **Un código de color de filas de siete valores sin leyenda.**

## Cautelas para quien mida esto después

`dependencies()` del lector **pulsa las casillas** para descubrir qué apaga qué. En
Query Logs eso marca `Live Update`, que **lanza una consulta y arranca el ciclo de
2 s**. Un volcado de esa pantalla tomado sin saberlo trae 23 botones —diez de
paginación— donde en reposo hay **11**: tres verbos y ocho disparadores de
desplegable. Por eso el volcado bueno se tomó SIN `dependencies()`.

Y una segunda: el primer volcado de Query Logs se tomó a 1200 ms y salió con
`state: loading`, **cero rótulos y cero botones**. Una pantalla que aparece vacía
por una espera corta no es una pantalla vacía. Se repitió a 3000 ms.
