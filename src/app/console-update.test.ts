import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as dnsclient from '../api/dnsclient'
import {
  checkConsoleUpdate,
  compareVersions,
  CONSOLE_UPDATE_KEY,
  newerConsole,
  parseRecord,
} from './console-update'

describe('parseRecord', () => {
  it('reads the record', () => {
    expect(parseRecord('v=1 latest=1.4.0 server=15.5')).toEqual({ latest: '1.4.0', server: '15.5' })
  })

  it('ignores a record without its version', () => {
    expect(parseRecord('latest=1.4.0 server=15.5')).toBeNull()
  })

  it('ignores keys it does not know', () => {
    expect(parseRecord('v=1 latest=1.4.0 server=15.5 future=x')).toEqual({ latest: '1.4.0', server: '15.5' })
  })

  it('takes two-part versions', () => {
    expect(parseRecord('v=1 latest=1.4 server=15.5')).toEqual({ latest: '1.4', server: '15.5' })
  })

  it('refuses anything that is not a version', () => {
    expect(parseRecord('v=1 latest=<b>1</b> server=15.5')).toBeNull()
    expect(parseRecord('v=1 latest=1.4.0')).toBeNull()
  })
})

describe('compareVersions', () => {
  it('compares field by field', () => {
    expect(compareVersions('1.4.0', '1.3.9')).toBeGreaterThan(0)
    expect(compareVersions('15.6.2', '15.5')).toBeGreaterThan(0)
    expect(compareVersions('15.5', '15.5.0')).toBe(0)
  })

  it('puts a prerelease before its release and after the one before', () => {
    expect(compareVersions('1.4.0-rc.1', '1.4.0')).toBeLessThan(0)
    expect(compareVersions('1.4.0-rc.1', '1.3.2')).toBeGreaterThan(0)
  })
})

describe('newerConsole', () => {
  const release = { latest: '1.4.0', server: '15.5' }

  it('notifies a newer release', () => {
    expect(newerConsole(release, '1.3.1', '15.6.2')).toBe('1.4.0')
  })

  it('stays quiet for the same or an older release', () => {
    expect(newerConsole(release, '1.4.0', '15.6.2')).toBeNull()
    expect(newerConsole(release, '1.5.0', '15.6.2')).toBeNull()
  })

  it('stays quiet when the server is below the minimum', () => {
    expect(newerConsole(release, '1.3.1', '15.4')).toBeNull()
  })

  it('stays quiet without a server version or a record', () => {
    expect(newerConsole(release, '1.3.1', undefined)).toBeNull()
    expect(newerConsole(null, '1.3.1', '15.6.2')).toBeNull()
  })
})

describe('checkConsoleUpdate', () => {
  const NOW = 1_800_000_000_000
  const HOUR = 3_600_000

  function answers(text: string | null) {
    return vi.spyOn(dnsclient, 'resolve').mockResolvedValue({
      kind: 'ok',
      data: {
        status: 'ok',
        response: {
          result: { Answer: text === null ? [] : [{ Type: 'TXT', RDATA: { Text: text } }] },
        },
      },
    } as never)
  }

  beforeEach(() => localStorage.clear())
  afterEach(() => vi.restoreAllMocks())

  it('asks the server with the DoH endpoint and no node', async () => {
    const spy = answers('v=1 latest=1.4.0 server=15.5')
    expect(await checkConsoleUpdate('t', NOW)).toEqual({ latest: '1.4.0', server: '15.5' })
    expect(spy).toHaveBeenCalledWith('t', {
      server: 'https://technitium-console.pages.dev/dns-query',
      domain: 'latest.technitium-console.pages.dev',
      type: 'TXT',
      protocol: 'HTTPS',
      dnssec: false,
    })
  })

  it('reuses a fresh result', async () => {
    const spy = answers('v=1 latest=1.4.0 server=15.5')
    await checkConsoleUpdate('t', NOW)
    expect(await checkConsoleUpdate('t', NOW + HOUR)).toEqual({ latest: '1.4.0', server: '15.5' })
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('asks again after a day', async () => {
    const spy = answers('v=1 latest=1.4.0 server=15.5')
    await checkConsoleUpdate('t', NOW)
    await checkConsoleUpdate('t', NOW + 24 * HOUR)
    expect(spy).toHaveBeenCalledTimes(2)
  })

  it('caches a failed check for a day', async () => {
    const spy = vi.spyOn(dnsclient, 'resolve').mockResolvedValue({ kind: 'error', message: 'Access was denied.' } as never)
    expect(await checkConsoleUpdate('t', NOW)).toBeNull()
    expect(await checkConsoleUpdate('t', NOW + HOUR)).toBeNull()
    expect(spy).toHaveBeenCalledTimes(1)
    expect(JSON.parse(localStorage.getItem(CONSOLE_UPDATE_KEY)!)).toEqual({ at: NOW, release: null })
  })

  it('ignores an answer without TXT', async () => {
    answers(null)
    expect(await checkConsoleUpdate('t', NOW)).toBeNull()
  })

  it('checks when storage cannot be read', async () => {
    const spy = answers('v=1 latest=1.4.0 server=15.5')
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    expect(await checkConsoleUpdate('t', NOW)).toEqual({ latest: '1.4.0', server: '15.5' })
    expect(spy).toHaveBeenCalledTimes(1)
  })
})
