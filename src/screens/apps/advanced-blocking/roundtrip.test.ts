import { describe, expect, it } from 'vitest'
import {
  addGroup,
  addList,
  addRow,
  deleteGroup,
  isUnchanged,
  openConfig,
  pendingSections,
  removeList,
  removeRow,
  serializeConfig,
  setGeneral,
  setGroup,
  setList,
  setRow,
  type EditorModel,
} from './config-model'

const corpus = import.meta.glob('./corpus/*', { query: '?raw', import: 'default', eager: true }) as Record<string, string>

function open(text: string): EditorModel {
  const r = openConfig(text)
  if (r.kind !== 'editable') throw new Error(`refused: ${r.reason}`)
  return r.model
}

/* The independent comparator: it knows nothing of the tree, only what JSON.parse
   reads from the text before and after. */
function diff(a: unknown, b: unknown, path = ''): string[] {
  if (a === b) return []
  const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null
  if (!isObj(a) || !isObj(b) || Array.isArray(a) !== Array.isArray(b)) return [path]
  if (Array.isArray(a) && Array.isArray(b)) {
    const out: string[] = []
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
      if (i >= a.length || i >= b.length) out.push(`${path}[${i}]`)
      else out.push(...diff(a[i], b[i], `${path}[${i}]`))
    }
    return out
  }
  const out: string[] = []
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const next = path === '' ? k : `${path}.${k}`
    if (!(k in a) || !(k in b)) out.push(next)
    else out.push(...diff(a[k], b[k], next))
  }
  return out
}

const SOURCE = `{
  "2": "two",
  "1": "one",
  "big": 12345678901234567890,
  "esc": "\\u0041\\/",
  "enableBlocking": true,
  "blockingAnswerTtl": 30,
  "blockListUrlUpdateIntervalHours": 24,
  "blockListUrlUpdateIntervalMinutes": 0,
  "localEndPointGroupMap": {
    "dot.example": "kids"
  },
  "networkGroupMap": {
    "10.0.0.0/8": "kids",
    "192.168.0.0/16": "family"
  },
  "groups": [
    {
      "name": "kids",
      "note": { "20": 1.50, "3": "\\u00e9" },
      "enableBlocking": true,
      "allowTxtBlockingReport": true,
      "blockAsNxDomain": true,
      "blockingAddresses": ["0.0.0.0"],
      "allowed": ["a.example"],
      "blocked": ["b.example"],
      "allowListUrls": ["https://allow.example/"],
      "blockListUrls": [
        "https://plain.example/",
        { "url": "https://own.example/", "blockAsNxDomain": false, "blockingAddresses": ["1.1.1.1"], "keep": 99999999999999999999 },
        { "url": "https://bare.example/", "blockAsNxDomain": true }
      ],
      "allowedRegex": [],
      "blockedRegex": [],
      "regexAllowListUrls": [],
      "regexBlockListUrls": [],
      "adblockListUrls": []
    },
    {
      "name": "family",
      "allowed": null,
      "blocked": [],
      "allowListUrls": [],
      "blockListUrls": [],
      "allowedRegex": [],
      "blockedRegex": [],
      "regexAllowListUrls": [],
      "regexBlockListUrls": [],
      "adblockListUrls": []
    }
  ]
}`

const model = () => open(SOURCE)
const kids = (m: EditorModel) => m.groups[0]
const family = (m: EditorModel) => m.groups[1]
const row = (m: EditorModel, address: string) => {
  const r = m.rows.find((x) => x.address === address)
  if (r === undefined) throw new Error(`no row ${address}`)
  return r
}
const list = (m: EditorModel, url: string) => {
  const l = kids(m).lists.find((x) => x.url === url)
  if (l === undefined) throw new Error(`no list ${url}`)
  return l
}
const changedPaths = (m: EditorModel) => diff(JSON.parse(SOURCE), JSON.parse(serializeConfig(m)))

describe('an untouched config', () => {
  it('serializes to JSON equal to its source, for every corpus file', () => {
    for (const [name, text] of Object.entries(corpus)) {
      const m = open(text)
      expect(diff(JSON.parse(text), JSON.parse(serializeConfig(m))), name).toEqual([])
      expect(isUnchanged(m), name).toBe(true)
      expect(pendingSections(m), name).toEqual([])
    }
  })

  it('keeps every key in file order, for every corpus file', () => {
    for (const [name, text] of Object.entries(corpus)) {
      /* JSON.stringify keeps the order keys were read in; the corpus has no numeric keys. */
      expect(JSON.stringify(JSON.parse(serializeConfig(open(text)))), name).toBe(JSON.stringify(JSON.parse(text)))
    }
  })
})

describe('one edit changes one path', () => {
  const NET = 'networkGroupMap'
  const G0 = 'groups[0]'
  const cases: [string, (m: EditorModel) => EditorModel, string[]][] = [
    ['setGeneral enabled', (m) => setGeneral(m, { enabled: false }), ['enableBlocking']],
    ['setGeneral ttl', (m) => setGeneral(m, { ttl: '60' }), ['blockingAnswerTtl']],
    ['setGeneral hours', (m) => setGeneral(m, { hours: '12' }), ['blockListUrlUpdateIntervalHours']],
    ['setGeneral minutes', (m) => setGeneral(m, { minutes: '5' }), ['blockListUrlUpdateIntervalMinutes']],
    ['addRow then its fields', (m) => {
      const added = addRow(m, 'networkGroupMap')
      const r = added.rows.find((x) => !x.loaded) as { id: string }
      return setRow(added, r.id, { address: '172.16.0.0/12', groupId: family(added).id })
    }, [`${NET}.172.16.0.0/12`]],
    ['setRow address', (m) => setRow(m, row(m, '10.0.0.0/8').id, { address: '11.0.0.0/8' }), [`${NET}.10.0.0.0/8`, `${NET}.11.0.0.0/8`]],
    ['setRow group', (m) => setRow(m, row(m, '10.0.0.0/8').id, { groupId: family(m).id }), [`${NET}.10.0.0.0/8`]],
    ['removeRow', (m) => removeRow(m, row(m, 'dot.example').id), ['localEndPointGroupMap.dot.example']],
    ['addGroup', (m) => addGroup(m).model, ['groups[2]']],
    ['setGroup name', (m) => setGroup(setRow(setRow(m, row(m, '10.0.0.0/8').id, { groupId: family(m).id }), row(m, 'dot.example').id, { groupId: family(m).id }), kids(m).id, { name: 'young' }), [`${NET}.10.0.0.0/8`, 'localEndPointGroupMap.dot.example', `${G0}.name`]],
    ['setGroup enabled', (m) => setGroup(m, kids(m).id, { enabled: false }), [`${G0}.enableBlocking`]],
    ['setGroup txtReport', (m) => setGroup(m, kids(m).id, { txtReport: false }), [`${G0}.allowTxtBlockingReport`]],
    ['setGroup nxDomain', (m) => setGroup(m, kids(m).id, { nxDomain: false }), [`${G0}.blockAsNxDomain`]],
    ['setGroup addresses', (m) => setGroup(m, kids(m).id, { addresses: '0.0.0.0\n::' }), [`${G0}.blockingAddresses[1]`]],
    ['setGroup text', (m) => setGroup(m, kids(m).id, { text: { ...kids(m).text, blocked: 'b.example\nc.example' } }), [`${G0}.blocked[1]`]],
    ['deleteGroup', (m) => {
      const out = setRow(setRow(m, row(m, '192.168.0.0/16').id, { groupId: kids(m).id }), row(m, '10.0.0.0/8').id, { groupId: kids(m).id })
      return deleteGroup(out, family(out).id)
    }, [`${NET}.192.168.0.0/16`, 'groups[1]']],
    ['addList', (m) => addList(m, kids(m).id, 'adblockListUrls', 'https://new.example/'), [`${G0}.adblockListUrls[0]`]],
    ['setList url', (m) => setList(m, kids(m).id, list(m, 'https://plain.example/').id, { url: 'https://other.example/' }), [`${G0}.blockListUrls[0]`]],
    ['setList answer', (m) => setList(m, kids(m).id, list(m, 'https://bare.example/').id, { answer: 'addresses' }), [`${G0}.blockListUrls[2].blockAsNxDomain`]],
    ['setList addresses', (m) => setList(m, kids(m).id, list(m, 'https://own.example/').id, { addresses: '2.2.2.2' }), [`${G0}.blockListUrls[1].blockingAddresses[0]`]],
    ['removeList', (m) => removeList(m, kids(m).id, list(m, 'https://bare.example/').id), [`${G0}.blockListUrls[2]`]],
  ]

  it.each(cases)('%s', (_label, edit, expected) => {
    const m = edit(model())
    expect(changedPaths(m).sort()).toEqual([...expected].sort())
    expect(isUnchanged(m)).toBe(false)
  })

  it('undoing an edit leaves nothing changed', () => {
    let m = model()
    const before = serializeConfig(m)
    m = setGeneral(m, { ttl: '60' })
    m = setGroup(m, kids(m).id, { name: 'young', text: { ...kids(m).text, blocked: 'zzz.example' } })
    m = setGeneral(m, { ttl: '30' })
    m = setGroup(m, kids(m).id, { name: 'kids', text: { ...kids(m).text, blocked: 'b.example' } })
    expect(serializeConfig(m)).toBe(before)
    expect(isUnchanged(m)).toBe(true)
  })

  it('counts a blank line or a trailing newline as no change', () => {
    const m = setGroup(model(), kids(model()).id, { text: { ...kids(model()).text, blocked: 'b.example\n\n  \n' } })
    expect(isUnchanged(m)).toBe(true)
  })
})

describe('what must survive', () => {
  it('unknown big integers, numeric keys and escapes survive an edit elsewhere', () => {
    const m = model()
    const out = serializeConfig(setGeneral(m, { ttl: '60' }))
    for (const fragment of ['"big": 12345678901234567890', '"esc": "\\u0041\\/"', '"keep": 99999999999999999999', '"20": 1.50', '"3": "\\u00e9"']) {
      expect(out).toContain(fragment)
    }
    expect(out.indexOf('"2": "two"')).toBeLessThan(out.indexOf('"1": "one"'))
    expect(out.indexOf('"20"')).toBeLessThan(out.indexOf('"3"'))
  })

  it('a dangling reference is written back unchanged after an unrelated edit', () => {
    const text = '{"networkGroupMap":{"10.0.0.0/8":"gone","11.0.0.0/8":null},"groups":[{"name":"k"}]}'
    const m = open(text)
    const out = serializeConfig(setGeneral(m, { ttl: '60' }))
    expect(out).toContain('"10.0.0.0/8": "gone"')
    expect(out).toContain('"11.0.0.0/8": null')
  })

  it('a dangling reference keeps its text when its address is what changes', () => {
    const m = open('{"networkGroupMap":{"10.0.0.0/8":"gone"},"groups":[]}')
    const out = serializeConfig(setRow(m, m.rows[0].id, { address: '11.0.0.0/8' }))
    expect(JSON.parse(out).networkGroupMap).toEqual({ '11.0.0.0/8': 'gone' })
  })

  it('a rewritten map keeps the escapes of the rows it did not touch', () => {
    const m = open('{"networkGroupMap":{"\\u0031.0.0.0/8":"k\\u0069ds","2.0.0.0/8":"kids"},"groups":[{"name":"kids"}]}')
    const out = serializeConfig(removeRow(m, m.rows[1].id))
    expect(out).toContain('"\\u0031.0.0.0/8": "k\\u0069ds"')
  })

  it('an edited list keeps the spelling of the values that stayed', () => {
    const m = open('{"networkGroupMap":{},"groups":[{"name":"k","blocked":["\\u0061.example","b.example"]}]}')
    const out = serializeConfig(setGroup(m, m.groups[0].id, { text: { ...m.groups[0].text, blocked: 'a.example\nb.example\nc.example' } }))
    expect(out).toContain('"\\u0061.example"')
  })

  it('a key absent from the source stays absent unless edited', () => {
    const text = '{"networkGroupMap":{},"groups":[{"name":"k"}]}'
    const m = setGroup(open(text), open(text).groups[0].id, { name: 'j' })
    const parsed = JSON.parse(serializeConfig(m))
    expect(Object.keys(parsed)).toEqual(['networkGroupMap', 'groups'])
    expect(Object.keys(parsed.groups[0])).toEqual(['name'])
  })

  it('a value typed equal to the default of an absent key stays absent', () => {
    const text = '{"networkGroupMap":{},"groups":[]}'
    const m = setGeneral(open(text), { ttl: '30', hours: '24', minutes: '0', enabled: true })
    expect(Object.keys(JSON.parse(serializeConfig(m)))).toEqual(['networkGroupMap', 'groups'])
    expect(isUnchanged(m)).toBe(true)
  })

  it('an absent key appears when it is edited', () => {
    const text = '{"networkGroupMap":{},"groups":[]}'
    expect(JSON.parse(serializeConfig(setGeneral(open(text), { ttl: '60' }))).blockingAnswerTtl).toBe(60)
  })

  it('a list untouched in a group that lacks it stays absent', () => {
    const text = '{"networkGroupMap":{},"groups":[{"name":"k","blocked":[]}]}'
    const m = open(text)
    const out = JSON.parse(serializeConfig(setGroup(m, m.groups[0].id, { text: { ...m.groups[0].text, blocked: 'x.example' } })))
    expect(Object.keys(out.groups[0])).toEqual(['name', 'blocked'])
  })

  it('a new endpoint map appears when the first row is added', () => {
    const text = '{"networkGroupMap":{},"groups":[{"name":"k"}]}'
    const m = addRow(open(text), 'localEndPointGroupMap')
    const r = m.rows[0]
    const out = JSON.parse(serializeConfig(setRow(m, r.id, { address: 'dot.example', groupId: m.groups[0].id })))
    expect(out.localEndPointGroupMap).toEqual({ 'dot.example': 'k' })
  })

  it('a new group has the nine lists', () => {
    const out = JSON.parse(serializeConfig(addGroup(model()).model))
    expect(Object.keys(out.groups[2]).sort()).toEqual([
      'adblockListUrls', 'allowListUrls', 'allowTxtBlockingReport', 'allowed', 'allowedRegex',
      'blockAsNxDomain', 'blockListUrls', 'blocked', 'blockedRegex', 'blockingAddresses',
      'enableBlocking', 'name', 'regexAllowListUrls', 'regexBlockListUrls',
    ].sort())
    for (const k of ['allowed', 'blocked', 'allowedRegex', 'blockedRegex', 'allowListUrls', 'blockListUrls', 'regexAllowListUrls', 'regexBlockListUrls', 'adblockListUrls']) {
      expect(out.groups[2][k]).toEqual([])
    }
  })

  it('removing a list answer drops only its two keys and keeps others', () => {
    const m = model()
    const out = JSON.parse(serializeConfig(setList(m, kids(m).id, list(m, 'https://own.example/').id, { answer: 'group' })))
    expect(out.groups[0].blockListUrls[1]).toEqual({ url: 'https://own.example/', keep: JSON.parse('99999999999999999999') })
    expect(serializeConfig(setList(m, kids(m).id, list(m, 'https://own.example/').id, { answer: 'group' }))).toContain('"keep": 99999999999999999999')
  })

  it('a list object with only url after that becomes a string', () => {
    const m = model()
    const out = JSON.parse(serializeConfig(setList(m, kids(m).id, list(m, 'https://bare.example/').id, { answer: 'group' })))
    expect(out.groups[0].blockListUrls[2]).toBe('https://bare.example/')
  })

  it('an object that never had an answer stays an object when only its url changes', () => {
    const m = open('{"networkGroupMap":{},"groups":[{"name":"k","blockListUrls":[{"url":"https://a/"}]}]}')
    const out = JSON.parse(serializeConfig(setList(m, m.groups[0].id, m.groups[0].lists[0].id, { url: 'https://b/' })))
    expect(out.groups[0].blockListUrls[0]).toEqual({ url: 'https://b/' })
  })

  it('an own answer on a list that was text makes it an object', () => {
    const m = model()
    const id = list(m, 'https://plain.example/').id
    const nx = JSON.parse(serializeConfig(setList(m, kids(m).id, id, { answer: 'nx' })))
    expect(nx.groups[0].blockListUrls[0]).toEqual({ url: 'https://plain.example/', blockAsNxDomain: true })
    const own = JSON.parse(serializeConfig(setList(m, kids(m).id, id, { answer: 'addresses', addresses: '1.2.3.4' })))
    expect(own.groups[0].blockListUrls[0]).toEqual({ url: 'https://plain.example/', blockAsNxDomain: false, blockingAddresses: ['1.2.3.4'] })
  })

  it('null list stays null until edited', () => {
    const m = model()
    expect(serializeConfig(m)).toContain('"allowed": null')
    const touched = setGroup(m, family(m).id, { text: { ...family(m).text, blocked: 'x.example' } })
    expect(serializeConfig(touched)).toContain('"allowed": null')
    const edited = setGroup(m, family(m).id, { text: { ...family(m).text, allowed: 'x.example' } })
    expect(JSON.parse(serializeConfig(edited)).groups[1].allowed).toEqual(['x.example'])
  })

  it('a list emptied becomes an empty list and is not removed', () => {
    const m = model()
    const out = JSON.parse(serializeConfig(setGroup(m, kids(m).id, { text: { ...kids(m).text, blocked: '' } })))
    expect(out.groups[0].blocked).toEqual([])
  })

  it('an edited number is written plain, without the zeros typed in front', () => {
    const m = model()
    expect(serializeConfig(setGeneral(m, { ttl: '0060' }))).toContain('"blockingAnswerTtl": 60')
  })

  it('a number typed as the same value with zeros in front is no change', () => {
    expect(isUnchanged(setGeneral(model(), { ttl: '030' }))).toBe(true)
  })
})

describe('rows are bound by identity', () => {
  it('typing an address equal to another row keeps both rows', () => {
    const m = model()
    const out = setRow(m, row(m, '10.0.0.0/8').id, { address: '192.168.0.0/16' })
    expect(out.rows.length).toBe(m.rows.length)
    expect(out.rows.filter((r) => r.address === '192.168.0.0/16').length).toBe(2)
    expect(out.rows.map((r) => r.id)).toEqual(m.rows.map((r) => r.id))
    expect(out.rows.find((r) => r.id === row(m, '10.0.0.0/8').id)?.groupId).toBe(kids(m).id)
  })

  it('two new empty rows stay two rows', () => {
    const m = addRow(addRow(model(), 'networkGroupMap'), 'networkGroupMap')
    const added = m.rows.filter((r) => !r.loaded)
    expect(added.length).toBe(2)
    expect(added[0].id).not.toBe(added[1].id)
    expect(added.every((r) => r.address === '' && r.groupId === null && r.map === 'networkGroupMap')).toBe(true)
  })

  it('renaming through a name another group has moves no client', () => {
    let m = model()
    const k = kids(m).id
    const f = family(m).id
    m = setGroup(m, k, { name: 'family' })
    expect(row(m, '10.0.0.0/8').groupId).toBe(k)
    expect(row(m, '192.168.0.0/16').groupId).toBe(f)
    m = setGroup(m, f, { name: 'kin' })
    m = setGroup(m, k, { name: 'young' })
    const out = JSON.parse(serializeConfig(m))
    expect(out.networkGroupMap).toEqual({ '10.0.0.0/8': 'young', '192.168.0.0/16': 'kin' })
    expect(out.localEndPointGroupMap).toEqual({ 'dot.example': 'young' })
    expect(out.groups.map((g: { name: string }) => g.name)).toEqual(['young', 'kin'])
  })

  it('swapping two names swaps what the rows write, and no client changes group', () => {
    let m = model()
    const k = kids(m).id
    m = setGroup(m, family(m).id, { name: 'tmp' })
    m = setGroup(m, k, { name: 'family' })
    m = setGroup(m, m.groups[1].id, { name: 'kids' })
    const out = JSON.parse(serializeConfig(m))
    expect(out.networkGroupMap).toEqual({ '10.0.0.0/8': 'family', '192.168.0.0/16': 'kids' })
    expect(out.groups.map((g: { name: string }) => g.name)).toEqual(['family', 'kids'])
  })

  it('deleting a group leaves its rows in place without a group', () => {
    const m = model()
    const out = deleteGroup(m, kids(m).id)
    expect(out.rows.map((r) => r.address)).toEqual(m.rows.map((r) => r.address))
    expect(row(out, '10.0.0.0/8')).toMatchObject({ groupId: null, missingGroup: null })
    expect(row(out, '192.168.0.0/16').groupId).toBe(family(m).id)
  })

  it('row order: a new endpoint goes after the endpoints, a new network after the networks', () => {
    const m = addRow(addRow(model(), 'networkGroupMap'), 'localEndPointGroupMap')
    expect(m.rows.map((r) => r.map)).toEqual(['localEndPointGroupMap', 'localEndPointGroupMap', 'networkGroupMap', 'networkGroupMap', 'networkGroupMap'])
  })

  it('removing a row and adding it back at the end is a change of order', () => {
    const m = model()
    let out = removeRow(m, row(m, '10.0.0.0/8').id)
    out = addRow(out, 'networkGroupMap')
    const r = out.rows[out.rows.length - 1]
    out = setRow(out, r.id, { address: '10.0.0.0/8', groupId: kids(out).id })
    expect(isUnchanged(out)).toBe(false)
    expect(Object.keys(JSON.parse(serializeConfig(out)).networkGroupMap)).toEqual(['192.168.0.0/16', '10.0.0.0/8'])
  })
})

describe('serializeConfig will not write what it cannot represent', () => {
  it('refuses a row with no group', () => {
    const m = addRow(model(), 'networkGroupMap')
    expect(() => serializeConfig(m)).toThrow(/group/i)
  })

  it('refuses a number that is not one', () => {
    expect(() => serializeConfig(setGeneral(model(), { ttl: 'abc' }))).toThrow(/ttl|number/i)
  })

  it('refuses two rows that would write one key', () => {
    const m = model()
    expect(() => serializeConfig(setRow(m, row(m, '10.0.0.0/8').id, { address: '192.168.0.0/16' }))).toThrow(/repeat|same/i)
  })
})

describe('pendingSections', () => {
  it('names the sections with changes in page order', () => {
    let m = model()
    m = setGeneral(m, { ttl: '60' })
    m = setGroup(m, family(m).id, { enabled: false })
    m = removeRow(m, row(m, 'dot.example').id)
    expect(pendingSections(m)).toEqual(['Clients', 'family', 'General'])
  })

  it('uses the current name of a renamed group', () => {
    const m = model()
    expect(pendingSections(setGroup(m, kids(m).id, { name: 'young' }))).toEqual(['Clients', 'young'])
  })

  it('still names a deleted group, in its place', () => {
    const m = model()
    expect(pendingSections(deleteGroup(m, family(m).id))).toEqual(['Clients', 'family'])
  })

  it('names a new group after the loaded ones', () => {
    const m = setGeneral(addGroup(model()).model, { ttl: '60' })
    expect(pendingSections(m)).toEqual([m.groups[2].name, 'General'])
  })

  it('does not name a row without a group as anything but Clients', () => {
    expect(pendingSections(addRow(model(), 'networkGroupMap'))).toEqual(['Clients'])
  })
})

describe('the pure edits', () => {
  it('do not change the model they are given', () => {
    const m = model()
    const snapshot = JSON.stringify(m)
    setGeneral(m, { ttl: '1' })
    addRow(m, 'networkGroupMap')
    setRow(m, m.rows[0].id, { address: 'x' })
    removeRow(m, m.rows[0].id)
    addGroup(m)
    setGroup(m, kids(m).id, { name: 'x' })
    deleteGroup(m, kids(m).id)
    addList(m, kids(m).id, 'blockListUrls', 'x')
    setList(m, kids(m).id, kids(m).lists[0].id, { url: 'x' })
    removeList(m, kids(m).id, kids(m).lists[0].id)
    serializeConfig(m)
    expect(JSON.stringify(m)).toBe(snapshot)
  })

  it('addGroup returns the id, with a name no group has', () => {
    const m = model()
    const a = addGroup(m)
    expect(a.model.groups[2].id).toBe(a.id)
    const b = addGroup(addGroup(setGroup(m, kids(m).id, { name: 'group 4' })).model)
    expect(new Set(b.model.groups.map((g) => g.name)).size).toBe(4)
  })

  it('a new row or list never reuses a live id', () => {
    const m = addRow(addRow(model(), 'networkGroupMap'), 'networkGroupMap')
    const added = addList(m, kids(m).id, 'blockListUrls', 'https://x/')
    const ids = [...added.rows.map((r) => r.id), ...added.groups.map((g) => g.id), ...added.groups.flatMap((g) => g.lists.map((l) => l.id))]
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('addList puts a new list after those of its kind', () => {
    const m = model()
    const out = addList(m, kids(m).id, 'blockListUrls', 'https://x/')
    expect(kids(out).lists.map((l) => l.kind)).toEqual(['blockListUrls', 'blockListUrls', 'blockListUrls', 'blockListUrls', 'allowListUrls'])
    expect(kids(out).lists[3]).toMatchObject({ url: 'https://x/', answer: 'group', addresses: '', node: null })
  })

  it('setList leaves an allow list without an answer of its own', () => {
    const m = model()
    const id = list(m, 'https://allow.example/').id
    const out = setList(m, kids(m).id, id, { answer: 'nx', addresses: '1.1.1.1' })
    expect(isUnchanged(out)).toBe(true)
    expect(JSON.parse(serializeConfig(out)).groups[0].allowListUrls[0]).toBe('https://allow.example/')
  })

  it('setRow on the group of a loaded row clears the dangling name and marks it edited', () => {
    const m = open('{"networkGroupMap":{"10.0.0.0/8":"gone"},"groups":[{"name":"k"}]}')
    const out = setRow(m, m.rows[0].id, { groupId: null })
    expect(out.rows[0]).toMatchObject({ groupId: null, missingGroup: null, loaded: false })
    const chosen = setRow(m, m.rows[0].id, { groupId: m.groups[0].id })
    expect(chosen.rows[0]).toMatchObject({ groupId: m.groups[0].id, missingGroup: null, loaded: false })
  })

  it('setRow on the address alone keeps the reference as it was read', () => {
    const m = open('{"networkGroupMap":{"10.0.0.0/8":"gone"},"groups":[{"name":"k"}]}')
    expect(setRow(m, m.rows[0].id, { address: '11.0.0.0/8' }).rows[0]).toMatchObject({ missingGroup: 'gone', loaded: true })
  })
})

describe('a list that does not say how it answers', () => {
  const config = (groupNx: boolean, entry: unknown) =>
    JSON.stringify({
      networkGroupMap: {},
      groups: [{
        name: 'g', blockAsNxDomain: groupNx, blockingAddresses: ['9.9.9.9'], allowed: [], blocked: [], allowListUrls: [],
        blockListUrls: [entry], allowedRegex: [], blockedRegex: [], regexAllowListUrls: [], regexBlockListUrls: [], adblockListUrls: [],
      }],
    })
  const url = 'https://example.invalid/a.txt'

  it('follows an NXDOMAIN group even with addresses of its own', () => {
    const m = open(config(true, { url, blockingAddresses: ['3.3.3.3'] }))
    expect(m.groups[0].lists[0].answer).toBe('group')
    expect(isUnchanged(m)).toBe(true)
  })

  it('uses its addresses in a group that answers with addresses', () => {
    const m = open(config(false, { url, blockingAddresses: ['3.3.3.3'] }))
    expect(m.groups[0].lists[0].answer).toBe('addresses')
    expect(isUnchanged(m)).toBe(true)
  })

  it('says it explicitly once its addresses are edited', () => {
    const m = open(config(false, { url, blockingAddresses: ['3.3.3.3'] }))
    const g = m.groups[0]
    const out = JSON.parse(serializeConfig(setList(m, g.id, g.lists[0].id, { addresses: '4.4.4.4' })))
    expect(out.groups[0].blockListUrls[0]).toEqual({ url, blockingAddresses: ['4.4.4.4'], blockAsNxDomain: false })
  })

  it('keeps its object untouched when the group changes', () => {
    const m = open(config(true, { url, blockingAddresses: ['3.3.3.3'] }))
    const out = JSON.parse(serializeConfig(setGroup(m, m.groups[0].id, { nxDomain: false })))
    expect(out.groups[0].blockListUrls[0]).toEqual({ url, blockingAddresses: ['3.3.3.3'] })
  })
})
