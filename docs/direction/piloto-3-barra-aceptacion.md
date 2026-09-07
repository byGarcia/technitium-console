# Piloto 3 — la barra de aceptación

**Escrita el 2026-09-02, antes de enviar el prompt.** Ése es todo el truco: una
barra escrita después de ver el dibujo se parece sospechosamente al dibujo. El
piloto 2 tuvo la suya antes y por eso sus tres vueltas fueron cortas.

Se recorre contra `piloto-3-contrato-general.md`, que viaja entero dentro del
prompt.

## Los ocho puntos

1. **Los 39 controles, por nombre.** Es lo único que la regla de cero
   funcionalidad no permite perder. Ni uno escondido tras un desplegable nuevo,
   ni uno fundido con otro «porque van juntos».

2. **Las 41 ayudas, cada una con su control.** 39 de control y **2 de las
   listas**, que tienen párrafo propio. Aquí está la decisión de fondo del
   arquetipo: son ~5 000 caracteres de texto, y **dónde vive esa ayuda es el
   piloto entero**. Vale cualquier respuesta —debajo, al lado, plegada, bajo
   demanda— menos dos: que desaparezca, y que se resuma. Si se pliega, tiene que
   decir cómo se sabe que hay algo plegado.

3. **Los 19 sufijos, literales.** `seconds (default 3600/1h)`,
   `bytes (valid range 512-4096; default 1232)`. La mayoría es **el único sitio
   de la pantalla donde se lee el rango admitido**. Un dibujo que los mande a la
   ayuda, o que los pierda, convierte un campo con reglas en una caja vacía.

4. **Los 12 avisos, literales y en su sección.** Ocho `Note!` y cuatro
   `Warning!`, y **la diferencia entre los dos tiene que verse**. Uno de ellos
   mide casi 600 caracteres: si la respuesta es plegarlos, que lo diga como regla
   y diga qué se ve plegado.

5. **Los dos grises, distinguibles.** Cinco controles se apagan porque su
   interruptor maestro está apagado; otros se apagan porque no hay permiso. **Hoy
   se ven igual y no son lo mismo**: el primero lo arregla el propio usuario, el
   segundo no. Es el hueco más claro que deja esta pantalla.

6. **La barra pegajosa, con sus tres puertas de permiso.** Cuatro botones y
   **tres permisos independientes** —`Backup` y `Restore` comparten una—, así que
   existen hasta **ocho combinaciones de visibilidad**, no cuatro. No hace falta
   dibujar ocho barras: una matriz o superposición anotada puede demostrarlas. Y
   `Save Settings` **guarda los nueve paneles**, no el que se está mirando: si el
   dibujo lo sugiere al revés, cambia lo que el administrador cree que está
   haciendo.

7. **Las nueve subpestañas, y la validación que salta.** Dónde viven las nueve es
   decisión del piloto; lo que **no** es decisión suya es que un fallo de
   validación puede estar en otra subpestaña y que la pantalla salta a ella. Eso
   ya está resuelto en el código: no se inventa y no se pierde.

8. **390 px.** Un formulario denso a 390 con 41 párrafos de ayuda es el caso duro
   de esta pantalla, y es donde se ve si la respuesta al punto 2 aguanta o sólo
   funcionaba a 1440.

## Lo que NO se vuelve a decidir

Se dice aquí y se dice en el prompt, porque un piloto que redecide lo cerrado
cuesta una vuelta:

- **El sistema modal entero**, cerrado por el piloto 2: los cuatro anchos y qué
  forma lleva cada uno, dónde se pinta el error de validación, qué pasa cuando un
  diálogo abre otro, la anatomía del `Confirm` —`[ acciones… ] [ descarte ]`, el
  descarte `Cancel` cuando es una pregunta— y **el patrón de fila repetible**, que
  es justo el que aplican las dos listas de esta pantalla.
- **Los iconos, la paleta de series y el foco visible**, cerrados por el piloto 1.

## Las trampas, que aquí son otras

Las del piloto 2 eran de conteo. Las de esta pantalla son de volumen:

- **Resumir un texto no es rediseñarlo, es perderlo.** En una colección la
  superficie son los controles; en un formulario denso **la superficie es el
  texto**. 41 ayudas y 12 avisos son la pantalla, no su relleno.
- **No confundir las tres poblaciones.** 39 controles comparables, 8 etiquetas
  estructurales y 15 celdas de filas de datos. Las 15 **cambian con la
  configuración del servidor**: dibujar cinco filas y llamarlo contrato es
  confundir un dato con una superficie.
- **No dar por hueco lo que ya está resuelto en el código.** Es la trampa que
  costó una vuelta en el piloto 2 con la altura de diálogo, los errores de
  validación y la señal de ordenación. Aquí, lo ya resuelto es el salto de
  validación entre subpestañas.
- **Un panel no es la pantalla.** `General` es uno de nueve, y lo que se decida
  aquí lo heredan los otros ocho **y DHCP**, porque `ui/PanelForm.tsx` es de las
  dos: son los dos formularios grandes de la consola.

## Cómo se recorre cuando vuelva

1. **El etag, antes de leer nada.** Tres veces seguidas ha valido la pena.
2. **Punto por punto contra el contrato**, no de impresión.
3. **Todo hallazgo sobre el producto, verificado contra el fuente antes de
   decirlo.** Los siete del piloto 2 salieron de leer código, y ninguno se veía
   en una captura.
4. **`node dev/verify-evidencia.mjs`** si han pasado días: dice si el panel se ha
   movido bajo el contrato. Comprueba siete cosas de las que el contrato lleva;
   las subpestañas y las dependencias de los maestros no, y está declarado.
