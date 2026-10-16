import { describe, expect, it } from 'vitest'
import { SETTINGS } from './settings.fixture'
import { buildBody, formFromSettings, type SettingsForm } from './model'
import { FIELDS, pendingByPane, pendingText, sends } from './pending'
import { SUB_TABS } from './Settings'

const loaded = () => formFromSettings(SETTINGS)
const pending = (saved: SettingsForm, form: SettingsForm, node = '') => pendingByPane(saved, form, node, SUB_TABS)
const keys = Object.keys(FIELDS) as (keyof typeof FIELDS)[]

/** A value the save writes differently from `f`'s, for any field. */
function changed(f: SettingsForm, k: keyof typeof FIELDS): Partial<SettingsForm> {
  const v = f[k]
  if (typeof v === 'boolean') return { [k]: !v }
  if (Array.isArray(v)) {
    return k === 'tsigKeys'
      ? { tsigKeys: [...f.tsigKeys, { keyName: 'k', sharedSecret: '', algorithmName: 'hmac-sha256' }] }
      : { [k]: [...(v as SettingsForm['qpmPrefixLimitsIPv4']), { prefix: '24', udpLimit: '1', tcpLimit: '1' }] }
  }
  if (k === 'proxyType') return { proxyType: v === 'None' ? 'Http' : 'None' }
  return { [k]: `${v}9` }
}

/** A form with a proxy chosen, so that its details are sent too. */
const withProxy = (f: SettingsForm): SettingsForm => ({ ...f, proxyType: 'Http', proxyAddress: 'proxy.test', proxyPort: '3128' })

describe('pending: the fields', () => {
  it('covers every field of the form but the blocking minutes, which the save never sends', () => {
    const form = Object.keys(loaded()).filter((k) => k !== 'temporaryDisableBlockingMinutes').sort()
    expect([...keys].sort()).toEqual(form)
  })

  it('puts each field in the pane that draws it', async () => {
    const files = import.meta.glob('./panes/*.tsx', { query: '?raw', import: 'default', eager: true }) as Record<string, string>
    const pane: Record<string, string> = {
      General: 'General', WebService: 'Web Service', OptionalProtocols: 'Optional Protocols', Tsig: 'TSIG',
      Recursion: 'Recursion', Cache: 'Cache', Blocking: 'Blocking', ProxyForwarders: 'Proxy & Forwarders', Logging: 'Logging',
    }
    for (const k of keys) {
      const drawnIn = Object.entries(files)
        .filter(([, src]) => new RegExp(`\\bf\\.${k}\\b`).test(src))
        .map(([path]) => pane[path.replace(/^.*\/(\w+)\.tsx$/, '$1')])
      expect([k, drawnIn]).toEqual([k, [FIELDS[k].pane]])
    }
  })

  it('writes every field as buildBody does, for the three kinds of node, over random forms', () => {
    let seed = 11
    const rand = (n: number) => {
      seed = (seed * 1103515245 + 12345) % 2147483648
      return seed % n
    }
    const noise = ['', '\n', '\n\n', 'a.test\n', '\na.test\n\nb.test\n', '10', 'Http', 'None', 'Socks5']
    for (let round = 0; round < 300; round++) {
      let f: SettingsForm = round % 3 === 0 ? withProxy(loaded()) : loaded()
      for (let step = 0; step < 1 + rand(12); step++) {
        const k = keys[rand(keys.length)]
        const v = f[k]
        if (typeof v === 'boolean') f = { ...f, [k]: !v }
        else if (Array.isArray(v)) f = { ...f, ...changed(f, k) }
        else f = { ...f, [k]: noise[rand(noise.length)] }
      }
      for (const node of ['', 'cluster', 'node1.test']) {
        const r = buildBody(f, node)
        if (r.error) continue
        const { node: _node, ...body } = r.body!
        const ours: Record<string, string> = {}
        for (const k of keys) {
          const field = FIELDS[k]
          if (sends(field, f, node)) ours[field.param ?? k] = field.sent(f)
        }
        expect(ours).toEqual(body)
      }
    }
  })
})

describe('pending: what a save would change', () => {
  it('an untouched form has nothing pending', () => {
    expect(pending(loaded(), loaded())).toEqual([])
    expect(pending(withProxy(loaded()), withProxy(loaded()))).toEqual([])
  })

  it('each field, changed alone, is one field of its own pane; changed back, nothing', () => {
    for (const k of keys) {
      const saved = withProxy(loaded())
      const form = { ...saved, ...changed(saved, k) }
      expect([k, pending(saved, form)]).toEqual([k, [{ pane: FIELDS[k].pane, fields: 1 }]])
      expect([k, pending(saved, { ...form, [k]: saved[k] })]).toEqual([k, []])
    }
  })

  it('an edit the save cleans away is not a change', () => {
    const saved = loaded()
    const form = {
      ...saved,
      forwarders: `\n\n${saved.forwarders}\n\n`,
      dnsServerLocalEndPoints: saved.dnsServerLocalEndPoints.replace(/\n$/, ''),
      recursionNetworkACL: '\n',
    }
    expect(pending(saved, form)).toEqual([])
    expect(buildBody(form).body).toEqual(buildBody(saved).body)
  })

  it('a list emptied to its default is not a change; to anything else it is', () => {
    const saved = loaded() // its end points are the default, 0.0.0.0:53 and [::]:53
    expect(pending(saved, { ...saved, dnsServerLocalEndPoints: '' })).toEqual([])
    expect(pending(saved, { ...saved, dnsServerIPv4SourceAddresses: '' })).toEqual([{ pane: 'General', fields: 1 }])
  })

  it('an emptied required field counts, though the save would refuse it', () => {
    const saved = loaded()
    expect(buildBody({ ...saved, resolverRetries: '' }).error).toBeDefined()
    expect(pending(saved, { ...saved, resolverRetries: '' })).toEqual([{ pane: 'Recursion', fields: 1 }])
  })

  it('names the panes in tab order with how many fields each', () => {
    const saved = loaded()
    const form = { ...saved, cacheMaximumEntries: '1', defaultRecordTtl: '60', dnssecValidation: !saved.dnssecValidation }
    const p = pending(saved, form)
    expect(p).toEqual([{ pane: 'General', fields: 2 }, { pane: 'Cache', fields: 1 }])
    expect(pendingText(p)).toBe('General (2), Cache (1)')
    expect(pendingText([])).toBe('')
  })

  it('the proxy details count only while a proxy type is chosen, as only then are they sent', () => {
    const saved = withProxy(loaded())
    // Switching the proxy off is one change, not six: its details stay where they were and are not sent.
    expect(pending(saved, { ...saved, proxyType: 'None' })).toEqual([{ pane: 'Proxy & Forwarders', fields: 1 }])
    expect(pending(saved, { ...saved, proxyType: 'None', proxyAddress: 'other.test' })).toEqual([
      { pane: 'Proxy & Forwarders', fields: 1 },
    ])
    // Choosing one sends what was typed with it.
    const none = loaded()
    expect(pending(none, { ...none, proxyType: 'Socks5', proxyAddress: 'p.test', proxyPort: '1080' })).toEqual([
      { pane: 'Proxy & Forwarders', fields: 3 },
    ])
  })

  it('a field the chosen node does not send is not pending', () => {
    const saved = loaded()
    // The cache is the node's own, the forwarders the cluster's (main.js:1639-1644).
    const form = { ...saved, cacheMaximumEntries: '1', forwarders: '9.9.9.9\n' }
    expect(pending(saved, form, '')).toEqual([{ pane: 'Cache', fields: 1 }, { pane: 'Proxy & Forwarders', fields: 1 }])
    expect(pending(saved, form, 'cluster')).toEqual([{ pane: 'Proxy & Forwarders', fields: 1 }])
    expect(pending(saved, form, 'node1.test')).toEqual([{ pane: 'Cache', fields: 1 }])
  })

  it('reports something exactly when the body of the save would differ, over random edits', () => {
    let seed = 5
    const rand = (n: number) => {
      seed = (seed * 1103515245 + 12345) % 2147483648
      return seed % n
    }
    const saved = withProxy(loaded())
    const savedBody = buildBody(saved).body
    let differ = 0
    let same = 0
    for (let round = 0; round < 400; round++) {
      let f = saved
      for (let step = 0; step < 1 + rand(4); step++) {
        const k = keys[rand(keys.length)]
        // Every other round only makes edits that send nothing new: a change undone at
        // once, or a blank line in a list, which the cleaning removes.
        const op = round % 2 === 0 ? 1 + rand(2) : rand(3)
        const v = f[k]
        if (op === 0) f = { ...f, ...changed(f, k) }
        else if (op === 1) f = { ...f, ...changed(f, k), [k]: v }
        else if (typeof v === 'string' && v.endsWith('\n')) f = { ...f, [k]: `\n${v}\n` }
      }
      const r = buildBody(f)
      if (r.error) continue
      const different = JSON.stringify(r.body) !== JSON.stringify(savedBody)
      if (different) differ++
      else same++
      expect(pending(saved, f).length > 0).toBe(different)
    }
    // The run has to have exercised both answers to prove anything.
    expect(differ).toBeGreaterThan(50)
    expect(same).toBeGreaterThan(50)
  })
})
