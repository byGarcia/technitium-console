import { describe, expect, it } from 'vitest'
import { openConfig, serializeConfig, type EditorModel } from './config-model'
import { allowedBy, clientGroup, hasEndpointRows, withAllowed } from './allow-in-group'

const TEXT = `{
  "enableBlocking": true,
  "networkGroupMap": {
    "0.0.0.0/0": "everyone",
    "10.0.0.0/8": "home",
    "10.0.0.7": "kids",
    "192.168.1.0/24": "gone"
  },
  "groups": [
    { "name": "everyone", "allowed": [], "blocked": [], "allowListUrls": [], "blockListUrls": [], "allowedRegex": [], "blockedRegex": [], "regexAllowListUrls": [], "regexBlockListUrls": [], "adblockListUrls": [] },
    { "name": "home", "allowed": ["example.com"], "blocked": [], "allowListUrls": [], "blockListUrls": [], "allowedRegex": [], "blockedRegex": [], "regexAllowListUrls": [], "regexBlockListUrls": [], "adblockListUrls": [] },
    { "name": "kids", "allowed": ["one.test"], "blocked": [], "allowListUrls": [], "blockListUrls": [], "allowedRegex": [], "blockedRegex": [], "regexAllowListUrls": [], "regexBlockListUrls": [], "adblockListUrls": [] }
  ]
}`

function model(text = TEXT): EditorModel {
  const opened = openConfig(text)
  if (opened.kind !== 'editable') throw new Error(opened.reason)
  return opened.model
}

const byName = (m: EditorModel, name: string) => m.groups.find((g) => g.name === name)!

describe('clientGroup', () => {
  it('takes the most specific network that holds the client, as GetGroupName does', () => {
    const m = model()
    expect(clientGroup(m, '10.0.0.7')?.name).toBe('kids')
    expect(clientGroup(m, '10.1.2.3')?.name).toBe('home')
    expect(clientGroup(m, '172.16.0.1')?.name).toBe('everyone')
  })

  it('reads an IPv6 network written in brackets, as the default config has [::]/0', () => {
    const m = model(TEXT.replace('"0.0.0.0/0": "everyone",', '"0.0.0.0/0": "everyone", "[::]/0": "home", "[fd00::]/8": "kids",'))
    expect(clientGroup(m, '2001:db8::1')?.name).toBe('home')
    expect(clientGroup(m, 'fd12::5')?.name).toBe('kids')
  })

  it('gives no group for a row naming a missing group, or an address no row holds', () => {
    expect(clientGroup(model(), '192.168.1.5')).toBeNull()
    expect(clientGroup(model(), '::1')).toBeNull()
  })
})

describe('allowedBy', () => {
  it('finds the name itself or a parent, in lower case, as IsZoneFound walks up', () => {
    const home = byName(model(), 'home')
    expect(allowedBy(home, 'example.com')).toBe('example.com')
    expect(allowedBy(home, 'Ads.Example.com.')).toBe('example.com')
    expect(allowedBy(home, 'notexample.com')).toBeNull()
  })
})

describe('withAllowed', () => {
  it('adds the name to the chosen groups only, and the config is patched, not rebuilt', () => {
    const m = model()
    const next = withAllowed(m, [byName(m, 'kids').id, byName(m, 'everyone').id], 'Ads.Tracker.test')
    expect(byName(next, 'kids').text.allowed).toBe('one.test\nads.tracker.test')
    expect(byName(next, 'everyone').text.allowed).toBe('ads.tracker.test')
    expect(byName(next, 'home').text.allowed).toBe('example.com')
    const sent = serializeConfig(next)
    expect(JSON.parse(sent).groups.map((g: { allowed: string[] }) => g.allowed)).toEqual([
      ['ads.tracker.test'],
      ['example.com'],
      ['one.test', 'ads.tracker.test'],
    ])
    expect(sent).toContain('    "10.0.0.0/8": "home",\n')
  })

  it('leaves a group that already allows the name or a parent as it was', () => {
    const m = model()
    const next = withAllowed(m, [byName(m, 'home').id], 'sub.example.com')
    expect(byName(next, 'home')).toBe(byName(m, 'home'))
  })
})

it('hasEndpointRows says when localEndPointGroupMap could pick another group', () => {
  expect(hasEndpointRows(model())).toBe(false)
  expect(hasEndpointRows(model(TEXT.replace('"enableBlocking": true,', '"enableBlocking": true, "localEndPointGroupMap": { "10.0.0.1:53": "home" },')))).toBe(true)
})
