# Piloto 1 — reconciliación

`12-piloto-dashboard.dc.html`, devuelto el 2026-09-01. Recorrido contra el
contrato capturado antes de enviarlo, punto por punto, **antes de escribir código**.

> **Corregido el 2026-09-02.** El fichero se reescribió a las **08:56**, seis
> minutos después de escribirse esta reconciliación, y la reescritura cambió dos
> de los cuatro colores en discusión. Lo que sigue está recorrido contra la
> versión de las 08:56 (etag `1788332174231441`), que es la que hay. La lección
> es de método: **una reconciliación caduca en cuanto el fichero se toca**, y el
> etag es lo que dice si sigue siendo válida.

## El contrato: casi

| | |
|---|---|
| Chrome | 12 secciones en sus tres grupos y su orden · pie del lateral con dominio y **las dos versiones** · menú de cuenta con sus cinco entradas · pie de página |
| Periodo | Los seis, y `Custom` con sus dos campos de fecha y hora |
| Tarjetas | Las once, por nombre |
| Gráficas | Los tres donuts: Query Response Types, Query Types, Protocol Types |
| Server | Los seis contadores |
| Top | Las tres listas, cada una con su `More`, y el selector `Blocking / Allowed / Blocked` en Top Blocked Domains |
| Cluster | El selector, dibujado por fin |

**Y una pérdida, que este recorrido dio antes por buena.** La leyenda de la
gráfica de línea lleva **diez** series y el servidor manda **once**: falta
`Clients` (`WebServiceDashboardApi.cs:523`, y el `StatCounter` la emite siempre).
La leyenda de Chart.js *es* el control que oculta y muestra cada serie, así que
con la entrada se pierde su interruptor; y con la regla nueva del piloto —la
leyenda escribe el valor de cada serie bajo el puntero— se pierde la única forma
de leer cuántos clientes había en un instante. El donut de Query Response Types
dibuja cuatro porciones y el servidor manda cinco: falta `Dropped`, que en el
ejemplo vale cero — y **eso lo contesta el propio piloto**, que decide en otra
regla que «cero es un dato verdadero».

El contrato se recorrió contra «diez series» porque así lo escribía el piloto.
Un contrato no se lee del dibujo que se está juzgando; se lee de la fuente.

## Quince huecos cerrados, con regla de una frase

Los de la lista B que este piloto resuelve. Tres merecen mención porque resuelven
sin inventar superficie:

- **Once tarjetas.** No son una rejilla de once: son **dos totales** —Total
  Queries y Clients, las dos únicas cifras que no son porcentaje del total— y
  **nueve en tres familias de tres**: resultado, rechazo y origen. Nueve sí se
  reparte. La fila *es* el grupo, así que las tres columnas no se rompen a ningún
  ancho: a 390 encoge la cifra, no la rejilla.
- **El puntero en la gráfica, sin tooltip.** Una guía vertical, y **la leyenda
  escribe el valor de cada serie** en ese instante; sin puntero vuelve al total
  del periodo. Cierra el hueco del proyecto, que no tiene lenguaje de tooltip —
  pero conviene decirlo entero: **el código sí tiene tooltip hoy**, el de Chart.js
  en modo `index` (`Chart.tsx:125`). Esto no lo evita, lo **sustituye**. Sale sin
  pérdida porque el modo `index` enseña las mismas cifras que la leyenda pasaría
  a escribir — a condición de que la leyenda las lleve todas, que es justo lo que
  hoy no cumple.
- **Error ≠ vacío.** Borde continuo `--dan` sobre `#2a0d0d`, con causa, hora del
  último dato bueno y un solo control, `Retry`. **Nunca el borde discontinuo**,
  que queda reservado al vacío. Y el vacío se afina: cero es un dato verdadero,
  se dibuja `0` con `—` de porcentaje; sólo lo que no puede dibujarse sin forma
  cae a la caja.

Y una que faltaba en toda la consola: **foco visible**, `2px` de `--acc` con
`2px` de separación, y `--ink` sobre relleno ámbar — que es lo único que se ve
encima del ámbar.

## Las dos divergencias, resueltas

Las dos se devolvieron al proyecto de diseño en `13-iconos-y-color.html`
(copia local en esta carpeta), porque es él quien decide diseño y porque un
diseño que perdió un control no es punto de partida. Ninguna se ha aplicado
todavía a `tokens.css`: eso es 1.4, cuando estén los tres pilotos.

### 1 · Los colores de serie: medidos, y el resultado sale al revés

Las cifras las produce `dev/palette-distance.mjs` —CIEDE2000 sólo entre pares que
comparten gráfica, repetido a través de protanopia y deuteranopia—, no el ojo.

Discrepan **cinco** de las once series, y la reescritura de las 08:56 ya había
arreglado dos de las cuatro que esta nota daba por pendientes: `--c-nx` dejó de
ser gris y `--c-rec` dejó de ser turquesa.

| Serie | Código | Piloto | Gana | Por qué |
|---|---|---|---|---|
| Total | `#cbd5e1` | `#60a5fa` | piloto | el neutro está a ΔE00 **7,0** de `--ink` |
| NX Domain | `#fb923c` | `#a3e635` | piloto | el naranja está a **10,5** del ámbar de Clients |
| Refused | `#facc15` | `#22d3ee` | piloto | el amarillo está a **13,8** del ámbar |
| Recursive | `#a78bfa` | `#fb923c` | piloto | **la que más pesa** |
| Dropped | `#94a3b8` | `#868e96` | código | el del piloto **es** `--faint`, mismo hex |

**El choque de hues contiguos en el donut de Query Response Types lo tiene hoy el
código, no el piloto**, que es lo contrario de lo que decía esta nota: `Recursive
#a78bfa` contra `Blocked #c084fc` dan **ΔE00 5,5** en el mismo anillo de cinco
porciones. Con Recursive en naranja, el peor par del donut sube a **16,7**.

Dos cosas más que salieron de medir y no estaban en la lista: el ciclo abierto
del código tiene su propio choque —`#a78bfa` contra `#818cf8`, **7,9**— que se
cierra llevando el séptimo a `#f87171`; y **ninguna de las dos paletas sobrevive
al daltonismo**, porque once series no caben en una rueda de tonos. Eso no se
arregla con más hues: lo que hace legible esa gráfica es la guía vertical con la
leyenda escribiendo cada valor, que el piloto ya inventó. Deja de ser un acierto
de composición y pasa a ser la accesibilidad de la pantalla.

### 2 · Los iconos ya estaban decididos — en el código

La lista B los marca como sin decidir —doce glifos Unicode de bloques distintos—
y el piloto los mantiene, y **construye encima**: la regla del raíl de 60 px dice
que al pasar el puntero aparece un tooltip que repite la etiqueta del icono, y
esa regla depende de que el icono se entienda.

En el código esos glifos no existen desde antes de la i18n: `src/ui/Icon.tsx`
son **27 SVG en línea** dibujados a mano, rejilla de 24 y trazo 1,75, y el
lateral los usa hoy. La CSP sin `font-src` ya obligaba a esa vía. Lo que faltaba
no era la decisión: era **contárselo al proyecto de diseño**, que sigue dibujando
`☺` para Administration.

## Cerrado — la corrección volvió el 2026-09-02 a las 09:39

Etag `1788334749846495`, 130 KB contra los 110 anteriores. Recorrido **sitio por sitio**, no de
palabra: 1440, 1024, 768, 390, el lateral que no cabe, el raíl con su tooltip, el cajón y el detalle
del puntero. Las tres correcciones están en los ocho.

| | Estado |
|---|---|
| **Leyenda de once** | Once entradas con `Clients`, en los cuatro anchos y en el detalle del puntero. El donut de Query Response Types rotula `Dropped 0,0%` sin porción |
| **Los dos hexes de texto** | `--c-drop` a `#94a3b8`; el gris `#9aa1a8` fuera del ciclo. Ninguna serie coincide ya con `--ink`, `--mute` ni `--faint` |
| **El ciclo a ocho** | `--cy1..--cy8` con los ocho medidos, en orden. Los dos donuts abiertos los usan |
| **Los iconos** | Los 27 SVG en línea, en las ocho superficies. `☺` no aparece en ninguna |

Y devolvió **más de lo que se pidió**, que es lo que se quería: las tres correcciones subieron a
regla en vez de quedarse en parche.

- **«Recuento de las leyendas»** — *toda leyenda rotula todas las etiquetas que manda el servidor,
  valgan cero o no*. Generaliza el hallazgo de `Clients` a cualquier pantalla con leyenda, que es
  donde volvería a pasar.
- **«Ningún dato del color del texto»** — ninguna serie ni color de ciclo puede coincidir con
  `--ink`, `--mute` o `--faint`. La regla que faltaba para que el defecto no vuelva.
- **«Ciclo abierto de tipos»** — ocho colores porque los tipos de registro no están acotados.
- **«Iconos»** — el set, a **18 px** en el lateral completo y **20 px** en raíl y cajón. Eso era
  decisión suya y la ha tomado.

**Nada de esto se aplica todavía a `tokens.css`.** Es la 1.4, cuando estén los tres pilotos: una
escala escrita con un piloto de tres es una escala escrita con un tercio de la evidencia.

## Lo que el propio piloto declara abierto

Dos cosas, dichas por él y sin maquillar: el tramo **entre 560 y 768 px** usa el
mismo raíl que 1024 y hay que mirarlo en una tableta de verdad; y la guía vertical
de la gráfica necesita una pasada con datos reales para fijar el paso de muestreo.
