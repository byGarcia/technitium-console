import { describe, expect, it } from 'vitest'
import { compileNameFilter, filterBy } from './filter'
import type { ResourceRecord } from '../../api/records'

function rec(name: string, type: string): ResourceRecord {
  return {
    name,
    type,
    ttl: 3600,
    ttlString: '1h',
    disabled: false,
    rData: {},
    dnssecStatus: 'Unknown',
    lastUsedOn: '0001-01-01T00:00:00',
    lastModified: '2026-08-26T10:00:00Z',
    expiryTtl: 0,
    expiryTtlString: '',
  }
}

const RECORDS = [
  rec('casa.test', 'SOA'),
  rec('casa.test', 'NS'),
  rec('www.casa.test', 'A'),
  rec('www.casa.test', 'AAAA'),
  rec('mail.casa.test', 'A'),
  rec('*.casa.test', 'A'),
  rec('a.b.casa.test', 'A'),
]

describe('name filter', () => {
  it('without a wildcard the comparison is EXACT, not \"contains\"', () => {
    expect(filterBy(RECORDS, { name: 'www', type: '' }, 'casa.test').map((r) => r.name)).toEqual([
      'www.casa.test',
      'www.casa.test',
    ])
    // `w` does not find `www`: without a wildcard no prefix counts.
    expect(filterBy(RECORDS, { name: 'w', type: '' }, 'casa.test')).toEqual([])
  })

  it('`@` is the apex of the zone', () => {
    expect(filterBy(RECORDS, { name: '@', type: '' }, 'casa.test').map((r) => r.type)).toEqual([
      'SOA',
      'NS',
    ])
  })

  it('`@` at the root is the empty name', () => {
    expect(compileNameFilter('@', '.').domain).toBe('')
  })

  it('`*` looks for the literal WILDCARD record, it does not list everything', () => {
    // The zone.js:3548 line that looks like a bug and is not.
    expect(filterBy(RECORDS, { name: '*', type: '' }, 'casa.test').map((r) => r.name)).toEqual([
      '*.casa.test',
    ])
  })

  it('a wildcard in the middle does behave as a glob', () => {
    expect(filterBy(RECORDS, { name: 'w*', type: '' }, 'casa.test').map((r) => r.name)).toEqual([
      'www.casa.test',
      'www.casa.test',
    ])
    expect(filterBy(RECORDS, { name: 'a.*', type: '' }, 'casa.test').map((r) => r.name)).toEqual([
      'a.b.casa.test',
    ])
  })

  it('`?` stands in for one character', () => {
    expect(filterBy(RECORDS, { name: 'ww?', type: '' }, 'casa.test')).toHaveLength(2)
  })

  it('what is typed is lowercased; the zone name is NOT', () => {
    // `filterName.toLowerCase()` yes, `zone` no (zone.js:3533). With the zone name
    // the server returns it makes no difference, but it is what the original does.
    expect(filterBy(RECORDS, { name: 'WWW', type: '' }, 'casa.test')).toHaveLength(2)
    expect(compileNameFilter('WWW', 'CASA.TEST').domain).toBe('www.CASA.TEST')
  })
})

describe('type filter', () => {
  it('it is exact and uppercased', () => {
    expect(filterBy(RECORDS, { name: '', type: 'a' }, 'casa.test')).toHaveLength(4)
    expect(filterBy(RECORDS, { name: '', type: 'AAAA' }, 'casa.test')).toHaveLength(1)
  })

  it('it combines with the name one', () => {
    expect(filterBy(RECORDS, { name: 'www', type: 'A' }, 'casa.test')).toHaveLength(1)
  })

  /* The pattern is the viewer's own text, built into a RegExp the way upstream
     builds it. One that is not a valid expression filters to nothing instead
     of taking the whole console down with it. */
  it('does not throw on a pattern that would not be a valid expression: its ( is literal', () => {
    expect(() => compileNameFilter('www(*', 'example.test')).not.toThrow()
    const records = [{ name: 'www(x.example.test', type: 'A' }, { name: 'wwwx.example.test', type: 'A' }] as never
    expect(filterBy(records, { name: 'www(*', type: '' }, 'example.test')).toEqual([records[0]])
  })
})

describe('the name filter takes only * and ? as wildcards', () => {
  it('any other regular expression character is literal, so a link cannot hang the tab', () => {
    const { regex } = compileNameFilter('(a+)+b*', 'casa.test')
    expect(regex?.source).toBe('^\\(a\\+\\)\\+b.*\\.casa\\.test$')
    const start = performance.now()
    expect(regex?.test(`${'a'.repeat(40)}c.casa.test`)).toBe(false)
    expect(performance.now() - start).toBeLessThan(50)
  })
})


/* Deviation 53: the Data contains filter and names in either form. */
describe('the data filter', () => {
  const withData = (name: string, type: string, rData: Record<string, unknown>): ResourceRecord => ({ ...rec(name, type), rData })
  const ZONE = [
    withData('www.casa.test', 'A', { ipAddress: '10.0.0.5' }),
    withData('nas.casa.test', 'A', { ipAddress: '10.0.0.50' }),
    withData('mail.casa.test', 'MX', { preference: 10, exchange: 'Mx1.Example.net' }),
    withData('casa.test', 'TXT', { text: 'v=spf1 include:example.net -all', splitText: false }),
  ]

  it('keeps the records whose drawn data contains the text, ignoring case', () => {
    expect(filterBy(ZONE, { name: '', type: '', data: '10.0.0.5' }, 'casa.test').map((r) => r.name)).toEqual([
      'www.casa.test',
      'nas.casa.test',
    ])
    expect(filterBy(ZONE, { name: '', type: '', data: 'mx1.EXAMPLE' }, 'casa.test').map((r) => r.type)).toEqual(['MX'])
    expect(filterBy(ZONE, { name: '', type: '', data: 'spf1' }, 'casa.test').map((r) => r.type)).toEqual(['TXT'])
  })

  it('takes the text literally, wildcards and spaces at its ends aside', () => {
    expect(filterBy(ZONE, { name: '', type: '', data: '10.0.0.*' }, 'casa.test')).toEqual([])
    expect(filterBy(ZONE, { name: '', type: '', data: '  spf1 ' }, 'casa.test')).toHaveLength(1)
  })

  it('is combined with the name and type filters', () => {
    expect(filterBy(ZONE, { name: 'n*', type: 'A', data: '10.0.0.5' }, 'casa.test').map((r) => r.name)).toEqual([
      'nas.casa.test',
    ])
    expect(filterBy(ZONE, { name: '', type: 'MX', data: '10.0.0' }, 'casa.test')).toEqual([])
  })

  it('empty, filters nothing, and with no filters the list is the same one', () => {
    expect(filterBy(ZONE, { name: '', type: '', data: '' }, 'casa.test')).toBe(ZONE)
    expect(filterBy(ZONE, { name: '', type: '', data: '   ' }, 'casa.test')).toBe(ZONE)
  })
})

describe('the name filter reads internationalized names in either form', () => {
  const ZONE = 'xn--mnchen-3ya.test'
  const IDN = [
    { ...rec('xn--mnchen-3ya.test', 'SOA'), nameIdn: 'münchen.test' },
    { ...rec('xn--bcher-kva.xn--mnchen-3ya.test', 'A'), nameIdn: 'bücher.münchen.test' },
    rec('www.xn--mnchen-3ya.test', 'A'),
  ]
  const names = (name: string) => filterBy(IDN, { name, type: '' }, ZONE).map((r) => r.name)

  it('finds a record by its Unicode name, exact or with wildcards, in any case', () => {
    expect(names('bücher')).toEqual(['xn--bcher-kva.xn--mnchen-3ya.test'])
    expect(names('BÜCHER')).toEqual(['xn--bcher-kva.xn--mnchen-3ya.test'])
    expect(names('bü*')).toEqual(['xn--bcher-kva.xn--mnchen-3ya.test'])
  })

  it('still finds it by its ASCII name, and @ is the apex', () => {
    expect(names('xn--bcher-kva')).toEqual(['xn--bcher-kva.xn--mnchen-3ya.test'])
    expect(names('@')).toEqual(['xn--mnchen-3ya.test'])
    expect(names('www')).toEqual(['www.xn--mnchen-3ya.test'])
  })

  it('decodes the name itself when the server sends no nameIdn', () => {
    const plain = [rec('xn--bcher-kva.xn--mnchen-3ya.test', 'A')]
    expect(filterBy(plain, { name: 'bücher', type: '' }, ZONE)).toEqual(plain)
  })
})
