# Fase 3 · contrato — Dashboard + cromo + Login

**2026-09-03.** Arquetipo: **vista general**. Es la primera superficie del
recorrido, y el cromo va con ella porque el plan lo decidió así: *«el cromo no es
una entrada de menú y no puede esperar su turno — la primera pantalla se dibuja
dentro de él»*.

Volcado crudo en [`evidencia/dashboard-cromo-dump.json`](evidencia/dashboard-cromo-dump.json).

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
