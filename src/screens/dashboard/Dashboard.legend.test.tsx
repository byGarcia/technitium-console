/*
The `Queries` legend — and above all its interaction.

Chart.js drew it INSIDE the canvas, and its stock `onClick` switched the series
off. Moving it out to HTML means reimplementing that interaction, so it is exactly
the one that can be lost without anything saying so. Inside the canvas it could
not be checked; outside it can, and that is what this file is about.

It lives in a file APART from `Dashboard.test.tsx`, and not on a whim: `vi.mock`
is whole-module, so doubling `./Chart` there broke "it draws all FOUR charts" —the
four canvases became four doubles with the same `data-testid`. A double that makes
the test next door fail is badly placed, not badly written.
*/
import { describe, expect, it, vi, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Dashboard } from './Dashboard'
import * as api from '../../api/dashboard'

afterEach(() => vi.restoreAllMocks())

/*
The double exposes the switched-off series in an attribute. Chart.js needs a real
`<canvas>` and jsdom does not give one, so what is tested here is not the drawing:
it is that **the legend says what to switch off and the chart hears it**.
*/
vi.mock('./Chart', () => ({
  Chart: ({ hidden, type, aria }: { hidden?: ReadonlySet<string>; type: string; aria: string }) => (
    <div
      data-testid={`grafica-${type}`}
      data-aria={aria}
      data-hidden={[...(hidden ?? [])].join(',')}
    />
  ),
}))

const serie = (label: string, data: number[]) => ({ label, data })
const DATOS = {
  stats: {
    totalQueries: 15, totalNoError: 5, totalServerFailure: 0, totalNxDomain: 0,
    totalRefused: 0, totalAuthoritative: 0, totalRecursive: 0, totalCached: 0,
    totalBlocked: 0, totalDropped: 0, totalClients: 2,
    zones: 1, cachedEntries: 0, allowedZones: 0, blockedZones: 0,
    allowListZones: 0, blockListZones: 0,
  },
  mainChartData: { labels: ['a', 'b'], datasets: [serie('Total', [10, 5]), serie('No Error', [4, 1])] },
  queryResponseChartData: { labels: ['a'], datasets: [serie('x', [1])] },
  queryTypeChartData: { labels: ['a'], datasets: [serie('x', [1])] },
  protocolTypeChartData: { labels: ['a'], datasets: [serie('x', [1])] },
  topClients: [], topDomains: [], topBlockedDomains: [],
}

const pintar = () => {
  vi.spyOn(api, 'getDashboardStats').mockResolvedValue({ kind: 'ok', data: DATOS } as never)
  render(<Dashboard token="t" />)
}
const line = () => screen.getByTestId('grafica-line')
const seriesButton = (n: RegExp) => screen.getByRole('button', { name: n })

describe('the Queries legend', () => {
  it('draws one entry per series, with its count', async () => {
    pintar()
    expect(await screen.findByRole('button', { name: /^Total/ })).toHaveTextContent('15')
    expect(seriesButton(/^No Error/)).toHaveTextContent('5')
  })

  it('they all start switched on', async () => {
    pintar()
    expect(await screen.findByRole('button', { name: /^Total/ })).toHaveAttribute('aria-pressed', 'true')
    expect(line()).toHaveAttribute('data-hidden', '')
  })

  /* The one that matters: that pressing switches off, and the chart hears it. */
  it('pressing a series switches it off, and the chart receives it', async () => {
    const user = userEvent.setup()
    pintar()
    await user.click(await screen.findByRole('button', { name: /^Total/ }))

    expect(seriesButton(/^Total/)).toHaveAttribute('aria-pressed', 'false')
    expect(line()).toHaveAttribute('data-hidden', 'Total')
  })

  it('and pressing again switches it back on', async () => {
    const user = userEvent.setup()
    pintar()
    await user.click(await screen.findByRole('button', { name: /^Total/ }))
    await user.click(seriesButton(/^Total/))

    expect(seriesButton(/^Total/)).toHaveAttribute('aria-pressed', 'true')
    expect(line()).toHaveAttribute('data-hidden', '')
  })

  /* Independent: switching one off cannot switch the others off. */
  it('switching one off leaves the others on', async () => {
    const user = userEvent.setup()
    pintar()
    await user.click(await screen.findByRole('button', { name: /^Total/ }))

    expect(seriesButton(/^No Error/)).toHaveAttribute('aria-pressed', 'true')
    expect(line()).toHaveAttribute('data-hidden', 'Total')
  })

  /* It is reachable by keyboard, which inside the canvas it was not. */
  it('it toggles with the keyboard', async () => {
    const user = userEvent.setup()
    pintar()
    await screen.findByRole('button', { name: /^Total/ })

    seriesButton(/^Total/).focus()
    await user.keyboard('{Enter}')

    expect(seriesButton(/^Total/)).toHaveAttribute('aria-pressed', 'false')
  })
})

/*
The DOUGHNUT ones, which is where the first attempt left two things behind.

Only `Queries` had the legend; the three doughnuts still carried theirs inside the
canvas, even though the delivery shows their percentages outside. And what is
switched off there is not a series but a POINT: a doughnut has one dataset and as
many slices as labels, so treating them alike would have switched off the whole
chart on pressing one slice.
*/
describe('the doughnut charts legend', () => {
  const WITH_SLICES = {
    ...DATOS,
    queryTypeChartData: { labels: ['A', 'AAAA', 'PTR'], datasets: [serie('', [60, 30, 10])] },
  }
  const pintarSectores = () => {
    vi.spyOn(api, 'getDashboardStats').mockResolvedValue({ kind: 'ok', data: WITH_SLICES } as never)
    render(<Dashboard token="t" />)
  }

  it('they have a legend outside the canvas, with its percentage', async () => {
    pintarSectores()
    expect(await screen.findByRole('button', { name: /^A / })).toHaveTextContent('60.00%')
    expect(seriesButton(/^AAAA/)).toHaveTextContent('30.00%')
    expect(seriesButton(/^PTR/)).toHaveTextContent('10.00%')
  })

  /* The percentage is written as on the cards: a dot and two decimals. */
  it('the percentage is formatted like the card', async () => {
    pintarSectores()
    expect(await screen.findByRole('button', { name: /^A / })).not.toHaveTextContent(',')
  })

  it('pressing a slice switches it off without switching off the others', async () => {
    const user = userEvent.setup()
    pintarSectores()
    await user.click(await screen.findByRole('button', { name: /^A / }))

    expect(seriesButton(/^A /)).toHaveAttribute('aria-pressed', 'false')
    expect(seriesButton(/^AAAA/)).toHaveAttribute('aria-pressed', 'true')
  })
})

/*
And the refresh after hiding — tested on a DOUGHNUT chart, and the why matters
more than the test.

Written first against the line chart, **the test passed just the same with the
reset removed**: `Line` sits behind `!loading`, so it unmounts on every refresh and
its state dies with it. There the reset is redundant and the test proved nothing.

`Split` does not unmount: it depends only on `data`, which keeps the old value
while the new one arrives. So that is where the reset does the work, and where
removing it shows: without it the button would stay at `aria-pressed="false"`
while the slice has come back — the control and the thing controlled disagreeing.

Keeping it was no good either: Chart.js's stock legend loses its state on every
rebuild, so remembering it would be inventing a memory the console does not have.
*/
describe('when new data arrives', () => {
  const sectores = (labels: string[]) => ({
    ...DATOS,
    queryTypeChartData: { labels, datasets: [serie('', labels.map((_, i) => 10 * (i + 1)))] },
  })

  it('the switched-off slices come back on', async () => {
    const user = userEvent.setup()
    const spy = vi
      .spyOn(api, 'getDashboardStats')
      .mockResolvedValueOnce({ kind: 'ok', data: sectores(['A', 'AAAA']) } as never)
      .mockResolvedValue({ kind: 'ok', data: sectores(['A', 'AAAA']) } as never)
    render(<Dashboard token="t" />)

    await user.click(await screen.findByRole('button', { name: /^A / }))
    expect(seriesButton(/^A /)).toHaveAttribute('aria-pressed', 'false')

  /* Changing the period is what brings new data. */
    await user.click(screen.getByRole('button', { name: 'Last Day' }))

    await vi.waitFor(() => {
      expect(seriesButton(/^A /)).toHaveAttribute('aria-pressed', 'true')
    })
    expect(spy).toHaveBeenCalledTimes(2)
  })
})

/*
What these tests do NOT cover, said here.

Inside `Chart`, the effect that applies the visibility depends on `data` so it is
applied again when Chart.js rebuilds the chart. **That is not tested in this
file**: `Chart` is doubled, so its effect never runs. And it cannot be tested in
jsdom, which does not give a `<canvas>` with a 2D context.

It is written down rather than simulated: a test that doubles the very piece it
wants to check verifies nothing, and that already happened once in this session.
*/
