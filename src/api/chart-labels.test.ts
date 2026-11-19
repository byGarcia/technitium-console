import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { formatLabel, localiseLabels } from './chart-labels'
import { setTimezone } from '../lib/timezone'

/*
What `main.js:2673-2686` does to the main chart's labels once it has asked with
`utc=true`: the server sends instants in UTC (`2026-10-01T11:29:00.0000000Z`) and the
label format; day, month and year buckets are written in UTC (the server groups them
by UTC day), anything with an hour in the active display timezone.

Each half runs in a zone PINNED where it can fail: the UTC formats west of Greenwich
(`America/Los_Angeles`, UTC−7 in October), where a midnight-UTC instant is still the day before
in local time; the local formats east (Tokyo, UTC+9), where an evening hour in UTC is
already the next day. In a runner on UTC, or in Madrid at midnight UTC, the two halves
could not tell local from UTC apart. Node re-reads `TZ` when it is assigned, and
`vi.stubEnv` assigns it (through `vi`, not `process`: `src/` compiles without node's
types, and a `process` here passes the suite and breaks the build).
*/
function inZone(zone: string) {
  beforeAll(() => {
    vi.stubEnv('TZ', zone)
    setTimezone('local')
  })
  afterAll(() => {
    vi.unstubAllEnvs()
    setTimezone('Asia/Kolkata')
  })
}

describe('day, month and year buckets are written in UTC (runner pinned to UTC−7)', () => {
  inZone('America/Los_Angeles')

  it('the zone is really pinned: midnight UTC is still the day before here', () => {
    expect(new Date('2026-09-30T00:00:00Z').getDate()).toBe(29)
  })

  it('Last Week and Last Month, MM/DD', () => {
    expect(formatLabel('2026-09-30T00:00:00.0000000Z', 'MM/DD')).toBe('09/30')
  })

  it('DD/MM', () => {
    expect(formatLabel('2026-09-30T00:00:00.0000000Z', 'DD/MM')).toBe('30/09')
  })

  it('Last Year, MM/YYYY: the first of the month stays in its month and year', () => {
    expect(formatLabel('2026-01-01T00:00:00.0000000Z', 'MM/YYYY')).toBe('01/2026')
  })
})

describe('anything with an hour is written in local time (runner pinned to UTC+9)', () => {
  inZone('Asia/Tokyo')

  it('the zone is really pinned: 23:00 UTC is already 08:00 the next day here', () => {
    const d = new Date('2026-09-30T23:00:00Z')
    expect([d.getDate(), d.getHours()]).toEqual([1, 8])
  })

  it('Last Hour, HH:mm', () => {
    expect(formatLabel('2026-10-01T11:29:00.0000000Z', 'HH:mm')).toBe('20:29')
  })

  it('Last Day, MM/DD HH:00, with the 00 written as it is', () => {
    expect(formatLabel('2026-09-30T23:00:00.0000000Z', 'MM/DD HH:00')).toBe('10/01 08:00')
  })

  it('DD/MM HH:00', () => {
    expect(formatLabel('2026-09-30T23:00:00.0000000Z', 'DD/MM HH:00')).toBe('01/10 08:00')
  })

  it('a short custom range, MM/DD HH:mm', () => {
    expect(formatLabel('2026-09-30T20:01:00.0000000Z', 'MM/DD HH:mm')).toBe('10/01 05:01')
  })

  it('DD/MM HH:mm', () => {
    expect(formatLabel('2026-09-30T20:01:00.0000000Z', 'DD/MM HH:mm')).toBe('01/10 05:01')
  })
})

describe('chart labels format with custom display timezone', () => {
  it('formats in Asia/Kolkata (IST = UTC+05:30)', () => {
    expect(formatLabel('2026-10-01T11:29:00.0000000Z', 'HH:mm', 'Asia/Kolkata')).toBe('16:59')
    expect(formatLabel('2026-09-30T23:00:00.0000000Z', 'MM/DD HH:mm', 'Asia/Kolkata')).toBe('10/01 04:30')
  })

  it('formats in UTC', () => {
    expect(formatLabel('2026-10-01T11:29:00.0000000Z', 'HH:mm', 'UTC')).toBe('11:29')
  })
})

describe('the chart with its labels formatted', () => {
  const chart = {
    labelFormat: 'HH:mm',
    labels: ['2026-10-01T11:29:00.0000000Z', '2026-10-01T11:30:00.0000000Z'],
    datasets: [{ label: 'Total', data: [1, 2] }],
  }

  it('a label that is not an instant is left as it came', () => {
    expect(formatLabel('not a date', 'HH:mm')).toBe('not a date')
  })

  it('rewrites every label with the chart format and leaves the series alone', () => {
    const got = localiseLabels(chart, 'UTC')
    expect(got.labels).toEqual(['11:29', '11:30'])
    expect(got.datasets).toEqual(chart.datasets)
  })

  it('without a format the chart passes through untouched', () => {
    const raw = { labels: ['a', 'b'], datasets: [] }
    expect(localiseLabels(raw)).toBe(raw)
  })

  it('retains UTC instants if an already formatted chart is formatted again', () => {
    const first = localiseLabels(chart, 'UTC')
    expect(first.instants).toEqual(chart.labels)
    const second = localiseLabels(first, 'UTC')
    expect(second.instants).toEqual(chart.labels)
    expect(second.labels).toEqual(['11:29', '11:30'])
  })

  it('does not create instants from parseable legacy date labels', () => {
    const legacy = {
      labelFormat: 'MM/DD',
      labels: ['09/30', '10/01'],
      datasets: [],
    }
    const got = localiseLabels(legacy)
    expect(got.instants).toBeUndefined()
  })
})
