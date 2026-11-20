import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AddZone } from './AddZone'
import { ImportZone } from './ImportZone'
import * as zones from '../../../api/zones'
import * as settings from '../../../api/settings'
import { valueShown } from '../../../test/dropdown'
import { deferred, type Deferred } from '../../../test/deferred'

/* Add Zone and Import Zone against zone.js:26-197 and 2812-2998. */

afterEach(() => vi.restoreAllMocks())

function draw(over: Partial<Parameters<typeof AddZone>[0]> = {}) {
  return render(
    <AddZone
      open
      token="t"
      useSoaSerialDateScheme={false}
      dnssecValidation
      onClose={() => {}}
      onCreated={() => {}}
      {...over}
    />,
  )
}

describe('Add Zone', () => {
  it("an initialised cluster's catalog comes up chosen", async () => {
    vi.spyOn(zones, 'listCatalogs').mockResolvedValue(['cluster-catalog.example', 'other.test'])
    vi.spyOn(settings, 'getTsigKeyNames').mockResolvedValue([])
    draw({ clusterDomain: 'example' })
    const catalog = await screen.findByRole('combobox', { name: 'Catalog Zone' })
    await vi.waitFor(() => expect(valueShown(catalog)).toBe('cluster-catalog.example'))
  })

  it('without a cluster no catalog is chosen', async () => {
    vi.spyOn(zones, 'listCatalogs').mockResolvedValue(['cluster-catalog.example'])
    vi.spyOn(settings, 'getTsigKeyNames').mockResolvedValue([])
    draw()
    const catalog = await screen.findByRole('combobox', { name: 'Catalog Zone' })
    expect(valueShown(catalog)).not.toBe('cluster-catalog.example')
  })

  it('"Use This Server" puts the protocol on UDP, and unticking it empties the forwarder', async () => {
    const user = userEvent.setup()
    vi.spyOn(zones, 'listCatalogs').mockResolvedValue([])
    vi.spyOn(settings, 'getTsigKeyNames').mockResolvedValue([])
    draw()
    await user.click(screen.getByRole('radio', { name: 'Conditional Forwarder Zone' }))
    await user.click(screen.getByRole('radio', { name: 'DNS-over-TLS' }))
    await user.type(screen.getByLabelText('Forwarder'), '1.1.1.1')

    await user.click(screen.getByRole('checkbox', { name: 'Use "This Server"' }))
    expect(screen.getByRole('radio', { name: 'DNS-over-UDP (default)' })).toBeChecked()

    await user.click(screen.getByRole('checkbox', { name: 'Use "This Server"' }))
    expect(screen.getByLabelText('Forwarder')).toHaveValue('')
    expect(screen.getByRole('radio', { name: 'DNS-over-UDP (default)' })).toBeChecked()
  })

  it('switching to a secondary reads the TSIG keys again and starts on none', async () => {
    const user = userEvent.setup()
    vi.spyOn(zones, 'listCatalogs').mockResolvedValue([])
    const keys = vi.spyOn(settings, 'getTsigKeyNames').mockResolvedValue(['k1'])
    draw()
    await user.click(screen.getByRole('radio', { name: 'Secondary Zone' }))
    expect(keys).toHaveBeenCalledTimes(2)
    expect(valueShown(screen.getByRole('combobox', { name: 'TSIG Key Name (Optional)' }))).not.toBe('k1')
  })
})

describe('Import Zone', () => {
  it('File, Text, File keeps the file chosen, shown and sent', async () => {
    const user = userEvent.setup()
    const spy = vi.spyOn(zones, 'importZone').mockResolvedValue({ kind: 'ok', data: {} } as never)
    render(<ImportZone open zone="casa.test" token="t" onClose={() => {}} onDone={() => {}} />)
    const file = new File(['@ IN A 10.0.0.1'], 'casa.zone', { type: 'text/plain' })
    const input = document.querySelector('input[type=file]') as HTMLInputElement
    await user.upload(input, file)

    await user.click(screen.getByRole('radio', { name: 'Text Editor' }))
    await user.click(screen.getByRole('radio', { name: 'Zone File' }))

    expect((document.querySelector('input[type=file]') as HTMLInputElement).files?.[0]).toBe(file)
    await user.click(screen.getByRole('button', { name: 'Import' }))
    expect(spy.mock.calls[0][2]).toEqual({ file })
  })
})

/*
Answers that arrive out of order. Add Zone stays mounted in Zones and reads the
catalogs and TSIG keys of the node it is opened on. Closed, and opened again on
another node with the first reads in flight, it offers only that node's.
*/
describe('Add Zone: answers out of order', () => {
  it('offers only the catalogs and keys of the node it was opened on last', async () => {
    const user = userEvent.setup()
    const catalogs = new Map<string, Deferred<string[] | null>>()
    const keys = new Map<string, Deferred<string[]>>()
    vi.spyOn(zones, 'listCatalogs').mockImplementation((_t, node = '') => {
      const d = deferred<string[] | null>()
      catalogs.set(node, d)
      return d.promise
    })
    vi.spyOn(settings, 'getTsigKeyNames').mockImplementation((_t, node = '') => {
      const d = deferred<string[]>()
      keys.set(node, d)
      return d.promise
    })
    const view = draw({ node: 'a.example' })
    await waitFor(() => expect(catalogs.has('a.example')).toBe(true))
    view.rerender(<AddZone open={false} token="t" node="a.example" useSoaSerialDateScheme={false} dnssecValidation onClose={() => {}} onCreated={() => {}} />)
    view.rerender(<AddZone open token="t" node="b.example" useSoaSerialDateScheme={false} dnssecValidation onClose={() => {}} onCreated={() => {}} />)
    await waitFor(() => expect(catalogs.has('b.example')).toBe(true))

    await act(async () => {
      catalogs.get('b.example')!.resolve(['catalog-b.test'])
      keys.get('b.example')!.resolve(['key-b'])
    })
    await act(async () => {
      catalogs.get('a.example')!.resolve(['catalog-a.test'])
      keys.get('a.example')!.resolve(['key-a'])
    })
    await user.click(screen.getByRole('combobox', { name: 'Catalog Zone' }))
    expect(screen.getByRole('option', { name: 'catalog-b.test' })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'catalog-a.test' })).not.toBeInTheDocument()
    await user.keyboard('{Escape}')
    await user.click(screen.getByRole('radio', { name: 'Secondary Zone' }))
    await act(async () => keys.get('b.example')!.resolve(['key-b']))
    await user.click(screen.getByRole('combobox', { name: 'TSIG Key Name (Optional)' }))
    expect(screen.getByRole('option', { name: 'key-b' })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'key-a' })).not.toBeInTheDocument()
  })
})

/*
Enter adds the zone, as the stock console's Add Zone does: its modal is a form whose
Add button is the submit (index.html:3929 and 4232).
*/
describe('Add Zone: Enter', () => {
  it('Enter in the zone name adds the zone', async () => {
    const user = userEvent.setup()
    vi.spyOn(zones, 'listCatalogs').mockResolvedValue([])
    vi.spyOn(settings, 'getTsigKeyNames').mockResolvedValue([])
    const create = vi.spyOn(zones, 'createZone').mockResolvedValue({ kind: 'ok', data: { response: { domain: 'enter.test' } } } as never)
    draw()
    await user.type(screen.getByLabelText('Zone'), 'enter.test{Enter}')
    expect(create).toHaveBeenCalledTimes(1)
    expect(create.mock.calls[0][1]).toMatchObject({ zone: 'enter.test' })
  })

  it('Enter in a textarea is a new line and adds nothing', async () => {
    const user = userEvent.setup()
    vi.spyOn(zones, 'listCatalogs').mockResolvedValue([])
    vi.spyOn(settings, 'getTsigKeyNames').mockResolvedValue([])
    const create = vi.spyOn(zones, 'createZone')
    draw()
    await user.click(screen.getByRole('radio', { name: 'Secondary Zone' }))
    const area = screen.getByLabelText(/Primary Name Server Addresses/)
    await user.type(area, '10.0.0.1{Enter}10.0.0.2')
    expect(area).toHaveValue('10.0.0.1\n10.0.0.2')
    expect(create).not.toHaveBeenCalled()
  })
})
