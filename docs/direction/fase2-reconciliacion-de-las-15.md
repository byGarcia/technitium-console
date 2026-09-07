# Fase 2 — reconciliación de las 15 primitivas «a retocar»

**2026-09-03.** La 2.1 clasificó **15 primitivas a retocar**. La fase 2 tocó cinco
ficheros. Cerrar la fase sin decir qué pasa con el resto sería perderlas del
inventario: no es lo mismo «no hacía falta» que «se olvidó», y desde fuera del
repositorio las dos cosas se parecen mucho.

## Se cuenta por decisión, no por primitiva, y por dos escarmientos

**Primer intento: contar por primitiva.** Salía redondo —5 implementadas, 4 que ya
cumplían, 6 aplazadas— y era falso por construcción. La 2.1 no asignó *una*
decisión a cada primitiva: a `PanelForm` le asignó cinco. Contar por primitiva
obliga a elegir un estado para el conjunto, y entonces una `PanelForm` con cuatro
cosas hechas y una sin hacer sale como «implementada». Eso **escondió el filete
ámbar del maestro**, que no está hecho: exactamente la desaparición del inventario
que este documento viene a evitar.

**Segundo intento: contar por decisión, pero afirmando el total.** Decía 21. El
desglose sumaba 26. Un total que no cuadra con su desglose no es un descuido de
aritmética: es la señal de que el total se escribió antes que la lista.

Así que aquí va **la lista primero** —las 26 decisiones, una por fila— y los
totales salen de ella. Cuatro estados:

- **Implementada** — se hizo en la fase 2.
- **Ya cumplía** — estaba puesta antes; se comprueba leyendo, y se cita la línea.
- **Aplazada** — es **cableado de pantalla**, no trabajo de primitiva, y va a una
  superficie **concreta** del recorrido. A un número, no a «más adelante»:
  aplazar a un número es comprobable.
- **Anulada** — la decisión se cayó al mirarla de cerca, y consta por qué.

## Las 26 decisiones

| # | Primitiva | Decisión asignada por la 2.1 | Estado | Prueba o destino |
|---|---|---|---|---|
| 1 | `PanelForm` | Ayuda a tercera columna, `--help-col` | Implementada | Vive en `Form.module.css:23`, que es por donde pasan sus filas |
| 2 | `PanelForm` | `Warning!` antes de los controles, `Note!` después | Aplazada | **#8 Settings.** La primitiva ya exporta los dos y los pinta igual en panel y en modal; **el orden lo decide quien los coloca**, que es cada pane |
| 3 | `PanelForm` | El filete ámbar del maestro | Aplazada | **#8 Settings.** Tercera parte de la señal que cerró el piloto 3 —filete, opacidad, pastilla— y la única sin hacer. Quién es maestro de quién lo sabe el panel |
| 4 | `PanelForm` | La barra pegajosa abajo | Ya cumplía | `PanelForm.module.css:131`, `position: sticky` |
| 5 | `PanelForm` | Anchos de control: `--ctrl-num`, `--area-min` | Implementada | `PanelForm.module.css` |
| 6 | `Table` | La flecha de ordenación sólo al puntero o al foco, y la columna que ordena en ámbar | Ya cumplía | `Table.module.css:168-187`: `.arrow { opacity: 0 }`, y `opacity: 1` + `--acc` en `:hover`, `:focus-visible` y `[aria-sort]` |
| 7 | `Table` | Filas a `--dim` con el dato caducado | Aplazada | **#2 Zones.** La tabla recibe filas y **no sabe cuándo llegaron**: no tiene prop de frescura ni la puede tener sin que alguien se la pase. Y la decisión es del **piloto 2**, no del 1: `piloto-2-relevo.md:37` lo dice con todas las letras — «la marca de dato caducado, que es **el caso que el piloto 1 no tuvo**». El piloto 2 lo resolvió entero: tira con la hora del último dato bueno, `Retry`, borde `--dan`, filas atenuadas y selección deshabilitada |
| 8 | `Alert` | `Warning!` relleno, con triángulo | Implementada | `Alert.tsx:39`. Con una corrección: **el tono es `--warn`, no `--dan`** |
| 9 | `Alert` | `Note!` sin relleno, con círculo | Implementada | `Alert.tsx:39` y `Alert.module.css` |
| 10 | `Empty` | Discontinuo = vacío, continuo = error | Implementada | `Empty.module.css:71`: `.failure` con borde continuo `--dan` |
| 11 | `Empty` | `Loading` estrena `--dim` | **Anulada** | Al implementarla: `--dim` significa «esto está aquí y no es actual» y es para el **dato anterior**. El hueco de `Loading` no tiene dato dentro. Ya iba tachada en la 2.1 |
| 12 | `Field` | El mensaje de validación junto a su campo | Aplazada | **#2 Zones.** Hoy `Field` **no tiene mensaje de error**: ni prop, ni `aria-invalid`, ni sitio. Va al `Notifier` de arriba (`Settings.tsx:314`), y atribuirlo a un campo lo hace quien valida |
| 13 | `Form` | «La deriva de 210/180» | **Anulada** | **No es deriva.** `Form` los distingue a propósito según `modal`, y lo dice `Form.module.css:23`. Se clasificó desde un grep de px sueltos sin abrir el fichero |
| 14 | `Form` | La fila rótulo · control · ayuda | Implementada | `Form.module.css:23`, con los escalones 1180 y 560 del piloto 3 y `.mrow` intacto |
| 15 | `Dialog` | Declarar los cuatro anchos | Ya cumplía | `Dialog.module.css:70-73`: los cuatro son clases con nombre y con su razón medida |
| 16 | `Dialog` | `--dim` en el de debajo cuando se apila | Aplazada | **#2 Zones.** Necesita que exista un apilado, y los diálogos vienen con su superficie: once son de Zones |
| 17 | `Button` | *Deshabilitado, nunca escondido* | Ya cumplía | Pasa `disabled` al `<button>` sin tocarlo. **La regla es de quien decide no pintar**, no del botón: no hay nada que añadir aquí sin quitarle esa decisión a la pantalla |
| 18 | `Button` | El candado que dice **qué** permiso falta | Aplazada | **#8 Settings.** Necesita la cadena del permiso (`Requires Cache: Delete`), que es de la pantalla. Su `Tooltip` ya existe: el bloqueo está levantado |
| 19 | `Icon` | Los dos tamaños, `--ico` y `--ico-rail` | Aplazada | **Cromo, con #1.** Medido: **los dos están declarados y no los consume nadie**. Los que sí se usan son seis — 12 ×9, 14 ×6, 16 ×3, 15 ×2, 18 ×1, 13 ×1. Los del piloto 1 son los del raíl de 60 px |
| 20 | `Check` | «El control es su rótulo» | Ya cumplía | `Check.tsx:37-45`: el `<label>` **envuelve** input y texto, así que se pulsa el rótulo entero y no una caja de 13 px |
| 21 | `Check` | El `720px` sin nombre | Aplazada | **#8 Settings.** **Medido a 1920: muerde** — con la columna de control en 1022 px las nueve ayudas de casilla salen a 720 exactos. Pero es el tope de la única ayuda que el piloto 3 **no** movió a la tercera columna |
| 22 | `EditableTable` | El patrón de fila repetible del piloto 2 | Ya cumplía | Con un matiz que **corrige a la 2.1**: el patrón vive en `EditableList`, no aquí. Etiqueta indexada `PanelForm.tsx:311`, borrado al final de la fila `:337`, `Add` fuera de la caja `:349` |
| 23 | `Panel` | La sección como caja con rótulo pegajoso y recuento | Aplazada | **#8 Settings.** El recuento sale del contenido y lo pegajoso depende de dónde esté la barra. Las diez secciones que lo estrenan son las de `General` |
| 24 | `SectionHeader` | Las nueve subpestañas sobre el título, a todos los anchos | Aplazada | **Cromo, con #1.** Hoy las pinta `Shell.tsx:220` **en el lateral**. Moverlas es cambiar `Shell` y `SectionHeader` a la vez, y el plan ya dice que el cromo se decide con la primera superficie |
| 25 | `Tag` | ¿Sexto tono o primitiva nueva? | Aplazada | **#8 Settings.** Ver abajo: la 2.2 respondió media pregunta |
| 26 | `Details` | El chevron de 12 px: o se nombra, o se justifica | Ya cumplía | Ver abajo: la pregunta estaba mal hecha |

## Los totales, que salen de la tabla

| Estado | Filas | Cuáles |
|---|---|---|
| Implementada | **6** | 1, 5, 8, 9, 10, 14 |
| Ya cumplía | **7** | 4, 6, 15, 17, 20, 22, 26 |
| Aplazada | **11** | 2, 3, 7, 12, 16, 18, 19, 21, 23, 24, 25 |
| Anulada | **2** | 11, 13 |
| **Total** | **26** | |

6 + 7 + 11 + 2 = 26. Y por primitiva, para que ninguna se caiga: **5 tocadas**
—`Empty`, `Alert`, `Icon`, `PanelForm`, `Form`— y **10 no tocadas**. De las cinco
tocadas, **dos quedan con parte pendiente**: `PanelForm` (filas 2 y 3) e `Icon`
(fila 19). El triángulo del aviso que `Icon` sí estrenó **no está en esta tabla a
propósito**: no era una decisión asignada por la 2.1, vino del piloto 3 por la vía
de `Alert`.

## Las dos disyuntivas que la 2.1 dejó abiertas

### `Details` — resuelta, y la pregunta estaba mal hecha

La 2.1 decía que `Details` pintaba «un tercer tamaño de icono» y ofrecía «o se
nombra, o se justifica como excepción de chevron en línea».

Medido: `size={12}` tiene **nueve** sitios de llamada en cinco módulos —`Details`,
`SectionHeader`, `Menu`, `Table` y `Tree`— y **los nueve son un chevron o la flecha
de ordenación**, sin una excepción. No es un tamaño suelto de `Details`: es **el
chevron en línea**, ya aplicado de forma consistente.

Se justifica como tal y **no se nombra**, por lo mismo que la 2.2 se negó a
inventar `Stat`: `--ico` y `--ico-rail` salen de una decisión del piloto 1, y meter
un tercer token que ningún piloto decidió es reabrir dirección por la puerta de
atrás.

Es el mismo error de método que la fila 13: **clasificar desde un grep de un
fichero sin abrir los otros cuatro**. Han sido dos veces, y conviene contarlas
juntas en vez de tratarlas como dos casualidades.

> `grep -rn "size={12}" src/ --include=*.tsx` → 9 resultados, 5 módulos.

### `Tag` — medio resuelta, y dicho así

La 2.1 preguntaba: «¿sexto tono o primitiva nueva?». **La 2.2 respondió media
pregunta**: sólo añadió `Tooltip` y `SectionIndex`, así que **primitiva nueva no**.

Queda el tono, y **no se decide aquí**. El dato es que ninguno de los cinco tonos
actuales usa `--acc`, que es lo que el vocabulario pide para el maestro —«ámbar =
puedes»—, así que sería un sexto. Pero fijar un color desde **cero sitios de
llamada** es el error que la 2.2 rechazó explícitamente para `Stat`: adivinar sus
props desde un caso que aún no existe. Los maestros **sólo existen en `General`**,
y ahí se dibujará la pastilla por primera vez.

Se aplaza con la decisión acotada a dos opciones y con el argumento a favor de una.
Eso no es resolverla, y no se cuenta como resuelta.

## Lo que esta reconciliación NO dice

- **No dice que las diez sin tocar estén bien.** Dice que ninguna necesita trabajo
  de primitiva hoy. Once decisiones tienen deuda, con su destino.
- **No revisa las 18 «a mantener».** Quedan como estaban; la 2.1 ya explicó las
  cuatro que «parecía que les tocaba y no».
- **Casi nada de esto se midió en pantalla.** Lo que sí: el `720` de `Check` a
  1920, los seis tamaños de icono y los nueve `size={12}`. Lo demás se comprueba
  leyendo el fichero que se cita, y por eso se cita la línea.

## Añadido el 2026-09-03 — una deuda de `Menu`, que estaba en las 18 «a mantener»

Salió construyendo Zones, no auditando: el menú de fila pinta `role="menu"` y
**sus ítems no son `menuitem`**. Doce sitios usan la primitiva y **sólo tres**
declaran el rol —los del menú de bloqueo del Dashboard—, así que once menús de la
consola son ARIA malformado.

No entra aquí como «a retocar» tardío, entra como **deuda con su motivo**: el
arreglo no es poner el rol. `menuitem` promete navegación con flechas, `Home`/`End`
y foco itinerante, y anunciarlo sin cumplirlo es peor que no anunciarlo. Está
escrito en la cabecera de `ui/Menu.tsx`, que es donde lo verá quien lo toque.

## Añadido el 2026-09-03 — el hueco de `Table`, aplazado con su motivo

Salió cerrando el bloque de colecciones. `DHCP › Leases` y `DHCP › Scopes`
**dicen** el fallo —levantan el aviso con el mensaje del servidor, y su código lo
documenta— pero la tabla sigue dibujando su fila de vacío: `No Lease Found`
mientras el aviso dice que la llamada se cayó. Es la regla 4 de la fase 1
—*discontinuo = vacío, continuo = error*— a medias: las palabras están, el
tratamiento no.

**Corregido el 2026-09-03, y sin tocar `ui/Table`.** El párrafo anterior decía que
había que darle una variante a la primitiva y aplazaba por sus 18 usos. Era una
solución de más: **basta con no pintar la tabla cuando la carga falla**. Sin
tabla no hay fila de vacío, no hay recuento inventado —«Total Leases: 0»— y no se
toca ni un sitio de llamada.

Queda anotado el error de razonamiento porque se repite solo: al ver que el hueco
lo decidía una prop de la primitiva, di por hecho que la respuesta estaba en la
primitiva. La respuesta estaba un nivel más arriba, en quien decide si la
primitiva se pinta.

Lo que sí se arregló en el sitio, porque no pasaba por `Table`: **`Apps`** pintaba
su propio `Empty` y decía «No apps installed» **ofreciendo abrir la tienda**. Eso
no sólo afirmaba lo que no sabía —puede haber diez instaladas y haberse caído la
llamada— sino que invitaba a actuar sobre esa premisa. Ahora es `Failure`, y sin
invitación.

**Y ninguna de las tres lleva la tira de dato caducado**, a propósito: `Apps`,
`Leases` y `Scopes` **tiran el dato anterior** al fallar (`setApps([])`,
`setLeases([])`, `setScopes([])`). Heredar el aspecto del arquetipo no es heredar
un comportamiento que no tienen; ponerles la tira habría exigido antes que
empezaran a conservar el dato, que es un cambio de comportamiento y no de dibujo.
