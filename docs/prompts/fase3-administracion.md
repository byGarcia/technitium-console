# Rediseño: ADMINISTRACIÓN — seis sub-pantallas, cinco arquetipos

La **última superficie grande** del recorrido. Va en ronda propia y no heredando
porque no es un arquetipo: son **cinco arquetipos en seis sub-pantallas**, y una de
ellas —la matriz de permisos— no se parece a nada de lo dibujado hasta ahora.

`Sessions` · `Users` · `Groups` · `Permissions` · `SSO` · `Cluster`.

## La regla que gobierna esta consola

Sustituye a la consola que trae Technitium DNS Server, y **el comportamiento no
puede cambiar**. Se puede recolocar, reagrupar, cambiar el aspecto, cambiar qué
componente lleva qué, y cambiar densidad y jerarquía. **No** se puede quitar un
campo, dejar caer una ayuda, reescribir un rótulo, añadir un paso ni inventar una
ruta.

La paridad se juzga **contra upstream**, no contra esta consola.

## Lo que se HEREDA y no se discute

Es la quinta ronda. Las cuatro anteriores decidieron casi todo y **este encargo no
lo reabre**:

- **La dirección** de la fase 1 (anexo A). Es la entrada, no material opinable.
- **Las primitivas** de la fase 2, cerradas: `Alert` · `Button` · `Check` ·
  `ClusterNodeSelect` · `Confirm` · `Crudo` · `Details` · `Dialog` ·
  `EditableTable` · `Empty` · `Externo` · `Field` · `FooterLinks` · `Form` ·
  `Icon` · `Menu` · `Notifier` · `Pagination` · `Panel` · `PanelForm` ·
  `SectionHeader` · `SectionIndex` · `Segmented` · `Select` · `SessionCells` ·
  `Table` · `Tag` · `Tooltip`.
- **El cromo**, la tabla con su ordenación, el diálogo con sus cuatro anchos, el
  menú de fila, la paginación y el pie de recuento.
- **La señal del interruptor maestro** —filete ámbar, opacidad, una pastilla que
  nombra, en sus dos polaridades `Needs …` y `While …`—.
- **La salida cruda** (`Crudo`) y **el plegable**, cerrados en la ronda anterior.

Si algo de esa lista vuelve redibujado, el retorno se rechaza por eso solo.

## Lo que hay que decidir — y son SEIS cosas

1. **La matriz.** Once secciones, cada una con usuarios y grupos contra tres verbos
   —`View`, `Modify`, `Delete`—, en sólo lectura, y un modal por sección para
   editarla. Hoy mide del orden de dos mil quinientos píxeles y es un muro. Cómo
   se recorre, cómo se compara una sección con otra, y qué pasa a 390.

   **Y una cosa que hay que resolver, no sólo dibujar:** hoy la rejilla **no es una
   tabla** y sus casillas **no tienen nombre accesible**. Quien use un lector de
   pantalla oye ochenta y cuatro casillas sin nombre y sin ejes por los que
   moverse. El dibujo tiene que decir **cómo se llama una celda**.

2. **Una pantalla que es tres.** `Cluster` cambia según qué es este servidor: sin
   clúster, primario o secundario. Los verbos de cabecera son distintos en cada
   una —`New Cluster`/`Join Cluster` · `Options`/`Delete Cluster` ·
   `Resync`/`Options`/`Leave Cluster`—. No es un estado de carga: son tres
   pantallas con el mismo título.

3. **Una regla de fila que depende de quién mira.** `Edit Node` sale en la fila
   propia siempre, y **además en la del primario si miras desde un secundario**.
   La misma fila ofrece cosas distintas según desde dónde se abra la consola.

4. **La casilla `Force`.** Cuatro diálogos la llevan, y **no es un parámetro: cambia
   lo que la acción significa**. Sin ella la operación se coordina con el otro nodo;
   con ella se hace igualmente, aunque el otro no conteste. Un dibujo que la ponga
   como una casilla más de un formulario está diciendo algo que no es.

5. **Dos superficies de detalle que no son confirmaciones.** `User Details` y
   `Group Details` llevan **tablas dentro** —los grupos de un usuario y sus
   sesiones; los miembros de un grupo— con sus propios verbos.

6. **Una sección sin permisos.** Es la única de las doce donde **no se dibuja
   candado**: upstream no oculta ni deshabilita nada aquí.

   La ausencia de restricción visual **no es un hueco que rellenar**: los verbos se
   quedan visibles y habilitados, sin candado y **sin explicación añadida**, y un
   rechazo real lo comunica el `Notifier`. Una barra que explica que no hay
   restricción es una restricción explicada, y ocuparía sitio en las seis
   sub-pantallas para decir que no pasa nada.

## Cómo leer lo que viene

| Marca | De dónde salió | Qué garantiza |
|---|---|---|
| **DOM** | Medido en la pantalla con la herramienta del repositorio | Que eso está ahí hoy |
| **API** | La respuesta real del servidor | Lo que el servidor manda |
| **FUENTE** | Leído en el código | Lo que ninguna de las dos anteriores puede decir |
| **NO OBSERVADO** | Ni medido ni capturado | **Existe, y esta captura no lo prueba** |

Las referencias `Cluster.tsx:266` son **procedencia, no enlaces**.

### Los números son contexto, no contrato

Para poder contratar `Cluster` **hubo que montar un clúster de verdad** en el
laboratorio: dos nodos, y la pantalla se vio desde los dos lados. Por tanto:

- `dev.cluster.test`, `nodo2.cluster.test`, las IP `172.23.0.x`, `Total Users: 3`,
  `Total Nodes: 2` y **las 84 casillas de la matriz** son de mi instancia.
- **Las once secciones SÍ son estructura.** Las casillas salen de cuántos usuarios y
  grupos tienen entrada en cada una; con otra configuración son otras.
- **Las dos alturas también son volátiles**: la matriz mide del orden de **dos mil
  quinientos** píxeles y SSO **dos mil**, y las dos se mueven con las filas que
  tengan delante —permisos de grupo en una, scopes y asignaciones en la otra—. La
  magnitud sirve para dimensionar: **las dos son muros**. El dígito exacto, no.

## A qué viene quien abre estas pantallas

Aquí no se administra el DNS: **se administra quién puede administrarlo**. Y el
error más caro no es no encontrar un botón, es **creer que has dado un permiso que
no has dado** —o quitárselo a quien lo necesitaba sin enterarte—.

De ahí sale lo que gobierna la ronda: **lo que está concedido tiene que poder
leerse de un vistazo y compararse entre secciones**. Una matriz preciosa donde hay
que contar celdas para saber si `Operadores` puede borrar zonas es una matriz que
no sirve.

Y de ahí sale también por qué `Cluster` importa: es la única pantalla de la consola
donde **una acción puede dejar el sistema partido en dos**, y por eso sus cuatro
`Force` no son un detalle.

## Qué hay que devolver

1. **Las seis sub-pantallas completas**, a **1440 y a 390 px**, con sus 41 columnas
   y sus 21 verbos colocados.
2. **Las tres ramas de `Cluster`**, que son tres dibujos.
3. **Las 24 superficies de diálogo**, incluidas las no observadas. Son **22
   títulos** en 25 instancias: `Edit Node - {nodo}` y `Save Config` son **dos
   diálogos cada uno bajo el mismo rótulo**, y `Delete Session` es **uno solo**
   montado desde dos sitios. Dibujar 22 pierde dos diálogos; dibujar 25 duplica
   uno.
4. **Las 27 ayudas**, con su literal. El anexo B las lleva enteras: **no se
   reescriben ni se resumen**, ni siquiera para que suenen mejor.
5. **Una línea por cada una de las seis decisiones**, diciendo qué se decidió.
6. Si algo necesita una primitiva que no está en la lista heredada, **se dice y se
   justifica**, no se dibuja como si existiera.

El retorno se juzga contra el **anexo C**.

---

# Anexo A — la dirección (fase 1)

<!-- DESIGN.md -->

---

# Anexo B — el contrato de las seis

<!-- CONTRATO -->

---

# Anexo C — la barra de aceptación

<!-- BARRA -->
