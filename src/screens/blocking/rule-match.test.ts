import { describe, expect, it } from 'vitest'
import { asciiName, matchRules, ruleHint } from './rule-match'
import { mergeRules } from './rules-model'

const RULES = mergeRules(['ads.example.com', 'telemetry.example-iot.net', 'example.org'], ['ok.example.org'])

describe('asciiName', () => {
  it('writes the name as the rules are written', () => {
    expect(asciiName('  Ads.Example.COM. ')).toBe('ads.example.com')
    expect(asciiName('bücher.example')).toBe('xn--bcher-kva.example')
  })

  it('is nothing for an empty field or a name with spaces', () => {
    expect(asciiName('   ')).toBeNull()
    expect(asciiName('not a domain')).toBeNull()
  })
})

describe('matchRules', () => {
  it('finds the rule itself and a parent rule, never a mere suffix', () => {
    expect(matchRules('ads.example.com', RULES)).toEqual({ blocked: 'ads.example.com', allowed: null })
    expect(matchRules('sub.telemetry.example-iot.net', RULES)).toEqual({ blocked: 'telemetry.example-iot.net', allowed: null })
    expect(matchRules('badads.example.com', RULES)).toEqual({ blocked: null, allowed: null })
  })

  it('finds both lists when both cover the name', () => {
    expect(matchRules('www.ok.example.org', RULES)).toEqual({ blocked: 'example.org', allowed: 'ok.example.org' })
  })
})

describe('ruleHint', () => {
  const all = {}

  it('the name is one of your blocked rules', () => {
    expect(ruleHint('ads.example.com', RULES, all)).toEqual({
      tone: 'blocked', text: 'Already blocked: it is one of your rules.',
    })
  })

  it('a parent blocked rule covers it', () => {
    expect(ruleHint('sub.telemetry.example-iot.net', RULES, all)).toEqual({
      tone: 'blocked', text: 'Already blocked by your rule telemetry.example-iot.net, which covers its subdomains.',
    })
  })

  it('an allow rule wins over a blocked parent, and says so', () => {
    expect(ruleHint('www.ok.example.org', RULES, all)).toEqual({
      tone: 'allowed',
      text: 'Already allowed by your rule ok.example.org, which covers its subdomains. It wins over your blocked rule example.org.',
    })
  })

  it('none of your rules: Check is the way to the block lists', () => {
    expect(ruleHint('example.net', RULES, all)).toEqual({
      tone: 'none', text: 'Not one of your rules. Check asks the block lists.',
    })
  })

  it('a list that could not be read for its permission is named, never guessed', () => {
    const blockedOnly = mergeRules(['ads.example.com'], null)
    expect(ruleHint('example.net', blockedOnly, { allowed: 'Allowed.canView' })).toEqual({
      tone: 'none',
      text: 'Not one of your blocked rules. Your allowed rules were not checked: Requires Allowed: View. Check asks the block lists.',
    })
    expect(ruleHint('ads.example.com', blockedOnly, { allowed: 'Allowed.canView' })).toEqual({
      tone: 'blocked',
      text: 'Already blocked: it is one of your rules. Your allowed rules were not checked: Requires Allowed: View.',
    })
  })

  it('says nothing when neither list may be read', () => {
    expect(ruleHint('example.net', [], { blocked: 'Blocked.canView', allowed: 'Allowed.canView' })).toBeNull()
  })
})
