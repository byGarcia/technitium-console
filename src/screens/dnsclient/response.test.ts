import { describe, expect, it } from 'vitest'
import { asDatagram, stripUrl, countByStatus, countByType, extendedErrors, ownerName, rcodeColour, rdataPairs } from './response'

describe('stripUrl (dnsclient.js:132-146)', () => {
  it('keeps a plain name as it is', () => {
    expect(stripUrl('example.com')).toBe('example.com')
  })
  it('cuts the scheme and everything after the host, port or path', () => {
    expect(stripUrl('https://example.com:8443/x')).toBe('example.com')
    expect(stripUrl('http://example.com/path?q=1')).toBe('example.com')
    expect(stripUrl('https://example.com')).toBe('example.com')
  })
})

describe('the datagram', () => {
  it('is an object, never an array or a scalar', () => {
    expect(asDatagram({ RCODE: 'NoError' })).toEqual({ RCODE: 'NoError' })
    expect(asDatagram([])).toBeNull()
    expect(asDatagram('x')).toBeNull()
    expect(asDatagram(null)).toBeNull()
  })

  it('colours the four codes the Dashboard charts and leaves the rest neutral', () => {
    expect(rcodeColour('NoError')).toBe('var(--ch-ok)')
    expect(rcodeColour('NxDomain')).toBe('var(--ch-nx)')
    expect(rcodeColour('ServerFailure')).toBe('var(--ch-fail)')
    expect(rcodeColour('Refused')).toBe('var(--ch-refuse)')
    expect(rcodeColour('FormatError')).toBe('var(--ch-drop)')
    expect(rcodeColour(undefined)).toBe('var(--ch-drop)')
  })

  it('counts by type and by DNSSEC status in order of appearance', () => {
    const rs = [
      { Type: 'A', DnssecStatus: 'Secure' },
      { Type: 'RRSIG', DnssecStatus: 'Secure' },
      { Type: 'A', DnssecStatus: 'Bogus' },
      { Type: 'A' },
    ]
    expect(countByType(rs)).toEqual([['A', 3], ['RRSIG', 1]])
    expect(countByStatus(rs)).toEqual([['Secure', 2], ['Bogus', 1]])
  })

  it('collects the Extended DNS Errors of both places, EDNS first', () => {
    expect(
      extendedErrors({
        EDNS: {
          Options: [
            { Code: 'EXTENDED_DNS_ERROR', Data: { InfoCode: 'Blocked', ExtraText: 'source=blocked-zone' } },
            { Code: 'EDNS_CLIENT_SUBNET', Data: {} },
          ],
        },
        DnsClientExtendedErrors: [{ InfoCode: 'NoReachableAuthority', ExtraText: 'x' }],
      }),
    ).toEqual([
      { source: 'EDNS', infoCode: 'Blocked', extraText: 'source=blocked-zone' },
      { source: 'DNS Client', infoCode: 'NoReachableAuthority', extraText: 'x' },
    ])
    expect(extendedErrors({})).toEqual([])
  })

  it('writes RDATA as the pairs the server keyed, dropping only a TXT repeat', () => {
    expect(rdataPairs({ IPAddress: '1.2.3.4' })).toEqual([['IPAddress', '1.2.3.4']])
    expect(rdataPairs({ Preference: 10, Exchange: 'mx.example' })).toEqual([['Preference', '10'], ['Exchange', 'mx.example']])
    expect(rdataPairs({ Text: 'v=spf1', CharacterStrings: ['v=spf1'] })).toEqual([['Text', 'v=spf1']])
    expect(rdataPairs({ Text: 'ab', CharacterStrings: ['a', 'b'] })).toEqual([['Text', 'ab'], ['CharacterStrings', 'a, b']])
    expect(rdataPairs({ Options: [] })).toEqual([['Options', '']])
    expect(rdataPairs(undefined)).toEqual([])
  })

  it('writes the root owner as a dot', () => {
    expect(ownerName('')).toBe('.')
    expect(ownerName(undefined)).toBe('.')
    expect(ownerName('example.com')).toBe('example.com')
  })
})
