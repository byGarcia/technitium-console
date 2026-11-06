/*
The selection bar, which the Zones design asked for and the build did not make.

The design's words: "**`Delete Zones` moves from the header to the selection bar**, declared
in two places and reasoned: the button lives glued to the number that says how much
it acts on". It stayed in the header, next to `Add Zone`, where it reads as a
screen-level action and nothing says it works on the ticked rows.

What these tests hold is the half that a drawing cannot: the bar is always there,
and the button in it is disabled, never hidden, until a zone is ticked. That last
part is a deliberate deviation (CONVENTIONS.md, Adrián's decision of 2026-11-05):
upstream keeps it enabled and answers an empty selection with an alert
(zone.js:1139).
*/
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ZoneList } from './ZoneList'
import * as client from '../../api/client'

const zones = {
  kind: 'ok',
  data: {
    response: {
      zones: [
        { name: 'casa.test', type: 'Primary', disabled: false, dnssecStatus: 'Unsigned', soaSerial: 1, lastModified: '2026-09-01T10:00:00Z' },
        { name: 'lab.test', type: 'Primary', disabled: false, dnssecStatus: 'Unsigned', soaSerial: 1, lastModified: '2026-09-01T10:00:00Z' },
      ],
      pageNumber: 1, totalPages: 1, totalZones: 2,
    },
  },
} as never

const props = {
  token: 't', canModify: true, canDelete: true,
  onNotice: () => {}, onConfirm: () => {}, onAdd: () => {}, onOpen: () => {},
  onEditZoneFile: () => {}, onImport: () => {}, onConvert: () => {}, onClone: () => {}, onPermissions: () => {},
  onOptions: () => {}, refresh: 0,
} as Parameters<typeof ZoneList>[0]

describe('the zone selection bar', () => {
  beforeEach(() => vi.restoreAllMocks())
  afterEach(() => vi.restoreAllMocks())

  it('the delete verb is NOT in the header any more', async () => {
    vi.spyOn(client, 'apiRequest').mockResolvedValue(zones)
    render(<ZoneList {...props} />)
    await screen.findByRole('button', { name: 'casa.test' })
    const header = screen.getByRole('heading', { name: 'Zones' }).parentElement!.parentElement!
    expect(header.textContent).toContain('Add Zone')
    expect(header.textContent).not.toContain('Delete Zones')
  })

  /* Disabled, not hidden: the verb stays where it lives, and says by itself
     that there is nothing to act on. */
  it('with nothing ticked the verb is there but disabled, and asks nothing', async () => {
    const spy = vi.spyOn(client, 'apiRequest').mockResolvedValue(zones)
    const notices: { text?: string }[] = []
    const user = userEvent.setup()
    render(<ZoneList {...props} onNotice={(n: { text?: string }) => notices.push(n)} />)
    await screen.findByRole('button', { name: 'casa.test' })

    const button = screen.getByRole('button', { name: 'Delete Zones' })
    expect(button).toBeDisabled()
    await user.click(button)
    expect(notices).toEqual([])
    expect(spy.mock.calls.find((c) => c[0] === 'zones/delete')).toBeUndefined()

    await user.click(screen.getByLabelText('Select casa.test'))
    expect(screen.getByRole('button', { name: 'Delete Zones' })).toBeEnabled()
  })

  it('and with rows ticked it says how many it would act on', async () => {
    vi.spyOn(client, 'apiRequest').mockResolvedValue(zones)
    const user = userEvent.setup()
    render(<ZoneList {...props} />)
    await screen.findByRole('button', { name: 'casa.test' })

    // By name: the quick add's two boxes come before the table's (deviation 34).
    await user.click(screen.getByLabelText('Select casa.test'))
    expect(await screen.findByText('1 of 2 zones selected')).toBeInTheDocument()
  })
})
