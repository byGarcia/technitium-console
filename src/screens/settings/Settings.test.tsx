import { describe, expect, it, vi, afterEach } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Settings } from './Settings'
import { SETTINGS } from './settings.fixture'
import * as client from '../../api/client'
import { valueShown } from '../../test/dropdown'

afterEach(() => vi.restoreAllMocks())

const ok = (data: unknown) => ({ kind: 'ok' as const, data })

/** Returns the `apiRequest` spy already loaded with the real `settings/get`
 *  response so the screen starts with real data. */
function server(overrides: Record<string, unknown> = {}) {
  return vi.spyOn(client, 'apiRequest').mockImplementation(async (path: string) => {
    if (path === 'settings/get') return ok({ response: { ...SETTINGS, ...overrides } })
    if (path === 'settings/set') return ok({ response: { ...SETTINGS, ...overrides } })
    return ok({ response: {} })
  })
}

async function mount(props: Record<string, unknown> = {}) {
  const r = render(<Settings token="tok" {...props} />)
  await screen.findByRole('button', { name: 'Save Settings' })
  return r
}

describe('Settings: loading', () => {
  it('it draws General by default with the real values from the server', async () => {
    server()
    await mount()
    expect(screen.getByLabelText('DNS Server Domain')).toHaveValue('ref.technitium-ui.test')
    expect(screen.getByLabelText('Default Record TTL')).toHaveValue('3600')
    expect(screen.getByText('seconds (default 3600/1h)')).toBeInTheDocument()
  })

  it('if the server fails, it alerts instead of blowing up', async () => {
    vi.spyOn(client, 'apiRequest').mockResolvedValue({ kind: 'error', message: 'boom' })
    render(<Settings token="tok" />)
    expect(await screen.findByText('Unable to load the DNS Server settings.')).toBeInTheDocument()
  })

  it('the active sub-tab arrives by prop: the sub-navigation belongs to the Shell', async () => {
    server()
    await mount({ sub: 'Logging' })
    expect(screen.getByLabelText('Log Folder Path')).toBeInTheDocument()
    expect(screen.queryByLabelText('DNS Server Domain')).not.toBeInTheDocument()
  })

  it('the nine sub-tabs draw without breaking', async () => {
    server()
    const subs = [
      ['General', 'DNS Server Domain'],
      ['Web Service', 'Web Service HTTP Port'],
      ['Optional Protocols', 'DNS-over-TLS Port'],
      ['TSIG', 'Shared Secret'],
      ['Recursion', 'Resolver Retries'],
      ['Cache', 'Cache Maximum Entries'],
      ['Blocking', 'Blocking Answer TTL'],
      ['Proxy & Forwarders', 'Forwarder Retries'],
      ['Logging', 'Max Stat File Days'],
    ] as const
    for (const [sub, brand] of subs) {
      const { unmount } = render(<Settings token="tok" sub={sub} />)
      expect(await screen.findByText(brand)).toBeInTheDocument()
      unmount()
    }
  })
})

describe('Settings: saving', () => {
  it('it sends settings/set by POST with the fields of the nine sub-tabs', async () => {
    const spy = server()
    await mount({ sub: 'Logging' })
    await userEvent.click(screen.getByRole('button', { name: 'Save Settings' }))

    const call = await waitFor(() => {
      const c = spy.mock.calls.find((c) => c[0] === 'settings/set')
      expect(c).toBeDefined()
      return c!
    })
    expect(call[1]?.method).toBe('POST')
    const body = call[1]!.body as Record<string, string>
    expect(body.dnsServerDomain).toBe('ref.technitium-ui.test')
    expect(body.loggingType).toBe('File')
    expect(body.recursion).toBe('AllowOnlyForPrivateNetworks')
    // v15.5 removed Auto Prefetch: a v15.5 `settings/get` does not bring its two
    // values, the save must go through anyway and must not send them.
    expect(body).not.toHaveProperty('cachePrefetchSampleIntervalInMinutes')
    expect(body).not.toHaveProperty('cachePrefetchSampleEligibilityHitsPerHour')
  })

  it('Enable Cache Prefetch (new in v15.6) loads from the server and is sent as true/false', async () => {
    const spy = server()
    await mount({ sub: 'Cache' })
    const toggle = screen.getByLabelText('Enable Cache Prefetch')
    expect(toggle).toBeChecked()
    expect(screen.getByText('seconds (recommended 9)')).toBeInTheDocument()
    await userEvent.click(toggle)
    await userEvent.click(screen.getByRole('button', { name: 'Save Settings' }))

    const call = await waitFor(() => {
      const c = spy.mock.calls.find((c) => c[0] === 'settings/set')
      expect(c).toBeDefined()
      return c!
    })
    expect((call[1]!.body as Record<string, string>).enableCachePrefetch).toBe('false')
  })

  it('a v15.5 server does not send enableCachePrefetch: the box starts unchecked, as in upstream', async () => {
    const spy = server({ enableCachePrefetch: undefined })
    await mount({ sub: 'Cache' })
    expect(screen.getByLabelText('Enable Cache Prefetch')).not.toBeChecked()
    await userEvent.click(screen.getByRole('button', { name: 'Save Settings' }))
    const call = await waitFor(() => {
      const c = spy.mock.calls.find((c) => c[0] === 'settings/set')
      expect(c).toBeDefined()
      return c!
    })
    expect((call[1]!.body as Record<string, string>).enableCachePrefetch).toBe('false')
  })

  it('on a successful save, the alert is the upstream literal', async () => {
    server()
    await mount()
    await userEvent.click(screen.getByRole('button', { name: 'Save Settings' }))
    expect(await screen.findByText('Settings Saved!')).toBeInTheDocument()
    expect(screen.getByText('DNS Server settings were saved successfully.')).toBeInTheDocument()
  })

  it('a server error comes out with its errorMessage under the Error! title', async () => {
    vi.spyOn(client, 'apiRequest').mockImplementation(async (path: string) => {
      if (path === 'settings/get') return ok({ response: SETTINGS })
      return { kind: 'error' as const, message: 'Invalid Web Service HTTPS port.' }
    })
    await mount()
    await userEvent.click(screen.getByRole('button', { name: 'Save Settings' }))
    expect(await screen.findByText('Error!')).toBeInTheDocument()
    expect(screen.getByText('Invalid Web Service HTTPS port.')).toBeInTheDocument()
  })

  it('an empty field blocks the save with the literal alert, and does not call the server', async () => {
    const spy = server()
    await mount()
    await userEvent.clear(screen.getByLabelText('DNS Server Domain'))
    await userEvent.click(screen.getByRole('button', { name: 'Save Settings' }))

    expect(await screen.findByText('Please enter server domain name.')).toBeInTheDocument()
    expect(screen.getByText('Missing!')).toBeInTheDocument()
    expect(spy.mock.calls.find((c) => c[0] === 'settings/set')).toBeUndefined()
  })

  it('if the missing field is on another sub-tab, the screen jumps to it', async () => {
    server()
    const onSubChange = vi.fn()
    await mount({ sub: 'Recursion', onSubChange })
    await userEvent.clear(screen.getByLabelText('Resolver Retries'))
    // It switches to another sub-tab before saving to exercise the jump.
    await userEvent.click(screen.getByRole('button', { name: 'Save Settings' }))

    expect(await screen.findByText('Please enter a value for Resolver Retries.')).toBeInTheDocument()
    expect(onSubChange).toHaveBeenCalledWith('Recursion')
  })

  it('the validation jump is undone as soon as the Shell asks for another sub-tab', async () => {
    server()
    const { rerender } = await mount({ sub: 'General' })
    await userEvent.clear(screen.getByLabelText('DNS Server Domain'))
    await userEvent.click(screen.getByRole('button', { name: 'Save Settings' }))
    expect(await screen.findByText('Please enter server domain name.')).toBeInTheDocument()

    rerender(<Settings token="tok" sub="Logging" />)
    expect(await screen.findByLabelText('Log Folder Path')).toBeInTheDocument()
    expect(screen.queryByLabelText('DNS Server Domain')).not.toBeInTheDocument()
  })
})

describe('Settings: Blocking', () => {
  it('with no date, the labels are \"Not Set\" and \"Not Scheduled\"', async () => {
    server()
    await mount({ sub: 'Blocking' })
    expect(screen.getByText('Not Set')).toBeInTheDocument()
    expect(screen.getByText('Not Scheduled')).toBeInTheDocument()
  })

  it('\"Update Now\" is off if there are no lists configured', async () => {
    server()
    await mount({ sub: 'Blocking' })
    expect(screen.getByRole('button', { name: 'Update Now' })).toBeDisabled()
  })

  it('\"Update Now\" follows the LOADED lists, not the checkbox nor the typed ones (v15.5)', async () => {
    server({ blockListUrls: ['https://example.com/list.txt'] })
    await mount({ sub: 'Blocking' })
    const update = screen.getByRole('button', { name: 'Update Now' })
    expect(update).toBeEnabled()
    await userEvent.clear(screen.getByLabelText('Allow / Block List URLs'))
    expect(update).toBeEnabled()
    await userEvent.click(screen.getByLabelText('Enable Blocking'))
    expect(update).toBeEnabled()
  })

  it('\"Update Now\" stays off while typing lists that were not saved (v15.5)', async () => {
    server()
    await mount({ sub: 'Blocking' })
    await userEvent.type(screen.getByLabelText('Allow / Block List URLs'), 'https://example.com/l.txt')
    expect(screen.getByRole('button', { name: 'Update Now' })).toBeDisabled()
  })

  it('with blocking off, Blocking Answer TTL goes off and the update interval does not (v15.5)', async () => {
    server()
    await mount({ sub: 'Blocking' })
    expect(screen.getByLabelText('Blocking Answer TTL')).toBeEnabled()
    await userEvent.click(screen.getByLabelText('Enable Blocking'))
    expect(screen.getByLabelText('Blocking Answer TTL')).toBeDisabled()
    expect(screen.getByLabelText('Block List Update Interval')).toBeEnabled()
  })

  it('switching off \"Enable Blocking\" switches off the rest of the sub-tab', async () => {
    server()
    await mount({ sub: 'Blocking' })
    expect(screen.getByLabelText('Allow TXT Blocking Report')).toBeEnabled()
    await userEvent.click(screen.getByLabelText('Enable Blocking'))
    expect(screen.getByLabelText('Allow TXT Blocking Report')).toBeDisabled()
    expect(screen.getByLabelText('Blocking Bypass List')).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Temporary Disable Now' })).toBeDisabled()
  })

  it('with no minutes, \"Temporary Disable Now\" alerts with the literal text', async () => {
    server()
    await mount({ sub: 'Blocking' })
    await userEvent.click(screen.getByRole('button', { name: 'Temporary Disable Now' }))
    expect(
      await screen.findByText('Please enter a value in minutes to temporarily disable blocking.'),
    ).toBeInTheDocument()
  })

  it('with minutes, it confirms and calls the endpoint with the literal success alert', async () => {
    const spy = vi.spyOn(client, 'apiRequest').mockImplementation(async (path: string) => {
      if (path === 'settings/get') return ok({ response: SETTINGS })
      if (path === 'settings/temporaryDisableBlocking') {
        return ok({ response: { temporaryDisableBlockingTill: '2026-08-25T14:00:00Z' } })
      }
      return ok({ response: {} })
    })
    await mount({ sub: 'Blocking' })

    await userEvent.type(screen.getByLabelText('Blocking Temporarily Disabled Till'), '15')
    await userEvent.click(screen.getByRole('button', { name: 'Temporary Disable Now' }))
    expect(
      await screen.findByText('Are you sure to temporarily disable blocking for 15 minute(s)?'),
    ).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Disable' }))

    const call = await waitFor(() => {
      const c = spy.mock.calls.find((c) => c[0] === 'settings/temporaryDisableBlocking')
      expect(c).toBeDefined()
      return c!
    })
    expect(call[1]?.body).toEqual({ minutes: '15' })
    expect(await screen.findByText('Blocking Disabled!')).toBeInTheDocument()
    expect(
      screen.getByText('Blocking was successfully disabled temporarily for 15 minute(s).'),
    ).toBeInTheDocument()
    // main.js:2393. Success also unchecks "Enable Blocking".
    expect(screen.getByLabelText('Enable Blocking')).not.toBeChecked()
  })

  it('\"Update Now\" confirms and fires forceUpdateBlockLists', async () => {
    const spy = server({ blockListUrls: ['https://example.com/list.txt'] })
    await mount({ sub: 'Blocking' })

    await userEvent.click(screen.getByRole('button', { name: 'Update Now' }))
    expect(
      await screen.findByText('Are you sure to force download and update the block lists?'),
    ).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Update' }))

    await waitFor(() =>
      expect(spy.mock.calls.find((c) => c[0] === 'settings/forceUpdateBlockLists')).toBeDefined(),
    )
    expect(await screen.findByText('Updating Block List!')).toBeInTheDocument()
    expect(screen.getByText('Block list update was triggered successfully.')).toBeInTheDocument()
    expect(screen.getByText('Updating Now')).toBeInTheDocument()
  })
})

describe('Settings: action bar', () => {
  it('\"Flush Cache\" confirms and calls cache/flush with its literal alert', async () => {
    const spy = server()
    await mount()
    await userEvent.click(screen.getByRole('button', { name: 'Flush Cache' }))
    expect(await screen.findByText('Are you sure to flush the DNS Server cache?')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Flush' }))

    await waitFor(() => expect(spy.mock.calls.find((c) => c[0] === 'cache/flush')).toBeDefined())
    expect(await screen.findByText('Flushed!')).toBeInTheDocument()
    expect(screen.getByText('DNS Server cache was flushed successfully.')).toBeInTheDocument()
  })

  /*
 Corrected on 2026-09-03: this test asserted THE DEFECT.

 It said that without the permission the button "is not in the document", and that
 is exactly what the console's design rule forbids: *disabled, never hidden*. A control
 that disappears depending on who is looking changes the shape of the screen and
 leaves nobody able to tell the action exists and a permission is missing.

 Now the button **is still there**, disabled, and it says WHICH permission is missing.
  */
  it('without the permission the buttons stay, disabled', async () => {
    server()
    render(<Settings token="tok" canModify={false} canFlushCache={false} canBackup />)
    await screen.findByRole('button', { name: 'Backup Settings' })

    expect(screen.getByRole('button', { name: /Save Settings/ })).toBeDisabled()
    expect(screen.getByRole('button', { name: /Flush Cache/ })).toBeDisabled()
    /* And the one that does have its permission, active: permissions govern separately. */
    expect(screen.getByRole('button', { name: 'Backup Settings' })).toBeEnabled()
  })

    /* And the padlock says WHICH permission is missing, not only that one is. */
  it('the padlock names the permission that is missing', async () => {
    const user = userEvent.setup()
    server()
    render(<Settings token="tok" canModify={false} canFlushCache={false} canBackup />)
    await screen.findByRole('button', { name: 'Backup Settings' })

    /*
 The mouse goes over the WRAPPER and not over the button, because that is what
 happens for real: a `<button disabled>` receives no pointer events in any
 browser, so the trigger has to be the `<span>` outside. Hovering the button would
 leave the test green through a path that does not exist in the browser; this was checked
 by hand on 2026-09-03 with a user with no permissions.
    */
    const button = screen.getByRole('button', { name: /Flush Cache/ })
    await user.hover(button.parentElement!)

    /* `Cache: Delete` and not `Settings`: of the three permissions these four
       verbs ask for, this is the one from ANOTHER screen: one of three such
       controls among the nine compared with upstream. */
    expect(await screen.findByText('Requires Cache: Delete')).toBeInTheDocument()
  })

  /*
 With a timeout of its own, and not on a whim: this test does THIRTEEN `userEvent`
 interactions (it opens the dialog and unticks the twelve checkboxes), and each one
 goes through `act()`. On its own the whole file takes 5.9 s against a five-second
 per-test cap, so this one lived right on the edge: it passed or not depending on
 how the files were shared out between workers, and adding a test in any other
 file was enough to tip it.

 Checked that it is not a regression of the redesign: reverting `src/` to `HEAD`
 behaved exactly the same. It is not sped up here because the thirteen interactions are the scenario
 ("a backup with nothing ticked"), and trimming them would be testing something else.
  */
  it('a backup with nothing checked alerts with the literal text', { timeout: 15000 }, async () => {
    server()
    await mount()
    await userEvent.click(screen.getByRole('button', { name: 'Backup Settings' }))
    for (const label of [
      'Authentication Config File (auth.config)',
      'Cluster Config File (cluster.config)',
      'Web Service Config And Certificate File (webservice.config, *.pfx & *.p12)',
      'DNS Config And Certificate File (dns.config, *.pfx & *.p12)',
      'Log Config File (log.config)',
      'DNS Zone Files (*.zone)',
      'Allowed Zones File (allowed.config)',
      'Blocked Zones File (blocked.config)',
      'Block List Config And Cache Files (blocklist.config)',
      'DNS Apps',
      'DHCP Scope Files (*.scope)',
      'Dashboard Stats Files (*.stat, *.dstat)',
    ]) {
      await userEvent.click(screen.getByLabelText(label))
    }
    await userEvent.click(screen.getByRole('button', { name: 'Backup' }))
    expect(await screen.findByText('Please select at least one item to backup.')).toBeInTheDocument()
  })

  it('a restore with no file alerts before looking at the items', async () => {
    server()
    await mount()
    await userEvent.click(screen.getByRole('button', { name: 'Restore Settings' }))
    await userEvent.click(screen.getByRole('button', { name: 'Restore' }))
    expect(await screen.findByText('Please select a backup zip file to restore.')).toBeInTheDocument()
  })
})

describe('Settings: enablement rules of the remaining sub-tabs', () => {
  it('the recursion ACL can only be edited with the fourth option', async () => {
    server()
    await mount({ sub: 'Recursion' })
    const acl = screen.getByLabelText('Network Access Control List (ACL)')
    expect(acl).toBeDisabled()
    await userEvent.click(screen.getByLabelText('Use Specified Network Access Control List (ACL)'))
    expect(acl).toBeEnabled()
  })

  it('the proxy fields wake up on choosing a type', async () => {
    server()
    await mount({ sub: 'Proxy & Forwarders' })
    expect(screen.getByLabelText('Proxy Server Address')).toBeDisabled()
    await userEvent.click(screen.getByLabelText('SOCKS5 Proxy'))
    expect(screen.getByLabelText('Proxy Server Address')).toBeEnabled()
  })

  it('\"None\" in the logging switches off its four options and the folder', async () => {
    server()
    await mount({ sub: 'Logging' })
    expect(screen.getByLabelText('Log All Queries')).toBeEnabled()
    await userEvent.click(screen.getByLabelText('None'))
    expect(screen.getByLabelText('Log All Queries')).toBeDisabled()
    expect(screen.getByLabelText('Log Folder Path')).toBeDisabled()
  })

  it('the TSIG table adds and deletes rows', async () => {
    server()
    await mount({ sub: 'TSIG' })
    expect(screen.queryByLabelText('TSIG Keys 1 Key Name')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Add' }))
    expect(screen.getByLabelText('TSIG Keys 1 Key Name')).toBeInTheDocument()
    // The default algorithm of a new row is hmac-sha256.
    expect(valueShown(screen.getByLabelText('TSIG Keys 1 Algorithm'))).toBe('HMAC-SHA256 (recommended)')
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }))
    expect(screen.queryByLabelText('TSIG Keys 1 Key Name')).not.toBeInTheDocument()
  })

  it('the QPM table arrives with the real rows from the server', async () => {
    server()
    await mount()
    expect(screen.getByLabelText('Queries Per Minute (QPM) Limits (IPv4) 1 IPv4 Prefix')).toHaveValue(32)
    expect(screen.getByLabelText('Queries Per Minute (QPM) Limits (IPv4) 2 UDP Limit')).toHaveValue(6000)
    expect(screen.getByLabelText('Queries Per Minute (QPM) Limits (IPv6) 3 IPv6 Prefix')).toHaveValue(56)
  })
})

/*
Which node the screen talks to. Upstream's selector (cluster.js:1021-1050) is
HIDDEN on a standalone server and holds the empty `<option>`, so there the load is
`settings/get?node=` and the save starts `node=&…` with every block, as checked on
the stock v15.5.1 console of the harness. `cluster` only exists once the cluster
is initialised, and it is the default there.
*/
describe('Settings: node scope', () => {
  const NODES = [
    { name: 'node1.cluster.test', type: 'Primary' },
    { name: 'node2.cluster.test', type: 'Secondary' },
  ]

  afterEach(() => localStorage.clear())

  async function saveAndGetBody(spy: ReturnType<typeof server>) {
    await userEvent.click(screen.getByRole('button', { name: 'Save Settings' }))
    const call = await waitFor(() => {
      const c = spy.mock.calls.find((c) => c[0] === 'settings/set')
      expect(c).toBeDefined()
      return c!
    })
    return call[1]!.body as Record<string, string>
  }

  it('a standalone server loads and saves with node empty, never "cluster"', async () => {
    const spy = server()
    await mount()
    const get = spy.mock.calls.find((c) => c[0] === 'settings/get')!
    expect(get[1]?.body).toEqual({ node: '' })

    const body = await saveAndGetBody(spy)
    expect(body.node).toBe('')
    expect(body.dnsServerDomain).toBe('ref.technitium-ui.test')
    expect(body.recursion).toBe('AllowOnlyForPrivateNetworks')
    expect(localStorage.getItem('settingsClusterNode')).toBe('')
  })

  it('a standalone server ignores a node remembered from a cluster', async () => {
    localStorage.setItem('settingsClusterNode', 'node2.cluster.test')
    const spy = server()
    await mount()
    expect(spy.mock.calls.find((c) => c[0] === 'settings/get')![1]?.body).toEqual({ node: '' })
    expect((await saveAndGetBody(spy)).node).toBe('')
  })

  it('with a cluster the default is the aggregate, and it saves only cluster parameters', async () => {
    const spy = server()
    await mount({ clusterInitialised: true, nodes: NODES })
    expect(spy.mock.calls.find((c) => c[0] === 'settings/get')![1]?.body).toEqual({ node: 'cluster' })

    const body = await saveAndGetBody(spy)
    expect(body.node).toBe('cluster')
    expect(body.recursion).toBe('AllowOnlyForPrivateNetworks')
    expect(body).not.toHaveProperty('dnsServerDomain')
    expect(body).not.toHaveProperty('loggingType')
  })

  it('with a node chosen, it saves only that node parameters', async () => {
    localStorage.setItem('settingsClusterNode', 'node2.cluster.test')
    const spy = server()
    await mount({ clusterInitialised: true, nodes: NODES })
    expect(spy.mock.calls.find((c) => c[0] === 'settings/get')![1]?.body).toEqual({
      node: 'node2.cluster.test',
    })

    const body = await saveAndGetBody(spy)
    expect(body.node).toBe('node2.cluster.test')
    expect(body.loggingType).toBe('File')
    expect(body).not.toHaveProperty('recursion')
  })

  it('a remembered node that is no longer in the cluster falls to the first node', async () => {
    localStorage.setItem('settingsClusterNode', 'gone.cluster.test')
    const spy = server()
    await mount({ clusterInitialised: true, nodes: NODES })
    expect(spy.mock.calls.find((c) => c[0] === 'settings/get')![1]?.body).toEqual({
      node: 'node1.cluster.test',
    })
  })

  it('flush and restore carry the chosen node too (other-zones.js:28, main.js:3170)', async () => {
    localStorage.setItem('settingsClusterNode', 'node2.cluster.test')
    const spy = server()
    await mount({ clusterInitialised: true, nodes: NODES })

    await userEvent.click(screen.getByRole('button', { name: 'Flush Cache' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Flush' }))
    await waitFor(() => expect(spy.mock.calls.find((c) => c[0] === 'cache/flush')).toBeDefined())
    expect(spy.mock.calls.find((c) => c[0] === 'cache/flush')![1]?.body).toEqual({
      node: 'node2.cluster.test',
    })

    await userEvent.click(screen.getByRole('button', { name: 'Restore Settings' }))
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    await userEvent.upload(input, new File(['zip'], 'backup.zip'))
    await userEvent.click(screen.getByRole('button', { name: 'Restore' }))
    await waitFor(() =>
      expect(spy.mock.calls.find((c) => String(c[0]).startsWith('settings/restore'))).toBeDefined(),
    )
    const restore = String(spy.mock.calls.find((c) => String(c[0]).startsWith('settings/restore'))![0])
    expect(new URLSearchParams(restore.split('?')[1]).get('node')).toBe('node2.cluster.test')
  })
})

/*
After a save or a restore answered by the session's own server, upstream opens the
web console's new address 2.5 s later (main.js:2217, 3188, 2293-2334) unless the
last load detected a reverse proxy (main.js:918, 2275). jsdom serves the tests at
http://localhost:3000/.
*/
describe('Settings: web console redirection', () => {
  function serverWith(
    load: Record<string, unknown>,
    saved: Record<string, unknown>,
    serverName = 'ref.technitium-ui.test',
  ) {
    return vi.spyOn(client, 'apiRequest').mockImplementation(async (path: string) => {
      if (path === 'settings/get') return ok({ response: { ...SETTINGS, ...load }, server: serverName })
      if (path === 'settings/set' || path.startsWith('settings/restore')) {
        return ok({ response: { ...SETTINGS, ...saved }, server: serverName })
      }
      return ok({ response: {} })
    })
  }

  afterEach(() => vi.useRealTimers())

  it('a new HTTP port on the own server opens it in the same tab after 2500 ms', async () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null)
    serverWith({ webServiceHttpPort: 3000 }, { webServiceHttpPort: 9000 })
    render(<Settings token="tok" serverDomain="ref.technitium-ui.test" />)
    const save = await screen.findByRole('button', { name: 'Save Settings' })

    // Frozen clock from here on, so the 2500 ms can be counted exactly.
    vi.useFakeTimers()
    fireEvent.click(save)
    for (let i = 0; i < 10; i++) await act(async () => {})
    expect(screen.getByText('Settings Saved!')).toBeInTheDocument()

    vi.advanceTimersByTime(2499)
    expect(open).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(open).toHaveBeenCalledWith('http://localhost:9000', '_self')
  })

  it('an answer from another server does not redirect', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const open = vi.spyOn(window, 'open').mockImplementation(() => null)
    serverWith({ webServiceHttpPort: 3000 }, { webServiceHttpPort: 9000 }, 'node2.cluster.test')
    const user = userEvent.setup({ delay: null, advanceTimers: vi.advanceTimersByTime })
    render(<Settings token="tok" serverDomain="ref.technitium-ui.test" />)
    await screen.findByRole('button', { name: 'Save Settings' })

    await user.click(screen.getByRole('button', { name: 'Save Settings' }))
    await screen.findByText('Settings Saved!')
    vi.advanceTimersByTime(5000)
    expect(open).not.toHaveBeenCalled()
  })

  it('a reverse proxy detected on load does not redirect', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const open = vi.spyOn(window, 'open').mockImplementation(() => null)
    // Served at :3000 while the web service listens on :5380, so there is a proxy in between.
    serverWith({ webServiceHttpPort: 5380 }, { webServiceHttpPort: 9000 })
    const user = userEvent.setup({ delay: null, advanceTimers: vi.advanceTimersByTime })
    render(<Settings token="tok" serverDomain="ref.technitium-ui.test" />)
    await screen.findByRole('button', { name: 'Save Settings' })

    await user.click(screen.getByRole('button', { name: 'Save Settings' }))
    await screen.findByText('Settings Saved!')
    vi.advanceTimersByTime(5000)
    expect(open).not.toHaveBeenCalled()
  })

  it('renaming the server on a standalone install still redirects (the session domain follows)', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const open = vi.spyOn(window, 'open').mockImplementation(() => null)
    serverWith(
      { webServiceHttpPort: 3000 },
      { webServiceHttpPort: 9000, dnsServerDomain: 'renamed.test' },
      'renamed.test',
    )
    const user = userEvent.setup({ delay: null, advanceTimers: vi.advanceTimersByTime })
    render(<Settings token="tok" serverDomain="ref.technitium-ui.test" />)
    await screen.findByRole('button', { name: 'Save Settings' })

    await user.click(screen.getByRole('button', { name: 'Save Settings' }))
    await screen.findByText('Settings Saved!')
    vi.advanceTimersByTime(2500)
    expect(open).toHaveBeenCalledWith('http://localhost:9000', '_self')
  })

  it('a successful restore redirects the same way', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const open = vi.spyOn(window, 'open').mockImplementation(() => null)
    serverWith({ webServiceHttpPort: 3000 }, { webServiceHttpPort: 9000 })
    const user = userEvent.setup({ delay: null, advanceTimers: vi.advanceTimersByTime })
    render(<Settings token="tok" serverDomain="ref.technitium-ui.test" />)
    await screen.findByRole('button', { name: 'Save Settings' })

    await user.click(screen.getByRole('button', { name: 'Restore Settings' }))
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    await user.upload(input, new File(['zip'], 'backup.zip'))
    await user.click(screen.getByRole('button', { name: 'Restore' }))
    await screen.findByText('Restored!')
    vi.advanceTimersByTime(2500)
    expect(open).toHaveBeenCalledWith('http://localhost:9000', '_self')
  })
})

/*
Optional Protocols' note names the addresses to give DNS clients, and upstream
fills them from the LOADED settings (main.js:1369-1372): typing a new port does
not change them until the next load. Same for the real-IP header of both notes
(main.js:1303-1304 and 1356-1357).
*/
describe('Settings: addresses in the notes come from the loaded settings', () => {
  it('DoH, DoT, DoQ and DoH(S) follow the loaded ports', async () => {
    server({ dnsOverHttpPort: 8053, dnsOverTlsPort: 8853, dnsOverQuicPort: 9853, dnsOverHttpsPort: 8443 })
    await mount({ sub: 'Optional Protocols' })
    expect(screen.getByText('http://localhost:8053/dns-query')).toBeInTheDocument()
    expect(screen.getByText('tls-certificate-domain:8853')).toBeInTheDocument()
    expect(screen.getByText('tls-certificate-domain:9853')).toBeInTheDocument()
    expect(screen.getByText('https://tls-certificate-domain:8443/dns-query')).toBeInTheDocument()
  })

  it('port 80 and port 443 are left out of the DoH and DoH(S) addresses', async () => {
    server({ dnsOverHttpPort: 80, dnsOverHttpsPort: 443 })
    await mount({ sub: 'Optional Protocols' })
    expect(screen.getByText('http://localhost/dns-query')).toBeInTheDocument()
    expect(screen.getByText('https://tls-certificate-domain/dns-query')).toBeInTheDocument()
  })

  it('typing a port does not change the note until the settings are loaded again', async () => {
    server({ enableDnsOverTls: true, dnsOverTlsPort: 8853, dnsOverQuicPort: 9853 })
    await mount({ sub: 'Optional Protocols' })
    const port = screen.getByLabelText('DNS-over-TLS Port')
    await userEvent.clear(port)
    await userEvent.type(port, '999')
    expect(screen.getByText('tls-certificate-domain:8853')).toBeInTheDocument()
  })

  it('the real-IP header of both notes is the loaded one, not the typed one', async () => {
    server({
      enableDnsOverHttp: true,
      dnsOverHttpRealIpHeader: 'X-Forwarded-For',
      webServiceRealIpHeader: 'X-Client-IP',
    })
    const { unmount } = await mount({ sub: 'Optional Protocols' })
    await userEvent.clear(screen.getByLabelText('Real IP Header'))
    expect(screen.getByText('X-Forwarded-For')).toBeInTheDocument()
    expect(screen.getByText('proxy_set_header X-Forwarded-For $remote_addr;')).toBeInTheDocument()
    unmount()

    await mount({ sub: 'Web Service' })
    await userEvent.clear(screen.getByLabelText('Real IP Header'))
    expect(screen.getByText('X-Client-IP')).toBeInTheDocument()
    expect(screen.getByText('proxy_set_header X-Client-IP $remote_addr;')).toBeInTheDocument()
  })
})
