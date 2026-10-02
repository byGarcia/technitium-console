/*
Does the same thing look the same on every screen?

The other tools in `dev/` look at one screen and answer whether it is right. This
one looks at ALL of them and answers something different: whether the same object
(a panel, a table header, a count) is painted the same everywhere.

It was needed because the console was written screen by screen, and each one
solved on its own what had already been solved next door. Measured before fixing
it: the bordered container was defined SEVEN times with four different looks, the
small-caps label FOURTEEN times with three sizes and four letter-spacings, and
the count footer EIGHT times with four treatments. None of that is visible to a
screen-by-screen review, because on each screen, taken alone, everything looks
right.

    screenSignatures()    groups each family by look and says how many there are

## How to run it, and why it changed

It used to say "paste it into the console". It now EXPORTS, which means it can no
longer be pasted raw, and that is on purpose, for two reasons found on the same
day:

  · **Fidelity.** Taking a baseline meant getting these lines into the page.
    Transcribing them into a `browser_evaluate` would have measured a
    hand-copy of the tool instead of the tool. Serving the file untouched and
    importing it is the only way the photo is of THIS code.
  · **Testability.** A tool whose defects only show up in a browser is a tool
    nobody regression-tests. `_sinFilas_` survived the August translation for
    weeks precisely because of that.

    Serve it and import it:      await import('/__uniformity.js')
    Or in a test:                import { screenSignatures } from './uniformity.js'

It still registers itself on `window` when it runs in a browser, so the call
sites that expect `screenSignatures()` to be there keep working.

The CONTROL families (text field, textarea, dropdown, checkbox, radio, alert)
were added later, and they are the ones that caught the last batch: the textarea
was painted by hand on four screens, with radius 6 instead of 8 and without the
inset shadow every other field carries. None of the earlier families saw it,
because a textarea, alone on its screen, looks right.

What it returns are GROUPS, not a verdict: two signatures can both be right (the
data table and the editable one are two objects on purpose), and a single one can
be wrong if it is ugly. What must not happen is that there are five without
anyone having decided so.

And you have to know how to read it. A signature with a placeholder where the
cell padding goes is not a different density: it is a table no cell sample could
be taken from, so the same table appears twice. That no longer happens: an empty table now contributes no
signature at all (see the table family below), and the data table and the editable
one are measured as two families, `table` and `table-editable`.

Import it in the browser console, or pass it to `browser_evaluate`, screen by
screen, and accumulate the results with `merge()`.
*/

const css = (e) => getComputedStyle(e)

/** The visual signature of every family present on the current screen. */
export function screenSignatures() {
  /*
  The roots, plural: `<main>` **and every open dialog**.

  `Dialog` mounts through `RadixDialog.Portal`, that is outside `main`, so for a
  long time this tool **did not see a single piece of dialog content**, while the
  whole modal system was being decided. The alert family gave one signature and
  looked healthy while the alerts inside modals could drift without anything
  saying so.

  With no dialog open this returns exactly what it returned before, which was the
  condition for not invalidating a baseline already taken.
  */
  const roots = [
    document.querySelector('main'),
    ...document.querySelectorAll('[role=dialog], [role=alertdialog]'),
  ].filter(Boolean)
  if (roots.length === 0) roots.push(document.body)
  /* A composite `root`: it behaves like a node for what this file asks of it,
     which is searching inside. `querySelector` returns the first hit across all
     the roots, so the screen title is still the one in `main`, because `main`
     goes first in the list. */
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
    const head = c.querySelector('[class*="_ph_"], [class*="_blockTitle_"]')
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
       the class and this filter was not updated with it, so any EMPTY table
       (`/dhcp/leases/` on a fresh harness) handed its "No Lease Found" cell over as
       the density sample and came out as a fourth table signature that does not
       exist. Found while taking a baseline, which is exactly what a baseline is
       for. */
    const td = [...t.querySelectorAll('tbody td')].find((c) => !/_noRows_/.test(c.className))
    if (!th) continue
    /*
    An EMPTY table says nothing about cell density, and a placeholder where the
    cell padding goes was not "nothing": it was a third signature of its own, and it is what `/dhcp/leases/`
    handed over on a fresh harness for months. The `_noRows_` filter above was
    already right; what was missing was giving up when the filter leaves nothing.
    */
    if (!td) continue
    /*
    And the data table and the EDITABLE table are two objects, not one look of the
    same one. `ui/EditableTable` says so itself: "It is a different piece from the
    data table and it must be: that one is a screen's main object, with its panel
    and its border; this one lives INSIDE a panel, up against its fields".

    Measuring them together is the mistake this file warns about elsewhere: a
    family that holds two objects cannot tell you that one of them has changed.
    Apart, each has one signature and either can drift on its own.
    */
    const family = /_editable_/.test(t.className) ? 'table-editable' : 'table'
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
    const group = last?.querySelector('[class*="_actions_"]')
    if (!group) continue
    note('actions', `${Math.round(t.getBoundingClientRect().right - group.getBoundingClientRect().right)}px from the edge`)
  }

  /* The count that goes with a table. Its TEXT changes on purpose (the three
     vocabularies are upstream literals); its look does not. */
  for (const n of root.querySelectorAll('div, span, b')) {
    if (n.children.length > 0) continue
    /* With the colon and the number: without them, "Total Queries" (the label of
       a Dashboard tile) passed for a count and showed up as a separate signature
       that did not exist. */
    if (!/^(Total [A-Za-z ]+: ?\d|\d+ zones|\d+-\d+ \()/.test((n.textContent || '').trim())) continue
    note('count', `${css(n).fontSize}/${css(n).fontWeight}/${css(n).color}`)
  }

  /*
  The form controls. This family was not here, and it was the one that was
  missing: the textarea was painted by hand in Settings, DHCP, Administration and
  the lists screens (radius 6 instead of 8, one step less in size, without the
  inset shadow every other field carries), and neither the screenshots nor the
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
    note('field-text', box(e))
  }
  for (const e of root.querySelectorAll('textarea')) note('field-area', box(e))

  /*
  And two NEW families for the control widths, instead of putting the measure
  into the ones above.

  `box()` leaves the width out on purpose and for a reason: a text field's width
  is its own (upstream pins the numeric ones at 80-100 and leaves the text ones
  wide), so putting it there would turn every field into its own signature and
  bury any drift under the noise. But what the design system decided
  (`--ctrl-num` for the default numeric width and `--area-min` for the minimum
  height of a textarea) shows up in no existing signature.

  So they go apart and narrow: **the width of numeric fields** and **the height
  of textareas**. What is measured is what is RENDERED and not what is declared,
  which is the lesson that already cost two corrections: the alerts' cap lived on
  the container and the fill was decided by the order of the bundle.

  The explicit widths the console already has (80, 125, 200, 38, 28) will come out
  as signatures of their own, and that is right: they are per-field decisions,
  not drift. What is watched is that the DEFAULT is a single one.
  */
  /*
  The row grid, with **panel and modal measured apart**.

  It is not a cosmetic distinction: `ui/Form.module.css` declares it (inside a
  modal there is less room and fewer rows: no divider and no 210 px) and it is
  tied to the `modal` prop. An earlier audit went as far as calling it drift
  **from a grep of loose px values, without opening the file**, and that was
  corrected on 2026-09-03.

  Measuring them together would repeat that mistake at the level of the
  instrument: 210 and 180 would come out as two signatures of one family and look
  like an inconsistency. They go apart, and **each must have a single signature**.

  What is measured is the RESOLVED `grid-template-columns`, which is what decides
  where the help lands: whether the third column fits shows here, and so does
  whether it degrades with the width.
  */
  for (const e of root.querySelectorAll('[class*="_row_"], [class*="_mrow_"]')) {
    const cls = [...e.classList].join(' ')
    /* `_mrow_` contains `row`, so the modal is asked about first. */
    const where = /_mrow_/.test(cls) ? 'modal' : 'panel'
    if (!/_m?row_/.test(cls)) continue
    /*
    And it has to be the row of `ui/Form`, not just any `.row`.

    Measured: `[class*="_row_"]` also caught the `.row` of Cache, Allowed, Blocked
    and View Logs, which are not grids, and the family came out with a third
    signature, `none`, which is no form grid at all. A family that measures two
    different objects cannot tell you whether one of them has changed.

    What identifies it is its label: every `Form` row (`Row` and `GroupRow`, modal
    or not) paints a direct child `_rowLabel_`/`_mrowLabel_`. That is more stable
    than the module hash, which changes with every build.
    */
    const ours = [...e.children].some((h) => /_m?rowLabel_/.test([...h.classList].join(' ')))
    if (!ours) continue
    note(`grid-${where}`, css(e).gridTemplateColumns)
  }

  /*
  A number field in a FORM and one in a table CELL are two objects: the first has
  the width its label's grid gives it, the second fills its column. Together they
  gave 104 px and 151 px in Settings and looked like drift for months; apart, each
  is one width.
  */
  for (const e of root.querySelectorAll('input[type=number]')) {
    const where = e.closest('td') ? 'cell' : 'form'
    note(`field-num-width-${where}`, `${Math.round(e.getBoundingClientRect().width)}px`)
  }
  /*
  The height of a textarea is a FUNCTION of its `rows`: 3 rows gave 66 px and 5
  gave 98, and measuring the height reported that as drift when it is somebody
  having asked for five rows instead of three.

  So what is measured is the FORMULA and not the result (the line and the frame
  around it), and `rows` drops out. Both Settings textareas turn out to be
  16 px per line inside 18 px of frame, which is one look and not two: that is
  checked here rather than declared as an allowed exception.
  */
  for (const e of root.querySelectorAll('textarea')) {
    const c = css(e)
    const frame =
      parseFloat(c.paddingTop) + parseFloat(c.paddingBottom) +
      parseFloat(c.borderTopWidth) + parseFloat(c.borderBottomWidth)
    note('field-area-height', `line ${c.lineHeight} + frame ${Math.round(frame)}px`)
  }
  for (const e of root.querySelectorAll('select')) note('field-list', box(e))

  /*
  The checkbox or radio row.

  A setting and a row selection are NOT the same family, even though both are an
  `input[type=checkbox]` inside a `label`: the setting changes how the server
  behaves and stays put, the selection lasts one click. They are measured apart
  because otherwise the two legitimate exceptions of the table checkbox (40 px in
  the data cell, 0 in the header one, both deliberate and documented in
  `ui/Table.module.css`) come out as two more signatures and bury any real drift
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

  What is measured is the RESULT (how many pixels from the panel its edge sits)
  and not the parent's `margin-left`, which was the first attempt and gave a
  false difference: in Settings the gap comes from a margin on the alerts
  wrapper, and in About from padding on the panel body, i.e. the same place by
  two mechanisms.
  */
  /*
  And they are split BY TYPE, not by the literal title.

  The alerts used to be a single family, and so it could not detect the decision
  that had to be taken: whether `Warning!` goes filled and `Note!` outlined.
  Measured together, two different treatments are two signatures of the same
  family and cannot be told apart from drift. Measured apart, **each must end up
  with ONE signature**, and that can be checked.

  The discriminator is the TYPE class (`_info_`, `_warning_`) and not the text:
  the treatment is applied by type, so the measure has to look along the same
  axis as the decision. `Note!` is the `info`; `Warning!` is the `warning`.

  And the signature includes what it did not look at before: **the fill**
  (coloured background against transparent, which is the whole decision) and
  **whether it carries an icon**. With the old signature, `borderRadius | inset`,
  an alert could go from filled to outlined without any family moving.
  */
  for (const e of root.querySelectorAll('[role=note], [class*="_alert"]')) {
    const classes = [...e.classList].join(' ')
    const type = ['info', 'warning', 'success', 'danger'].find((t) => classes.includes(`_${t}_`)) ?? 'no-type'
    const panel = e.closest('[class*="_panel_"], [class*="_block_"]')
    const inset = panel
      ? `${Math.round(e.getBoundingClientRect().left - panel.getBoundingClientRect().left)}px from the panel`
      : 'loose on the page'
    const s = css(e)
    /* Transparent or unpainted counts as OUTLINED; anything else, as filled.
       `rgba(0, 0, 0, 0)` is what an undeclared background returns. */
    const fill = /^(transparent|rgba\(0, 0, 0, 0\))$/.test(s.backgroundColor) ? 'outlined' : 'filled'
    const icon = e.querySelector('svg') ? 'with-icon' : 'no-icon'
    /*
    And the WIDTH CAP, for the same reason the fill was added: a six-hundred-
    character alert reads badly if the line is too long, that is the decision
    `--notice-max` records, and the signature did not see it. What is measured is
    the width REALLY PAINTED and not the alert's own `max-width`, and the first
    version got exactly that wrong: the cap is declared on the CONTAINER
    (`.notices`), so the alert still says `max-width: none` and the signature
    would have seen nothing. It is the same mistake already made with the fill,
    and that is why it is fixed by looking at the result instead of the
    declaration.

    It depends on the window width, yes; that is why the sweep is always taken at
    1440.
    */
    note(
      `notice-${type}`,
      `${fill} | ${icon} | width ${Math.round(e.getBoundingClientRect().width)}px | ${s.borderRadius} | ${inset}`,
    )
  }

  /* The screen title. */
  const h1 = root.querySelector('h1')
  if (h1) note('title', `${css(h1).fontSize}/${css(h1).fontWeight}/${css(h1).letterSpacing}`)

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
them permanently split for reasons nobody reread, and a tool that always shows
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
  it was really holding. An entry in this map is a debt, not a feature: it says
  "these two looks are both right and nobody will ever tell them apart again".
  */
}

/** Accumulates the signatures of several screens into a single report. */
export function merge(reports) {
  const total = {}
  for (const { route, signatures } of reports) {
    for (const [family, list] of Object.entries(signatures)) {
      total[family] = total[family] ?? {}
      for (const f of list) {
        total[family][f] = total[family][f] ?? []
        total[family][f].push(route)
      }
    }
  }
  return Object.entries(total).map(([family, signatures]) => {
    const many = Object.keys(signatures).length
    const allowed = EXPECTED[family] ?? 1
    return {
      family,
      count: many,
      expected: allowed,
      /* A family with FEWER looks than declared is a finding too: the reason
         above has stopped being true and nobody will notice by reading it. */
      finding: many === allowed ? null : many > allowed ? 'gained a look' : 'lost one, the reason is stale',
      signatures: Object.entries(signatures).map(([f, routes]) => `${f}  →  ${routes.join(', ')}`),
    }
  })
}

/* In a browser it also hangs itself on `window`, so `screenSignatures()` works
   as a bare call once the module has been imported. */
if (typeof window !== 'undefined') Object.assign(window, { screenSignatures, merge })
