import { describe, expect, it } from 'vitest'
import {
  countRules, filterRules, mergeRules, pageOf, readRuleParam, ruleSearch, RULES_PER_PAGE,
} from './rules-model'

describe('mergeRules', () => {
  it('joins both lists, sorted by domain, and tolerates a list it could not read', () => {
    expect(mergeRules(['b.test', 'a.test'], ['c.test'])).toEqual([
      { domain: 'a.test', list: 'blocked' },
      { domain: 'b.test', list: 'blocked' },
      { domain: 'c.test', list: 'allowed' },
    ])
    expect(mergeRules(null, ['c.test'])).toEqual([{ domain: 'c.test', list: 'allowed' }])
  })
})

describe('filterRules and countRules', () => {
  const rules = mergeRules(['ads.example.com', 'doubleclick.net'], ['s.youtube.com'])

  it('filters by list and by a case-insensitive substring', () => {
    expect(filterRules(rules, 'blocked', '').map((r) => r.domain)).toEqual(['ads.example.com', 'doubleclick.net'])
    expect(filterRules(rules, 'all', 'YOU').map((r) => r.domain)).toEqual(['s.youtube.com'])
    expect(filterRules(rules, 'allowed', 'ads')).toEqual([])
  })

  it('counts each list', () => {
    expect(countRules(rules)).toEqual({ all: 3, blocked: 2, allowed: 1 })
  })
})

describe('pageOf', () => {
  const rows = Array.from({ length: 10_000 }, (_, i) => i)

  it('cuts 10,000 rows into pages and clamps a page out of range', () => {
    expect(pageOf(rows, 1)).toMatchObject({ page: 1, totalPages: 200 })
    expect(pageOf(rows, 1).rows).toHaveLength(RULES_PER_PAGE)
    expect(pageOf(rows, 200).rows[0]).toBe(9_950)
    expect(pageOf(rows, 999).page).toBe(200)
    expect(pageOf([], 3)).toEqual({ rows: [], page: 1, totalPages: 1 })
  })
})

describe('the rule parameter', () => {
  it('reads it, defaulting to all', () => {
    expect(readRuleParam('?rule=allowed')).toBe('allowed')
    expect(readRuleParam('?rule=blocked&x=1')).toBe('blocked')
    expect(readRuleParam('?rule=zzz')).toBe('all')
    expect(readRuleParam('')).toBe('all')
  })

  it('writes it, keeping other parameters, and drops it for all', () => {
    expect(ruleSearch('?x=1', 'blocked')).toBe('?x=1&rule=blocked')
    expect(ruleSearch('?rule=blocked', 'all')).toBe('')
  })
})
