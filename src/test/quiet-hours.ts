import type { getHours } from '../api/dashboard'

/*
For tests that draw the whole Dashboard: the week by hour answered as a quiet
week, every hour asked present and at zero, so the panel draws its zeros and adds
no failure and no request of its own to what a test counts.
*/
export const quietHours: typeof getHours = async (_token, start, end) => {
  const from = Date.parse(start)
  const n = Math.round((Date.parse(end) - from) / 3_600_000) + 1
  const labels = Array.from({ length: n }, (_, i) => new Date(from + (i + 1) * 3_600_000).toISOString())
  return {
    kind: 'ok',
    data: { labelFormat: 'MM/DD HH:00', labels, instants: labels, datasets: [{ label: 'Total', data: labels.map(() => 0) }] },
  }
}
