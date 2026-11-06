import { afterEach, describe, expect, it, vi } from 'vitest'
import * as api from '../../api/zonelists'
import type { DnsRecord } from '../../api/zonelists'
import { answered, filterRows, mergeAcross, readAcross, spreadOf, zonesAcross, type NodeCache } from './cache-across'

afterEach(() => vi.restoreAllMocks())

const rec = (type: string, ttl: string, rData: Record<string, unknown>, name = 'example.com'): DnsRecord =>
  ({ name, type, ttl, rData }) as DnsRecord
const A = (ttl: string) => rec('A', ttl, { ipAddress: '93.184.216.34' })
const CNAME = (ttl: string) => rec('CNAME', ttl, { cname: 'example.net' }, 'www.example.com')
const ok = (node: string, records: DnsRecord[], zones: string[] = []): NodeCache => ({ node, kind: 'ok', records, zones })

describe('reading the domain from every node', () => {
  it('asks cache/list once per node, with that node and the domain on screen', async () => {
    const spy = vi.spyOn(api, 'listNode').mockResolvedValue({ kind: 'ok', data: { domain: 'example.com', zones: [], records: [A('60 (1m)')] } })
    const reads = await readAcross('t', 'example.com', [{ name: 'ns1', type: 'Primary' }, { name: 'ns2', type: 'Secondary' }])
    expect(spy.mock.calls).toEqual([
      ['cache', 't', 'example.com', undefined, 'ns1'],
      ['cache', 't', 'example.com', undefined, 'ns2'],
    ])
    expect(reads.map((r) => r.kind)).toEqual(['ok', 'ok'])
  })

  it('a node the server walked down to another domain holds nothing here', async () => {
    vi.spyOn(api, 'listNode').mockResolvedValue({ kind: 'ok', data: { domain: 'www.example.com', zones: [], records: [CNAME('9 (9s)')] } })
    const [read] = await readAcross('t', 'example.com', [{ name: 'ns1', type: 'Primary' }])
    expect(read).toEqual({ node: 'ns1', kind: 'ok', records: [], zones: [] })
  })

  it('a node that fails carries the server message', async () => {
    vi.spyOn(api, 'listNode').mockResolvedValue({ kind: 'error', message: 'No such node.' })
    const [read] = await readAcross('t', 'example.com', [{ name: 'ns3', type: 'Secondary' }])
    expect(read).toEqual({ node: 'ns3', kind: 'failed', message: 'No such node.' })
  })
})

describe('merging the nodes', () => {
  const reads: NodeCache[] = [
    ok('ns1', [A('2141 (35m41s)'), CNAME('2910 (48m30s)')], ['api.example.com']),
    ok('ns2', [A('1974 (32m54s)')], ['cdn.example.com', 'api.example.com']),
    { node: 'ns3', kind: 'failed', message: 'down' },
  ]

  it('one row per name, type and value, with each node its own copy', () => {
    const rows = mergeAcross(reads)
    expect(rows).toHaveLength(2)
    expect(rows[0].record.type).toBe('A')
    expect(rows[0].held.get('ns1')?.ttl).toBe('2141 (35m41s)')
    expect(rows[0].held.get('ns2')?.ttl).toBe('1974 (32m54s)')
    expect(rows[1].held.has('ns2')).toBe(false)
  })

  it('the same type with another value is another row', () => {
    const rows = mergeAcross([ok('ns1', [A('1 (1s)')]), ok('ns2', [rec('A', '1 (1s)', { ipAddress: '10.0.0.1' })])])
    expect(rows).toHaveLength(2)
  })

  it('every and some are measured over the nodes that answered', () => {
    const rows = mergeAcross(reads)
    const held = answered(reads)
    expect(held).toEqual(['ns1', 'ns2'])
    expect(spreadOf(rows[0], held)).toBe('every')
    expect(spreadOf(rows[1], held)).toBe('some')
    expect(filterRows(rows, 'all', held)).toHaveLength(2)
    expect(filterRows(rows, 'every', held).map((r) => r.record.type)).toEqual(['A'])
    expect(filterRows(rows, 'some', held).map((r) => r.record.type)).toEqual(['CNAME'])
  })

  it('the zones under the domain on any node, once each, sorted', () => {
    expect(zonesAcross(reads)).toEqual(['api.example.com', 'cdn.example.com'])
  })
})

describe('readAcross reuses the node the screen has just read', () => {
  it('asks every other node, and takes the known answer for the chosen one', async () => {
    const spy = vi.spyOn(api, 'listNode').mockResolvedValue({ kind: 'ok', data: { domain: 'example.com', zones: [], records: [] } } as never)
    const nodes = [{ name: 'ns1.test', type: 'Primary' }, { name: 'ns2.test', type: 'Secondary' }] as never
    const out = await readAcross('t', 'example.com', nodes, { node: 'ns1.test', records: [], zones: ['api.example.com'] })
    expect(spy.mock.calls.map((c) => c[4])).toEqual(['ns2.test'])
    expect(out[0]).toEqual({ node: 'ns1.test', kind: 'ok', records: [], zones: ['api.example.com'] })
    spy.mockRestore()
  })
})
