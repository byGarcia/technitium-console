import { describe, expect, it } from 'vitest'
import type { GroupModel, ListRow } from './config-model'
import { groupSummary } from './summary'

function group(over: Partial<GroupModel> = {}): GroupModel {
  return {
    id: 'g1',
    loadedIndex: 0,
    name: 'kids',
    enabled: true,
    txtReport: true,
    nxDomain: true,
    addresses: '',
    text: { allowed: '', blocked: '', allowedRegex: '', blockedRegex: '' },
    lists: [],
    unknownKeys: [],
    ...over,
  }
}

const list = (id: string): ListRow => ({ id, kind: 'blockListUrls', url: `https://x/${id}`, answer: 'group', addresses: '', node: null })

describe('groupSummary', () => {
  it('says blocking is off, whatever else the group holds', () => {
    expect(groupSummary(group({ enabled: false, lists: [list('a')] }))).toBe('Blocking off: everything is answered')
  })

  it('names NXDOMAIN when the group answers with it', () => {
    expect(groupSummary(group({ nxDomain: true, addresses: '0.0.0.0' }))).toBe('Answers NXDOMAIN, 0 lists, 0 rules')
  })

  it('lists the addresses, one per line in the model, comma separated', () => {
    expect(groupSummary(group({ nxDomain: false, addresses: '0.0.0.0\n::' }))).toBe('Answers 0.0.0.0, ::, 0 lists, 0 rules')
  })

  it('leaves blank address lines out', () => {
    expect(groupSummary(group({ nxDomain: false, addresses: '\n0.0.0.0\n  \n' }))).toBe('Answers 0.0.0.0, 0 lists, 0 rules')
  })

  it('says when no answer is set', () => {
    expect(groupSummary(group({ nxDomain: false, addresses: ' \n' }))).toBe('Answers No answer set, 0 lists, 0 rules')
  })

  it('uses the singular for one list and one rule', () => {
    expect(groupSummary(group({ lists: [list('a')], text: { allowed: 'a.com', blocked: '', allowedRegex: '', blockedRegex: '' } }))).toBe('Answers NXDOMAIN, 1 list, 1 rule')
  })

  it('counts the non-empty lines of all four text lists', () => {
    const text = { allowed: 'a.com\n\nb.com\n', blocked: 'c.com', allowedRegex: '  \n^x$', blockedRegex: '^y$\r\n^z$' }
    expect(groupSummary(group({ lists: [list('a'), list('b')], text }))).toBe('Answers NXDOMAIN, 2 lists, 6 rules')
  })
})
