# Rediseño: DNS Client + Logs — arquetipo: herramienta

Las **dos últimas superficies grandes** del recorrido, en **una sola ronda**. Van
juntas porque son el mismo arquetipo y es el único de los cuatro que no tiene
piloto: los tres que hay dibujaron vista general, colección y formulario denso.

Son tres pantallas: `DNS Client`, y las dos sub-pestañas de `Logs` —`View Logs` y
`Query Logs`—.

## La regla que gobierna esta consola

Sustituye a la consola que trae Technitium DNS Server, y **el comportamiento no
puede cambiar**. Se puede recolocar, reagrupar, cambiar el aspecto, cambiar qué
componente lleva qué, y cambiar densidad y jerarquía. **No** se puede quitar un
campo, dejar caer una ayuda, reescribir un rótulo, añadir un paso ni inventar una
ruta.

La paridad se juzga **contra upstream**, no contra esta consola: si algo está aquí
porque upstream lo tiene, sigue estando.

## ESTE ENCARGO ESTÁ ACOTADO. Léelo antes que nada

Es la cuarta ronda y las tres anteriores ya decidieron casi todo. Este encargo
**no vuelve a abrir nada de eso**. Lo que se pide es corto y concreto.

### Lo que se HEREDA y no se discute

- **La dirección** de la fase 1 (anexo A). Es la entrada, no material opinable.
- **Las primitivas** de la fase 2, cerradas el 2026-09-03. Se usan, no se
  rediseñan: `Alert` · `Button` · `Check` · `ClusterNodeSelect` · `Confirm` ·
  `Details` · `Dialog` · `EditableTable` · `Empty` · `Externo` · `Field` ·
  `FooterLinks` · `Form` · `Icon` · `Menu` · `Notifier` · `Pagination` · `Panel` ·
  `PanelForm` · `SectionHeader` · `SectionIndex` · `Segmented` · `Select` ·
  `SessionCells` · `Table` · `Tag` · `Tooltip`.
- **El cromo** —lateral, cabecera, pie, menú de cuenta—, ya dibujado y construido.
- **La tabla, la paginación, el panel, el campo, la casilla, el aviso y la
  pastilla**, tal como quedaron. Query Logs usa la MISMA tabla que Zones.
- **La señal del interruptor maestro**, cerrada el 2026-09-03: filete ámbar en el
  canto de la fila, la opacidad que ya trae el control apagado, y una pastilla que
  **nombra** el interruptor. *Ámbar = puedes; candado = no puedes.*
- **El botón sin permiso**: sigue estando, apagado, con candado, y diciendo qué
  permiso falta. No desaparece.

Si algo de esa lista aparece redibujado en el retorno, el retorno se rechaza por
eso solo. No es rigidez: es que ya se pagó decidirlo.

### Lo que hay que diseñar — SEIS patrones, y nada más

Son los seis que ningún piloto dibujó. **El encargo es éstos**:

1. **La superficie de salida cruda.** Un bloque de texto preformateado que no se
   interpreta: el JSON de la respuesta en DNS Client y el texto del fichero en
   View Logs. Cómo se enmarca, cómo se desplaza, qué pasa con las líneas largas.
   **Dato duro: el visor cargó 1.073.928 caracteres en un solo bloque.** Un dibujo
   que trate ese panel como un párrafo está dibujando otra cosa.
2. **El plegable** — `Raw Responses (N)`, cerrado por defecto, y que sólo existe
   cuando hay algo dentro.
3. **El maestro–detalle a dos paneles a la vez.** La lista de ficheros y el visor
   conviven en pantalla; hoy `250px 910px` a 1440. Qué pasa a 390, donde no caben
   los dos.
4. **El formulario de filtro de catorce controles** encima de una tabla. No es la
   barra de filtro del piloto 2: es un formulario, y hay que decidir su agrupación
   y su jerarquía.
5. **El modo que apaga**, con la polaridad INVERTIDA respecto a la señal heredada.
   `Live Update` apaga cuatro controles y un verbo **por estar ENCENDIDO**. La
   señal del maestro dice «esto lo puedes encender tú»; aquí hay que decir «esto
   está apagado porque otra cosa está activa», que no es lo mismo. **Es el único
   punto donde se admite extender una primitiva cerrada**, y hay que justificarlo.
6. **El código de color de filas de siete valores, y su leyenda.** Hoy son siete
   fondos y **ninguna leyenda**, contra la regla de la fase 1 —*toda etiqueta del
   servidor lleva su entrada de leyenda*—. Hay que resolver las dos cosas: qué
   colores, y cómo se explican.

### Lo que se mantiene completo aunque no se rediseñe

Las **tres pantallas enteras** tienen que aparecer en el retorno, con **sus 23
controles y sus 9 verbos**, aunque la mayoría de esos elementos se dibuje con lo
heredado y sin decisión nueva. El encargo son los seis patrones; **la entrega es
la pantalla completa**, porque un patrón dibujado suelto no dice dónde va.

Y con **sus veinte estados**: las **quince ramas** de DNS Client y View Logs —de
las que **diez no se han observado y aun así hay que dibujarlas**— más los **cinco
estados de Query Logs**. Un retorno que sólo enseñe el caso bueno no vale: la
mitad del trabajo de esta consola es que un fallo no se dibuje como un vacío.

### Una entrega y una reconciliación

**Una sola entrega**, con las tres pantallas y sus veinte estados, **a 1440 y a
390 px**. Después, **una sola reconciliación**: se coteja contra el anexo C punto
por punto y se corrige lo que incumpla. No hay rondas intermedias de opinión.

## Cómo leer lo que viene, que es la mitad del encargo

Lo que sigue viene de **cuatro sitios distintos** y las marcas no son decorativas:

| Marca | De dónde salió | Qué garantiza |
|---|---|---|
| **DOM** | Medido en la pantalla con la herramienta del repositorio | Que eso está ahí hoy |
| **API** | La respuesta real del servidor | Lo que el servidor manda |
| **FUENTE** | Leído en el código | Lo que ninguna de las dos anteriores puede decir |
| **NO OBSERVADO** | Ni medido ni capturado | **Existe, y esta captura no lo prueba** |

Las referencias del tipo `QueryLogs.tsx:118` son **procedencia, no enlaces**: dicen
de dónde salió el dato. No hace falta abrirlas ni se puede.

### Los números son contexto, no contrato

La instancia de la que salió esta captura la sembré a mano. Por tanto:

- `2828` consultas, `283` páginas, los tres ficheros de log y sus tamaños,
  `1.073.928` caracteres, `casa.test`, `127.0.0.1`, `Query Logs (Sqlite)` y
  `QueryLogsSqlite.App` **son de mi laboratorio**.
- Lo que **sí** es contrato: los **rótulos**, las **opciones**, las **relaciones**,
  las **reglas** y la **forma**.
- Las magnitudes —un millón de caracteres, 283 páginas, 28 tipos de registro— **sí
  importan para dimensionar**: son reales, aunque los valores concretos no lo sean.

Donde el contrato dice **volátil**, es exactamente eso.

## A qué viene quien abre estas pantallas

**Arquetipo: herramienta.** Las tres se abren **cuando algo ya ha ido mal**. Nadie
entra en DNS Client a admirar una respuesta correcta ni en Query Logs a pasear:
se entra a averiguar por qué un nombre no resuelve.

De ahí sale lo que gobierna el arquetipo, y es lo contrario de la vista general:
**aquí no se resume, se muestra**. El dato crudo es el producto. Una respuesta
DNS «presentada bonita» con la mitad de los campos plegados es exactamente lo que
hace inútil la pantalla, porque el campo que hacía falta es siempre el que no se
enseñó.

Y una consecuencia concreta que el contrato recoge: **en DNS Client un `Warning!`
puede convivir con una respuesta válida**. No es «o error o dato». El dibujo tiene
que dejar sitio a los dos a la vez.

## Qué hay que devolver

1. **Las tres pantallas completas**, a **1440 y a 390 px**, con los 23 controles y
   los 9 verbos colocados.
2. **Los veinte estados** dibujados.
3. **Una decisión escrita, y sólo una línea, por cada uno de los seis patrones**:
   qué se decidió y qué mantiene junto o separado. No hace falta más.
4. Si algo necesita una primitiva que no está en la lista heredada —y el punto 5
   probablemente la necesite—, **se dice y se justifica**, no se dibuja como si ya
   existiera. Así se decidieron `Tooltip` y `SectionIndex`.

El retorno se juzga contra el **anexo C**, que va incluido para que no haya
sorpresa.

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

# Anexo B — el contrato de las tres pantallas

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

---

# Anexo C — la barra de aceptación

# Barra de aceptación — arquetipo herramienta

Esto es contra lo que se juzga el retorno. Va incluido en el encargo a propósito:
una barra que sólo conoce quien corrige convierte la reconciliación en una
sorpresa, y esta ronda tiene **una sola**.

Un dibujo que vuelva se acepta si, y sólo si:

- **Los 23 controles siguen ahí** —7 en DNS Client, **1** en Logs y 15 en Query
  Logs— con su rótulo literal, sus opciones y sus placeholders. Ninguno se funde
  con otro ni cambia de tipo. *View Logs no tiene ninguno*: su «lista» son botones,
  y el `Cluster Node` de Logs lo monta el contenedor y lo comparten las dos
  sub-pestañas.
- **Los 9 verbos siguen ahí** —2 + 4 + 3—, incluidos los tres que hoy desaparecen
  sin permiso, que vuelven **apagados y con candado**, nombrando el permiso.
- **Las 15 ramas están dibujadas** —8 de DNS Client y 7 de View Logs—, incluidas
  las diez que **no se han observado**. Un dibujo que sólo enseñe el caso bueno no
  vale.
- **Y los 5 estados de Query Logs**, que esas quince no cubren: reposo sin tabla,
  con resultados, sin resultados, «falta la app» y el modo `Live Update`.
- **Vacío y error no se dibujan igual** en ningún sitio; en View Logs ya son dos
  textos distintos y siguen siéndolo.
- **Los siete colores de fila tienen leyenda**, o el dibujo dice por qué no.
- **Los cinco comportamientos de upstream se respetan**: los dos textos distintos
  de «falta la app», el orden de validación, `Live Update` como modo, el valor
  recordado por página y el `-1` de la última página.
- **Las literales no se reescriben.** Ni las de las confirmaciones, ni las de los
  avisos, ni `No Log File Was Found`, ni `Run a query to see the response.`
- **Entrega a 1440 y a 390.**
- **No se rediseñan las primitivas ya cerradas**: panel, tabla, campo, casilla,
  aviso, pastilla, paginación y la señal del interruptor maestro.
- **Viene una línea por cada uno de los seis patrones**, diciendo qué se decidió.
  Sin eso hay dibujo pero no hay decisión, y la reconciliación no tiene contra qué
  cotejar lo que se pidió.
- **Si el patrón 5 necesita extender una primitiva, se dice y se justifica.** Es el
  único punto donde se admite, y admitirlo en silencio es peor que no admitirlo.
