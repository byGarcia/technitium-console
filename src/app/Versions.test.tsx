import { describe, expect, it, vi, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Versions } from './Versions'
import * as userApi from '../api/user'
import * as consoleUpdate from './console-update'
import { wholeText } from '../test/whole-text'

afterEach(() => vi.restoreAllMocks())

function withUpdate(response: Partial<userApi.UpdateInfo> = {}) {
  vi.spyOn(userApi, 'checkForUpdate').mockResolvedValue({
    kind: 'ok',
    data: { status: 'ok', response: { updateAvailable: true, ...response } },
  } as never)
}

function withoutUpdate() {
  vi.spyOn(userApi, 'checkForUpdate').mockResolvedValue({
    kind: 'ok',
    data: { status: 'ok', response: { updateAvailable: false } },
  } as never)
}

const mark = { name: 'DNS Server update available' } as const

describe('Versions', () => {
  it('reports both versions and the server it is talking about', async () => {
    withoutUpdate()
    render(<Versions token="t" serverVersion="15.4" domain="dns.example.net" />)
    expect(screen.getByText('DNS Server')).toBeInTheDocument()
    expect(screen.getByText('15.4')).toBeInTheDocument()
    expect(screen.getByText('Web Console')).toBeInTheDocument()
    expect(screen.getByText(wholeText('dns.example.net'))).toBeInTheDocument()
  })

  /* The session may arrive without info; a missing version is said, not faked. */
  it('says nothing it does not know', async () => {
    withoutUpdate()
    render(<Versions token="t" />)
    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('does not mark anything when the server is up to date', async () => {
    withoutUpdate()
    render(<Versions token="t" serverVersion="15.4" />)
    await new Promise((r) => setTimeout(r, 0))
    expect(screen.queryByRole('button', mark)).not.toBeInTheDocument()
  })

  /* While the notice is silenced the endpoint is not even called and
     `checkForUpdate` answers `skipped`: nothing may be marked from that. */
  it('does not mark anything while the notice is silenced', async () => {
    vi.spyOn(userApi, 'checkForUpdate').mockResolvedValue({ kind: 'skipped' })
    render(<Versions token="t" serverVersion="15.4" />)
    await new Promise((r) => setTimeout(r, 0))
    expect(screen.queryByRole('button', mark)).not.toBeInTheDocument()
  })

  it('a failed check is not an update', async () => {
    vi.spyOn(userApi, 'checkForUpdate').mockResolvedValue({ kind: 'error', message: 'boom' } as never)
    render(<Versions token="t" serverVersion="15.4" />)
    await new Promise((r) => setTimeout(r, 0))
    expect(screen.queryByRole('button', mark)).not.toBeInTheDocument()
  })

  it('marks the server version when there is an update', async () => {
    withUpdate()
    render(<Versions token="t" serverVersion="15.4" />)
    expect(await screen.findByRole('button', mark)).toBeInTheDocument()
  })

  it('opens the detail with versions, message and the three links', async () => {
    withUpdate({
      currentVersion: '15.4',
      updateVersion: '16.0',
      updateMessage: 'Fixes a resolver crash.',
      downloadLink: 'https://example.test/dl',
      instructionsLink: 'https://example.test/how',
      changeLogLink: 'https://example.test/log',
    })
    render(<Versions token="t" serverVersion="15.4" />)
    await userEvent.click(await screen.findByRole('button', mark))

    expect(screen.getByText('16.0')).toBeInTheDocument()
    expect(screen.getByText('Fixes a resolver crash.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Download Now!' })).toHaveAttribute('href', 'https://example.test/dl')
    expect(screen.getByRole('link', { name: 'Update Instructions' })).toHaveAttribute('href', 'https://example.test/how')
    expect(screen.getByRole('link', { name: 'Read Change Logs' })).toHaveAttribute('href', 'https://example.test/log')
  })

  /*
  Three literals that were missing or reworded, found checking About against
  upstream on 2026-09-04: the update flow had never been walked against upstream
  item by item, because the earlier check covered the chrome and not this dialog.
  */
  it('names each of the two versions, which the arrow only says to the eye', async () => {
    withUpdate({ currentVersion: '15.4', updateVersion: '16.0' })
    render(<Versions token="t" serverVersion="15.4" />)
    await userEvent.click(await screen.findByRole('button', mark))
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveTextContent('Current Version: 15.4')
    expect(dialog).toHaveTextContent('Update Version: 16.0')
  })

  it('carries upstream two `Note!`, which were nowhere in the console', async () => {
    withUpdate({ updateMessage: 'x' })
    render(<Versions token="t" serverVersion="15.4" />)
    await userEvent.click(await screen.findByRole('button', mark))
    expect(
      screen.getByText('It is highly recommended to Backup Settings before installing the update.'),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/You will have to refresh this web page manually after updating/),
    ).toBeInTheDocument()
  })

  /* Upstream writes this title itself when the feed carries none. */
  it('falls back to upstream own wording when there is no title', async () => {
    withUpdate({ updateMessage: 'x' })
    render(<Versions token="t" serverVersion="15.4" />)
    await userEvent.click(await screen.findByRole('button', mark))
    expect(screen.getByRole('heading', { name: 'New Update Available!' })).toBeInTheDocument()
  })

  /* A link to `null` would be a dead control, which is worse than no control. */
  it('hides each link the server does not send', async () => {
    withUpdate({ downloadLink: 'https://example.test/dl' })
    render(<Versions token="t" serverVersion="15.4" />)
    await userEvent.click(await screen.findByRole('button', mark))

    expect(screen.getByRole('link', { name: 'Download Now!' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Update Instructions' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Read Change Logs' })).not.toBeInTheDocument()
  })
})

describe('Versions: the console mark', () => {
  const consoleMark = { name: 'Web Console update available' } as const

  function serverCheck(response: Partial<userApi.UpdateInfo>) {
    vi.spyOn(userApi, 'checkForUpdate').mockResolvedValue({
      kind: 'ok',
      data: { status: 'ok', response: { updateAvailable: false, dnsServerEnableCheckForUpdate: true, ...response } },
    } as never)
  }

  function consoleRelease(latest = '1.4.0') {
    return vi.spyOn(consoleUpdate, 'checkConsoleUpdate').mockResolvedValue({ latest, server: '15.5' })
  }

  const settle = () => new Promise((r) => setTimeout(r, 0))

  it('shows the console mark when a newer console exists', async () => {
    serverCheck({})
    consoleRelease()
    render(<Versions token="t" serverVersion="15.6.2" canCheckConsole />)
    expect(await screen.findByRole('button', consoleMark)).toBeInTheDocument()
    expect(screen.queryByRole('button', mark)).not.toBeInTheDocument()
  })

  it('opens the console dialog with the version jump and the commands', async () => {
    serverCheck({})
    consoleRelease()
    render(<Versions token="t" serverVersion="15.6.2" canCheckConsole />)
    await userEvent.click(await screen.findByRole('button', consoleMark))
    const dialog = screen.getByRole('dialog')
    expect(screen.getByRole('heading', { name: 'New Web Console Version Available!' })).toBeInTheDocument()
    expect(dialog).toHaveTextContent(`Current Version: ${__CONSOLE_VERSION__}`)
    expect(dialog).toHaveTextContent('Update Version: 1.4.0')
    expect(screen.getByRole('link', { name: 'Release Notes' })).toHaveAttribute(
      'href',
      'https://github.com/byGarcia/technitium-console/releases/tag/v1.4.0',
    )
    expect(dialog).toHaveTextContent(
      'curl -sSL https://raw.githubusercontent.com/byGarcia/technitium-console/main/install.sh | sudo sh',
    )
    expect(dialog).toHaveTextContent(
      'docker compose pull technitium-console && docker compose up -d technitium-console',
    )
  })

  it('does not mark a console that is already the latest', async () => {
    serverCheck({})
    consoleRelease(__CONSOLE_VERSION__)
    render(<Versions token="t" serverVersion="15.6.2" canCheckConsole />)
    await settle()
    expect(screen.queryByRole('button', consoleMark)).not.toBeInTheDocument()
  })

  it('does not check without DNS Client permission', async () => {
    serverCheck({})
    const spy = consoleRelease()
    render(<Versions token="t" serverVersion="15.6.2" />)
    await settle()
    expect(spy).not.toHaveBeenCalled()
  })

  it("does not check when the server's check is off", async () => {
    serverCheck({ dnsServerEnableCheckForUpdate: false })
    const spy = consoleRelease()
    render(<Versions token="t" serverVersion="15.6.2" canCheckConsole />)
    await settle()
    expect(spy).not.toHaveBeenCalled()
  })

  it('does not check when the notice is silenced', async () => {
    vi.spyOn(userApi, 'checkForUpdate').mockResolvedValue({ kind: 'skipped' })
    const spy = consoleRelease()
    render(<Versions token="t" serverVersion="15.6.2" canCheckConsole />)
    await settle()
    expect(spy).not.toHaveBeenCalled()
  })

  it('hides the console mark when the session silences the notice', async () => {
    serverCheck({})
    consoleRelease()
    render(<Versions token="t" serverVersion="15.6.2" canCheckConsole markHidden />)
    await settle()
    expect(screen.queryByRole('button', consoleMark)).not.toBeInTheDocument()
  })

  /* The server's version reaches the Shell after the first render. The server's
     own check must not run again when it does: each run is a line in its log. */
  it("asks the server once when the server's version arrives later", async () => {
    serverCheck({})
    consoleRelease()
    const spy = vi.mocked(userApi.checkForUpdate)
    const { rerender } = render(<Versions token="t" canCheckConsole />)
    await settle()
    rerender(<Versions token="t" serverVersion="15.6.2" canCheckConsole />)
    expect(await screen.findByRole('button', consoleMark)).toBeInTheDocument()
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('names the two marks apart', async () => {
    serverCheck({ updateAvailable: true, updateVersion: '16.0' })
    consoleRelease()
    render(<Versions token="t" serverVersion="15.6.2" canCheckConsole />)
    expect(await screen.findByRole('button', consoleMark)).toBeInTheDocument()
    expect(screen.getByRole('button', mark)).toBeInTheDocument()
  })
})
