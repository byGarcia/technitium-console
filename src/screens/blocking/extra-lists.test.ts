import { describe, expect, it } from 'vitest'
import builtin from '../../../public/json/quick-block-lists-builtin.json'
import { EXTRA_LISTS, hostsOf, moreLists } from './extra-lists'
import { listName } from './list-lines'

const SB = 'https://raw.githubusercontent.com/StevenBlack/hosts/master/hosts'
const OISD = 'https://big.oisd.nl/domainswild2'
const THEIRS = [
  { name: 'Default', urls: [SB] },
  { name: 'Steven Black [adware + malware]', urls: [SB] },
  { name: 'OISD Big [Domains (Wildcards)]', urls: [OISD] },
]

describe('moreLists', () => {
  it('leaves out an entry whose every URL Technitium already offers', () => {
    const ours = [
      { name: 'Same hosts file', urls: [SB] },
      { name: 'Both of theirs', urls: [SB, OISD] },
      { name: 'Ads', urls: ['https://lists.example.org/ads.txt'] },
    ]
    expect(moreLists(THEIRS, ours).map((e) => e.name)).toEqual(['Ads'])
  })

  it('keeps an entry that adds at least one URL of its own', () => {
    const ours = [{ name: 'Theirs and one more', urls: [SB, 'https://lists.example.org/more.txt'] }]
    expect(moreLists(THEIRS, ours)).toEqual(ours)
  })

  it('keeps the order of ours', () => {
    const ours = [
      { name: 'B', urls: ['https://b.example.org/x'] },
      { name: 'A', urls: ['https://a.example.org/x'] },
    ]
    expect(moreLists([], ours).map((e) => e.name)).toEqual(['B', 'A'])
  })

  /* `Default` replaces the field by its name (applyQuickEntry), and `None` is the
     fixed option that empties it: neither can be an entry of ours. */
  it('never offers an entry named Default or None, nor one with no URL', () => {
    const ours = [
      { name: 'default', urls: ['https://a.example.org/x'] },
      { name: 'NONE', urls: ['https://b.example.org/x'] },
      { name: 'Empty', urls: [] },
    ]
    expect(moreLists([], ours)).toEqual([])
  })
})

describe('hostsOf', () => {
  it('gives each host once', () => {
    expect(hostsOf({ name: 'x', urls: [SB, 'https://raw.githubusercontent.com/other', OISD] }))
      .toBe('raw.githubusercontent.com big.oisd.nl')
  })

  it('skips what is not a URL', () => {
    expect(hostsOf({ name: 'x', urls: ['not a url'] })).toBe('')
  })
})

describe('listName with the console catalogue', () => {
  it('names a row from an entry of ours', () => {
    const more = moreLists(THEIRS, [{ name: 'Ads', urls: ['https://lists.example.org/ads.txt'] }])
    expect(listName('https://lists.example.org/ads.txt', [...THEIRS, ...more])).toBe('Ads')
  })

  it('Technitium names a URL both carry', () => {
    const ours = [{ name: 'Ours for the same file', urls: [SB] }]
    expect(listName(SB, [...THEIRS, ...ours])).toBe('Steven Black [adware + malware]')
  })
})

/* The bundled file itself: what Quick Add will offer. */
describe('the bundled catalogue', () => {
  it('has the shape of Technitium catalogue', () => {
    for (const e of EXTRA_LISTS) {
      expect(typeof e.name).toBe('string')
      expect(e.name.trim()).not.toBe('')
      expect(e.urls.length).toBeGreaterThan(0)
      for (const u of e.urls) expect(['http:', 'https:']).toContain(new URL(u).protocol)
    }
  })

  it('has no name twice and no reserved name', () => {
    const names = EXTRA_LISTS.map((e) => e.name.toLowerCase())
    expect(new Set(names).size).toBe(names.length)
    expect(names).not.toContain('default')
    expect(names).not.toContain('none')
  })

  it('does not repeat a name of the built-in catalogue', () => {
    const theirs = new Set(builtin.map((e) => e.name.toLowerCase()))
    expect(EXTRA_LISTS.filter((e) => theirs.has(e.name.toLowerCase()))).toEqual([])
  })
})
