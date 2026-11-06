import { afterEach, describe, expect, it, vi } from 'vitest'
import * as api from '../../api/dashboard'
import type { ChartData } from '../../api/dashboard'
import { nodeSeries, nodesChart, readNodes, type NodeStats } from './compare-nodes'

afterEach(() => vi.restoreAllMocks())

const at = (m: number) => new Date(Date.UTC(2026, 10, 6, 10, m)).toISOString()
const chart = (minutes: number[], total: number[]): ChartData => ({
  labelFormat: 'HH:mm',
  labels: minutes.map((m) => `10:${String(m).padStart(2, '0')}`),
  instants: minutes.map(at),
  datasets: [{ label: 'Total', data: total }, { label: 'No Error', data: total.map(() => 0) }],
})
const ok = (node: string, c: ChartData): NodeStats => ({ node, outcome: { kind: 'ok', data: { mainChartData: c } as never } })

describe('the period read from every node', () => {
  it('asks the same period once per node, with that node', async () => {
    const spy = vi.spyOn(api, 'getDashboardStats').mockResolvedValue({ kind: 'error', message: 'x' })
    const range = { start: '2026-11-01T00:00:00.000Z', end: '2026-11-02T00:00:00.000Z' }
    const reads = await readNodes('t', 'Custom', range, [{ name: 'a', type: 'Primary' }, { name: 'b', type: 'Secondary' }])
    expect(spy.mock.calls).toEqual([['t', 'Custom', range, 'a'], ['t', 'Custom', range, 'b']])
    expect(reads.map((r) => r.node)).toEqual(['a', 'b'])
  })

  it('a fixed period sends no range', async () => {
    const spy = vi.spyOn(api, 'getDashboardStats').mockResolvedValue({ kind: 'error', message: 'x' })
    await readNodes('t', 'LastDay', null, [{ name: 'a', type: 'Primary' }])
    expect(spy).toHaveBeenCalledWith('t', 'LastDay', undefined, 'a')
  })
})

describe('the compared chart', () => {
  it('one series per node that answered, its Total only, named after it', () => {
    const axis = chart([1, 2, 3], [9, 9, 9])
    const { chart: c, failed } = nodesChart(axis, [
      ok('ns1', chart([1, 2, 3], [5, 6, 7])),
      { node: 'ns2', outcome: { kind: 'error', message: 'down' } },
      ok('ns3', chart([1, 2, 3], [4, 3, 2])),
    ])
    expect(failed).toEqual(['ns2'])
    expect(c.labels).toEqual(axis.labels)
    expect(c.datasets).toEqual([{ label: 'ns1', data: [5, 6, 7] }, { label: 'ns3', data: [4, 3, 2] }])
  })

  it('lays a node on the axis by instant: a minute ahead does not slide it, a missing one is a gap', () => {
    const axis = chart([1, 2, 3], [0, 0, 0])
    const { chart: c } = nodesChart(axis, [ok('ns1', chart([2, 3, 4], [20, 30, 40]))])
    expect(c.datasets[0].data[0]).toBeNaN()
    expect(c.datasets[0].data.slice(1)).toEqual([20, 30])
  })

  it('without instants, by position', () => {
    const axis = { ...chart([1, 2], [0, 0]), instants: undefined }
    const own = { ...chart([1, 2], [3, 4]), instants: undefined }
    expect(nodesChart(axis, [ok('ns1', own)]).chart.datasets[0].data).toEqual([3, 4])
  })

  it('each node keeps the colour of its place in the session list', () => {
    const series = nodeSeries([{ name: 'a', type: 'Primary' }, { name: 'b', type: 'Secondary' }])
    expect(series('b', 0)).toBe('--ch-2')
    expect(series('a', 5)).toBe('--ch-1')
  })
})
