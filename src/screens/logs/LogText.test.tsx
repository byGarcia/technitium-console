/*
The log as the viewer draws it: marked, never changed.

Everything here is checked on the DOM `LogText` builds, because that is what is
copied, searched and read aloud. The CSS that turns the marks into a quieter
timestamp and a hanging indent is in `Logs.module.css` and `ui/Raw.module.css`.
*/
import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { LogText, logNodes, stampWidth } from './LogText'

const CLASSES = { stamp: 'stamp', chunk: 'chunk' }

const LOG = [
  '[2026-10-16 06:06:32 UTC] Logging started.',
  '[2026-10-16 06:06:32 UTC] DNS Server is reading block list from: https://raw.githubusercontent.com/StevenBlack/hosts/master/hosts',
  'System.Net.Http.HttpRequestException: could not resolve host',
  '   at DnsServerCore.Dns.ZoneManagers.BlockListZoneManager.<>c__DisplayClass40_0 in Z:\\Technitium\\Projects\\DnsServer\\DnsServerCore\\Dns\\ZoneManagers\\BlockListZoneManager.cs:line 607',
  '[2026-10-16 06:06:33 Local] Logging stopped.',
  '',
].join('\r\n')

describe('the server log in the viewer', () => {
  it('the text is the file byte for byte, carriage returns included', () => {
    const { container } = render(<LogText text={LOG} />)
    expect(container.textContent).toBe(LOG)
  })

  it('the hanging indent is the width of the timestamp, UTC or local', () => {
    expect(stampWidth('[2026-10-16 06:06:32 UTC] x')).toBe(26)
    expect(stampWidth('[2026-10-16 06:06:32 Local] x')).toBe(28)
  })

  /* An error from the server is JSON, with no timestamp to hang under. */
  it('a text without the timestamp has none', () => {
    expect(stampWidth('{\n  "status": "error"\n}')).toBe(0)
  })

  it('each line timestamp is its own element, and only the timestamp', () => {
    const stamps = [...logNodes(LOG, CLASSES).querySelectorAll('.stamp')].map((s) => s.textContent)
    expect(stamps).toEqual([
      '[2026-10-16 06:06:32 UTC] ',
      '[2026-10-16 06:06:32 UTC] ',
      '[2026-10-16 06:06:33 Local] ',
    ])
  })

  it('a timestamp in the middle of a line is not one', () => {
    const text = 'see [2026-10-16 06:06:32 UTC] here'
    expect(logNodes(text, CLASSES).querySelectorAll('.stamp')).toHaveLength(0)
  })

  /*
  A long URL or path may end a line only after a separator: what is before each
  `<wbr>` ends in `/`, `\`, `.`, `?`, `&` or `=`, never in a letter.
  */
  it('a long word may break only after its separators', () => {
    const chunk = logNodes(LOG, CLASSES).firstElementChild!
    const before = [...chunk.querySelectorAll('wbr')].map((w) => w.previousSibling?.textContent ?? '')
    expect(before.length).toBeGreaterThan(10)
    for (const text of before) expect(text).toMatch(/[/\\.?&=]$/)
    expect(before.some((t) => t.endsWith('https://'))).toBe(true)
    expect(before.some((t) => t.endsWith('Projects\\'))).toBe(true)
  })

  it('a word short enough to fit a continuation line gets no break', () => {
    const nodes = logNodes('[2026-10-16 06:06:32 UTC] loaded: /etc/dns/dns.config', CLASSES)
    expect(nodes.querySelectorAll('wbr')).toHaveLength(0)
  })

  /* A hundred lines per chunk, and no line is split between two. */
  it('the file is laid out in chunks of a hundred whole lines', () => {
    const text = Array.from({ length: 250 }, (_, i) => `line ${i}\r\n`).join('')
    const chunks = [...logNodes(text, CLASSES).children]
    expect(chunks.map((c) => c.className)).toEqual(['chunk', 'chunk', 'chunk'])
    expect(chunks.map((c) => c.textContent?.split('\n').length)).toEqual([101, 101, 51])
    expect(chunks[1].textContent?.startsWith('line 100\r\n')).toBe(true)
  })

  /* Built from text nodes, never parsed: a log line is data. */
  it('markup in the file is drawn as text', () => {
    const { container } = render(<LogText text={'<img src=x onerror=alert(1)>'} />)
    expect(container.querySelector('img')).toBeNull()
    expect(container.textContent).toBe('<img src=x onerror=alert(1)>')
  })

  it('a new file replaces the previous one', () => {
    const { container, rerender } = render(<LogText text="first" />)
    rerender(<LogText text="second" />)
    expect(container.textContent).toBe('second')
  })
})
