# Piloto 1 — Dashboard, dentro de su shell

> **Dónde va:** proyecto **«technitium-ui — consola DNS»** en Claude Design.
> Es un piloto de la Fase 1: sirve para decidir la dirección, no para entregar una
> pantalla. Lee antes `10-auditoria.html` (lo que este proyecto ya decide y lo que
> no) y `11-codigo.html` (lo que el código ha decidido desde entonces).

## La regla que gobierna todo

**Sólo diseño, cero funcionalidad.** Mismos controles, mismos textos, mismos
pasos. Reorganiza, reagrupa, cambia densidad, jerarquía y qué componente lleva
qué. No quites un control, no reescribas una etiqueta, no añadas un paso, no
inventes una ruta.

Los tooltips sólo pueden presentar un nombre que ya existe —la etiqueta de un
botón que sólo es icono, un valor truncado entero—. Nunca explican algo nuevo ni
sustituyen a una etiqueta visible.

## Por qué esta pantalla es el piloto

Es la primera del menú, y el recorrido va en orden de menú porque así se prueba
la consola. Y arrastra el **chrome**, que no es una entrada de menú y no puede
esperar turno: el Dashboard se dibuja dentro de él.

Tu lista B abre justamente por ahí, y esas preguntas son las que este piloto
tiene que contestar.

## Lo que hay que decidir aquí, y no en otro sitio

### Del chrome
- Qué hace el lateral cuando **12 secciones y 9 sub-items no caben en alto**.
- Si existe estado plegado o de raíl, y cómo se marca la sección activa en él.
- Cómo se navega **por debajo de 768 px** y dónde vive el menú entonces.
- **Dónde vive el selector de nodo de cluster.** Ya existe en código (ver
  `11-codigo.html`): no se dibuja si no hay cluster, sólo Dashboard y Settings
  ofrecen el agregado «Cluster», y hoy va como un campo etiquetado más. Es cromo
  permanente que cambia el significado de todo lo que hay debajo y **te debe un
  dibujo**.
- El pie de página y el bloque de versiones del lateral, que ya existen.

### De la vista general
- **Cómo refluyen once tarjetas** a 1024, 768 y 390. Seis columnas no son divisor
  de once: la última fila queda coja en cualquier reparto.
- Qué pasa con una **leyenda de diez series a 390 px**.
- **Si la gráfica responde al puntero.** No hay lenguaje de tooltip en el
  proyecto, y una serie temporal sin lectura de valor es decoración.
- El **dashboard de una instancia recién levantada, todo a cero** — caso
  reconocido en `oscuro.html` y nunca dibujado.
- Qué hace **«Custom»** en el segmento de periodo.
- El **estado de recarga al cambiar de periodo**, que es el segundo en que esta
  pantalla se queda en blanco.

### Transversales que esta pantalla obliga a resolver
- **Foco visible.** No hay ni una regla `:focus` en el proyecto. El segmento de
  periodo son seis botones que se recorren con teclado.
- **Cargando.** Aquí es visible: cada cambio de periodo espera al servidor.
- **Error distinto de vacío.** Hoy sólo existe la caja discontinua, y «no hay
  datos» y «la petición falló» no pueden dibujarse igual.
- **La escala de neutros.** Está en `11-codigo.html`, con recomendación.

## Todo lo que hay en la pantalla, y tiene que seguir estando

### Chrome
- Lateral, 12 secciones en tres grupos: `Dashboard · Zones · Cache · Allowed ·
  Blocked · Apps · DNS Client` — `Settings · DHCP · Administration` — `Logs ·
  About`. Los sub-items sólo se ven cuando su sección está activa.
- Pie del lateral: dominio del servidor, y **dos versiones** — `DNS Server 15.4`
  y `Web Console 0.1.0`, con marca de actualización cuando la hay.
- Menú de cuenta: `My Profile · Change Password · Configure 2FA ·
  Create API Token · Logout`.
- Pie de página: `Technitium | Blog | Donate | DNS Client | GitHub`, y
  `Theme: byGarcia`.

### Dashboard
- Título `Dashboard`.
- Segmento de periodo, seis opciones: `Last Hour · Last Day · Last Week ·
  Last Month · Last Year · Custom`. Con `Custom`, dos campos de fecha y hora.
- **Once tarjetas**, cada una con cifra, porcentaje y etiqueta, y su color de
  serie: `Total Queries · No Error · Server Failure · NX Domain · Refused ·
  Authoritative · Recursive · Cached · Blocked · Dropped · Clients`.
- **Cuatro gráficas**: la línea de consultas en el tiempo con sus once series y
  su leyenda; y tres donuts — `Query Response Types`, `Query Types`,
  `Protocol Types`.
- **Panel `Server`** con seis contadores: `Zones · Cache · Allowed · Blocked ·
  Allow List · Block List`.
- **Tres listas Top**, cada una con su botón `More`: `Top Domains`,
  `Top Blocked Domains` —que además lleva un selector `Blocking`— y
  `Top Clients`.
- El selector de nodo de cluster, cuando hay cluster.

Los colores de serie son los de `11-codigo.html`, ya corregidos: el ámbar vuelve
a ser sólo interfaz.

## Los estados que hay que contestar

`poblado` · `vacío` (instancia recién levantada, todo a cero) · `cargando`
(cambio de periodo) · `error` (la petición falló, y no puede parecerse al vacío).

A **1440, 1024, 768 y 390 px**. El caso móvil no es un extra: el administrador
abre esto desde el teléfono cuando algo ha dejado de resolver.

## Qué devolver

Una maqueta por estado y por ancho relevante —no hacen falta las dieciséis
combinaciones, sí las que cambian algo— y **una línea por decisión de agrupación
diciendo qué mantiene unido a ese grupo**.

Y por cada hueco de la lista B que cierres, la regla en una frase, para poder
llevarla a `tokens.css` sin interpretarla.
