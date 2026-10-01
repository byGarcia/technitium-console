import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { REAL, realServer } from '../../test/real-blocking'
import { Rules } from './Rules'

/*
Rules fed with the harness's real `blocked/export` and `allowed/export`
(`test/real-blocking.ts`): `text/plain`, one zone per line, read through
`readRuleExport` as in production. The counts are checked against the same
moment's `dashboard/stats/get`, which counts the same zones on its own.
*/

const lines = (t: string) => t.split(/\r?\n/).filter((l) => l !== '')
const BLOCKED = lines(REAL.blockedExport)
const ALLOWED = lines(REAL.allowedExport)

beforeEach(() => {
  window.history.replaceState(null, '', '/blocking/rules/')
  vi.spyOn(globalThis, 'fetch').mockImplementation(realServer())
})

afterEach(() => vi.restoreAllMocks())

describe('Rules against the harness', () => {
  it('draws every exported zone once, with its kind', async () => {
    render(<Rules token="T" permissions={undefined} />)
    const table = await screen.findByRole('table')
    const rows = within(table).getAllByRole('row').slice(1)
    expect(rows).toHaveLength(BLOCKED.length + ALLOWED.length)
    for (const d of BLOCKED) expect(within(table).getByText(d).closest('tr')).toHaveTextContent('Blocked')
    for (const d of ALLOWED) expect(within(table).getByText(d).closest('tr')).toHaveTextContent('Allowed')
  })

  it('the counts agree with the figures the server gives the Overview', async () => {
    const s = REAL.statsLastHour.response.stats
    render(<Rules token="T" permissions={undefined} />)
    await screen.findByRole('table')
    expect(screen.getByRole('button', { name: `All ${s.blockedZones + s.allowedZones}` })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: `Blocked ${s.blockedZones}` })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: `Allowed ${s.allowedZones}` })).toBeInTheDocument()
  })

  it('the Allowed filter keeps only the allowed zones', async () => {
    render(<Rules token="T" permissions={undefined} />)
    await screen.findByRole('table')
    await userEvent.click(screen.getByRole('button', { name: `Allowed ${ALLOWED.length}` }))
    const table = screen.getByRole('table')
    expect(within(table).getAllByRole('row').slice(1)).toHaveLength(ALLOWED.length)
    expect(within(table).queryByText(BLOCKED[0])).toBeNull()
  })
})
