import type { ResourceRecord } from '../../api/records'
import { toUnicode } from '../../lib/punycode'
import { recordText } from './record-view'

/*
The records table's filter (`showEditZonePage`, zone.js:3524-3570). It is the
client's, not the server's, because `zones/records/get` brings the whole zone.

Three rules that are not obvious and that are replicated as they are:

  1. **Without a wildcard the comparison is exact**, not "contains". Typing `www`
     does not find `www.sub`: you have to type `www*`.

  2. **`@` means the zone's apex**, and at the root it means the empty name.

  3. **A filter starting with `*` looks for the literal wildcard record.** It is
     the line that most looks like a bug and is not: after converting the glob to
     a regex, if the expression starts with `.*\.` upstream rewrites it to
     `\*\.`, that is, a literal asterisk. It serves to find the `*.zone` record,
     which in DNS really is called that. Without that line, typing `*` would list
     everything; with it, it lists only the wildcard. It is kept.

Two additions of OURS (deviation 53, 2026-11-20):

  · **`Data contains`**: the text the Data column draws (`recordText`, what
    `recordCells` computes and the column sorts by), searched case-insensitively
    for what was typed, literally and without the spaces at its ends. It is
    combined with the other two: a record must pass all three.

  · **A name matches in either form.** The server stores an internationalized
    name in ASCII (`xn--bcher-kva.xn--mnchen-3ya.test`) and sends its Unicode form
    beside it as `nameIdn`. The name filter, with the same three rules, is tried
    against the ASCII name under the zone's ASCII name, as upstream does, and then
    against the Unicode name under the zone's Unicode name, so `bücher`, `bü*` and
    `xn--bcher-kva` all find that record. Without `nameIdn` the name is decoded here.

Its words, OURS: the field's label `Data contains` and its placeholder `10.0.0.5 or
example.net` (`ZoneRecords.tsx`).
*/

export interface Filter {
  name: string
  type: string
  /** `Data contains` (deviation 53). */
  data?: string
}

/** Translates the name filter into the domain or the expression to compare against. */
export function compileNameFilter(
  filterName: string,
  zone: string,
): { domain: string | null; regex: RegExp | null } {
  if (filterName === '') return { domain: null, regex: null }

  let domain = filterName.toLowerCase()

  if (zone === '.') {
    if (domain === '@') domain = ''
  } else if (domain === '@') {
    domain = zone
  } else {
    domain += `.${zone}`
  }

  if (filterName.indexOf('*') === -1 && filterName.indexOf('?') === -1) {
    return { domain, regex: null }
  }

  /* OURS (2026-11-06): every other regular expression character is taken
     literally. Upstream escapes only the dot, so `(a+)+b` was an expression; with
     the filter now arriving from a link (`?rname=`, deviation 13) that let a link
     hang the reader's tab on a big zone. No DNS name holds any of these
     characters, so a name that matched before still matches. */
  let pattern = domain.replace(/[\\^$+()[\]{}|.]/g, '\\$&')
  pattern = pattern.replace(/\*/g, '.*')
  pattern = pattern.replace(/\?/g, '.')

  // See rule 3 of the header: `.*\.` at the start is a literal asterisk.
  if (pattern.startsWith('.*\\.')) pattern = `\\*${pattern.substring(2)}`

  // OURS: the viewer's own text, built the way upstream builds it, so a `(` or
  // a `[` makes an invalid expression. It then filters to nothing instead of
  // throwing during render, which took the whole console down.
  try {
    return { domain, regex: new RegExp(`^${pattern}$`) }
  } catch {
    return { domain, regex: /(?!)/ }
  }
}

/** The name to compare in its Unicode form, or `null` when it has none. */
function unicodeName(r: ResourceRecord): string | null {
  const idn = r.nameIdn ?? toUnicode(r.name)
  return idn === r.name ? null : idn.toLowerCase()
}

/**
 * Applies the filters. The type one is exact and uppercased; the name one,
 * whatever `compileNameFilter` returns, in either form of the name; the data one,
 * a case-insensitive "contains". It needs the zone because without it `@` cannot
 * be resolved.
 */
export function filterBy(records: ResourceRecord[], filter: Filter, zone: string): ResourceRecord[] {
  const { name, type } = filter
  const data = (filter.data ?? '').trim().toLowerCase()
  if (name === '' && type === '' && data === '') return records

  const ascii = compileNameFilter(name, zone)
  /* The zone in its Unicode form, for the names in theirs (deviation 53). */
  const zoneIdn = zone === '.' ? zone : toUnicode(zone)
  const idn = name === '' ? null : compileNameFilter(name, zoneIdn)
  const wantedType = type === '' ? null : type.toUpperCase()

  const nameMatches = (recordName: string, { domain, regex }: ReturnType<typeof compileNameFilter>) =>
    regex == null ? domain == null || recordName === domain : regex.test(recordName)

  return records.filter((r) => {
    if (!nameMatches(r.name.toLowerCase(), ascii)) {
      const unicode = idn == null ? null : unicodeName(r)
      if (unicode == null || idn == null || !nameMatches(unicode, idn)) return false
    }

    if (wantedType != null && r.type !== wantedType) return false
    if (data !== '' && !recordText(r).toLowerCase().includes(data)) return false
    return true
  })
}
