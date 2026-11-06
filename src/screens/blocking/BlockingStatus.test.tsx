import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import * as settings from '../../api/settings'
import type { DnsSettings } from '../../api/settings'
import { BlockingStatus } from './BlockingStatus'

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

/** The pill a piece of text sits in: the element that carries the tone. */
function toned(el: HTMLElement): HTMLElement {
  return el.closest('[data-tone]') as HTMLElement
}

function serve(s: Partial<DnsSettings>) {
  return vi.spyOn(settings, 'getSettings').mockResolvedValue(s as DnsSettings)
}

describe('BlockingStatus', () => {
  it('says blocking is enabled', async () => {
    serve({ enableBlocking: true })
    render(<BlockingStatus token="T" permissions={undefined} onNotice={() => {}} />)
    expect(await screen.findByText('Blocking is enabled')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Blocking options' })).toHaveTextContent('Disable')
  })

  it('says until when it is paused', async () => {
    serve({ enableBlocking: false, temporaryDisableBlockingTill: '2099-01-01T21:15:00Z' })
    render(<BlockingStatus token="T" permissions={undefined} onNotice={() => {}} />)
    expect(await screen.findByText('Blocking is paused')).toBeInTheDocument()
    expect(screen.getByText(/^Until /)).toBeInTheDocument()
  })

  it('enabled, the pill is in the ok tone and its sentence is its title', async () => {
    serve({ enableBlocking: true })
    render(<BlockingStatus token="T" permissions={undefined} onNotice={() => {}} />)
    const pill = toned(await screen.findByText('Blocking is enabled'))
    expect(pill).toHaveAttribute('data-tone', 'on')
    expect(pill).toHaveAttribute('title', 'Queries matching a block list or your rules are answered as blocked.')
    expect(screen.getByText('Queries matching a block list or your rules are answered as blocked.')).toBeInTheDocument()
  })

  it('paused until later today, the pill gives the hour alone, in amber, and the sentence stays', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(new Date(2026, 9, 1, 20, 45, 0))
    serve({ enableBlocking: false, temporaryDisableBlockingTill: new Date(2026, 9, 1, 21, 15, 0).toISOString() })
    render(<BlockingStatus token="T" permissions={undefined} onNotice={() => {}} />)
    const until = await screen.findByText('Until 21:15')
    expect(toned(until)).toHaveAttribute('data-tone', 'paused')
    expect(toned(until)).toHaveTextContent('Blocking is paused')
    expect(screen.getByText('Resumes automatically.')).toBeInTheDocument()
  })

  it('disabled, the pill is red while the user can switch it back on, neutral when not', async () => {
    serve({ enableBlocking: false })
    const { unmount } = render(<BlockingStatus token="T" permissions={undefined} onNotice={() => {}} />)
    expect(toned(await screen.findByText('Blocking is disabled'))).toHaveAttribute('data-tone', 'off')
    expect(screen.getByRole('button', { name: 'Blocking options' })).toHaveTextContent('Enable')
    unmount()
    render(
      <BlockingStatus
        token="T"
        permissions={{ Settings: { canView: true, canModify: false, canDelete: false } }}
        onNotice={() => {}}
      />,
    )
    expect(toned(await screen.findByText('Blocking is disabled'))).toHaveAttribute('data-tone', 'neutral')
  })

  it('paused past today, the pill gives the date as well', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(new Date(2026, 9, 1, 23, 30, 0))
    serve({ enableBlocking: false, temporaryDisableBlockingTill: new Date(2026, 9, 2, 1, 30, 0).toISOString() })
    render(<BlockingStatus token="T" permissions={undefined} onNotice={() => {}} />)
    expect(await screen.findByText('Until 2026-10-02 01:30')).toBeInTheDocument()
  })

  it('paused without Settings.canModify, the pill is neutral: the padlock wins', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(new Date(2026, 9, 1, 20, 45, 0))
    serve({ enableBlocking: false, temporaryDisableBlockingTill: new Date(2026, 9, 1, 21, 15, 0).toISOString() })
    render(
      <BlockingStatus
        token="T"
        permissions={{ Settings: { canView: true, canModify: false, canDelete: false } }}
        onNotice={() => {}}
      />,
    )
    const pill = await screen.findByText('Until 21:15')
    expect(toned(pill)).toHaveAttribute('data-tone', 'neutral')
  })

  it('says until when to the minute, without seconds', async () => {
    const till = new Date(2099, 0, 1, 21, 15, 42).toISOString()
    serve({ enableBlocking: false, temporaryDisableBlockingTill: till })
    render(<BlockingStatus token="T" permissions={undefined} onNotice={() => {}} />)
    expect(await screen.findByText('Until 2099-01-01 21:15')).toBeInTheDocument()
  })

  it('reads again when the pause ends, and stops saying paused', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const till = new Date(Date.now() + 60_000).toISOString()
    const read = vi
      .spyOn(settings, 'getSettings')
      .mockResolvedValueOnce({ enableBlocking: false, temporaryDisableBlockingTill: till } as DnsSettings)
      .mockResolvedValue({ enableBlocking: true } as DnsSettings)
    render(<BlockingStatus token="T" permissions={undefined} onNotice={() => {}} />)
    expect(await screen.findByText('Blocking is paused')).toBeInTheDocument()
    expect(read).toHaveBeenCalledTimes(1)

    await act(() => vi.advanceTimersByTimeAsync(30_000))
    expect(read).toHaveBeenCalledTimes(1)

    await act(() => vi.advanceTimersByTimeAsync(35_000))
    expect(read).toHaveBeenCalledTimes(2)
    expect(await screen.findByText('Blocking is enabled')).toBeInTheDocument()
  })

  it('when the state cannot be read it says so, continuous, with a Retry that reads again', async () => {
    const read = vi
      .spyOn(settings, 'getSettings')
      .mockResolvedValueOnce(null)
      .mockResolvedValue({ enableBlocking: true } as DnsSettings)
    render(<BlockingStatus token="T" permissions={undefined} onNotice={() => {}} />)
    expect(await screen.findByText('Could not read the blocking state.')).toBeInTheDocument()
    expect(screen.queryByText('Loading…')).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByText('Blocking is enabled')).toBeInTheDocument()
    expect(read).toHaveBeenCalledTimes(2)
  })

  it('a paused mark is amber only when the user can act on it: the padlock wins', async () => {
    const till = '2099-01-01T21:15:00Z'
    serve({ enableBlocking: false, temporaryDisableBlockingTill: till })
    const { container, unmount } = render(
      <BlockingStatus token="T" permissions={undefined} onNotice={() => {}} />,
    )
    await screen.findByText('Blocking is paused')
    expect(container.querySelector('[data-tone]')).toHaveAttribute('data-tone', 'paused')
    unmount()

    const locked = render(
      <BlockingStatus
        token="T"
        permissions={{ Settings: { canView: true, canModify: false, canDelete: false } }}
        onNotice={() => {}}
      />,
    )
    expect(await screen.findByText('Blocking is paused')).toBeInTheDocument()
    expect(screen.getByText(/^Until /)).toBeInTheDocument()
    expect(locked.container.querySelector('[data-tone]')).toHaveAttribute('data-tone', 'neutral')
  })

  it('says it is disabled when there is no pause in the future', async () => {
    serve({ enableBlocking: false, temporaryDisableBlockingTill: '2000-01-01T00:00:00Z' })
    render(<BlockingStatus token="T" permissions={undefined} onNotice={() => {}} />)
    expect(await screen.findByText('Blocking is disabled')).toBeInTheDocument()
  })

  it('without Settings.canModify the control is disabled with its padlock', async () => {
    serve({ enableBlocking: true })
    render(
      <BlockingStatus
        token="T"
        permissions={{ Settings: { canView: true, canModify: false, canDelete: false } }}
        onNotice={() => {}}
      />,
    )
    expect(await screen.findByRole('button', { name: /Disable/ })).toBeDisabled()
  })

  it('without Settings.canView the status says so and nothing is read', () => {
    const read = serve({ enableBlocking: true })
    render(
      <BlockingStatus
        token="T"
        permissions={{ Settings: { canView: false, canModify: false, canDelete: false } }}
        onNotice={() => {}}
      />,
    )
    expect(screen.getByText('Requires Settings: View')).toBeInTheDocument()
    expect(read).not.toHaveBeenCalled()
  })
})
