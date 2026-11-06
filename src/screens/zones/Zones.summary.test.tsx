/*
The cards over the zone list (`ZoneSummary`, deviation 12) read every zone with one
unpaged `zones/list`. That read happens on an outside refresh and after a change
made from the list, not on every page or Go, and the pressed type chip is the type
the list on screen was loaded with, not one chosen in the Type field and not
applied yet.
*/
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as client from '../../api/client'
import { Zones } from './Zones'
import { chooseIn } from '../../test/dropdown'

const ZONE = {
  name: 'casa.test',
  type: 'Primary',
  lastModified: '2026-08-26T10:00:00Z',
  disabled: false,
  soaSerial: 7,
  catalog: null,
  dnssecStatus: 'Unsigned',
  hasDnssecPrivateKeys: false,
  notifyFailed: false,
  notifyFailedFor: [],
}

function server() {
  return vi.spyOn(client, 'apiRequest').mockImplementation(async (route) => {
    const base = route.split('?')[0]
    if (base === 'zones/list') {
      return {
        kind: 'ok',
        data: { status: 'ok', response: { zones: [ZONE], pageNumber: 1, totalPages: 3, totalZones: 25 } },
      } as never
    }
    return { kind: 'ok', data: { status: 'ok' } } as never
  })
}

const unpaged = (spy: ReturnType<typeof server>) =>
  spy.mock.calls.filter((c) => c[0] === 'zones/list' && c[1]?.body?.pageNumber == null).length

afterEach(() => vi.restoreAllMocks())

describe('the zone list summary', () => {
  it('is read once on arrival, not again on a page or on Go', async () => {
    const user = userEvent.setup()
    const spy = server()
    render(<Zones token="t" canModify canDelete />)
    await screen.findByRole('button', { name: 'casa.test' })
    await waitFor(() => expect(unpaged(spy)).toBe(1))

    await user.click(screen.getAllByRole('button', { name: 'Next' })[0])
    await user.click(screen.getByRole('button', { name: 'Go' }))
    await waitFor(() =>
      expect(spy.mock.calls.filter((c) => c[0] === 'zones/list' && c[1]?.body?.pageNumber != null).length).toBe(3),
    )
    expect(unpaged(spy)).toBe(1)
  })

  it('the pressed type is the one the list was loaded with, not one chosen and not applied', async () => {
    const user = userEvent.setup()
    server()
    render(<Zones token="t" canModify canDelete />)
    const chip = await screen.findByRole('button', { name: /^Primary/ })
    expect(chip).toHaveAttribute('aria-pressed', 'false')

    await chooseIn(user, 'Type', 'Primary')
    expect(chip).toHaveAttribute('aria-pressed', 'false')

    await user.click(screen.getByRole('button', { name: 'Go' }))
    await waitFor(() => expect(chip).toHaveAttribute('aria-pressed', 'true'))
  })
})
