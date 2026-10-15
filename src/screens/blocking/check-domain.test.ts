import { afterEach, describe, expect, it, vi } from 'vitest'
import quickBuiltin from '../../../public/json/quick-block-lists-builtin.json'
import * as blockingApi from '../../api/blocking'
import * as dnsclient from '../../api/dnsclient'
import * as settingsApi from '../../api/settings'
import REAL from './check-domain.real.json'
import {
  addressOf, allowRuleFor, checkDomain, networkContains, parseAnswer, parseReason, reportedListName,
  verdictOf, type CheckInputs,
} from './check-domain'
import { moreLists } from './extra-lists'

/*
The answers in `check-domain.real.json` are what a live v15.6.1 (blocking on, NX Domain,
`Allow TXT Blocking Report` on, three block lists and four blocked and three allowed
rules) answered to `dnsClient/resolve?server=this-server&type=A&protocol=UDP&dnssec=false`
on 2026-10-15, whole. `settings` is `settings/get?node=` trimmed to its blocking
fields; `allowedExport` and `blockedExport` are the two exports as text.
*/

afterEach(() => vi.restoreAllMocks())

const result = (key: keyof typeof REAL) => (REAL[key] as { response: { result: unknown } }).response.result
const ALLOWED = REAL.allowedExport.split('\n').filter((l) => l !== '')
const SETTINGS = REAL.settings.response

function inputs(key: keyof typeof REAL, over: Partial<CheckInputs> = {}): CheckInputs {
  return { answer: parseAnswer(result(key)), settings: SETTINGS, allowed: ALLOWED, ...over }
}

describe('parseAnswer, on the real answers', () => {
  it('a name two lists carry: one reason per list, in the order the server sent them', () => {
    const a = parseAnswer(result('blockLists'))
    expect(a.name).toBe('app-measurement.com')
    expect(a.reasons).toEqual([
      { source: 'list', url: 'https://raw.githubusercontent.com/StevenBlack/hosts/master/hosts', domain: 'app-measurement.com' },
      {
        source: 'list',
        url: 'https://cdn.jsdelivr.net/gh/hagezi/dns-blocklists@latest/wildcard/pro-onlydomains.txt',
        domain: 'app-measurement.com',
      },
    ])
    expect(a.clientIp).toBe('127.0.0.1')
  })

  it('a name blocked by a rule on a parent reports the rule, not the name', () => {
    const a = parseAnswer(result('ownRuleParent'))
    expect(a.name).toBe('sub.telemetry.example-iot.net')
    expect(a.reasons).toEqual([{ source: 'rule', domain: 'telemetry.example-iot.net' }])
  })

  it('an allowed name and a plain one carry no Blocked option; Synthesized ones are not reasons', () => {
    expect(parseAnswer(result('allowedRule')).reasons).toEqual([])
    expect(parseAnswer(result('notBlocked')).reasons).toEqual([])
    expect(parseAnswer(result('nonExistent')).reasons).toEqual([])
  })

  it('reads the OPT record when an answer has no EDNS summary', () => {
    const r = structuredClone(result('ownRule')) as Record<string, unknown>
    delete r.EDNS
    expect(parseAnswer(r).reasons).toEqual([{ source: 'rule', domain: 'telemetry.example-iot.net' }])
  })

  it('survives an answer of an unexpected shape', () => {
    expect(parseAnswer(null)).toEqual({ name: '.', ascii: '', reasons: [], clientIp: null })
    expect(parseAnswer({ Question: 'x', EDNS: { Options: 'y' } }).reasons).toEqual([])
  })

  it('an IDN name is drawn as the server wrote it and compared in ASCII', () => {
    const a = parseAnswer({ Question: [{ Name: 'xn--and-6ma2c.es', NameIDN: 'ñandú.es' }] })
    expect(a.name).toBe('ñandú.es')
    expect(a.ascii).toBe('xn--and-6ma2c.es')
  })
})

describe('parseReason', () => {
  it('keeps a URL that carries a semicolon whole', () => {
    expect(parseReason('source=block-list-zone; blockListUrl=https://h/a;b; domain=x.test')).toEqual({
      source: 'list', url: 'https://h/a;b', domain: 'x.test',
    })
  })

  it('anything else is drawn as the server wrote it', () => {
    expect(parseReason('source=some-app; group=kids')).toEqual({ source: 'other', text: 'source=some-app; group=kids' })
  })
})

describe('verdictOf', () => {
  it('lists', () => {
    expect(verdictOf(inputs('blockLists'))).toEqual({
      kind: 'lists',
      name: 'app-measurement.com',
      domain: 'app-measurement.com',
      lists: [
        'https://raw.githubusercontent.com/StevenBlack/hosts/master/hosts',
        'https://cdn.jsdelivr.net/gh/hagezi/dns-blocklists@latest/wildcard/pro-onlydomains.txt',
      ],
    })
  })

  it('own rule, exact and on a parent', () => {
    expect(verdictOf(inputs('ownRule'))).toEqual({ kind: 'rule', name: 'telemetry.example-iot.net', domain: 'telemetry.example-iot.net' })
    expect(verdictOf(inputs('ownRuleParent'))).toEqual({
      kind: 'rule', name: 'sub.telemetry.example-iot.net', domain: 'telemetry.example-iot.net',
    })
  })

  it('a reported block wins even when the settings say blocking is off', () => {
    expect(verdictOf(inputs('ownRule', { settings: { enableBlocking: false } })).kind).toBe('rule')
  })

  it('allowed by an allow rule from the real export', () => {
    expect(verdictOf(inputs('allowedRule'))).toEqual({ kind: 'allowed', name: 's.youtube.com', domain: 's.youtube.com' })
  })

  it('not blocked, with nothing left unread', () => {
    expect(verdictOf(inputs('notBlocked'))).toEqual({ kind: 'clear', name: 'example.com', unread: {} })
    expect(verdictOf(inputs('nonExistent')).kind).toBe('clear')
  })

  it('not blocked says which reads it did not have', () => {
    const v = verdictOf(inputs('notBlocked', { settings: { need: 'Settings.canView' }, allowed: { failed: true } }))
    expect(v).toEqual({
      kind: 'clear', name: 'example.com', unread: { settings: { need: 'Settings.canView' }, allowed: { failed: true } },
    })
  })

  it('without the allow rules an allowed name can only read as not blocked', () => {
    const v = verdictOf(inputs('allowedRule', { allowed: { need: 'Allowed.canView' } }))
    expect(v).toEqual({ kind: 'clear', name: 's.youtube.com', unread: { allowed: { need: 'Allowed.canView' } } })
  })

  it('blocking disabled, and paused until a time still to come', () => {
    const now = Date.parse('2026-10-15T12:00:00Z')
    expect(verdictOf(inputs('allowedRule', { settings: { ...SETTINGS, enableBlocking: false } }), now)).toEqual({
      kind: 'off', name: 's.youtube.com', paused: false,
    })
    const paused = { ...SETTINGS, enableBlocking: false, temporaryDisableBlockingTill: '2026-10-15T12:05:00Z' }
    expect(verdictOf(inputs('notBlocked', { settings: paused }), now)).toEqual({ kind: 'off', name: 'example.com', paused: true })
  })

  it('the check bypasses blocking when the bypass list covers the server address', () => {
    const settings = { ...SETTINGS, blockingBypassList: ['192.168.1.0/24', '127.0.0.0/8'] }
    expect(verdictOf(inputs('notBlocked', { settings }))).toEqual({ kind: 'bypassed', name: 'example.com', ip: '127.0.0.1' })
    expect(verdictOf(inputs('notBlocked', { settings: { ...SETTINGS, blockingBypassList: ['10.0.0.0/8'] } })).kind).toBe('clear')
  })

  it('cannot tell when the server does not report what it blocks', () => {
    expect(verdictOf(inputs('notBlocked', { settings: { ...SETTINGS, allowTxtBlockingReport: false } }))).toEqual({
      kind: 'unreported', name: 'example.com',
    })
  })

  it('an allow rule is still told when reports are off: it wins before any blocking', () => {
    expect(verdictOf(inputs('allowedRule', { settings: { ...SETTINGS, allowTxtBlockingReport: false } })).kind).toBe('allowed')
  })

  it('a block reported by something else is drawn with its own text', () => {
    const answer = { name: 'x.test', ascii: 'x.test', reasons: [parseReason('source=app; group=kids')], clientIp: null }
    expect(verdictOf({ answer, settings: SETTINGS, allowed: [] })).toEqual({ kind: 'other', name: 'x.test', texts: ['source=app; group=kids'] })
  })
})

describe('allowRuleFor', () => {
  it('matches the name or a parent, and the most specific rule', () => {
    expect(allowRuleFor('a.s.youtube.com', ALLOWED)).toBe('s.youtube.com')
    expect(allowRuleFor('a.b.test', ['test', 'b.test'])).toBe('b.test')
    expect(allowRuleFor('xs.youtube.com', ALLOWED)).toBeNull()
    expect(allowRuleFor('t.co', ['T.CO.'])).toBe('t.co')
  })
})

describe('the check address and the bypass list', () => {
  it('addressOf', () => {
    expect(addressOf('ns1.example.net (127.0.0.1)')).toBe('127.0.0.1')
    expect(addressOf('dns ([::1]:53)')).toBe('::1')
    expect(addressOf('dns (10.0.0.5:5353)')).toBe('10.0.0.5')
    expect(addressOf('dns (::1)')).toBe('::1')
    expect(addressOf(null)).toBeNull()
  })

  it('networkContains', () => {
    expect(networkContains('127.0.0.1', '127.0.0.1')).toBe(true)
    expect(networkContains('127.0.0.0/8', '127.0.0.1')).toBe(true)
    expect(networkContains('0.0.0.0/0', '10.1.2.3')).toBe(true)
    expect(networkContains('192.168.1.0/24', '127.0.0.1')).toBe(false)
    expect(networkContains('::1', '::1')).toBe(true)
    expect(networkContains('::/0', '::1')).toBe(true)
    expect(networkContains('fe80::/10', 'fe80::1:2')).toBe(true)
    expect(networkContains('::ffff:127.0.0.1', '::ffff:7f00:1')).toBe(true)
    expect(networkContains('::/0', '127.0.0.1')).toBe(false)
    expect(networkContains('nonsense', '127.0.0.1')).toBe(false)
    expect(networkContains('127.0.0.1/33', '127.0.0.1')).toBe(false)
  })
})

describe('reportedListName', () => {
  const named = [...quickBuiltin, ...moreLists(quickBuiltin)]

  it('names a reported list as the Lists tab does', () => {
    expect(reportedListName('https://raw.githubusercontent.com/StevenBlack/hosts/master/hosts', named)).toBe(
      'Steven Black [adware + malware]',
    )
  })

  it('matches after normalising what the catalogue wrote', () => {
    expect(reportedListName('https://lists.test/a%20b', [{ name: 'Spaced', urls: ['https://LISTS.test/a b'] }])).toBe('Spaced')
  })

  it('an unknown list has no name', () => {
    expect(reportedListName('https://lists.test/mine.txt', named)).toBeNull()
  })
})

describe('checkDomain', () => {
  it('asks this server as DNS Client does, and reads the settings and the allow rules beside it', async () => {
    const resolve = vi.spyOn(dnsclient, 'resolve').mockResolvedValue({ kind: 'ok', data: REAL.ownRule as never })
    const settings = vi.spyOn(settingsApi, 'readSettings').mockResolvedValue({ kind: 'ok', data: SETTINGS as never })
    const exp = vi.spyOn(blockingApi, 'readRuleExport').mockResolvedValue({ kind: 'ok', data: ALLOWED })
    const out = await checkDomain('T', 'telemetry.example-iot.net', {})
    expect(resolve).toHaveBeenCalledWith('T', {
      server: 'this-server', domain: 'telemetry.example-iot.net', type: 'A', protocol: 'UDP', dnssec: false, eDnsClientSubnet: '',
    })
    expect(settings).toHaveBeenCalledWith('T')
    expect(exp).toHaveBeenCalledWith('allowed', 'T')
    expect(out.kind === 'ok' && verdictOf(out.data).kind).toBe('rule')
  })

  it('skips a read whose permission is missing, and a failed read only narrows the verdict', async () => {
    vi.spyOn(dnsclient, 'resolve').mockResolvedValue({ kind: 'ok', data: REAL.notBlocked as never })
    const settings = vi.spyOn(settingsApi, 'readSettings')
    vi.spyOn(blockingApi, 'readRuleExport').mockResolvedValue({ kind: 'error', message: 'boom' })
    const out = await checkDomain('T', 'example.com', { settings: 'Settings.canView' })
    expect(settings).not.toHaveBeenCalled()
    expect(out).toEqual({
      kind: 'ok',
      data: expect.objectContaining({ settings: { need: 'Settings.canView' }, allowed: { failed: true } }),
    })
  })

  it('a failed query fails the check with the server message', async () => {
    vi.spyOn(dnsclient, 'resolve').mockResolvedValue({ kind: 'error', message: REAL.invalidName.errorMessage })
    vi.spyOn(settingsApi, 'readSettings').mockResolvedValue({ kind: 'ok', data: SETTINGS as never })
    vi.spyOn(blockingApi, 'readRuleExport').mockResolvedValue({ kind: 'ok', data: [] })
    expect(await checkDomain('T', 'not a domain', {})).toEqual({
      kind: 'error', message: 'Invalid domain name [not a domain]: invalid character [32] was found.',
    })
  })
})
