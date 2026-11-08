import { describe, expect, it } from 'vitest'
import {
  addGroup,
  addList,
  addRow,
  deleteGroup,
  openConfig,
  setGeneral,
  setGroup,
  setList,
  setRow,
  type EditorModel,
} from './config-model'
import { blocking, validate, type Problem } from './validate'

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

function config(over: Record<string, unknown> = {}): string {
  return JSON.stringify({ networkGroupMap: { '0.0.0.0/0': 'kids' }, groups: [group()], ...over })
}

function open(text: string): EditorModel {
  const r = openConfig(text)
  if (r.kind !== 'editable') throw new Error(`refused: ${r.reason}`)
  return r.model
}

const model = (over: Record<string, unknown> = {}) => open(config(over))

function at(problems: Problem[], target: string, field: string, severity?: Problem['severity']): Problem[] {
  return problems.filter((p) => p.target === target && p.field === field && (severity === undefined || p.severity === severity))
}

function newRow(m: EditorModel, map: 'networkGroupMap' | 'localEndPointGroupMap', address: string, groupId?: string | null) {
  const added = addRow(m, map)
  const r = added.rows.filter((x) => !x.loaded && x.address === '').at(-1) as { id: string }
  return { model: setRow(added, r.id, { address, groupId: groupId === undefined ? added.groups[0].id : groupId }), id: r.id }
}

describe('a config with nothing wrong', () => {
  it('has no problems', () => {
    expect(validate(model())).toEqual([])
  })
})

describe('the spec table', () => {
  it.each([
    ['[::]/0', false], ['10.1', false], ['0.0.0.0/0', false], ['192.168.300.0/24', true], ['1.2.3.4/33', true], ['a/b', true], ['', true],
  ] as const)('client network %s', (address, bad) => {
    const m = newRow(model({ networkGroupMap: {} }), 'networkGroupMap', address)
    expect(at(validate(m.model), m.id, 'address', 'error').length > 0).toBe(bad)
  })

  it.each([
    ['127.0.0.1', false], ['192.168.10.2:53', false], ['[::1]:53', false], ['user1.dot.example.com', false], ['user2.doh.example.com:443', false], ['a:b:c', true], ['name:99999', true],
  ] as const)('endpoint %s', (address, bad) => {
    const m = newRow(model(), 'localEndPointGroupMap', address)
    expect(at(validate(m.model), m.id, 'address', 'error').length > 0).toBe(bad)
  })

  it('a repeated network, compared normalised, is an error on both rows', () => {
    const base = newRow(model({ networkGroupMap: {} }), 'networkGroupMap', '10.0.0.1')
    const m = newRow(base.model, 'networkGroupMap', '10.0.0.1/32')
    const problems = validate(m.model)
    expect(at(problems, base.id, 'address', 'error').length).toBe(1)
    expect(at(problems, m.id, 'address', 'error').length).toBe(1)
  })

  it('a repeated endpoint, compared normalised, is an error', () => {
    const base = newRow(model(), 'localEndPointGroupMap', '127.0.0.1')
    const m = newRow(base.model, 'localEndPointGroupMap', '127.0.0.1:0')
    expect(at(validate(m.model), m.id, 'address', 'error').length).toBe(1)
  })

  it('the same text in the two maps is no repetition', () => {
    const base = newRow(model(), 'localEndPointGroupMap', '10.0.0.1')
    const m = newRow(base.model, 'networkGroupMap', '10.0.0.1')
    expect(at(validate(m.model), m.id, 'address').length).toBe(0)
  })

  it('a new row starts without a group, which is an error', () => {
    const m = newRow(model(), 'networkGroupMap', '10.0.0.1', null)
    expect(at(validate(m.model), m.id, 'group', 'error').length).toBe(1)
  })

  it('a group name must not be empty', () => {
    const m = addGroup(model())
    expect(at(validate(setGroup(m.model, m.id, { name: '' })), m.id, 'name', 'error').length).toBe(1)
  })

  it('a group name must be unique, and it is an error on both', () => {
    const m = addGroup(model())
    const problems = validate(setGroup(m.model, m.id, { name: 'kids' }))
    expect(at(problems, m.id, 'name', 'error').length).toBe(1)
    expect(at(problems, m.model.groups[0].id, 'name', 'error').length).toBe(1)
  })

  it('a group name is compared with its case', () => {
    const m = addGroup(model())
    expect(at(validate(setGroup(m.model, m.id, { name: 'KIDS' })), m.id, 'name').length).toBe(0)
  })

  it('a blocking address must be an IP', () => {
    const m = model()
    const edited = setGroup(m, m.groups[0].id, { addresses: '1.2.3.4\nnope' })
    expect(at(validate(edited), m.groups[0].id, 'addresses', 'error').length).toBe(1)
    expect(validate(setGroup(m, m.groups[0].id, { addresses: '1.2.3.4\n::' }))).toEqual([])
  })

  it.each([
    ['https://x/y', false], ['/etc/dns/a.txt', false], ['C:\\lists\\a.txt', false], ['example.com/a', true], ['hosts.txt', true], ['', true],
  ] as const)('list URL "%s"', (url, bad) => {
    const m = model()
    const added = addList(m, m.groups[0].id, 'blockListUrls', url)
    expect(at(validate(added), added.groups[0].lists[0].id, 'url', 'error').length > 0).toBe(bad)
  })

  it('a repeated URL in one list is an error, on both', () => {
    let m = model()
    m = addList(m, m.groups[0].id, 'blockListUrls', 'https://x/a')
    m = addList(m, m.groups[0].id, 'blockListUrls', 'https://x/a')
    const problems = validate(m)
    for (const l of m.groups[0].lists) expect(at(problems, l.id, 'url', 'error').length).toBe(1)
  })

  it('a repeated URL across two lists is not', () => {
    let m = model()
    m = addList(m, m.groups[0].id, 'blockListUrls', 'https://x/a')
    m = addList(m, m.groups[0].id, 'adblockListUrls', 'https://x/a')
    expect(validate(m)).toEqual([])
  })

  it('a repeated URL in two groups is not', () => {
    let m = model({ groups: [group(), group({ name: 'other' })] })
    m = addList(m, m.groups[0].id, 'blockListUrls', 'https://x/a')
    m = addList(m, m.groups[1].id, 'blockListUrls', 'https://x/a')
    expect(validate(m)).toEqual([])
  })

  it.each([['0', false], ['4294967295', false], ['4294967296', true], ['-1', true], ['1.5', true], ['', true], ['abc', true]] as const)('ttl %s', (ttl, bad) => {
    expect(at(validate(setGeneral(model(), { ttl })), 'general', 'ttl', 'error').length > 0).toBe(bad)
  })

  it.each([['0', false], ['2147483647', false], ['2147483648', true], ['-1', true], ['1.5', true], ['', true]] as const)('hours and minutes %s', (v, bad) => {
    expect(at(validate(setGeneral(model(), { hours: v, minutes: '5' })), 'general', 'hours', 'error').length > 0).toBe(bad)
    expect(at(validate(setGeneral(model(), { hours: '5', minutes: v })), 'general', 'minutes', 'error').length > 0).toBe(bad)
  })

  it('hours and minutes both 0 is a warning', () => {
    const problems = validate(setGeneral(model(), { hours: '0', minutes: '0' }))
    expect(blocking(problems)).toEqual([])
    expect(problems.filter((p) => p.target === 'general' && p.severity === 'warning').length).toBe(1)
  })

  it('a domain with capitals is a warning', () => {
    const m = model()
    const problems = validate(setGroup(m, m.groups[0].id, { text: { ...m.groups[0].text, blocked: 'Example.COM' } }))
    expect(at(problems, m.groups[0].id, 'blocked', 'warning').length).toBe(1)
    expect(blocking(problems)).toEqual([])
  })

  it.each(['https://x.example', 'x.example/path', 'x example'])('a domain like %s is a warning', (line) => {
    const m = model()
    const problems = validate(setGroup(m, m.groups[0].id, { text: { ...m.groups[0].text, allowed: line } }))
    expect(at(problems, m.groups[0].id, 'allowed', 'warning').length).toBe(1)
  })

  it('a regex JS cannot compile is a warning', () => {
    const m = model()
    const problems = validate(setGroup(m, m.groups[0].id, { text: { ...m.groups[0].text, blockedRegex: '(unclosed' } }))
    expect(at(problems, m.groups[0].id, 'blockedRegex', 'warning').length).toBe(1)
    expect(blocking(problems)).toEqual([])
  })
})

describe('loaded and untouched is spared', () => {
  const dangling = () => open(config({ networkGroupMap: { '10.0.0.0/8': 'gone' } }))

  it('a loaded row with a missing group is a warning', () => {
    const m = dangling()
    expect(at(validate(m), m.rows[0].id, 'group', 'warning').length).toBe(1)
    expect(blocking(validate(m))).toEqual([])
  })

  it('the same after setRow with groupId null is an error', () => {
    const m = dangling()
    expect(at(validate(setRow(m, m.rows[0].id, { groupId: null })), m.rows[0].id, 'group', 'error').length).toBe(1)
  })

  it('the same after deleteGroup is an error', () => {
    const m = model()
    const out = deleteGroup(m, m.groups[0].id)
    expect(at(validate(out), out.rows[0].id, 'group', 'error').length).toBe(1)
  })

  it('a loaded row keeps its warning when only its address is edited', () => {
    const m = dangling()
    const out = setRow(m, m.rows[0].id, { address: '11.0.0.0/8' })
    expect(at(validate(out), m.rows[0].id, 'group', 'warning').length).toBe(1)
  })

  it('a dangling reference does not block an unrelated edit', () => {
    const m = dangling()
    expect(blocking(validate(setGeneral(m, { ttl: '60' })))).toEqual([])
  })

  it('a dangling reference blocks when a group now has that name', () => {
    const m = dangling()
    const out = setGroup(m, m.groups[0].id, { name: 'gone' })
    expect(at(validate(out), m.rows[0].id, 'group', 'error').length).toBe(1)
  })

  it('a loaded empty group name is a warning, edited it is an error', () => {
    const m = open(config({ groups: [group({ name: '' }), group({ name: 'x' })], networkGroupMap: {} }))
    expect(at(validate(m), m.groups[0].id, 'name', 'warning').length).toBe(1)
    expect(blocking(validate(m))).toEqual([])
    expect(at(validate(setGroup(m, m.groups[1].id, { name: '' })), m.groups[1].id, 'name', 'error').length).toBe(1)
  })

  it('a loaded address that is not an IP is a warning, edited it is an error', () => {
    const m = model({ groups: [group({ blockingAddresses: ['nope'] })] })
    expect(at(validate(m), m.groups[0].id, 'addresses', 'warning').length).toBe(1)
    expect(blocking(validate(m))).toEqual([])
    expect(at(validate(setGroup(m, m.groups[0].id, { addresses: 'bad' })), m.groups[0].id, 'addresses', 'error').length).toBe(1)
  })

  it('an old bad address stays a warning beside a new good one', () => {
    const m = model({ groups: [group({ blockingAddresses: ['nope'] })] })
    const problems = validate(setGroup(m, m.groups[0].id, { addresses: 'nope\n1.2.3.4' }))
    expect(at(problems, m.groups[0].id, 'addresses', 'error')).toEqual([])
    expect(at(problems, m.groups[0].id, 'addresses', 'warning').length).toBe(1)
  })

  it('a bad address typed beside an old bad one is an error, and the old one still a warning', () => {
    const m = model({ groups: [group({ blockingAddresses: ['nope'] })] })
    const problems = validate(setGroup(m, m.groups[0].id, { addresses: 'nope\nworse' }))
    expect(at(problems, m.groups[0].id, 'addresses', 'error').length).toBe(1)
    expect(at(problems, m.groups[0].id, 'addresses', 'warning').length).toBe(1)
  })

  it('a loaded address of a list that is not an IP is a warning, edited it is an error', () => {
    const m = model({ groups: [group({ blockListUrls: [{ url: 'https://x/', blockAsNxDomain: false, blockingAddresses: ['nope'] }] })] })
    const list = m.groups[0].lists[0]
    expect(at(validate(m), list.id, 'addresses', 'warning').length).toBe(1)
    expect(blocking(validate(m))).toEqual([])
    expect(at(validate(setList(m, m.groups[0].id, list.id, { addresses: 'bad' })), list.id, 'addresses', 'error').length).toBe(1)
  })

  it('an address nobody can see is not checked', () => {
    const m = model({ groups: [group({ blockListUrls: [{ url: 'https://x/', blockAsNxDomain: true, blockingAddresses: ['nope'] }] })] })
    expect(at(validate(m), m.groups[0].lists[0].id, 'addresses')).toEqual([])
  })

  it('a group that answers NXDOMAIN has no blocking error on its disabled box', () => {
    const m = model()
    const out = setGroup(m, m.groups[0].id, { nxDomain: true, addresses: 'bad' })
    expect(at(validate(out), m.groups[0].id, 'addresses', 'error')).toEqual([])
    expect(at(validate(out), m.groups[0].id, 'addresses', 'warning').length).toBe(1)
  })

  it('a loaded negative interval is a warning, edited it is an error', () => {
    const m = model({ blockListUrlUpdateIntervalHours: -1 })
    expect(at(validate(m), 'general', 'hours', 'warning').length).toBe(1)
    expect(blocking(validate(m))).toEqual([])
    expect(at(validate(setGeneral(m, { hours: '-2' })), 'general', 'hours', 'error').length).toBe(1)
  })

  it('a repeated group name blocks even if loaded and untouched', () => {
    const m = model({ groups: [group(), group()] })
    expect(blocking(validate(m)).length).toBe(2)
  })

  it('an unparsable loaded network blocks', () => {
    const m = model({ networkGroupMap: { nope: 'kids' } })
    expect(at(validate(m), m.rows[0].id, 'address', 'error').length).toBe(1)
  })

  it('a relative loaded URL blocks', () => {
    const m = model({ groups: [group({ blockListUrls: ['hosts.txt'] })] })
    expect(at(validate(m), m.groups[0].lists[0].id, 'url', 'error').length).toBe(1)
  })
})

describe('the review focus', () => {
  it('typing an address equal to another row flags the duplicate and keeps both', () => {
    const m = model({ networkGroupMap: { '10.0.0.1': 'kids', '10.0.0.2': 'kids' } })
    const out = setRow(m, m.rows[1].id, { address: '10.0.0.1' })
    expect(out.rows.length).toBe(2)
    expect(at(validate(out), out.rows[0].id, 'address', 'error').length).toBe(1)
    expect(at(validate(out), out.rows[1].id, 'address', 'error').length).toBe(1)
  })

  it('two empty new rows are both flagged', () => {
    for (const map of ['networkGroupMap', 'localEndPointGroupMap'] as const) {
      const m = addRow(addRow(model(), map), map)
      const added = m.rows.filter((r) => !r.loaded)
      const problems = validate(m)
      expect(added.length).toBe(2)
      for (const r of added) expect(at(problems, r.id, 'address', 'error').length).toBe(1)
    }
  })
})

describe('the shape the page reads', () => {
  it('rows say address or group, in the section clients', () => {
    const m = newRow(model(), 'networkGroupMap', 'bad', null)
    const problems = validate(m.model)
    expect(at(problems, m.id, 'address')[0]).toMatchObject({ severity: 'error', section: 'clients' })
    expect(at(problems, m.id, 'group')[0]).toMatchObject({ severity: 'error', section: 'clients' })
  })

  it('groups say name, addresses or a text list, in the section of the group id', () => {
    const m = model()
    const id = m.groups[0].id
    const problems = validate(setGroup(m, id, {
      name: '',
      addresses: 'bad',
      text: { allowed: 'A', blocked: 'B', allowedRegex: '(', blockedRegex: '(' },
    }))
    for (const field of ['name', 'addresses', 'allowed', 'blocked', 'allowedRegex', 'blockedRegex']) {
      expect(at(problems, id, field)[0], field).toMatchObject({ section: id })
    }
  })

  it('lists say url or addresses, in the section of the group id', () => {
    let m = model()
    const g = m.groups[0].id
    m = addList(m, g, 'blockListUrls', 'bad')
    const l = m.groups[0].lists[0].id
    m = setList(m, g, l, { answer: 'addresses', addresses: 'bad' })
    const problems = validate(m)
    expect(at(problems, l, 'url')[0]).toMatchObject({ section: g })
    expect(at(problems, l, 'addresses')[0]).toMatchObject({ section: g })
  })

  it('general says ttl, hours or minutes, with the target general', () => {
    const problems = validate(setGeneral(model(), { ttl: 'x', hours: 'x', minutes: 'x' }))
    for (const field of ['ttl', 'hours', 'minutes']) {
      expect(at(problems, 'general', field)[0], field).toMatchObject({ section: 'general' })
    }
  })

  it('come in page order: clients, each group, general', () => {
    let m = model({ groups: [group(), group({ name: 'other' })] })
    m = setGeneral(m, { ttl: 'x' })
    m = setGroup(m, m.groups[1].id, { name: '' })
    m = setGroup(m, m.groups[0].id, { name: '' })
    m = newRow(m, 'networkGroupMap', 'bad').model
    const sections = validate(m).map((p) => p.section)
    expect(sections).toEqual(['clients', m.groups[0].id, m.groups[1].id, 'general'])
  })

  it('blocking keeps only the errors', () => {
    const list: Problem[] = [
      { target: 'a', field: 'f', message: 'm', severity: 'warning', section: 's' },
      { target: 'b', field: 'f', message: 'm', severity: 'error', section: 's' },
    ]
    expect(blocking(list).map((p) => p.target)).toEqual(['b'])
  })

  it('every message has words', () => {
    const m = newRow(model(), 'networkGroupMap', 'bad', null)
    expect(validate(m.model).every((p) => p.message.length > 5)).toBe(true)
  })
})

/* Each config was sent with apps/config/set to a real v11.2.1 server. `blocks` says
   whether the console refuses to save it; the column says what the server did. */
describe('as a v11.2.1 server answered', () => {
  const OK = false
  const REFUSED = true
  const net = (...keys: string[]) => ({ networkGroupMap: Object.fromEntries(keys.map((k) => [k, 'kids'])) })
  const ep = (...keys: string[]) => ({ localEndPointGroupMap: Object.fromEntries(keys.map((k) => [k, 'kids'])) })
  const blockLists = (...urls: unknown[]) => ({ groups: [group({ blockListUrls: urls })] })
  const url = 'https://example.invalid/a.txt'

  const cases: [string, Record<string, unknown>, boolean][] = [
    ['network 10.1', net('10.1'), OK],
    ['network 0x0a.0.0.1', net('0x0a.0.0.1'), OK],
    ['network 010.0.0.1', net('010.0.0.1'), OK],
    ['network [::]/0', net('[::]/0'), OK],
    ['network ::ffff:1.2.3.4', net('::ffff:1.2.3.4'), OK],
    ['network 1.2.3.5/24', net('1.2.3.5/24'), OK],
    ['network 1.2.3.4/255', net('1.2.3.4/255'), OK],
    ['network ::1/255', net('::1/255'), OK],
    ['network 1.2.3.4/33', net('1.2.3.4/33'), REFUSED],
    ['network 1.2.3.4/', net('1.2.3.4/'), REFUSED],
    ['network ::1/129', net('::1/129'), REFUSED],
    ['network 256.1.1.1', net('256.1.1.1'), REFUSED],
    ['network example.com', net('example.com'), REFUSED],
    ['network with a leading space', net(' 1.2.3.4'), REFUSED],
    ['network with a trailing space', net('1.2.3.4 '), REFUSED],
    ['network empty', net(''), REFUSED],
    ['networks 10.0.0.1 and 10.0.0.1/32', net('10.0.0.1', '10.0.0.1/32'), REFUSED],
    ['networks ::1 and [::1]', net('::1', '[::1]'), REFUSED],
    ['networks 10.0.0.1/24 and 10.0.0.2/24', net('10.0.0.1/24', '10.0.0.2/24'), REFUSED],
    ['endpoint 127.0.0.1', ep('127.0.0.1'), OK],
    ['endpoint [::1]:53', ep('[::1]:53'), OK],
    ['endpoint ::1:53', ep('::1:53'), OK],
    ['endpoint name.example.com:443', ep('name.example.com:443'), OK],
    ['endpoint name_x.example.com', ep('name_x.example.com'), OK],
    ['endpoint -bad.example.com', ep('-bad.example.com'), OK],
    ['endpoint empty, loaded', ep(''), OK],
    ['endpoint name.example.com:99999', ep('name.example.com:99999'), REFUSED],
    ['endpoint a..b', ep('a..b'), REFUSED],
    ['endpoint with a trailing dot', ep('name.example.com.'), REFUSED],
    ['endpoint a:b:c', ep('a:b:c'), REFUSED],
    ['endpoints that differ in case', ep('NAME.example.com', 'name.example.com'), OK],
    ['endpoints 127.0.0.1 and 127.0.0.1:0', ep('127.0.0.1', '127.0.0.1:0'), REFUSED],
    ['network value of a group that does not exist', { networkGroupMap: { '10.0.0.0/8': 'none' } }, OK],
    ['endpoint value of a group that does not exist', { localEndPointGroupMap: { 'a.example': 'none' } }, OK],
    ['network value empty', { networkGroupMap: { '10.0.0.0/8': '' } }, OK],
    ['network value null', { networkGroupMap: { '10.0.0.0/8': null } }, OK],
    ['endpoint value empty', { localEndPointGroupMap: { 'a.example': '' } }, OK],
    ['endpoint value null', { localEndPointGroupMap: { 'a.example': null } }, OK],
    ['group name empty', { groups: [group(), group({ name: '' })] }, OK],
    ['two groups named g', { groups: [group({ name: 'g' }), group({ name: 'g' })] }, REFUSED],
    ['groups named G and g', { groups: [group({ name: 'G' }), group({ name: 'g' })] }, OK],
    ['blockingAddresses that is not an IP', { groups: [group({ blockingAddresses: ['not-an-ip'] })] }, OK],
    ['list example.com/a', blockLists('example.com/a'), REFUSED],
    ['list a.txt', blockLists('a.txt'), REFUSED],
    ['list /nonexistent/a.txt', blockLists('/nonexistent/a.txt'), OK],
    ['list file:///nonexistent/a.txt', blockLists('file:///nonexistent/a.txt'), OK],
    ['list C:\\nonexistent\\a.txt', blockLists('C:\\nonexistent\\a.txt'), OK],
    ['list ftp://example.invalid/a', blockLists('ftp://example.invalid/a'), OK],
    ['list with a space', blockLists('https://example.invalid/a b'), OK],
    ['list empty', blockLists(''), REFUSED],
    ['one URL twice, the host in capitals', blockLists('https://EXAMPLE.invalid/a.txt', url), REFUSED],
    ['one URL twice', blockLists(url, url), REFUSED],
    ['one URL in two kinds of list', { groups: [group({ blockListUrls: [url], adblockListUrls: [url] })] }, OK],
    ['one URL twice in allowListUrls', { groups: [group({ allowListUrls: [url, url] })] }, REFUSED],
    ['one URL twice in regexBlockListUrls', { groups: [group({ regexBlockListUrls: [url, url] })] }, REFUSED],
    ['URL object with an address that is not an IP', blockLists({ url, blockingAddresses: ['x'] }), OK],
    ['URL object with an unknown property', blockLists({ url, extra: 1 }), OK],
    ['ttl 0', { blockingAnswerTtl: 0 }, OK],
    ['ttl 4294967295', { blockingAnswerTtl: 4294967295 }, OK],
    ['hours 0', { blockListUrlUpdateIntervalHours: 0, blockListUrlUpdateIntervalMinutes: 5 }, OK],
    ['hours -1', { blockListUrlUpdateIntervalHours: -1 }, OK],
    ['hours 2147483647', { blockListUrlUpdateIntervalHours: 2147483647 }, OK],
    ['hours and minutes both 0', { blockListUrlUpdateIntervalHours: 0, blockListUrlUpdateIntervalMinutes: 0 }, OK],
    ['groups []', { groups: [], networkGroupMap: {} }, OK],
    ['groups null', { groups: null, networkGroupMap: {} }, OK],
    ['localEndPointGroupMap null', { localEndPointGroupMap: null }, OK],
    ['an unknown top-level property', { extra: true }, OK],
  ]

  it.each(cases)('%s', (_label, over, blocked) => {
    expect(blocking(validate(open(config(over)))).length > 0).toBe(blocked)
  })

  /* The server compiles these with .NET: valid there, whatever the browser thinks. And
     (unclosed and a{2,1} are refused by it, which the save reports: the spec leaves
     every regex to the server. */
  it.each(['(?<name>a)', '(?i)a', '(?>a)', '\\p{L}+', '(unclosed', 'a{2,1}'])('regex %s never blocks', (regex) => {
    expect(blocking(validate(open(config({ groups: [group({ blockedRegex: [regex] })] }))))).toEqual([])
  })
})
