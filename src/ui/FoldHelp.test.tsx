import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FoldHelp } from './FoldHelp'

/*
The fold measures the laid-out paragraph, and jsdom lays nothing out: its heights
are all 0. These tests give the paragraph the heights a browser would.
*/
function heights(scroll: number, client: number) {
  vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(scroll)
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(client)
}

afterEach(() => vi.restoreAllMocks())

const TEXT = 'The time interval after which an idle QUIC connection will be closed. This option applies only to QUIC transport protocol.'

describe('FoldHelp', () => {
  it('a help that fits its line has no button', () => {
    heights(18, 18)
    render(<FoldHelp>Short help.</FoldHelp>)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('a help cut by its line gets "more", and the whole text is in the document all the same', () => {
    heights(54, 18)
    render(<FoldHelp>{TEXT}</FoldHelp>)
    const more = screen.getByRole('button', { name: 'more' })
    expect(more).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByText(TEXT)).toBeInTheDocument()
    expect(document.getElementById(more.getAttribute('aria-controls')!)).toHaveTextContent(TEXT)
  })

  it('"more" unfolds it and "less" folds it back', async () => {
    heights(54, 18)
    render(<FoldHelp>{TEXT}</FoldHelp>)
    await userEvent.click(screen.getByRole('button', { name: 'more' }))
    const less = screen.getByRole('button', { name: 'less' })
    expect(less).toHaveAttribute('aria-expanded', 'true')
    await userEvent.click(less)
    expect(screen.getByRole('button', { name: 'more' })).toHaveAttribute('aria-expanded', 'false')
  })

  it('its button is not part of the help a search reads', () => {
    heights(54, 18)
    render(<FoldHelp>{TEXT}</FoldHelp>)
    expect(screen.getByRole('button', { name: 'more' })).toHaveAttribute('data-search-skip')
  })
})
