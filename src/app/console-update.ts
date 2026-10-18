import { resolve } from '../api/dnsclient'

/*
OURS: whether a newer release of this console exists.

The browser cannot ask GitHub: the server serves the console with
`default-src 'self'` and no `connect-src` (DnsWebService.cs, `OnPrepareResponse`).
So the console asks its own server, with DNS Client, to resolve one TXT record
against the project's DNS-over-HTTPS endpoint (`update-check/` in this repo),
which answers `v=1 latest=X.Y.Z server=A.B`. It is an exception to "zero
functionality", with its limits written down in CONVENTIONS.md.

At most once a day per browser, whatever the outcome: a failed check leaves a
line in the server's log, and a day is the most that is acceptable.
*/

export const CONSOLE_UPDATE_SERVER = 'https://technitium-console.pages.dev/dns-query'
export const CONSOLE_UPDATE_NAME = 'latest.technitium-console.pages.dev'
export const CONSOLE_UPDATE_KEY = 'consoleUpdateCheck'
const DAY = 86_400_000
const VERSION = /^\d+\.\d+(\.\d+)?$/

export interface ConsoleRelease {
  latest: string
  server: string
}

/* The record's format is frozen: `v=1` and the keys this console knows. Others
   are ignored, so that the format can grow without silencing this one. */
export function parseRecord(text: string): ConsoleRelease | null {
  const fields = new Map<string, string>()
  for (const pair of text.trim().split(/\s+/)) {
    const i = pair.indexOf('=')
    if (i > 0) fields.set(pair.slice(0, i), pair.slice(i + 1))
  }
  const latest = fields.get('latest')
  const server = fields.get('server')
  if (fields.get('v') !== '1' || !latest || !server) return null
  if (!VERSION.test(latest) || !VERSION.test(server)) return null
  return { latest, server }
}

/* Numeric, field by field, missing fields counting as 0. A `-suffix` is a
   prerelease: before the same numbers without one. */
export function compareVersions(a: string, b: string): number {
  const [aCore, aPre] = a.split('-', 2)
  const [bCore, bPre] = b.split('-', 2)
  const aParts = aCore.split('.').map(Number)
  const bParts = bCore.split('.').map(Number)
  for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
    const d = (aParts[i] ?? 0) - (bParts[i] ?? 0)
    if (d !== 0) return d
  }
  if (aPre && !bPre) return -1
  if (!aPre && bPre) return 1
  return 0
}

/* The version to announce, or null. Never one made for a newer server than the
   one running: the CHANGELOG says to update the console with the server, and
   the server's own notice already asks for that first. */
export function newerConsole(
  release: ConsoleRelease | null,
  installed: string,
  serverVersion: string | undefined,
): string | null {
  if (!release || !serverVersion) return null
  if (compareVersions(release.latest, installed) <= 0) return null
  if (compareVersions(serverVersion, release.server) < 0) return null
  return release.latest
}

interface Stored {
  at: number
  release: ConsoleRelease | null
}

function readStored(): Stored | null {
  try {
    const raw = localStorage.getItem(CONSOLE_UPDATE_KEY)
    return raw ? (JSON.parse(raw) as Stored) : null
  } catch {
    return null
  }
}

function store(value: Stored): void {
  try {
    localStorage.setItem(CONSOLE_UPDATE_KEY, JSON.stringify(value))
  } catch {
    // Storage refused: the next load checks again, which is all this costs.
  }
}

export async function checkConsoleUpdate(token: string | null, now = Date.now()): Promise<ConsoleRelease | null> {
  const stored = readStored()
  if (stored && typeof stored.at === 'number' && now - stored.at < DAY) return stored.release ?? null

  // Taken before asking, not after: a server that cannot reach the endpoint
  // holds the request for up to ten seconds, and a reload or a second tab in
  // that time must not ask again. Until it answers, the last result stands.
  store({ at: now, release: stored?.release ?? null })

  // No `node`: every node of a cluster serves its own console, so the one the
  // browser is connected to is the one that matters.
  const r = await resolve(token, {
    server: CONSOLE_UPDATE_SERVER,
    domain: CONSOLE_UPDATE_NAME,
    type: 'TXT',
    protocol: 'HTTPS',
    dnssec: false,
  })

  let release: ConsoleRelease | null = null
  if (r.kind === 'ok') {
    const result = r.data.response?.result as { Answer?: { Type?: string; RDATA?: { Text?: unknown } }[] } | undefined
    const txt = result?.Answer?.find((a) => a.Type === 'TXT')?.RDATA?.Text
    if (typeof txt === 'string') release = parseRecord(txt)
  }
  store({ at: now, release })
  return release
}
