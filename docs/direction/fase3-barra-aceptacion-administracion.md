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

  > **Son 29, corregido el 2026-09-04 construyendo.** Faltaban las dos de `Scopes`
  > y `Group Map (Optional)`, que el censo no veía por viajar como hijas JSX. Están
  > transcritas en el contrato y están en el producto. Ver
  > `fase3-construccion-administracion.md`.
- **Los 21 verbos siguen ahí**, cada uno donde vive: cabecera, fila o menú de fila.
- **Las 24 superficies de diálogo están dibujadas.** Son 22 títulos en 25
  instancias, y la diferencia importa: `Delete Session` es **un** diálogo montado
  desde dos sitios, mientras que `Edit Node - {nodo}` y `Save Config` son **dos
  diálogos cada uno con el mismo rótulo**. Dibujar 22 pierde dos; dibujar 25
  duplica uno.
- **La matriz dice CÓMO SE LLAMA UNA CELDA.** *(Corregido el 2026-09-04: nombre sí
  tenían —`aria-label`—; lo que no había era la tabla.)* La rejilla no es una tabla: quien usa un lector de pantalla oye
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
