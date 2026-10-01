import { describe, expect, it } from 'vitest'
import { formatLabel, localiseLabels } from './chart-labels'

/*
What `main.js:2673-2686` does to the main chart's labels once it has asked with
`utc=true`: the server sends instants in UTC (`2026-10-01T11:29:00.0000000Z`) and the
label format; day, month and year buckets are written in UTC (the server groups them
by UTC day), anything with an hour in the viewer's local time. The local cases are
measured against the runner's own zone, whatever it is.
*/
const pad = (n: number) => String(n).padStart(2, '0')
const local = (iso: string) => new Date(iso)

describe('formatLabel, one case per format the server sends', () => {
  it('Last Hour, HH:mm, in local time', () => {
    const iso = '2026-10-01T11:29:00.0000000Z'
    const d = local(iso)
    expect(formatLabel(iso, 'HH:mm')).toBe(`${pad(d.getHours())}:${pad(d.getMinutes())}`)
  })

  it('Last Day, MM/DD HH:00, in local time, with the 00 written as it is', () => {
    const iso = '2026-09-30T23:00:00.0000000Z'
    const d = local(iso)
    expect(formatLabel(iso, 'MM/DD HH:00')).toBe(`${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:00`)
  })

  it('a short custom range, MM/DD HH:mm, in local time', () => {
    const iso = '2026-09-30T10:01:00.0000000Z'
    const d = local(iso)
    expect(formatLabel(iso, 'MM/DD HH:mm')).toBe(
      `${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`,
    )
  })

  it('Last Week and Last Month, MM/DD, in UTC: a day bucket does not move with the zone', () => {
    expect(formatLabel('2026-09-30T00:00:00.0000000Z', 'MM/DD')).toBe('09/30')
  })

  it('DD/MM, in UTC as well', () => {
    expect(formatLabel('2026-09-30T00:00:00.0000000Z', 'DD/MM')).toBe('30/09')
  })

  it('Last Year, MM/YYYY, in UTC', () => {
    expect(formatLabel('2025-10-01T00:00:00.0000000Z', 'MM/YYYY')).toBe('10/2025')
  })

  it('a label that is not an instant is left as it came', () => {
    expect(formatLabel('11:29', 'HH:mm')).toBe('11:29')
  })
})

describe('localiseLabels', () => {
  it('rewrites every label with the chart format and leaves the series alone', () => {
    const chart = {
      labelFormat: 'MM/DD',
      labels: ['2026-09-29T00:00:00.0000000Z', '2026-09-30T00:00:00.0000000Z'],
      datasets: [{ label: 'Total', data: [1, 2] }],
    }
    expect(localiseLabels(chart)).toEqual({ ...chart, labels: ['09/29', '09/30'] })
  })

  it('without a format the chart passes through untouched', () => {
    const chart = { labels: ['A', 'AAAA'], datasets: [{ label: 'Type', data: [1, 2] }] }
    expect(localiseLabels(chart)).toBe(chart)
  })
})
