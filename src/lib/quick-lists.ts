import { publicUrl } from '../app/base'

/*
The "Quick Add" lists: known block lists and known forwarders, offered next to
the free-text field they fill.

They live in files, not in the API: `www/json/<name>-custom.json` if the
administrator wrote one, otherwise `<name>-builtin.json`. That fallback is why
`install.sh` goes out of its way to preserve `*-custom.json` when it replaces the
web root — those files are somebody's customisation and no release carries them.

This console shipped both files and read neither, and the control they feed was
missing from Settings › Blocking and Settings › Proxy & Forwarders. See spec F8.
*/

export interface QuickEntry {
  name: string
  urls: string[]
}

/** A known forwarder. Its extra keys are optional: of the 53 built-in entries,
 *  exactly one carries proxy settings. */
export interface QuickForwarder {
  name: string
  protocol?: string
  addresses: string[]
  proxyType?: string | null
  proxyAddress?: string
  proxyPort?: string
  proxyUsername?: string
  proxyPassword?: string
}

/** Upstream tries `-custom` first and falls back to `-builtin` (`main.js:814`). */
export async function loadQuickList<T = QuickEntry>(base: string): Promise<T[]> {
  for (const suffix of ['custom', 'builtin']) {
    try {
      const r = await fetch(publicUrl(`json/${base}-${suffix}.json`), { cache: 'no-cache' })
      if (!r.ok) continue
      const data = (await r.json()) as T[]
      if (Array.isArray(data)) return data
    } catch {
      /* try the next one; a missing custom file is the normal case */
    }
  }
  return []
}

/*
What choosing an entry does to the field, reproduced from `main.js:493-529`.

Two behaviours in one control, and the asymmetry is upstream's, not a
simplification of it:

  · "None" empties the field.
  · "Default" REPLACES what is there. Any other entry APPENDS to it.
  · Either way, a URL already present is not added twice.

The `Default` case is decided by the entry's own name, compared case-insensitively.
*/
export function applyQuickEntry(current: string, entry: QuickEntry): string {
  const replacing = entry.name.toLowerCase() === 'default'
  const base = replacing ? '' : current
  let result = base
  for (const url of entry.urls) {
    if (base.indexOf(url) < 0) result += url + '\n'
  }
  return result
}

/* Our radio values are capitalised; upstream compares uppercased. */
const PROTOCOL: Record<string, string> = {
  TCP: 'Tcp',
  TLS: 'Tls',
  HTTPS: 'Https',
  QUIC: 'Quic',
}

/*
Choosing a known forwarder, reproduced from `main.js:530-608`.

It does more than fill a field, and this is the part that would be lost by
treating it as "a dropdown that writes a textarea":

  · the addresses REPLACE the forwarders field, one per line;
  · the protocol radio follows the entry, falling back to UDP;
  · the proxy follows the entry too — `SOCKS5` and `HTTP` fill its four fields,
    `NONE` clears them, and **anything else leaves the proxy untouched**. Upstream
    has no default branch there, and the null case becomes `DefaultProxy`, which
    matches nothing. So an entry that says nothing about proxying does not undo
    what the administrator configured.

Returned as a patch rather than applied, so the caller stays the one that writes
to the form.
*/
export function applyQuickForwarder(entry: QuickForwarder): Record<string, string> {
  const patch: Record<string, string> = {
    forwarders: entry.addresses.map((a) => a + '\n').join(''),
    forwarderProtocol: PROTOCOL[(entry.protocol ?? '').toUpperCase()] ?? 'Udp',
  }

  const proxy = (entry.proxyType ?? 'DefaultProxy').toUpperCase()
  if (proxy === 'SOCKS5' || proxy === 'HTTP') {
    patch.proxyType = proxy === 'SOCKS5' ? 'Socks5' : 'Http'
    patch.proxyAddress = entry.proxyAddress ?? ''
    patch.proxyPort = entry.proxyPort ?? ''
    patch.proxyUsername = entry.proxyUsername ?? ''
    patch.proxyPassword = entry.proxyPassword ?? ''
  } else if (proxy === 'NONE') {
    patch.proxyType = 'None'
    patch.proxyAddress = ''
    patch.proxyPort = ''
    patch.proxyUsername = ''
    patch.proxyPassword = ''
  }
  return patch
}

/** A known name server for the DNS Client. */
export interface QuickServer {
  name?: string | null
  addresses: string[]
}

/*
The DNS Client's server list, reproduced from `dnsclient.js:78-93`.

Upstream offers it as a dropdown attached to a text field, not instead of one:
the field stays free text and the list only fills it. So this returns the strings
it offers, in its order, and the caller writes the chosen one into the field.

One string PER ADDRESS, not per entry, formatted `Name {address}` — or the bare
address when the entry carries no name. The first is always this server.
*/
export const THIS_SERVER = 'This Server {this-server}'

export function serverListOptions(entries: QuickServer[]): string[] {
  const out = [THIS_SERVER]
  for (const e of entries) {
    for (const address of e.addresses) {
      out.push(e.name ? `${e.name} {${address}}` : address)
    }
  }
  return out
}
