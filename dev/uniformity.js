/*
Does the same thing look the same on every screen?

The other tools in `dev/` look at one screen and answer whether it is right. This
one looks at ALL of them and answers something different: whether the same object
—a panel, a table header, a count— is painted the same everywhere.

It was needed because the console was written screen by screen, and each one
solved on its own what had already been solved next door. Measured before fixing
it: the bordered container was defined SEVEN times with four different looks, the
small-caps label FOURTEEN times with three sizes and four letter-spacings, and
the count footer EIGHT times with four treatments. None of that is visible to a
screen-by-screen review, because on each screen, taken alone, everything looks
right.

    await firmas()        groups each family by look and says how many there are

## How to run it, and why it changed

It used to say "paste it into the console". It now EXPORTS, which means it can no
longer be pasted raw — and that is on purpose, for two reasons found on the same
day:

  · **Fidelity.** Taking the phase-2 baseline meant getting these 210 lines into
    the page. Transcribing them into a `browser_evaluate` would have measured a
    hand-copy of the tool instead of the tool. Serving the file untouched and
    importing it is the only way the photo is of THIS code.
  · **Testability.** A tool whose defects only show up in a browser is a tool
    nobody regression-tests. `_sinFilas_` survived the August translation for
    weeks precisely because of that.

    Serve it and import it:      await import('/__uniformity.js')
    Or in a test:                import { screenSignatures } from './uniformity.js'

It still registers itself on `window` when it runs in a browser, so the call
sites that expect `screenSignatures()` to be there keep working.

The CONTROL families —text field, textarea, dropdown, checkbox, radio, alert—
were added later, and they are the ones that caught the last batch: the textarea
was painted by hand on four screens, with radius 6 instead of 8 and without the
inset shadow every other field carries. None of the earlier families saw it,
because a textarea, alone on its screen, looks right.

What it returns are GROUPS, not a verdict: two signatures can both be right —the
data table and the editable one are two objects on purpose— and a single one can
be wrong if it is ugly. What must not happen is that there are five without
anyone having decided so.

And you have to know how to read it. A signature ending in "td —" is not a
different density: it is a table no cell sample could be taken from, so the same
table appears twice. With today's data, `tabla: 4` is really two —the data one
and the editable one— each with and without a sample.

Paste it into the browser console or pass it to `browser_evaluate`, screen by
screen, accumulating the result.
*/

const css = (e) => getComputedStyle(e)

/** The visual signature of every family present on the current screen. */
export function screenSignatures() {
  /*
  Las raíces, en plural desde la fase 2: `<main>` **y todo diálogo abierto**.

  `Dialog` monta por `RadixDialog.Portal`, o sea fuera de `main`, así que durante
  toda la fase 1 esta herramienta **no vio ni un solo contenido de diálogo** —y el
  piloto 2 decidió el sistema modal entero—. La familia `aviso` daba una firma y
  parecía sana mientras los avisos de modal podían divergir sin que nada lo dijera.

  Cuando no hay diálogo abierto esto devuelve exactamente lo de antes, que era la
  condición para no invalidar la foto base ya tomada.
  */
  const roots = [
    document.querySelector('main'),
    ...document.querySelectorAll('[role=dialog], [role=alertdialog]'),
  ].filter(Boolean)
  if (roots.length === 0) roots.push(document.body)
  /* Un `root` compuesto: se comporta como un nodo para lo que este fichero le
     pide, que es buscar dentro. `querySelector` devuelve el primero de todas las
     raíces —el título de la pantalla sigue siendo el de `main`, porque `main` va
     primero en la lista. */
  const root = {
    querySelectorAll: (sel) => roots.flatMap((r) => [...r.querySelectorAll(sel)]),
    querySelector: (sel) => {
      for (const r of roots) {
        const hit = r.querySelector(sel)
        if (hit) return hit
      }
      return null
    },
  }
  const out = {}
  const note = (family, signature) => {
    out[family] = out[family] ?? new Set()
    out[family].add(signature)
  }

  /* The bordered container: panel, block or form fieldset. */
  for (const c of root.querySelectorAll('[class*="_panel_"], [class*="_block_"]')) {
    const s = css(c)
    const head = c.querySelector('[class*="_ph_"], [class*="_blockTitle_"], [class*="_cabecera_"]')
    /* The title is not always an `h2`: in Permissions it is a `span` inside an
       `h4`, and in a `fieldset` it is the `legend` itself. */
    const t =
      head?.tagName === 'LEGEND' ? head : (head?.querySelector('h2, h3') ?? head?.firstElementChild)
    note(
      'panel',
      [
        s.boxShadow === 'none' ? 'no-shadow' : 'shadow',
        s.borderRadius,
        head ? css(head).backgroundColor : 'no-header',
        t ? `${css(t).fontSize}/${css(t).fontWeight}/${css(t).textTransform}/${css(t).letterSpacing}` : '-',
      ].join(' | '),
    )
  }

  /* The table: header and cell density. */
  for (const t of root.querySelectorAll('table')) {
    const th = t.querySelector('thead th')
    /* The sample cell, skipping the "there is nothing" row: its padding is its
       own, taller on purpose, and it came out as one more density. */
    /* `_noRows_`, and it used to say `_sinFilas_`. The August translation renamed
       the class and this filter was not updated with it, so any EMPTY table —
       `/dhcp/leases/` on a fresh harness— handed its "No Lease Found" cell over as
       the density sample and came out as a fourth table signature that does not
       exist. Found while taking the phase-2 baseline, which is exactly what a
       baseline is for. */
    const td = [...t.querySelectorAll('tbody td')].find((c) => !/_noRows_/.test(c.className))
    if (!th) continue
    /*
    An EMPTY table says nothing about cell density, and saying `td —` was not
    "nothing": it was a third signature of its own, and it is what `/dhcp/leases/`
    handed over on a fresh harness for months. The `_noRows_` filter above was
    already right; what was missing was giving up when the filter leaves nothing.
    */
    if (!td) continue
    /*
    And the data table and the EDITABLE table are two objects, not one look of the
    same one. `ui/EditableTable` says so itself: "It is a different piece from the
    data table and it must be — that one is a screen's main object, with its panel
    and its border; this one lives INSIDE a panel, up against its fields".

    Measuring them together is the mistake this file warns about elsewhere: a
    family that holds two objects cannot tell you that one of them has changed.
    Apart, each has one signature and either can drift on its own.
    */
    const family = /_editable_/.test(t.className) ? 'tabla-editable' : 'tabla'
    note(
      family,
      `th ${css(th).fontSize}/${css(th).fontWeight}/${css(th).letterSpacing}/${css(th).backgroundColor}` +
        ` · td ${css(td).padding}`,
    )
  }

  /* The actions column: what is left over between the last control and the edge. */
  for (const t of root.querySelectorAll('table')) {
    const row = t.querySelector('tbody tr')
    const last = row ? [...row.querySelectorAll('td')].pop() : null
    const group = last?.querySelector('[class*="_acciones_"]')
    if (!group) continue
    note('acciones', `${Math.round(t.getBoundingClientRect().right - group.getBoundingClientRect().right)}px from the edge`)
  }

  /* The count that goes with a table. Its TEXT changes on purpose —the three
     vocabularies are upstream literals—; its look does not. */
  for (const n of root.querySelectorAll('div, span, b')) {
    if (n.children.length > 0) continue
    /* With the colon and the number: without them, "Total Queries" —the label of
       a Dashboard tile— passed for a count and showed up as a separate signature
       that did not exist. */
    if (!/^(Total [A-Za-z ]+: ?\d|\d+ zones|\d+-\d+ \()/.test((n.textContent || '').trim())) continue
    note('recuento', `${css(n).fontSize}/${css(n).fontWeight}/${css(n).color}`)
  }

  /*
  The form controls. This family was not here, and it was the one that was
  missing: the textarea was painted by hand in Settings, DHCP, Administration and
  the lists screens —radius 6 instead of 8, one step less in size, without the
  inset shadow every other field carries— and neither the screenshots nor the
  other families said so, because on each screen, alone, the textarea looked
  right.

  The signature does not include WIDTH: that one really is per-field (upstream
  pins numeric fields at 80-100 px and leaves text fields wide). It includes the
  box.
  */
  const box = (e) => {
    const s = css(e)
    return [
      s.borderRadius,
      s.padding,
      s.fontSize,
      s.borderWidth,
      s.boxShadow === 'none' ? 'no-inset' : 'inset',
    ].join(' | ')
  }
  for (const e of root.querySelectorAll('input[type=text], input[type=number], input[type=password], input:not([type])')) {
    note('campo-text', box(e))
  }
  for (const e of root.querySelectorAll('textarea')) note('campo-area', box(e))

  /*
  Y dos familias NUEVAS para el bloque de anchos de control, en vez de meter la
  medida en las de arriba.

  `box()` excluye el ancho a propósito y con razón: el ancho de un campo de texto
  es suyo —upstream fija los numéricos en 80-100 y deja anchos los de texto—, así
  que meterlo ahí convertiría cada campo en su propia firma y enterraría cualquier
  deriva bajo el ruido. Pero lo que la fase 1 decidió —`--ctrl-num` para el ancho
  numérico por defecto y `--area-min` para la altura mínima del área— no se ve en
  ninguna firma actual.

  Así que van aparte y acotadas: **el ancho de los campos numéricos** y **la altura
  de las áreas de texto**. Se mide lo RENDERIZADO y no lo declarado, que es la
  lección que ya costó dos correcciones: el tope de los avisos vivía en el
  contenedor y el relleno lo decidía el orden del bundle.

  Los anchos explícitos que la consola ya tiene —80, 125, 200, 38, 28— saldrán como
  firmas propias, y eso es correcto: son decisiones por campo, no deriva. Lo que se
  vigila es que el DEFECTO sea uno solo.
  */
  /*
  La retícula de la fila, y **panel y modal por separado**.

  No es una distinción cosmética: `Form.module.css:23` la declara —«dentro de un
  modal hay menos sitio y menos filas: sin separador y sin 210 px»— y va atada a la
  prop `modal`. La auditoría 2.1 llegó a llamarla deriva **desde un grep de px
  sueltos, sin abrir el fichero**, y se corrigió el 2026-09-03.

  Medirlas juntas repetiría ese error a nivel de instrumento: 210 y 180 saldrían
  como dos firmas de una familia y parecerían una inconsistencia. Van aparte, y
  **cada una debe tener una sola firma**.

  Se mide `grid-template-columns` RESUELTO, que es lo que decide dónde cae la
  ayuda: si la tercera columna entra, aquí se ve; si degrada por ancho, también.
  */
  for (const e of root.querySelectorAll('[class*="_row_"], [class*="_mrow_"]')) {
    const cls = [...e.classList].join(' ')
    /* `_mrow_` contiene `row`, así que se pregunta primero por el modal. */
    const donde = /_mrow_/.test(cls) ? 'modal' : 'panel'
    if (!/_m?row_/.test(cls)) continue
    /*
    Y tiene que ser la fila de `ui/Form`, no cualquier `.row`.

    Medido: `[class*="_row_"]` atrapaba tambien el `.row` propio de Cache, Allowed,
    Blocked y View Logs, que no son retículas, y la familia salía con una tercera
    firma `none` que no es ninguna retícula de formulario. Una familia que mide dos
    objetos distintos no puede decir si uno de ellos ha cambiado.

    El rasgo que la identifica es su rótulo: toda fila de `Form` —`Row` y
    `GroupRow`, modal o no— pinta un hijo directo `_rowLabel_`/`_mrowLabel_`. Es
    más estable que el hash del módulo, que cambia con cada build.
    */
    const suyo = [...e.children].some((h) => /_m?rowLabel_/.test([...h.classList].join(' ')))
    if (!suyo) continue
    note(`reticula-${donde}`, css(e).gridTemplateColumns)
  }

  /*
  A number field in a FORM and one in a table CELL are two objects: the first has
  the width its label's grid gives it, the second fills its column. Together they
  gave 104 px and 151 px in Settings and looked like drift for months; apart, each
  is one width.
  */
  for (const e of root.querySelectorAll('input[type=number]')) {
    const where = e.closest('td') ? 'celda' : 'form'
    note(`campo-num-ancho-${where}`, `${Math.round(e.getBoundingClientRect().width)}px`)
  }
  /*
  The height of a textarea is a FUNCTION of its `rows`: 3 rows gave 66 px and 5
  gave 98, and measuring the height reported that as drift when it is somebody
  having asked for five rows instead of three.

  So what is measured is the FORMULA and not the result — the line and the frame
  around it — and `rows` drops out. Both Settings textareas turn out to be
  16 px per line inside 18 px of frame, which is one look and not two: that is
  checked here rather than declared as an allowed exception.
  */
  for (const e of root.querySelectorAll('textarea')) {
    const c = css(e)
    const frame =
      parseFloat(c.paddingTop) + parseFloat(c.paddingBottom) +
      parseFloat(c.borderTopWidth) + parseFloat(c.borderBottomWidth)
    note('campo-area-alto', `line ${c.lineHeight} + frame ${Math.round(frame)}px`)
  }
  for (const e of root.querySelectorAll('[class*="_disparador_"], select')) note('campo-lista', box(e))

  /*
  The checkbox or radio row.

  A setting and a row selection are NOT the same family, even though both are an
  `input[type=checkbox]` inside a `label`: the setting changes how the server
  behaves and stays put, the selection lasts one click. They are measured apart
  because otherwise the two legitimate exceptions of the table checkbox —40 px in
  the data cell, 0 in the header one, both deliberate and documented in
  `ui/Table.module.css`— come out as two more signatures and bury any real drift
  in the setting checkboxes under the noise.
  */
  for (const e of root.querySelectorAll('input[type=checkbox], input[type=radio]')) {
    const row = e.closest('label')
    if (!row) continue
    const s = css(row)
    const inTable = row.closest('td, th') != null
    /*
    And inside a table the header cell and the data cell are two places, not two
    looks of one: `ui/Table.module.css` gives the data one a 40 px hit target and
    the header one none on purpose. Told apart, each is a single look and a real
    drift in either surfaces on its own.
    */
    const cell = row.closest('th') ? 'row-checkbox-th' : 'row-checkbox-td'
    note(
      inTable ? cell : e.type === 'radio' ? 'radio' : 'settings-checkbox',
      `${s.minHeight} | ${s.gap} | ${s.fontSize} | ${s.color}`,
    )
  }

  /*
  The "Note!"/"Warning!" alert: same block and same inset inside its panel.

  What is measured is the RESULT —how many pixels from the panel its edge sits—
  and not the parent's `margin-left`, which was the first attempt and gave a
  false difference: in Settings the gap comes from a margin on the alerts
  wrapper, and in About from padding on the panel body, i.e. the same place by
  two mechanisms.
  */
  /*
  Y se separa POR TIPO, no por el título literal.

  `aviso` era una sola familia, y por eso no podía detectar la decisión que la
  fase 2 tiene que tomar: que el `Warning!` vaya relleno y el `Note!` con
  contorno. Medidos juntos, dos tratamientos distintos son dos firmas de la misma
  familia y no se distinguen de una deriva. Medidos aparte, **cada uno debe
  acabar con UNA firma**, y eso sí es comprobable.

  El discriminador es la clase del TIPO —`_info_`, `_warning_`— y no el texto:
  el tratamiento se aplica por tipo, así que la medida tiene que mirar el mismo
  eje que la decisión. `Note!` es el `info`; `Warning!` es el `warning`.

  Y la firma incorpora lo que antes no miraba: **el relleno** —fondo con color
  contra transparente, que es la decisión entera— y **si lleva icono**. Con la
  firma anterior, `borderRadius | inset`, se podía cambiar de relleno a contorno
  sin que ninguna familia se moviera.
  */
  for (const e of root.querySelectorAll('[class*="_alerta_"], [role=note], [class*="_alert"]')) {
    const clases = [...e.classList].join(' ')
    const tipo = ['info', 'warning', 'success', 'danger'].find((t) => clases.includes(`_${t}_`)) ?? 'sin-tipo'
    const panel = e.closest('[class*="_panel_"], [class*="_block_"]')
    const inset = panel
      ? `${Math.round(e.getBoundingClientRect().left - panel.getBoundingClientRect().left)}px from the panel`
      : 'loose on the page'
    const s = css(e)
    /* Transparente o sin pintar cuenta como CONTORNO; cualquier otra cosa, como
       relleno. `rgba(0, 0, 0, 0)` es lo que devuelve un fondo sin declarar. */
    const relleno = /^(transparent|rgba\(0, 0, 0, 0\))$/.test(s.backgroundColor) ? 'contorno' : 'relleno'
    const icono = e.querySelector('svg') ? 'con-icono' : 'sin-icono'
    /*
    Y el TOPE DE ANCHO, por la misma razón por la que se añadió el relleno: un
    aviso de seiscientos caracteres se lee mal si la línea es demasiado larga, esa
    es la decisión que la fase 1 tomó con `--notice-max`, y la firma no la veía.
    Se mide el ancho REALMENTE PINTADO y no el `max-width` del propio aviso, y la
    primera versión se equivocó justo ahí: el tope se declara en el CONTENEDOR
    —`.notices`—, así que el aviso sigue diciendo `max-width: none` y la firma no
    habría visto nada. Es el mismo error que ya se cometió con el relleno, y por
    eso se corrige mirando el resultado en vez de la declaración.

    Depende del ancho de ventana, sí; por eso el barrido se hace siempre a 1440.
    */
    note(
      `aviso-${tipo}`,
      `${relleno} | ${icono} | ancho ${Math.round(e.getBoundingClientRect().width)}px | ${s.borderRadius} | ${inset}`,
    )
  }

  /* The screen title. */
  const h1 = root.querySelector('h1')
  if (h1) note('titulo', `${css(h1).fontSize}/${css(h1).fontWeight}/${css(h1).letterSpacing}`)

  /*
  And the gap under that title, which had also drifted apart: six screens had it
  at 38 px and twelve at 24, because those six put the header inside a `flex`
  container with `gap`, and in flex the gap ADDS to the child's margin. It is
  measured against the next sibling and not against "the first bordered box",
  which was the first attempt: that `find()` picked different elements on
  different screens and gave two false measurements in a row.
  */
  const header = h1?.closest('[class*="_hrow_"]')
  const next = header?.nextElementSibling
  if (header && next) {
    note(
      'gap-under-the-title',
      `${Math.round(next.getBoundingClientRect().top - header.getBoundingClientRect().bottom)}px`,
    )
  }

  return Object.fromEntries(Object.entries(out).map(([k, v]) => [k, [...v]]))
}

/*
How many looks each family is ALLOWED to have, and why.

Without this the report was a list of fifteen families to read and judge, four of
them permanently split for reasons nobody reread — and a tool that always shows
four problems teaches you to skim it. That is not hypothetical: the panel lost its
shadow on three screens on 2026-09-07 and the only thing that said so was a
fifth split appearing among the four.

So the number is declared. One look unless stated, and a family that gains one is
a finding whatever its number was.
*/
const EXPECTED = {
  /*
  Empty, and that is the point: every family that used to need an exception here
  was a family measuring two objects at once, and each has been split into the two
  it was really holding. An entry in this map is a debt, not a feature — it says
  "these two looks are both right and nobody will ever tell them apart again".
  */
}

/** Accumulates the signatures of several screens into a single report. */
export function merge(reports) {
  const total = {}
  for (const { ruta, firmas } of reports) {
    for (const [family, list] of Object.entries(firmas)) {
      total[family] = total[family] ?? {}
      for (const f of list) {
        total[family][f] = total[family][f] ?? []
        total[family][f].push(ruta)
      }
    }
  }
  return Object.entries(total).map(([family, signatures]) => {
    const many = Object.keys(signatures).length
    const allowed = EXPECTED[family] ?? 1
    return {
      familia: family,
      cuantas: many,
      esperadas: allowed,
      /* A family with FEWER looks than declared is a finding too: the reason
         above has stopped being true and nobody will notice by reading it. */
      hallazgo: many === allowed ? null : many > allowed ? 'gained a look' : 'lost one, the reason is stale',
      firmas: Object.entries(signatures).map(([f, routes]) => `${f}  →  ${routes.join(', ')}`),
    }
  })
}

/* In a browser it also hangs itself on `window`, so `screenSignatures()` works
   as a bare call once the module has been imported. */
if (typeof window !== 'undefined') Object.assign(window, { screenSignatures, merge })
