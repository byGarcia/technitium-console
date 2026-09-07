import { describe, expect, it, vi, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Versions } from './Versions'
import * as userApi from '../api/user'

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

const mark = { name: /Update/ } as const

describe('Versions', () => {
  it('reports both versions and the server it is talking about', async () => {
    withoutUpdate()
    render(<Versions token="t" serverVersion="15.4" domain="dns.example.net" />)
    expect(screen.getByText('DNS Server')).toBeInTheDocument()
    expect(screen.getByText('15.4')).toBeInTheDocument()
    expect(screen.getByText('Web Console')).toBeInTheDocument()
    expect(screen.getByText('dns.example.net')).toBeInTheDocument()
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
  Three literals that were missing or reworded, found contracting About on
  2026-09-04 — the update flow had never been walked against upstream item by
  item, because the chrome round contracted the chrome and not this dialog.
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
