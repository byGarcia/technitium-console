# Piloto 3 — `Settings › General`, el arquetipo de formulario denso

> **Dónde va:** proyecto **«technitium-ui — consola DNS»** en Claude Design.
> Es el **tercero y último** de los pilotos de dirección visual. Devuelve un
> fichero nuevo, `15-piloto-settings.dc.html`.
>
> **Léete antes estos tres ficheros del proyecto.** Este encargo llega en una
> conversación nueva a propósito —las anteriores son largas y lo primero que se
> pierde al comprimirlas es justo lo que no puede perderse—, así que la
> continuidad no está en el hilo: está en los ficheros.
>
> - **`14-piloto-zones.dc.html`** — el piloto 2, aceptado. De aquí sale **el
>   sistema modal entero**, que esta pantalla hereda y no rediscute: los cuatro
>   anchos, el pie `[ acciones… ] [ descarte ]`, el `Cancel` del `Confirm`, el
>   error de validación junto a su campo, y **el patrón de fila repetible**, que
>   es exactamente el que usan las dos listas de este panel. Mira su sección `Z0`:
>   lleva escrito qué se corrigió y por qué.
> - **`12-piloto-dashboard.dc.html`** — el piloto 1, cerrado. De aquí salen el
>   cromo, el lateral y su raíl, el foco visible y la regla de carga y error.
> - **`13-iconos-y-color.html`** — los 27 iconos SVG y la paleta medida.
>
> Y `consola.css`, que es la hoja común de los tres. **Este piloto tiene que
> parecerse a los otros dos**: es la misma consola.

## Qué es esto y por qué es el último

Tres pilotos para tres formas que se pelean entre sí. El **1** fue el Dashboard
dentro de su cromo —la vista de conjunto—. El **2** fue Zones —la colección, y
con ella el sistema modal entero—. Éste es el tercero: **un formulario denso**,
y con él se cierra la fase. Después, y sólo después, la dirección se escribe en
`tokens.css`.

`General` es uno de los **nueve** paneles de Settings, y el más denso: 39
controles, 41 párrafos de ayuda, 19 sufijos, 12 avisos y 10 secciones. Se eligió
porque es el único que trae el vocabulario entero de una vez.

**Y no decide sólo para él.** El kit con el que está construido
(`ui/PanelForm.tsx`) es de **Settings y de DHCP**: los dos formularios grandes de
la consola. Lo que salga de aquí lo heredan los otros ocho paneles y la pantalla
de DHCP.

## La decisión de fondo: dónde vive el texto

En una colección la superficie son los controles. **En un formulario denso la
superficie es el texto.** Los números lo dicen mejor que una frase:

| | |
|---|---|
| Controles | 39 |
| Párrafos de ayuda | **41** — unos 5 000 caracteres |
| Avisos `Note!` / `Warning!` | **12** — uno de casi 600 caracteres |
| Sufijos en línea | 19 |
| Secciones | 10 |

Hoy cada ayuda va debajo de su control y cada aviso ocupa su ancho. Eso hace una
página muy larga en la que **el texto pesa más que los campos**. Ésa es la
pregunta del piloto, y admite muchas respuestas —debajo, al lado, plegada, bajo
demanda— pero **sólo dos están prohibidas: que el texto desaparezca y que se
resuma**. Es la regla que gobierna este proyecto: diseño solamente, cero
funcionalidad, y una frase perdida es funcionalidad perdida.

Si la respuesta es plegar, la regla tiene que decir **cómo se sabe que hay algo
plegado**. Un texto que no se ve y no se anuncia está perdido igual.

## Lo que hay que resolver

1. **Dónde vive la ayuda**, que es lo anterior. La decisión más pesada.
2. **La diferencia entre `Note!` y `Warning!`**, que hoy se distingue poco y son
   ocho contra cuatro.
3. **Los dos grises.** Cinco controles se apagan porque su **interruptor maestro**
   está apagado —`Enable UDP Socket Pool` y `Enable EDNS Client Subnet`— y otros
   se apagan por **falta de permiso**. Hoy se ven exactamente igual, y no son lo
   mismo: el primero lo arregla el usuario, el segundo no.
4. **Las 10 secciones en una página larga.** Cómo se agrupan, si se navegan, y
   qué pasa al hacer scroll.
5. **La barra pegajosa**, cuyos cuatro botones responden a **tres permisos
   independientes** —`Backup` y `Restore` comparten uno—. Son hasta **ocho
   combinaciones de visibilidad**; pueden resolverse con una matriz o una
   superposición anotada, no hacen falta ocho maquetas.
6. **Dónde viven las nueve subpestañas.** Hoy las monta el panel lateral.
7. **390 px.** Un formulario denso con 41 párrafos de ayuda es el caso duro.

## Lo que NO hay que decidir, porque ya está decidido

Un piloto que redecide lo cerrado cuesta una vuelta entera. Esto se hereda tal
cual:

- **Del piloto 2, el sistema modal completo**: los cuatro anchos —440 `Confirm`,
  560 formulario corto, 720 formulario con ramas, 880 tabla— y qué forma va en
  cada uno; el error de validación **junto a su campo**, con borde `--dan` y la
  frase debajo; dos niveles de diálogo como máximo, y el de debajo atenuado; el
  pie **siempre `[ acciones… ] [ descarte ]`**, verbo primero y descarte en el
  rincón derecho, llamado `Cancel` cuando el diálogo es una pregunta; y **el
  patrón de fila repetible** —caja propia bajo el rótulo de sección, etiqueta
  literal indexada por campo, `Remove` como icono al final de la fila, `Add`
  fuera de la caja y debajo—, que es exactamente el que usan las dos listas de
  esta pantalla.
- **Del piloto 1**: los 27 iconos SVG, la paleta de series y el foco visible.

## Lo que ya está resuelto en el código y no es un hueco

Esto costó una vuelta en el piloto 2 —se propusieron como huecos cosas que el
código ya tenía—, así que va dicho por delante:

- **`Save Settings` envía SIEMPRE los campos de los nueve paneles**, se esté
  donde se esté. No hay nueve formularios: hay uno con nueve pestañas. Si el
  dibujo sugiere lo contrario, cambia lo que el administrador cree que hace.
- **Un fallo de validación puede estar en otra subpestaña**, y ya se resuelve: el
  aviso dice qué falta y **la pantalla salta a la subpestaña de ese campo**.
- **`Flush Cache` ya pregunta antes de actuar**, con su `Confirm` y su frase.

## Las tres poblaciones, que no son una suma

Al contar los controles salen tres cosas distintas, y **sólo la primera es
superficie**:

- **39 controles comparables** — lo innegociable.
- **8 etiquetas estructurales** — seis rótulos de grupo y dos de lista. La
  pantalla las pinta como encabezado, nunca como control.
- **15 celdas de filas de datos** — las de las dos listas de límites QPM.
  **Cambian con la configuración del servidor**: dibujar las que trae hoy el
  banco de pruebas y llamarlo contrato es confundir un dato con una superficie.

## Qué devolver

`15-piloto-settings.dc.html`, con:

- **El panel a 1440 y a 390**, poblado y completo. No un extracto: si se dibuja
  una sección de muestra, dilo y di por qué.
- **Los dos estados de los interruptores maestros**, para que se vea la
  diferencia entre gris-por-maestro y gris-por-permiso.
- **La barra pegajosa**, y sus composiciones cuando faltan permisos.
- **Las dos listas editables**, aplicando el patrón repetible del piloto 2.
- **Una tabla de reglas**, una frase por regla, como en los dos anteriores.
- **Los textos propuestos marcados aparte**, con dónde, qué y por qué. Todo lo
  que no esté en esa tabla se entiende que es literal del contrato. **Un texto
  cambiado que no aparece marcado es una decisión tomada por descuido** — pasó en
  el piloto 2 con una sola palabra.
- **Y lo que el piloto declare abierto**, dicho por él. Los dos anteriores lo
  hicieron y las dos veces fue lo más útil de la entrega.

El contrato completo va en el anexo. **Va entero a propósito: lo que se resume es
lo que desaparece.**
