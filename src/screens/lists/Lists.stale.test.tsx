/*
Stale data in Cache, Allowed and Blocked.

The three are **the same component** with three wrappers, so they inherit the
collection pattern pilot 2 closed — and they had the same gap Zones did: when a
refresh failed the previous tree stayed, which is right, but nothing said it was
no longer current.

It is tested on `Cache` because it is one of the three and the component is
shared; what tells the other two apart is which endpoint they call, not how they
treat a failure.
*/
import { render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as client from '../../api/client'
import { Cache } from './Lists'

afterEach(() => vi.restoreAllMocks())

const NODE = { domain: '', zones: ['casa.test'], records: [] }

/** Responde bien la primera vez y mal a partir de la segunda. */
function goodThenBroken() {
  let n = 0
  return vi.spyOn(client, 'apiRequest').mockImplementation(async () => {
    n += 1
    return n === 1
      ? ({ kind: 'ok', data: { status: 'ok', response: NODE } } as never)
      : ({ kind: 'error', message: 'boom' } as never)
  })
}

describe('stale data in the lists', () => {
  it('while it goes well, there is no mark', async () => {
    vi.spyOn(client, 'apiRequest').mockResolvedValue({
      kind: 'ok', data: { status: 'ok', response: NODE },
    } as never)
    render(<Cache token="t" />)

    expect(await screen.findByText('casa.test')).toBeInTheDocument()
    expect(screen.queryByText(/Could not refresh/)).not.toBeInTheDocument()
  })

  it('when a refresh fails, the tree stays and it is reported once', async () => {
    goodThenBroken()
    const { rerender } = render(<Cache token="t" />)
    await screen.findByText('casa.test')

    /* Changing node is what fires the second `load`. */
    rerender(<Cache token="t2" />)

    await screen.findByText(/Could not refresh/)
    expect(screen.getByText('casa.test')).toBeInTheDocument()
    expect(screen.getAllByRole('alert')).toHaveLength(1)
    expect(screen.queryByText(/boom/)).not.toBeInTheDocument()
  })

  /* With no previous data there is nothing to go stale: the server notice speaks. */
  it('when the first load fails, it is an ordinary error', async () => {
    vi.spyOn(client, 'apiRequest').mockResolvedValue({ kind: 'error', message: 'boom' } as never)
    render(<Cache token="t" />)

    expect(await screen.findByText(/boom/)).toBeInTheDocument()
    expect(screen.queryByText(/Could not refresh/)).not.toBeInTheDocument()
  })

  it('and when it goes well again, the mark goes away', async () => {
    let n = 0
    vi.spyOn(client, 'apiRequest').mockImplementation(async () => {
      n += 1
      return n === 2
        ? ({ kind: 'error', message: 'boom' } as never)
        : ({ kind: 'ok', data: { status: 'ok', response: NODE } } as never)
    })
    const { rerender } = render(<Cache token="t" />)
    await screen.findByText('casa.test')
    rerender(<Cache token="t2" />)
    await screen.findByText(/Could not refresh/)

    rerender(<Cache token="t3" />)

    await waitFor(() => expect(screen.queryByText(/Could not refresh/)).not.toBeInTheDocument())
  })
})
