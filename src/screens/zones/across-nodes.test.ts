/*
The zone list across cluster nodes (deviation 33): merged by name, one health
word by the order of `across-nodes.ts`, the filters counted on their own rules,
and a node that did not answer left out of every comparison.
*/
import { describe, expect, it } from 'vitest'
import type { Zone } from '../../api/zones'
import { countAcross, healthText, matchesAcross, mergeAcrossNodes, readAcrossFilter, type NodeAnswer } from './across-nodes'

const z = (name: string, type: string, soaSerial: number | null, extra: Partial<Zone> = {}): Zone => ({
  name,
  type,
  soaSerial,
  lastModified: '2026-11-06T09:00:00Z',
  disabled: false,
  notifyFailed: false,
  notifyFailedFor: [],
  ...extra,
})

const ok = (node: string, zones: Zone[]): NodeAnswer => ({ node, outcome: { ok: true, zones } })
const failed = (node: string, message: string): NodeAnswer => ({ node, outcome: { ok: false, message } })

describe('merging the answers', () => {
  it('puts one line per zone name, case aside, in name order, with each node holding its own zone', () => {
    const rows = mergeAcrossNodes([
      ok('ns1', [z('b.test', 'Primary', 2), z('A.test', 'Primary', 1)]),
      ok('ns2', [z('a.test', 'Secondary', 1), z('b.test', 'Secondary', 2)]),
    ])
    expect(rows.map((r) => r.label)).toEqual(['A.test', 'b.test'])
    expect(rows[0].perNode.ns1?.type).toBe('Primary')
    expect(rows[0].perNode.ns2?.type).toBe('Secondary')
    expect(rows[0].holders).toBe(2)
  })

  it('says null for a node that answered without the zone, and the root is written as a dot', () => {
    const rows = mergeAcrossNodes([ok('ns1', [z('', 'Forwarder', null), z('lab.test', 'Primary', 7)]), ok('ns2', [z('', 'Forwarder', null)])])
    const lab = rows.find((r) => r.name === 'lab.test')!
    expect(lab.perNode.ns2).toBeNull()
    expect(rows.find((r) => r.name === '.')?.label).toBe('<root>')
  })
})

describe('the health of a line', () => {
  it('is Healthy when every node holds it with one serial and enabled', () => {
    const [row] = mergeAcrossNodes([ok('ns1', [z('a.test', 'Primary', 5)]), ok('ns2', [z('a.test', 'Secondary', 5)])])
    expect(row.health).toBe('healthy')
    expect(healthText(row)).toBe('Healthy')
  })

  it('is Only on N nodes when an answering node does not hold it, ahead of a serial that differs', () => {
    const [row] = mergeAcrossNodes([
      ok('ns1', [z('a.test', 'Primary', 5)]),
      ok('ns2', [z('a.test', 'Secondary', 4)]),
      ok('ns3', []),
    ])
    expect(row.health).toBe('some')
    expect(healthText(row)).toBe('Only on 2 nodes')
    expect(row.serialDiffers).toBe(true)
    const [one] = mergeAcrossNodes([ok('ns1', [z('a.test', 'Primary', 5)]), ok('ns2', [])])
    expect(healthText(one)).toBe('Only on 1 node')
  })

  it('is Serial differs only between serials both nodes give, and ahead of a disabled node', () => {
    const [differs] = mergeAcrossNodes([ok('ns1', [z('a.test', 'Primary', 5)]), ok('ns2', [z('a.test', 'Secondary', 4, { disabled: true })])])
    expect(healthText(differs)).toBe('Serial differs')
    const [noSerial] = mergeAcrossNodes([ok('ns1', [z('f.test', 'Forwarder', null)]), ok('ns2', [z('f.test', 'Forwarder', 3)])])
    expect(noSerial.health).toBe('healthy')
  })

  it('is Disabled on a node when one node holds it disabled', () => {
    const [row] = mergeAcrossNodes([ok('ns1', [z('a.test', 'Primary', 5, { disabled: true })]), ok('ns2', [z('a.test', 'Secondary', 5)])])
    expect(healthText(row)).toBe('Disabled on a node')
  })
})

describe('a node that did not answer', () => {
  it('is no value on every line and is left out of the comparisons', () => {
    const rows = mergeAcrossNodes([
      ok('ns1', [z('a.test', 'Primary', 5)]),
      ok('ns2', [z('a.test', 'Secondary', 5)]),
      failed('ns3', 'Connection refused'),
    ])
    expect(rows[0].perNode.ns3).toBeUndefined()
    expect(rows[0].onEvery).toBe(true)
    expect(rows[0].health).toBe('healthy')
  })
})

describe('the filters and their counts', () => {
  const rows = mergeAcrossNodes([
    ok('ns1', [z('a.test', 'Primary', 5), z('b.test', 'Primary', 2), z('c.test', 'Primary', 9)]),
    ok('ns2', [z('a.test', 'Secondary', 5), z('b.test', 'Secondary', 1)]),
  ])

  it('count each rule on its own', () => {
    expect(countAcross(rows)).toEqual({ all: 3, every: 2, some: 1, serial: 1 })
  })

  it('narrow the lines', () => {
    expect(rows.filter((r) => matchesAcross(r, 'some')).map((r) => r.name)).toEqual(['c.test'])
    expect(rows.filter((r) => matchesAcross(r, 'serial')).map((r) => r.name)).toEqual(['b.test'])
    expect(rows.filter((r) => matchesAcross(r, 'every')).map((r) => r.name)).toEqual(['a.test', 'b.test'])
  })

  it('come from the bar, and anything unknown is All', () => {
    expect(readAcrossFilter('serial')).toBe('serial')
    expect(readAcrossFilter('nonsense')).toBe('all')
    expect(readAcrossFilter(null)).toBe('all')
  })
})
