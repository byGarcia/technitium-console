/*
The same thing in Zones, where the collection archetype was defined.

Zones had its own design round —pilot 2— and this still got through: `zones`
starts as an empty array, so the wait drew "1-0 (0) of 0 zones" and an empty
table, which is what a server with no zones draws. A round that validated a
surface did not validate this state, which is the argument for the matrix.
*/
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { ZoneList } from './ZoneList'
import * as client from '../../api/client'

describe('a zone list that has not answered yet', () => {
  beforeEach(() => vi.restoreAllMocks())
  afterEach(() => vi.restoreAllMocks())

  const noop = () => {}
  const props: Parameters<typeof ZoneList>[0] = {
    token: 't',
    canModify: true,
    canDelete: true,
    onNotice: noop,
    onConfirm: noop,
    onAdd: noop,
    onOpen: noop,
    onImport: noop,
    onConvert: noop,
    onClone: noop,
    onPermissions: noop,
    onOptions: noop,
    refresh: 0,
  }

  it('says it is loading instead of showing an empty table', async () => {
    vi.spyOn(client, 'apiRequest').mockImplementation(() => new Promise<never>(() => {}) as never)
    render(<ZoneList {...props} />)
    expect(await screen.findByRole('status')).toHaveTextContent('Loading…')
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('and a failed first load is not left saying it is loading', async () => {
    vi.spyOn(client, 'apiRequest').mockResolvedValue({ kind: 'error', message: 'Nope' } as never)
    render(<ZoneList {...props} />)
    await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument())
  })
})
