/*
Query Logs across the cluster's nodes (deviation 37): what each node is asked, how
the answers are merged and cut, each node's total, and a node that fails.
*/
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as api from '../../api/logs'
import type { QueryLogEntry, QueryLogsParams } from '../../api/logs'
import {
  acrossParams, acrossStatus, failures, mergeNewest, mergedPage, nodeTotals, queryAcross, rowKey,
  type NodeLogs,
} from './query-across'

afterEach(() => vi.restoreAllMocks())

const e = (rowNumber: number, timestamp: string): QueryLogEntry => ({
  rowNumber, timestamp, clientIpAddress: '10.0.0.7', protocol: 'Udp', responseType: 'Recursive',
  rcode: 'NoError', qname: `r${rowNumber}.example`, qtype: 'A', qclass: 'IN', answer: null,
})

const PARAMS: QueryLogsParams = {
  name: 'Query Logs (Sqlite)', classPath: 'QueryLogsSqlite.App', pageNumber: '4', entriesPerPage: '25',
  descendingOrder: 'false', start: '', end: '', clientIpAddress: '10.0.0.7', protocol: '', responseType: 'Blocked',
  rcode: '', qname: '*.example', qtype: '', qclass: '', node: '',
}

const READS: NodeLogs[] = [
  { node: 'ns1', kind: 'ok', total: 7574, entries: [e(9, '2026-11-06T10:00:05Z'), e(8, '2026-11-06T10:00:01Z'), e(7, '2026-11-06T09:59:00Z')] },
  { node: 'ns2', kind: 'ok', total: 4414, entries: [e(30, '2026-11-06T10:00:03Z'), e(29, '2026-11-06T10:00:01Z')] },
  { node: 'ns3', kind: 'failed', message: 'The cluster node ns3 did not respond.' },
]

describe('what each node is asked', () => {
  it('the form as it is, on page 1, newest first, with that node', () => {
    expect(acrossParams(PARAMS, 'ns2')).toEqual({ ...PARAMS, pageNumber: '1', descendingOrder: 'true', node: 'ns2' })
  })

  it('sends logs/query once per node, and keeps a failure with its message', async () => {
    const spy = vi.spyOn(api, 'queryLogs').mockImplementation(async (_t, p) =>
      p.node === 'ns3'
        ? ({ kind: 'error', message: 'The cluster node ns3 did not respond.' } as never)
        : ({ kind: 'ok', data: { response: { pageNumber: 1, totalPages: 3, totalEntries: p.node === 'ns1' ? 50 : 20, entries: [e(1, '2026-11-06T10:00:00Z')] } } } as never),
    )
    const reads = await queryAcross('t', PARAMS, [
      { name: 'ns1', type: 'Primary' }, { name: 'ns2', type: 'Secondary' }, { name: 'ns3', type: 'Secondary' },
    ])
    expect(spy.mock.calls.map((c) => c[1].node)).toEqual(['ns1', 'ns2', 'ns3'])
    for (const c of spy.mock.calls) {
      expect(c[1]).toMatchObject({ pageNumber: '1', descendingOrder: 'true', entriesPerPage: '25', responseType: 'Blocked', qname: '*.example', clientIpAddress: '10.0.0.7' })
    }
    expect(reads.map((r) => (r.kind === 'ok' ? r.total : r.message))).toEqual([50, 20, 'The cluster node ns3 did not respond.'])
  })
})

describe('the merge', () => {
  it('is by timestamp, newest first, a tie in the order of the nodes, and cut to the page size', () => {
    const merged = mergeNewest(READS, 4)
    expect(merged.map((x) => `${x.node}:${x.rowNumber}`)).toEqual(['ns1:9', 'ns2:30', 'ns1:8', 'ns2:29'])
    expect(mergeNewest(READS, 25)).toHaveLength(5)
  })

  it('a row is known by its node and its number, which only its node makes unique', () => {
    expect(rowKey({ ...e(9, ''), node: 'ns1' })).not.toBe(rowKey({ ...e(9, ''), node: 'ns2' }))
    expect(rowKey(e(9, ''))).toBe('\n9')
  })

  it("each answering node's total, their sum as the page's, and the failures apart", () => {
    expect(nodeTotals(READS)).toEqual([{ node: 'ns1', total: 7574 }, { node: 'ns2', total: 4414 }])
    expect(failures(READS)).toEqual([{ node: 'ns3', message: 'The cluster node ns3 did not respond.' }])
    const page = mergedPage(READS, 3)
    expect(page).toMatchObject({ pageNumber: 1, totalPages: 1, totalEntries: 11988 })
    expect(page.entries).toHaveLength(3)
  })

  it('says it is the newest page across the nodes', () => {
    expect(acrossStatus(25)).toBe('Newest 25 across the nodes')
    expect(acrossStatus(0)).toBe('0 logs')
  })
})
