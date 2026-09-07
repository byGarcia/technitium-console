# Fase 3 · recorrido de reconciliación — Dashboard + cromo + Login

**Entrega:** `16-fase3-dashboard-cromo-login.dc.html`
· primera vuelta: 175 229 bytes · 1 893 líneas · etag `1788427747545043`
· **corrección: 175 749 bytes · 1 898 líneas · etag `1788430206979278`**

Los dos etags anotados **antes** de abrir, y sin cambios al terminar cada recorrido.
**+520 bytes y +5 líneas**: el tamaño ya dice que es un delta y no un rehacer, que es
lo primero que se mira cuando se pide sólo el delta.

Recorrido **contra el contrato**, punto por punto. Ocho secciones: F1 estado mixto ·
F2 las siete ramas · F3 `Blocking` · F4 los diálogos de cuenta · F5–F6 los `More` ·
F7 Login · F8 invariantes.

## Veredicto — **ACEPTADA** (2026-09-03, segunda vuelta)

Las **siete** aplicadas, comprobadas una a una contra el fichero corregido. Y
comprobado además que la corrección 1, que tocaba las leyendas, **no se llevó
ninguna por delante**.

| # | Qué se pidió | Qué hay ahora |
|---|---|---|
| 1 | Punto y dos decimales | `84.88%` · `0.07%` · `2.49%` · `19.70%` — y **recalculados**, no un cambio de separador |
| 2 | `0%` con cero consultas | `0%` literal en las nueve, y `0` en las cifras |
| 3 | Los textos, en inglés | `The server did not respond to the request for this period.` · `Last good data: today 15:04` · el agregado dice **`Cluster`** y nada más |
| 4 | `Session Timeout` en segundos, sin sufijo | `placeholder="1800" value="1800"`, sufijo fuera |
| 5 | Un error cada vez, en orden | Sólo `Start` marcado; `End` limpio |
| 6 | `Enable Blocking` primario | `mi pri`, y las ocho duraciones siguen `mi dan` |
| 7 | Las versiones, una vez | El pie de página se queda con los seis enlaces; las versiones, sólo en el lateral |

**Lo intocable, intacto** en lo comprobado: las once tarjetas con sus tokens, las
once entradas de leyenda con su color, las ocho duraciones enteras, los seis enlaces
externos y los cinco rótulos de los sectores. Y las leyendas de sectores adoptaron el
formato de la tarjeta —`63.98%`, `19.70%`— que es lo que se pidió por coherencia, sin
invocar a upstream.

Dos detalles que hablan bien del retorno: **distinguió las dos ramas del porcentaje**
—dos decimales cuando hay total, `0%` cuando no— y **no tocó los recuentos de la
leyenda de `Queries`**, que son `num2()` y no llevaban porcentaje.

---

## Lo que falló en la primera vuelta

**No aceptada entonces.** **Siete incumplimientos de contrato**, ninguno de rediseño.
Lo demás —que es casi todo— cumple.

Se cuentan así y no como «siete literales»: cuatro lo son, pero los otros tres son el
**orden** en que se validan dos campos, el **tono** de una acción y un dato
**repetido**. Ninguno de esos tres es una palabra.

El recorrido salió primero con **cuatro** y tres de las «preguntas que no bloquean»
eran en realidad obligatorias, porque **cada una contradice el código**: el orden de
las validaciones, el tono de `Enable Blocking` y las versiones duplicadas. Dejarlas
como pregunta las convertía en opinables, y no lo son. La cuarta —las siete trazas—
sí era una pregunta, y la respuesta es que **no hay defecto**: varias series a cero
se solapan.

Retorno redactado en [`../prompts/fase3-retorno-delta.md`](../prompts/fase3-retorno-delta.md).

## Lo que falla, y por qué es objetivo

### 1 · El porcentaje cambia de formato · BLOQUEANTE

La entrega escribe **`84,9%`** —coma, un decimal—. La consola escribe **`21.71%`**:
`toFixed(2) + '%'`, **siempre con punto** y dos decimales, copiando a upstream
(`main.js:2652-2676`).

Y no es un detalle: `Dashboard.tsx:70-73` registra que fijar la coma **ya fue un bug
de este proyecto** — *«estaban clavados a `es-ES`, así que un servidor en inglés
mostraba "84.930" como "84.930" pero con el punto significando lo contrario»*.

`percentage()` tiene **un solo sitio de llamada** —las nueve tarjetas
(`Dashboard.tsx:293`)—, y ahí el formato es de upstream. **Los porcentajes de las
leyendas de sectores son de la entrega**: hoy esas leyendas las dibuja Chart.js y sólo
muestran la etiqueta. Ahí no se invoca a upstream; se pide **coherencia** con la
tarjeta de al lado.

> `Dashboard.tsx:82-84`

### 2 · El cero de la rama vacía · BLOQUEANTE

Con `total === 0` la consola escribe el literal **`0%`**, no `0.00%` y desde luego
no `0,0%`. La rama vacía (2e/2f) lo pinta **`0,0%` en las nueve tarjetas**.

> `Dashboard.tsx:83` — `if (total === 0) return '0%'`

### 3 · Texto en castellano dentro de la consola · BLOQUEANTE

La consola es **en inglés**, entera: sustituye a una consola inglesa. Los comentarios
del documento de diseño en castellano están bien —es el diseñador hablándonos—, pero
**dentro de los marcos** aparecen cadenas nuevas en castellano:

- `La petición del periodo falló. No hay serie que dibujar y no se dibuja ninguna.` (2c)
- `El servidor no respondió a la petición del periodo.` (2d)
- `Último dato bueno: hoy 15:04` (2c, 2d)
- `agregado`, junto a `Cluster` en el menú de nodo (2i)

Los títulos sí van en inglés —`Could not load dashboard statistics.`—, así que es el
cuerpo lo que se ha quedado a medias.

### 4 · `Session Timeout` cambia de unidad · BLOQUEANTE

La entrega dibuja **`30`** con el sufijo **`minutes`**. El campo es **en segundos**:
su marcador de posición es `1800`. Y el sufijo **no existe**.

Un administrador que escriba `30` donde el servidor espera segundos deja su sesión en
medio minuto. Es la única de las cuatro que cambia lo que el usuario teclea.

> `MyProfile.tsx:167-173`

## Las tres que ascendieron de pregunta a obligatoria

1. **Las dos validaciones de fecha salen a la vez.** Hoy `loQueFalta` devuelve **una**:
   primero la de inicio, y sólo si esa está puesta, la de fin. Poner cada una junto a su
   campo es lo que pidió la fase 1; enseñar las dos simultáneamente puede que no.
2. **`Enable Blocking` sale en tono destructivo** (`mi dan`) en el menú. El contrato lo
   fija como **primario**: encender el bloqueo no destruye nada.
3. **Las versiones aparecen dos veces a 1440**: en el pie del lateral y en el de página.
   A 390 no, porque el lateral se esconde: la solución ya está dibujada en la entrega.

## Y la que sigue siendo una pregunta, con respuesta

**La gráfica dibuja 7 trazos para 11 series** —faltan `Server Failure`, `Refused`,
`Blocked` y `Clients`—. **No es un defecto**: tres valen cero en el ejemplo y varias
series a cero se solapan en la misma línea. La leyenda sí nombra las once, así que la
invariante se cumple. Lo que el retorno pide es que la corrección del porcentaje **no
se lleve por delante** las once entradas, su color ni su interacción independiente.

## Lo que cumple, y es la mayor parte

| Punto del contrato | Estado |
|---|---|
| Las **11 tarjetas** con su nombre y su token de serie | ✅ |
| **9 con porcentaje**, `Total Queries` y `Clients` sin él | ✅ |
| **Cero se dibuja `0`** en las once, en la rama vacía | ✅ |
| Los **6 contadores** de `Server`, como familia aparte | ✅ |
| Las **3 listas top-N**, **cinco filas**, detalle y `(rate limited)` | ✅ |
| Las **dos superficies** del top-N: `Top 1000 Domains`, `Total Domains: N` | ✅ |
| Las **4 gráficas** con su título | ✅ |
| Los **6 periodos**, literales | ✅ |
| `Blocking` en la cabecera de `Top Blocked Domains`, nombre accesible `Blocking options` | ✅ |
| Las **8 duraciones literales**, **sin abreviar**, también a 390 | ✅ |
| Las **3 confirmaciones** con su texto exacto, su verbo y su tono | ✅ |
| El **estado mixto**: una región vacía y siete pobladas | ✅ |
| **Carga** con `—`, y caja neutra: ni discontinua ni roja | ✅ |
| **Error** anunciado una vez arriba, con `Retry` y hora del último dato bueno | ✅ |
| **Vacío ≠ error**: discontinuo contra continuo | ✅ |
| **Rango personalizado** con `Start`, `End`, `Show` y sus dos literales | ✅ |
| **Cluster**: dos dibujos, con selector y sin él | ✅ |
| **Permisos en el cromo**: lateral más corto | ✅ |
| **SSO**: tres entradas, y **no** deshabilitadas | ✅ |
| Las **12 entradas**, `aria-current`, 6 externos, `Menu`, prosa de versión | ✅ |
| Las **5 entradas** del menú de cuenta, `Logout` tras el separador | ✅ |
| `My Profile` con sus **dos tablas**, `(current)` y el menú por fila | ✅ |
| **`Delete Session`** con su `Confirm` literal y su éxito | ✅ |
| **Login** aparte, y **los tres defectos nombrados y arreglados** | ✅ |
| Invariante **11 tarjetas ↔ 11 series**, con su tabla | ✅ |
| Invariante **toda etiqueta rotulada**, dibujada con **16** | ✅ |
| **Ningún dato de mi laboratorio** copiado | ✅ |
| Entrega **a 1440 y 390** en cada rama | ✅ |

Y dos cosas que hizo mejor de lo que pedía el contrato: dibujó el caso de **16
etiquetas** para probar la invariante que esta captura no podía probar, y razonó por
qué en el cluster sin nodos **no aplica** «deshabilitado, nunca escondido».

## Cómo se resuelve

Con Claude Design, **no parcheando el código**. Son cuatro literales y una unidad: no
hace falta rediseño ni recorrido nuevo, sólo un retorno del delta.
