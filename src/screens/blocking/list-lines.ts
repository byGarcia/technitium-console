import { applyQuickEntry, type QuickEntry } from '../../lib/quick-lists'
import { cleanList } from '../settings/model'

/*
One line of `blockListUrls`, the field Settings > Blocking edits as a textarea and the
Lists tab draws as a table. This module is OURS: upstream has no table of lists.

The grammar is the SERVER's, not a guess (BlockListZoneManager.cs:644-647): the line is
trimmed, a line starting with `#` is skipped, and a line starting with `!` is an allow
list. A line WITHOUT `#` is therefore always a list, valid URL or not, because that is
how the server reads it. Only after a `#` do we tell apart a list the administrator
switched off from a plain comment, and that is decided by whether what follows parses
as an `http:`, `https:` or `file:` URL.
*/

export type LineKind = 'block' | 'allow' | 'comment'

export interface ListLine {
  /** The line as it will be saved, already trimmed. */
  raw: string
  kind: LineKind
  /** The URL without `#` and `!`. Null for a comment. */
  url: string | null
  /** False for a switched-off list and for a comment. */
  enabled: boolean
}

const SCHEMES = new Set(['http:', 'https:', 'file:'])

function isListUrl(text: string): boolean {
  try {
    return SCHEMES.has(new URL(text).protocol)
  } catch {
    return false
  }
}

export function parseLine(line: string): ListLine | null {
  const raw = line.trim()
  if (raw === '') return null

  const disabled = raw.startsWith('#')
  const body = disabled ? raw.slice(1).trim() : raw
  const allow = body.startsWith('!')
  const url = (allow ? body.slice(1) : body).trim()

  if (disabled && !isListUrl(url)) return { raw, kind: 'comment', url: null, enabled: false }
  return { raw, kind: allow ? 'allow' : 'block', url, enabled: !disabled }
}

export function fromUrls(urls: readonly string[] | null | undefined): ListLine[] {
  return (urls ?? []).map(parseLine).filter((l): l is ListLine => l != null)
}

function fromText(text: string): ListLine[] {
  return fromUrls(text.split('\n'))
}

function toText(lines: readonly ListLine[]): string {
  return lines.map((l) => `${l.raw}\n`).join('')
}

/*
Whether a line can be switched on or off. A comment cannot, and neither can an
enabled line whose URL is not an `http:`, `https:` or `file:` URL: prefixing it
with `#` would turn it into a comment, which can never be switched back on.
A disabled line is a list URL by construction, so it can always be switched on.
*/
export function canToggle(line: ListLine): boolean {
  if (line.kind === 'comment') return false
  return !line.enabled || isListUrl(line.url ?? '')
}

/** Switching off prefixes `#`; switching on removes that `#` and the spaces after it. */
export function toggleLine(line: ListLine): ListLine {
  if (!canToggle(line)) return line
  const raw = line.enabled ? `#${line.raw}` : line.raw.replace(/^#\s*/, '')
  return parseLine(raw) ?? line
}

export function addList(lines: ListLine[], url: string, kind: 'block' | 'allow'): ListLine[] {
  const clean = url.trim()
  if (clean === '') return lines
  const raw = kind === 'allow' ? `!${clean}` : clean
  if (lines.some((l) => l.raw === raw)) return lines
  const line = parseLine(raw)
  return line == null ? lines : [...lines, line]
}

/*
Quick Add, with upstream's semantics whole (main.js:493-529, `lib/quick-lists.ts`):
`None` empties, `Default` replaces, any other entry appends, and a URL already present
is not added twice. `None` is not an entry of the JSON catalog: Settings offers it as a
fixed option, and so does the Lists tab.
*/
export function applyQuick(lines: ListLine[], entry: QuickEntry | 'none'): ListLine[] {
  if (entry === 'none') return []
  return fromText(applyQuickEntry(toText(lines), entry))
}

/** The readable name of a list: the single-URL catalog entry that carries it. */
export function listName(url: string, catalog: readonly QuickEntry[]): string | null {
  const hit = catalog.find(
    (e) =>
      e.urls.length === 1 &&
      e.urls[0] === url &&
      e.name.toLowerCase() !== 'default' &&
      e.name.toLowerCase() !== 'none',
  )
  return hit?.name ?? null
}

/*
The body of the save: ONLY `blockListUrls`, cleaned exactly as Settings cleans it
(`settings/model.ts:830-839`), with `node` first as upstream always sends it
(main.js:1644). An empty list travels as the string `false`.
*/
export function saveBody(lines: ListLine[], node: string): Record<string, string> {
  const blu = cleanList(toText(lines))
  return { node, blockListUrls: blu.length === 0 || blu === ',' ? 'false' : blu }
}

export function sameLines(a: ListLine[], b: ListLine[]): boolean {
  return a.length === b.length && a.every((l, i) => l.raw === b[i].raw)
}
