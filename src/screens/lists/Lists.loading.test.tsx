/*
Waiting is not the same as empty, in the three lists and in Zones.

The state matrix of 2026-09-07 measured what nobody had: with the list request
still in flight, `Cache`, `Allowed` and `Blocked` drew "0 zones" and an empty
tree, which is exactly what a genuinely empty list draws. Zones drew "1-0 (0) of 0
zones" and an empty table for the same reason.

It is the same lie the failure state was fixed for on these very screens — a
screen answering falsely about the one thing it exists to show — caught this time
in the state that had never been put on the bench.
*/
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { Lists } from './Lists'
import * as client from '../../api/client'

function pending() {
  return new Promise<never>(() => {})
}

describe('a list that has not answered yet', () => {
  beforeEach(() => vi.restoreAllMocks())
  afterEach(() => vi.restoreAllMocks())

  it('says it is loading instead of saying there is nothing', async () => {
    vi.spyOn(client, 'apiRequest').mockImplementation(() => pending() as never)
    render(<Lists list="cache" token="t" />)
    expect(await screen.findByRole('status')).toHaveTextContent('Loading…')
    expect(screen.queryByText('0 zones')).not.toBeInTheDocument()
  })

  it('and once it answers, the count and the tree come back', async () => {
    vi.spyOn(client, 'apiRequest').mockResolvedValue({
      kind: 'ok',
      data: { response: { domain: '', zones: [] } },
    } as never)
    render(<Lists list="cache" token="t" />)
    expect(await screen.findByText('0 zones')).toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  /*
  A first load that failed is NOT still loading: it has an answer and it is a bad
  one. Without this the screen would sit saying "loading" over a failure that has
  already been reported in the notice.
  */
  it('a failed first load is not left saying it is loading', async () => {
    vi.spyOn(client, 'apiRequest').mockResolvedValue({
      kind: 'error', message: 'Nope',
    } as never)
    render(<Lists list="cache" token="t" />)
    await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument())
  })
})
