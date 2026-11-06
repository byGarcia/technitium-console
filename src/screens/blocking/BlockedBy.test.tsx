import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import * as blocking from '../../api/blocking'
import type { QueryLogEntry } from '../../api/logs'
import { HandoffContext, type Handoff } from '../../app/handoff'
import { BlockedBy } from './BlockedBy'
import type { LoggingApp } from './logging-app'
import { SAMPLE } from './blocked-sample'

afterEach(() => vi.restoreAllMocks())

const APP: LoggingApp = { kind: 'ok', app: { name: 'Query Logs (Sqlite)', classPath: 'QueryLogsSqlite.App' } }

let row = 0
function entry(clientIpAddress: string, qtype: string, responseType = 'Blocked'): QueryLogEntry {
  row++
  return {
    rowNumber: row, timestamp: '2026-11-06T10:00:00Z', clientIpAddress, protocol: 'Udp', responseType,
    rcode: 'NxDomain', qname: 'ads.example', qtype, qclass: 'IN', answer: null,
  }
}

const ENTRIES = [
  entry('10.0.0.1', 'A'), entry('10.0.0.1', 'AAAA'), entry('10.0.0.1', 'A'),
  entry('10.0.0.2', 'A', 'Blocked'), entry('10.0.0.2', 'HTTPS', 'UpstreamBlocked'),
]

function sample(entries = ENTRIES, partial = false) {
  return vi.spyOn(blocking, 'recentBlocked').mockResolvedValue({ kind: 'ok', data: { entries, partial } })
}

function nav(): Handoff {
  return { queryDnsServer: vi.fn(), showQueryLogs: vi.fn() }
}

function draw(props: Partial<Parameters<typeof BlockedBy>[0]> = {}, handoff: Handoff | null = null) {
  const ui: ReactNode = (
    <BlockedBy
      token="T"
      app={APP}
      node="cluster"
      aggregate={false}
      serverDomain="dns1.test"
      names={[{ name: '10.0.0.1', hits: 40, domain: 'phone.home.arpa' }]}
      refreshOn={1}
      {...props}
    />
  )
  const view = render(handoff != null ? <HandoffContext.Provider value={handoff}>{ui}</HandoffContext.Provider> : ui)
  return {
    ...view,
    again: (next: Partial<Parameters<typeof BlockedBy>[0]>) =>
      view.rerender(
        handoff != null
          ? <HandoffContext.Provider value={handoff}>{<BlockedBy token="T" app={APP} node="cluster" aggregate={false} serverDomain="dns1.test" names={[]} refreshOn={1} {...next} />}</HandoffContext.Provider>
          : <BlockedBy token="T" app={APP} node="cluster" aggregate={false} serverDomain="dns1.test" names={[]} refreshOn={1} {...next} />,
      ),
  }
}

describe('Blocked by client', () => {
  it('asks for the newest blocked queries of the chosen node and counts them by client', async () => {
    const spy = sample()
    draw({ node: 'dns2.test' })
    expect(await screen.findByText('In the last 5 blocked queries')).toBeInTheDocument()
    expect(spy).toHaveBeenCalledWith('T', { name: 'Query Logs (Sqlite)', classPath: 'QueryLogsSqlite.App' }, 'dns2.test', SAMPLE)
    expect(screen.getByRole('img', { name: '10.0.0.1: 3 blocked' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: '10.0.0.2: 2 blocked' })).toBeInTheDocument()
    /* The name the Top Clients give the address, after it. */
    expect(screen.getByTitle('10.0.0.1 phone.home.arpa')).toHaveTextContent('10.0.0.1phone.home.arpa')
  })

  it('draws the types of the same entries, with their shares', async () => {
    sample()
    draw()
    const types = await screen.findByRole('region', { name: 'Blocked by type' })
    expect(within(types).getByText('A').parentElement).toHaveTextContent('A 60.00%')
    expect(within(types).getByText('AAAA').parentElement).toHaveTextContent('AAAA 20.00%')
    expect(within(types).getByText('HTTPS').parentElement).toHaveTextContent('HTTPS 20.00%')
  })

  it('with the cluster aggregate it reads the connected node and says which', async () => {
    const spy = sample()
    draw({ aggregate: true })
    expect(await screen.findByText('In the last 5 blocked queries on dns1.test')).toBeInTheDocument()
    expect(spy).toHaveBeenCalledWith('T', expect.anything(), '', SAMPLE)
  })

  it('with no blocked queries it says so and states no basis', async () => {
    sample([])
    draw()
    expect(await screen.findByText('No blocked queries.')).toBeInTheDocument()
    expect(screen.queryByText(/In the last/)).toBeNull()
    expect(screen.queryByRole('region', { name: 'Blocked by type' })).toBeNull()
  })

  it('a failed read is a failure, not an empty sample', async () => {
    vi.spyOn(blocking, 'recentBlocked').mockResolvedValue({ kind: 'error', message: 'Access was denied.' })
    draw()
    expect(await screen.findByText('Could not load this data.')).toBeInTheDocument()
    expect(screen.queryByText('No blocked queries.')).toBeNull()
  })

  it('says when one of the three classes could not be read', async () => {
    sample(ENTRIES, true)
    draw()
    expect(await screen.findByText('Some blocked queries could not be read.')).toBeInTheDocument()
  })

  it('while the logging app is looked up, or when that fails, it says so', async () => {
    const spy = sample()
    const { rerender } = render(
      <BlockedBy token="T" app={{ kind: 'loading' }} node="" aggregate={false} serverDomain={undefined} names={[]} refreshOn={1} />,
    )
    expect(screen.getByText('Loading…')).toBeInTheDocument()
    rerender(
      <BlockedBy token="T" app={{ kind: 'failed', text: 'No.' }} node="" aggregate={false} serverDomain={undefined} names={[]} refreshOn={1} />,
    )
    expect(screen.getByText('Could not load this data.')).toBeInTheDocument()
    expect(spy).not.toHaveBeenCalled()
  })

  it('a new answer of the statistics reads again, keeping the rows; a failed refresh keeps them too', async () => {
    const spy = sample()
    const { again } = draw()
    await screen.findByRole('img', { name: '10.0.0.1: 3 blocked' })
    let answer: (v: Awaited<ReturnType<typeof blocking.recentBlocked>>) => void = () => {}
    spy.mockImplementationOnce(() => new Promise((resolve) => { answer = resolve }))
    again({ refreshOn: 2 })
    expect(spy).toHaveBeenCalledTimes(2)
    expect(screen.getByRole('img', { name: '10.0.0.1: 3 blocked' })).toBeInTheDocument()
    await act(async () => answer({ kind: 'error', message: 'busy' }))
    expect(screen.getByRole('img', { name: '10.0.0.1: 3 blocked' })).toBeInTheDocument()
    expect(screen.queryByText('Could not load this data.')).toBeNull()
  })

  it('a slow answer to an earlier read does not land over a later one', async () => {
    const spy = sample()
    let first: (v: Awaited<ReturnType<typeof blocking.recentBlocked>>) => void = () => {}
    spy.mockImplementationOnce(() => new Promise((resolve) => { first = resolve }))
    const { again } = draw()
    spy.mockResolvedValueOnce({ kind: 'ok', data: { entries: [entry('10.0.0.7', 'A')], partial: false } })
    again({ refreshOn: 2 })
    expect(await screen.findByRole('img', { name: '10.0.0.7: 1 blocked' })).toBeInTheDocument()
    await act(async () => first({ kind: 'ok', data: { entries: ENTRIES, partial: false } }))
    expect(screen.queryByRole('img', { name: '10.0.0.1: 3 blocked' })).toBeNull()
  })

  it('a row opens Query Logs for that client, and for its response type when it has one', async () => {
    sample()
    const handoff = nav()
    draw({ node: 'dns2.test' }, handoff)
    await userEvent.click(await screen.findByRole('button', { name: 'Actions for 10.0.0.1' }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Show Query Logs' }))
    expect(handoff.showQueryLogs).toHaveBeenLastCalledWith(null, '10.0.0.1', 'dns2.test', { responseType: 'Blocked' })

    await userEvent.click(screen.getByRole('button', { name: 'Actions for 10.0.0.2' }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Show Query Logs' }))
    expect(handoff.showQueryLogs).toHaveBeenLastCalledWith(null, '10.0.0.2', 'dns2.test', undefined)
  })

  it('outside the Shell a row has no menu: there is nowhere to go', async () => {
    sample()
    draw()
    await screen.findByRole('img', { name: '10.0.0.1: 3 blocked' })
    expect(screen.queryByRole('button', { name: /^Actions for/ })).toBeNull()
  })
})
