import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { About } from './About'

const info = { version: '15.4', uptimestamp: '2026-08-25T13:07:31Z', dnsServerDomain: 'dns.example.net' }

describe('About', () => {
  it('it shows version, domain and uptime', () => {
    render(<About info={info} />)
    expect(screen.getByText('Version 15.4')).toBeInTheDocument()
    expect(screen.getByText('dns.example.net')).toBeInTheDocument()
  })

  /*
  This screen's links are upstream's and they had been lost: of the original
  panel's nine, one survived. "Help Topics", "Support" and "Donate" were missing
  entirely, and the text still said "read the change log" without "change log"
  leading anywhere.

  This case pins them by DESTINATION and not by text: what must not happen again
  is the prose still being there and the destination not.
  */
  it('it keeps the nine destinations of the upstream panel', () => {
    render(<About info={info} />)
    const targets = new Set(
      screen.getAllByRole('link').map((a) => a.getAttribute('href')),
    )
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
      expect(targets, `falta ${expected}`).toContain(expected)
    }
  })

  it('the external links open outside and without handing over the opener', () => {
    render(<About info={info} />)
    for (const a of screen.getAllByRole('link')) {
      expect(a).toHaveAttribute('target', '_blank')
      expect(a.getAttribute('rel')).toContain('noreferrer')
    }
  })

  /*
  The update panel is gone, and this is the case that keeps it gone.

  It carried a `Check for Update` button and four sentences, and **not one of the
  four exists upstream** — checked against the `ref` instance on 2026-09-04, while
  contracting this screen. Upstream checks once on login and says so in the
  chrome, visible from all twelve screens; a second forced check here was
  duplicating that notice with literals the product does not say.
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

  /* What upstream does show under its title, and what therefore stays. */
  it('keeps the facts upstream own About shows: version and uptime', () => {
    render(<About info={info} />)
    expect(screen.getByText('Up since')).toBeInTheDocument()
    expect(screen.getByText('Uptime')).toBeInTheDocument()
  })

  /*
  With the update panel gone this screen asks the server for NOTHING: everything
  it draws comes from the session the chrome already has. So it has no loading and
  no failure state, and its only variation is whether that session carried `info`
  — which is said, never faked.
  */
  it('says nothing it does not know when the session brought no info', () => {
    render(<About />)
    expect(screen.getByText('Version —')).toBeInTheDocument()
    expect(screen.getAllByText('—').length).toBeGreaterThan(0)
  })
})
