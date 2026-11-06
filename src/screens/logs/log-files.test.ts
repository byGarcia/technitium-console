import { describe, expect, it } from 'vitest'
import { cutShort, fileDay, formatBytes, shareOf, sizeBytes, summariseFiles, textFacts } from './log-files'

describe('View Logs: the sizes the server writes', () => {
  it('reads them in every unit, and refuses what is not one', () => {
    expect(sizeBytes('512 B')).toBe(512)
    expect(sizeBytes('6 KB')).toBe(6 * 1024)
    expect(sizeBytes('24.44 KB')).toBeCloseTo(24.44 * 1024)
    expect(sizeBytes('2.39 MB')).toBeCloseTo(2.39 * 1024 * 1024)
    expect(sizeBytes('1.5 GB')).toBeCloseTo(1.5 * 1024 ** 3)
    expect(sizeBytes('big')).toBeNull()
    expect(sizeBytes('')).toBeNull()
  })

  it('writes a sum in the same format: two decimals at most, none when they are zero', () => {
    expect(formatBytes(0)).toBe('0 B')
    expect(formatBytes(6 * 1024)).toBe('6 KB')
    expect(formatBytes(24.44 * 1024)).toBe('24.44 KB')
    expect(formatBytes(2.5 * 1024 * 1024)).toBe('2.5 MB')
  })
})

describe('View Logs: the folder at a glance', () => {
  const FILES = [
    { fileName: '2026-11-06', size: '24.44 KB' },
    { fileName: '2026-11-05', size: '73.31 KB' },
    { fileName: '2026-11-04', size: '2.39 MB' },
    { fileName: 'notes', size: '1 KB' },
  ]

  it('counts the files, adds their sizes and finds the largest', () => {
    const s = summariseFiles(FILES)
    expect(s.count).toBe(4)
    expect(s.total).toBeCloseTo((24.44 + 73.31 + 2.39 * 1024 + 1) * 1024)
    expect(s.largest?.fileName).toBe('2026-11-04')
  })

  it('ranks only the files named by their day, whatever order the list came in', () => {
    const s = summariseFiles([FILES[1], FILES[3], FILES[0], FILES[2]])
    expect(s.newest?.fileName).toBe('2026-11-06')
    expect(s.oldest?.fileName).toBe('2026-11-04')
    expect(summariseFiles([FILES[3]]).newest).toBeNull()
  })

  it('an empty folder is zero files of zero bytes, and has no newest', () => {
    expect(summariseFiles([])).toEqual({ count: 0, total: 0, largest: null, newest: null, oldest: null })
  })

  it('does not add up a size it cannot read', () => {
    expect(summariseFiles([{ fileName: 'x', size: '?' }]).total).toBeNull()
    expect(shareOf({ fileName: 'x', size: '?' }, 100)).toBeNull()
  })

  it('a file is a day only when its name is a real date', () => {
    expect(fileDay('2026-11-06')).toBe('2026-11-06')
    expect(fileDay('2026-02-30')).toBeNull()
    expect(fileDay('2026-11-06.log')).toBeNull()
  })
})

describe('View Logs: what the open text holds', () => {
  it('counts the lines that carry the server timestamp, and keeps the first and the last', () => {
    const text =
      '[2026-11-06 07:05:59 UTC] Logging started.\r\n' +
      'System.Exception: boom\n   at Somewhere()\n' +
      '\0\0[2026-11-06 07:06:04 UTC] After a lost write.\n' +
      '[2026-11-06 07:12:00 Local] Last one.\n'
    expect(textFacts(text)).toEqual({
      entries: 3,
      first: '2026-11-06 07:05:59 UTC',
      last: '2026-11-06 07:12:00 Local',
    })
    expect(textFacts('')).toEqual({ entries: 0, first: null, last: null })
  })

  it('says the text was cut only when it reaches the 2 MB the viewer asks for', () => {
    expect(cutShort('x'.repeat(2 * 1024 * 1024))).toBe(true)
    expect(cutShort('x'.repeat(2 * 1024 * 1024 - 1))).toBe(false)
    // Bytes, not characters: 700,000 three-byte characters are past 2 MB.
    expect(cutShort('€'.repeat(700_000))).toBe(true)
  })
})
