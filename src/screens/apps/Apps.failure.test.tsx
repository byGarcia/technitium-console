/*
In Apps, a failure is not drawn as "there are no apps".

This screen **does not keep the previous data** on failure —`setApps([])`— so it
does not carry the other collections' stale strip: inheriting the archetype's look
is not inheriting behaviour it does not have. What it does inherit is the phase 1
rule: *dashed = empty, solid = error, and they are not swapped*.

And here it mattered more than in the others. The gap said "No apps installed"
**and offered to open the store**: it not only asserted something it did not know
—there may be ten installed and the call may have fallen over— it invited you to
act on that false premise.
*/
import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as client from '../../api/client'
import { Apps } from './Apps'

afterEach(() => vi.restoreAllMocks())

const withApps = (apps: unknown[]) =>
  vi.spyOn(client, 'apiRequest').mockResolvedValue({
    kind: 'ok', data: { status: 'ok', response: { apps } },
  } as never)

describe('Apps with no apps, and Apps that could not load', () => {
  it('with none installed, it says so and offers the store', async () => {
    withApps([])
    render(<Apps token="t" />)

    expect(await screen.findByText('No apps installed')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Open App Store' })).toBeInTheDocument()
  })

  it('when the load fails, it does NOT say there are none', async () => {
    vi.spyOn(client, 'apiRequest').mockResolvedValue({ kind: 'error', message: 'boom' } as never)
    render(<Apps token="t" />)

    expect(await screen.findByText(/Could not load the installed apps/)).toBeInTheDocument()
    expect(screen.queryByText('No apps installed')).not.toBeInTheDocument()
  })

  /* And it does not invite action: whether there are apps is not known. */
  it('and it does not offer the store on a premise it does not know', async () => {
    vi.spyOn(client, 'apiRequest').mockResolvedValue({ kind: 'error', message: 'boom' } as never)
    render(<Apps token="t" />)

    await screen.findByText(/Could not load the installed apps/)
    expect(screen.queryByRole('button', { name: 'Open App Store' })).not.toBeInTheDocument()
  })

  /* The server's message still comes out: the gap says WHAT happened, the notice WHY. */
  it('the server message is still there', async () => {
    vi.spyOn(client, 'apiRequest').mockResolvedValue({ kind: 'error', message: 'boom' } as never)
    render(<Apps token="t" />)

    expect(await screen.findByText(/boom/)).toBeInTheDocument()
  })

  /*
  And on loading correctly again, the failure is cleared. Without this, a correct
  reload would go on showing the error gap over a list that did arrive —the
  control saying one thing and the thing controlled another.
  */
  it('on loading correctly again, the failure gap goes away', async () => {
    let n = 0
    vi.spyOn(client, 'apiRequest').mockImplementation(async () => {
      n += 1
      return n === 1
        ? ({ kind: 'error', message: 'boom' } as never)
        : ({ kind: 'ok', data: { status: 'ok', response: { apps: [] } } } as never)
    })
    const { rerender } = render(<Apps token="t" />)
    await screen.findByText(/Could not load the installed apps/)

    rerender(<Apps token="t2" />)

    expect(await screen.findByText('No apps installed')).toBeInTheDocument()
    expect(screen.queryByText(/Could not load the installed apps/)).not.toBeInTheDocument()
  })
})
