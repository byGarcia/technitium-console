# Rediseño: DNS Client + Logs — arquetipo: herramienta

Las **dos últimas superficies grandes** del recorrido, en **una sola ronda**. Van
juntas porque son el mismo arquetipo y es el único de los cuatro que no tiene
piloto: los tres que hay dibujaron vista general, colección y formulario denso.

Son tres pantallas: `DNS Client`, y las dos sub-pestañas de `Logs` —`View Logs` y
`Query Logs`—.

## La regla que gobierna esta consola

Sustituye a la consola que trae Technitium DNS Server, y **el comportamiento no
puede cambiar**. Se puede recolocar, reagrupar, cambiar el aspecto, cambiar qué
componente lleva qué, y cambiar densidad y jerarquía. **No** se puede quitar un
campo, dejar caer una ayuda, reescribir un rótulo, añadir un paso ni inventar una
ruta.

La paridad se juzga **contra upstream**, no contra esta consola: si algo está aquí
porque upstream lo tiene, sigue estando.

## ESTE ENCARGO ESTÁ ACOTADO. Léelo antes que nada

Es la cuarta ronda y las tres anteriores ya decidieron casi todo. Este encargo
**no vuelve a abrir nada de eso**. Lo que se pide es corto y concreto.

### Lo que se HEREDA y no se discute

- **La dirección** de la fase 1 (anexo A). Es la entrada, no material opinable.
- **Las primitivas** de la fase 2, cerradas el 2026-09-03. Se usan, no se
  rediseñan: `Alert` · `Button` · `Check` · `ClusterNodeSelect` · `Confirm` ·
  `Details` · `Dialog` · `EditableTable` · `Empty` · `Externo` · `Field` ·
  `FooterLinks` · `Form` · `Icon` · `Menu` · `Notifier` · `Pagination` · `Panel` ·
  `PanelForm` · `SectionHeader` · `SectionIndex` · `Segmented` · `Select` ·
  `SessionCells` · `Table` · `Tag` · `Tooltip`.
- **El cromo** —lateral, cabecera, pie, menú de cuenta—, ya dibujado y construido.
- **La tabla, la paginación, el panel, el campo, la casilla, el aviso y la
  pastilla**, tal como quedaron. Query Logs usa la MISMA tabla que Zones.
- **La señal del interruptor maestro**, cerrada el 2026-09-03: filete ámbar en el
  canto de la fila, la opacidad que ya trae el control apagado, y una pastilla que
  **nombra** el interruptor. *Ámbar = puedes; candado = no puedes.*
- **El botón sin permiso**: sigue estando, apagado, con candado, y diciendo qué
  permiso falta. No desaparece.

Si algo de esa lista aparece redibujado en el retorno, el retorno se rechaza por
eso solo. No es rigidez: es que ya se pagó decidirlo.

### Lo que hay que diseñar — SEIS patrones, y nada más

Son los seis que ningún piloto dibujó. **El encargo es éstos**:

1. **La superficie de salida cruda.** Un bloque de texto preformateado que no se
   interpreta: el JSON de la respuesta en DNS Client y el texto del fichero en
   View Logs. Cómo se enmarca, cómo se desplaza, qué pasa con las líneas largas.
   **Dato duro: el visor cargó 1.073.928 caracteres en un solo bloque.** Un dibujo
   que trate ese panel como un párrafo está dibujando otra cosa.
2. **El plegable** — `Raw Responses (N)`, cerrado por defecto, y que sólo existe
   cuando hay algo dentro.
3. **El maestro–detalle a dos paneles a la vez.** La lista de ficheros y el visor
   conviven en pantalla; hoy `250px 910px` a 1440. Qué pasa a 390, donde no caben
   los dos.
4. **El formulario de filtro de catorce controles** encima de una tabla. No es la
   barra de filtro del piloto 2: es un formulario, y hay que decidir su agrupación
   y su jerarquía.
5. **El modo que apaga**, con la polaridad INVERTIDA respecto a la señal heredada.
   `Live Update` apaga cuatro controles y un verbo **por estar ENCENDIDO**. La
   señal del maestro dice «esto lo puedes encender tú»; aquí hay que decir «esto
   está apagado porque otra cosa está activa», que no es lo mismo. **Es el único
   punto donde se admite extender una primitiva cerrada**, y hay que justificarlo.
6. **El código de color de filas de siete valores, y su leyenda.** Hoy son siete
   fondos y **ninguna leyenda**, contra la regla de la fase 1 —*toda etiqueta del
   servidor lleva su entrada de leyenda*—. Hay que resolver las dos cosas: qué
   colores, y cómo se explican.

### Lo que se mantiene completo aunque no se rediseñe

Las **tres pantallas enteras** tienen que aparecer en el retorno, con **sus 23
controles y sus 9 verbos**, aunque la mayoría de esos elementos se dibuje con lo
heredado y sin decisión nueva. El encargo son los seis patrones; **la entrega es
la pantalla completa**, porque un patrón dibujado suelto no dice dónde va.

Y con **sus veinte estados**: las **quince ramas** de DNS Client y View Logs —de
las que **diez no se han observado y aun así hay que dibujarlas**— más los **cinco
estados de Query Logs**. Un retorno que sólo enseñe el caso bueno no vale: la
mitad del trabajo de esta consola es que un fallo no se dibuje como un vacío.

### Una entrega y una reconciliación

**Una sola entrega**, con las tres pantallas y sus veinte estados, **a 1440 y a
390 px**. Después, **una sola reconciliación**: se coteja contra el anexo C punto
por punto y se corrige lo que incumpla. No hay rondas intermedias de opinión.

## Cómo leer lo que viene, que es la mitad del encargo

Lo que sigue viene de **cuatro sitios distintos** y las marcas no son decorativas:

| Marca | De dónde salió | Qué garantiza |
|---|---|---|
| **DOM** | Medido en la pantalla con la herramienta del repositorio | Que eso está ahí hoy |
| **API** | La respuesta real del servidor | Lo que el servidor manda |
| **FUENTE** | Leído en el código | Lo que ninguna de las dos anteriores puede decir |
| **NO OBSERVADO** | Ni medido ni capturado | **Existe, y esta captura no lo prueba** |

Las referencias del tipo `QueryLogs.tsx:118` son **procedencia, no enlaces**: dicen
de dónde salió el dato. No hace falta abrirlas ni se puede.

### Los números son contexto, no contrato

La instancia de la que salió esta captura la sembré a mano. Por tanto:

- `2828` consultas, `283` páginas, los tres ficheros de log y sus tamaños,
  `1.073.928` caracteres, `casa.test`, `127.0.0.1`, `Query Logs (Sqlite)` y
  `QueryLogsSqlite.App` **son de mi laboratorio**.
- Lo que **sí** es contrato: los **rótulos**, las **opciones**, las **relaciones**,
  las **reglas** y la **forma**.
- Las magnitudes —un millón de caracteres, 283 páginas, 28 tipos de registro— **sí
  importan para dimensionar**: son reales, aunque los valores concretos no lo sean.

Donde el contrato dice **volátil**, es exactamente eso.

## A qué viene quien abre estas pantallas

**Arquetipo: herramienta.** Las tres se abren **cuando algo ya ha ido mal**. Nadie
entra en DNS Client a admirar una respuesta correcta ni en Query Logs a pasear:
se entra a averiguar por qué un nombre no resuelve.

De ahí sale lo que gobierna el arquetipo, y es lo contrario de la vista general:
**aquí no se resume, se muestra**. El dato crudo es el producto. Una respuesta
DNS «presentada bonita» con la mitad de los campos plegados es exactamente lo que
hace inútil la pantalla, porque el campo que hacía falta es siempre el que no se
enseñó.

Y una consecuencia concreta que el contrato recoge: **en DNS Client un `Warning!`
puede convivir con una respuesta válida**. No es «o error o dato». El dibujo tiene
que dejar sitio a los dos a la vez.

## Qué hay que devolver

1. **Las tres pantallas completas**, a **1440 y a 390 px**, con los 23 controles y
   los 9 verbos colocados.
2. **Los veinte estados** dibujados.
3. **Una decisión escrita, y sólo una línea, por cada uno de los seis patrones**:
   qué se decidió y qué mantiene junto o separado. No hace falta más.
4. Si algo necesita una primitiva que no está en la lista heredada —y el punto 5
   probablemente la necesite—, **se dice y se justifica**, no se dibuja como si ya
   existiera. Así se decidieron `Tooltip` y `SectionIndex`.

El retorno se juzga contra el **anexo C**, que va incluido para que no haya
sorpresa.

---

# Anexo A — la dirección (fase 1)

<!-- DESIGN.md -->

---

# Anexo B — el contrato de las tres pantallas

<!-- CONTRATO -->

---

# Anexo C — la barra de aceptación

<!-- BARRA -->
