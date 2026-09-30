import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as client from '../../api/client'
import { Zones } from './Zones'

/*
"Edit Zone File", new in v15.5 (zone.js:1238-1316 and index.html:5083-5121 in
v15.5.1), its two entry points and the v15.5 changes to "Import Zone".
*/

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

const FILE = '$ORIGIN casa.test.\n@ 900 IN SOA ns.casa.test. hostadmin 3 900 300 604800 900\nwww 3600 IN A 10.0.0.1\n'

function zone(name: string, type: string) {
  return {
    name,
    type,
    lastModified: '2026-09-30T10:00:00Z',
    disabled: false,
    soaSerial: 3,
    catalog: null,
    dnssecStatus: 'Unsigned',
    hasDnssecPrivateKeys: false,
    notifyFailed: false,
    notifyFailedFor: [],
  }
}

const TYPES = ['Primary', 'Forwarder', 'Secondary', 'Stub', 'SecondaryForwarder', 'Catalog', 'SecondaryCatalog']
const ZONES = TYPES.map((t) => zone(`${t.toLowerCase()}.test`, t))

/** A fake server: `apiRequest` by path, and `fetch` for the text export. */
function server(opts: { exportBody?: string; exportFails?: boolean; importError?: string } = {}) {
  const exportFetch = opts.exportFails
    ? vi.fn().mockRejectedValue(new Error('offline'))
    : vi.fn().mockResolvedValue({ text: () => Promise.resolve(opts.exportBody ?? FILE) })
  vi.stubGlobal('fetch', exportFetch)

  const spy = vi.spyOn(client, 'apiRequest').mockImplementation(async (route, init) => {
    const base = route.split('?')[0]
    if (base === 'zones/list') {
      return {
        kind: 'ok',
        data: { status: 'ok', response: { zones: ZONES, pageNumber: 1, totalPages: 1, totalZones: ZONES.length } },
      } as never
    }
    if (base === 'zones/records/get') {
      const found = ZONES.find((z) => z.name === init?.body?.zone)
      if (found == null) throw new Error(`unexpected zone ${init?.body?.zone}`)
      return { kind: 'ok', data: { status: 'ok', response: { zone: found, records: [] } } } as never
    }
    if (base === 'zones/import' && opts.importError != null) {
      return { kind: 'error', message: opts.importError } as never
    }
    return { kind: 'ok', data: { status: 'ok', response: {} } } as never
  })
  return { spy, exportFetch }
}

function draw() {
  return render(<Zones token="t" canModify canDelete />)
}

async function rowMenu(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.click(await screen.findByRole('button', { name: `Actions for ${name}` }))
  return screen.findByRole('menu', { name: `Actions for ${name}` })
}

async function openZone(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.click(await screen.findByRole('button', { name }))
  await screen.findByRole('heading', { name })
}

describe('zone list row menu (v15.5)', () => {
  it.each(['Primary', 'Forwarder'])('a %s zone offers "Edit Zone" and then "Edit Zone File"', async (type) => {
    const user = userEvent.setup()
    server()
    draw()
    const menu = await rowMenu(user, `${type.toLowerCase()}.test`)

    const items = within(menu).getAllByRole('menuitem').map((b) => b.textContent)
    expect(items.slice(0, 2)).toEqual(['Edit Zone', 'Edit Zone File'])
    expect(within(menu).queryByRole('menuitem', { name: 'View Zone' })).toBeNull()
  })

  it.each(['Secondary', 'Stub', 'SecondaryForwarder', 'Catalog', 'SecondaryCatalog'])(
    'a %s zone offers only "View Zone" as its first entry',
    async (type) => {
      const user = userEvent.setup()
      server()
      draw()
      const menu = await rowMenu(user, `${type.toLowerCase()}.test`)

      expect(within(menu).getAllByRole('menuitem')[0].textContent).toBe('View Zone')
      expect(within(menu).queryByRole('menuitem', { name: 'Edit Zone' })).toBeNull()
      expect(within(menu).queryByRole('menuitem', { name: 'Edit Zone File' })).toBeNull()
    },
  )

  it('"View Zone" opens the same zone screen "Edit Zone" did', async () => {
    const user = userEvent.setup()
    server()
    draw()
    const menu = await rowMenu(user, 'secondary.test')
    await user.click(within(menu).getByRole('menuitem', { name: 'View Zone' }))
    expect(await screen.findByRole('heading', { name: 'secondary.test' })).toBeTruthy()
  })
})

describe('zone view Options menu (v15.5)', () => {
  it.each(['Primary', 'Forwarder'])('on a %s zone "Edit Zone File" is the FIRST entry', async (type) => {
    const user = userEvent.setup()
    server()
    draw()
    await openZone(user, `${type.toLowerCase()}.test`)

    await user.click(screen.getByRole('button', { name: 'Zone actions' }))
    const menu = await screen.findByRole('menu', { name: 'Zone actions' })
    expect(within(menu).getAllByRole('menuitem')[0].textContent).toBe('Edit Zone File')
  })

  it.each(['Secondary', 'Stub', 'SecondaryForwarder', 'Catalog', 'SecondaryCatalog'])(
    'on a %s zone there is no "Edit Zone File"',
    async (type) => {
      const user = userEvent.setup()
      server()
      draw()
      await openZone(user, `${type.toLowerCase()}.test`)

      await user.click(screen.getByRole('button', { name: 'Zone actions' }))
      const menu = await screen.findByRole('menu', { name: 'Zone actions' })
      expect(within(menu).queryByRole('menuitem', { name: 'Edit Zone File' })).toBeNull()
    },
  )
})

describe('the Edit Zone File dialog', () => {
  async function openFromList(user: ReturnType<typeof userEvent.setup>, name = 'primary.test') {
    const menu = await rowMenu(user, name)
    await user.click(within(menu).getByRole('menuitem', { name: 'Edit Zone File' }))
    return screen.findByRole('dialog', { name: `Edit Zone File - ${name}` })
  }

  it('reads the zone with zones/export as text and draws it in "Zone File Editor"', async () => {
    const user = userEvent.setup()
    const { exportFetch } = server()
    draw()
    const dialog = await openFromList(user)

    const editor = await within(dialog).findByLabelText('Zone File Editor')
    expect((editor as HTMLTextAreaElement).value).toBe(FILE)
    expect(String(exportFetch.mock.calls[0][0])).toBe('/api/zones/export?zone=primary.test&node=')

    // The literal texts of index.html:5106-5111 in v15.5.1.
    expect(within(dialog).getByLabelText('Overwrite SOA Serial')).toBeTruthy()
    expect(
      within(dialog).getByText(
        'Enable this option to overwrite existing SOA record serial with the SOA record serial specified in the zone file editor.',
      ),
    ).toBeTruthy()
    expect(within(dialog).getByText('The $ORIGIN and $TTL values will be automatically set if not specified.')).toBeTruthy()
    expect(
      within(dialog).getByText(
        'Overwrite SOA serial option when used to set a lower SOA serial value than the current SOA serial will cause secondary zones to fail to sync.',
      ),
    ).toBeTruthy()
  })

  it('an answer carrying status goes FORMATTED into the editor, with no alert', async () => {
    const user = userEvent.setup()
    const body = JSON.stringify({ server: 'ref', status: 'error', errorMessage: 'Access was denied.' })
    server({ exportBody: body })
    draw()
    const dialog = await openFromList(user)

    const editor = (await within(dialog).findByLabelText('Zone File Editor')) as HTMLTextAreaElement
    expect(editor.value).toBe(JSON.stringify(JSON.parse(body), null, 2))
    expect(within(dialog).queryByText('Error!')).toBeNull()
  })

  it('a read that never arrives alerts INSIDE the dialog and leaves the editor hidden', async () => {
    const user = userEvent.setup()
    server({ exportFails: true })
    draw()
    const dialog = await openFromList(user)

    expect(await within(dialog).findByText('Unable to connect to the server. Please try again.')).toBeTruthy()
    expect(within(dialog).queryByLabelText('Zone File Editor')).toBeNull()
  })

  it('"Overwrite SOA Serial" goes back to unchecked on every opening', async () => {
    const user = userEvent.setup()
    server()
    draw()
    let dialog = await openFromList(user)
    await user.click(await within(dialog).findByLabelText('Overwrite SOA Serial'))
    expect(within(dialog).getByLabelText('Overwrite SOA Serial')).toHaveProperty('checked', true)

    await user.click(within(dialog).getAllByRole('button', { name: 'Close' }).at(-1)!)
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())

    dialog = await openFromList(user)
    expect(await within(dialog).findByLabelText('Overwrite SOA Serial')).toHaveProperty('checked', false)
  })

  it('Save sends the editor as text to zones/import with overwriteZone=true and the checkbox', async () => {
    const user = userEvent.setup()
    const { spy } = server()
    draw()
    const dialog = await openFromList(user)

    const editor = await within(dialog).findByLabelText('Zone File Editor')
    await user.clear(editor)
    await user.type(editor, 'www 60 IN A 10.0.0.9')
    await user.click(within(dialog).getByLabelText('Overwrite SOA Serial'))
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      const call = spy.mock.calls.find((c) => String(c[0]).startsWith('zones/import'))
      expect(call![0]).toBe('zones/import?zone=primary.test&overwriteZone=true&overwriteSoaSerial=true&node=')
      expect(call![1]).toMatchObject({ method: 'POST', text: 'www 60 IN A 10.0.0.9' })
    })
  })

  it('on success from the list: closes, alerts "Zone Saved!" and does NOT reload the list', async () => {
    const user = userEvent.setup()
    const { spy } = server()
    draw()
    const dialog = await openFromList(user)
    await within(dialog).findByLabelText('Zone File Editor')

    const listCalls = spy.mock.calls.filter((c) => c[0] === 'zones/list').length
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))

    expect(await screen.findByText('Zone Saved!')).toBeTruthy()
    expect(screen.getByText('The zone file was saved successfully.')).toBeTruthy()
    expect(screen.queryByRole('dialog')).toBeNull()
    // zone.js:1302-1303: only `showEditZone`, and only when the zone view shows.
    expect(spy.mock.calls.filter((c) => c[0] === 'zones/list')).toHaveLength(listCalls)
  })

  it('on success from the zone view: reloads the zone', async () => {
    const user = userEvent.setup()
    const { spy } = server()
    draw()
    await openZone(user, 'primary.test')

    await user.click(screen.getByRole('button', { name: 'Zone actions' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Edit Zone File' }))
    const dialog = await screen.findByRole('dialog', { name: 'Edit Zone File - primary.test' })
    await within(dialog).findByLabelText('Zone File Editor')

    const reads = spy.mock.calls.filter((c) => c[0] === 'zones/records/get').length
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))

    expect(await screen.findByText('The zone file was saved successfully.')).toBeTruthy()
    await waitFor(() =>
      expect(spy.mock.calls.filter((c) => c[0] === 'zones/records/get').length).toBeGreaterThan(reads),
    )
  })

  it('a save the server rejects alerts inside the dialog and keeps it open', async () => {
    const user = userEvent.setup()
    server({ importError: "The zone file parser failed to parse 'rdata' field on line # 1." })
    draw()
    const dialog = await openFromList(user)
    await within(dialog).findByLabelText('Zone File Editor')
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))

    expect(
      await within(dialog).findByText("The zone file parser failed to parse 'rdata' field on line # 1."),
    ).toBeTruthy()
    expect(within(dialog).getByText('Error!')).toBeTruthy()
    expect(within(dialog).getByRole('button', { name: 'Save' })).toHaveProperty('disabled', false)
  })
})

describe('Import Zone (v15.5)', () => {
  it('the title is "Import Zone - <zone>"', async () => {
    const user = userEvent.setup()
    server()
    draw()
    const menu = await rowMenu(user, 'primary.test')
    await user.click(within(menu).getByRole('menuitem', { name: 'Import Zone' }))
    expect(await screen.findByRole('dialog', { name: 'Import Zone - primary.test' })).toBeTruthy()
  })

  it('a successful import from the list does NOT reload the list (zone.js:1387-1393)', async () => {
    const user = userEvent.setup()
    const { spy } = server()
    draw()
    const menu = await rowMenu(user, 'primary.test')
    await user.click(within(menu).getByRole('menuitem', { name: 'Import Zone' }))
    const dialog = await screen.findByRole('dialog', { name: 'Import Zone - primary.test' })
    await user.click(within(dialog).getByLabelText('Text Editor', { selector: 'input' }))
    await user.type(within(dialog).getByRole('textbox', { name: 'Text Editor' }), 'www 3600 IN A 10.0.0.2')

    const listCalls = spy.mock.calls.filter((c) => c[0] === 'zones/list').length
    await user.click(within(dialog).getByRole('button', { name: 'Import' }))

    expect(await screen.findByText('Zone Imported!')).toBeTruthy()
    expect(spy.mock.calls.filter((c) => c[0] === 'zones/list')).toHaveLength(listCalls)
  })
})
