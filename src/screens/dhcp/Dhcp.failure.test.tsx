/*
In DHCP, a failure does not draw the empty table.

`Leases` and `Scopes` already SAID the failure —they raise the notice with the
server's message, and their code documents it— but the table went on drawing its
empty row: "No Lease Found" while the notice said the call had fallen over. Of the
two, the one believed is the table: it is what the user is looking at.

Neither of them keeps the previous data —`setLeases([])`, `setScopes([])`— so they
do not carry the other collections' stale strip: inheriting the archetype's look
is not inheriting behaviour they do not have.

And `ui/Table` and its eighteen call sites did not need touching: not drawing it
is enough.
*/
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as client from '../../api/client'
import { Leases } from './Leases'
import { Scopes } from './Scopes'

afterEach(() => vi.restoreAllMocks())

const roto = () =>
  vi.spyOn(client, 'apiRequest').mockResolvedValue({ kind: 'error', message: 'boom' } as never)
const empty = (response: unknown) =>
  vi.spyOn(client, 'apiRequest').mockResolvedValue({ kind: 'ok', data: { status: 'ok', response } } as never)

describe('Leases', () => {
  it('with no leases the table says so, as always', async () => {
    empty({ leases: [] })
    render(<Leases token="t" />)
    expect(await screen.findByText('No Lease Found')).toBeInTheDocument()
  })

  it('when the load fails, it does NOT say there are none', async () => {
    roto()
    render(<Leases token="t" />)

    expect(await screen.findByText(/Could not load the list/)).toBeInTheDocument()
    expect(screen.queryByText('No Lease Found')).not.toBeInTheDocument()
  })

  /* Nor does it invent a count: how many there are is not known. */
  it('and it does not show "Total Leases: 0"', async () => {
    roto()
    render(<Leases token="t" />)

    await screen.findByText(/Could not load the list/)
    expect(screen.queryByText(/Total Leases/)).not.toBeInTheDocument()
  })

  it('the server message is still there', async () => {
    roto()
    render(<Leases token="t" />)
    expect(await screen.findByText(/boom/)).toBeInTheDocument()
  })

  /*
  And on loading correctly again, the table comes back. Without clearing the
  failure, a correct reload would go on hiding a list that did arrive.
  */
  it('on loading correctly again, the table comes back', async () => {
    const user = userEvent.setup()
    let n = 0
    vi.spyOn(client, 'apiRequest').mockImplementation(async () => {
      n += 1
      return n === 1
        ? ({ kind: 'error', message: 'boom' } as never)
        : ({ kind: 'ok', data: { status: 'ok', response: { leases: [] } } } as never)
    })
    render(<Leases token="t" />)
    await screen.findByText(/Could not load the list/)

    await user.click(screen.getByRole('button', { name: 'Refresh' }))

    expect(await screen.findByText('No Lease Found')).toBeInTheDocument()
    expect(screen.queryByText(/Could not load the list/)).not.toBeInTheDocument()
  })
})

describe('Scopes', () => {
  it('with no scopes the table says so', async () => {
    empty({ scopes: [] })
    render(<Scopes token="t" />)
    expect(await screen.findByText('No Scope Found')).toBeInTheDocument()
  })

  it('when the load fails, it does NOT say there are none', async () => {
    roto()
    render(<Scopes token="t" />)

    expect(await screen.findByText(/Could not load the list/)).toBeInTheDocument()
    expect(screen.queryByText('No Scope Found')).not.toBeInTheDocument()
  })
})
