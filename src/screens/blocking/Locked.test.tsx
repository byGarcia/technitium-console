import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { Locked, LockedBody, LockedItem } from './Locked'

describe('Locked', () => {
  it('keeps the panel title and names the missing permission', () => {
    render(<Locked title="Top Blocked Domains" need="Dashboard.canView" />)
    expect(screen.getByRole('heading', { name: 'Top Blocked Domains' })).toBeInTheDocument()
    expect(screen.getByText('Requires Dashboard: View')).toBeInTheDocument()
  })

  it('its body alone names the missing permission, without a panel', () => {
    render(<LockedBody need="Allowed.canView" />)
    expect(screen.getByText('Requires Allowed: View')).toBeInTheDocument()
    expect(screen.queryByRole('heading')).toBeNull()
  })

  it('a locked menu entry stays, disabled, and its tooltip names the permission', async () => {
    render(<LockedItem need="Blocked.canDelete">Blocked zones</LockedItem>)
    const item = screen.getByRole('button', { name: 'Blocked zones' })
    expect(item).toBeDisabled()
    await userEvent.hover(item.parentElement!)
    expect(screen.getByRole('tooltip')).toHaveTextContent('Requires Blocked: Delete')
  })
})
