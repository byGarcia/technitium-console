import type { QuickEntry } from '../../lib/quick-lists'
import bundled from './extra-lists.json'

/*
The console's own Quick Add catalogue: everything in this file and in
`extra-lists.json` is OURS, not upstream's.

Technitium's catalogue is `www/json/quick-block-lists-builtin.json` (or the
administrator's `-custom.json`), read by `lib/quick-lists.ts` and left as it is: it
belongs to the server, and `public/` only carries what the server ships. This one is
bundled in the code and offered only by Blocking › Lists, after Technitium's, under
the label `More lists` (OURS too). Settings › Blocking still offers Technitium's
alone.

Its entries have the same shape as Technitium's, and choosing one goes through the
same `applyQuick` as choosing one of theirs: it appends its URLs, skipping the ones
already there.
*/

export const EXTRA_LISTS: readonly QuickEntry[] = bundled

/* `applyQuickEntry` gives `Default` its replacing meaning by name, and the Lists tab
   offers `None` as a fixed option: an entry of ours with either name would behave
   as theirs, so it is never offered. */
const RESERVED = new Set(['default', 'none'])

/** The entries of ours worth offering next to `catalog`: not those whose every URL
 *  Technitium's catalogue already carries. */
export function moreLists(
  catalog: readonly QuickEntry[],
  extra: readonly QuickEntry[] = EXTRA_LISTS,
): QuickEntry[] {
  const known = new Set(catalog.flatMap((e) => e.urls))
  return extra.filter(
    (e) => e.urls.length > 0 && !RESERVED.has(e.name.toLowerCase()) && !e.urls.every((u) => known.has(u)),
  )
}

/** The hosts an entry's URLs point at, for the Quick Add search to match. */
export function hostsOf(entry: QuickEntry): string {
  const hosts = new Set<string>()
  for (const u of entry.urls) {
    try {
      hosts.add(new URL(u).host)
    } catch {
      /* not a URL: nothing to match */
    }
  }
  return [...hosts].join(' ')
}
