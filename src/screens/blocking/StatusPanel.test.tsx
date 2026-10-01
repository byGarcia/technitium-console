import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import * as settings from '../../api/settings'
import type { DnsSettings } from '../../api/settings'
import { StatusPanel } from './StatusPanel'

afterEach(() => vi.restoreAllMocks())

function serve(s: Partial<DnsSettings>) {
  return vi.spyOn(settings, 'getSettings').mockResolvedValue(s as DnsSettings)
}

describe('StatusPanel', () => {
  it('says blocking is enabled', async () => {
    serve({ enableBlocking: true })
    render(<StatusPanel token="T" permissions={undefined} onNotice={() => {}} />)
    expect(await screen.findByText('Blocking is enabled')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Blocking options' })).toHaveTextContent('Disable')
  })

  it('says until when it is paused', async () => {
    serve({ enableBlocking: false, temporaryDisableBlockingTill: '2099-01-01T21:15:00Z' })
    render(<StatusPanel token="T" permissions={undefined} onNotice={() => {}} />)
    expect(await screen.findByText('Blocking is paused')).toBeInTheDocument()
    expect(screen.getByText(/^Until /)).toBeInTheDocument()
  })

  it('says it is disabled when there is no pause in the future', async () => {
    serve({ enableBlocking: false, temporaryDisableBlockingTill: '2000-01-01T00:00:00Z' })
    render(<StatusPanel token="T" permissions={undefined} onNotice={() => {}} />)
    expect(await screen.findByText('Blocking is disabled')).toBeInTheDocument()
  })

  it('without Settings.canModify the control is disabled with its padlock', async () => {
    serve({ enableBlocking: true })
    render(
      <StatusPanel
        token="T"
        permissions={{ Settings: { canView: true, canModify: false, canDelete: false } }}
        onNotice={() => {}}
      />,
    )
    expect(await screen.findByRole('button', { name: /Disable/ })).toBeDisabled()
  })

  it('without Settings.canView the panel is locked and nothing is read', () => {
    const read = serve({ enableBlocking: true })
    render(
      <StatusPanel
        token="T"
        permissions={{ Settings: { canView: false, canModify: false, canDelete: false } }}
        onNotice={() => {}}
      />,
    )
    expect(screen.getByText('Requires Settings: View')).toBeInTheDocument()
    expect(read).not.toHaveBeenCalled()
  })
})
