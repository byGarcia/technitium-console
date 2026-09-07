/*
The selection bar, which pilot 2's reconciliation asked for and the build did not
make.

Its words: "**`Delete Zones` moves from the header to the selection bar**, declared
in two places and reasoned: the button lives glued to the number that says how much
it acts on". It stayed in the header, next to `Add Zone`, where it reads as a
screen-level action and nothing says it works on the ticked rows.

What these tests hold is the half that a drawing cannot: the bar is always there and
the button always works, because with nothing ticked **upstream answers**, and that
answer is behaviour.
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
  onImport: () => {}, onConvert: () => {}, onClone: () => {}, onPermissions: () => {},
  onOptions: () => {}, refresh: 0,
} as Parameters<typeof ZoneList>[0]

describe('the zone selection bar', () => {
  beforeEach(() => vi.restoreAllMocks())
  afterEach(() => vi.restoreAllMocks())

  it('the delete verb is NOT in the header any more', async () => {
    vi.spyOn(client, 'apiRequest').mockResolvedValue(zones)
    render(<ZoneList {...props} />)
    await screen.findByText('casa.test')
    const header = screen.getByRole('heading', { name: 'Zones' }).parentElement!.parentElement!
    expect(header.textContent).toContain('Add Zone')
    expect(header.textContent).not.toContain('Delete Zones')
  })

  /* The screen owns the notifier, so the answer is checked where it is raised. */
  it('with nothing ticked the verb still answers, instead of being unreachable', async () => {
    const spy = vi.spyOn(client, 'apiRequest').mockResolvedValue(zones)
    const notices: { text?: string }[] = []
    const user = userEvent.setup()
    render(<ZoneList {...props} onNotice={(n: { text?: string }) => notices.push(n)} />)
    await screen.findByText('casa.test')

    await user.click(screen.getByRole('button', { name: 'Delete Zones' }))
    expect(notices.map((n) => n.text)).toContain('Please select one or more zones to delete.')
    expect(spy.mock.calls.find((c) => c[0] === 'zones/delete')).toBeUndefined()
  })

  it('and with rows ticked it says how many it would act on', async () => {
    vi.spyOn(client, 'apiRequest').mockResolvedValue(zones)
    const user = userEvent.setup()
    render(<ZoneList {...props} />)
    await screen.findByText('casa.test')

    const boxes = screen.getAllByRole('checkbox')
    await user.click(boxes[1])
    expect(await screen.findByText('1 of 2 zones selected')).toBeInTheDocument()
  })
})
