/*
Regression tests for the static contract reader, written from the three ways its
first version was wrong. Each one is a real case in this repository, not a
fixture: the point is that the tool keeps agreeing with the code it reads.
*/
import { describe, expect, it } from 'vitest'
import { join } from 'node:path'
import { ROOT, confirmations, inventory, matrices, walk } from './static-contract.mjs'

const files = walk(join(ROOT, 'screens/zones'))
const confs = confirmations(files)
const mats = matrices(files)

describe('confirmations', () => {
  it('finds all fifteen', () => {
    expect(confs).toHaveLength(15)
  })

  /*
  The one that matters. The regex version searched the whole object for a
  single-quoted string, found the `text:` of the success notice nested inside
  `action`, and reported eight of the fifteen as having a result message where
  their question belongs. It became a claim about the product before it was
  checked.
  */
  it('reads the question and not the success message nested in `action`', () => {
    const deleteRecord = confs.find((c) => c.title === 'Delete Record')
    expect(deleteRecord.text).toBe(
      "Are you sure to permanently delete the ${r.type} record '${name}'?",
    )
    expect(deleteRecord.text).not.toContain('successfully')
  })

  /*
  Contains a question, not ends with one: `Delete Zones` asks and then LISTS the
  zones it would delete, so its question mark sits in the middle. The first
  version of this assertion demanded the end and would have turned a correct
  string into a reported defect — the same shape of error as the one this whole
  file exists to stop.
  */
  it('every one of them asks something, in every branch it has', () => {
    for (const c of confs) {
      expect(c.texts.length, `${c.title} at ${c.file}:${c.line}`).toBeGreaterThan(0)
      for (const t of c.texts) {
        expect(t.text, `${c.title} at ${c.file}:${c.line}`).toContain('?')
      }
    }
  })

  /* Resync has two sentences — AXFR for a secondary, refresh for the rest — put
     together in a local `const` and passed by shorthand. Both are the contract. */
  it('follows a shorthand to its local const and keeps both branches', () => {
    const resync = confs.filter((c) => c.title === 'Resync Zone')
    expect(resync).toHaveLength(2)
    for (const r of resync) {
      expect(r.texts).toHaveLength(2)
      expect(r.texts[0].text).toContain('AXFR')
      expect(r.texts[1].text).toContain('refresh')
      /* Both sentences AND which zone sees which: two texts with no predicate is
         half a contract. */
      expect(r.texts[0].when).toContain("=== 'Secondary'")
      expect(r.texts[1].when).toMatch(/^!\(/)
    }
  })

  it('keeps the holes of a template, because the sentence names its object', () => {
    const disable = confs.find((c) => c.title === 'Disable Zone')
    expect(disable.text).toContain('${')
  })

  it('counts five destructive invocations over four distinct actions', () => {
    const danger = confs.filter((c) => c.danger)
    expect(danger).toHaveLength(5)
    expect(new Set(danger.map((c) => c.title))).toEqual(
      new Set(['Delete Zone', 'Delete Record', 'Delete Zones', 'Delete Private Key']),
    )
    /* Delete Zone is reachable from the list AND from the records view. */
    expect(danger.filter((c) => c.title === 'Delete Zone')).toHaveLength(2)
  })

  it('leaves nothing unresolved without saying so', () => {
    for (const c of confs) expect(c.unresolved, `${c.file}:${c.line}`).toEqual([])
  })
})

describe('matrices', () => {
  /* Counting braces made this nine: the last entry carries a nested `reference`. */
  it('counts ADD_TYPES by elements and not by braces', () => {
    const m = mats['screens/zones/modals/add-zone.ts::ADD_TYPES']
    expect(m.count).toBe(8)
    expect(m.labels).toContain('Secondary ROOT Zone')
  })

  /* Keyed by name alone, one of these overwrote the other. */
  it('keeps both declarations of SECONDARIES apart', () => {
    const keys = Object.keys(mats).filter((k) => k.endsWith('::SECONDARIES'))
    expect(keys).toHaveLength(2)
    expect(keys).toContain('screens/zones/zone-view.ts::SECONDARIES')
    expect(keys).toContain('screens/zones/options.ts::SECONDARIES')
  })

  it('reads a plain list as values', () => {
    expect(mats['screens/zones/ZoneList.tsx::RESYNC'].values).toEqual([
      'Secondary',
      'SecondaryForwarder',
      'SecondaryCatalog',
      'Stub',
    ])
  })

  it('reports what it cannot read instead of dropping it', () => {
    const spread = mats['screens/zones/ZoneList.tsx::WITH_OPTIONS']
    expect(spread.unresolved).toBeTruthy()
  })

  /*
  The totals, kept honest. "50 matrices" was a false label: 50 is every uppercase
  constant, and only 38 of them are arrays. Twelve are something else entirely and
  are reported as such rather than counted as data.
  */
  it('separates uppercase constants from the arrays among them', () => {
    const all = Object.entries(mats)
    const arrays = all.filter(([, v]) => v.values || v.structured)
    const badArrays = all.filter(([, v]) => v.unresolved && !/^initializer is/.test(v.unresolved))
    const notArrays = all.filter(([, v]) => /^initializer is/.test(v.unresolved ?? ''))
    expect(all).toHaveLength(50)
    expect(arrays).toHaveLength(36)
    expect(badArrays).toHaveLength(2)
    expect(notArrays).toHaveLength(12)
    expect(arrays.length + badArrays.length).toBe(38)
  })
})

describe('dialog inventory', () => {
  it('only treats calls to real label helpers as fields', () => {
    const inv = inventory(join(ROOT, 'screens/zones/modals/AddEditRecord.tsx'))
    const helperLabels = inv.fields.filter((f) => f.tag === 'helperArg').map((f) => f.label)

    expect(helperLabels).toContain('IPv4 Address')
    expect(helperLabels).toContain('Preference')
    expect(helperLabels).not.toContain('expiryTtl')
    expect(helperLabels).not.toContain('createPtrZone')
    expect(helperLabels).not.toContain('value')
  })

  it('preserves repeated labels in different record variants', () => {
    const inv = inventory(join(ROOT, 'screens/zones/modals/AddEditRecord.tsx'))
    const preferences = inv.fields.filter((f) => f.label === 'Preference')
    expect(preferences).toHaveLength(2)
    expect(preferences.map((f) => f.gate?.at(-1))).toEqual([
      "f.type.toUpperCase() === 'MX'",
      "f.type.toUpperCase() === 'NAPTR'",
    ])
  })

  it('reads native labels whose text is nested in JSX', () => {
    const inv = inventory(join(ROOT, 'screens/zones/modals/AddZone.tsx'))
    expect(inv.fields.map((f) => f.label)).toContain('Use ZONEMD to Validate Zone')
  })

  it('keeps dialog chrome and prose in the contract', () => {
    const inv = inventory(join(ROOT, 'screens/zones/modals/UnsignZone.tsx'))
    expect(inv.dialog).toMatchObject({ size: 'form', actions: ['Unsign Zone'], close: 'Close' })
    expect(inv.prose.join(' ')).toContain('permanently delete all of the private keys')
  })
})

/*
The Settings vocabulary.

Reading `screens/settings` for pilot 3 returned the nine panes' 152 field labels
and ZERO help, ZERO notices and ZERO group headings. Nothing was broken: the
reader knew only how Zones writes those three things. Zones hangs its help off a
CHILD, Settings hangs it off a PROP, and for a dense form —where the help text is
most of the surface— that difference is the whole contract.

These are the four shapes it learnt, each pinned to the line of real source that
taught it, plus the two defects that showing up in Settings revealed in Zones.
*/
describe('the Settings vocabulary', () => {
  const general = inventory(join(ROOT, 'screens/settings/panes/General.tsx'))

  it('reads `help` written as a prop, not only as a child', () => {
    expect(general.help).toContain(
      'The primary fully qualified domain name used by this DNS Server to identify itself.',
    )
    expect(general.help.length).toBeGreaterThanOrEqual(41)
  })

  /*
  `<Note>` and `<Warning>` are `<Alert>` with a title the wrapper supplies, so
  the call site carries the body and never the word. They are filed in the same
  `title: body` shape the `Alert` reader already produced, so a document built
  from either screen reads alike.
  */
  it('gives `Note` and `Warning` the title their wrapper adds', () => {
    expect(general.prose.filter((p) => p.startsWith('Note!: '))).toHaveLength(8)
    expect(general.prose.filter((p) => p.startsWith('Warning!: '))).toHaveLength(4)
  })

  it('reads `Block title` as a section heading', () => {
    expect(general.sections).toEqual([
      'Local Parameters',
      'Default Parameters',
      'Software Update',
      'IPv6',
      'UDP Socket Pool',
      'EDNS',
      'DNSSEC',
      'EDNS Client Subnet',
      'Rate Limiting',
      'Advanced Options',
    ])
  })

  /*
  `Radios` gives every option its own label AND its own help, written inline in
  `options={[…]}` and not in a named matrix, so both arrive as properties of an
  object and not as JSX attributes. The three labels were on the screen, in the
  source, and in neither reading until the DOM contrast turned them up: the AST
  had 44 controls where the browser showed those three by name.
  */
  it('reads the per-option label and help of an inline radio group', () => {
    const radios = general.fields.filter((f) => f.tag.endsWith('Option')).map((f) => f.label)
    expect(radios).toEqual(['Disable IPv6', 'Enable IPv6', 'Prefer IPv6'])
    expect(general.help.join(' ')).toContain(
      'Disables IPv6 support such that the DNS Server uses only IPv4',
    )
  })

  /* Scoped to `options={[…]}`: a bare "any property called `label`" would turn
     every entry of every named matrix into a control. `TSIG_ALGORITHMS` is eight
     values, and none of them is a control. */
  it('does not turn the entries of a named matrix into controls', () => {
    const tsig = inventory(join(ROOT, 'screens/settings/panes/Tsig.tsx'))
    expect(tsig.fields.map((f) => f.label)).not.toContain('HMAC-SHA256 (recommended)')
  })

  it('leaves nothing of General unresolved', () => {
    expect(general.unresolved).toEqual([])
  })

  /*
  Settings uses one name for two things: `<HelpText>` is a paragraph of help and
  `<Help href="…">` is an outgoing link with its own text. Filing the link's text
  as help is how a contract grows a help string nobody ever wrote.
  */
  it('treats `Help` with an href as a link and not as help', () => {
    const inv = inventory(join(ROOT, 'screens/settings/panes/OptionalProtocols.tsx'))
    expect(inv.links).toContain(
      'https://blog.technitium.com/2020/07/how-to-host-your-own-dns-over-https-and.html',
    )
    expect(inv.help.join(' ')).not.toContain('how-to-host-your-own')
  })
})

/*
Two defects in Zones that only showed up once Settings was read. Both were in the
contract that went to Claude Design for pilot 2 — neither lost a control, and one
lost a sentence.
*/
describe('what reading Settings revealed in Zones', () => {
  const addZone = inventory(join(ROOT, 'screens/zones/modals/AddZone.tsx'))

  /* `jsxLiteralText` knew `JsxElement` and not `JsxFragment`, so this one help
     text —`AddZone.tsx:179`— was reported unresolved and never reached the
     pilot-2 contract. */
  it('recovers help written as a bare fragment', () => {
    expect(addZone.help).toContain('Select a Catalog zone to register as its member zone.')
  })

  /* And once fragments became readable, `<Row help={<><p>…</p><p>…</p></>}>`
     (`AddZone.tsx:326`) arrived twice: as prose because they are `<p>`, and as
     help because they are the value of `help`. The prop is the true reading. */
  it('files a `<p>` inside a `help` prop as help and not twice', () => {
    expect(addZone.prose).toEqual([])
    expect(addZone.help.join(' ')).toContain('When using "This Server"')
    expect(addZone.help.join(' ')).toContain('You can add more forwarders')
  })
})

/*
The other way a confirmation is written. Reading only `onConfirm({…})` reported
Settings as having none, when `Settings.tsx` mounts three as elements — and one
of them hangs off the bar shared by all nine panes, so it is reachable from the
pane pilot 3 draws.
*/
describe('confirmations written as an element', () => {
  const settings = confirmations(walk(join(ROOT, 'screens/settings')))

  it('finds the three of Settings, with their literal question', () => {
    expect(settings.map((c) => c.title)).toEqual([
      'Flush Cache',
      'Temporary Disable Blocking',
      'Update Block Lists',
    ])
    expect(settings[0].text).toBe('Are you sure to flush the DNS Server cache?')
    expect(settings[0].label).toBe('Flush')
  })

  /*
  Zones renders its fifteen through ONE generic `<Confirm>` whose title is
  `confirmation?.title`. Counting that element would have made them sixteen: a
  host is not a contract.
  */
  it('does not count the generic host of Zones as a sixteenth', () => {
    expect(confs).toHaveLength(15)
    expect(confs.filter((c) => c.via === 'element')).toHaveLength(0)
  })
})

/*
Los seis rótulos de grupo de `General`.

El contrato del piloto 3 afirmaba «seis `GroupRow`» y su evidencia sólo nombraba
dos: una cifra sin su inventario. Lo encontró el propio piloto, que se negó a
inventarse los cuatro que no podía nombrar, y tenía razón. El AST siempre los leyó
bien —el fallo estaba en el extractor del DOM—, así que esto fija lo que el AST ve
para que la próxima discrepancia se note aquí y no en una entrega.

Cinco de los seis repiten el título de su sección; sólo `Zone Defaults` no. Ese
hecho es el que hace que enumerarlos importe.
*/
describe('las etiquetas estructurales de General', () => {
  const general = inventory(join(ROOT, 'screens/settings/panes/General.tsx'))

  it('lee los seis rótulos de grupo, por nombre y en orden de fuente', () => {
    expect(general.fields.filter((f) => f.tag === 'GroupRow').map((f) => f.label)).toEqual([
      'Zone Defaults',
      'Software Update',
      'IPv6 Support',
      'UDP Socket Pool',
      'DNSSEC',
      'EDNS Client Subnet (ECS)',
    ])
  })

  it('lee los dos rótulos de lista y no los confunde con controles', () => {
    expect(general.fields.filter((f) => f.tag === 'EditableList').map((f) => f.label)).toEqual([
      'Queries Per Minute (QPM) Limits (IPv4)',
      'Queries Per Minute (QPM) Limits (IPv6)',
    ])
  })

  /* 47 = 39 controles comparables + 8 estructurales. La suma sólo vale si las
     tres poblaciones se mantienen separadas. */
  it('mantiene separadas las tres poblaciones', () => {
    const estructurales = general.fields.filter((f) => f.tag === 'GroupRow' || f.tag === 'EditableList')
    expect(estructurales).toHaveLength(8)
    expect(general.fields).toHaveLength(47)
  })
})
