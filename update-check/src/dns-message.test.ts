// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { buildResponse, parseQuery, TYPE_TXT } from './dns-message.ts'
import { encodeQuery } from './test-query.ts'

const NAME = 'latest.technitium-console.pages.dev'

describe('parseQuery', () => {
  it('parses the question Technitium sends', () => {
    const q = parseQuery(encodeQuery('Latest.Technitium-Console.pages.dev', 16, 0, true, 1))
    expect(q).toMatchObject({ id: 0, rd: true, name: NAME, type: 16 })
    expect(q?.question.length).toBe(1 + 6 + 1 + 18 + 1 + 5 + 1 + 3 + 1 + 4)
  })

  it('refuses what it cannot read', () => {
    expect(parseQuery(new Uint8Array(5))).toBeNull()

    const two = encodeQuery(NAME, 16)
    new DataView(two.buffer).setUint16(4, 2)
    expect(parseQuery(two)).toBeNull()

    const long = encodeQuery(NAME, 16)
    long[12] = 60
    expect(parseQuery(long)).toBeNull()

    const pointer = encodeQuery(NAME, 16)
    pointer[12] = 0xc0
    expect(parseQuery(pointer)).toBeNull()
  })
})

describe('buildResponse', () => {
  const query = parseQuery(encodeQuery(NAME, TYPE_TXT, 0x1234, true, 1))!

  it('answers with one TXT', () => {
    const text = 'v=1 latest=1.3.2 server=15.5'
    const r = buildResponse(query, 0, { text, ttl: 3600 })
    const view = new DataView(r.buffer)
    expect(view.getUint16(0)).toBe(0x1234)
    expect(view.getUint16(2)).toBe(0x8580)
    expect(view.getUint16(4)).toBe(1)
    expect(view.getUint16(6)).toBe(1)
    expect(view.getUint16(8)).toBe(0)
    expect(view.getUint16(10)).toBe(0)
    expect([...r.slice(12, 12 + query.question.length)]).toEqual([...query.question])
    const at = 12 + query.question.length
    expect([...r.slice(at, at + 10)]).toEqual([0xc0, 0x0c, 0x00, 0x10, 0x00, 0x01, 0x00, 0x00, 0x0e, 0x10])
    expect(view.getUint16(at + 10)).toBe(29)
    expect(r[at + 12]).toBe(28)
    expect(new TextDecoder().decode(r.slice(at + 13))).toBe(text)
  })

  it('answers NXDOMAIN with no records', () => {
    const r = buildResponse(query, 3)
    const view = new DataView(r.buffer)
    expect(view.getUint16(2) & 0x000f).toBe(3)
    expect(view.getUint16(6)).toBe(0)
    expect(r.length).toBe(12 + query.question.length)
  })

  it('splits long text', () => {
    const r = buildResponse(query, 0, { text: 'x'.repeat(300), ttl: 60 })
    const at = 12 + query.question.length + 12
    expect(r[at]).toBe(255)
    expect(r[at + 1 + 255]).toBe(45)
    expect(r.length).toBe(at + 1 + 255 + 1 + 45)
  })
})
