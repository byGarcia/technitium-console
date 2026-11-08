import { describe, expect, it } from 'vitest'
import { isAbsoluteUri, isDomainNameValid, parseEndpoint, parseIp, parseNetwork } from './dotnet-parse'

/* The tables under "as a v11.2.1 server answered" are measured: each key was sent
   with apps/config/set to a real server. What is marked CHECK AGAINST A REAL SERVER
   comes from the documentation of .NET and was not among the cases measured. The rest
   follows TechnitiumLibrary line by line. */

describe('as a v11.2.1 server answered', () => {
  it.each([
    ['10.1', true], ['10.1/16', true], ['0x0a.0.0.1', true], ['010.0.0.1', true],
    ['[::]/0', true], ['[::1]', true], ['::/0', true], ['::ffff:1.2.3.4', true],
    ['1.2.3.4/32', true], ['1.2.3.5/24', true], ['1.2.3.4/33', false], ['1.2.3.4/', false],
    ['1.2.3.4/255', true], ['::1/129', false], ['::1/255', true], ['256.1.1.1', false],
    ['example.com', false], [' 1.2.3.4', false], ['1.2.3.4 ', false], ['', false],
  ] as const)('network key "%s": %s', (key, ok) => {
    expect(parseNetwork(key) !== null).toBe(ok)
  })

  it.each([
    ['10.0.0.1', '10.0.0.1/32', true],
    ['::1', '[::1]', true],
    ['10.0.0.1/24', '10.0.0.2/24', true],
  ] as const)('networks "%s" and "%s" are one key: %s', (a, b, same) => {
    expect(parseNetwork(a)?.canonical === parseNetwork(b)?.canonical).toBe(same)
  })

  it.each([
    ['127.0.0.1', true], ['127.0.0.1:53', true], ['[::1]:53', true], ['::1', true], ['::1:53', true],
    ['name.example.com', true], ['name.example.com:443', true], ['name.example.com:99999', false],
    ['name_x.example.com', true], ['-bad.example.com', true], ['a..b', false],
    ['name.example.com.', false], ['a:b:c', false], ['', true],
  ] as const)('endpoint key "%s": %s', (key, ok) => {
    expect(parseEndpoint(key) !== null).toBe(ok)
  })

  it.each([
    ['NAME.example.com', 'name.example.com', false],
    ['127.0.0.1', '127.0.0.1:0', true],
  ] as const)('endpoints "%s" and "%s" are one key: %s', (a, b, same) => {
    expect(parseEndpoint(a)?.canonical === parseEndpoint(b)?.canonical).toBe(same)
  })

  it.each([
    ['example.com/a', false], ['a.txt', false], ['/nonexistent/a.txt', true],
    ['file:///nonexistent/a.txt', true], ['C:\\nonexistent\\a.txt', true],
    ['ftp://example.invalid/a', true], ['https://example.invalid/a b', true], ['', false],
  ] as const)('list URL "%s": %s', (url, ok) => {
    expect(isAbsoluteUri(url)).toBe(ok)
  })
})

describe('parseIp', () => {
  it('reads dotted quads', () => {
    expect(parseIp('192.168.10.20')).toEqual({ family: 4, canonical: '192.168.10.20' })
    expect(parseIp('0.0.0.0')).toEqual({ family: 4, canonical: '0.0.0.0' })
  })

  /* That they are accepted is measured; CHECK AGAINST A REAL SERVER the exact value
     each form reads as, which is the IPAddress.Parse documentation. */
  it('reads the short forms IPAddress.TryParse accepts', () => {
    expect(parseIp('10.1')?.canonical).toBe('10.0.0.1')
    expect(parseIp('127.1')?.canonical).toBe('127.0.0.1')
    expect(parseIp('10.1.2')?.canonical).toBe('10.1.0.2')
    expect(parseIp('1')?.canonical).toBe('0.0.0.1')
    expect(parseIp('65536')?.canonical).toBe('0.1.0.0')
    expect(parseIp('4294967295')?.canonical).toBe('255.255.255.255')
    expect(parseIp('0x7f.1')?.canonical).toBe('127.0.0.1')
    expect(parseIp('010.0.0.1')?.canonical).toBe('8.0.0.1')
  })

  it('refuses what is not an IPv4 address', () => {
    for (const bad of ['', ' 1.2.3.4', '1.2.3.4 ', '1.2.3.4.5', '1.2.3.', '.1.2.3', '1..2', '192.168.300.0', '1.2.3.256', '4294967296', '08.1.1.1', '0x', 'a.b.c.d', 'example.com']) {
      expect(parseIp(bad), bad).toBeNull()
    }
  })

  it('reads IPv6, compressed or not, and compares them by value', () => {
    const one = parseIp('::1')
    expect(one?.family).toBe(6)
    expect(parseIp('0:0:0:0:0:0:0:1')?.canonical).toBe(one?.canonical)
    expect(parseIp('0000::0001')?.canonical).toBe(one?.canonical)
    expect(parseIp('2001:DB8::A')?.canonical).toBe(parseIp('2001:db8::a')?.canonical)
    expect(parseIp('::')?.canonical).toBe(parseIp('0:0:0:0:0:0:0:0')?.canonical)
  })

  /* Brackets and embedded IPv4 are measured. CHECK AGAINST A REAL SERVER the scope,
     which is the IPAddress.Parse documentation. */
  it('reads brackets, embedded IPv4 and a scope', () => {
    expect(parseIp('[::1]')?.canonical).toBe(parseIp('::1')?.canonical)
    expect(parseIp('::ffff:1.2.3.4')?.canonical).toBe(parseIp('::ffff:102:304')?.canonical)
    expect(parseIp('fe80::1%3')?.family).toBe(6)
    expect(parseIp('fe80::1%3')?.canonical).not.toBe(parseIp('fe80::1')?.canonical)
  })

  it('refuses what is not an IPv6 address', () => {
    for (const bad of [':', ':::', '1:2', ':1::', '1::2::3', '12345::', 'g::', '1:2:3:4:5:6:7:8:9', '1:2:3:4:5:6:7', '1:2:3:4:5:6:7:8::', '[::1', '::1]', '::1.2.3', '::1.2.3.256']) {
      expect(parseIp(bad), bad).toBeNull()
    }
  })
})

describe('parseNetwork', () => {
  it('accepts what the stock config and the spec use', () => {
    expect(parseNetwork('[::]/0')?.canonical).toBe(`${parseIp('::')?.canonical}/0`)
    expect(parseNetwork('::/0')?.canonical).toBe(parseNetwork('[::]/0')?.canonical)
    expect(parseNetwork('0.0.0.0/0')?.canonical).toBe('0.0.0.0/0')
    expect(parseNetwork('192.168.10.20')?.canonical).toBe('192.168.10.20/32')
    expect(parseNetwork('10.1')?.canonical).toBe('10.0.0.1/32')
    expect(parseNetwork('::1')?.canonical).toBe(`${parseIp('::1')?.canonical}/128`)
  })

  it('refuses a bad address or a prefix out of range (NetworkAddress.cs:87-140)', () => {
    for (const bad of ['', '/', '/24', '192.168.300.0/24', '1.2.3.4/33', '::/129', 'a/b', '1.2.3.4/', '1.2.3.4/a', '1.2.3.4/256', '1.2.3.4/-1', '1.2.3.4/24/1', 'example.com']) {
      expect(parseNetwork(bad), bad).toBeNull()
    }
  })

  it('gives one canonical to two spellings of the same network (NetworkAddress.cs:219-234)', () => {
    expect(parseNetwork('10.0.0.1')?.canonical).toBe(parseNetwork('10.0.0.1/32')?.canonical)
    expect(parseNetwork('[::1]')?.canonical).toBe(parseNetwork('::1/128')?.canonical)
  })

  /* NetworkAddress.cs:67 stores address.GetNetworkAddress(prefixLength): the host
     bits are accepted and then masked, so these two are ONE key for map.Add. */
  it('accepts host bits and masks them, as the constructor does', () => {
    expect(parseNetwork('192.168.1.5/24')?.canonical).toBe('192.168.1.0/24')
    expect(parseNetwork('192.168.1.5/24')?.canonical).toBe(parseNetwork('192.168.1.0/24')?.canonical)
    expect(parseNetwork('2001:db8::1/32')?.canonical).toBe(parseNetwork('2001:db8::/32')?.canonical)
    expect(parseNetwork('255.255.255.255/0')?.canonical).toBe('0.0.0.0/0')
  })

  /* NetworkAddress.cs:108 and :121 read 255 as "no prefix given": a quirk, and a
     value the server accepts, so the console has to accept it too. */
  it('reads a prefix of 255 as no prefix, as the server does', () => {
    expect(parseNetwork('1.2.3.4/255')?.canonical).toBe('1.2.3.4/32')
    expect(parseNetwork('::1/255')?.canonical).toBe(`${parseIp('::1')?.canonical}/128`)
  })

  /* byte.TryParse with its default style: documented, not read here. CHECK AGAINST
     A REAL SERVER. */
  it('reads the prefix the way byte.TryParse does', () => {
    expect(parseNetwork('1.2.3.0/024')?.canonical).toBe('1.2.3.0/24')
    expect(parseNetwork('1.2.3.0/+24')?.canonical).toBe('1.2.3.0/24')
    expect(parseNetwork('1.2.3.0/ 24 ')?.canonical).toBe('1.2.3.0/24')
  })
})

describe('parseEndpoint', () => {
  it('accepts every example of the stock config', () => {
    for (const ok of ['127.0.0.1', '192.168.10.2:53', '[::1]:53', '::1', 'user1.dot.example.com', 'user2.doh.example.com:443']) {
      expect(parseEndpoint(ok), ok).not.toBeNull()
    }
  })

  it('refuses what neither parser reads (EndPointExtensions.cs:246-262, DomainEndPoint.cs:62-100)', () => {
    for (const bad of ['a:b:c', 'name:99999', 'name:abc', '1.2.3.4:99999', 'bad name', 'a..b', 'exa$mple.com', `${'a'.repeat(64)}.com`]) {
      expect(parseEndpoint(bad), bad).toBeNull()
    }
  })

  it('reads a bare address as port 0, the same endpoint as :0', () => {
    expect(parseEndpoint('127.0.0.1')?.canonical).toBe(parseEndpoint('127.0.0.1:0')?.canonical)
    expect(parseEndpoint('a.example')?.canonical).toBe(parseEndpoint('a.example:0')?.canonical)
    expect(parseEndpoint('127.0.0.1:53')?.canonical).not.toBe(parseEndpoint('127.0.0.1')?.canonical)
  })

  it('takes an IP in any spelling as that IP', () => {
    expect(parseEndpoint('10.1:53')?.canonical).toBe(parseEndpoint('10.0.0.1:53')?.canonical)
    expect(parseEndpoint('[::1]:53')?.canonical).not.toBe(parseEndpoint('::1')?.canonical)
    expect(parseEndpoint('::1')?.canonical).toBe(parseEndpoint('[::1]')?.canonical)
  })

  /* DomainEndPoint.cs:127 ignores the case but :141 hashes with it, so the Dictionary
     of the app keeps the two apart. Measured: that config loads. */
  it('keeps the case of a name in the canonical', () => {
    expect(parseEndpoint('DoH.Example.COM:443')?.canonical).not.toBe(parseEndpoint('doh.example.com:443')?.canonical)
    expect(parseEndpoint('a.example')?.canonical).toBe(parseEndpoint('a.example:0')?.canonical)
    expect(parseEndpoint('10.1')?.canonical).toBe(parseEndpoint('10.0.0.1')?.canonical)
  })

  it('takes the empty string and a bare port as the root, which the server accepts', () => {
    expect(parseEndpoint('')).not.toBeNull()
    expect(parseEndpoint(':53')).not.toBeNull()
  })

  it('takes a name that only looks like an IP for a name (DomainEndPoint.cs:71)', () => {
    expect(parseEndpoint('999.999:53')).not.toBeNull()
  })

  /* ushort.TryParse with its default style against IPEndPoint with digits only: the
     first is documented, the second is the IPEndPoint source. CHECK AGAINST A REAL SERVER. */
  it('reads the port of a name with the leniency of ushort.TryParse', () => {
    expect(parseEndpoint('name:+53')?.canonical).toBe(parseEndpoint('name:53')?.canonical)
    expect(parseEndpoint('1.2.3.4:+53')).toBeNull()
  })

  it('converts a unicode name to its ASCII form (DomainEndPoint.cs:77)', () => {
    expect(parseEndpoint('b\u00fccher.example')?.canonical).toBe(parseEndpoint('xn--bcher-kva.example')?.canonical)
  })
})

describe('isDomainNameValid (DnsClient.cs:2539-2624)', () => {
  it('takes the empty string as the root', () => {
    expect(isDomainNameValid('')).toBe(true)
  })

  it('takes letters, digits, hyphen, underscore, slash and a lone star label', () => {
    for (const ok of ['example.com', 'EXAMPLE.com', 'a-b.c_d', '1.2', '*.example.com', 'a/b.example', 'a']) {
      expect(isDomainNameValid(ok), ok).toBe(true)
    }
  })

  it('refuses an empty label, so a trailing dot too', () => {
    for (const bad of ['.', 'a.', '.a', 'a..b']) {
      expect(isDomainNameValid(bad), bad).toBe(false)
    }
  })

  it('refuses any other character, a star inside a label included', () => {
    for (const bad of ['a b', 'a$b', 'a:b', '*a.example', 'a*.example', 'caf\u00e9.example']) {
      expect(isDomainNameValid(bad), bad).toBe(false)
    }
  })

  it('takes labels up to 63 and names up to 255, and no more', () => {
    expect(isDomainNameValid('a'.repeat(63))).toBe(true)
    expect(isDomainNameValid('a'.repeat(64))).toBe(false)
    const long = Array(32).fill('a'.repeat(7)).join('.')
    expect(long.length).toBe(255)
    expect(isDomainNameValid(long)).toBe(true)
    expect(isDomainNameValid(`${long}a`)).toBe(false)
  })
})

/* Beyond the measured table above, CHECK AGAINST A REAL SERVER the UNC path and the
   trimming: new Uri(string) as its documentation describes it. */
describe('isAbsoluteUri', () => {
  it('takes a scheme, a rooted path and a drive', () => {
    for (const ok of ['https://x/y', 'file:///etc/dns/a.txt', '/etc/dns/a.txt', 'C:\\lists\\a.txt', '\\\\server\\share\\a.txt', 'ftp://x', 'example.com:8080/a']) {
      expect(isAbsoluteUri(ok), ok).toBe(true)
    }
  })

  it('refuses what is relative', () => {
    for (const bad of ['example.com/a', 'hosts.txt', '', '   ', '1http://x', './a.txt']) {
      expect(isAbsoluteUri(bad), bad).toBe(false)
    }
  })

  it('ignores the whitespace new Uri trims', () => {
    expect(isAbsoluteUri('  https://x/y ')).toBe(true)
  })
})
