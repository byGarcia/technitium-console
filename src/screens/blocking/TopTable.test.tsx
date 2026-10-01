import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import * as blocking from '../../api/blocking'
import type { ApiOutcome } from '../../api/client'
import type { TopEntry } from '../../api/dashboard'
import { TopTable } from './TopTable'

afterEach(() => vi.restoreAllMocks())

const ROWS: TopEntry[] = [
  { name: 'googleads.g.doubleclick.net', hits: 1204 },
  { name: 'app-measurement.com', hits: 748 },
]
const P = (v: boolean, m: boolean, d: boolean) => ({ canView: v, canModify: m, canDelete: d })

describe('TopTable', () => {
  it('Allow Domain runs upstream two calls and reports with its sentence', async () => {
    const allow = vi.spyOn(blocking, 'allowDomain').mockResolvedValue({ kind: 'ok', data: {} })
    const onNotice = vi.fn()
    const onChanged = vi.fn()
    render(
      <TopTable kind="TopBlockedDomains" rows={ROWS} range="LastHour" token="T"
        permissions={undefined} failure={false} onNotice={onNotice} onChanged={onChanged} />,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Actions for googleads.g.doubleclick.net' }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Allow Domain' }))
    expect(allow).toHaveBeenCalledWith('T', 'googleads.g.doubleclick.net')
    expect(onNotice).toHaveBeenCalledWith({
      type: 'success', title: 'Allowed!',
      text: "Domain 'googleads.g.doubleclick.net' was added to Allowed Zone successfully.",
    })
    expect(onChanged).toHaveBeenCalled()
  })

  it('Block Domain reports with its own sentence', async () => {
    const block = vi.spyOn(blocking, 'blockDomain').mockResolvedValue({ kind: 'ok', data: {} })
    const onNotice = vi.fn()
    render(
      <TopTable kind="TopDomains" rows={ROWS} range="LastHour" token="T"
        permissions={undefined} failure={false} onNotice={onNotice} onChanged={() => {}} />,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Actions for app-measurement.com' }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Block Domain' }))
    expect(block).toHaveBeenCalledWith('T', 'app-measurement.com')
    expect(onNotice).toHaveBeenCalledWith({
      type: 'success', title: 'Blocked!',
      text: "Domain 'app-measurement.com' was added to Blocked Zone successfully.",
    })
  })

  it('a failed call reports the server message and refreshes nothing', async () => {
    vi.spyOn(blocking, 'allowDomain').mockResolvedValue({ kind: 'error', message: 'Access was denied.' })
    const onNotice = vi.fn()
    const onChanged = vi.fn()
    render(
      <TopTable kind="TopBlockedDomains" rows={ROWS} range="LastHour" token="T"
        permissions={undefined} failure={false} onNotice={onNotice} onChanged={onChanged} />,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Actions for googleads.g.doubleclick.net' }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Allow Domain' }))
    expect(onNotice).toHaveBeenCalledWith({ type: 'danger', title: 'Error!', text: 'Access was denied.' })
    expect(onChanged).not.toHaveBeenCalled()
  })

  it('a row cannot run twice while its two calls are in flight, and settles enabled', async () => {
    let settle: (o: ApiOutcome) => void = () => {}
    const allow = vi.spyOn(blocking, 'allowDomain').mockReturnValue(new Promise((r) => { settle = r }))
    render(
      <TopTable kind="TopBlockedDomains" rows={ROWS} range="LastHour" token="T"
        permissions={undefined} failure={false} onNotice={() => {}} onChanged={() => {}} />,
    )
    const trigger = screen.getByRole('button', { name: 'Actions for googleads.g.doubleclick.net' })
    await userEvent.click(trigger)
    await userEvent.click(screen.getByRole('menuitem', { name: 'Allow Domain' }))

    await userEvent.click(trigger)
    const pending = screen.getByRole('button', { name: 'Allow Domain' })
    expect(pending).toBeDisabled()
    await userEvent.click(pending)
    expect(allow).toHaveBeenCalledTimes(1)

    /* Only that row: the other one can still act. */
    await userEvent.click(screen.getByRole('button', { name: 'Actions for app-measurement.com' }))
    expect(screen.getByRole('menuitem', { name: 'Allow Domain' })).toBeEnabled()

    await act(async () => settle({ kind: 'ok', data: {} }))
    await userEvent.click(trigger)
    expect(screen.getByRole('menuitem', { name: 'Allow Domain' })).toBeEnabled()
  })

  it('a failed sequence also gives the row back', async () => {
    let settle: (o: ApiOutcome) => void = () => {}
    vi.spyOn(blocking, 'blockDomain').mockReturnValue(new Promise((r) => { settle = r }))
    render(
      <TopTable kind="TopDomains" rows={ROWS} range="LastHour" token="T"
        permissions={undefined} failure={false} onNotice={() => {}} onChanged={() => {}} />,
    )
    const trigger = screen.getByRole('button', { name: 'Actions for app-measurement.com' })
    await userEvent.click(trigger)
    await userEvent.click(screen.getByRole('menuitem', { name: 'Block Domain' }))
    await act(async () => settle({ kind: 'error', message: 'Access was denied.' }))
    await userEvent.click(trigger)
    expect(screen.getByRole('menuitem', { name: 'Block Domain' })).toBeEnabled()
  })

  it('Block Domain needs Allowed.canDelete AND Blocked.canModify: missing one disables it', async () => {
    const user = userEvent.setup()
    render(
      <TopTable kind="TopDomains" rows={ROWS} range="LastHour" token="T"
        permissions={{ Allowed: P(true, true, false), Blocked: P(true, true, true) }}
        failure={false} onNotice={() => {}} onChanged={() => {}} />,
    )
    await user.click(screen.getByRole('button', { name: 'Actions for googleads.g.doubleclick.net' }))
    /* `ui/Menu` keeps a disabled item as a button on purpose: announced, not reachable. */
    const item = screen.getByRole('button', { name: /Block Domain/ })
    expect(item).toBeDisabled()
    await user.hover(item.parentElement!)
    expect(await screen.findByText('Requires Allowed: Delete')).toBeInTheDocument()
  })

  it('Allow Domain names the missing permission of its pair', async () => {
    const user = userEvent.setup()
    render(
      <TopTable kind="TopBlockedDomains" rows={ROWS} range="LastHour" token="T"
        permissions={{ Allowed: P(true, false, true), Blocked: P(true, true, true) }}
        failure={false} onNotice={() => {}} onChanged={() => {}} />,
    )
    await user.click(screen.getByRole('button', { name: 'Actions for googleads.g.doubleclick.net' }))
    const item = screen.getByRole('button', { name: /Allow Domain/ })
    expect(item).toBeDisabled()
    await user.hover(item.parentElement!)
    expect(await screen.findByText('Requires Allowed: Modify')).toBeInTheDocument()
  })

  it('zero rows is a true empty state, a failure is not', () => {
    const { rerender } = render(
      <TopTable kind="TopDomains" rows={[]} range="LastHour" token="T" permissions={undefined}
        failure={false} onNotice={() => {}} onChanged={() => {}} />,
    )
    expect(screen.getByText('No domains for this period.')).toBeInTheDocument()
    rerender(
      <TopTable kind="TopDomains" rows={[]} range="LastHour" token="T" permissions={undefined}
        failure onNotice={() => {}} onChanged={() => {}} />,
    )
    expect(screen.queryByText('No domains for this period.')).toBeNull()
  })
})
