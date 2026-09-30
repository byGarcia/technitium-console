import { describe, expect, it } from 'vitest'
import { detectReverseProxy, webConsoleRedirection, type WebServiceSettings } from './redirect'

const http = (port = '5380') => ({ protocol: 'http:', hostname: 'dns.lan', port })
const https = (port = '53443') => ({ protocol: 'https:', hostname: 'dns.lan', port })

const WS: WebServiceSettings = {
  webServiceHttpPort: 5380,
  webServiceTlsPort: 53443,
  webServiceEnableTls: false,
  webServiceHttpToTlsRedirect: false,
}

describe('detectReverseProxy — checkForReverseProxy (main.js:2275-2291)', () => {
  it('over HTTP on the web service port there is no proxy', () => {
    expect(detectReverseProxy(http('5380'), WS)).toBe(false)
  })

  it('over HTTP on another port there is one', () => {
    expect(detectReverseProxy(http('8080'), WS)).toBe(true)
  })

  it('over HTTP with no port the port is 80', () => {
    expect(detectReverseProxy(http(''), WS)).toBe(true)
    expect(detectReverseProxy(http(''), { ...WS, webServiceHttpPort: 80 })).toBe(false)
  })

  it('over HTTPS with TLS off it is always a proxy', () => {
    expect(detectReverseProxy(https('53443'), WS)).toBe(true)
  })

  it('over HTTPS with TLS on, it depends on the TLS port (443 when absent)', () => {
    const tls = { ...WS, webServiceEnableTls: true }
    expect(detectReverseProxy(https('53443'), tls)).toBe(false)
    expect(detectReverseProxy(https(''), tls)).toBe(true)
    expect(detectReverseProxy(https(''), { ...tls, webServiceTlsPort: 443 })).toBe(false)
  })
})

describe('webConsoleRedirection — checkForWebConsoleRedirection (main.js:2293-2334)', () => {
  it('a detected proxy never redirects', () => {
    expect(webConsoleRedirection(http('8080'), { ...WS, webServiceHttpPort: 9000 }, true)).toBeNull()
  })

  it('over HTTP, a new HTTP port sends to http://host:port', () => {
    expect(webConsoleRedirection(http('5380'), { ...WS, webServiceHttpPort: 9000 }, false)).toBe(
      'http://dns.lan:9000',
    )
  })

  it('over HTTP, nothing changed means no redirection', () => {
    expect(webConsoleRedirection(http('5380'), WS, false)).toBeNull()
  })

  it('over HTTP, TLS with the HTTP-to-HTTPS redirect goes to the TLS port first', () => {
    const s = { ...WS, webServiceEnableTls: true, webServiceHttpToTlsRedirect: true }
    expect(webConsoleRedirection(http('5380'), s, false)).toBe('https://dns.lan:53443')
  })

  it('over HTTP, TLS without the redirect stays on HTTP', () => {
    expect(webConsoleRedirection(http('5380'), { ...WS, webServiceEnableTls: true }, false)).toBeNull()
  })

  it('over HTTPS, switching TLS off goes back to http://host:httpPort', () => {
    expect(webConsoleRedirection(https('53443'), WS, false)).toBe('http://dns.lan:5380')
  })

  it('over HTTPS, a new TLS port sends to https://host:port, and 443 is the default port', () => {
    const s = { ...WS, webServiceEnableTls: true, webServiceTlsPort: 8443 }
    expect(webConsoleRedirection(https('53443'), s, false)).toBe('https://dns.lan:8443')
    expect(webConsoleRedirection(https(''), { ...s, webServiceTlsPort: 443 }, false)).toBeNull()
  })
})
