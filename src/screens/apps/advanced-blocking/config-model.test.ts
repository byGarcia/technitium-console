import { describe, expect, it } from 'vitest'
import { openConfig, type EditorModel } from './config-model'

const corpus = import.meta.glob('./corpus/*', { query: '?raw', import: 'default', eager: true }) as Record<string, string>

function group(over: Record<string, unknown> = {}) {
  return {
    name: 'kids',
    allowed: [],
    blocked: [],
    allowListUrls: [],
    blockListUrls: [],
    allowedRegex: [],
    blockedRegex: [],
    regexAllowListUrls: [],
    regexBlockListUrls: [],
    adblockListUrls: [],
    ...over,
  }
}

function doc(over: Record<string, unknown> = {}) {
  return JSON.stringify({ networkGroupMap: { '0.0.0.0/0': 'kids' }, groups: [group()], ...over })
}

function open(text: string | null): EditorModel {
  const r = openConfig(text)
  if (r.kind !== 'editable') throw new Error(`refused: ${r.reason} (${r.where})`)
  return r.model
}

function refusal(text: string | null) {
  const r = openConfig(text)
  if (r.kind !== 'refused') throw new Error(`expected a refusal for ${text}`)
  return r
}

describe('openConfig refuses, and says where', () => {
  it('an empty text', () => {
    expect(refusal('').reason).toMatch(/empty/i)
  })

  it('null', () => {
    expect(refusal(null).reason).toMatch(/empty/i)
  })

  it('what is not JSON', () => {
    const r = refusal('{\n\n  nope\n}')
    expect(r.reason).toMatch(/line 3/i)
    expect(r.where).toBe('line 3')
  })

  it('comments', () => {
    const r = refusal('{\n// note\n"groups":[],"networkGroupMap":{}}')
    expect(r.reason).toMatch(/line 2/i)
    expect(r.reason).toMatch(/comment/i)
    expect(r.where).toBe('line 2')
  })

  it('a trailing comma', () => {
    const r = refusal('{"groups":[],\n"networkGroupMap":{},\n}')
    expect(r.reason).toMatch(/line 2/i)
    expect(r.reason).toMatch(/trailing comma/i)
  })

  it('a root that is not an object', () => {
    const r = refusal('[]')
    expect(r.reason).toMatch(/object/i)
    expect(r.where).toBe('the top level')
  })

  it('a repeated key', () => {
    const r = refusal('{"groups":[],\n"groups":[],"networkGroupMap":{}}')
    expect(r.reason).toMatch(/line 2/i)
    expect(r.reason).toContain('"groups"')
  })

  it('a missing groups', () => {
    const r = refusal('{"networkGroupMap":{}}')
    expect(r.reason).toContain('groups')
    expect(r.where).toBe('groups')
  })

  it('a missing networkGroupMap', () => {
    const r = refusal('{"groups":[]}')
    expect(r.reason).toContain('networkGroupMap')
    expect(r.where).toBe('networkGroupMap')
  })

  it('enableBlocking of another type', () => {
    const r = refusal(doc({ enableBlocking: 'yes' }))
    expect(r.reason).toContain('enableBlocking')
    expect(r.where).toBe('enableBlocking')
  })

  it.each([
    ['blockingAnswerTtl', 1.5],
    ['blockingAnswerTtl', -1],
    ['blockingAnswerTtl', 4294967296],
    ['blockingAnswerTtl', '30'],
    ['blockListUrlUpdateIntervalHours', 2147483648],
    ['blockListUrlUpdateIntervalMinutes', 1.5],
  ])('%s of %s', (key, value) => {
    const r = refusal(doc({ [key]: value }))
    expect(r.reason).toContain(key)
    expect(r.where).toBe(key)
  })

  it('a number written with an exponent or a fraction', () => {
    expect(refusal('{"blockingAnswerTtl":1e1,"groups":[],"networkGroupMap":{}}').where).toBe('blockingAnswerTtl')
    expect(refusal('{"blockingAnswerTtl":30.0,"groups":[],"networkGroupMap":{}}').where).toBe('blockingAnswerTtl')
  })

  it('a map of another type', () => {
    expect(refusal(doc({ networkGroupMap: null })).where).toBe('networkGroupMap')
    expect(refusal(doc({ networkGroupMap: [] })).where).toBe('networkGroupMap')
    expect(refusal(doc({ localEndPointGroupMap: [] })).where).toBe('localEndPointGroupMap')
    expect(refusal(doc({ groups: {} })).where).toBe('groups')
  })

  it('a map value that is neither text nor null', () => {
    expect(refusal(doc({ networkGroupMap: { '0.0.0.0/0': 1 } })).where).toBe('networkGroupMap["0.0.0.0/0"]')
  })

  it('a group that is not an object', () => {
    expect(refusal(doc({ groups: [1] })).where).toBe('groups[0]')
  })

  it('allowed: [1]', () => {
    const r = refusal(doc({ groups: [group({ allowed: [1] })] }))
    expect(r.reason).toContain('groups[0].allowed[0]')
    expect(r.where).toBe('groups[0].allowed[0]')
  })

  it.each([
    ['a line break', 'a\nb'],
    ['a carriage return', 'a\rb'],
    ['a leading space', ' a'],
    ['a trailing space', 'a '],
    ['nothing', ''],
  ])('allowed holding %s', (_, value) => {
    const r = refusal(doc({ groups: [group({ allowed: ['ok.example', value] })] }))
    expect(r.reason).toContain('groups[0].allowed[1]')
    expect(r.where).toBe('groups[0].allowed[1]')
  })

  it('a text list of another type', () => {
    expect(refusal(doc({ groups: [group({ blocked: 'x' })] })).where).toBe('groups[0].blocked')
  })

  it('group blockingAddresses that the box could not give back', () => {
    expect(refusal(doc({ groups: [group({ blockingAddresses: [' 1.2.3.4'] })] })).where).toBe('groups[0].blockingAddresses[0]')
    expect(refusal(doc({ groups: [group({ blockingAddresses: null })] })).where).toBe('groups[0].blockingAddresses')
  })

  it('a group name of another type', () => {
    const r = refusal(doc({ groups: [group({ name: 3 })] }))
    expect(r.reason).toContain('groups[0].name')
    expect(r.where).toBe('groups[0].name')
  })

  it('a group with no name', () => {
    const g: Record<string, unknown> = group()
    delete g.name
    expect(refusal(doc({ groups: [g] })).where).toBe('groups[0].name')
  })

  it('a group flag of another type', () => {
    expect(refusal(doc({ groups: [group({ blockAsNxDomain: null })] })).where).toBe('groups[0].blockAsNxDomain')
  })

  it('a URL of 5', () => {
    const r = refusal(doc({ groups: [group({ blockListUrls: [5] })] }))
    expect(r.reason).toContain('groups[0].blockListUrls[0]')
    expect(r.where).toBe('groups[0].blockListUrls[0]')
  })

  it('a URL object with no url', () => {
    const r = refusal(doc({ groups: [group({ adblockListUrls: [{ blockAsNxDomain: true }] })] }))
    expect(r.reason).toContain('groups[0].adblockListUrls[0]')
    expect(r.where).toBe('groups[0].adblockListUrls[0]')
  })

  it('an object inside allowListUrls', () => {
    const r = refusal(doc({ groups: [group({ allowListUrls: [{ url: 'https://x/' }] })] }))
    expect(r.reason).toContain('groups[0].allowListUrls[0]')
  })

  it('a URL object whose own answer has another type', () => {
    expect(refusal(doc({ groups: [group({ blockListUrls: [{ url: 'https://x/', blockAsNxDomain: 'no' }] })] })).where).toBe('groups[0].blockListUrls[0].blockAsNxDomain')
    expect(refusal(doc({ groups: [group({ blockListUrls: [{ url: 'https://x/', blockingAddresses: null }] })] })).where).toBe('groups[0].blockListUrls[0].blockingAddresses')
    expect(refusal(doc({ groups: [group({ blockListUrls: [{ url: 'https://x/', blockingAddresses: [' a'] }] })] })).where).toBe('groups[0].blockListUrls[0].blockingAddresses[0]')
  })
})

describe('openConfig opens', () => {
  it('every file of the corpus', () => {
    const names = Object.keys(corpus)
    expect(names.length).toBe(11)
    for (const name of names) {
      const r = openConfig(corpus[name])
      expect(r.kind, r.kind === 'refused' ? `${name}: ${r.reason}` : name).toBe('editable')
    }
  })

  /* Measured on a v11.2.1 server: both of these load, and networkGroupMap null does not. */
  it('a null groups or localEndPointGroupMap, as empty', () => {
    const m = open(doc({ groups: null, localEndPointGroupMap: null }))
    expect(m.groups).toEqual([])
    expect(m.rows.map((r) => r.map)).toEqual(['networkGroupMap'])
  })

  it('a group missing a list, as empty', () => {
    const g: Record<string, unknown> = group()
    delete g.allowed
    expect(open(doc({ groups: [g] })).groups[0].text.allowed).toBe('')
  })

  it('null lists, as empty', () => {
    const m = open(doc({ groups: [group({ allowed: null, blockListUrls: null })] }))
    expect(m.groups[0].text.allowed).toBe('')
    expect(m.groups[0].lists).toEqual([])
  })

  it('text lists as one value per line', () => {
    const m = open(doc({ groups: [group({ blocked: ['a.example', 'b.example'], blockedRegex: ['^x'] })] }))
    expect(m.groups[0].text.blocked).toBe('a.example\nb.example')
    expect(m.groups[0].text.blockedRegex).toBe('^x')
  })

  it('a dangling reference, in missingGroup', () => {
    const m = open(doc({ networkGroupMap: { '10.0.0.0/8': 'nobody' } }))
    expect(m.rows[0]).toMatchObject({ address: '10.0.0.0/8', groupId: null, missingGroup: 'nobody', loaded: true })
  })

  it('a null reference, as the empty name the server reads (App.cs:384)', () => {
    const m = open(doc({ networkGroupMap: { '10.0.0.0/8': null } }))
    expect(m.rows[0]).toMatchObject({ groupId: null, missingGroup: '' })
  })

  it('a reference bound by id to its group', () => {
    const m = open(doc())
    expect(m.rows[0]).toMatchObject({ groupId: m.groups[0].id, missingGroup: null, loaded: true })
  })

  it('rows with endpoints first, each block in file order', () => {
    const m = open(doc({
      networkGroupMap: { '10.0.0.2': 'kids', '10.0.0.1': 'kids' },
      localEndPointGroupMap: { 'b.example': 'kids', 'a.example': 'kids' },
    }))
    expect(m.rows.map((r) => r.address)).toEqual(['b.example', 'a.example', '10.0.0.2', '10.0.0.1'])
    expect(m.rows.map((r) => r.map)).toEqual(['localEndPointGroupMap', 'localEndPointGroupMap', 'networkGroupMap', 'networkGroupMap'])
  })

  it('keys that look like numbers in file order too', () => {
    const m = open('{"networkGroupMap":{"10":"a","1":"a"},"groups":[]}')
    expect(m.rows.map((r) => r.address)).toEqual(['10', '1'])
  })

  it('what is not a list of the app, in unknownKeys, in file order', () => {
    const m = open(doc({ groups: [group({ notes: 'x', a: 1 })] }))
    expect(m.groups[0].unknownKeys).toEqual(['notes', 'a'])
  })

  it('every id unique', () => {
    const m = open(doc({
      networkGroupMap: { '10.0.0.1': 'kids', '10.0.0.2': 'kids' },
      groups: [group({ blockListUrls: ['https://a/', 'https://b/'] }), group({ name: 'x', adblockListUrls: ['https://a/'] })],
    }))
    const ids = [...m.rows.map((r) => r.id), ...m.groups.map((g) => g.id), ...m.groups.flatMap((g) => g.lists.map((l) => l.id))]
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('the defaults of the server when a value is absent (App.cs:358-361, :893-895)', () => {
    const m = open(doc())
    expect(m).toMatchObject({ enabled: true, ttl: '30', hours: '24', minutes: '0' })
    expect(m.groups[0]).toMatchObject({ enabled: true, txtReport: true, nxDomain: false, addresses: '' })
  })

  it('what the file says when a value is present', () => {
    const m = open(doc({
      enableBlocking: false,
      blockingAnswerTtl: 7,
      blockListUrlUpdateIntervalHours: 0,
      blockListUrlUpdateIntervalMinutes: 15,
      groups: [group({ enableBlocking: false, allowTxtBlockingReport: false, blockAsNxDomain: true, blockingAddresses: ['1.2.3.4', '::'] })],
    }))
    expect(m).toMatchObject({ enabled: false, ttl: '7', hours: '0', minutes: '15' })
    expect(m.groups[0]).toMatchObject({ enabled: false, txtReport: false, nxDomain: true, addresses: '1.2.3.4\n::' })
  })

  it('an interval the server parses even if it is negative (JsonExtensions GetInt32)', () => {
    expect(open(doc({ blockListUrlUpdateIntervalHours: -1 })).hours).toBe('-1')
  })

  it('lists of every kind, with their own answer', () => {
    const m = open(doc({
      groups: [group({
        allowListUrls: ['https://allow/'],
        regexAllowListUrls: ['https://rallow/'],
        blockListUrls: ['https://plain/', { url: 'https://nx/', blockAsNxDomain: true }, { url: 'https://own/', blockAsNxDomain: false, blockingAddresses: ['1.2.3.4', '::1'] }, { url: 'https://only/', blockingAddresses: ['1.1.1.1'] }, { url: 'https://bare/' }],
        regexBlockListUrls: ['https://rblock/'],
        adblockListUrls: [{ url: 'https://ad/', note: 'kept' }],
      })],
    }))
    const rows = m.groups[0].lists
    expect(rows.map((l) => [l.kind, l.url, l.answer, l.addresses])).toEqual([
      ['blockListUrls', 'https://plain/', 'group', ''],
      ['blockListUrls', 'https://nx/', 'nx', ''],
      ['blockListUrls', 'https://own/', 'addresses', '1.2.3.4\n::1'],
      ['blockListUrls', 'https://only/', 'addresses', '1.1.1.1'],
      ['blockListUrls', 'https://bare/', 'group', ''],
      ['regexBlockListUrls', 'https://rblock/', 'group', ''],
      ['adblockListUrls', 'https://ad/', 'group', ''],
      ['allowListUrls', 'https://allow/', 'group', ''],
      ['regexAllowListUrls', 'https://rallow/', 'group', ''],
    ])
    expect(rows.every((l) => l.node !== null)).toBe(true)
  })

  it('a config with a repeated group name, so the validation can say so', () => {
    const m = open(doc({ groups: [group(), group()] }))
    expect(m.groups.map((g) => g.loadedIndex)).toEqual([0, 1])
  })

  it('reads an escaped key and value by what they mean', () => {
    const m = open('{"networkGroupMap":{"\\u0031.1.1.1":"k\\u0069ds"},"groups":[{"name":"kids"}]}')
    expect(m.rows[0].address).toBe('1.1.1.1')
    expect(m.rows[0].groupId).toBe(m.groups[0].id)
  })
})
