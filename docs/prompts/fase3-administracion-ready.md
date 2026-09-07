# Rediseño: ADMINISTRACIÓN — seis sub-pantallas, cinco arquetipos

La **última superficie grande** del recorrido. Va en ronda propia y no heredando
porque no es un arquetipo: son **cinco arquetipos en seis sub-pantallas**, y una de
ellas —la matriz de permisos— no se parece a nada de lo dibujado hasta ahora.

`Sessions` · `Users` · `Groups` · `Permissions` · `SSO` · `Cluster`.

## La regla que gobierna esta consola

Sustituye a la consola que trae Technitium DNS Server, y **el comportamiento no
puede cambiar**. Se puede recolocar, reagrupar, cambiar el aspecto, cambiar qué
componente lleva qué, y cambiar densidad y jerarquía. **No** se puede quitar un
campo, dejar caer una ayuda, reescribir un rótulo, añadir un paso ni inventar una
ruta.

La paridad se juzga **contra upstream**, no contra esta consola.

## Lo que se HEREDA y no se discute

Es la quinta ronda. Las cuatro anteriores decidieron casi todo y **este encargo no
lo reabre**:

- **La dirección** de la fase 1 (anexo A). Es la entrada, no material opinable.
- **Las primitivas** de la fase 2, cerradas: `Alert` · `Button` · `Check` ·
  `ClusterNodeSelect` · `Confirm` · `Crudo` · `Details` · `Dialog` ·
  `EditableTable` · `Empty` · `Externo` · `Field` · `FooterLinks` · `Form` ·
  `Icon` · `Menu` · `Notifier` · `Pagination` · `Panel` · `PanelForm` ·
  `SectionHeader` · `SectionIndex` · `Segmented` · `Select` · `SessionCells` ·
  `Table` · `Tag` · `Tooltip`.
- **El cromo**, la tabla con su ordenación, el diálogo con sus cuatro anchos, el
  menú de fila, la paginación y el pie de recuento.
- **La señal del interruptor maestro** —filete ámbar, opacidad, una pastilla que
  nombra, en sus dos polaridades `Needs …` y `While …`—.
- **La salida cruda** (`Crudo`) y **el plegable**, cerrados en la ronda anterior.

Si algo de esa lista vuelve redibujado, el retorno se rechaza por eso solo.

## Lo que hay que decidir — y son SEIS cosas

1. **La matriz.** Once secciones, cada una con usuarios y grupos contra tres verbos
   —`View`, `Modify`, `Delete`—, en sólo lectura, y un modal por sección para
   editarla. Hoy mide del orden de dos mil quinientos píxeles y es un muro. Cómo
   se recorre, cómo se compara una sección con otra, y qué pasa a 390.

   **Y una cosa que hay que resolver, no sólo dibujar:** hoy la rejilla **no es una
   tabla** y sus casillas **no tienen nombre accesible**. Quien use un lector de
   pantalla oye ochenta y cuatro casillas sin nombre y sin ejes por los que
   moverse. El dibujo tiene que decir **cómo se llama una celda**.

2. **Una pantalla que es tres.** `Cluster` cambia según qué es este servidor: sin
   clúster, primario o secundario. Los verbos de cabecera son distintos en cada
   una —`New Cluster`/`Join Cluster` · `Options`/`Delete Cluster` ·
   `Resync`/`Options`/`Leave Cluster`—. No es un estado de carga: son tres
   pantallas con el mismo título.

3. **Una regla de fila que depende de quién mira.** `Edit Node` sale en la fila
   propia siempre, y **además en la del primario si miras desde un secundario**.
   La misma fila ofrece cosas distintas según desde dónde se abra la consola.

4. **La casilla `Force`.** Cuatro diálogos la llevan, y **no es un parámetro: cambia
   lo que la acción significa**. Sin ella la operación se coordina con el otro nodo;
   con ella se hace igualmente, aunque el otro no conteste. Un dibujo que la ponga
   como una casilla más de un formulario está diciendo algo que no es.

5. **Dos superficies de detalle que no son confirmaciones.** `User Details` y
   `Group Details` llevan **tablas dentro** —los grupos de un usuario y sus
   sesiones; los miembros de un grupo— con sus propios verbos.

6. **Una sección sin permisos.** Es la única de las doce donde **no se dibuja
   candado**: upstream no oculta ni deshabilita nada aquí.

   La ausencia de restricción visual **no es un hueco que rellenar**: los verbos se
   quedan visibles y habilitados, sin candado y **sin explicación añadida**, y un
   rechazo real lo comunica el `Notifier`. Una barra que explica que no hay
   restricción es una restricción explicada, y ocuparía sitio en las seis
   sub-pantallas para decir que no pasa nada.

## Cómo leer lo que viene

| Marca | De dónde salió | Qué garantiza |
|---|---|---|
| **DOM** | Medido en la pantalla con la herramienta del repositorio | Que eso está ahí hoy |
| **API** | La respuesta real del servidor | Lo que el servidor manda |
| **FUENTE** | Leído en el código | Lo que ninguna de las dos anteriores puede decir |
| **NO OBSERVADO** | Ni medido ni capturado | **Existe, y esta captura no lo prueba** |

Las referencias `Cluster.tsx:266` son **procedencia, no enlaces**.

### Los números son contexto, no contrato

Para poder contratar `Cluster` **hubo que montar un clúster de verdad** en el
laboratorio: dos nodos, y la pantalla se vio desde los dos lados. Por tanto:

- `dev.cluster.test`, `nodo2.cluster.test`, las IP `172.23.0.x`, `Total Users: 3`,
  `Total Nodes: 2` y **las 84 casillas de la matriz** son de mi instancia.
- **Las once secciones SÍ son estructura.** Las casillas salen de cuántos usuarios y
  grupos tienen entrada en cada una; con otra configuración son otras.
- **Las dos alturas también son volátiles**: la matriz mide del orden de **dos mil
  quinientos** píxeles y SSO **dos mil**, y las dos se mueven con las filas que
  tengan delante —permisos de grupo en una, scopes y asignaciones en la otra—. La
  magnitud sirve para dimensionar: **las dos son muros**. El dígito exacto, no.

## A qué viene quien abre estas pantallas

Aquí no se administra el DNS: **se administra quién puede administrarlo**. Y el
error más caro no es no encontrar un botón, es **creer que has dado un permiso que
no has dado** —o quitárselo a quien lo necesitaba sin enterarte—.

De ahí sale lo que gobierna la ronda: **lo que está concedido tiene que poder
leerse de un vistazo y compararse entre secciones**. Una matriz preciosa donde hay
que contar celdas para saber si `Operadores` puede borrar zonas es una matriz que
no sirve.

Y de ahí sale también por qué `Cluster` importa: es la única pantalla de la consola
donde **una acción puede dejar el sistema partido en dos**, y por eso sus cuatro
`Force` no son un detalle.

## Qué hay que devolver

1. **Las seis sub-pantallas completas**, a **1440 y a 390 px**, con sus 41 columnas
   y sus 21 verbos colocados.
2. **Las tres ramas de `Cluster`**, que son tres dibujos.
3. **Las 24 superficies de diálogo**, incluidas las no observadas. Son **22
   títulos** en 25 instancias: `Edit Node - {nodo}` y `Save Config` son **dos
   diálogos cada uno bajo el mismo rótulo**, y `Delete Session` es **uno solo**
   montado desde dos sitios. Dibujar 22 pierde dos diálogos; dibujar 25 duplica
   uno.
4. **Las 27 ayudas**, con su literal. El anexo B las lleva enteras: **no se
   reescriben ni se resumen**, ni siquiera para que suenen mejor.
5. **Una línea por cada una de las seis decisiones**, diciendo qué se decidió.
6. Si algo necesita una primitiva que no está en la lista heredada, **se dice y se
   justifica**, no se dibuja como si existiera.

El retorno se juzga contra el **anexo C**.

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

# Anexo B — el contrato de las seis

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
`<table>`, sin `<th>` y sin `<tbody>`. Y sus **84 casillas no tienen nombre
accesible**: ni `<label for>`, ni `aria-label`, ni `<label>` envolvente. DOM.

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


## Las 27 ayudas, enteras

Van aquí porque **lo que no viaja en el contrato no vuelve**. La primera versión
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

---

# Anexo C — la barra de aceptación

# Barra de aceptación — Administración

Esto es contra lo que se juzga el retorno. Va dentro del encargo a propósito: una
barra que sólo conoce quien corrige convierte la reconciliación en una sorpresa, y
esta ronda tiene **una sola**.

Un dibujo que vuelva se acepta si, y sólo si:

- **Las seis sub-pantallas están dibujadas**, cada una con su arquetipo:
  colección (Sessions), colección con detalle (Users, Groups), **matriz**
  (Permissions), formulario denso con dos listas (SSO) y referencia con tres ramas
  (Cluster).
- **Las 41 columnas de tabla siguen ahí** con su rótulo literal, y las ordenables
  siguen siéndolo. Son todas las tablas de la sección, anidadas incluidas, y la
  columna sin rótulo cuenta: es estructura.
- **Las 27 ayudas siguen ahí, enteras y con su literal.** Ninguna se reescribe ni
  se resume: 26 van transcritas en el contrato y 1 lleva marcado y se copia del
  fuente al implementar.
- **Los 21 verbos siguen ahí**, cada uno donde vive: cabecera, fila o menú de fila.
- **Las 24 superficies de diálogo están dibujadas.** Son 22 títulos en 25
  instancias, y la diferencia importa: `Delete Session` es **un** diálogo montado
  desde dos sitios, mientras que `Edit Node - {nodo}` y `Save Config` son **dos
  diálogos cada uno con el mismo rótulo**. Dibujar 22 pierde dos; dibujar 25
  duplica uno.
- **La matriz dice CÓMO SE LLAMA UNA CELDA.** Hoy sus 84 casillas no tienen nombre
  accesible y la rejilla no es una tabla: quien usa un lector de pantalla oye
  ochenta y cuatro casillas sin nombre. No se puede devolver un dibujo que deje eso
  igual sin decir nada; es el único punto donde esta ronda **tiene** que resolver
  algo que no es sólo aspecto.
- **Las once secciones son estructura y las 84 casillas son dato.** Un dibujo que
  fije 84 ha copiado esta instancia.
- **Las tres ramas de Cluster son tres dibujos**, con sus verbos de cabecera
  distintos: sin clúster · desde el primario · desde un secundario.
- **La regla de `Edit Node` se respeta**: desde el primario, sólo la fila propia;
  desde un secundario, la propia **y la del primario**.
- **Las cuatro casillas `Force` están dibujadas y se distinguen de un parámetro
  normal**: cambian lo que la acción significa, no cómo la hace.
- **No se dibuja ningún candado, ni nada en su lugar.** Upstream no oculta ni
  deshabilita nada dentro de esta sección, y añadirlo sería añadir comportamiento.
  La ausencia de restricción visual **no es un hueco que rellenar**: los verbos se
  quedan visibles y habilitados, sin candado y **sin explicación añadida**, y un
  rechazo real lo comunica el `Notifier`. Una barra que explica que no hay
  restricción es una restricción explicada, y ocuparía sitio en las seis
  sub-pantallas para decir que no pasa nada.
- **Nada de lo dibujado va en castellano.** Este contrato está en castellano y el
  producto en inglés: una frase levantada de aquí y puesta en un dibujo es un
  defecto, aunque describa bien lo que hace. Y si no hay literal de upstream para
  algo, **no se redacta uno**: se deja fuera y se dice.
- **Las literales no se reescriben**: ni `Cluster Not Initialized`, ni los títulos
  de las 24 superficies de diálogo, ni los pies `Total …`.
- **Entrega a 1440 y a 390.** La matriz a 390 es el caso difícil y no se puede
  dejar fuera.
- **No se rediseñan las primitivas ya cerradas**: panel, tabla, campo, casilla,
  aviso, pastilla, menú, diálogo, paginación, la señal del interruptor maestro y la
  salida cruda.
- **Viene una línea por cada decisión nueva**, diciendo qué se decidió.
