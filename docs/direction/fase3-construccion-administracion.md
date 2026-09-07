# Construcción — Administración

Fase 3, superficie 10. Pasos 5 y 6 del bucle: el diseño estaba aceptado
(`fase3-reconciliacion-administracion-2.md`) y aquí se construye y se valida.

Seis sub-pantallas, cinco arquetipos, 41 columnas, 21 verbos, 24 superficies de
diálogo, 29 ayudas, 5 sufijos y 10 literales. Dos añadidos de primitiva, los dos
declarados en la entrega: `Matrix` y el bloque de consecuencia de `Force`.

Construida **con el clúster real de dos nodos del arnés levantado**, y validada
desde los dos lados: `dev` como primario en :5380 y `nodo2` como secundario en
:5382. Es lo único que enseña la regla de `Edit Node`, que depende de quién mira.

## Lo que se construyó

| Sub-pantalla | Qué cambia |
|---|---|
| **Sessions** | La fila de mi propia sesión, bañada en `--acc-bg`. Lo demás es la colección del piloto 2 sin tocar |
| **Users** | `Type` pasa a pastilla, para que las tres columnas que dicen qué ES un usuario se lean como una sola clase de cosa |
| **Groups** | `Group Details` a 880, por la lista que lleva dentro |
| **Permissions** | El mapa de concesiones, el índice de once, y las once secciones convertidas en **tablas de verdad con nombre por casilla**. `Edit Permissions` a 880 |
| **SSO** | El formulario denso del piloto 3: cuatro bloques con los rótulos de upstream, `Warning!` delante de los controles y `Note!` detrás |
| **Cluster** | La pastilla de papel junto al título, la fila propia marcada y los cuatro `Force` como bloque de consecuencia |

## Lo que NO se construyó del dibujo, y por qué

Seis cosas. Ninguna es una decisión de producto pendiente: las seis se resuelven
con una regla que la propia ronda ya había escrito.

### 1 · La tabla apilada a 390

El dibujo convierte a `Sessions`, `Users`, `Groups` y `Cluster` en tarjetas
apiladas por debajo de cierto ancho (`1b`, `2b`, `3b`, `7d`). **Es el patrón que
la ronda anterior retiró explícitamente**: la reconciliación del arquetipo
herramienta lo rechazó para `Query Logs` —«apilarla es un patrón nuevo para una
primitiva cerrada… decide por todas las colecciones de la consola o deja a Query
Logs como la única que se comporta distinto»— y lo devolvió como propuesta de
ronda propia. Y la barra de aceptación de ESTA ronda dice, en su penúltimo punto,
«no se rediseñan las primitivas ya cerradas: panel, **tabla**, campo…».

La reconciliación no lo cazó. Se construye la primitiva cerrada: a 390 la tabla se
desplaza en horizontal, como en Zones. Nada se esconde, que es lo que el dibujo
pedía garantizar.

### 2 · El título y la leyenda del mapa de concesiones

Iban en castellano —«Mapa de concesiones», «Concedido — View · Modify · Delete»,
«Sin entrada en esa sección»— y **no tienen literal de upstream**, así que en
inglés serían copy nuevo: decisión de producto, no de diseño. Es la regla que
cerró el segundo retorno.

El mapa se construye **sin título**: `Panel` agrupa sin él, y sus propias
cabeceras de fila y de columna dicen qué es. Y sin leyenda, la distinción que
explicaba se dibuja igual: **sin entrada es una celda vacía; con entrada y sin
ningún verbo, tres casillas vacías**. Quien la cuenta entera es la sección de
abajo, que no ha cambiado.

### 3 · El estado detrás del nombre de la celda

La barra pide `{Sección} · {Sujeto} · {Verbo}` y eso es lo que lleva. El
«: concedido / no concedido» que el dibujo añadió va en castellano y tampoco
existe en upstream. **Lo dice la casilla por sí sola**: sigue siendo un
`input[type=checkbox]` deshabilitado, que anuncia su estado en el idioma del
lector sin literal que escribir. La mitad del argumento del dibujo sí se acepta:
la marca deja el ámbar y se va a `--ok`, porque ámbar es «puedes pulsar» y esta
lista no se pulsa.

### 4 · La línea de «lo que queda por hacer a mano» del bloque `Force`

Estaba redactada, en castellano, dentro del ámbito del producto. Lo que queda por
hacer a mano **ya lo dice el `Note!` de upstream**, que sigue en su sitio detrás
del bloque. El bloque se arma en `--dan` igualmente.

### 5 · El pie por sección y el recuento por entrada del índice

«4 filas · 12 casillas sólo lectura»: castellano, y además cifras volátiles — el
propio dibujo dice que las 84 son dato.

### 6 · El índice de SSO

Éste no es cuestión de idioma sino de medida, y sale en el paso 6: con
`ui/SectionIndex` en columna, `dev/uniformity.js` da `reticula-panel` en TRES
firmas —`210px 354px 360px` en SSO contra `210px 542px 360px` en las ocho de
Settings—. Los 188 px son la columna del índice y su hueco. Settings es el mismo
arquetipo, ya está construido y no lleva índice.

**Aplazado con su condición escrita: va en Settings y en SSO a la vez, o en
ninguno.** Es la misma decisión que la ronda de la herramienta tomó con la
pastilla del candado. `Permissions` sí conserva el suyo y no cuesta nada medido:
no tiene ni una fila `Row`.

## Lo que la construcción encontró, y no estaba en ningún documento

### A · El contrato decía que las 84 casillas no tienen nombre

«Ni `label for`, ni `aria-label`, ni `<label>` envolvente». Es falso, y se
comprueba en el bundle publicado: `Brand` emitía `aria-label` con sección, sujeto
y verbo. Lo que sí era cierto —y es lo que se arregla— es que **no había tabla**:
`contract()` sobre `/admin/permissions/` devolvía `tables: []` con 84 casillas
dentro. Cuarta corrección de contrato de la ronda, y la primera medida contra el
DOM en vez de contra una lista a mano.

### B · Las ayudas no eran 27, son 29

`Sso.tsx` tiene dos más —las de `Scopes` y `Group Map (Optional)`— que
`dev/censo-ayudas.mjs` no veía: llevan marcado y viajan como hijas JSX en vez de
como prop `help=`. Son literales de upstream, comprobadas contra la instancia
`ref`. El dibujo las retiró marcándolas «ayuda no censada», que para un dibujo que
no puede leer el fuente era lo correcto — el que tenía que llevarlas era el
contrato.

Es el tercer sitio por el que se escapaba una ayuda y los tres por lo mismo:
**mirar la sintaxis en vez del contenido**. El censo tiene ya su tercera rama y su
cifra corregida.

### C · El selector de nodo no decía ningún nodo

Salía con el marcador «—» mientras la tabla de debajo listaba dos nodos.
`updateClusterNodeDropDown` (cluster.js:1026) selecciona `dnsServerDomain` cuando
no se ha elegido nada, y cae al primer nodo si ese nombre no está. Pérdida de
paridad, restaurada: ahora arranca en este servidor, y el valor que viaja pasa a
ser el de upstream.

### D · Los nombres ocultos empujaban la página a 948 px

Sólo se ve midiendo a 390. `clip-path` recorta el pintado, **no la disposición**, y
sin ancestro posicionado el bloque contenedor de un `position: absolute` es la
página entera: los 29 nombres ocultos del mapa se quedaban en su posición estática
—hasta la undécima sección— y ni el contenedor con desplazamiento ni el panel
podían recortarlos, porque `overflow: hidden` no recorta a un descendiente cuyo
bloque contenedor está fuera. Con `position: relative` en el contenedor vuelve a
380.

## El paso 6, completo

| | populated | empty | loading | error |
|---|---|---|---|---|
| **1440** | ✔ | ✔ | ✔ | ✔ |
| **1024** | ✔ | ✔ | ✔ | ✔ |
| **768** | ✔ | ✔ | ✔ | ✔ |
| **390** | ✔ | ✔ | ✔ | ✔ |

96 celdas —seis sub-pantallas × cuatro anchos × cuatro estados—, **ninguna con
desplazamiento horizontal**, las 24 de carga con su indicador y las 24 de fallo
con su aviso. `docs/direction/evidencia/administracion-estados.json`.

**Y un barrido salió void y se dice**: el primer intento de `error` y `loading`
interceptó todo `/api/**`, incluida la sesión, así que la consola se fue al login y
las 48 celdas midieron la pantalla de acceso. Salió en el dato —el texto decía
«Username Password Login»— y no en una impresión.

**Variantes de permiso**: ninguna. Es el hecho que gobierna la ronda —upstream no
oculta ni deshabilita nada dentro de Administración— y por eso aquí la matriz de
la fase 0.3 no tiene filas que añadir.

**`contract()` antes y después**: cero pérdidas, comparado por inventario y no por
recuento. Las cuatro entradas que salen como perdidas son el mismo guión: el «—»
del selector de nodo, que ahora dice un nombre.

**Uniformidad**: catorce familias idénticas a la base cadena a cadena; `tabla`
sube de 4 a 5 y la quinta es `Matrix`.

**Portón**: typecheck, lint, build y 1.084 pruebas, los cuatro por código de
salida 0. Censos: 41 columnas · 24 superficies · 29 ayudas.

## El clúster del arnés

Sigue levantado. La condición de `dev/README.md` —«hasta que Administración esté
construida, recapturada y con el portón verde»— ya se cumple, así que **se puede
desmontar cuando se quiera**; no se ha hecho porque desmontarlo es destructivo y
no lo pide nada de lo que queda. `About` no lo necesita.
