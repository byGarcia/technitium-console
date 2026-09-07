/*
Stale data: the list is still there and you can see it is no longer current.

It is decision 6 of pilot 2 —"the best thing in the pilot", the case pilot 1 did
not have— and rule 3 of phase 1: *old data never looks like new data*.

What was there already kept the zones when a refresh failed, and that is right:
throwing them away would leave the user with nothing over a network error. What
was missing was SAYING SO. Without the mark, a ten-minute-old list reads like a
one-second-old one, and in a DNS console that means believing a state that no
longer exists.
*/
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as client from '../../api/client'
import { Zones } from './Zones'

afterEach(() => vi.restoreAllMocks())

const ZONE = {
  name: 'casa.test', type: 'Primary', lastModified: '2026-08-26T10:00:00Z',
  disabled: false, soaSerial: 7, catalog: null, dnssecStatus: 'Unsigned',
  hasDnssecPrivateKeys: false, notifyFailed: false, notifyFailedFor: [],
}
const LIST = { zones: [ZONE], pageNumber: 1, totalPages: 1, totalZones: 1 }

/** Responde bien la primera vez y mal a partir de la segunda. */
function goodThenBroken() {
  let n = 0
  return vi.spyOn(client, 'apiRequest').mockImplementation(async (route) => {
    const base = route.split('?')[0]
    if (base !== 'zones/list') return { kind: 'ok', data: { status: 'ok', response: {} } } as never
    n += 1
    return n === 1
      ? ({ kind: 'ok', data: { status: 'ok', response: LIST } } as never)
      : ({ kind: 'error', message: 'boom' } as never)
  })
}

const refrescar = async (user: ReturnType<typeof userEvent.setup>) =>
  user.click(screen.getByRole('button', { name: 'Go' }))

describe('stale data', () => {
  it('while the refresh goes well, there is no mark', async () => {
    vi.spyOn(client, 'apiRequest').mockResolvedValue({
      kind: 'ok', data: { status: 'ok', response: LIST },
    } as never)
    render(<Zones token="t" canModify canDelete />)

    expect(await screen.findByText('casa.test')).toBeInTheDocument()
    expect(screen.queryByText(/Could not refresh/)).not.toBeInTheDocument()
  })

  /* The one that matters: the list STAYS, and it is also said to be stale. */
  it('when the refresh fails, the list stays and it is reported', async () => {
    const user = userEvent.setup()
    goodThenBroken()
    render(<Zones token="t" canModify canDelete />)
    await screen.findByText('casa.test')

    await refrescar(user)

    await screen.findByText(/Could not refresh/)
    /* The previous one is not thrown away: that would leave the user with nothing over a network error. */
    expect(screen.getByText('casa.test')).toBeInTheDocument()
  })

  it('the strip carries the time of the last good data and a Retry', async () => {
    const user = userEvent.setup()
    goodThenBroken()
    render(<Zones token="t" canModify canDelete />)
    await screen.findByText('casa.test')

    await refrescar(user)

    const tira = (await screen.findByText(/Could not refresh/)).closest('[role=alert]')!
    expect(tira).toHaveTextContent(/Last good data:/)
    expect(within(tira as HTMLElement).getByRole('button', { name: 'Retry' })).toBeInTheDocument()
  })

  /* No selection: acting in bulk on a list that no longer reflects the server is
     how the wrong zone gets deleted. */
  it('with stale data there is no selecting', async () => {
    const user = userEvent.setup()
    goodThenBroken()
    render(<Zones token="t" canModify canDelete />)
    await screen.findByText('casa.test')
    expect(screen.getByLabelText('Select casa.test')).toBeEnabled()

    await refrescar(user)

    await screen.findByText(/Could not refresh/)
    expect(screen.getByLabelText('Select casa.test')).toBeDisabled()
    expect(screen.getByLabelText('Select all zones')).toBeDisabled()
  })

  /* And with no previous data nothing goes stale: that is a plain error, and the
     notice reports it. Marking a list that never existed promises data there is none of. */
  it('when the FIRST load fails, it does not say anything is stale', async () => {
    vi.spyOn(client, 'apiRequest').mockResolvedValue({ kind: 'error', message: 'boom' } as never)
    render(<Zones token="t" canModify canDelete />)

    await waitFor(() => expect(screen.queryByText('casa.test')).not.toBeInTheDocument())
    expect(screen.queryByText(/Could not refresh/)).not.toBeInTheDocument()
  })

  it('and when it goes well again, the mark goes away', async () => {
    const user = userEvent.setup()
    let n = 0
    vi.spyOn(client, 'apiRequest').mockImplementation(async (route) => {
      const base = route.split('?')[0]
      if (base !== 'zones/list') return { kind: 'ok', data: { status: 'ok', response: {} } } as never
      n += 1
      return n === 2
        ? ({ kind: 'error', message: 'boom' } as never)
        : ({ kind: 'ok', data: { status: 'ok', response: LIST } } as never)
    })
    render(<Zones token="t" canModify canDelete />)
    await screen.findByText('casa.test')
    await refrescar(user)
    await screen.findByText(/Could not refresh/)

    await refrescar(user)

    await waitFor(() => expect(screen.queryByText(/Could not refresh/)).not.toBeInTheDocument())
    expect(screen.getByLabelText('Select casa.test')).toBeEnabled()
  })
})

/*
A failure is reported ONCE.

With previous data the strip reports it —and it also says since when and offers a
retry— and the notice at the top keeps quiet. If both fired, the same failure
would appear twice and you would have to decide which to read. With no previous
data it is the other way round: there is nothing to go stale, so the notice
speaks, carrying the server's message.
*/
describe('who reports the failure', () => {
  it('with previous data the strip speaks, and only the strip', async () => {
    const user = userEvent.setup()
    goodThenBroken()
    render(<Zones token="t" canModify canDelete />)
    await screen.findByText('casa.test')

    await refrescar(user)

    await screen.findByText(/Could not refresh/)
    /* A single `role=alert` on the screen: the strip. The server notice does not
       duplicate the same event. */
    expect(screen.getAllByRole('alert')).toHaveLength(1)
    expect(screen.queryByText(/boom/)).not.toBeInTheDocument()
  })

  it('with no previous data the notice speaks, with the server message', async () => {
    vi.spyOn(client, 'apiRequest').mockResolvedValue({ kind: 'error', message: 'boom' } as never)
    render(<Zones token="t" canModify canDelete />)

    expect(await screen.findByText(/boom/)).toBeInTheDocument()
    expect(screen.queryByText(/Could not refresh/)).not.toBeInTheDocument()
  })
})
