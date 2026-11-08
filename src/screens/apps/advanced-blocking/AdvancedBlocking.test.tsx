import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as apps from '../../../api/apps'
import { AdvancedBlocking } from './AdvancedBlocking'

const CONFIG = `{
  "enableBlocking": true,
  "blockingAnswerTtl": 30,
  "futureOption": 12345678901234567890,
  "localEndPointGroupMap": { "192.168.10.2:53": "bypass" },
  "networkGroupMap": { "192.168.10.0/24": "family", "10.9.9.0/24": "ghost" },
  "groups": [
    { "name": "family", "enableBlocking": true, "allowTxtBlockingReport": true, "blockAsNxDomain": true, "blockingAddresses": ["0.0.0.0"],
      "allowed": [], "blocked": ["tiktok.com"], "allowListUrls": [], "blockListUrls": [], "allowedRegex": [], "blockedRegex": [],
      "regexAllowListUrls": [], "regexBlockListUrls": [], "adblockListUrls": [], "notes": "kept" },
    { "name": "bypass", "enableBlocking": false, "allowed": [], "blocked": [], "allowListUrls": [], "blockListUrls": [], "allowedRegex": [], "blockedRegex": [],
      "regexAllowListUrls": [], "regexBlockListUrls": [], "adblockListUrls": [] }
  ]
}`

const app = (version = '11.2.1') =>
  ({
    name: 'Advanced Blocking',
    description: '',
    version,
    dnsApps: [{ classPath: 'AdvancedBlocking.App', description: '' }],
  }) as unknown as apps.InstalledApp

function server({ version = '11.2.1', config = CONFIG as string | null, installed = true } = {}) {
  vi.spyOn(apps, 'listApps').mockResolvedValue({
    kind: 'ok',
    data: { status: 'ok', response: { apps: installed ? [app(version)] : [] } },
  } as never)
  const get = vi.spyOn(apps, 'getAppConfig').mockResolvedValue({ kind: 'ok', data: { response: { config } } })
  const set = vi.spyOn(apps, 'setAppConfig').mockResolvedValue({ kind: 'ok', data: {} })
  return { get, set }
}

const open = () => render(<AdvancedBlocking token="t" />)
const saveButton = () => screen.findByRole('button', { name: 'Save' })

beforeEach(() => {
  window.history.replaceState(null, '', '/apps/advanced-blocking/')
})
afterEach(() => vi.restoreAllMocks())

describe('what the page says', () => {
  it('says when the app is not installed', async () => {
    server({ installed: false })
    open()
    expect(await screen.findByText('The Advanced Blocking app is not installed on this server.')).toBeInTheDocument()
  })

  it('refuses an app older than the schema it knows', async () => {
    server({ version: '9.1' })
    open()
    expect(await screen.findByText(/The visual editor needs Advanced Blocking 10\.0 or later\. This server has 9\.1\./)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Save' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Edit as JSON' })).toBeInTheDocument()
  })

  it('warns on a newer app and still edits', async () => {
    server({ version: '12.0' })
    open()
    expect(await screen.findByText(/This server runs Advanced Blocking 12\.0; this console was checked against 11\.2\.1\./)).toBeInTheDocument()
    expect(await saveButton()).toBeInTheDocument()
  })

  it('refuses a config with comments and offers only the JSON', async () => {
    server({ config: `// family\n${CONFIG}` })
    open()
    expect(await screen.findByText(/This config can only be edited as JSON\..*Nothing here has been changed\./)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Save' })).toBeNull()
  })

  it('explains that the app is separate from Blocking', async () => {
    server()
    open()
    expect(await screen.findByText(/Advanced Blocking is separate from the server's Blocking section\./)).toBeInTheDocument()
  })
})

describe('saving', () => {
  it('sends the exact bytes back when nothing changed', async () => {
    const { set } = server()
    open()
    await userEvent.click(await saveButton())
    await waitFor(() => expect(set).toHaveBeenCalled())
    expect(set.mock.calls[0][2]).toBe(CONFIG)
    expect(await screen.findByText('App Config Saved!')).toBeInTheDocument()
  })

  it('writes an edit and leaves everything else alone', async () => {
    const { set } = server()
    open()
    const ttl = await screen.findByLabelText('Blocked Answer TTL')
    await userEvent.clear(ttl)
    await userEvent.type(ttl, '60')
    expect(screen.getByText(/Unsaved changes: General/)).toBeInTheDocument()
    await userEvent.click(await saveButton())
    await waitFor(() => expect(set).toHaveBeenCalled())
    const sent = set.mock.calls[0][2]
    expect(JSON.parse(sent).blockingAnswerTtl).toBe(60)
    expect(sent).toContain('12345678901234567890')
    expect(sent).toContain('"notes": "kept"')
    expect(JSON.parse(sent).networkGroupMap['10.9.9.0/24']).toBe('ghost')
  })

  it('does not write when the server config changed meanwhile', async () => {
    const { get, set } = server()
    open()
    const button = await saveButton()
    get.mockResolvedValue({ kind: 'ok', data: { response: { config: `${CONFIG} ` } } })
    await userEvent.click(button)
    expect(await screen.findByText('This config changed on the server after you opened it. Nothing was saved.')).toBeInTheDocument()
    expect(set).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: 'Reload' }))
    await waitFor(() => expect(screen.queryByText(/This config changed on the server/)).toBeNull())
  })

  it('sends nothing with a problem, and moves to it', async () => {
    const { set } = server()
    open()
    const add = await screen.findByRole('button', { name: 'Add client' })
    await userEvent.click(add)
    await userEvent.click(await saveButton())
    expect(screen.getByText(/problems? to fix before saving/)).toBeInTheDocument()
    expect(set).not.toHaveBeenCalled()
    const first = document.activeElement as HTMLElement
    expect(first.id).toMatch(/^ab-.+-address$/)
    expect(first.getAttribute('aria-describedby')).toBe(`${first.id}-error`)
    expect(document.getElementById(`${first.id}-error`)).not.toBeNull()
  })

  it('does not block on a reference that was already dangling', async () => {
    const { set } = server()
    open()
    const ttl = await screen.findByLabelText('Blocked Answer TTL')
    await userEvent.clear(ttl)
    await userEvent.type(ttl, '60')
    await userEvent.click(await saveButton())
    await waitFor(() => expect(set).toHaveBeenCalled())
    expect(screen.getByRole('combobox', { name: /10\.9\.9\.0\/24 group/ })).toBeInTheDocument()
  })

  it('shows what the server answered when it refuses', async () => {
    const { set } = server()
    set.mockResolvedValue({ kind: 'error', message: 'Invalid URI: The URI is empty.' })
    open()
    await userEvent.click(await saveButton())
    expect(await screen.findByText(/Invalid URI: The URI is empty\./)).toBeInTheDocument()
  })

  it('Discard puts everything back', async () => {
    server()
    open()
    const ttl = await screen.findByLabelText('Blocked Answer TTL')
    await userEvent.clear(ttl)
    await userEvent.type(ttl, '60')
    await userEvent.click(screen.getByRole('button', { name: 'Discard' }))
    expect(screen.getByText('No unsaved changes')).toBeInTheDocument()
    expect(screen.getByLabelText('Blocked Answer TTL')).toHaveValue('30')
  })
})

describe('Edit as JSON', () => {
  const dialogText = async () => {
    await userEvent.click(screen.getByRole('button', { name: 'Edit as JSON' }))
    const dialog = await screen.findByRole('dialog')
    return { dialog, text: (within(dialog).getByRole('textbox') as HTMLTextAreaElement).value }
  }

  it('opens the original text when nothing changed', async () => {
    server()
    open()
    await saveButton()
    expect((await dialogText()).text).toBe(CONFIG)
  })

  it('opens the draft when it is valid', async () => {
    server()
    open()
    const ttl = await screen.findByLabelText('Blocked Answer TTL')
    await userEvent.clear(ttl)
    await userEvent.type(ttl, '60')
    expect(JSON.parse((await dialogText()).text).blockingAnswerTtl).toBe(60)
  })

  it('opens the saved config, and says so, when the draft has problems', async () => {
    server()
    open()
    await userEvent.click(await screen.findByRole('button', { name: 'Add client' }))
    const { dialog, text } = await dialogText()
    expect(text).toBe(CONFIG)
    expect(within(dialog).getByText(/Your unsaved changes have problems, so this shows the saved config\./)).toBeInTheDocument()
  })

  it('keeps the draft after closing', async () => {
    server()
    open()
    const ttl = await screen.findByLabelText('Blocked Answer TTL')
    await userEvent.clear(ttl)
    await userEvent.type(ttl, '60')
    await dialogText()
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(screen.getByLabelText('Blocked Answer TTL')).toHaveValue('60')
  })
})

describe('groups on the page', () => {
  it('says how many rows lose a group before deleting it', async () => {
    server()
    open()
    const buttons = await screen.findAllByRole('button', { name: 'Delete group' })
    await userEvent.click(buttons[0])
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText(/1 client row uses 'family'\. They stay/)).toBeInTheDocument()
  })

  it('lists every section in the index', async () => {
    server()
    open()
    const index = await screen.findByRole('navigation', { name: 'On this page' })
    expect(within(index).getAllByRole('link').map((l) => l.textContent)).toEqual(['Clients', 'family', 'bypass', 'General'])
  })
})
