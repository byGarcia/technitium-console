import { describe, expect, it, vi, afterEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Apps, type AlertState } from './Apps'
import { AppConfig } from './AppConfig'
import { isAdvancedBlocking } from './app-kinds'
import type { InstalledApp, StoreApp } from '../../api/apps'
import * as api from '../../api/apps'

afterEach(() => {
  vi.restoreAllMocks()
  window.history.replaceState(null, '', '/')
})

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

/* One installed app is one row of the installed table, named by the app. */
function card(name: string) {
  return within(screen.getByRole('row', { name: name }))
}

/*
`Uninstall` lives in the row's menu since 2026-09-07, which is where every other
destructive verb that repeats once per item lives (`ui/Menu`). Opening it is part
of the action now, so the tests open it.
*/
async function openMenu(name: string) {
  await userEvent.click(card(name).getByRole('button', { name: `Actions for ${name}` }))
  return within(await screen.findByRole('menu'))
}

/* The names of the installed table's rows, in the order drawn. */
function rowNames() {
  return screen
    .getAllByRole('row')
    .map((r) => r.getAttribute('aria-label'))
    .filter((n): n is string => n != null)
}

describe('Apps: installed list', () => {
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
    await screen.findByRole('row', { name: 'Auto PTR' })

    expect(rowNames()).toEqual(['Zone Alias', 'Auto PTR'])

    const sort = screen.getByRole('button', { name: /Installed Apps/ })
    await userEvent.click(sort)
    expect(rowNames()).toEqual(['Auto PTR', 'Zone Alias'])
    await userEvent.click(sort)
    expect(rowNames()).toEqual(['Zone Alias', 'Auto PTR'])
  })

  it('it draws one row per app, with name, upstream version label and description', async () => {
    withApps([UP_TO_DATE, WITH_UPDATE])
    render(<Apps token="t" />)

    expect(await screen.findByRole('row', { name: 'What Is My Dns' })).toBeInTheDocument()
    expect(card('What Is My Dns').getByText('Version 9.0')).toBeInTheDocument()
    // One line at rest; the description is upstream's More Details, under the row.
    expect(screen.queryByText('Returns the IP address of the user DNS Server.')).toBeNull()
    await userEvent.click(card('What Is My Dns').getByRole('button', { name: 'More Details' }))
    expect(screen.getByText('Returns the IP address of the user DNS Server.')).toBeInTheDocument()
  })

  /* Upstream's footer, apps.js:41. */
  it('the foot counts the installed apps with the upstream text', async () => {
    withApps([UP_TO_DATE, WITH_UPDATE])
    render(<Apps token="t" />)

    expect(await screen.findByText('Total Apps: 2')).toBeInTheDocument()
  })

  it('it announces the new version and offers \"Store Update\" only if there is one', async () => {
    withApps([UP_TO_DATE, WITH_UPDATE])
    render(<Apps token="t" />)

    await screen.findByRole('row', { name: 'NO DATA' })
    expect(card('NO DATA').getByText('Update 6.0')).toBeInTheDocument()
    expect(card('NO DATA').getByRole('button', { name: 'Store Update' })).toBeInTheDocument()
    expect(
      card('What Is My Dns').queryByRole('button', { name: 'Store Update' }),
    ).not.toBeInTheDocument()
  })

  /* apps.js:129-132. "Update" (your own zip) and "Store Update" are two
     different actions, not two names for the same one. */
  /*
  Two visible verbs and one in the menu. The split is not cosmetic: `Config` and
  `Update` are harmless and repeat once per card without cost, and `Uninstall` is
  the one that cannot be undone. `ui/Menu` is where this console puts that, on
  every other collection it has.
  */
  it('each row offers Config and Update, and keeps Uninstall in its menu', async () => {
    withApps([UP_TO_DATE])
    render(<Apps token="t" />)
    await screen.findByRole('row', { name: 'What Is My Dns' })

    for (const n of ['Config', 'Update']) {
      expect(card('What Is My Dns').getByRole('button', { name: n })).toBeInTheDocument()
    }
    expect(
      card('What Is My Dns').queryByRole('button', { name: 'Uninstall' }),
    ).not.toBeInTheDocument()

    const menu = await openMenu('What Is My Dns')
    for (const n of ['Config', 'Update', 'Uninstall']) {
      expect(menu.getByRole('menuitem', { name: n })).toBeInTheDocument()
    }
    expect(menu.queryByRole('menuitem', { name: 'Store Update' })).not.toBeInTheDocument()
  })

  it('the detail shows the class, its labels and the data template', async () => {
    withApps([UP_TO_DATE])
    render(<Apps token="t" />)
    await screen.findByRole('row', { name: 'What Is My Dns' })

    const more = card('What Is My Dns').getByRole('button', { name: 'More Details' })
    await userEvent.click(more)
    expect(more).toHaveAttribute('aria-expanded', 'true')
    const detail = within(screen.getAllByText('NoData.App').map((e) => e.closest('tr')).find(Boolean)!)
    // Under the class, as in the Kind column of the row above.
    expect(detail.getByText('APP Record')).toBeInTheDocument()
    expect(card('What Is My Dns').getByText('APP Record')).toBeInTheDocument()
    expect(detail.getByText(/blockedTypes/)).toBeInTheDocument()
  })

  it('with no apps installed it explains what they are and offers to open the store', async () => {
    withApps([])
    withStore([])
    render(<Apps token="t" />)

    expect(await screen.findByText('No apps installed')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Open App Store' })).toBeInTheDocument()
    expect(screen.queryByText('0 installed')).not.toBeInTheDocument()
  })

  it('if the server fails, it says so and does not blow up', async () => {
    vi.spyOn(api, 'listApps').mockResolvedValue({ kind: 'error', message: 'Boom' })
    render(<Apps token="t" />)

    expect(await screen.findByText('Boom')).toBeInTheDocument()
  })
})

describe('Apps: uninstalling', () => {
  /*
  The confirmation is the console's dialog, not the browser's native
  `confirm()`: uninstalling an app was one of the three steps that still opened
  the operating system's. The text is still upstream's literal (`apps.js:425`).
  */
  it('it asks for confirmation with the literal text of upstream', async () => {
    withApps([UP_TO_DATE])
    const spy = vi.spyOn(api, 'uninstallApp')
    render(<Apps token="t" />)
    await screen.findByRole('row', { name: 'What Is My Dns' })

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
    await screen.findByRole('row', { name: 'What Is My Dns' })

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

describe('Apps: Store Update from the card', () => {
  it('it updates with the name and url of the app and alerts with the literal text', async () => {
    withApps([WITH_UPDATE])
    const spy = vi
      .spyOn(api, 'downloadAndUpdate')
      .mockResolvedValue({ kind: 'ok', data: { status: 'ok' } } as never)
    render(<Apps token="t" />)
    await screen.findByRole('row', { name: 'NO DATA' })

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

describe('Apps: config of the app', () => {
  it('it reads the config from the primary node and opens it in a text editor', async () => {
    withApps([UP_TO_DATE])
    const spy = vi.spyOn(api, 'getAppConfig').mockResolvedValue({
      kind: 'ok',
      data: { status: 'ok', response: { config: '{ "a": 1 }' } },
    } as never)
    render(<Apps token="t" />)
    await screen.findByRole('row', { name: 'What Is My Dns' })

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
    await screen.findByRole('row', { name: 'What Is My Dns' })

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
    await screen.findByRole('row', { name: 'What Is My Dns' })

    await userEvent.click(card('What Is My Dns').getByRole('button', { name: 'Config' }))
    await userEvent.type(await screen.findByLabelText('Config File'), 'hello')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(spy.mock.calls[0][1]).toBe('What Is My Dns')
    expect(spy.mock.calls[0][2]).toBe('hello')
    expect(
      await screen.findByText(
        "The DNS application 'What Is My Dns' config was saved and reloaded successfully.",
      ),
    ).toBeInTheDocument()
  })
})

describe('Apps: install from file', () => {
  it('it requires the name BEFORE the file, with the literal texts', async () => {
    withApps([])
    withStore([])
    render(<Apps token="t" />)
    await screen.findByText('No apps installed')

    await userEvent.click(screen.getByRole('button', { name: 'Install from file' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Install' }))
    expect(await screen.findByText('Please enter an application name.')).toBeInTheDocument()

    await userEvent.type(screen.getByLabelText('App Name'), 'Mine')
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
    await userEvent.type(await screen.findByLabelText('App Name'), 'Mine')
    await userEvent.upload(screen.getByLabelText('App Zip File'), new File(['x'], 'a.zip'))
    await userEvent.click(screen.getByRole('button', { name: 'Install' }))

    expect(spy.mock.calls[0][1]).toBe('Mine')
    expect((spy.mock.calls[0][2] as File).name).toBe('a.zip')
  })
})

describe('Apps: update from file', () => {
  it('it comes with the name filled in and unchangeable, and requires the file', async () => {
    withApps([UP_TO_DATE])
    const spy = vi.spyOn(api, 'updateApp')
    render(<Apps token="t" />)
    await screen.findByRole('row', { name: 'What Is My Dns' })

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

describe('Apps: the store', () => {
  /*
  Upstream's store header is a sort link (index.html:6166) and this screen had
  dropped it. `check-parity-controls.mjs` never saw the loss: it counts
  destinations, helps and examples, and a sort affordance is none of those: the
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
        .getAllByRole('row')
        .map((r) => r.getAttribute('aria-label'))
        .filter((n) => n != null)

    await screen.findByText('Total Apps: 2')
    expect(names()).toEqual(['Zone Alias', 'Auto PTR'])

    const sort = within(screen.getByRole('dialog')).getByRole('button', { name: /Store Apps/ })
    await userEvent.click(sort)
    expect(names()).toEqual(['Auto PTR', 'Zone Alias'])

    await userEvent.click(sort)
    expect(names()).toEqual(['Zone Alias', 'Auto PTR'])
  })

  it('it lists what is available with version, zip and size', async () => {
    withApps([WITH_UPDATE])
    withStore(STORE)
    render(<Apps token="t" />)
    await screen.findByRole('row', { name: 'NO DATA' })
    await openStore()

    const row = within(await screen.findByRole('row', { name: 'Advanced Blocking' }))
    expect(row.getByText('Version 11.1')).toBeInTheDocument()
    expect(row.getByText(/61\.54 KB/)).toBeInTheDocument()
    // The zip is upstream's More Details, under the row.
    await userEvent.click(row.getByRole('button', { name: 'More Details' }))
    expect(screen.getByText(/AdvancedBlockingApp-v11\.1\.zip/)).toBeInTheDocument()
    expect(screen.getByText('Total Apps: 2')).toBeInTheDocument()
  })

  it('an installed one shows its installed version, the new one, Update and Uninstall', async () => {
    withApps([WITH_UPDATE])
    withStore(STORE)
    render(<Apps token="t" />)
    await screen.findByRole('row', { name: 'NO DATA' })
    await openStore()

    const row = within(
      await within(screen.getByRole('dialog')).findByRole('row', { name: 'NO DATA' }),
    )
    expect(row.getByText('Version 5.0')).toBeInTheDocument()
    expect(row.getByText('Update 6.0')).toBeInTheDocument()
    expect(row.queryByRole('button', { name: 'Install' })).not.toBeInTheDocument()
    expect(row.getByRole('button', { name: 'Update' })).toBeInTheDocument()
    expect(row.getByText('Installed')).toBeInTheDocument()
    // Uninstall is the row's menu's, as every repeated destructive verb here.
    expect(row.queryByRole('button', { name: 'Uninstall' })).not.toBeInTheDocument()
    await userEvent.click(row.getByRole('button', { name: 'Actions for NO DATA' }))
    expect(within(await screen.findByRole('menu')).getByRole('menuitem', { name: 'Uninstall' })).toBeInTheDocument()
  })

  it('a store app that is not installed offers Install and no menu', async () => {
    withApps([])
    withStore(STORE)
    render(<Apps token="t" />)
    await screen.findByText('No apps installed')
    await openStore()

    const row = within(await screen.findByRole('row', { name: 'Advanced Blocking' }))
    expect(row.getByRole('button', { name: 'Install' })).toBeInTheDocument()
    expect(row.queryByText('Installed')).not.toBeInTheDocument()
    expect(row.queryByRole('button', { name: /Actions for/ })).not.toBeInTheDocument()
  })

  /*
  The search (deviation 17): it narrows the rows by name or description, asks the
  server nothing more, and leaves `Total Apps` counting the whole catalogue.
  */
  it('the search narrows the rows by name or description and keeps the total', async () => {
    withApps([])
    const spy = withStore(STORE)
    render(<Apps token="t" />)
    await screen.findByText('No apps installed')
    await openStore()
    await screen.findByText('Total Apps: 2')

    const dialog = within(screen.getByRole('dialog'))
    await userEvent.type(dialog.getByLabelText('Search'), 'block LISTS')
    expect(dialog.getByRole('row', { name: 'Advanced Blocking' })).toBeInTheDocument()
    expect(dialog.queryByRole('row', { name: 'NO DATA' })).not.toBeInTheDocument()
    expect(dialog.getByText('Total Apps: 2')).toBeInTheDocument()

    await userEvent.clear(dialog.getByLabelText('Search'))
    await userEvent.type(dialog.getByLabelText('Search'), 'nothing like this')
    expect(dialog.getByText('No Apps Found')).toBeInTheDocument()
    expect(spy).toHaveBeenCalledTimes(1)
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

    const row = within(await screen.findByRole('row', { name: 'Advanced Blocking' }))
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
    await screen.findByRole('row', { name: 'NO DATA' })
    await openStore()

    const row = within(
      await within(screen.getAllByRole('dialog')[0]).findByRole('row', { name: 'NO DATA' }),
    )
    await userEvent.click(row.getByRole('button', { name: 'Actions for NO DATA' }))
    await userEvent.click(within(await screen.findByRole('menu')).getByRole('menuitem', { name: 'Uninstall' }))
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

describe('Apps: the redrawn table and dialogs (deviation 17)', () => {
  it('the search narrows by name or description, writes ?q= and asks the server nothing', async () => {
    window.history.replaceState(null, '', '/apps/')
    const spy = withApps([UP_TO_DATE, WITH_UPDATE])
    const { unmount } = render(<Apps token="t" />)
    await screen.findByRole('row', { name: 'What Is My Dns' })
    await userEvent.type(screen.getByLabelText('Search'), 'user dns')
    expect(rowNames()).toEqual(['What Is My Dns'])
    expect(window.location.search).toBe('?q=user+dns')
    expect(screen.getByText('Total Apps: 2, 1 shown')).toBeInTheDocument()
    expect(spy).toHaveBeenCalledTimes(1)
    unmount()
    expect(window.location.search).toBe('')
  })

  it('the config editor says whether the text is JSON, and Save still sends it as typed', async () => {
    withApps([UP_TO_DATE])
    vi.spyOn(api, 'getAppConfig').mockResolvedValue({
      kind: 'ok',
      data: { status: 'ok', response: { config: '{ "a": 1 }' } },
    } as never)
    const save = vi.spyOn(api, 'setAppConfig').mockResolvedValue({ kind: 'ok', data: { status: 'ok' } } as never)
    render(<Apps token="t" />)
    await screen.findByRole('row', { name: 'What Is My Dns' })
    await userEvent.click(card('What Is My Dns').getByRole('button', { name: 'Config' }))
    const editor = await screen.findByLabelText('Config File')
    expect(screen.getByText('Valid JSON')).toBeInTheDocument()
    await userEvent.type(editor, ',')
    expect(screen.getByText(/^Not valid JSON/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(save.mock.calls[0][2]).toBe('{ "a": 1 },')
  })

  it('the zip file field is still the file input its label names', async () => {
    withApps([UP_TO_DATE])
    render(<Apps token="t" />)
    await screen.findByRole('row', { name: 'What Is My Dns' })
    await userEvent.click(screen.getByRole('button', { name: /Install from file/ }))
    const input = await screen.findByLabelText('App Zip File')
    expect(input).toHaveAttribute('type', 'file')
    await userEvent.upload(input, new File(['zip'], 'my-app.zip', { type: 'application/zip' }))
    expect(screen.getByText('my-app.zip')).toBeInTheDocument()
    expect(screen.getByText('3 B')).toBeInTheDocument()
  })
})

/*
The way in to the Advanced Blocking editor. The app is known by its class, not its
name: a zip uploaded under another name is still that app, and an app that only
carries the name is not.
*/
describe('Apps: the way in to the Advanced Blocking editor', () => {
  const BLOCKER: InstalledApp = {
    ...UP_TO_DATE,
    name: 'Advanced Blocking',
    dnsApps: [{ ...DETAIL, classPath: 'AdvancedBlocking.App' }],
  }

  it('the class says which app it is, not the name', () => {
    expect(isAdvancedBlocking({ ...BLOCKER, name: 'My Upload' })).toBe(true)
    expect(isAdvancedBlocking({ ...UP_TO_DATE, name: 'Advanced Blocking' })).toBe(false)
    expect(isAdvancedBlocking({ ...BLOCKER, dnsApps: [DETAIL, BLOCKER.dnsApps[0]] })).toBe(true)
  })

  it('only the row of the app with that class offers it, as a real link', async () => {
    withApps([BLOCKER, UP_TO_DATE])
    render(<Apps token="t" />)
    await screen.findByRole('row', { name: 'Advanced Blocking' })

    expect(card('Advanced Blocking').getByRole('link', { name: 'Visual Editor' })).toHaveAttribute(
      'href',
      '/apps/advanced-blocking/',
    )
    expect(card('What Is My Dns').queryByRole('link', { name: 'Visual Editor' })).toBeNull()
  })

  it('it comes before Config in the row', async () => {
    withApps([BLOCKER])
    render(<Apps token="t" />)
    await screen.findByRole('row', { name: 'Advanced Blocking' })
    const link = card('Advanced Blocking').getByRole('link', { name: 'Visual Editor' })
    const config = card('Advanced Blocking').getByRole('button', { name: 'Config' })
    expect(link.compareDocumentPosition(config) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('it is in the row menu too, and only for that app', async () => {
    withApps([BLOCKER, UP_TO_DATE])
    render(<Apps token="t" />)
    await screen.findByRole('row', { name: 'Advanced Blocking' })

    const menu = await openMenu('Advanced Blocking')
    expect(menu.getByRole('menuitem', { name: 'Visual Editor' })).toHaveAttribute('href', '/apps/advanced-blocking/')
    await userEvent.keyboard('{Escape}')

    const other = await openMenu('What Is My Dns')
    expect(other.queryByRole('menuitem', { name: 'Visual Editor' })).toBeNull()
  })

  it('a plain click moves the console and leaves the search of the list behind', async () => {
    window.history.replaceState(null, '', '/apps/?q=block')
    withApps([BLOCKER])
    const heard = vi.fn()
    window.addEventListener('popstate', heard)
    render(<Apps token="t" />)
    await screen.findByRole('row', { name: 'Advanced Blocking' })
    await userEvent.click(card('Advanced Blocking').getByRole('link', { name: 'Visual Editor' }))
    window.removeEventListener('popstate', heard)
    expect(window.location.pathname + window.location.search).toBe('/apps/advanced-blocking/')
    expect(heard).toHaveBeenCalledTimes(1)
  })

  it('with two installed, each address says which one', async () => {
    withApps([BLOCKER, { ...BLOCKER, name: 'Second Blocker' }])
    render(<Apps token="t" />)
    await screen.findByRole('row', { name: 'Advanced Blocking' })
    expect(card('Advanced Blocking').getByRole('link', { name: 'Visual Editor' })).toHaveAttribute(
      'href',
      '/apps/advanced-blocking/?name=Advanced+Blocking',
    )
    const menu = await openMenu('Second Blocker')
    expect(menu.getByRole('menuitem', { name: 'Visual Editor' })).toHaveAttribute(
      'href',
      '/apps/advanced-blocking/?name=Second+Blocker',
    )
  })

  it('the search does not hide the second one from that count', async () => {
    window.history.replaceState(null, '', '/apps/?q=second')
    withApps([BLOCKER, { ...BLOCKER, name: 'Second Blocker' }])
    render(<Apps token="t" />)
    await screen.findByRole('row', { name: 'Second Blocker' })
    expect(rowNames()).toEqual(['Second Blocker'])
    expect(card('Second Blocker').getByRole('link', { name: 'Visual Editor' })).toHaveAttribute(
      'href',
      '/apps/advanced-blocking/?name=Second+Blocker',
    )
  })

  it('Config still opens the dialog on that row', async () => {
    withApps([BLOCKER])
    const read = vi.spyOn(api, 'getAppConfig').mockResolvedValue({
      kind: 'ok',
      data: { status: 'ok', response: { config: '{ "a": 1 }' } },
    } as never)
    render(<Apps token="t" />)
    await screen.findByRole('row', { name: 'Advanced Blocking' })
    await userEvent.click(card('Advanced Blocking').getByRole('button', { name: 'Config' }))
    expect(await screen.findByText('App Config - Advanced Blocking')).toBeInTheDocument()
    expect(screen.getByLabelText('Config File')).toHaveValue('{ "a": 1 }')
    expect(read.mock.calls.find((c) => c[1] === 'Advanced Blocking')).toBeTruthy()
  })
})

describe('AppConfig: what the editor passes it', () => {
  function dialog(extra: Partial<React.ComponentProps<typeof AppConfig>> = {}) {
    const onSaved = vi.fn()
    render(
      <AppConfig
        open
        onOpenChange={() => {}}
        token="t"
        name="Blocker"
        initialConfig="{}"
        onSaved={onSaved}
        {...extra}
      />,
    )
    return onSaved
  }

  const writes = () => vi.spyOn(api, 'setAppConfig').mockResolvedValue({ kind: 'ok', data: { status: 'ok' } } as never)

  it('without the new props it saves and reports as before', async () => {
    const save = writes()
    const onSaved = dialog()
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith('Blocker'))
    expect(save.mock.calls.find((c) => c[1] === 'Blocker')).toEqual(['t', 'Blocker', '{}'])
  })

  it('a beforeSave with an alert shows it and writes nothing', async () => {
    const save = writes()
    const conflict: AlertState = { type: 'danger', title: 'Error!', text: 'This config changed on the server after you opened it.' }
    const onSaved = dialog({ beforeSave: async () => conflict })
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByText('This config changed on the server after you opened it.')).toBeInTheDocument()
    expect(save).not.toHaveBeenCalled()
    expect(onSaved).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled()
  })

  it('a beforeSave with no alert lets it write', async () => {
    const save = writes()
    const beforeSave = vi.fn(async () => null)
    const onSaved = dialog({ beforeSave })
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith('Blocker'))
    expect(beforeSave).toHaveBeenCalledTimes(1)
    expect(save).toHaveBeenCalledTimes(1)
  })

  it('Save waits for the beforeSave', async () => {
    writes()
    let finish: (alert: AlertState | null) => void = () => {}
    dialog({ beforeSave: () => new Promise((resolve) => { finish = resolve }) })
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
    finish({ type: 'danger', title: 'Error!', text: 'No.' })
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled())
  })

  it('the note is drawn above the Config File field', () => {
    dialog({ note: <p>Saved over the draft.</p> })
    const note = screen.getByText('Saved over the draft.')
    const field = screen.getByLabelText('Config File')
    expect(note.compareDocumentPosition(field) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })
})
