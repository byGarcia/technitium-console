# Piloto 1 — corrección, no rediseño

> **Dónde va:** proyecto **«technitium-ui — consola DNS»** en Claude Design, sobre
> `12-piloto-dashboard.dc.html`. Lee antes **`13-iconos-y-color.html`**, que es de
> dónde salen las tres correcciones y trae las cifras de cada una.

**El piloto está bien y no se vuelve a dibujar.** El reparto de las once tarjetas,
las tres bandas, el raíl, el cajón, el foco visible, `Custom`, la guía vertical con
la leyenda escribiendo valores, el error de borde continuo y el cero como dato
verdadero: todo eso se queda **exactamente como está**. Esto son tres arreglos
puntuales sobre ese mismo fichero.

Si al aplicarlos aparece la tentación de recolocar algo más, es señal de que se
está rediseñando. No.

---

## 1 · La leyenda va corta: son once series, no diez

El servidor manda **once** datasets en la gráfica de línea y el piloto dibuja
diez. Falta **`Clients`**, en los cuatro anchos y en el detalle del puntero.

No es una entrada de leyenda menos. En Chart.js **la leyenda es el control** que
oculta y muestra cada serie, así que con la entrada se va su interruptor. Y con la
regla que este piloto inventó —la leyenda escribe el valor de cada serie bajo el
puntero— se va también la única forma de leer cuántos clientes distintos había en
un instante.

`Clients` ya tiene color asignado, el ámbar `--c-cli`, y ya tiene tarjeta. Lo que
falta es su entrada en la leyenda.

**Y hay que volver a mirar el reparto con once**, no con diez: la regla escrita
—fila envuelta por encima de 1180 px, rejilla de dos columnas por debajo— se
decidió contando diez. A 390 px es donde se verá si aguanta.

El mismo recuento en el donut de **Query Response Types**: el servidor manda cinco
etiquetas —Authoritative, Recursive, Cached, Blocked y **Dropped**— y el piloto
dibuja cuatro. Dropped vale cero en el ejemplo, y **eso ya lo contesta otra regla
del propio piloto**: «cero es un dato verdadero». Si el cero se dibuja en la
tarjeta, se rotula en la leyenda.

## 2 · Dos colores que son exactamente un color de texto

Todo lo demás de la paleta del piloto se adopta —gana en cuatro de las cinco
series en discusión, y es la que arregla el choque del donut—. Dos valores no:

| Dónde | Ahora | A qué | Por qué |
|---|---|---|---|
| `--c-drop` | `#868e96` | **`#94a3b8`** | `#868e96` **es** `--faint`, el mismo hex: la serie se dibujaría del color del texto tenue que la rotula |
| Quinto del ciclo, donut de Query Types | `#9aa1a8` | **`#facc15`** | `#9aa1a8` **es** `--mute`, el color de todas las etiquetas de la consola |

Y **el ciclo abierto necesita ocho colores, no cinco**. El servidor no acota los
tipos de registro, así que el ciclo se agota antes que el donut y a partir de ahí
repite color. Los ocho, en este orden:

```
#38bdf8  #34d399  #a78bfa  #fb923c  #2dd4bf  #f472b6  #f87171  #facc15
```

Medidos: ningún par en choque y uno solo en riesgo. Ninguno es un color de texto.

## 3 · Los iconos: los doce glifos ya no existen

El piloto sigue dibujando `▣ ◆ ○ ✓ ⊘ ⊞ ⌕ ⚙ ▤ ☺ ≡ ⓘ`. En el código no existen
desde hace semanas: son **27 SVG en línea**, rejilla de 24 y trazo 1,75, y el
lateral los usa hoy. Están dibujados uno a uno en `13-iconos-y-color.html`, listos
para copiar.

Sustitúyelos en el lateral completo, en el raíl y en el cajón. Importa
especialmente en el raíl de 60 px: **su regla del tooltip descansa entera sobre
que el icono se entienda**, y hoy cada sistema operativo dibuja esos glifos con la
fuente que tenga.

Lo que sigue siendo decisión del proyecto y no viene decidido: el tamaño del icono
en el lateral completo y en el raíl, y si el tooltip se queda tal como está
descrito.

---

## Qué devolver

El mismo fichero corregido. En las notas, **una línea por corrección** diciendo
qué cambió — y, si el reparto de la leyenda a once entradas obligó a tocar algo a
390 px, esa línea es la que más importa.
