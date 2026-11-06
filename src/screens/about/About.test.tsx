import { describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { About, uptime } from './About'

const info = { version: '15.4', uptimestamp: '2026-08-25T13:07:31Z', dnsServerDomain: 'dns.example.net' }

/* A panel or a card, found by its title: the title sits in the panel's header,
   whose parent is the panel. */
function block(name: string): HTMLElement {
  const heading = screen.getByRole('heading', { level: 2, name })
  return (heading.parentElement?.tagName === 'SECTION' ? heading.parentElement : heading.parentElement?.parentElement) as HTMLElement
}

/* What a block says, with the spacing the markup adds folded away. */
function said(el: HTMLElement): string {
  return (el.textContent ?? '').replace(/\s+/g, ' ')
}

describe('About', () => {
  it('the header is the server: its name, its logo and its domain, under the About path', () => {
    render(<About info={info} />)
    expect(screen.getByRole('heading', { level: 1, name: 'Technitium DNS Server' })).toBeInTheDocument()
    const trail = screen.getByRole('navigation', { name: 'Breadcrumb' })
    expect(within(trail).getByText('About')).toBeInTheDocument()
    expect(document.querySelector('img[src$="img/logo.svg"]')).not.toBeNull()
    // The domain is drawn label by label (`ui/DomainName`), under the title.
    const named = screen.getByRole('heading', { level: 1 }).parentElement as HTMLElement
    expect(said(named)).toContain('dns.example.net')
  })

  it('three cards say what is running: the server version, its uptime and the console version', () => {
    render(<About info={info} />)
    expect(within(block('DNS Server')).getByText('15.4')).toBeInTheDocument()
    const up = block('Uptime')
    expect(within(up).getByText('Up since')).toBeInTheDocument()
    expect(within(up).getByText(uptime(info.uptimestamp) as string)).toBeInTheDocument()
    const console = block('Web Console')
    expect(within(console).getByText(__CONSOLE_VERSION__)).toBeInTheDocument()
    expect(within(console).getByRole('link', { name: 'GPL-3.0-or-later' })).toHaveAttribute(
      'href',
      'https://github.com/byGarcia/technitium-console/blob/main/LICENSE',
    )
  })

  it('the uptime is the span since the start, in its two largest units', () => {
    const start = '2026-11-01T10:00:00Z'
    const at = (iso: string) => new Date(iso).getTime()
    expect(uptime(start, at('2026-11-01T10:00:40Z'))).toBe('0m')
    expect(uptime(start, at('2026-11-01T10:12:00Z'))).toBe('12m')
    expect(uptime(start, at('2026-11-01T14:00:00Z'))).toBe('4h')
    expect(uptime(start, at('2026-11-01T14:05:00Z'))).toBe('4h 5m')
    expect(uptime(start, at('2026-11-03T13:59:00Z'))).toBe('2d 3h')
    expect(uptime(start, at('2026-11-04T10:30:00Z'))).toBe('3d')
    // A clock behind the start says 0, not a negative span.
    expect(uptime(start, at('2026-11-01T09:00:00Z'))).toBe('0m')
    expect(uptime('not a date')).toBeNull()
  })

  /*
  This screen's links are upstream's and they had been lost once: of the original
  panel's nine, one survived. This case pins them by DESTINATION and not by text:
  what must not happen again is the prose still being there and the destination not.
  */
  it('it keeps the destinations of the upstream panel', () => {
    render(<About info={info} />)
    const targets = new Set(screen.getAllByRole('link').map((a) => a.getAttribute('href')))
    for (const expected of [
      'https://go.technitium.com/?id=24', // GNU GPL v3.0
      'https://github.com/TechnitiumSoftware/DnsServer',
      'https://go.technitium.com/?id=23', // What's New / change log
      'https://github.com/TechnitiumSoftware/DnsServer/blob/master/APIDOCS.md',
      'https://go.technitium.com/?id=25', // Help Topics
      'mailto:support@technitium.com',
      'https://mastodon.social/@technitium',
      'https://blog.technitium.com/',
      'https://www.reddit.com/r/technitium/',
      'https://go.technitium.com/?id=35', // Donate
    ]) {
      expect(targets, `missing ${expected}`).toContain(expected)
    }
  })

  /* Upstream's headings that are links stay links, each with its own sentence link. */
  it('upstream headings stay links, and so do the links inside their sentences', () => {
    render(<About info={info} />)
    const pairs: [string, string, string][] = [
      ["What's New?", 'change log', 'https://go.technitium.com/?id=23'],
      ['API Documentation', 'HTTP API documentation', 'https://github.com/TechnitiumSoftware/DnsServer/blob/master/APIDOCS.md'],
      ['Help Topics', 'online help topics', 'https://go.technitium.com/?id=25'],
      ['Donate', 'Donate Now!', 'https://go.technitium.com/?id=35'],
    ]
    for (const [heading, inline, href] of pairs) {
      expect(screen.getByRole('link', { name: heading })).toHaveAttribute('href', href)
      expect(screen.getByRole('link', { name: inline })).toHaveAttribute('href', href)
    }
  })

  /* Every sentence of upstream's About, word for word, in its block. */
  it('keeps every upstream sentence with its wording', () => {
    render(<About info={info} />)
    const documentation = said(block('Documentation'))
    for (const sentence of [
      "Read the change log to know what's new in this release.",
      'The DNS Server HTTP API allows any 3rd party app or script to configure the DNS Server. The HTTP API is used by this web console and thus all the actions that this web console does can be performed via the API. Read the HTTP API documentation for complete details.',
      'Read the latest online help topics which contains the DNS Server user manual and covers frequently asked questions.',
    ]) {
      expect(documentation).toContain(sentence)
    }
    const support = said(block('Support'))
    for (const sentence of [
      'For support, send an email to support@technitium.com.',
      'Follow @technitium@mastodon.social on Mastodon.',
      'Checkout Technitium Blog.',
      'Join /r/technitium on Reddit.',
    ]) {
      expect(support).toContain(sentence)
    }
    const license = said(block('License'))
    for (const sentence of [
      'Copyright (C) 2026 Shreyas Zare (shreyas@technitium.com)',
      'This program comes with ABSOLUTELY NO WARRANTY. This is free software, and you are welcome to redistribute it under certain conditions.',
      'Source code available under GNU General Public License v3.0 on GitHub',
    ]) {
      expect(license).toContain(sentence)
    }
    expect(said(block('Donate'))).toContain(
      'Make a contribution to Technitium and help making new software, updates, and features possible.',
    )
  })

  it('the external links open outside and without handing over the opener', () => {
    render(<About info={info} />)
    for (const a of screen.getAllByRole('link')) {
      expect(a).toHaveAttribute('target', '_blank')
      expect(a.getAttribute('rel')).toContain('noreferrer')
    }
  })

  /*
  The update panel is gone, and this is the case that keeps it gone. It carried a
  `Check for Update` button and four sentences, and not one of the four exists
  upstream (checked against the `ref` instance on 2026-09-04). Upstream checks once
  on login and says so in the chrome.
  */
  it('invents no update panel: upstream has neither the button nor its four sentences', () => {
    render(<About info={info} />)
    expect(screen.queryByRole('button', { name: 'Check for Update' })).not.toBeInTheDocument()
    for (const invented of [
      'No update available. You are running the latest version.',
      'Update notifications are turned off for this server.',
      'Unable to check for updates.',
    ]) {
      expect(screen.queryByText(invented)).not.toBeInTheDocument()
    }
  })

  /*
  This screen asks the server for NOTHING: everything it draws comes from the
  session the chrome already has. So it has no loading and no failure state, and
  its only variation is whether that session carried `info`, which is said, never
  faked.
  */
  it('says nothing it does not know when the session brought no info', () => {
    render(<About />)
    expect(within(block('DNS Server')).getByText('—')).toBeInTheDocument()
    expect(within(block('Uptime')).getAllByText('—')).toHaveLength(2)
    expect(said(document.body)).not.toContain('dns.example.net')
    // The console knows its own version without the server.
    expect(within(block('Web Console')).getByText(__CONSOLE_VERSION__)).toBeInTheDocument()
  })

  it('it has blocks of its own for this console, with its funding destinations', () => {
    render(<About info={info} />)
    const repo = 'https://github.com/byGarcia/technitium-console'
    const github = block('On GitHub')
    for (const [name, href] of [
      ['Source code', repo],
      ['Release notes', `${repo}/releases`],
      ['Report a problem', `${repo}/issues`],
      ['Ideas and questions', `${repo}/discussions`],
    ]) {
      expect(within(github).getByRole('link', { name })).toHaveAttribute('href', href)
    }
    const support = block('Support the Console')
    for (const [name, href] of [
      ['Star on GitHub', repo],
      // .github/FUNDING.yml
      ['GitHub Sponsors', 'https://github.com/sponsors/byGarcia'],
      ['Ko-fi', 'https://ko-fi.com/bygarcia'],
      ['Liberapay', 'https://liberapay.com/bygarcia'],
      ['PayPal', 'https://www.paypal.com/paypalme/adriangmolina'],
    ]) {
      expect(within(support).getByRole('link', { name })).toHaveAttribute('href', href)
    }
    expect(said(block('Web Console'))).toContain('An independent project, not affiliated with or endorsed by Technitium.')
  })
})
