import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import * as api from '../../api/dashboard'
import { Heatmap } from './Heatmap'
import { toIso } from '../logs/dates'

afterEach(() => vi.restoreAllMocks())

const HOUR = 3_600_000
/* The hour in progress: 15 October, 14:00 in the browser zone (whole-hour zones). */
const NOW_HOUR = Math.floor(new Date(2026, 9, 15, 14, 30).getTime() / HOUR) * HOUR

/* Answers each request with its own hours, the busiest one at 13:00 today. */
function serve() {
  return vi.spyOn(api, 'getHours').mockImplementation(async (_t, start, end) => {
    const from = Date.parse(start)
    const n = Math.round((Date.parse(end) - from) / HOUR) + 1
    const labels = Array.from({ length: n }, (_, i) => new Date(from + (i + 1) * HOUR).toISOString())
    const busy = new Date(2026, 9, 15, 13).getTime()
    return {
      kind: 'ok',
      data: {
        labelFormat: 'MM/DD HH:00', labels, instants: labels,
        datasets: [{ label: 'Total', data: labels.map((_, i) => (from + i * HOUR === busy ? 40 : 2)) }],
      },
    }
  })
}

describe('the week by hour', () => {
  it('asks the node it is given, in pieces by hour, and names every cell with its day, hour and count', async () => {
    const spy = serve()
    render(<Heatmap token="t" node="ns2.test" hour={NOW_HOUR} />)
    expect(await screen.findByLabelText('Thu 10/15, 13:00 to 14:00: 40 queries')).toBeInTheDocument()
    expect(spy.mock.calls.length).toBeGreaterThanOrEqual(1)
    for (const c of spy.mock.calls) expect(c[3]).toBe('ns2.test')
    /* The hour in progress is not drawn as a figure. */
    expect(screen.getByLabelText('Thu 10/15, 14:00: no data')).toBeInTheDocument()
  })

  it('a cell opens Query Logs for its hour, From its start To its last second', async () => {
    serve()
    const jump = vi.fn()
    render(<Heatmap token="t" node="" hour={NOW_HOUR} jump={jump} />)
    await userEvent.click(await screen.findByRole('button', { name: 'Thu 10/15, 13:00 to 14:00: 40 queries' }))
    const f = jump.mock.calls[0][0]
    expect(toIso(f.start)).toBe(new Date(2026, 9, 15, 13).toISOString())
    expect(toIso(f.end)).toBe(new Date(new Date(2026, 9, 15, 14).getTime() - 1000).toISOString())
  })

  it('without a jump the cells are not buttons', async () => {
    serve()
    render(<Heatmap token="t" node="" hour={NOW_HOUR} />)
    await screen.findByLabelText('Thu 10/15, 13:00 to 14:00: 40 queries')
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('is one stop for the keyboard, and the arrows move inside it', async () => {
    serve()
    const user = userEvent.setup()
    render(<Heatmap token="t" node="" hour={NOW_HOUR} jump={vi.fn()} />)
    await screen.findByRole('button', { name: 'Thu 10/15, 13:00 to 14:00: 40 queries' })
    expect(screen.getAllByRole('button').filter((b) => b.tabIndex === 0)).toHaveLength(1)
    await user.tab()
    expect(document.activeElement).toHaveAccessibleName('Thu 10/15, 13:00 to 14:00: 40 queries')
    await user.keyboard('{ArrowLeft}')
    expect(document.activeElement).toHaveAccessibleName('Thu 10/15, 12:00 to 13:00: 2 queries')
    await user.keyboard('{ArrowUp}')
    expect(document.activeElement).toHaveAccessibleName('Wed 10/14, 12:00 to 13:00: 2 queries')
  })

  it('the same hour asks nothing again; a new hour does', async () => {
    const spy = serve()
    const { rerender } = render(<Heatmap token="t" node="" hour={NOW_HOUR} />)
    await screen.findByLabelText('Thu 10/15, 13:00 to 14:00: 40 queries')
    const asked = spy.mock.calls.length
    rerender(<Heatmap token="t" node="" hour={NOW_HOUR} />)
    expect(spy.mock.calls.length).toBe(asked)
    rerender(<Heatmap token="t" node="" hour={NOW_HOUR + HOUR} />)
    await vi.waitFor(() => expect(spy.mock.calls.length).toBe(asked * 2))
  })

  it('a piece that fails leaves the panel saying so, not a week of quiet hours', async () => {
    serve().mockResolvedValueOnce({ kind: 'error', message: 'boom' })
    render(<Heatmap token="t" node="" hour={NOW_HOUR} />)
    expect(await screen.findByText('Could not load this data.')).toBeInTheDocument()
  })
})
