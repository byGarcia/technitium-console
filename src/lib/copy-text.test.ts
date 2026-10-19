import { afterEach, describe, expect, it, vi } from 'vitest'
import { copyText } from './copy-text'

/*
The console is usually served over plain HTTP on the server's address, where
`navigator.clipboard` does not exist (it needs a secure context). The copy has
to work there too.
*/
afterEach(() => {
  vi.restoreAllMocks()
  Reflect.deleteProperty(navigator, 'clipboard')
})

describe('copyText', () => {
  it('uses the Clipboard API where there is one', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    expect(await copyText('curl x | sudo sh')).toBe(true)
    expect(writeText).toHaveBeenCalledWith('curl x | sudo sh')
  })

  it('falls back to a selected textarea and the copy command over plain HTTP', async () => {
    let copied = ''
    document.execCommand = vi.fn(() => {
      copied = (document.activeElement as HTMLTextAreaElement).value
      return true
    })
    expect(await copyText('curl x | sudo sh')).toBe(true)
    expect(copied).toBe('curl x | sudo sh')
    expect(document.querySelector('textarea')).toBeNull()
  })

  it('says so when neither way works', async () => {
    document.execCommand = vi.fn(() => false)
    expect(await copyText('x')).toBe(false)
  })
})

describe('copyText inside a modal', () => {
  it('puts its textarea where it is told, so a focus trap does not take the selection away', async () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    let parent: Node | null = null
    document.execCommand = vi.fn(() => {
      parent = (document.activeElement as HTMLElement).parentNode
      return true
    })
    expect(await copyText('x', host)).toBe(true)
    expect(parent).toBe(host)
    host.remove()
  })
})
