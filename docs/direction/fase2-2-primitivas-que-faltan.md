# Fase 2.2 — las primitivas que faltan

El plan trae ocho candidatas y dice que **cada una hay que justificarla o
tirarla**. Aquí se hace, empezando por `PanelForm`, que es la que más carga de la
dirección de fase 1.

`src/ui/` **sigue intacto**: esto decide qué se toca, no lo toca.

## Dos hallazgos de leer `PanelForm`, y los dos son del contrato

Leer `EditableList` —el que pinta las dos listas QPM de `Settings › General`—
destapó dos cosas que **ni mi contrato ni el piloto 3 podían ver**, y las dos por
la misma causa: **el contrato se tomó del DOM con las listas POBLADAS**, así que
ni la rama vacía ni el botón de fila llegaron nunca a viajar.

### 1 · La lista vacía ya tiene frase, y el piloto propuso otra

`PanelForm.tsx:324` pinta `<Empty compacto>No entries.</Empty>` cuando la lista
está vacía. El piloto 3, en su tabla de textos propuestos, escribió:

> **Lista QPM vacía** — `No limits configured.` — *«Estas dos listas no tienen su
> frase de vacío como sí la tiene `Permissions`»*

**Sí la tienen: `No entries.`** El piloto no mintió; el contrato no se lo dijo. Y
la consecuencia cambia de naturaleza: no es **añadir** un texto que falta, es
**sustituir** uno que existe. Eso ya no es una propuesta de diseño, es un cambio
de literal, y en este proyecto la palabra se respeta salvo decisión explícita.

**Se queda `No entries.`**, decidido por Adrián el 2026-09-02: el literal
permanece y la propuesta del piloto no se adopta.

### 2 · La misma acción, con dos palabras

El botón que quita una fila de una lista repetible se llama:

| Palabra | Dónde |
|---|---|
| **`Remove`** | `AddEditRecord`, `ZoneOptions`, `ZonePermissions` — los tres diálogos de Zones |
| **`Delete`** | `EditableList` de `PanelForm`, que usan **Settings y DHCP** |

Mismo patrón, misma acción, dos palabras. El piloto 3 dibujó `Remove` — que es lo
correcto según el patrón que cerró el piloto 2— sin saber que el código dice
`Delete` en su mitad.

**CERRADO contra upstream el 2026-09-02, y la respuesta es que no hay nada que
unificar: el reparto es suyo y nosotros lo replicamos.**

Leído de la instancia `ref` del harness (`:5381`), que sirve la consola oficial:

| Upstream | Palabra | Dónde |
|---|---|---|
| `main.js` | **`Delete`** | `tableQpmPrefixLimitsIPv4Row`, `tableQpmPrefixLimitsIPv6Row`, `tableTsigKeyRow` — **exactamente las tres listas de `EditableList`** |
| `zone.js` | **`Remove`** | `trDynamicUpdateSecurityPolicyRow` (las políticas de `ZoneOptions`) y `tableAddEditRecordDataSvcbParamsRow` (los parámetros de `AddEditRecord`) |

Es decir: **Settings y DHCP dicen `Delete` porque upstream dice `Delete` ahí, y
los diálogos de Zones dicen `Remove` porque upstream dice `Remove` ahí.** Lo que
parecía deriva nuestra es fidelidad.

**Unificarlas habría sido perder paridad para ganar coherencia** — que es
justamente lo que la regla de comprobar contra upstream existe para evitar.

Un caso no localizado y dicho: la fila de `ZonePermissions` no aparece en
`zone.js` con ninguna de las dos palabras. La nuestra dice `Remove`, coherente con
los otros dos diálogos; si aparece en otro fichero de upstream con otra palabra,
se corrige entonces.

> **Y una lección de método que vale más que las dos**: un contrato tomado del DOM
> con datos **pierde las ramas sin datos**. La lista vacía y el botón de fila
> estaban en el fuente todo el tiempo. Es la misma familia que el selector de
> cluster del piloto 2 —invisible en una instancia suelta— y que los seis rótulos
> de grupo del piloto 3.

## Las ocho candidatas

**Dos se justifican, cinco se tiran y una se aplaza.**

### Justificadas

| Primitiva | Por qué |
|---|---|
| **`Tooltip`** | **Dos reglas de fase 1 dependen de que exista y hoy no existe.** El raíl de 60 px del piloto 1 dice que al pasar el puntero aparece el rótulo del icono —sin eso el raíl es doce iconos sin nombre—, y el candado del piloto 3 tiene que decir **qué** permiso falta (`Requires Cache: Delete`). Lo único parecido en el repo es el tooltip de Chart.js dentro de `Chart.tsx`, que es de la librería y no es una primitiva |
| **`SectionIndex`** | El piloto 3 decidió una columna de índice de `--index-col` que por debajo de `--bp-index` pasa a tira de pastillas, y **nada en `src/ui/` hace eso**. `Segmented` se le parece y **no es**: `Segmented` elige un valor y cambia lo que se ve; el índice **no cambia nada, mueve la rueda**. Confundirlos es lo que el propio piloto avisó de no hacer — «misma forma en el mismo sitio serían dos cosas indistinguibles» |

### Tiradas, con su motivo

| Candidata | Motivo |
|---|---|
| **`skeletons`** | **Contradice una decisión de fase 1.** El piloto 1 decidió que cargando se ve el **dato anterior atenuado**, y el piloto 3 lo repitió: *«la tabla no se vacía ni se sustituye por esqueletos»*. Añadir la primitiva sería reabrir dirección por la puerta de atrás |
| **conjunto de estados** (empty / loading / error / selected) | **Ya existe**: `Empty` exporta `Empty`, `Loading` y `Failure`, y lo usan 24 sitios. Lo que falta —discontinuo contra continuo, y `--dim`— es **retoque de `Empty`**, no una primitiva nueva. Ya está clasificado así en la 2.1 |
| **`DataTable`** | **Ya existe**: `Table`, con `useOrden`, `Th` y `RowAction`, en 18 sitios. Ningún piloto pidió otra tabla; el piloto 2 pidió **cuándo se ve** la señal de ordenación, que es retoque |
| **`Toolbar`** | **Ya existe y ya está compartida**: `.bar` vive en `PanelForm.module.css:73` y **Admin y DHCP la componen** con `composes:`. La barra pegajosa del piloto 3 es esa misma barra; lo que cambia es dónde se pega y qué dice, no que haga falta otra |
| **`Stat`** | Sale de **un solo piloto** —las once tarjetas del Dashboard— y ninguna otra superficie la pide. Justificarla ahora es adivinar sus props desde un caso. **El Dashboard es la fase 3**: se decide allí, con la pantalla delante |

### Aplazada

| Candidata | Hasta cuándo |
|---|---|
| **`FilterBar`** | **A la fase 4, con Zones delante.** Hoy no hay primitiva de filtros compartida y sólo una pantalla la nombra (`QueryLogs`). La barra de Zones —`Name`, `Type`, `Page Number`, `Zones Per Page`, `Go`— y la de su vista de registros son dos sitios reales, pero **las dos son de la fase 4**. Sacar la primitiva ahora es fijar sus props sin haber visto ninguna de las dos rediseñadas, que es exactamente lo que el plan avisa de no hacer |

## Por dónde se empieza a tocar

Cuando `src/ui/` se abra, el orden sale solo de la 2.1 y de esto:

1. **`Empty`** — el retoque más barato y del que dependen las tres «tiradas» de
   arriba: discontinuo contra continuo, y `--dim` en `Loading`. 24 sitios lo usan.
2. **`Tooltip`** — primitiva nueva, y bloquea dos reglas de fase 1.
3. **`PanelForm`** — la más cargada, y la única que toca `Settings` y `DHCP` a la
   vez. Antes de ella hay que contestar lo de `Remove`/`Delete`.
4. **`SectionIndex`** — depende de que `PanelForm` ya tenga su columna.

## Estado

Los cuatro hechos, en ese orden, entre el 2026-09-02 y el 2026-09-03: `Empty`,
`Tooltip`, `PanelForm` y `SectionIndex`. La 2.3 se cumplió en cada uno: ninguna
familia subió y `settings-checkbox` bajó de 3 firmas a 1, que era el trabajo y no
un extra.

`SectionIndex` queda **escrita y sin conectar**, por decisión: el cableado —quién
calcula la sección activa— es de la fase 3. Comprobable: ningún fichero fuera de
`src/ui/SectionIndex.*` la nombra, y su hoja de estilos **no entra en el bundle**,
así que el CSS construido es idéntico al de antes de escribirla. Por eso no se
repitió el barrido de uniformidad: no hay pantalla que haya cambiado.

Y con la 2.3 encima todo el rato: `settings-checkbox` tiene que **bajar de 3
firmas a 1**, y ninguna familia puede subir. La foto base está en
`evidencia/uniformity-base-fase2.json`.
