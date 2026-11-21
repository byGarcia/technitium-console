import { describe, expect, it } from 'vitest'
import { toAscii, toUnicode } from './punycode'

/* The names the server itself returns for these (`zones/create`, `blocked/export`,
   `zones/records/add` on a 15.6.2 harness, 2026-11-20), and samples of RFC 3492 section 7.1. */
const PAIRS: [string, string][] = [
  ['münchen.test', 'xn--mnchen-3ya.test'],
  ['bücher.de', 'xn--bcher-kva.de'],
  ['bär.münchen.test', 'xn--br-via.xn--mnchen-3ya.test'],
  ['ü', 'xn--tda'],
  ['他们为什么不说中文', 'xn--ihqwcrb4cv8a8dqg056pqjye'],
  ['почему.рф', 'xn--e1aoedxv.xn--p1ai'],
]

describe('punycode', () => {
  it('turns each label into its other form, both ways', () => {
    for (const [unicode, ascii] of PAIRS) {
      expect(toAscii(unicode)).toBe(ascii)
      expect(toUnicode(ascii)).toBe(unicode)
    }
  })

  it('leaves plain names, the root and empty labels as they are', () => {
    expect(toAscii('www.example.com')).toBe('www.example.com')
    expect(toUnicode('www.example.com')).toBe('www.example.com')
    expect(toAscii('')).toBe('')
    expect(toUnicode('example.com.')).toBe('example.com.')
  })

  it('lowercases and composes a label before encoding it, as IDNA maps it', () => {
    expect(toAscii('www.MÜNCHEN.test')).toBe('www.xn--mnchen-3ya.test')
    expect(toAscii('münchen.test')).toBe('xn--mnchen-3ya.test')
    expect(toAscii('bücher。de')).toBe('xn--bcher-kva.de')
  })

  it('reads an encoded label in any case and keeps one it cannot decode', () => {
    expect(toUnicode('XN--BCHER-KVA.de')).toBe('bücher.de')
    expect(toUnicode('xn--.test')).toBe('xn--.test')
    expect(toUnicode('xn--a-!.test')).toBe('xn--a-!.test')
  })

  it('keeps a label that decodes to something that would not encode back to it', () => {
    // The server stores both as they are; drawn decoded, the first would read as google.
    expect(toUnicode('xn--google-.review.test')).toBe('xn--google-.review.test')
    expect(toUnicode('xn--a.review.test')).toBe('xn--a.review.test')
    expect(toUnicode('xn--bcher-kva.review.test')).toBe('bücher.review.test')
  })

  it('keeps a label whose decoded form holds a dot or slash look-alike', () => {
    // One label that would read as google．com or a／b: another name, drawn as one.
    expect(toUnicode('xn--googlecom-b854c.test')).toBe('xn--googlecom-b854c.test')
    expect(toUnicode('xn--ab-1u3n.test')).toBe('xn--ab-1u3n.test')
    expect(toUnicode('xn--caf-dma.test')).toBe('café.test')
  })
})
