# Barra de aceptación — arquetipo herramienta

Esto es contra lo que se juzga el retorno. Va incluido en el encargo a propósito:
una barra que sólo conoce quien corrige convierte la reconciliación en una
sorpresa, y esta ronda tiene **una sola**.

Un dibujo que vuelva se acepta si, y sólo si:

- **Los 23 controles siguen ahí** —7 en DNS Client, **1** en Logs y 15 en Query
  Logs— con su rótulo literal, sus opciones y sus placeholders. Ninguno se funde
  con otro ni cambia de tipo. *View Logs no tiene ninguno*: su «lista» son botones,
  y el `Cluster Node` de Logs lo monta el contenedor y lo comparten las dos
  sub-pestañas.
- **Los 9 verbos siguen ahí** —2 + 4 + 3—, incluidos los tres que hoy desaparecen
  sin permiso, que vuelven **apagados y con candado**, nombrando el permiso.
- **Las 15 ramas están dibujadas** —8 de DNS Client y 7 de View Logs—, incluidas
  las diez que **no se han observado**. Un dibujo que sólo enseñe el caso bueno no
  vale.
- **Y los 5 estados de Query Logs**, que esas quince no cubren: reposo sin tabla,
  con resultados, sin resultados, «falta la app» y el modo `Live Update`.
- **Vacío y error no se dibujan igual** en ningún sitio; en View Logs ya son dos
  textos distintos y siguen siéndolo.
- **Los siete colores de fila tienen leyenda**, o el dibujo dice por qué no.
- **Los cinco comportamientos de upstream se respetan**: los dos textos distintos
  de «falta la app», el orden de validación, `Live Update` como modo, el valor
  recordado por página y el `-1` de la última página.
- **Las literales no se reescriben.** Ni las de las confirmaciones, ni las de los
  avisos, ni `No Log File Was Found`, ni `Run a query to see the response.`
- **Entrega a 1440 y a 390.**
- **No se rediseñan las primitivas ya cerradas**: panel, tabla, campo, casilla,
  aviso, pastilla, paginación y la señal del interruptor maestro.
- **Viene una línea por cada uno de los seis patrones**, diciendo qué se decidió.
  Sin eso hay dibujo pero no hay decisión, y la reconciliación no tiene contra qué
  cotejar lo que se pidió.
- **Si el patrón 5 necesita extender una primitiva, se dice y se justifica.** Es el
  único punto donde se admite, y admitirlo en silencio es peor que no admitirlo.
