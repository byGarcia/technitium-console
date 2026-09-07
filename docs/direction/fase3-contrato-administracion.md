# Contrato de ADMINISTRACIÓN — seis sub-pantallas

Fase 3, superficie 10 del plan. Va en **ronda propia** porque no es un arquetipo:
son **cinco arquetipos en seis sub-pantallas**, y una de ellas —la matriz de
permisos— no se parece a nada de lo ya dibujado.

Tomado el **2026-09-04**. Regla del proyecto: *sólo diseño, cero funcionalidad*.

| Marca | Qué significa |
|---|---|
| **DOM** | Medido en el navegador contra `index-ddKTTGsL.css` / `index-Dctpo8kj.js` |
| **API** | Leído de una respuesta real del servidor del arnés |
| **FUENTE** | Leído del código; incluye ramas que el arnés no puede provocar |
| **NO OBSERVADO** | Existe y **no se ha visto**. Se dice; no se simula |

Sello del lector: `25508b9bd0ec…`.

El `.js` es el de la **recaptura**, no el del primer volcado. El primero se tomó
contra `index-QuzqHSI5.js` y contaba ocho controles en SSO porque `Cluster Node`
seguía montado allí; con el build que lo corrige son siete. **Ese hash es lo único
que distingue las dos lecturas**, así que dejarlo desactualizado convierte la
procedencia en un adorno — y fue precisamente el hash lo que destapó aquel 8.

## Una regla que este contrato no decía, y ha costado dos rondas

**Toda la interfaz del producto está en inglés.** Este documento está en castellano
porque es documentación interna; **ninguna de sus frases puede acabar dibujada tal
cual**. Lo que va a pantalla es o una literal de upstream, o una decisión de copy
nuevo — y esa segunda no la toma el diseño.

Se dice aquí porque ha pasado dos veces seguidas: la leyenda de los siete colores
de `Query Logs` volvió en castellano, y en esta ronda han vuelto en castellano los
cuatro bloques de `Force` y la barra de sólo lectura. Las dos veces el texto se
levantó de un contrato escrito en castellano.

## El hecho que gobierna la ronda entera

**Upstream no oculta ni deshabilita NADA dentro de Administración.** La única
comprobación es `Administration.canView` para enseñar o no la sección entera
(`main.js:165` y `240`); a partir de ahí enseña todos los botones y deja que el
servidor rechace lo que deba. FUENTE.

Consecuencia directa: **el botón con candado no se dibuja en ninguna de las seis**.
La señal que se cerró en `Settings` y en `View Logs` **no aplica aquí**, y añadirla
sería añadir comportamiento. Los permisos que consume cada acción están anotados en
`api/admin.ts`; no se pintan.

## Lo que el arnés tuvo que montar para poder contratar esto

`Cluster` son **1.629 líneas** —la pantalla más grande de la consola— y el arnés la
enseñaba **vacía**: «Cluster Not Initialized» y dos botones. Contratarla así habría
sido contratar su estado vacío.

Así que **se inicializó un clúster de verdad**: `dev` como primario y `nodo2` como
secundario, dominio `cluster.test`. Los dos contenedores montan el mismo build, así
que la pantalla se ha visto **desde los dos lados**, que es donde está la mitad del
contrato. Queda levantado.

---

## 1. Sessions — `/admin/sessions/` · arquetipo colección

**Tabla de 6 columnas**: `Username` · `Session` · `Last Seen` · `Remote Address` ·
`User Agent` · *(acciones)*. Las cinco con texto son ordenables. DOM.

Pie: `Total Sessions: N`. Un `Cluster Node` en la cabecera —sin agregado y sin
persistencia—. DOM.

| Verbo | Dónde | Nota |
|---|---|---|
| `Create Token` | cabecera | DOM |
| `View Details` | fila | DOM |
| `Delete Session` | menú de fila | DOM + FUENTE |

**La sesión propia se marca `(current)`** en la celda de token. DOM.

Diálogos: `Create API Token` —`Username`, `Token Name`, y **un tercer campo
`Token` que aparece DESPUÉS de crear**, con el valor que sólo se enseña una vez— ·
`Delete Session`. FUENTE.

## 2. Users — `/admin/users/` · colección + detalle

**Tabla de 8 columnas**: `Username` · `Display Name` · `Type` · `2FA Status` ·
`Status` · `Recent Login` · `Previous Login` · *(acciones)*. DOM.
Pie `Total Users: N`.

| Verbo | Dónde |
|---|---|
| `Add User` | cabecera |
| `View Details` · `Disable User` | fila |
| `Reset Password` · `Disable 2FA` · `Delete User` | menú de fila |

Diálogos: `Add User` (`Username`, `Display Name`, `Password`, `Confirm Password`) ·
`Reset Password` (`New Password`, `Confirm Password`) · `Delete User` ·
`Disable User` · `Disable 2FA`. FUENTE.

**`User Details` es una superficie entera**, no un diálogo de confirmación:
`Username`, `Display Name`, `Type`, `2FA Status`, `Session Timeout`,
`Disable User Account`, **`Member Of` con `Add Group`** y **una tabla de sesiones
con su propio `Delete Session`**. FUENTE · **NO OBSERVADO**.

`Session Timeout` lleva sufijo: «seconds (valid range 0-604800; default 1800; set 0
to disable)». Está escrito como texto JSX y no como cadena, así que ningún censo por
`suffix=` lo veía — y sin él el campo no dice qué se puede escribir.

## 3. Groups — `/admin/groups/` · colección + detalle

**Tabla de 3 columnas**: `Name` · `Description` · *(acciones)*. DOM.
Pie `Total Groups: N`. Verbos: `Add Group` (cabecera), `View Details` (fila),
`Delete Group` (menú).

`Group Details`: `Name`, `Description`, **`Members` con `Add User`**. FUENTE.

## 4. Permissions — `/admin/permissions/` · **la MATRIZ**

Es el arquetipo que no tiene piloto, y el que decide esta ronda.

**Once secciones** —`Dashboard`, `Zones`, `Cache`, `Allowed`, `Blocked`, `Apps`,
`DnsClient`, `Settings`, `DhcpServer`, `Administration`, `Logs`— y por cada una:

- un panel propio con su nombre,
- una tabla de **usuarios y grupos** con las tres columnas `View` · `Modify` ·
  `Delete`,
- un verbo `Edit Permissions`.

**Medido: 11 secciones, 84 casillas y 11 verbos; 2.491 px de alto.** DOM.

**Sólo el 11 es estructura.** Las casillas salen de cuántos usuarios y grupos
tienen entrada en cada sección —tres por cada uno—, así que con otra configuración
son otras. Pie: `Total Sections: 11`.

**Y la ALTURA también es volátil**, que es menos evidente: se mueve con las filas.
Medido en dos capturas del mismo día, **84 casillas → 2.491 px y 85 → 2.553**, unos
62 px por fila. Fijarla en un documento la ata a una instancia, y basta que alguien
añada un permiso de grupo para que deje de cuadrar. Lo que sirve para dimensionar
es la magnitud: **la matriz mide del orden de dos mil quinientos píxeles y es un
muro**; el dígito exacto, no.

Tres cosas que son contrato y no preferencia:

1. **La lista es de SÓLO LECTURA.** Las casillas se dibujan deshabilitadas —el
   equivalente del `glyphicon-ok` de upstream— y se edita en el modal.
2. **La lista de grupos que ofrece el modal INCLUYE `Everyone`, y la de
   `groups/list` no.** Son dos listas distintas del servidor y no se pueden
   intercambiar (comprobado contra una v15.4).
3. **`permissions/set` viaja con el nodo PRIMARIO del clúster**, no con el que se
   está mirando, y pide `Administration.canDelete`, no `canModify`
   (`WebServiceAuthApi.cs:1533`).

Modal: dos tablas editables, `User Permissions` y `Group Permissions`, cada una con
las tres columnas y una fila para añadir. FUENTE.

### Lo que la medición destapa, y no se ve mirando

**La matriz NO es una tabla en el DOM.** Es una rejilla CSS (`_permCols_`), sin
`<table>`, sin `<th>` y sin `<tbody>`. DOM, y confirmado con `contract()`:
`/admin/permissions/` devolvía `tables: []` con 84 casillas dentro.

> **Corregido construyendo, 2026-09-04.** La frase que seguía aquí decía que sus
> **84 casillas no tienen nombre accesible: «ni `label for`, ni `aria-label`, ni
> `<label>` envolvente»**. Eso es falso y se comprueba en el bundle publicado:
> `Brand` emitía `aria-label` con sección, sujeto y verbo separados por espacios.
> Lo que faltaba —y es lo que se ha construido— son los **ejes**: la tabla, el
> `th[scope=col]` de los tres verbos y el `th[scope=row]` del sujeto. Cuarta
> corrección de este contrato, y la primera medida contra el DOM en vez de contra
> una lista escrita a mano.

Los rótulos que un volcado del lector enseña —«Dashboard Administrators View»— **los
sintetiza el lector por posición**, no los lee del DOM. Delante de esto, quien use
un lector de pantalla oye ochenta y cuatro casillas sin nombre y sin filas ni
columnas por las que moverse.

No es una decisión de diseño que se pueda dejar en blanco: **el dibujo tiene que
decir cómo se llama una celda**, porque una matriz de tres verbos por dos
poblaciones y once secciones no se entiende sin saber de qué fila y de qué columna
es cada casilla. Es la regla de la fase 1 en su forma más cruda — aquí no es que un
tooltip sustituya al nombre: es que **no hay nombre**.

*(Comprobado que NO pasa lo mismo en SSO: sus tres casillas sí toman el nombre de
su `<label>` envolvente. La primera sonda dijo lo contrario y estaba mal.)*

## 5. SSO — `/admin/sso/` · formulario denso + dos listas

**Siete controles**, contados en el DOM y sin incluir los de las tablas:
`Enable Single Sign-On (SSO)` · `Authority (Issuer)` · `Client ID` ·
`Client Secret` · `Metadata Address (Optional)` · `Allow New User Sign Up` ·
`Allow Sign Up Only For Mapped Users`. DOM.

**Aquí NO hay `Cluster Node`.** El primer volcado contaba ocho porque se tomó con
un build en el que ese selector seguía montado en SSO; el selector es de `Sessions`
y `Cluster`, y lo comparten. Por esto un volcado lleva el hash del bundle: sin él
la diferencia no se ve.

`Single Sign-On (SSO)`, `SSO User Sign Up`, `Scopes` y `Group Map (Optional)` son
**rótulos de sección y de tabla**, no campos. Contarlos daba doce y no es lo que
hay: la cifra sale del volcado, no de listar rótulos del fuente.

**Dos tablas editables**: `Scopes` —una columna, `Scope Name`— y el mapa de grupos
—`Remote Group` · `Local Group`—, cada una con su `Add` y su `Delete` por fila.
Verbo: `Save Config`.

Lleva `Warning!` y `Note!` propios. FUENTE.

### Sus DOS confirmaciones, que comparten título

`Save Config` es **dos diálogos distintos con el mismo rótulo**
(`Sso.tsx:456` y `:468`), y lo que cambia es la frase:

- «WARNING! The **SSO Authority** must use a 'https' URL scheme for production
  environment. Are you sure you want to proceed with using a 'http' URL scheme?»
- «WARNING! The **Metadata Address** must use a 'https' URL scheme for production
  environment. Are you sure you want to proceed with using a 'http' URL scheme?»

Las dos, enteras y sin abreviar. La primera versión de este contrato cortó la
segunda con puntos suspensivos «porque es igual salvo el sujeto», y eso es
exactamente lo que no se puede hacer: **quien dibuja no tiene el fuente**, así que
un literal recortado llega recortado a la pantalla.

Los dos con botón `OK` y primario. Aparecen **sólo si el campo correspondiente
lleva `http`**, y son dos porque el usuario puede haberse equivocado en uno, en el
otro o en los dos. FUENTE · **NO OBSERVADO**.

### La altura

**2.029 px**, y es **volátil** igual que la de la matriz: se mueve con las filas de
`Scopes` y del mapa de grupos, que son dato. Medida con cuatro scopes y tres
asignaciones. DOM.

## 6. Cluster — `/admin/cluster/` · **tres pantallas en una**

Lo que se ve **depende de qué es este servidor**, y son tres dibujos distintos.

### a) Sin clúster — **DOM**

`Cluster Not Initialized` · «This server is not part of a cluster. Create one, or
join an existing cluster.» · dos verbos: `New Cluster` y `Join Cluster`.

### b) Desde el PRIMARIO — **DOM**

**Tabla de 9 columnas**: `Node Name` · `IP Address` · `URL` · `Type` · `State` ·
`Up Since` · `Last Seen` · `Last Synced` · *(acciones)*. Pie `Total Nodes: N`.

Verbos de cabecera: `Options` · `Delete Cluster`.

### c) Desde un SECUNDARIO — **DOM**

La misma tabla, y **otros verbos de cabecera**: `Resync` · `Options` ·
`Leave Cluster`.

### La regla de `Edit Node`, que no es la que parece

Medida en las dos vistas y confirmada en el fuente (`Cluster.tsx:266`):

```
esPrimario ? state === 'Self' : state === 'Self' || type === 'Primary'
```

Desde el primario, sólo la fila propia. **Desde un secundario, la propia Y la del
primario** — porque un secundario sí necesita corregir la dirección por la que lo
alcanza. Con dos muestras parecía una inconsistencia; es una regla.

Menú de fila, sólo sobre nodos que no son este: `Promote To Primary` ·
`Remove Node`. DOM.

### Los estados que pinta

`Primary` · `Secondary` · `Self` · `Connected` observados. DOM.

### Los diálogos de Cluster — nueve títulos, DIEZ diálogos

1. `Initialize New Cluster` — `Cluster Domain`, `Primary Node IP Addresses`
2. `Join Cluster` — `Secondary Node IP Addresses`, `Primary Node URL`,
   `Primary Node IP Address (Optional)`, `Certificate Validation`,
   `Primary Node Username`, `Primary Node Password`, y **`Primary Node OTP`, que
   sólo aparece si el servidor responde `2fa-required`**
3. `Cluster Options` — **cinco campos, y cuatro no estaban en este contrato**:
   `Cluster Domain` (deshabilitado y de sólo lectura) y los cuatro intervalos
   —`Heartbeat Refresh Interval`, `Heartbeat Retry Interval`,
   `Config Refresh Interval`, `Config Retry Interval`—, cada uno con su ayuda y su
   **sufijo**, y los cuatro van enteros:

   - `Heartbeat Refresh Interval` — «seconds (valid range 10-300; default 30)»
   - `Heartbeat Retry Interval` — «seconds (valid range 10-300; default 10)»
   - `Config Refresh Interval` — «seconds (valid range 30-3600; default 900)»
   - `Config Retry Interval` — «seconds (valid range 30-3600; default 60)»

   El botón `Save` **sólo existe en el primario**. FUENTE · **NO OBSERVADO**
4. **`Edit Node - {nodo}` — direcciones propias**: `Node IP Addresses`, `Quick Add`
5. **`Edit Node - {nodo}` — cómo se alcanza al primario**: `Primary Node URL`,
   `Primary Node IP Addresses (Optional)`
6. `Remove Node - {nodo}`
7. `Promote To Primary Node - {nodo}`
8. `Leave Cluster`
9. `Delete Cluster`
10. `Resync Cluster`

FUENTE.

**Los números 4 y 5 son dos diálogos distintos con el MISMO título**
(`Cluster.tsx:1229` y `1312`). Uno edita las direcciones de este nodo; el otro,
por dónde este secundario alcanza al primario. Mismo rótulo, campos distintos y
significado distinto: es exactamente lo que un rediseño funde sin darse cuenta.

La primera versión de este contrato decía «nueve» en el título y **enumeraba
siete**: se dejaba fuera `Remove Node` y `Promote To Primary Node`. Un encabezado
con una cifra y una lista que no la cumple es peor que no dar la cifra.

**Cuatro de ellos llevan una casilla `Force …`**: `Force Delete Cluster`,
`Force Leave Cluster`, `Force Remove Node` y `Force Delete Current Primary Node`.
Son la vía para cuando el otro nodo no responde, y **cambian lo que la acción
significa**: sin ella se coordina con el otro nodo, con ella se hace igualmente.
FUENTE · **NO OBSERVADO**.

---

## Los diálogos de las seis, contados

No es una lista a mano: las produce `dev/censo-dialogos.mjs` leyendo el fuente,
porque la lista a mano falló **tres veces seguidas** —primero faltaban
`Remove Node` y `Promote To Primary Node`, después las dos confirmaciones de SSO, y
cada corrección movía un total que había que recalcular—.

| | |
|---|---|
| **instancias JSX** | **25** — lo que hay escrito, y lo que se toca al implementar |
| **títulos distintos** | **22** — lo que el usuario lee |
| **superficies** | **24** — cuántos diálogos DISTINTOS hay que dibujar |

Los tres números difieren por **tres títulos repetidos**, y no todos significan lo
mismo:

| Título | Dónde | Qué es |
|---|---|---|
| `Delete Session` | `Sessions.tsx:201` · `UserDetails.tsx:346` | **UN** diálogo montado desde dos sitios: mismo título, mismo texto, misma etiqueta |
| `Edit Node - {nodo}` | `Cluster.tsx:1226` · `:1309` | **DOS** diálogos: campos distintos |
| `Save Config` | `Sso.tsx:456` · `:468` | **DOS** diálogos: textos distintos |

Por eso hacen falta las tres cifras y no una: 25 dice cuánto código hay, 22 cuántos
rótulos ve el usuario, y **24 es el encargo** — cuántos dibujos distintos.


## Las 27 ayudas, enteras — **son 29, corregido el 2026-09-04**

Van aquí porque **lo que no viaja en el contrato no vuelve**.

> **Corregido construyendo.** Son **29**, no 27: `Sso.tsx` tiene dos más —las de
> `Scopes` y `Group Map (Optional)`— que el censo no veía porque llevan marcado y
> viajan como **hijas JSX** en vez de como prop `help=`. Son literales de upstream,
> comprobadas contra la instancia `ref`, y están en el producto desde siempre. El
> dibujo las retiró marcándolas «ayuda no censada», que para un dibujo que no puede
> leer el fuente era lo correcto: el que tenía que llevarlas era este documento.
>
> Es el **tercer** sitio por el que se escapaba una ayuda, y los tres por lo mismo:
> mirar la sintaxis en vez del contenido. `dev/censo-ayudas.mjs` tiene ya su tercera
> rama, y las dos van transcritas al final de esta sección. La primera versión
de este documento se envió a diseño **sin una sola**, y la entrega —que no tiene
el fuente— hizo lo único que podía: inventarlas.

Las produce `dev/censo-ayudas.mjs`. Son veintisiete textos de hasta doscientos
caracteres: transcribirlos a mano es garantizar que uno se acorta.

| | ayudas |
|---|---|
| `Cluster.tsx` | **20** — 16 por `help=` y **4 dentro de un array** |
| `Sso.tsx` | **7** — 6 planas y 1 con marcado |

Las cuatro del array son las que un censo por `help=` **no ve**: viajan como quinto
elemento de una tupla y se pasan en un `map`. Por eso el censo busca además frases
sueltas: prefiere señalar de más a callarse.

### `Cluster.tsx` — 20

- «The fully qualified domain name to be used to identify the new Cluster.»
- «The static IP addresses of this DNS Server that will be accessible by all other DNS Servers to be added later as Secondary nodes. Enter IP addresses one below another in the above text field or use the Quick Add list to add available IP addresses on the server.»
- «The static IP addresses of this DNS Server that will be accessible by all other DNS Server nodes in the Cluster. Enter IP addresses one below another in the above text field or use the Quick Add list to add available IP addresses on the server.»
- «The Web Service HTTPS URL of the Primary node in the Cluster.»
- «The IP address of the Primary node in the Cluster. When unspecified, domain name in the Primary node URL will be resolved and used.»
- «The username of an administrator on the Primary node in the Cluster.»
- «The password of the administrator user specified above.»
- «Enter the 6-digit code you see in your authenticator app for the administrator user specified above.»
- «The fully qualified domain name of the Cluster.»
- «The static IP addresses of this DNS Server that will be accessible by all other DNS Server nodes in the Cluster. Enter IP addresses one below another in the above text field or use the Quick Add list to add available IP addresses on the server.»
- «The Web Service HTTPS URL of the Primary node in the Cluster.»
- «The IP addresses of the Primary node in the Cluster. When unspecified, domain name in the Primary node URL will be resolved and used.»
- «Enabling this option will cause the Secondary node to be deleted from the Cluster without asking the node to leave gracefully.»
- «Enabling this option will cause the current Primary node to be deleted from the Cluster without resyncing complete configuration from it and without inform it.»
- «Enabling this option will cause this Secondary node to leave the Cluster without informing the Primary node.»
- «Enabling this option will cause this Primary node to delete the Cluster for itself even when other Secondary nodes still exist, orphaning them.»
- «The interval in seconds in which the DNS Server must refresh the state of all nodes in the Cluster.»
- «The interval in seconds in which the DNS Server must retry the state refresh process for all nodes in case of a failure.»
- «The interval in seconds in which the DNS Server must refresh the configuration from the Primary node.»
- «The interval in seconds in which the DNS Server must retry the configuration refresh process for the Primary node in case of a failure.»

### `Sso.tsx` — 6

- «Enable to allow Single Sign-On (SSO) with OpenID Connect (OIDC).»
- «The OpenID Connect (OIDC) Authority URL.»
- «The OpenID Connect (OIDC) Client ID.»
- «The OpenID Connect (OIDC) Client Secret.»
- «The OpenID Connect (OIDC) metadata discovery URL to be used instead of the default one. Configure this option only if the Single Sign-On (SSO) provider uses a different discovery URL.»
- «Enable to allow automatically provisioning of user accounts for new users signing in via Single Sign-On (SSO). Keep this option disabled if you do not expect new SSO users to sign up.»

Y la séptima de SSO, la de `Allow Sign Up Only For Mapped Users`, entera:

- «Enable to allow a new user to sign up via Single Sign-On (SSO) only when the user is a member of at least one Remote Group that is mapped to a Local Group in the Group Map option below. This option allows SSO administrators to restrict SSO users to control who can sign up and get access based on their group memberships.»

En el producto `Group Map` va **en negrita**: es el único trozo con marcado de las
27, y aquí va plano porque poner los asteriscos cambiaría los caracteres. Decir
sólo «se copia del fuente al implementar» era dejarla fuera del contrato — que es
justo lo que este documento no puede hacer.

**Las cuatro últimas de `Cluster` son las de las casillas `Force`**, y dicen qué
cambia esa casilla: «without asking the node to leave gracefully», «without
resyncing complete configuration from it», «without informing the Primary node»,
«orphaning them». La consecuencia no hay que redactarla: está escrita.

*(Una dice «and without inform it», con esa concordancia. Es literal de upstream y
no se corrige.)*

### Las dos que faltaban, enteras

Van bajo su tabla, no bajo un campo, y por eso el censo por `help=` no las veía.

- «Enter the scopes to be sent to the Single Sign-On (SSO) provider. The scopes `openid` and `profile` are mandatory and will be automatically added if missing. Add the scope `email` if you want to use email address as the username for all SSO users that sign up for an account.» — bajo `Scopes`
- «Map Remote Groups at Single Sign-On (SSO) provider to Local Groups for both new and existing users signed up via Single Sign-On (SSO). A SSO user's group membership will be automatically synced to the mapped Local Groups each time they log in. If your SSO provider does not include group membership claim by default then you will have to add `groups` or `roles` scope in the **Scopes** option above as required by the SSO provider.» — bajo `Group Map (Optional)`

En el producto llevan `<code>` y `<b>`; aquí van con acentos graves y asteriscos
por lo mismo que la de `Group Map`: el marcado cambia los caracteres.

### Y hay diez literales largas más que tampoco se parafrasean

No son ayuda —son validaciones, avisos de éxito y cuerpos de alerta— y por eso van
aparte: un contrato que las contara como ayudas mentiría. Pero se copian igual.

- «A full config resync was triggered successfully. Please check the Logs for confirmation.» — `Cluster.tsx`
- «The selected node was successfully promoted to Primary node in the Cluster.» — `Cluster.tsx`
- «Please enter the Primary node admin user's OTP.» — `Cluster.tsx`
- «The Primary node Web Service TLS certificate will be validated using PKI and DANE to ensure that your connection is secure.» — `Cluster.tsx`
- «Use this options only when you know that the Primary node Web Service is using a self-signed TLS certificate and is reachable on a private network.» — `Cluster.tsx`
- «Please enter a value for Heartbeat Refresh Interval.» — `Cluster.tsx`
- «Please enter a value for Heartbeat Retry Interval.» — `Cluster.tsx`
- «Please enter a value for Config Refresh Interval.» — `Cluster.tsx`
- «Please enter a value for Config Retry Interval.» — `Cluster.tsx`
- «Single Sign-On (SSO) config was saved successfully.» — `Sso.tsx`

## Las 41 columnas, contadas

Las produce `dev/censo-tablas.mjs` leyendo el fuente, y **no son 31**. Esa cifra
—que este contrato afirmó y que viajó a diseño— no contaba nada coherente: sumaba
las cuatro colecciones y las dos tablas anidadas de SSO, y dejaba fuera
`Permissions` y `UserDetails`. Incluía unas tablas anidadas y otras no.

| Fichero | Columnas |
|---|---|
| `Cluster.tsx` | 9 |
| `Users.tsx` | 8 |
| `Sessions.tsx` | 6 |
| `Permissions.tsx` | 5 |
| `Sso.tsx` | 5 |
| `UserDetails.tsx` | 5 |
| `Groups.tsx` | 3 |
| **total** | **41** |

Se cuenta **todo**: las anidadas también, y la columna sin rótulo —la de acciones—
porque es estructura. Contar sólo las que llevan texto fue lo que en Zones hizo
perder de vista dos columnas de diez.

## Lo que esta ronda tiene de nuevo

1. **La matriz**: once secciones × dos poblaciones × tres verbos, en sólo lectura y
   con su modal de edición. Del orden de 2.500 px. Ningún piloto dibujó nada así.
2. **Una pantalla que es tres según el papel del servidor**, con verbos de cabecera
   distintos en cada una.
3. **Una regla de fila que depende del papel de QUIEN MIRA**, no de la fila.
4. **La casilla `Force`**: cuatro diálogos donde una casilla cambia lo que la acción
   hace, no un parámetro de la acción.
5. **Dos superficies de detalle** —`User Details` y `Group Details`— que no son
   confirmaciones: llevan tablas dentro.
6. **Una sección sin permisos**: es la única de las doce donde no se dibuja candado.
   Y el hueco **no se rellena**: verbos visibles y habilitados, sin candado ni
   explicación, y el rechazo por el `Notifier`.
