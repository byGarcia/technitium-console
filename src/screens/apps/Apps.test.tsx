import { describe, expect, it, vi, afterEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Apps } from './Apps'
import type { InstalledApp, StoreApp } from '../../api/apps'
import * as api from '../../api/apps'

afterEach(() => vi.restoreAllMocks())

const DETAIL = {
  classPath: 'NoData.App',
  description: 'Returns a NO DATA response.',
  recordDataTemplate: '{ "blockedTypes": [ "A" ] }',
  isAppRecordRequestHandler: true,
  isRequestController: false,
  isAuthoritativeRequestHandler: false,
  isRequestBlockingHandler: false,
  isQueryLogger: false,
  isQueryLogs: false,
  isPostProcessor: false,
}

const UP_TO_DATE: InstalledApp = {
  name: 'What Is My Dns',
  description: 'Returns the IP address of the user DNS Server.',
  version: '9.0',
  updateVersion: '9.0',
  updateUrl: 'https://x/WhatIsMyDnsApp-v9.zip',
  updateAvailable: false,
  dnsApps: [DETAIL],
}

const WITH_UPDATE: InstalledApp = {
  name: 'NO DATA',
  description: 'Allows creating APP records that return NO DATA.',
  version: '5.0',
  updateVersion: '6.0',
  updateUrl: 'https://x/NoDataApp-v6.zip',
  updateAvailable: true,
  dnsApps: [DETAIL],
}

function withApps(apps: InstalledApp[]) {
  return vi
    .spyOn(api, 'listApps')
    .mockResolvedValue({ kind: 'ok', data: { status: 'ok', response: { apps } } } as never)
}

function withStore(storeApps: StoreApp[]) {
  return vi
    .spyOn(api, 'listStoreApps')
    .mockResolvedValue({ kind: 'ok', data: { status: 'ok', response: { storeApps } } } as never)
}

function card(name: string) {
  return within(screen.getByRole('listitem', { name: name }))
}

/*
`Uninstall` lives in the card's menu since 2026-09-07, which is where every other
destructive verb that repeats once per item lives (`ui/Menu`). Opening it is part
of the action now, so the tests open it.
*/
async function openMenu(name: string) {
  await userEvent.click(card(name).getByRole('button', { name: `Actions — ${name}` }))
  return within(await screen.findByRole('menu'))
}

describe('Apps — installed list', () => {
  /*
  The second sort this screen had lost. Upstream's installed list is a table whose
  `Installed Apps` header sorts it; this is a card grid, so the affordance is not
  a column header, but the control is the same one.
  */
  it('the installed grid can be sorted by name, both ways', async () => {
    withApps([
      { ...UP_TO_DATE, name: 'Zone Alias' },
      { ...UP_TO_DATE, name: 'Auto PTR' },
    ])
    render(<Apps token="t" />)
    await screen.findByRole('listitem', { name: 'Auto PTR' })

    const names = () => screen.getAllByRole('listitem').map((li) => li.getAttribute('aria-label'))
    expect(names()).toEqual(['Zone Alias', 'Auto PTR'])

    const sort = screen.getByRole('button', { name: 'Sort by name' })
    await userEvent.click(sort)
    expect(names()).toEqual(['Auto PTR', 'Zone Alias'])
    await userEvent.click(sort)
    expect(names()).toEqual(['Zone Alias', 'Auto PTR'])
  })

  it('it draws one card per app, with name, version and description', async () => {
    withApps([UP_TO_DATE, WITH_UPDATE])
    render(<Apps token="t" />)

    expect(await screen.findByRole('listitem', { name: 'What Is My Dns' })).toBeInTheDocument()
    expect(card('What Is My Dns').getByText(/v9\.0/)).toBeInTheDocument()
    expect(
      card('What Is My Dns').getByText('Returns the IP address of the user DNS Server.'),
    ).toBeInTheDocument()
  })

  it('it announces in the header how many apps have an update', async () => {
    withApps([UP_TO_DATE, WITH_UPDATE])
    render(<Apps token="t" />)

    expect(await screen.findByText('1 update available')).toBeInTheDocument()
    // The installed count is gone: the header pill is for STATE, and counting
    // rows with that same look was an inconsistency.
    expect(screen.queryByText(/^\d+ instaladas?$/)).not.toBeInTheDocument()
  })

  it('with no updates it does not show the pill', async () => {
    withApps([UP_TO_DATE])
    render(<Apps token="t" />)

    await screen.findByRole('listitem', { name: 'What Is My Dns' })
    expect(screen.queryByText(/update available/)).not.toBeInTheDocument()
  })

  it('it announces the new version and offers \"Store Update\" only if there is one', async () => {
    withApps([UP_TO_DATE, WITH_UPDATE])
    render(<Apps token="t" />)

    await screen.findByRole('listitem', { name: 'NO DATA' })
    expect(card('NO DATA').getByText('Update v6.0')).toBeInTheDocument()
    expect(card('NO DATA').getByRole('button', { name: 'Store Update' })).toBeInTheDocument()
    expect(
      card('What Is My Dns').queryByRole('button', { name: 'Store Update' }),
    ).not.toBeInTheDocument()
  })

  /* apps.js:129-132 — "Update" (your own zip) and "Store Update" are two
     different actions, not two names for the same one. */
  /*
  Two visible verbs and one in the menu. The split is not cosmetic: `Config` and
  `Update` are harmless and repeat once per card without cost, and `Uninstall` is
  the one that cannot be undone. `ui/Menu` is where this console puts that, on
  every other collection it has.
  */
  it('each card offers Config and Update, and keeps Uninstall in its menu', async () => {
    withApps([UP_TO_DATE])
    render(<Apps token="t" />)
    await screen.findByRole('listitem', { name: 'What Is My Dns' })

    for (const n of ['Config', 'Update']) {
      expect(card('What Is My Dns').getByRole('button', { name: n })).toBeInTheDocument()
    }
    expect(
      card('What Is My Dns').queryByRole('button', { name: 'Uninstall' }),
    ).not.toBeInTheDocument()

    const menu = await openMenu('What Is My Dns')
    expect(menu.getByRole('menuitem', { name: 'Uninstall' })).toBeInTheDocument()
  })

  it('the detail shows the class, its labels and the data template', async () => {
    withApps([UP_TO_DATE])
    render(<Apps token="t" />)
    await screen.findByRole('listitem', { name: 'What Is My Dns' })

    await userEvent.click(card('What Is My Dns').getByText('More Details'))
    expect(card('What Is My Dns').getByText('NoData.App')).toBeInTheDocument()
    expect(card('What Is My Dns').getByText('APP Record')).toBeInTheDocument()
    expect(card('What Is My Dns').getByText(/blockedTypes/)).toBeInTheDocument()
  })

  it('with no apps installed it explains what they are and offers to open the store', async () => {
    withApps([])
    withStore([])
    render(<Apps token="t" />)

    expect(await screen.findByText('No apps installed')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Open App Store' })).toBeInTheDocument()
    expect(screen.queryByText('0 instaladas')).not.toBeInTheDocument()
  })

  it('if the server fails, it says so and does not blow up', async () => {
    vi.spyOn(api, 'listApps').mockResolvedValue({ kind: 'error', message: 'Boom' })
    render(<Apps token="t" />)

    expect(await screen.findByText('Boom')).toBeInTheDocument()
  })
})

describe('Apps — uninstalling', () => {
  /*
  The confirmation is the console's dialog, not the browser's native
  `confirm()`: uninstalling an app was one of the three steps that still opened
  the operating system's. The text is still upstream's literal (`apps.js:425`).
  */
  it('it asks for confirmation with the literal text of upstream', async () => {
    withApps([UP_TO_DATE])
    const spy = vi.spyOn(api, 'uninstallApp')
    render(<Apps token="t" />)
    await screen.findByRole('listitem', { name: 'What Is My Dns' })

    const menu = await openMenu('What Is My Dns')
    await userEvent.click(menu.getByRole('menuitem', { name: 'Uninstall' }))
    expect(
      screen.getByText(
        "Are you sure you want to uninstall the DNS application 'What Is My Dns'?",
      ),
    ).toBeInTheDocument()
    expect(spy).not.toHaveBeenCalled()
  })

  it('on confirming it uninstalls and alerts with the literal text', async () => {
    withApps([UP_TO_DATE])
    const spy = vi
      .spyOn(api, 'uninstallApp')
      .mockResolvedValue({ kind: 'ok', data: { status: 'ok' } } as never)
    render(<Apps token="t" />)
    await screen.findByRole('listitem', { name: 'What Is My Dns' })

    const menu = await openMenu('What Is My Dns')
    await userEvent.click(menu.getByRole('menuitem', { name: 'Uninstall' }))
    await userEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Uninstall' }),
    )
    expect(spy.mock.calls[0][1]).toBe('What Is My Dns')
    expect(
      await screen.findByText("DNS application 'What Is My Dns' was uninstalled successfully."),
    ).toBeInTheDocument()
  })
})

describe('Apps — Store Update from the card', () => {
  it('it updates with the name and url of the app and alerts with the literal text', async () => {
    withApps([WITH_UPDATE])
    const spy = vi
      .spyOn(api, 'downloadAndUpdate')
      .mockResolvedValue({ kind: 'ok', data: { status: 'ok' } } as never)
    render(<Apps token="t" />)
    await screen.findByRole('listitem', { name: 'NO DATA' })

    await userEvent.click(card('NO DATA').getByRole('button', { name: 'Store Update' }))
    expect(spy.mock.calls[0][1]).toBe('NO DATA')
    expect(spy.mock.calls[0][2]).toBe('https://x/NoDataApp-v6.zip')
    expect(
      await screen.findByText(
        "DNS application 'NO DATA' was updated successfully from DNS App Store.",
      ),
    ).toBeInTheDocument()
  })
})

describe('Apps — config of the app', () => {
  it('it reads the config from the primary node and opens it in a text editor', async () => {
    withApps([UP_TO_DATE])
    const spy = vi.spyOn(api, 'getAppConfig').mockResolvedValue({
      kind: 'ok',
      data: { status: 'ok', response: { config: '{ "a": 1 }' } },
    } as never)
    render(<Apps token="t" />)
    await screen.findByRole('listitem', { name: 'What Is My Dns' })

    await userEvent.click(card('What Is My Dns').getByRole('button', { name: 'Config' }))
    expect(spy.mock.calls[0][1]).toBe('What Is My Dns')
    expect(await screen.findByText('App Config - What Is My Dns')).toBeInTheDocument()
    expect(screen.getByLabelText('Config File')).toHaveValue('{ "a": 1 }')
  })

  /* The server returns `config: null` as soon as someone saves an empty one. */
  it('a null config opens the editor empty, not with \"null\"', async () => {
    withApps([UP_TO_DATE])
    vi.spyOn(api, 'getAppConfig').mockResolvedValue({
      kind: 'ok',
      data: { status: 'ok', response: { config: null } },
    } as never)
    render(<Apps token="t" />)
    await screen.findByRole('listitem', { name: 'What Is My Dns' })

    await userEvent.click(card('What Is My Dns').getByRole('button', { name: 'Config' }))
    expect(await screen.findByLabelText('Config File')).toHaveValue('')
  })

  it('it saves what was typed and alerts with the literal text', async () => {
    withApps([UP_TO_DATE])
    vi.spyOn(api, 'getAppConfig').mockResolvedValue({
      kind: 'ok',
      data: { status: 'ok', response: { config: '' } },
    } as never)
    const spy = vi
      .spyOn(api, 'setAppConfig')
      .mockResolvedValue({ kind: 'ok', data: { status: 'ok' } } as never)
    render(<Apps token="t" />)
    await screen.findByRole('listitem', { name: 'What Is My Dns' })

    await userEvent.click(card('What Is My Dns').getByRole('button', { name: 'Config' }))
    await userEvent.type(await screen.findByLabelText('Config File'), 'hola')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(spy.mock.calls[0][1]).toBe('What Is My Dns')
    expect(spy.mock.calls[0][2]).toBe('hola')
    expect(
      await screen.findByText(
        "The DNS application 'What Is My Dns' config was saved and reloaded successfully.",
      ),
    ).toBeInTheDocument()
  })
})

describe('Apps — install from file', () => {
  it('it requires the name BEFORE the file, with the literal texts', async () => {
    withApps([])
    withStore([])
    render(<Apps token="t" />)
    await screen.findByText('No apps installed')

    await userEvent.click(screen.getByRole('button', { name: 'Install from file' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Install' }))
    expect(await screen.findByText('Please enter an application name.')).toBeInTheDocument()

    await userEvent.type(screen.getByLabelText('App Name'), 'Mía')
    await userEvent.click(screen.getByRole('button', { name: 'Install' }))
    expect(
      await screen.findByText('Please select an application zip file to install.'),
    ).toBeInTheDocument()
  })

  it('with a name and a file it calls installApp', async () => {
    withApps([])
    withStore([])
    const spy = vi.spyOn(api, 'installApp')
    render(<Apps token="t" />)
    await screen.findByText('No apps installed')

    await userEvent.click(screen.getByRole('button', { name: 'Install from file' }))
    await userEvent.type(await screen.findByLabelText('App Name'), 'Mía')
    await userEvent.upload(screen.getByLabelText('App Zip File'), new File(['x'], 'a.zip'))
    await userEvent.click(screen.getByRole('button', { name: 'Install' }))

    expect(spy.mock.calls[0][1]).toBe('Mía')
    expect((spy.mock.calls[0][2] as File).name).toBe('a.zip')
  })
})

describe('Apps — update from file', () => {
  it('it comes with the name filled in and unchangeable, and requires the file', async () => {
    withApps([UP_TO_DATE])
    const spy = vi.spyOn(api, 'updateApp')
    render(<Apps token="t" />)
    await screen.findByRole('listitem', { name: 'What Is My Dns' })

    await userEvent.click(card('What Is My Dns').getByRole('button', { name: 'Update' }))
    expect(await screen.findByLabelText('App Name')).toHaveValue('What Is My Dns')
    expect(screen.getByLabelText('App Name')).toBeDisabled()

    const modal = within(screen.getByRole('dialog'))
    await userEvent.click(modal.getByRole('button', { name: 'Update' }))
    expect(
      await screen.findByText('Please select an application zip file to update.'),
    ).toBeInTheDocument()
    expect(spy).not.toHaveBeenCalled()
  })
})

const STORE: StoreApp[] = [
  {
    name: 'Advanced Blocking',
    description: 'Blocks domain names using block lists.',
    version: '11.1',
    url: 'https://x/AdvancedBlockingApp-v11.1.zip',
    size: '61.54 KB',
    installed: false,
  },
  {
    name: 'NO DATA',
    description: 'Returns NO DATA.',
    version: '6.0',
    url: 'https://x/NoDataApp-v6.zip',
    size: '12.01 KB',
    installed: true,
    installedVersion: '5.0',
    updateAvailable: true,
  },
]

async function openStore() {
  await userEvent.click(screen.getByRole('button', { name: 'App Store' }))
  return await screen.findByText('DNS App Store')
}

describe('Apps — the store', () => {
  /*
  Upstream's store header is a sort link (index.html:6166) and this screen had
  dropped it. `check-parity-controls.mjs` never saw the loss: it counts
  destinations, helps and examples, and a sort affordance is none of those — the
  same blind spot About turned up with `Disable Update Notification`.

  The API already returns the catalogue by name, so what the control does is turn
  it round, which is exactly what upstream's does.
  */
  it('the store list can be sorted by name, both ways', async () => {
    withApps([])
    withStore([
      { ...STORE[0], name: 'Zone Alias' },
      { ...STORE[0], name: 'Auto PTR' },
    ])
    render(<Apps token="t" />)
    await userEvent.click(await screen.findByRole('button', { name: 'App Store' }))

    const names = () =>
      within(screen.getByRole('dialog'))
        .getAllByRole('listitem')
        .map((li) => li.getAttribute('aria-label'))

    await screen.findByText('Total Apps: 2')
    expect(names()).toEqual(['Zone Alias', 'Auto PTR'])

    const sort = within(screen.getByRole('dialog')).getByRole('button', { name: 'Sort by name' })
    await userEvent.click(sort)
    expect(names()).toEqual(['Auto PTR', 'Zone Alias'])

    await userEvent.click(sort)
    expect(names()).toEqual(['Zone Alias', 'Auto PTR'])
  })

  it('it lists what is available with version, zip and size', async () => {
    withApps([WITH_UPDATE])
    withStore(STORE)
    render(<Apps token="t" />)
    await screen.findByRole('listitem', { name: 'NO DATA' })
    await openStore()

    const row = within(await screen.findByRole('listitem', { name: 'Advanced Blocking' }))
    expect(row.getByText('Version 11.1')).toBeInTheDocument()
    expect(row.getByText(/61\.54 KB/)).toBeInTheDocument()
    expect(row.getByText(/AdvancedBlockingApp-v11\.1\.zip/)).toBeInTheDocument()
    expect(screen.getByText('Total Apps: 2')).toBeInTheDocument()
  })

  it('an installed one shows its installed version, the new one, Update and Uninstall', async () => {
    withApps([WITH_UPDATE])
    withStore(STORE)
    render(<Apps token="t" />)
    await screen.findByRole('listitem', { name: 'NO DATA' })
    await openStore()

    const row = within(
      await within(screen.getByRole('dialog')).findByRole('listitem', { name: 'NO DATA' }),
    )
    expect(row.getByText('Version 5.0')).toBeInTheDocument()
    expect(row.getByText('Update 6.0')).toBeInTheDocument()
    expect(row.queryByRole('button', { name: 'Install' })).not.toBeInTheDocument()
    expect(row.getByRole('button', { name: 'Update' })).toBeInTheDocument()
    expect(row.getByRole('button', { name: 'Uninstall' })).toBeInTheDocument()
  })

  it('installing calls downloadAndInstall and alerts with the literal text', async () => {
    withApps([])
    withStore(STORE)
    const spy = vi
      .spyOn(api, 'downloadAndInstall')
      .mockResolvedValue({ kind: 'ok', data: { status: 'ok' } } as never)
    render(<Apps token="t" />)
    await screen.findByText('No apps installed')
    await openStore()

    const row = within(await screen.findByRole('listitem', { name: 'Advanced Blocking' }))
    await userEvent.click(row.getByRole('button', { name: 'Install' }))
    expect(spy.mock.calls[0][1]).toBe('Advanced Blocking')
    expect(spy.mock.calls[0][2]).toBe('https://x/AdvancedBlockingApp-v11.1.zip')
    expect(
      await screen.findByText(
        "DNS application 'Advanced Blocking' was installed successfully from DNS App Store.",
      ),
    ).toBeInTheDocument()
  })

  it('uninstalling from the store confirms with the literal and alerts with its own', async () => {
    withApps([WITH_UPDATE])
    withStore(STORE)
    vi.spyOn(api, 'uninstallApp').mockResolvedValue({ kind: 'ok', data: { status: 'ok' } } as never)
    render(<Apps token="t" />)
    await screen.findByRole('listitem', { name: 'NO DATA' })
    await openStore()

    const row = within(
      await within(screen.getAllByRole('dialog')[0]).findByRole('listitem', { name: 'NO DATA' }),
    )
    await userEvent.click(row.getByRole('button', { name: 'Uninstall' }))
    // The confirmation stacks over the store's dialog.
    await userEvent.click(
      within(screen.getAllByRole('dialog').at(-1)!).getByRole('button', { name: 'Uninstall' }),
    )
    expect(
      await screen.findByText("DNS application 'NO DATA' was uninstalled successfully."),
    ).toBeInTheDocument()
  })

  it('an empty store says so with the upstream text', async () => {
    withApps([])
    withStore([])
    render(<Apps token="t" />)
    await screen.findByText('No apps installed')
    await openStore()

    expect(await screen.findByText('No Apps Found')).toBeInTheDocument()
  })
})
