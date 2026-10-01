import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Locked } from './Locked'

describe('Locked', () => {
  it('keeps the panel title and names the missing permission', () => {
    render(<Locked title="Top Blocked Domains" need="Dashboard.canView" />)
    expect(screen.getByRole('heading', { name: 'Top Blocked Domains' })).toBeInTheDocument()
    expect(screen.getByText('Requires Dashboard: View')).toBeInTheDocument()
  })
})
