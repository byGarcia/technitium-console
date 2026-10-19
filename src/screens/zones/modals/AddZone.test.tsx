import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AddZone } from './AddZone'
import { ImportZone } from './ImportZone'
import * as zones from '../../../api/zones'
import * as settings from '../../../api/settings'
import { valueShown } from '../../../test/dropdown'

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
