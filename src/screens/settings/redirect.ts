import type { DnsSettings } from '../../api/settings'

/*
Following the web console to its new address after a save or a restore.

Upstream does it in two steps (main.js:2275-2340):

  · `checkForReverseProxy` runs on EVERY settings load (main.js:918) and decides,
    from the address the page is being served at, whether a reverse proxy sits in
    front: over HTTPS, if the web service has TLS off or listens on another TLS
    port; over HTTP, if it listens on another HTTP port. The verdict lives in a
    global until the next load.
  · `checkForWebConsoleRedirection` runs after a successful save (main.js:2217)
    and restore (main.js:3188), but only when the answering server is the session's
    own. Unless a proxy was detected, it opens the new address in the same tab
    2.5 s later, "to allow web server to restart".

Both are replicated as pure functions over a location-like input. The comparisons
are upstream's loose `!=` between the address bar's port (a string) and the
setting (a number); converting both to numbers gives the same answers.
*/

export interface LocationLike {
  protocol: string
  hostname: string
  port: string
}

export type WebServiceSettings = Pick<
  DnsSettings,
  'webServiceEnableTls' | 'webServiceTlsPort' | 'webServiceHttpPort' | 'webServiceHttpToTlsRedirect'
>

/** main.js:2300 and friends: "delay redirection to allow web server to restart". */
export const REDIRECT_DELAY_MS = 2500

/** `(currentPort == 0) || (currentPort == "")` falls to the protocol's default. */
function currentPort(loc: LocationLike, fallback: number): number {
  return loc.port === '' || Number(loc.port) === 0 ? fallback : Number(loc.port)
}

/** `checkForReverseProxy` (main.js:2275-2291). */
export function detectReverseProxy(loc: LocationLike, s: WebServiceSettings): boolean {
  if (loc.protocol === 'https:') {
    return !s.webServiceEnableTls || currentPort(loc, 443) !== Number(s.webServiceTlsPort)
  }
  return currentPort(loc, 80) !== Number(s.webServiceHttpPort)
}

/** `checkForWebConsoleRedirection` (main.js:2293-2334): the URL to open, or
 *  `null` when the console stays where it is. */
export function webConsoleRedirection(
  loc: LocationLike,
  s: WebServiceSettings,
  reverseProxyDetected: boolean,
): string | null {
  if (reverseProxyDetected) return null

  if (loc.protocol === 'https:') {
    if (!s.webServiceEnableTls) return `http://${loc.hostname}:${s.webServiceHttpPort}`
    if (currentPort(loc, 443) !== Number(s.webServiceTlsPort)) {
      return `https://${loc.hostname}:${s.webServiceTlsPort}`
    }
    return null
  }

  if (s.webServiceEnableTls && s.webServiceHttpToTlsRedirect) {
    return `https://${loc.hostname}:${s.webServiceTlsPort}`
  }
  if (currentPort(loc, 80) !== Number(s.webServiceHttpPort)) {
    return `http://${loc.hostname}:${s.webServiceHttpPort}`
  }
  return null
}
