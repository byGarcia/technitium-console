import { describe, expect, it } from 'vitest'
import { applyQuickEntry } from './quick-lists'

const A = { name: 'Steven Black', urls: ['https://a.test/hosts'] }
const DEFAULT = { name: 'Default', urls: ['https://d.test/hosts'] }

describe('applyQuickEntry', () => {
  it('appends to what is already there', () => {
    expect(applyQuickEntry('https://x.test/list\n', A)).toBe('https://x.test/list\nhttps://a.test/hosts\n')
  })

  /* The asymmetry is upstream's (main.js:509): "Default" starts from empty and
     every other entry adds to what is there. */
  it('"Default" replaces instead of appending', () => {
    expect(applyQuickEntry('https://x.test/list\n', DEFAULT)).toBe('https://d.test/hosts\n')
  })

  it('matches "Default" whatever its case', () => {
    expect(applyQuickEntry('keep\n', { name: 'DEFAULT', urls: ['u\n'.trim()] })).toBe('u\n')
  })

  it('does not add a URL that is already in the field', () => {
    expect(applyQuickEntry('https://a.test/hosts\n', A)).toBe('https://a.test/hosts\n')
  })

  it('adds several at once, skipping the ones present', () => {
    const e = { name: 'Pair', urls: ['https://a.test/hosts', 'https://b.test/hosts'] }
    expect(applyQuickEntry('https://a.test/hosts\n', e)).toBe('https://a.test/hosts\nhttps://b.test/hosts\n')
  })

  it('works from an empty field', () => {
    expect(applyQuickEntry('', A)).toBe('https://a.test/hosts\n')
  })
})

import { applyQuickForwarder } from './quick-lists'

describe('applyQuickForwarder', () => {
  const CF = { name: 'Cloudflare', protocol: 'UDP', addresses: ['1.1.1.1', '1.0.0.1'] }

  it('replaces the forwarders with the entry addresses, one per line', () => {
    expect(applyQuickForwarder(CF).forwarders).toBe('1.1.1.1\n1.0.0.1\n')
  })

  it('maps the protocol to this console own casing', () => {
    expect(applyQuickForwarder({ ...CF, protocol: 'HTTPS' }).forwarderProtocol).toBe('Https')
    expect(applyQuickForwarder({ ...CF, protocol: 'TLS' }).forwarderProtocol).toBe('Tls')
  })

  it('falls back to UDP for anything it does not know', () => {
    expect(applyQuickForwarder({ ...CF, protocol: 'SOMETHING' }).forwarderProtocol).toBe('Udp')
    expect(applyQuickForwarder({ name: 'x', addresses: [] }).forwarderProtocol).toBe('Udp')
  })

  /*
  The one that matters. Upstream's switch has no default branch and the null case
  becomes "DefaultProxy", which matches nothing: an entry that says nothing about
  proxying must not undo what the administrator configured.
  */
  it('leaves the proxy untouched when the entry says nothing about it', () => {
    const p = applyQuickForwarder(CF)
    expect(p.proxyType).toBeUndefined()
    expect(p.proxyAddress).toBeUndefined()
  })

  it('clears the proxy when the entry says NONE', () => {
    const p = applyQuickForwarder({ ...CF, proxyType: 'NONE' })
    expect(p.proxyType).toBe('None')
    expect(p.proxyAddress).toBe('')
    expect(p.proxyPassword).toBe('')
  })

  it('fills the proxy when the entry brings one', () => {
    const p = applyQuickForwarder({
      ...CF, proxyType: 'SOCKS5', proxyAddress: '127.0.0.1',
      proxyPort: '9050', proxyUsername: 'u', proxyPassword: 'p',
    })
    expect(p.proxyType).toBe('Socks5')
    expect(p.proxyAddress).toBe('127.0.0.1')
    expect(p.proxyPort).toBe('9050')
    expect(p.proxyUsername).toBe('u')
    expect(p.proxyPassword).toBe('p')
  })

  it('understands HTTP as well as SOCKS5', () => {
    expect(applyQuickForwarder({ ...CF, proxyType: 'HTTP' }).proxyType).toBe('Http')
  })
})

import { serverListOptions, THIS_SERVER } from './quick-lists'

describe('serverListOptions', () => {
  it('always offers this server first', () => {
    expect(serverListOptions([])[0]).toBe(THIS_SERVER)
  })

  /* One per ADDRESS, not per entry: Cloudflare alone contributes several. */
  it('offers one option per address, not per entry', () => {
    const o = serverListOptions([{ name: 'Cloudflare', addresses: ['1.1.1.1', '1.0.0.1'] }])
    expect(o).toEqual([THIS_SERVER, 'Cloudflare {1.1.1.1}', 'Cloudflare {1.0.0.1}'])
  })

  it('uses the bare address when the entry has no name', () => {
    expect(serverListOptions([{ addresses: ['9.9.9.9'] }])).toEqual([THIS_SERVER, '9.9.9.9'])
    expect(serverListOptions([{ name: '', addresses: ['9.9.9.9'] }])).toEqual([THIS_SERVER, '9.9.9.9'])
  })
})
