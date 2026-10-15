/*
A URL wraps after its separators and reads as written.

jsdom does not lay text out, so what is checked is the DOM that decides the
wrapping: where the `<wbr>` go, and that the text around them is the URL untouched.
*/
import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { UrlText } from './UrlText'

function breaks(url: string): string[] {
  const { container, unmount } = render(<UrlText url={url} />)
  const out: string[] = []
  let piece = ''
  for (const node of container.childNodes) {
    if (node.nodeName === 'WBR') {
      out.push(piece)
      piece = ''
    } else piece += node.textContent
  }
  out.push(piece)
  expect(container.textContent).toBe(url)
  unmount()
  return out
}

describe('a URL', () => {
  it('may break after each run of separators, never inside one', () => {
    expect(breaks('https://raw.githubusercontent.com/StevenBlack/hosts/master/hosts')).toEqual([
      'https://', 'raw.', 'githubusercontent.', 'com/', 'StevenBlack/', 'hosts/', 'master/', 'hosts',
    ])
    expect(breaks('file:///etc/dns/list.txt')).toEqual(['file:///', 'etc/', 'dns/', 'list.', 'txt'])
    expect(breaks('https://x.test/a?b=1&c=2')).toEqual(['https://', 'x.', 'test/', 'a?', 'b=', '1&', 'c=', '2'])
  })

  it('leaves text with no separator as it is', () => {
    expect(breaks('hosts')).toEqual(['hosts'])
  })
})
