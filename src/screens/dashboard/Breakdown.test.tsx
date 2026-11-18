import { describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Breakdown } from './Breakdown'

const mockChart = {
  labels: ['A', 'AAAA', 'CNAME'],
  datasets: [{ label: 'Total', data: [100, 50, 25] }],
}

describe('Breakdown', () => {
  it('renders all three breakdowns with Bar mode by default', () => {
    render(
      <Breakdown
        responses={mockChart}
        queryTypes={mockChart}
        protocols={mockChart}
        failure={false}
      />,
    )
    expect(screen.getByText('Query Response Types')).toBeInTheDocument()
    expect(screen.getByText('Query Types')).toBeInTheDocument()
    expect(screen.getByText('Protocol Types')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Bar' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('switches to Donut mode when Donut view option is chosen', async () => {
    render(
      <Breakdown
        responses={mockChart}
        queryTypes={mockChart}
        protocols={mockChart}
        failure={false}
      />,
    )
    const donutBtn = screen.getByRole('button', { name: 'Donut' })
    await userEvent.click(donutBtn)
    expect(donutBtn).toHaveAttribute('aria-pressed', 'true')
    // SVG Donut with center total should now be visible
    expect(screen.getAllByText('TOTAL')).toHaveLength(3)
  })

  it('triggers jump callback when legend button is clicked in Query Types', async () => {
    const jumpFn = vi.fn()
    const typeJump = (label: string) => (label === 'A' ? jumpFn : undefined)
    render(
      <Breakdown
        responses={mockChart}
        queryTypes={mockChart}
        protocols={mockChart}
        failure={false}
        typeJump={typeJump}
      />,
    )
    const qtSection = screen.getByRole('region', { name: 'Query Types' })
    const aBtn = within(qtSection).getByRole('button', { name: /^A / })
    await userEvent.click(aBtn)
    expect(jumpFn).toHaveBeenCalledTimes(1)
  })
})
