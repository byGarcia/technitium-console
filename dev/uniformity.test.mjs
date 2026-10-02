/*
Regression tests for the uniformity tool.

It had none, and that is why `_sinFilas_` survived the August translation to
English for weeks: the class the filter looked for stopped existing, and nothing
said so until a baseline was taken and `/dhcp/leases/` (an empty table on a
fresh harness) handed over its "No Lease Found" cell as the density sample
and produced a FOURTH table signature that does not exist.

A tool that measures drift and is not itself measured is a tool that will drift.
*/
import { describe, expect, it, beforeEach } from 'vitest'
import { screenSignatures, merge } from './uniformity.js'

/** A table like the console's: a header, and whatever rows are given. */
function table(rows) {
  const main = document.createElement('main')
  main.innerHTML = `
    <table>
      <thead><tr><th style="font-size:10.5px;font-weight:600">Zone</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`
  document.body.replaceChildren(main)
  return main
}

const WITH_ROWS = '<tr><td class="_cell_abc" style="padding:9px 10px">home.test</td></tr>'
/* The empty row. The class carries its hash suffix exactly as CSS modules emit
   it, because that is what the filter has to survive. */
const NO_ROWS = '<tr><td class="_noRows_1arwr" style="padding:24px 10px">No Lease Found</td></tr>'

describe('the empty row is not a density sample', () => {
  beforeEach(() => document.body.replaceChildren())

  /*
  THE ONE THIS FILE EXISTS FOR, and its contract changed on 2026-09-07: an empty
  table used to sign with a placeholder where the cell padding goes, and that is
  not "nothing": it is a signature of its own, and `/dhcp/leases/` on a fresh
  harness handed it over as a third table look for months. A table with no data cell now contributes NO signature at all.

  The other half of the guard stays the same: if the `_noRows_` filter ever stops
  recognising the class, the padding of the empty row leaks in and invents one.
  */
  it('an empty table contributes no signature, not even one with a placeholder cell', () => {
    table(NO_ROWS)
    expect(screenSignatures().table).toBeUndefined()
  })

  it('a table with rows does contribute its own', () => {
    table(WITH_ROWS)
    expect(screenSignatures().table[0]).toContain('td 9px 10px')
  })

  /* The mix, which is the case of `/dhcp/leases/` when it DOES have leases: the
     good cell sits behind the empty one and must not lose to it. */
  it('with both, the data cell wins and not the empty one', () => {
    table(NO_ROWS + WITH_ROWS)
    const [signature] = screenSignatures().table
    expect(signature).toContain('td 9px 10px')
    expect(signature).not.toContain('24px')
  })

  /*
  And the test that really closes the hole: the class is read from the CODE, not
  from this constant. If someone renames it again (as happened in the
  translation), this fails here and not in a baseline taken six weeks later.
  */
  it('the class the filter skips is the one the code uses today', async () => {
    /* From the project root and not from `import.meta.url`: under jsdom that URL
       is not `file:` and `fileURLToPath` throws. */
    const { readFileSync } = await import('node:fs')
    const { join } = await import('node:path')
    const root = process.cwd()
    const tableSource = readFileSync(join(root, 'src/ui/Table.tsx'), 'utf8')
    const tool = readFileSync(join(root, 'dev/uniformity.js'), 'utf8')

    const cls = tableSource.match(/className=\{styles\.(\w*[Nn]o[Rr]ows\w*)\}/)?.[1]
    expect(cls, 'Table.tsx no longer paints a recognisable empty-row class').toBeTruthy()

    /*
    Against the FILTER LINE, not against the whole file. The first version of this
    test looked at all of `uniformity.js` and passed even with the filter broken,
    because the right name appeared in a comment. A test that a comment can satisfy
    proves nothing, and the only reason it was noticed is that it was tested in
    the negative.
    */
    const filter = tool.match(/const td = .*\n?.*!\/(\S+?)\/\.test/)?.[1]
      ?? tool.split('\n').find((l) => l.includes('.find((c) =>'))
    expect(
      filter,
      `the empty-row filter does not skip the class Table.tsx uses today ("${cls}")`,
    ).toContain(`_${cls}_`)
  })
})

describe('merge groups by family without losing which route each signature comes from', () => {
  it('joins the same signature from two routes and names them', () => {
    const report = merge([
      { route: '/zones/', signatures: { table: ['A'] } },
      { route: '/cache/', signatures: { table: ['A'] } },
      { route: '/dhcp/leases/', signatures: { table: ['B'] } },
    ])
    const t = report.find((f) => f.family === 'table')
    expect(t.count).toBe(2)
    expect(t.signatures).toContain('A  →  /zones/, /cache/')
    expect(t.signatures).toContain('B  →  /dhcp/leases/')
  })
})

/*
Portals, and alerts split by type.

Two holes at once. `Dialog` mounts through a portal, outside `<main>`, so for a
long time this tool **did not see a single piece of dialog content**, while the
whole modal system was being decided. And the alert family measured
`borderRadius | inset`, so an alert could go from filled to outlined **without any
family moving**: exactly the decision that had to be taken was invisible to the
guard meant to protect it.
*/
function alert({ type, background, icon = false, inDialog = false }) {
  const main = document.createElement('main')
  const box = `<div class="_alert_x _${type}_y" style="background:${background};border-radius:8px">
      ${icon ? '<svg aria-hidden="true"></svg>' : ''}<b>${type}!</b> text
    </div>`
  if (inDialog) {
    main.innerHTML = ''
    const d = document.createElement('div')
    d.setAttribute('role', 'dialog')
    d.innerHTML = box
    document.body.replaceChildren(main, d)
  } else {
    main.innerHTML = box
    document.body.replaceChildren(main)
  }
}

describe('the guard sees portals and splits alerts by type', () => {
  beforeEach(() => document.body.replaceChildren())

  /*
  THE INVARIANT. Widening the tool must not move what was already measured: the
  baseline was taken with no dialog open, and it has to stay valid.
  */
  it('with no dialog open it only looks at <main>, as before', () => {
    const main = document.createElement('main')
    main.innerHTML = '<div class="_alert_x _info_y" style="background:#123">a</div>'
    const outside = document.createElement('div')
    outside.innerHTML = '<div class="_alert_x _warning_y" style="background:#456">b</div>'
    document.body.replaceChildren(main, outside)

    const f = screenSignatures()
    expect(Object.keys(f)).toContain('notice-info')
    expect(Object.keys(f)).not.toContain('notice-warning')
  })

  it('an alert inside a dialog IS measured now', () => {
    alert({ type: 'warning', background: '#456', inDialog: true })
    expect(screenSignatures()['notice-warning']).toHaveLength(1)
  })

  it('info and warning land in different families, not in one', () => {
    const main = document.createElement('main')
    main.innerHTML =
      '<div class="_alert_x _info_y" style="background:#123">a</div>' +
      '<div class="_alert_x _warning_y" style="background:#456">b</div>'
    document.body.replaceChildren(main)

    const f = screenSignatures()
    expect(f['notice-info']).toHaveLength(1)
    expect(f['notice-warning']).toHaveLength(1)
    expect(f.notice).toBeUndefined()
  })

  /* The measure that was missing: with the old signature an alert could go from
     filled to outlined without anything moving. */
  it('tells filled from outlined', () => {
    alert({ type: 'info', background: '#123' })
    expect(screenSignatures()['notice-info'][0]).toContain('filled')

    alert({ type: 'info', background: 'transparent' })
    expect(screenSignatures()['notice-info'][0]).toContain('outlined')
  })

  /* The width cap: the third thing the signature did not see. Without this,
     `--notice-max` could be applied (or stop being applied) without anything
     moving. */
  it('the signature includes the painted width', () => {
    const main = document.createElement('main')
    main.innerHTML = '<div class="_alert_x _info_y" style="background:#123;max-width:880px">a</div>'
    document.body.replaceChildren(main)
    /* jsdom does no layout, so the width comes out as 0: what this test pins is
       that the signature CARRIES the width, not how much it measures. The number
       is checked in the sweep, against the real page and at 1440. */
    expect(screenSignatures()['notice-info'][0]).toMatch(/width \d+px/)

    main.innerHTML = '<div class="_alert_x _info_y" style="background:#123">a</div>'
    document.body.replaceChildren(main)
    expect(screenSignatures()['notice-info'][0]).toMatch(/width \d+px/)
  })

  it('and detects the icon', () => {
    alert({ type: 'warning', background: '#456', icon: true })
    expect(screenSignatures()['notice-warning'][0]).toContain('with-icon')

    alert({ type: 'warning', background: '#456', icon: false })
    expect(screenSignatures()['notice-warning'][0]).toContain('no-icon')
  })
})

/*
The two control-width families. They measure what is RENDERED (not what is
declared) because that is the lesson that already cost two corrections in a single
day: the alerts' cap lived on the container, and the fill was decided by the order
of the bundle. Looking at the declaration would have come out green both times.
*/
describe('control widths', () => {
  beforeEach(() => document.body.replaceChildren())

  const withFields = (html) => {
    const main = document.createElement('main')
    main.innerHTML = html
    document.body.replaceChildren(main)
  }

  /* The numeric field of a FORM and that of a CELL are two objects: the first has
     the width its label's grid gives it and the second fills its column. Together
     they gave 104 px and 151 px in Settings and looked like drift. */
  it('separates the form numeric field from the cell one, and does not measure text fields', () => {
    withFields('<input type="number"><input type="text">')
    const f = screenSignatures()
    expect(f['field-num-width-form']).toHaveLength(1)
    expect(f['field-num-width-form'][0]).toMatch(/^\d+px$/)
    expect(f['field-num-width-cell']).toBeUndefined()
  })

  it('the numeric field inside a cell lands in the other family', () => {
    withFields('<table><tbody><tr><td><input type="number"></td></tr></tbody></table>')
    const f = screenSignatures()
    expect(f['field-num-width-cell']).toHaveLength(1)
    expect(f['field-num-width-form']).toBeUndefined()
  })

  /* A textarea's height is `rows` times the line plus the frame, so measuring the
     height turned somebody asking for five rows instead of three into drift. What
     is measured is the formula, and `rows` drops out. */
  it('measures the textarea formula and not its height', () => {
    withFields('<textarea rows="3"></textarea><textarea rows="5"></textarea>')
    const f = screenSignatures()['field-area-height']
    expect(f).toHaveLength(1)
    expect(f[0]).toMatch(/^line .* \+ frame \d+px$/)
  })
})

/*
The row grid, panel and modal APART.

`Form` tells the two apart on purpose (210 px in the dense form, 180 in the tighter
space of the dialog) and it says so in `ui/Form.module.css`. An earlier audit
called it drift from a grep, without opening the file, and it had to be corrected.
Measuring them together would have built that confusion into the instrument.
*/
describe('the row grid is measured by context', () => {
  beforeEach(() => document.body.replaceChildren())

  it('separates the panel row from the modal one', () => {
    const main = document.createElement('main')
    main.innerHTML =
      '<div class="_row_a" style="grid-template-columns:210px 1fr">' +
      '<span class="_rowLabel_a"></span></div>' +
      '<div class="_mrow_b" style="grid-template-columns:180px 1fr">' +
      '<span class="_mrowLabel_b"></span></div>'
    document.body.replaceChildren(main)

    const f = screenSignatures()
    expect(f['grid-panel']).toHaveLength(1)
    expect(f['grid-modal']).toHaveLength(1)
  })

  /* `_mrow_` contains the substring `row`: if the question were asked the other way
     round, every modal row would count as a panel row and the two families would
     mix. */
  it('does not mistake a modal row for a panel row', () => {
    const main = document.createElement('main')
    main.innerHTML =
      '<div class="_mrow_b" style="grid-template-columns:180px 1fr">' +
      '<span class="_mrowLabel_b"></span></div>'
    document.body.replaceChildren(main)

    const f = screenSignatures()
    expect(f['grid-modal']).toHaveLength(1)
    expect(f['grid-panel']).toBeUndefined()
  })

  /*
  And the `.row` of ANOTHER module is not a form row.

  Measured in the console: Cache, Allowed, Blocked and View Logs have their own
  `.row`, which is not a grid, and the family came out with a `none` signature
  that is no form's grid. What tells the two apart is the label, which every
  `Form` row paints as a direct child.
  */
  it("ignores another module's `.row`, which is not a form row", () => {
    const main = document.createElement('main')
    main.innerHTML =
      '<div class="_row_a" style="grid-template-columns:210px 1fr">' +
      '<span class="_rowLabel_a"></span></div>' +
      '<div class="_row_zzz" style="display:flex"></div>'
    document.body.replaceChildren(main)

    const f = screenSignatures()
    expect(f['grid-panel']).toEqual(['210px 1fr'])
  })
})
