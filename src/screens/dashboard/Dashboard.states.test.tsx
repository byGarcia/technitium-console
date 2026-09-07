/*
The Dashboard's states, by REGION — and above all that a failure does not disguise
itself as empty.

It is the phase 1 rule that weighs most on this screen, and not for aesthetics: a
failure drawn as "No queries for this period." tells whoever administers a DNS
that their server is receiving no traffic. `Dashboard.tsx` already denounced it
—"the screen was answering falsely about the one thing people come here to look
at"— and had only fixed it for the eleven cards, which show `—`; the panels went
on lying.
*/
import { describe, expect, it, vi, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Dashboard } from './Dashboard'
import * as api from '../../api/dashboard'

afterEach(() => vi.restoreAllMocks())

const EMPTY = {
  stats: {
    totalQueries: 0, totalNoError: 0, totalServerFailure: 0, totalNxDomain: 0,
    totalRefused: 0, totalAuthoritative: 0, totalRecursive: 0, totalCached: 0,
    totalBlocked: 0, totalDropped: 0, totalClients: 0,
    zones: 0, cachedEntries: 0, allowedZones: 0, blockedZones: 0,
    allowListZones: 0, blockListZones: 0,
  },
  mainChartData: { labels: ['a'], datasets: [{ label: 'Total', data: [0] }] },
  queryResponseChartData: { labels: ['a'], datasets: [{ label: '', data: [0] }] },
  queryTypeChartData: { labels: ['a'], datasets: [{ label: '', data: [0] }] },
  protocolTypeChartData: { labels: ['a'], datasets: [{ label: '', data: [0] }] },
  topClients: [], topDomains: [], topBlockedDomains: [],
}

describe('a server with no traffic', () => {
  it('it draws real zeros, not dashes', async () => {
    vi.spyOn(api, 'getDashboardStats').mockResolvedValue({ kind: 'ok', data: EMPTY } as never)
    render(<Dashboard token="t" />)

    /* Cero es un datum verdadero: se dibuja `0`. */
    const metrics = await screen.findByTestId('metrics')
    expect(metrics).toHaveTextContent('0')
    expect(metrics).not.toHaveTextContent('—')
  })

  it('and its regions say there is no data, not that it failed', async () => {
    vi.spyOn(api, 'getDashboardStats').mockResolvedValue({ kind: 'ok', data: EMPTY } as never)
    render(<Dashboard token="t" />)

    expect(await screen.findByText('No queries for this period.')).toBeInTheDocument()
    expect(screen.queryByText(/Could not load/)).not.toBeInTheDocument()
  })
})

describe('when the request fails', () => {
  const fallar = () =>
    vi.spyOn(api, 'getDashboardStats').mockResolvedValue({ kind: 'error', message: 'boom' } as never)

  /* The one that matters: it must NOT say the same as a quiet server. */
  it('the regions do NOT say "no queries for this period"', async () => {
    fallar()
    render(<Dashboard token="t" />)

    await screen.findAllByText(/Could not load/)
    expect(screen.queryByText('No queries for this period.')).not.toBeInTheDocument()
    expect(screen.queryByText('No data for this period.')).not.toBeInTheDocument()
  })

  it('the eleven cards go to a dash and not to zero', async () => {
    fallar()
    render(<Dashboard token="t" />)

    await screen.findAllByText(/Could not load/)
    const metrics = screen.getByTestId('metrics')
    expect(metrics).toHaveTextContent('—')
    expect(metrics).not.toHaveTextContent(/\b0\b/)
  })

  /* The detail goes ONCE, at the top, not repeated per panel. */
  it('the screen notice appears only once', async () => {
    fallar()
    render(<Dashboard token="t" />)

    await screen.findAllByText(/Could not load/)
    expect(screen.getAllByRole('alert')).toHaveLength(1)
  })

  it('and when data comes back, the failure goes away', async () => {
    vi.spyOn(api, 'getDashboardStats')
      .mockResolvedValueOnce({ kind: 'error', message: 'boom' } as never)
      .mockResolvedValue({ kind: 'ok', data: EMPTY } as never)
    const { rerender } = render(<Dashboard token="t" />)
    await screen.findAllByText(/Could not load/)

    rerender(<Dashboard token="t2" />)

    await vi.waitFor(() => {
      expect(screen.queryByText(/Could not load/)).not.toBeInTheDocument()
    })
    expect(screen.getByText('No queries for this period.')).toBeInTheDocument()
  })
})

/*
The custom range: one message at a time, next to its field, and on pressing `Show`.

Three different things, and all three can be lost separately:

  · **next to its field** was decided by phase 1 —"and never in two places at
    once"—; until now it came out in the notice at the top, half a screen from the
    field;
  · **one at a time and in order** is what `whatIsMissing` does: it returns the
    start one, and only when that is filled in, the end one;
  · **on pressing `Show`** and not before: a form that opens already in red blames
    the user for something they have not had the chance to do.
*/
describe('the custom range', () => {
  const openIt = async (user: ReturnType<typeof userEvent.setup>) => {
    vi.spyOn(api, 'getDashboardStats').mockResolvedValue({ kind: 'ok', data: EMPTY } as never)
    render(<Dashboard token="t" />)
    await user.click(await screen.findByRole('button', { name: 'Custom' }))
  }

  it('on opening it there is no error', async () => {
    const user = userEvent.setup()
    await openIt(user)

    expect(screen.getByLabelText(/Start/)).toBeInTheDocument()
    expect(screen.queryByText(/Please select/)).not.toBeInTheDocument()
  })

  it('with no dates, pressing Show shows ONLY the start one', async () => {
    const user = userEvent.setup()
    await openIt(user)
    await user.click(screen.getByRole('button', { name: 'Show' }))

    expect(screen.getByText('Please select a start date.')).toBeInTheDocument()
    expect(screen.queryByText('Please select an end date.')).not.toBeInTheDocument()
  })

  it('with the start filled in, then the end one appears', async () => {
    const user = userEvent.setup()
    await openIt(user)
    await user.type(screen.getByLabelText(/Start/), '2026-09-01')
    await user.click(screen.getByRole('button', { name: 'Show' }))

    expect(screen.getByText('Please select an end date.')).toBeInTheDocument()
    expect(screen.queryByText('Please select a start date.')).not.toBeInTheDocument()
  })

  /* Next to its field: the message lives INSIDE the label that causes it. */
  it('the message goes inside the field that causes it, not in the notice above', async () => {
    const user = userEvent.setup()
    await openIt(user)
    await user.click(screen.getByRole('button', { name: 'Show' }))

    const campo = screen.getByLabelText(/Start/).closest('label')!
    expect(campo).toHaveTextContent('Please select a start date.')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
