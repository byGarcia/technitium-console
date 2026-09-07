# Rediseño: Dashboard + cromo + Login — arquetipo: vista general

Es la **primera superficie** del recorrido. El cromo va con ella y no después,
porque la primera pantalla se dibuja dentro de él.

## La regla que gobierna esta consola

Sustituye a la consola que trae Technitium DNS Server, y **el comportamiento no
puede cambiar**. Se puede recolocar, reagrupar, cambiar el aspecto, cambiar qué
componente lleva qué, y cambiar densidad y jerarquía. **No** se puede quitar un
campo, dejar caer una ayuda, reescribir un rótulo, añadir un paso ni inventar una
ruta.

Un tooltip puede mostrar un nombre **que ya existe** —el rótulo de un botón que
sólo tiene icono, un valor truncado entero—. No puede explicar nada nuevo ni
sustituir a un rótulo visible.

La paridad se juzga **contra upstream**, no contra esta consola: si algo está aquí
porque upstream lo tiene, sigue estando.

## Cómo leer lo que viene, que es la mitad del encargo

Lo que sigue viene de **cuatro sitios distintos** y las marcas no son decorativas.
Mezclarlas es como un dato de mi laboratorio acaba dibujado como si fuera la
pantalla:

| Marca | De dónde salió | Qué garantiza |
|---|---|---|
| **DOM** | Medido en la pantalla con la herramienta del repositorio | Que eso está ahí hoy |
| **API** | La respuesta real del servidor | Lo que el servidor manda |
| **FUENTE** | Leído en el código | Lo que ninguna de las dos anteriores puede decir |
| **NO OBSERVADO** | Ni medido ni capturado | **Existe, y esta captura no lo prueba** |

Las referencias del tipo `Dashboard.tsx:142` son **procedencia, no enlaces**: dicen
de dónde salió el dato. No hace falta abrirlas ni se puede.

### Los números son contexto, no contrato

**La instancia de la que salió esta captura estaba vacía y la sembré a mano** con
consultas de prueba desde tres máquinas. Por tanto:

- `304`, `66`, `21.71%`, `firmada.test`, `catalogo.test`, `127.0.0.1`,
  `172.23.0.2`, `A`, `SOA`, `NS`, `Udp`, `Total Groups: 1`, `Total Sessions: 1`
  y cualquier otra cifra o nombre de dato **son de mi laboratorio**.
- Lo que **sí** es contrato: los **rótulos**, las **relaciones**, las **reglas** y
  la **forma**.
- Si el diseño vuelve con «304» dibujado como si fuera el contenido de la
  pantalla, ha copiado mi instancia en vez de la pantalla.

Donde el contrato dice **volátil**, es exactamente eso.

## La dirección — cerrada en la fase 1, no se reabre

Tres pilotos la fijaron. Va entera más abajo, en el anexo A. **No es material
opinable en este encargo**: es la entrada.

## Las primitivas — cerradas en la fase 2, no se rediseñan

Esta consola ya tiene su juego de componentes, construido y medido, y la fase 2
se cerró el 2026-09-03. **Este encargo no las rediseña.** Se usan.

`Alert` · `Button` · `Check` · `ClusterNodeSelect` · `Confirm` · `Details` ·
`Dialog` · `EditableTable` · `Empty` · `Externo` · `Field` · `FooterLinks` ·
`Form` · `Icon` · `Menu` · `Notifier` · `Pagination` · `Panel` · `PanelForm` ·
`SectionHeader` · `SectionIndex` · `Segmented` · `Select` · `SessionCells` ·
`Table` · `Tag` · `Tooltip`

Las que este encargo toca, y para qué sirve cada una:

| Primitiva | Qué es |
|---|---|
| `Panel` | La caja con borde y su título. Es lo que hace una región |
| `Segmented` | Elegir UNO de unos pocos valores, todos a la vista. **Cambia lo que se ve** |
| `SectionIndex` | El índice de una pantalla larga. **No cambia nada, mueve la rueda.** No es `Segmented` y no se le parece a propósito |
| `Menu` | El menú desplegable, con su separador. Lo destructivo vive **dentro** |
| `Confirm` | La confirmación: título, texto, un verbo y `Cancel` |
| `Dialog` | El diálogo, con **cuatro anchos** por contenido: 440 pregunta · 560 formulario corto · 720 formulario con ramas · 880 el que enseña una tabla |
| `Table` | La tabla de datos, con su ordenación |
| `Empty` | Los tres huecos: vacío, cargando y fallo |
| `Alert` | El aviso, con su tipo y su icono |
| `Tag` | La pastilla de estado. **Una pastilla dice UN estado** |
| `Tooltip` | El refuerzo visual de un nombre que ya existe |
| `Button`, `Field`, `Icon` | Lo evidente |

**Lo que se pide es una disposición, no un juego de componentes nuevo.** Si el
diseño necesita algo que no está en esa lista, **hay que decirlo y justificarlo**,
no dibujarlo como si existiera: una primitiva nueva se decide aparte y con su
motivo, que es como se decidieron `Tooltip` y `SectionIndex`.

## Esta superficie

**Arquetipo: vista general.** A qué viene quien la abre: *a saber, de un vistazo,
si su DNS está sirviendo bien — y si algo va mal, a ver qué.*

Y de ahí sale la trampa que esta pantalla tiene y ninguna otra: **un fallo
dibujado como ceros dice «tu DNS no recibe tráfico»**. Es la mentira más cara de
la consola y la más fácil de creer, porque se parece exactamente a una respuesta
normal.

### Lo que hay, entero

Va en el **anexo B**, completo y sin resumir. Se entrega entero a propósito: lo
que se resume es lo que se pierde.

Trae, atado a cada cosa y no simplemente al lado: su **ayuda**, sus **opciones**,
**de qué depende**, las **acciones que operan sobre ella**, y **qué es volátil**.

### Los estados por los que tiene que responder

**Siete ramas más el estado mixto.** Ninguna es opcional y ninguna se observó en
la captura salvo la última:

1. **Carga**
2. **Error** — y nunca como ceros
3. **Vacío de verdad** — un servidor que no ha recibido nada
4. **Rango personalizado**
5. **Cluster** — con selector de nodo **y sin él**: son dos dibujos
6. **Permisos, en el cromo** — el lateral con menos entradas
7. **SSO, en el menú de cuenta** — tres entradas en vez de cinco
8. **El estado mixto** — que **sí** se observó: la pantalla con **una región vacía
   y siete pobladas a la vez**, y las dos cosas ciertas

El punto 8 no es una curiosidad de mi instancia: es el rasgo del arquetipo. **En
una vista general el estado es de la región, no de la pantalla**, y una región
vacía no puede vaciar visualmente el resto.

### Dónde difiere upstream

Sin diferencias pendientes: la comprobación de paridad da los **28 destinos**, los
**112 textos de ayuda** y los **94 ejemplos** de upstream presentes.

Dos cosas de esta superficie **vienen de upstream** y por eso no se tocan aunque
parezcan mejorables:

- Que el menú `Blocking` **pregunte el estado al abrirse** y no al dibujar la
  pantalla. Parece un retraso evitable y no lo es: entre una cosa y otra el ajuste
  puede haber cambiado desde otra pestaña.
- Que el menú `Blocking` viva **en la cabecera de `Top Blocked Domains`** y no en
  la de la pantalla. Es donde upstream lo pone.

## Qué hay que devolver

**Una disposición por estado, a 1440 y a 390 px**, con todo lo del anexo B
colocado, y **una línea por decisión de agrupación** diciendo qué mantiene junto a
ese grupo.

**Los dos anchos, para cada uno de los ocho estados.** El estrecho no es un extra:
la consola tiene hoy un botón `Menu` que sólo existe ahí, así que un retorno sólo a
1440 deja sin decidir un control que ya está en la pantalla.

Y **el retorno se juzga contra el anexo C**, que va incluido para que no haya
sorpresa: son nueve puntos, tres de ellos bloqueantes.

---

# Anexo A — la dirección (fase 1)

<!-- DESIGN.md -->

---

# Anexo B — el contrato

<!-- CONTRATO -->

---

# Anexo C — la barra de aceptación

<!-- BARRA -->
