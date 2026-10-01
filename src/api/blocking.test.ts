import { afterEach, describe, expect, it, vi } from 'vitest'
import { readRuleExport } from './blocking'

afterEach(() => vi.restoreAllMocks())

function serve(body: string) {
  return vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(body))
}

describe('readRuleExport', () => {
  it('asks for the export with the session token and splits the lines', async () => {
    const spy = serve('ads.example.com\r\ndoubleclick.net\n\n')
    const r = await readRuleExport('blocked', 'T')
    expect(r).toEqual({ kind: 'ok', data: ['ads.example.com', 'doubleclick.net'] })
    const [url, init] = spy.mock.calls[0]
    expect(String(url)).toMatch(/api\/blocked\/export$/)
    expect((init as RequestInit).headers).toEqual({ Authorization: 'Bearer T' })
  })

  it('an empty list is an empty array, not an error', async () => {
    serve('')
    expect(await readRuleExport('allowed', 'T')).toEqual({ kind: 'ok', data: [] })
  })

  it('a JSON error answer is an error with the server message', async () => {
    serve(JSON.stringify({ status: 'error', errorMessage: 'Access was denied.' }))
    expect(await readRuleExport('allowed', 'T')).toEqual({ kind: 'error', message: 'Access was denied.' })
  })

  it('an expired session is reported as such', async () => {
    serve(JSON.stringify({ status: 'invalid-token' }))
    expect(await readRuleExport('allowed', 'T')).toEqual({ kind: 'invalid-token' })
  })

  it('a request that never arrives uses upstream sentence', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('down'))
    expect(await readRuleExport('allowed', 'T')).toEqual({
      kind: 'error',
      message: 'Unable to connect to the server. Please try again.',
    })
  })
})
