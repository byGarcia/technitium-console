import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Login } from './Login'
import { COVER_HEADLINE, COVER_RECORDS } from './LoginCover'
import * as client from '../api/client'
import * as status from '../api/status'

beforeEach(() => {
  vi.restoreAllMocks()
  vi.spyOn(status, 'getStatus').mockResolvedValue(null)
})
afterEach(() => vi.restoreAllMocks())

describe('LoginCover', () => {

  /*
  The texts must not age: the banner's "A new console" is the line this rule
  exists for. And each value has to fit one line of the answer block at 1024 px,
  where the cover is narrowest beside the form (measured on 2026-10-15: 34
  characters of Plex Mono at 14 px leave the value column 286 px wide).
  */
  it('it says nothing that ages and every value fits its line', () => {
    const words = [COVER_HEADLINE, ...COVER_RECORDS.map((r) => r.value)].join(' ').toLowerCase()
    expect(words).not.toMatch(/\b(new|newest|latest|now|soon|beta|20\d\d)\b/)
    for (const r of COVER_RECORDS) {
      expect(r.value.length).toBeLessThanOrEqual(34)
      expect(r.key).toMatch(/^[a-z]+\.$/)
      expect(r.key.length).toBeLessThanOrEqual(9)
    }
  })
})

describe('Login with its cover', () => {
  it('it keeps the form alone inside main and the cover outside it', () => {
    render(<Login onSuccess={() => {}} />)
    const main = screen.getByRole('main')
    const cover = screen.getByRole('complementary')
    expect(main.contains(cover)).toBe(false)
    expect(within(main).getByLabelText('Username')).toBeInTheDocument()
    expect(within(cover).queryByRole('textbox')).toBeNull()
  })

  it('it keeps the upstream heading as the only h1', () => {
    render(<Login onSuccess={() => {}} />)
    const headings = screen.getAllByRole('heading', { level: 1 })
    expect(headings).toHaveLength(1)
    expect(headings[0]).toHaveTextContent('Technitium DNS Server')
  })

  it('it keeps the cover through the two-factor step', async () => {
    vi.spyOn(client, 'apiRequest').mockResolvedValue({ kind: 'two-factor-required' })
    render(<Login onSuccess={() => {}} />)
    await userEvent.type(screen.getByLabelText('Username'), 'admin')
    await userEvent.type(screen.getByLabelText('Password'), 'secret')
    await userEvent.click(screen.getByRole('button', { name: 'Login' }))
    expect(await screen.findByLabelText('OTP')).toBeInTheDocument()
    expect(screen.getByRole('complementary')).toHaveTextContent(COVER_HEADLINE)
    expect(screen.getByRole('main').contains(screen.getByLabelText('OTP'))).toBe(true)
  })
})
