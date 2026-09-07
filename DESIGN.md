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
