import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Resolution } from './Resolution'
import type { QueryLogEntry } from '../../api/logs'

const e = (responseType: string, rcode: string): QueryLogEntry => ({
  rowNumber: 1, timestamp: '', clientIpAddress: '10.0.0.1', protocol: 'Udp', responseType, rcode, qname: 'a', qtype: 'A', qclass: 'IN', answer: null,
})
const entries = [...Array(60)].map(() => e('Cached', 'NoError')).concat([...Array(40)].map(() => e('Blocked', 'NxDomain')))

describe('the How a query is resolved card', () => {
  it('names the kinds and codes with their counts, and says what it is drawn from', () => {
    render(<Resolution sample={{ kind: 'ok', entries }} where=" on ns1.example" />)
    expect(screen.getByText('From the latest 100 logged queries on ns1.example')).toBeInTheDocument()
    expect(screen.getByText('Queries')).toBeInTheDocument()
    expect(screen.getAllByText('Cached').length).toBeGreaterThan(0)
    expect(screen.getAllByText('NX Domain').length).toBeGreaterThan(0)
  })

  it('opens Query Logs filtered by a kind or by a code', async () => {
    const open = vi.fn()
    render(<Resolution sample={{ kind: 'ok', entries }} where="" open={open} />)
    await userEvent.click(screen.getByRole('button', { name: 'Cached 60' }))
    expect(open).toHaveBeenCalledWith({ responseType: 'Cached' })
    await userEvent.click(screen.getAllByRole('button', { name: 'NX Domain 40' })[0])
    expect(open).toHaveBeenLastCalledWith({ rcode: 'NxDomain' })
  })

  it('takes no click where Query Logs cannot land, and says when nothing was logged', () => {
    const { unmount } = render(<Resolution sample={{ kind: 'ok', entries }} where="" />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    unmount()
    render(<Resolution sample={{ kind: 'ok', entries: [] }} where="" />)
    expect(screen.getByText('No queries logged yet.')).toBeInTheDocument()
  })

  it('is locked without Logs: View', () => {
    render(<Resolution sample={{ kind: 'locked' }} where="" />)
    expect(screen.getByText(/Logs/)).toBeInTheDocument()
  })
})
