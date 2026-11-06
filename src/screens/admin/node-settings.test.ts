import { describe, expect, it } from 'vitest'
import { SETTINGS } from '../settings/settings.fixture'
import { SETTING_ROWS, compareSettings, summary, type NodeAnswer } from './node-settings'

/* Deviation 31: what Settings Across Nodes compares, over the real `settings/get`
   answer of the reference instance. */

const ns1: NodeAnswer = { node: 'ns1', kind: 'ok', settings: { ...SETTINGS, dnsServerDomain: 'ns1.mycluster.test' } }
const NS2 = { ...SETTINGS, dnsServerDomain: 'ns2.mycluster.test', uptimestamp: '2026-08-26T09:00:00Z' }
const ns2: NodeAnswer = { node: 'ns2', kind: 'ok', settings: NS2 }
const down: NodeAnswer = { node: 'ns3', kind: 'failed', message: 'The remote server did not respond.' }

const row = (c: ReturnType<typeof compareSettings>, key: string) => c.rows.find((r) => r.key === key)!

describe('reading a setting as the Settings form writes it', () => {
  it('writes options with their labels, units, booleans and lists', () => {
    const c = compareSettings([ns1])
    expect(row(c, 'recursion').values).toEqual(['Allow Recursion Only For Private Networks'])
    expect(row(c, 'blockingType').values).toEqual(['NX Domain'])
    expect(row(c, 'protocol').values).toEqual(['DNS-over-UDP'])
    expect(row(c, 'logging').values).toEqual(['File'])
    expect(row(c, 'ipv6').values).toEqual(['Disable IPv6'])
    expect(row(c, 'dnssec').values).toEqual(['Enabled'])
    expect(row(c, 'ecs').values).toEqual(['Disabled'])
    expect(row(c, 'udpPayload').values).toEqual(['1232 bytes'])
    expect(row(c, 'qpmSample').values).toEqual(['5 minutes'])
    expect(row(c, 'recordTtl').values).toEqual(['3600 seconds'])
    expect(row(c, 'endPoints').values).toEqual(['0.0.0.0:53\n[::]:53'])
    expect(row(c, 'forwarders').values).toEqual(['1.1.1.1\n8.8.8.8'])
    expect(row(c, 'qpm4').values).toEqual(['/32: 600 UDP, 600 TCP\n/24: 6000 UDP, 6000 TCP'])
  })

  it('says None for an empty or absent list', () => {
    const c = compareSettings([{ ...ns1, settings: { ...SETTINGS, forwarders: null, dnsServerLocalEndPoints: [] } }])
    expect(row(c, 'forwarders').values).toEqual(['None'])
    expect(row(c, 'endPoints').values).toEqual(['None'])
  })

  it('covers the curated set, grouped', () => {
    expect([...new Set(SETTING_ROWS.map((r) => r.group))]).toEqual([
      'Identity',
      'Resolution',
      'Rate Limiting',
      'Zone Defaults',
      'Blocking',
      'Forwarders',
      'Logging',
    ])
  })
})

describe('comparing the nodes', () => {
  it('two nodes that differ only in their own domain and start: every setting matches', () => {
    const c = compareSettings([ns1, ns2])
    expect(c.differing).toBe(0)
    expect(row(c, 'domain').values).toEqual(['ns1.mycluster.test', 'ns2.mycluster.test'])
    expect(row(c, 'domain').differs).toBe(false)
    expect(row(c, 'upSince').differs).toBe(false)
    expect(summary(c)).toBe('All settings agree')
    expect(c.rows.map((r) => r.key)).toEqual(SETTING_ROWS.map((r) => r.key))
  })

  it('a differing setting is found and listed first, the rest keep their order', () => {
    const other: NodeAnswer = { ...ns2, settings: { ...NS2, forwarderProtocol: 'Https', defaultRecordTtl: 300 } }
    const c = compareSettings([ns1, other])
    expect(c.differing).toBe(2)
    expect(c.rows.slice(0, 2).map((r) => r.key)).toEqual(['recordTtl', 'protocol'])
    expect(c.rows.slice(0, 2).every((r) => r.differs)).toBe(true)
    expect(c.rows.slice(2).map((r) => r.key)).toEqual(SETTING_ROWS.map((r) => r.key).filter((k) => k !== 'recordTtl' && k !== 'protocol'))
    expect(row(c, 'protocol').values).toEqual(['DNS-over-UDP', 'DNS-over-HTTPS'])
    expect(summary(c)).toBe('2 settings differ')
    expect(summary({ ...c, differing: 1 })).toBe('1 setting differs')
  })

  it('a node that did not answer takes no part: its values are null and nothing differs because of it', () => {
    const c = compareSettings([ns1, ns2, down])
    expect(c.answered).toBe(2)
    expect(c.differing).toBe(0)
    expect(row(c, 'version').values).toEqual(['15.4', '15.4', null])
  })

  it('with fewer than two answers there is nothing to compare', () => {
    expect(summary(compareSettings([ns1, down]))).toBe('Only one node answered')
    expect(summary(compareSettings([down]))).toBe('No node answered')
  })
})
