# Dibujo contra construido: la auditoría de las cinco entregas

**Fecha:** 2026-09-07 · **Método:** cada entrega aceptada renderizada a 1440 y
comparada con la app a 1440, diferencia a diferencia

> Adrián dijo que la pantalla no se parecía al dibujo. Se comprobó una y era cierto;
> se comprobaron las otras cuatro y también. **El paso de construir nunca se
> verificó contra la entrega**, y por eso el mismo error aparece cinco veces.

Nada de esto lo dice un documento: cada línea es una captura del dibujo contra una
captura de la app.

## Lo que estaba mal, y era el mismo error cinco veces

| Superficie | Lo que el dibujo pone | Lo que había | Estado |
|---|---|---|---|
| **Todas las de sub-pantallas** | sub-navegación **bajo el título**, lateral a doce | sub-entradas anidadas en el lateral: 14 en DHCP y Logs, 18 en Administración, 21 en Settings | arreglado |
| **Dashboard** | tres sectores en fila, tres top-N en otra, `Server` a tres columnas | raíl derecho de 310 px con todo apilado y media página vacía | arreglado |
| **Zones** | `Delete Zones` en la barra de selección | en la cabecera, junto a `Add Zone` | arreglado |
| **Settings** | columna «ON THIS PAGE» | no está | **aplazado con su condición** (2026-09-04): va en Settings y SSO juntas, o en ninguna |

La de la sub-navegación es la que más pesa, y estaba escrita: el piloto 3 la razonó
—«el raíl de 60 px esconde las etiquetas por debajo de 1180, así que ahí las nueve se
quedarían sin sitio»— y las dos entregas de la fase 3 la vuelven a dibujar. Tres
veces dicha, tres veces no construida.

## Lo que NO se construye del dibujo, y por qué

Son cuatro, y las cuatro se declaran en vez de seguirse. Un dibujo aceptado no es una
orden — es la lección que Administración ya dejó escrita, aplicada aquí a la inversa:

1. **Los títulos de panel en versalitas.** El dibujo los pone en caja normal. Lo pone
   `ui/Panel` para las **once pantallas** con panel: especializar la caja en una sola
   crea dos clases de panel, que es lo que `dev/uniformity.js` existe para impedir. Si
   se quiere cambiar, se decide en la primitiva y se auditan las once.
2. **La columna `#` en la tabla de sesiones.** El censo del contrato dice seis
   columnas y no la incluye. El contrato manda sobre el dibujo en **qué** existe.
3. **`View Details` como botón con texto.** En la consola las acciones de fila son
   icono más menú, en todas las tablas. Un botón con texto ahí haría de `Sessions` la
   única distinta.
4. **La casilla de seleccionar todo repetida en la barra de selección.** El dibujo
   lleva una en la barra y otra en la cabecera de la tabla; dos controles para lo
   mismo es lo que esta consola quita en todas partes.

Y una que el dibujo no puede decidir: **la barra de selección de Zones se dibuja
siempre**, no sólo cuando hay filas marcadas. Con nada marcado, upstream contesta
`Please select one or more zones to delete.` a un clic en el verbo; una barra que
apareciera con la selección dejaría esa respuesta fuera de la pantalla. El dibujo no
puede quitar una respuesta de upstream, y hay una prueba que lo sujeta.

## El pie de página, y por qué no se toca

Las tres entregas dibujan tres pies distintos: enlaces a la izquierda y versiones a la
derecha (herramienta), enlaces a la izquierda y `Theme: byGarcia` a la derecha
(Zones), enlaces centrados (cromo). El contrato del cromo fija **qué seis enlaces
existen**, no su reparto, y los seis están. Con tres dibujos que se contradicen, la
composición no es una decisión de diseño tomada: se anota y se deja.

## Lo que queda medido

- Las cuatro secciones con sub-pantallas: lateral a **12** en todas, barra con sus
  pestañas, `aria-current="page"` en la activa, sin desbordes a 1440 ni a 390, y a 390
  la barra se desplaza en vez de partirse.
- Barrido de uniformidad de 31 rutas a 1440: **las quince familias idénticas cadena a
  cadena** al último barrido registrado, después de mover la navegación de las cuatro
  secciones y de recomponer el Dashboard entero.
- Portón: typecheck, lint, `lint:language`, `css-dead`, paridad de upstream y **1.106
  pruebas** por código de salida 0.
