# Piloto 2 — relevo para la sesión que lo reconcilie

`14-piloto-zones.dc.html` llegó el **2026-09-02**, 111 KB y 1112 líneas, etag
`1788348927968722`. Las 15 capturas del baseline están subidas en `uploads/` del
proyecto. **Nadie lo ha recorrido todavía.**

## Contra qué se recorre

Tres documentos, y el prompt enviado los lleva dentro:

- `piloto-2-contrato-zones.md` — lista y vista de registros.
- `piloto-2-dialogos.md` — once diálogos, quince `Confirm`, matrices atadas a su
  control, y los 50 estados DOM por rama.
- `piloto-2-reconciliacion.md` — qué prueba y qué no la comparación fuente ↔ DOM.

El prompt tal como se envió: `docs/prompts/piloto-2-zones-ready.md`.

## Lo primero, antes de leer nada

**Comprobar el etag.** El piloto 1 se reescribió **seis minutos después** de
commitearse su reconciliación, y la nota describía una versión que ya no existía.
Una reconciliación caduca en cuanto el fichero se toca; el etag es lo que dice si
sigue valiendo.

## La barra de aceptación

1. **Los quince `Confirm`**, con su frase literal. `Resync` tiene **dos** según el
   tipo de zona, y `Delete Zones` pregunta y **luego** lista.
2. **Las cinco pestañas de `Zone Options`.** Un dibujo de `General` no es un dibujo
   de ese diálogo.
3. **Las 23 variantes de `AddEditRecord`**, o la justificación de cuáles se
   dibujan. Ofrece 18 o 19 según la zona; `SOA` sólo al editar.
4. **El selector de nodo de cluster**: condicional, sin agregado, **uno solo** para
   las dos vistas — la única diferencia deliberada con upstream en esta pantalla.
5. **Los dos vacíos distintos** —sin resultados y sin zonas—, que hoy dan la misma
   línea.
6. **La marca de dato caducado**, que es el caso que el piloto 1 no tuvo: allí la
   superficie que fallaba se sustituía entera; aquí quedan datos viejos en pantalla.
7. **Ordenan siete columnas**, `Serial` incluida, y el gesto ya existe: lo que se
   decide es cuándo se ve, no si existe.
8. **Los textos propuestos**, marcados aparte. Si no vienen marcados, es una
   decisión de producto tomada por descuido.

## Las trampas que ya costaron una ronda cada una

- **No importar hallazgos de la lista B como si fueran del código.** La auditoría
  1.1 describe el **proyecto de diseño**. Altura máxima de diálogo, errores de
  validación y señal de ordenación **existen en el código**. Un hueco del dibujo no
  es un hueco de la consola.
- **No fiarse de una captura para afirmar una ausencia.** Una foto es una
  combinación de un momento.
- **Contar por lo que algo es, no por lo que se le parece.** `ADD_TYPES` son ocho
  entradas, no nueve llaves; `Preference` en `MX` y en `NAPTR` son dos, no una.
- **Un hallazgo sobre el producto se verifica antes de decirlo.** Hoy salió uno
  falso —«tres `Confirm` afirman en vez de preguntar»— que era un fallo del
  extractor leyendo el texto de éxito anidado en `action`. Los quince preguntan.

## Lo que queda después

Piloto 3 —un panel de Settings, arquetipo formulario denso— y luego la fase 1.4,
que escribe la dirección en `tokens.css` y en un `DESIGN.md` corto. La paleta de
series ya se aplicó fuera de turno y está anotado en el plan por qué.

## Deuda nombrada y no arreglada

Cuatro rechazos no manejados en `Zones.test.tsx`: siete sitios desreferencian
`outcome.data.response.X` sin guarda, y ese fichero no simula `zones/catalogs/list`
ni `settings/getTsigKeyNames`. **No es trabajo del piloto 2** y no se ha tocado.
