# Fase 3 — retorno: siete correcciones, y sólo el delta

Recorrido `16-fase3-dashboard-cromo-login.dc.html` contra el contrato, punto por
punto. **La entrega está bien**: de todo lo que el contrato exigía, esto es lo único
que falla — **siete incumplimientos de contrato**. No hay nada de rediseño.

Se dicen así y no «siete literales», que es como estaba escrito y se quedaba corto:
cuatro son literales o unidades, pero los otros tres son **el orden en que se validan
dos campos**, **el tono de una acción** y **un dato repetido dos veces**. Ninguno de
esos tres es una palabra: son comportamiento y estructura.

**Se pide sólo el delta.** No hace falta rehacer nada ni volver a dibujar ninguna
rama: sólo cambiar lo que dicen estas siete cosas, donde salgan, en las dos
anchuras.

---

## Lo que NO se toca

Y va primero para que no haya duda: **todo lo demás queda intocable.** En concreto,
y sin ánimo de ser exhaustivo:

- El reparto de las once tarjetas —2 totales y 9 en tres familias de tres—, su
  orden, sus tokens de serie y el hecho de que `Total Queries` y `Clients` no
  lleven porcentaje.
- Las bandas, la retícula, la posición de `Server` junto a la gráfica y las tres
  listas top-N en una fila.
- Los ocho estados y sus dibujos: mixto, carga, error, vacío, rango personalizado,
  cluster con selector **y sin él**, permisos y SSO.
- El menú `Blocking` donde está, con sus tres situaciones y sus ocho duraciones sin
  abreviar, y su comportamiento de pedir el estado al abrirse.
- Las tres confirmaciones, sus textos, sus verbos y sus anchos.
- Las dos superficies del top-N, `Top 1000 Domains` y sus totales.
- Los cuatro diálogos de cuenta y sus ramas, `Delete Session` con su `Confirm`, y
  las dos tablas de `My Profile`.
- Login entero, y los tres arreglos que ya trae.
- Las dos secciones de invariantes, incluida **la de las 16 etiquetas**.

Dos cosas, además, salieron mejor de lo que se pidió y **conviene que se queden
como están**: dibujar el caso de 16 etiquetas —la invariante que la captura no
podía probar— y razonar por qué en el cluster sin nodos **no aplica**
«deshabilitado, nunca escondido».

---

## Las siete

Cada una lleva **de dónde sale**, para que no haya que fiarse de mi criterio.

### 1 · El porcentaje va con punto y dos decimales

Sale `84,9%`. Tiene que salir **`84.93%`**: la consola hace `toFixed(2) + '%'`, que
**siempre escribe el punto**, y son dos decimales. Es el formato de upstream
(`main.js:2652-2676`).

Y conviene saber por qué es delicado: **fijar la coma ya fue un fallo de este
proyecto**. Está escrito en el código — *«estaban clavados a `es-ES`, así que un
servidor en inglés mostraba «84.930» como «84.930» pero con el punto significando
lo contrario»*.

**Dónde manda esto exactamente**, que conviene no exagerarlo: `percentage()` tiene
**un solo sitio de llamada** —las nueve tarjetas—, y ahí el formato es de upstream y
no se discute.

> `src/screens/dashboard/Dashboard.tsx:82-84`, llamada única en `:293`

**Las leyendas de los tres sectores son otra cosa.** Los porcentajes que llevan
—`Cached 64,0%`— son **de la entrega**: hoy esas leyendas las dibuja Chart.js y sólo
muestran la etiqueta. Así que ahí no hay literal de upstream que respetar, y no te lo
atribuyo. Lo que se pide es **coherencia**: si el diseño decide enseñar el porcentaje
también en la leyenda, que lo escriba **igual que la tarjeta de al lado**. Dos formas
del mismo número en la misma pantalla es peor que cualquiera de las dos.

### 2 · Con cero consultas, el porcentaje es `0%`

En la rama de vacío sale `0,0%`. Tiene que salir **`0%`**, literal — no `0.00%` y
desde luego no `0,0%`. Es una rama aparte del formato de arriba:

```
if (total === 0) return '0%'
return ((value * 100) / total).toFixed(2) + '%'
```

> `src/screens/dashboard/Dashboard.tsx:82-84`

### 3 · Los textos de la consola van en inglés

**La consola es inglesa entera** — sustituye a una consola inglesa, y la paridad se
juzga contra upstream. Los comentarios del documento en castellano están bien: son
el diseñador hablándonos. Pero **dentro de los marcos** se han colado cuatro
cadenas nuevas en castellano, mientras los títulos de las mismas cajas sí van en
inglés:

| Dónde | Sale | Tiene que ser |
|---|---|---|
| 2c | `La petición del periodo falló. No hay serie que dibujar y no se dibuja ninguna.` | inglés |
| 2d | `El servidor no respondió a la petición del periodo.` | inglés |
| 2c, 2d | `Último dato bueno: hoy 15:04` | inglés |
| 2i | `agregado`, junto a `Cluster` | inglés — o fuera: el rótulo del agregado es **`Cluster`** y nada más |

El del agregado tiene respuesta exacta y comprobable; los otros tres no tienen un
literal que copiar —son frases nuevas— así que hay que redactarlos en inglés, y ahí
la referencia es la regla, no una línea: **la paridad se juzga contra upstream**, que
es una consola inglesa, y la comprobación de paridad de este repositorio da los 28
destinos, los 112 textos de ayuda y los 94 ejemplos **todos en inglés**.

> `src/ui/ClusterNodeSelect.tsx:34` — `{ value: AGGREGATE, label: 'Cluster' }`, sin anotación
> · `dev/check-parity-controls.mjs` para la regla del idioma

### 4 · `Session Timeout` es en segundos y no lleva sufijo

Sale **`30`** con el sufijo **`minutes`**. El campo es **en segundos** —su marcador
de posición es `1800`— y **no tiene sufijo ninguno**.

Es la única de las siete que cambia **lo que el usuario teclea**: quien escriba
`30` creyendo minutos se queda con medio minuto de sesión.

> `src/screens/modals/MyProfile.tsx:167-173`

### 5 · Las fechas se validan en orden, y sale un error cada vez

Salen **las dos a la vez**, y con los campos aún vacíos. Tienen que salir **de una
en una y en orden**: primero `Please select a start date.`; sólo cuando esa está
puesta, `Please select an end date.`

Y hay un segundo matiz: **aparecen al pulsar `Show`**, no antes. Un formulario que
se abre ya en rojo culpa al usuario de no haber hecho algo que aún no ha tenido
ocasión de hacer.

Que cada mensaje vaya **junto a su campo** es correcto y se queda: eso lo decidió
la fase 1. Lo que cambia es **cuántos** y **cuándo**.

> `src/screens/dashboard/custom-range.ts:31-35` y `Dashboard.tsx:230-235`

### 6 · `Enable Blocking` es primario; sólo `Disable` es destructivo

En el menú, `Enable Blocking` sale en tono destructivo. **Encender el bloqueo no
destruye nada**: es primario. Destructivas son las otras nueve entradas —`Disable
Blocking` y las ocho duraciones—, porque todas apagan la protección.

La confirmación ya lo hace bien —`Enable` en primario, en 3c—; es el **menú** el
que no concuerda con su propio diálogo.

> `src/screens/dashboard/BlockingMenu.tsx:73` — `variant: turnOn ? 'primary' : 'danger'`

### 7 · Las versiones, una sola vez a 1440

A 1440 salen **dos veces**: en el pie del lateral y otra vez en el de página. A 390
sólo una, porque el lateral se esconde — así que la solución ya está dibujada en la
propia entrega.

Hoy la consola las pinta **una sola vez**: `<Versions>` va dentro del `aside`, y el
pie de página —`FooterLinks`— lleva sólo los seis enlaces y ninguna versión. Se ve
igual en el volcado del contrato: `DNS Server`, `15.4`, `Web Console` y `0.1.0`
aparecen **una vez cada uno** en la prosa del cromo.

> `src/app/Shell.tsx:266`, y la sección «el cromo» del contrato

Dónde se quede es decisión de diseño; que esté **una vez** no lo es.

---

## Y las siete trazas de la gráfica: no las cambies

La gráfica de líneas dibuja **7 trazos para 11 series**. Lo revisé y **no es un
defecto**: tres de las que faltan valen cero en el ejemplo y varias series a cero se
solapan en la misma línea. No hay nada que arreglar ahí.

Lo que **sí** es obligatorio, y ya se cumple, es que se conserve:

- **las once entradas de leyenda**, con su nombre;
- **su color**, el de su tarjeta;
- y **su interacción independiente** — pulsar una serie en la leyenda la oculta, que
  es una interacción que existe hoy y que no puede perderse.

Se dice explícitamente para que la corrección 1 —que toca esas mismas leyendas— no
se lleve por delante ninguna de las tres.

---

## Qué devolver

**Sólo el delta**: las siete correcciones aplicadas allí donde salgan, a 1440 y a
390. Sin recorrido nuevo, sin rehacer ramas y sin tocar nada de la lista de arriba.
