# Rediseño: Dashboard + cromo + Login — arquetipo: vista general

Es la **primera superficie** del recorrido. El cromo va con ella y no después,
porque la primera pantalla se dibuja dentro de él.

## La regla que gobierna esta consola

Sustituye a la consola que trae Technitium DNS Server, y **el comportamiento no
puede cambiar**. Se puede recolocar, reagrupar, cambiar el aspecto, cambiar qué
componente lleva qué, y cambiar densidad y jerarquía. **No** se puede quitar un
campo, dejar caer una ayuda, reescribir un rótulo, añadir un paso ni inventar una
ruta.

Un tooltip puede mostrar un nombre **que ya existe** —el rótulo de un botón que
sólo tiene icono, un valor truncado entero—. No puede explicar nada nuevo ni
sustituir a un rótulo visible.

La paridad se juzga **contra upstream**, no contra esta consola: si algo está aquí
porque upstream lo tiene, sigue estando.

## Cómo leer lo que viene, que es la mitad del encargo

Lo que sigue viene de **cuatro sitios distintos** y las marcas no son decorativas.
Mezclarlas es como un dato de mi laboratorio acaba dibujado como si fuera la
pantalla:

| Marca | De dónde salió | Qué garantiza |
|---|---|---|
| **DOM** | Medido en la pantalla con la herramienta del repositorio | Que eso está ahí hoy |
| **API** | La respuesta real del servidor | Lo que el servidor manda |
| **FUENTE** | Leído en el código | Lo que ninguna de las dos anteriores puede decir |
| **NO OBSERVADO** | Ni medido ni capturado | **Existe, y esta captura no lo prueba** |

Las referencias del tipo `Dashboard.tsx:142` son **procedencia, no enlaces**: dicen
de dónde salió el dato. No hace falta abrirlas ni se puede.

### Los números son contexto, no contrato

**La instancia de la que salió esta captura estaba vacía y la sembré a mano** con
consultas de prueba desde tres máquinas. Por tanto:

- `304`, `66`, `21.71%`, `firmada.test`, `catalogo.test`, `127.0.0.1`,
  `172.23.0.2`, `A`, `SOA`, `NS`, `Udp`, `Total Groups: 1`, `Total Sessions: 1`
  y cualquier otra cifra o nombre de dato **son de mi laboratorio**.
- Lo que **sí** es contrato: los **rótulos**, las **relaciones**, las **reglas** y
  la **forma**.
- Si el diseño vuelve con «304» dibujado como si fuera el contenido de la
  pantalla, ha copiado mi instancia en vez de la pantalla.

Donde el contrato dice **volátil**, es exactamente eso.

## La dirección — cerrada en la fase 1, no se reabre

Tres pilotos la fijaron. Va entera más abajo, en el anexo A. **No es material
opinable en este encargo**: es la entrada.

## Las primitivas — cerradas en la fase 2, no se rediseñan

Esta consola ya tiene su juego de componentes, construido y medido, y la fase 2
se cerró el 2026-09-03. **Este encargo no las rediseña.** Se usan.

`Alert` · `Button` · `Check` · `ClusterNodeSelect` · `Confirm` · `Details` ·
`Dialog` · `EditableTable` · `Empty` · `Externo` · `Field` · `FooterLinks` ·
`Form` · `Icon` · `Menu` · `Notifier` · `Pagination` · `Panel` · `PanelForm` ·
`SectionHeader` · `SectionIndex` · `Segmented` · `Select` · `SessionCells` ·
`Table` · `Tag` · `Tooltip`

Las que este encargo toca, y para qué sirve cada una:

| Primitiva | Qué es |
|---|---|
| `Panel` | La caja con borde y su título. Es lo que hace una región |
| `Segmented` | Elegir UNO de unos pocos valores, todos a la vista. **Cambia lo que se ve** |
| `SectionIndex` | El índice de una pantalla larga. **No cambia nada, mueve la rueda.** No es `Segmented` y no se le parece a propósito |
| `Menu` | El menú desplegable, con su separador. Lo destructivo vive **dentro** |
| `Confirm` | La confirmación: título, texto, un verbo y `Cancel` |
| `Dialog` | El diálogo, con **cuatro anchos** por contenido: 440 pregunta · 560 formulario corto · 720 formulario con ramas · 880 el que enseña una tabla |
| `Table` | La tabla de datos, con su ordenación |
| `Empty` | Los tres huecos: vacío, cargando y fallo |
| `Alert` | El aviso, con su tipo y su icono |
| `Tag` | La pastilla de estado. **Una pastilla dice UN estado** |
| `Tooltip` | El refuerzo visual de un nombre que ya existe |
| `Button`, `Field`, `Icon` | Lo evidente |

**Lo que se pide es una disposición, no un juego de componentes nuevo.** Si el
diseño necesita algo que no está en esa lista, **hay que decirlo y justificarlo**,
no dibujarlo como si existiera: una primitiva nueva se decide aparte y con su
motivo, que es como se decidieron `Tooltip` y `SectionIndex`.

## Esta superficie

**Arquetipo: vista general.** A qué viene quien la abre: *a saber, de un vistazo,
si su DNS está sirviendo bien — y si algo va mal, a ver qué.*

Y de ahí sale la trampa que esta pantalla tiene y ninguna otra: **un fallo
dibujado como ceros dice «tu DNS no recibe tráfico»**. Es la mentira más cara de
la consola y la más fácil de creer, porque se parece exactamente a una respuesta
normal.

### Lo que hay, entero

Va en el **anexo B**, completo y sin resumir. Se entrega entero a propósito: lo
que se resume es lo que se pierde.

Trae, atado a cada cosa y no simplemente al lado: su **ayuda**, sus **opciones**,
**de qué depende**, las **acciones que operan sobre ella**, y **qué es volátil**.

### Los estados por los que tiene que responder

**Siete ramas más el estado mixto.** Ninguna es opcional y ninguna se observó en
la captura salvo la última:

1. **Carga**
2. **Error** — y nunca como ceros
3. **Vacío de verdad** — un servidor que no ha recibido nada
4. **Rango personalizado**
5. **Cluster** — con selector de nodo **y sin él**: son dos dibujos
6. **Permisos, en el cromo** — el lateral con menos entradas
7. **SSO, en el menú de cuenta** — tres entradas en vez de cinco
8. **El estado mixto** — que **sí** se observó: la pantalla con **una región vacía
   y siete pobladas a la vez**, y las dos cosas ciertas

El punto 8 no es una curiosidad de mi instancia: es el rasgo del arquetipo. **En
una vista general el estado es de la región, no de la pantalla**, y una región
vacía no puede vaciar visualmente el resto.

### Dónde difiere upstream

Sin diferencias pendientes: la comprobación de paridad da los **28 destinos**, los
**112 textos de ayuda** y los **94 ejemplos** de upstream presentes.

Dos cosas de esta superficie **vienen de upstream** y por eso no se tocan aunque
parezcan mejorables:

- Que el menú `Blocking` **pregunte el estado al abrirse** y no al dibujar la
  pantalla. Parece un retraso evitable y no lo es: entre una cosa y otra el ajuste
  puede haber cambiado desde otra pestaña.
- Que el menú `Blocking` viva **en la cabecera de `Top Blocked Domains`** y no en
  la de la pantalla. Es donde upstream lo pone.

## Qué hay que devolver

**Una disposición por estado, a 1440 y a 390 px**, con todo lo del anexo B
colocado, y **una línea por decisión de agrupación** diciendo qué mantiene junto a
ese grupo.

**Los dos anchos, para cada uno de los ocho estados.** El estrecho no es un extra:
la consola tiene hoy un botón `Menu` que sólo existe ahí, así que un retorno sólo a
1440 deja sin decidir un control que ya está en la pantalla.

Y **el retorno se juzga contra el anexo C**, que va incluido para que no haya
sorpresa: son nueve puntos, tres de ellos bloqueantes.

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

# Anexo B — el contrato

# Fase 3 · contrato — Dashboard + cromo + Login

**2026-09-03.** Arquetipo: **vista general**. Es la primera superficie del
recorrido, y el cromo va con ella porque el plan lo decidió así: *«el cromo no es
una entrada de menú y no puede esperar su turno — la primera pantalla se dibuja
dentro de él»*.

El volcado crudo está en el repositorio; lo que hace falta va abajo, entero.

- Lector `dev/screen-contract.mjs` v4 · SHA-256 `ffc29e4fa84c7d0b…`
- Bundle leído: `index-dn52RGiB.css` · `index-CXLFU48j.js`
- Consola: DNS Server 15.4, instancias `dev` (:5380) y `nodo2` (:5382) del harness

## Cómo leer esto, que es la mitad del contrato

Lo que sigue viene de **cuatro sitios distintos**, y mezclarlos es como se cuela
un dato de instancia en un contrato:

| Marca | Procedencia | Qué garantiza |
|---|---|---|
| **DOM** | Medido en la pantalla con el lector | Que eso está ahí hoy |
| **API** | Respuesta de `dashboard/stats/get` | Lo que el servidor manda |
| **FUENTE** | Leído en el código | Lo que ninguna de las dos anteriores puede decir |
| **NO OBSERVADO** | Ni medido ni capturado | Existe y esta captura **no lo prueba** |

Y una advertencia que va arriba y no en una nota al pie:

> **Esta captura es de una instancia sembrada a mano.** No había tráfico ninguno,
> así que se generó con `dig` desde tres contenedores. **Todo número de esta
> página es contexto, no contrato.** Lo que es contrato son los rótulos, las
> relaciones y las reglas. Si el rediseño vuelve con «304» dibujado, ha copiado
> mi laboratorio.

---

## 1 · Evidencia DOM — el estado observado

### 1.1 El estado es MIXTO, y eso no es un defecto de la captura

`state: "mixed"`. Ocho regiones, siete pobladas y una vacía **a la vez**:

| Región | Estado | Qué tiene |
|---|---|---|
| `Queries` | poblada | la gráfica de líneas |
| `Top Domains` | poblada | 2 filas |
| **`Top Blocked Domains`** | **vacía** | `No data for this period.` |
| `Server` | poblada | 6 contadores |
| `Query Response Types` | poblada | sectores |
| `Query Types` | poblada | sectores |
| `Protocol Types` | poblada | sectores |
| `Top Clients` | poblada | 3 filas |

`Top Blocked Domains` está vacía porque **esta instancia no tiene lista de
bloqueo**, no porque el rediseño deba dibujarla vacía. Es el ejemplo de por qué
una vista general necesita estado por región: con un `state` único la pantalla
entera se declaraba vacía teniendo 304 consultas.

### 1.2 Las once tarjetas

Cada una es una identidad. **Ninguna puede fundirse con otra ni desaparecer.**

`Total Queries` · `No Error` · `Server Failure` · `NX Domain` · `Refused` ·
`Authoritative` · `Recursive` · `Cached` · `Blocked` · `Dropped` · `Clients`

- **Nueve llevan porcentaje**; `Total Queries` y `Clients` **no**. Esa asimetría
  es del dato, no del diseño: un total no es un porcentaje de sí mismo.
- Cada una lleva su **token de serie** —`--ch-total`, `--ch-ok`, `--ch-fail`,
  `--ch-nx`, `--ch-refuse`, `--ch-auth`, `--ch-rec`, `--ch-cache`, `--ch-block`,
  `--ch-drop`, `--ch-clients`—, que es lo que la ata a su trozo de la gráfica.
- Valores y porcentajes: **volátiles**.

### 1.3 Los seis contadores de `Server`

`Zones` · `Cache` · `Allowed` · `Blocked` · `Allow List` · `Block List`

**Son otra familia**, no tarjetas: sin porcentaje y sin serie, y cuentan cosas que
existen, no consultas. Valores volátiles. Ojo con la trampa de nombres: hay un
`Blocked` tarjeta (consultas bloqueadas) y un `Blocked` contador (zonas
bloqueadas), y **no son lo mismo**.

### 1.4 Las tres listas top-N, y sus DOS superficies

`Top Domains` · `Top Blocked Domains` · `Top Clients`

Cada una es un **resumen** en el Dashboard y una **tabla** detrás de su `More`.
No son la misma lista dos veces: son dos superficies atadas.

| | resumen | modal |
|---|---|---|
| Dónde | en el panel | diálogo, tras pulsar `More` |
| Cuántas filas | **hasta cinco** (`Dashboard.tsx:142`, `rows.slice(0, 5)`) | **hasta 1000** |
| Forma | filas sin cabecera | tabla con `Domain`/`Client` y `Hits` |
| Título | el del panel | **`Top 1000 Domains`** — el límite es parte del nombre |
| Pie | — | `Total Domains: N` |

Una fila trae **nombre, recuento** y, sólo en `Top Clients`, **detalle** (el
dominio que resolvió, `.` si ninguno) y **`rateLimited`** (la fila se marca y el
nombre lleva «(rate limited)» detrás). Las filas son volátiles; la **forma** no.

### 1.5 Los controles del Dashboard, que son cinco y no uno

Este apartado decía «`Period` es el único control del Dashboard» y **era falso**.
Lo era por una razón que conviene registrar: `contract()` cuenta como campo lo que
casa con su lista de controles, y **un botón que abre un menú no es un campo**. Los
otros cuatro estaban en `counts.buttons` —diez— y en ningún inventario.

1. **El selector de periodo.** Seis: `Last Hour` · `Last Day` · `Last Week` ·
   `Last Month` · `Last Year` · `Custom`. Rotulado `Period`.
2. **Tres botones `More`**, uno por lista top-N, cada uno abre su modal.
3. **El menú `Blocking`** —§1.7—, en la cabecera de `Top Blocked Domains`.

### 1.6 El menú `Blocking`, contratado entero

Rótulo visible **`Blocking`**, nombre accesible **`Blocking options`**. Upstream lo
pone en la cabecera de `Top Blocked Domains` (`btnDashboardBlockingOptions`) y
aquí faltaba: apagar el bloqueo un rato desde el Dashboard es de lo que más se
hace, y obligaba a un viaje a `Settings › Blocking`.

**La primera entrada es condicional, y de las que se pierden si no se dibujan las
tres situaciones:**

| Estado del servidor | Qué sale |
|---|---|
| bloqueo activo | **`Enable Blocking`** no; sale **`Disable Blocking`** |
| bloqueo apagado | sale **`Enable Blocking`** |
| **aún no se sabe** | **ninguna de las dos** |

Y no es un detalle de implementación: **el estado se pide al ABRIR el menú, no al
dibujar la pantalla** (`main.js:2429`), porque entre una cosa y otra el ajuste
puede haber cambiado desde otra pestaña, y enseñar «Enable Blocking» con el
bloqueo ya puesto es peor que tardar 100 ms.

**Las ocho duraciones, literales** y siempre las ocho:

1. `Disable Blocking For 1 Minute`
2. `Disable Blocking For 2 Minutes`
3. `Disable Blocking For 5 Minutes`
4. `Disable Blocking For 10 Minutes`
5. `Disable Blocking For 15 Minutes`
6. `Disable Blocking For 30 Minutes`
7. `Disable Blocking For 1 Hour`
8. `Disable Blocking For 3 Hours`

Van enteras y no abreviadas —«`1 Minute` · `2 Minutes` · …»— a propósito: la barra
de aceptación exige literales, y una lista abreviada en el contrato es una lista
abreviada en el prompt. `1 Hour` y `3 Hours` no dicen `60 Minutes` ni
`180 Minutes`, que es la abreviatura que saldría sola.

**Y sus confirmaciones**, que son parte del contrato y no del flujo. Los textos son
literales de upstream (`main.js:2448-2496`); lo único que cambia es que allí es un
`confirm()` del navegador y aquí el diálogo de la consola.

| Acción | Título | Texto | Botón | Tono |
|---|---|---|---|---|
| Encender | `Enable Blocking` | `Are you sure you want to enable blocking?` | `Enable` | primario |
| Apagar | `Disable Blocking` | `Are you sure you want to disable blocking?` | `Disable` | **destructivo** |
| Apagar un rato | `Temporarily Disable Blocking` | `Are you sure to temporarily disable blocking for N minute(s)?` | `Disable` | **destructivo** |

Y sus tres avisos de éxito: `Blocking Enabled!` / `Blocking Disabled!` con
`Blocking was enabled successfully.`, `…disabled successfully.` y
`Blocking was successfully disabled temporarily for N minute(s).`

### 1.7 El cromo — medido desde `document`, no desde `<main>`

Nunca se había medido: está fuera de `main` por definición.

- **Doce entradas** de navegación, con `aria-label="Sections"`, y la activa
  anunciada con `aria-current="page"`: `Dashboard` · `Zones` · `Cache` ·
  `Allowed` · `Blocked` · `Apps` · `DNS Client` · `Settings` · `DHCP` ·
  `Administration` · `Logs` · `About`. Cuatro apuntan a una subpestaña
  (`/settings/general/`, `/dhcp/leases/`, `/admin/sessions/`,
  `/logs/view-logs/`), no a la sección pelada.
- **Seis enlaces externos**: `Technitium` · `Blog` · `Donate` · `DNS Client` ·
  `GitHub` · `byGarcia`. Los ocho que se perdieron una vez en `About` son el
  motivo de que `check-parity-controls.mjs` exista.
- **Dos botones**: `Administrator` (el menú de cuenta, §1.8) y `Menu` (el de
  estrecho).
- **Prosa**: `dev.technitium-ui.test` · `DNS Server` `15.4` · `Web Console`
  `0.1.0`. El dominio y las versiones son volátiles; **que estén, no**.
- **Cinco landmarks**: `aside`, `nav` (`Sections`), `header`, `main`, `footer`.

### 1.8 El menú `Administrator`, y sus cuatro diálogos

Este contrato lo eximía —«consta que existe, no lo que tiene dentro»— y esa
exención no se sostenía: **el menú de cuenta es la única puerta a cinco
superficies**, y una barra de aceptación que dice «no falta nada» mientras exime
un menú entero no está diciendo nada.

Cinco entradas: **`My Profile` · `Change Password` · `Configure 2FA` ·
`Create API Token` · `Logout`**.

**Variante SSO** — `NO OBSERVADO`, no hay usuario SSO en el harness: con un usuario
SSO **desaparecen `Change Password` y `Configure 2FA`** y quedan tres
(`Shell.tsx:276,283`, copiando `main.js:71-78`).

Los cuatro diálogos. **Y aquí este contrato repitió su propio defecto**: los abrí
y medí **la rama que salió**, que es la de un usuario local, con 2FA apagado y sin
nada creado todavía. Lo demás estaba y no se vio. Así que va separado — `DOM` es
lo que medí; `FUENTE` es lo que faltaba y está leído en el código.

### `My Profile`

**DOM** — cinco campos: `Username` · `User Type` · `2FA Status` · `Display Name` ·
`Session Timeout`. Pie: `Save` · `Close`. Y **dos tablas dentro**, que es lo que la
exención anterior se llevaba por delante:

- **`Member Of`** — columna `Group`, pie `Total Groups: N`.
- **`Active Sessions`** — columnas `Session`, `Last Seen`, `Remote Address`,
  `User Agent`, pie `Total Sessions: N`, y la sesión actual marcada `(current)`.

**FUENTE** — lo que no salió porque no lo provoqué:

- **Cada fila de sesión tiene un menú de acciones** —nombre accesible
  `Actions for <token parcial>`— con **`Delete Session`** dentro.
- **Y su confirmación**, con el texto exacto de upstream (`auth.js:795-838`):
  título **`Delete Session`**, texto
  **`Are you sure you want to delete the session [<token parcial>] ?`**, verbo
  **`Delete Session`**. Es el mismo `Confirm` que usan `Administration › Sessions`
  y `User Details` para esta acción; aquí se había quedado el `confirm()` nativo
  del navegador. Éxito: **`Session Deleted!`** ·
  `The user session was deleted successfully.`
- **`Display Name` queda DESHABILITADO para un usuario SSO**, y entonces
  `displayName` **ni siquiera se envía** (`auth.js:756-761`).
- **`User Type`** vale `Local` o **`Remote/SSO`**; medí `Local`.
- **`2FA Status`** tiene **tres** valores, no dos: `Enabled`, `Disabled` y
  **`SSO Managed`** — en un usuario SSO el 2FA no es asunto de esta consola
  (`auth.js:667-674`). Medí `Disabled`.

### `Change Password`

**DOM** — tres campos: `Current Password` · `New Password` · `Confirm Password`.
Pie: `Save` · `Close`.

**FUENTE** — **falta un cuarto campo, condicional**: con 2FA activo aparece
**`OTP`**, numérico y de **seis** dígitos. No salió porque el usuario de la captura
lo tiene apagado. Y con él aparece su validación:
**`Please enter the 6-digit OTP that you see in your authenticator app.`**

Las otras cuatro validaciones, literales y todas con título **`Missing!`** salvo la
cuarta: `Please enter the current password.` · `Please enter new password.` ·
`Please enter confirm password.` ·
**`Passwords do not match. Please try again.`** con título **`Mismatch!`**.

### `Configure Two-factor Authentication (2FA)`

El título largo es del diálogo; **`Configure 2FA`** es sólo la entrada del menú.
**No son la misma cadena** (`index.html:3761`).

**DOM** — la rama **desactivada**, que es la única que vi: campos `Secret` (sólo
lectura) y `OTP`; pie **`Enable 2FA`** · `Close`.

**FUENTE** — faltaban dos cosas, y una es media pantalla:

- **El código QR.** Con el 2FA apagado, encima de `Secret` va una **imagen de
  200×200** con el QR para la aplicación de autenticación, texto alternativo
  `QR code for the authenticator app`. Llega como PNG en base64 y se pinta como
  `data:` URI porque la CSP del servidor permite `img-src 'self' data:`.
- **La rama ACTIVA.** Con el 2FA ya puesto: **Pie: `[Disable 2FA] [Close]`; sin
  QR, `Secret` ni `OTP`.** La acción es una y es **destructiva**; el `Close` no lo
  pone este diálogo, **lo pone `Dialog`**, que compone el pie como
  `[ acciones… ] [ descarte ]` en los cuarenta. Decir «un solo botón» —como decía
  este contrato— confunde la **acción** con el **pie**, y quien lo dibuje se
  quedaría sin salida del diálogo. Son dos dibujos, no uno con un botón cambiado.

### `Create API Token`

**DOM** — dos campos: `Username` (sólo lectura) y `Token Name` (marcador de
posición `token name`). Pie: **`Create`** · `Close`.

**FUENTE** — **falta el campo que aparece DESPUÉS de crear**: un tercero,
**`Token`**, monoespaciado y de sólo lectura, con el token recién creado. Es **la
única vez que ese valor se ve**, así que perderlo al rediseñar es perder el
resultado de la acción. Éxito: **`Token Created!`** ·
`API token was created successfully.`

Sus filas son volátiles; sus columnas y sus pies, no.

---

## 2 · API — series y etiquetas

De `dashboard/stats/get`, `type: LastHour`. Según `Chart.tsx` el servidor manda el
dato **ya en formato Chart.js** y la consola pasa «valores, etiquetas y series» sin
alterar; sólo repinta colores.

**Lo que rotula la leyenda depende del tipo de gráfica**, y esto se midió porque
suponerlo salía al revés:

| Gráfica | Tipo | La leyenda son | Medido |
|---|---|---|---|
| `Queries` | línea | los **datasets**: 11 con nombre | `Total`, `No Error`, `Server Failure`, `NX Domain`, `Refused`, `Authoritative`, `Recursive`, `Cached`, `Blocked`, `Dropped`, `Clients` |
| `Query Response Types` | sectores | las **labels** (1 dataset sin nombre) | `Authoritative`, `Recursive`, `Cached`, `Blocked`, `Dropped` |
| `Query Types` | sectores | las **labels** | `A`, `SOA`, `NS` |
| `Protocol Types` | sectores | las **labels** | `Udp` |

**Todas esas listas de la última columna son volátiles menos la primera.** `A`,
`SOA`, `NS` es lo que yo sembré; `Protocol Types` sólo dice `Udp` porque no ha
entrado nada por TCP. Con tráfico real hay `AAAA`, `Tcp`, `Https`… Las once de
`Queries` **no** son volátiles: el servidor manda las once siempre.

Las etiquetas del eje de `Queries` —`07:15`, `07:16`…— son 60 marcas de minuto:
contexto puro.

---

## 3 · FUENTE — lo que ni el DOM ni la API dicen

- **Pulsar una serie en la leyenda la oculta.** `Chart.tsx` lo declara como una de
  las dos razones de usar Chart.js y no SVG: *«es una interacción que existe hoy.
  Con SVG se perdería»*. **No se puede leer del DOM** —Chart.js dibuja la leyenda
  dentro del canvas— ni de la respuesta. Es contrato y sólo consta aquí.
- **El fallo NO se dibuja como un servidor tranquilo.** `Dashboard.tsx:216-223`
  lo explica: sin eso las once tarjetas salían a cero y los paneles decían «No
  queries for this period.», que es exactamente lo que enseña un DNS que no ha
  recibido nada. *«La pantalla respondía en falso sobre lo único que la gente
  viene a mirar aquí.»* Con fallo: `data = null`, las tarjetas muestran **`—`** y
  se levanta un aviso.
- **El periodo `Custom` no pide nada hasta tener fechas.** Elegido `Custom` sin
  fechas, no hay llamada y no hay carga.
- **La elección de nodo se recuerda por pantalla**, con la clave
  `dashboardClusterNode`. Upstream hace lo mismo (`cluster.js`) y **los otros ocho
  selectores no**.
- **El Dashboard NO oculta nada por permiso.** Va aquí y no en la tabla de ramas
  de abajo, que es donde estaba: una pantalla que **no** varía no tiene una rama
  que dibujar, y ponerla entre las que sí la tienen infla la lista y confunde lo
  que hay que entregar. La fase 0.3 cerró **nueve variantes en cuatro pantallas** y
  ésta no es una de ellas. Lo que sí existe es `Dashboard.canDelete`, y gobierna un
  control que **vive en Logs** (`phase0-upstream-diff.md:285-292`) — de las tres
  que no piden el permiso de la pantalla que llevan su nombre.

---

## 4 · NO OBSERVADO — las ramas que esta captura no prueba

Van aquí para que **una foto poblada no se convierta en el único estado posible**.
Ninguna se midió; todas se leyeron en el código, y se dice dónde.

Son **siete, y siete filas**, y el recuento se movió dos veces por dos motivos
distintos que conviene no mezclar:

- **Salió una que no era rama.** «El Dashboard no oculta nada por permiso» es la
  **ausencia** de una variante, no una variante: no hay nada que dibujar. Estaba
  aquí, infla la lista y confunde lo que hay que entregar. Ahora está en §3, con
  los demás hechos de fuente.
- **Entró una que faltaba.** La variante **SSO** del menú de cuenta es una rama de
  verdad —el menú pierde dos entradas— y no estaba en ninguna parte, porque este
  contrato eximía el menú entero.

Así que el número no bajó de siete a seis: cambió de contenido, que es distinto.

| Rama | Qué se dibuja | Dónde está escrito |
|---|---|---|
| **Carga** | `<Loading compacto />` dentro del panel `Queries`. Las tarjetas muestran `—` mientras no hay dato | `Dashboard.tsx:303` |
| **Error** | Tarjetas a `—`, paneles sin dato y **un aviso** del `Notifier`. Nunca ceros | `Dashboard.tsx:216-223` |
| **Vacío de verdad** | Un servidor sin tráfico: `No queries for this period.` en `Queries`, `No data for this period.` en los demás. **Se parece al error y no debe parecerse** | `Dashboard.tsx:101,141,308` |
| **Rango personalizado** | Al elegir `Custom` aparecen `Start` y `End` (fechas) y un botón **`Show`**. Dos mensajes literales: `Please select a start date.` y `Please select an end date.` | `Dashboard.tsx:271-284`, `custom-range.ts:31-35` |
| **Cluster** | Un `ClusterNodeSelect` en la cabecera, **sólo si el servidor dice `clusterInitialized`**. Con un solo servidor **no existe** — y por eso no está en esta captura, comprobado: cero `combobox` en pantalla. Ofrece el agregado `Cluster` además de cada nodo | `ClusterNodeSelect.tsx:15,60`, `Dashboard.tsx:251` |
| **Permisos, en el cromo** | `visibleSections()` quita del lateral las secciones que el usuario no puede ver, así que las doce entradas **no son doce siempre**. `About` no tiene permiso y está siempre | `phase0-upstream-diff.md:275-279` |
| **SSO, en el menú de cuenta** | Con un usuario SSO el menú pierde `Change Password` y `Configure 2FA` y queda en tres | `Shell.tsx:276,283` |

---

## 5 · Login — superficie aparte, con sus defectos de hoy

Medido en `nodo2` (:5382) **sin sesión**. Va aparte y no como un estado del
cromo: no comparte con él ni navegación, ni cabecera, ni landmarks.

**Lo que hay:** dos campos —`Username` (texto) y `Password` (contraseña)—, dos
acciones —**`Login`** y **`Forgot Password?`**—, los **seis enlaces externos** y
dos frases: la marca **`Technitium DNS Server`** y el crédito **`Theme:`** +
`byGarcia`.

**`Theme:` es el crédito del autor del tema, no un selector de temas.** Se
comprobó porque parecía contradecir la decisión de fase 1 de un solo tema. No la
contradice.

### `Forgot Password?` es una SUPERFICIE, no el rótulo de un botón

Este contrato la listaba entre las «dos acciones» y ahí se quedaba. Abre un
diálogo —`Forgot Password?`, ancho `medium`— que **no llama a ningún endpoint: es
texto**. Y hace falta igual, porque explica **el único procedimiento que existe
para recuperar el acceso**; sin él, un administrador que pierde la contraseña se
queda fuera sin saber que hay camino de vuelta.

Su texto son **instrucciones de operación copiadas literalmente**, no prosa
nuestra. Este contrato lo resumía en cinco viñetas **diciendo que era literal**, y
eso es peor que resumirlo a secas: prometía una cosa y daba otra. Va entero, que
es la única forma de que vuelva entero:

> To reset your password, you need to contact the DNS Server administrator.
>
> If you are an administrator, follow these steps to reset the 'admin' user's
> password:
>
> 1. Stop the DNS Server.
> 2. Find the DNS Server config folder and locate the **auth.config** file. The
>    config folder will be found where the DNS Server is installed on Windows or
>    /etc/dns/ folder on Linux.
> 3. Rename the **auth.config** file as **resetadmin.config**
> 4. Start the DNS Server.
> 5. Just refresh this web page in the web browser to auto login with default
>    credentials and quickly change the password.
>
> On Linux, stop the DNS Server by running 'sudo systemctl stop dns' command and
> 'sudo systemctl start dns' command to start it.
>
> On Windows, press Win+R to open Run, enter 'services.msc', and press enter to
> open Services console. Find service named 'Technitium DNS Server' and use the
> Action menu to start/stop it.
>
> **Note: **To reset 'admin' password, you will need file system access on the
> server running this DNS Server. If the 'admin' user does not exists then it
> will be created automatically. If the 'admin' user has Two-factor
> Authentication (2FA) configured then it will be disabled too.

Cinco párrafos y **una lista numerada de cinco pasos**, con `auth.config`,
`resetadmin.config` y `Technitium DNS Server` en negrita o entrecomillados como
están. `does not exists` está así en upstream: **no se corrige**.

Dato que dice por qué esto importa: **era el único de los cuarenta modales de
upstream sin equivalente aquí**, y apareció en el barrido de inventario de la fase
10. Perderlo por segunda vez sería perderlo en el sitio donde ya se perdió una.

**Y tres defectos que el rediseño hereda si nadie los nombra**, los tres medidos:

1. **No tiene `<main>`.** Es la única pantalla de la consola sin landmark, y por
   eso `contract()` devolvía `{error: 'no main element'}` sobre la pantalla por la
   que se entra a la consola.
2. **Cero landmarks**, ninguno: ni `header`, ni `footer`, ni `nav`.
3. **Su título no es un encabezado.** `Technitium DNS Server` es un `div._brand`,
   y la página **no tiene ningún `h1`, `h2` ni `h3`**.

Ninguno es de diseño visual: los tres son estructura, y los tres se arreglan
gratis al redibujar la pantalla. Si no se nombran, vuelven.

---

## 6 · Invariantes — lo que no puede romperse

Cinco, y ninguna es estética.

1. **Once tarjetas ↔ once series.** Las once tarjetas son las once series de la
   gráfica de líneas: misma lista y mismo orden, comprobado contra la respuesta de
   la API (la única diferencia es que la consola rotula `Total` como
   `Total Queries`). Si el rediseño deja diez tarjetas, hay una serie sin tarjeta;
   si dibuja diez series, hay una tarjeta que miente.
2. **Toda etiqueta que manda el servidor sale rotulada en la leyenda**, sean tres
   o treinta. Es la regla de fase 1 —salió de perder una serie entera en el piloto
   1— y **esta captura no la puede comprobar**: con otro tráfico las etiquetas son
   otras. Se comprueba contra la respuesta, no contra esta página.
3. **Ninguna serie puede ser el color de un token de texto.** También de fase 1.
4. **Un dato viejo nunca se ve como uno nuevo, y el vacío nunca se ve como el
   error.** Aquí importa más que en ninguna otra pantalla: un fallo dibujado como
   ceros dice «tu DNS no recibe tráfico», que es la mentira más cara de la
   consola y la más fácil de creer.
5. **Cero es un dato verdadero.** `Refused`, `Blocked` y `Dropped` valen 0 en esta
   captura y **se dibujan `0`**, no una caja de vacío.

## 7 · Lo que este contrato NO cubre, dicho aquí

- **Las series no se pueden leer del DOM.** Chart.js pinta su leyenda dentro del
  canvas y no se expone en `window`. Vienen de la API, y la interacción de
  ocultarlas, del fuente. Ninguna herramienta de este repositorio comprueba hoy la
  invariante 2 contra la pantalla.
- **No se midió ningún ancho.** Este contrato dice qué hay, no cómo se coloca.
- **No se abrieron los tres modales de `More`** salvo uno, `Top 1000 Domains`, del
  que sale la forma de la tabla. Los otros dos se asumen iguales **por el mismo
  componente**, no por haberlos visto.
- **La variante SSO no se observó**: no hay usuario SSO en el harness, así que
  las dos entradas que desaparecen se leyeron en el código, no en pantalla.
- **Las confirmaciones de `Blocking` no se dispararon**: sus textos salen del
  fuente y de los literales de upstream. Apagar el bloqueo en la instancia habría
  cambiado el estado que este mismo contrato acaba de fotografiar.

---

# Anexo C — la barra de aceptación

# Fase 3 · barra de aceptación — Dashboard + cromo + Login

Contra qué se juzga lo que devuelva Claude Design, escrito **antes** del prompt
para que no se ajuste a lo que llegue. Nueve puntos. Los tres primeros no se
negocian: si uno falla, el retorno **no es un punto de partida** y se devuelve.



---

## Bloqueantes

### 1 · No falta nada, y se comprueba por lista

Recorrido punto por punto **contra el contrato leído del volcado**, no contra la
impresión. Tienen que estar, con su literal:

- Las **once tarjetas** por su nombre, con sus **nueve porcentajes** —y sin
  porcentaje en `Total Queries` y `Clients`, que es como están hoy—.
- Los **seis contadores** de `Server`, distintos de las tarjetas.
- Las **tres listas top-N**, cada una con su `More`, y el **resumen a cinco filas**.
- Las **cuatro gráficas** con su título.
- Los **seis periodos**, literales.
- El menú **`Blocking`**: su primera entrada condicional en **las tres
  situaciones**, las **ocho duraciones** literales y **las tres confirmaciones**
  con su título, su texto, su verbo y su tono.
- Las **doce entradas** del lateral, los **seis enlaces externos**, los **dos
  botones** del cromo y la **prosa de versión**.
- El menú **`Administrator`** con sus **cinco entradas**, y **los cuatro diálogos
  que abre** con sus campos y sus pies — incluidas **las dos tablas de
  `My Profile`**, `Member Of` y `Active Sessions`, con sus columnas y sus pies.
- **Y las ramas de esos cuatro diálogos que la captura NO enseñó**, porque medí
  la de un usuario local con 2FA apagado y nada creado. Cada una es un dibujo:
  - `My Profile` — el **menú de acciones por fila de sesión** con
    **`Delete Session`** y **su `Confirm`** literal; `Display Name`
    **deshabilitado** para SSO; y `2FA Status` con sus **tres** valores, incluido
    **`SSO Managed`**.
  - `Change Password` — el cuarto campo **`OTP`**, de seis dígitos, que sólo
    aparece con 2FA activo, y su validación.
  - `Configure 2FA` — **el código QR de 200×200** en la rama apagada, y **la rama
    activa entera**: **Pie: `[Disable 2FA] [Close]`; sin QR, `Secret` ni `OTP`.**
    Una acción, destructiva, **y el descarte que pone `Dialog`** — no «un solo
    botón», que dejaría el diálogo sin salida. Son dos dibujos, no uno con el
    botón cambiado.
  - `Create API Token` — el tercer campo **`Token`** que aparece **después** de
    crear. Es la única vez que ese valor se ve.
- En Login: **dos campos**, **`Login`**, los seis enlaces, la marca y el crédito
  **`Theme:` byGarcia** — y **`Forgot Password?` como superficie**, con sus
  **cinco párrafos y su lista numerada de cinco pasos, palabra por palabra**. Son
  instrucciones de operación, no prosa: no se resumen, no se reescriben, y
  `does not exists` se queda como está porque así está en upstream.

Una sola pérdida devuelve el trabajo. **Un diseño que ha perdido un control no es
un punto de partida.**

### 2 · Las cinco invariantes, dibujadas y no prometidas

1. **Once tarjetas ↔ once series**, misma lista y mismo orden.
2. **Toda etiqueta del servidor sale rotulada**, sean tres o treinta — así que el
   dibujo tiene que **enseñar el caso de muchas**, no sólo los tres sectores de mi
   laboratorio.
3. Ninguna serie es el color de un token de texto.
4. **El vacío y el error no se parecen**, y un dato viejo no se ve como uno nuevo.
5. **Cero se dibuja `0`**, no como caja de vacío. Hoy `Refused`, `Blocked` y
   `Dropped` valen cero: tienen que salir dibujados.

### 3 · Las siete ramas no observadas, dibujadas

Esto es lo que impide que una foto poblada se convierta en el único estado
posible. Cada una con su dibujo:

| Rama | Qué tiene que enseñar |
|---|---|
| **Carga** | Tarjetas a `—` y el hueco de carga en `Queries` |
| **Error** | Tarjetas a `—` **y un aviso**. Nunca ceros |
| **Vacío real** | `No queries for this period.` y `No data for this period.`, **distinguible del error de un vistazo** |
| **Rango personalizado** | `Start`, `End`, `Show`, y los dos mensajes literales |
| **Cluster** | El selector de nodo con el agregado `Cluster`, **y la pantalla sin él**: son dos dibujos, no uno |
| **Permisos, en el cromo** | El lateral **con menos entradas**. El Dashboard no cambia por permiso; el cromo sí |
| **SSO, en el menú de cuenta** | El menú **con tres entradas**, sin `Change Password` ni `Configure 2FA` |

El **estado mixto** cuenta como una octava y va también: la pantalla con una
región vacía y siete pobladas a la vez.

---

## No bloqueantes, pero se piden y se revisan

### 4 · El estado es de la región, no de la pantalla

Que se vea que cada panel responde por lo suyo. Una región vacía **no puede**
vaciar visualmente el resto, que es justo lo que la herramienta hacía antes de
arreglarla.

### 5 · Las dos superficies del top-N, atadas y distintas

El resumen y el modal de hasta mil filas **no son el mismo objeto**: se acepta que
se vean distintos, no que se fundan. El título del modal lleva el límite dentro
—`Top 1000 Domains`—, y su pie el total. Y `Top Clients` dibuja lo que las otras
dos no tienen: **detalle** bajo el nombre y la marca de **rate limited**.

### 6 · Login es una superficie aparte, y arregla sus tres defectos

No comparte cromo. Y el retorno tiene que **nombrar** los tres defectos de hoy, no
heredarlos en silencio:

- que aparezca un **landmark principal** —hoy no hay ninguno—;
- que el título sea un **encabezado** y no un `div` de marca;
- y que `Theme: byGarcia` siga siendo lo que es, **un crédito y no un selector**.

### 7 · El cromo, con sus dos anchos y su estado activo

La entrada activa **se anuncia**, no sólo se colorea. Y el cromo tiene un botón
`Menu` que hoy existe: el dibujo estrecho no es opcional.

### 8 · Ningún número de mi laboratorio, dibujado como si fuera dato

`304`, `firmada.test`, `172.23.0.2`, `A/SOA/NS`, `Udp`: **todo eso es contexto**.
Si vuelven dibujados como si fueran el contenido, el diseño ha copiado la
instancia en vez de la pantalla. Los rótulos sí son contrato; los valores no.

### 9 · Cero funcionalidad nueva

Ni un control, ni un flujo, ni una validación, ni un texto que no esté hoy. Las
palabras, **literales**. La paridad se juzga contra **upstream**, no contra esta
consola.

---

## Cómo se resuelve un fallo

Con Claude Design, **no parcheando el código**. Un hueco es un asunto de diseño
mientras no se demuestre lo contrario, y arreglarlo aquí deja el dibujo y la
consola diciendo cosas distintas — que es exactamente lo que este contrato
existe para impedir.

## Y lo que NO se le va a exigir, dicho por justicia

- **Anchos y espaciado.** Este contrato no midió ninguno.
- **Las series de las gráficas leídas del DOM.** No se pueden: van en el prompt
  porque salen de la API, y ninguna herramienta del repositorio comprueba hoy la
  invariante 2 contra la pantalla. Se revisa a ojo contra la lista.
- **Los otros dos modales de `More`.** Sólo se abrió uno; los otros se asumen
  iguales por ser el mismo componente, y así consta.

**Y una advertencia sobre las exenciones, que ya ha fallado dos veces.** «No lo
miré» se convierte en «no existe» con una facilidad que este documento ha
demostrado: primero con el menú `Administrator` entero, y después con las ramas de
sus cuatro diálogos —el QR, el `OTP`, el `Token`, el `Delete Session`—, que se
midieron abriendo cada uno y **enseñaron sólo la rama del usuario que tenía
delante**. Una exención sólo vale si dice **qué** queda fuera; «lo demás» no es una
exención, es un agujero.

**Lo que ya NO se exime, y por qué se eximía mal.** Esta lista incluía «el
contenido del menú `Administrator`». No puede: el punto 1 dice **«no falta nada»**,
y decirlo mientras se exime un menú entero es decir «no falta nada de lo que he
mirado». Son cinco entradas, cuatro diálogos y dos tablas dentro de uno de ellos,
todo medido y ahora en el contrato. Lo mismo con `Forgot Password?`, que estaba
como rótulo de botón y es una superficie con cinco pasos numerados.
