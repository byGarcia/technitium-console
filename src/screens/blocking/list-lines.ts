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
as an `http:`, `https:` or `file:` URL. The Lists tab draws a comment as a group
heading (see GROUPS below).
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

/*
GROUPS, OURS. A comment line is a group heading: the lists after it belong to that
group until the next heading, and the lists before the first heading belong to no
group. Nothing is stored anywhere else: a group is its `#` line, so Settings ›
Blocking keeps showing it as the plain comment it is, and the server keeps skipping it.

ORDER DOES NOT CHANGE WHAT IS BLOCKED. Checked in the server (v15.6.1,
BlockListZoneManager.cs:754-847): `LoadBlockLists` splits the lines into allow and
block URLs, reads ALL the allow lists into one dictionary and all the block lists
into another, and a blocked domain records every URL that carries it.
`IsZoneAllowed` and `IsZoneBlocked` (:478-512) only ask whether a domain is in
them, so no list wins over another by coming first. The one trace of order is the
order in which a blocked answer NAMES the lists that carry the domain (its
`blockListUrl=` TXT and Extended DNS Error texts, :869-895). The update check
compares the lines as a set (`HasSameItems`, :517), so a Save that only moves
lines does not download anything again; a heading added, renamed or removed does,
because a heading is one of those lines.

What the server imposes on a heading, and `headingProblem` checks before it is ever
saved:
- the field travels comma-separated and the server splits it at every comma,
  trimming each piece (Extensions.cs:277-307), so a comma would cut the heading in
  two and the second half, without its `#`, would be read as a list URL and refused;
- a line is one line: no newline;
- after its `#` it must not read as a list URL, or it would come back as a
  switched-off list (`parseLine`);
- a line is at most 255 characters (BlockListZoneManager.cs:1056), `# ` included.

And one thing it does on its own: when every line is a comment, it keeps NONE of
them (:1083, `uniqueList.Count == commentCount`). Groups with no list anywhere are
dropped by the Save; the screen shows what the server answered.
*/

/** The most a heading's name can take: 255 per line, minus `# `. */
export const HEADING_MAX = 253

/** A heading's name: what follows its `#`, with the spaces after it. */
export function headingName(line: ListLine): string {
  return line.raw.replace(/^#\s*/, '')
}

/** Why a name cannot be a heading, in a sentence of OURS; `null` when it can. */
export function headingProblem(name: string): string | null {
  const clean = name.trim()
  if (clean === '') return 'Enter a group name.'
  if (/[\r\n]/.test(clean)) return 'A group name is one line.'
  if (clean.includes(',')) return 'A group name cannot contain a comma: the server splits the list at commas.'
  if (clean.length > HEADING_MAX) return `A group name can be up to ${HEADING_MAX} characters.`
  if (parseLine(`# ${clean}`)?.kind !== 'comment') return 'A group name cannot be a list URL.'
  return null
}

/** The line a valid name is saved as: `# Name`. */
function headingLine(name: string): ListLine {
  const raw = `# ${name.trim()}`
  return { raw, kind: 'comment', url: null, enabled: false }
}

/** The index of each heading line, in order: a group's ordinal is its place here. */
export function headingIndexes(lines: readonly ListLine[]): number[] {
  const out: number[] = []
  lines.forEach((l, i) => {
    if (l.kind === 'comment') out.push(i)
  })
  return out
}

/** The group a line belongs to: the ordinal of the last heading before it, -1 for none. */
export function groupOf(lines: readonly ListLine[], index: number): number {
  let group = -1
  for (let i = 0; i <= index && i < lines.length; i++) if (lines[i].kind === 'comment') group++
  return group
}

/** Where a group ends: the next heading, or the end. `-1` is the block with no group. */
function groupEnd(lines: readonly ListLine[], group: number): number {
  const heads = headingIndexes(lines)
  const next = heads[group + 1]
  return next ?? lines.length
}

function insertAt(lines: readonly ListLine[], at: number, added: readonly ListLine[]): ListLine[] {
  return [...lines.slice(0, at), ...added, ...lines.slice(at)]
}

/** A new heading, last, so it opens an empty group at the bottom. Refused when invalid. */
export function addHeading(lines: ListLine[], name: string): ListLine[] {
  if (headingProblem(name) != null) return lines
  return [...lines, headingLine(name)]
}

export function renameHeading(lines: ListLine[], index: number, name: string): ListLine[] {
  if (lines[index]?.kind !== 'comment' || headingProblem(name) != null) return lines
  return lines.map((l, i) => (i === index ? headingLine(name) : l))
}

/** Only the heading goes: its lists stay where they are, so they join the group
    above, or the block with no group when it was the first. */
export function removeHeading(lines: ListLine[], index: number): ListLine[] {
  if (lines[index]?.kind !== 'comment') return lines
  return lines.filter((_, i) => i !== index)
}

/** `addList`, into a group: last in it rather than last of all. */
export function addListTo(lines: ListLine[], url: string, kind: 'block' | 'allow', group: number): ListLine[] {
  const added = addList(lines, url, kind)
  if (added === lines) return lines
  return insertAt(lines, groupEnd(lines, group), added.slice(lines.length))
}

/*
`applyQuick`, into a group. `None` and `Default` keep their meaning whole (they empty
or replace EVERY line, headings included, as they do Settings' textarea); any other
entry appends what it adds, and that is placed last in the group.
*/
export function applyQuickTo(lines: ListLine[], entry: QuickEntry | 'none', group: number): ListLine[] {
  const out = applyQuick(lines, entry)
  if (entry === 'none' || entry.name.toLowerCase() === 'default') return out
  const added = out.slice(lines.length)
  return added.length === 0 ? lines : insertAt(lines, groupEnd(lines, group), added)
}

/** Whether a LIST can move one place: headings stay put, and the ends are the ends. */
export function canMove(lines: readonly ListLine[], index: number, step: -1 | 1): boolean {
  const target = index + step
  return lines[index] != null && lines[index].kind !== 'comment' && target >= 0 && target < lines.length
}

/*
A list moves one line, so passing a heading takes it across: up over its own heading
it becomes the last of the group above, down over the next heading the first of
the group below.
*/
export function moveLine(lines: ListLine[], index: number, step: -1 | 1): ListLine[] {
  if (!canMove(lines, index, step)) return lines
  const out = [...lines]
  ;[out[index], out[index + step]] = [out[index + step], out[index]]
  return out
}

/** Edits between two sequences of headings: a rename is one, as an addition or a removal is. */
export function headingEdits(a: readonly string[], b: readonly string[]): number {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    const row = [i]
    for (let j = 1; j <= b.length; j++) {
      row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    }
    prev = row
  }
  return prev[b.length]
}

/*
WHAT CHANGED, OURS (2026-10-15): the Lists tab's save bar says it in words, so every
count here is one the bar prints and none is a guess.

A list is told by its URL, so switching one off is one change (`switchedOff`) and not
a removal plus an addition. Lines whose text is identical match first, by text and
then by place, the same as the count this replaced. What is left of a URL on each
side is paired in order: a pair is `switchedOff` or `switchedOn` when only the `#`
differs, `changed` otherwise (block to allow, or the same line written another way);
what has no pair is `added` or `removed`.

Headings are aligned as `headingEdits` aligns them, and on a tie an addition and a
removal are preferred to a rename, so ungrouping one heading and adding another is
not reported as a rename.

`moved` is how many lists changed place among the lines kept on both sides: the
smallest number of lists that, taken out and put back, turn the old order into the
new one. Kept headings stay put in that count (they cannot be moved), so a list that
crossed a heading counts as moved. Additions and removals move nothing.
*/
export interface ListChanges {
  added: number
  removed: number
  switchedOn: number
  switchedOff: number
  changed: number
  moved: number
  groupsAdded: number
  groupsRemoved: number
  groupsRenamed: number
}

/** The heading alignment: for each heading of `b`, the index in `a` it continues, or -1. */
function alignHeadings(a: readonly string[], b: readonly string[]) {
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  )
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    }
  }
  const from = Array<number>(b.length).fill(-1)
  let added = 0
  let removed = 0
  let renamed = 0
  let i = a.length
  let j = b.length
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && a[i - 1] === b[j - 1] && d[i][j] === d[i - 1][j - 1]) {
      from[--j] = --i
    } else if (i > 0 && d[i][j] === d[i - 1][j] + 1) {
      removed++
      i--
    } else if (j > 0 && d[i][j] === d[i][j - 1] + 1) {
      added++
      j--
    } else {
      renamed++
      from[--j] = --i
    }
  }
  return { from, added, removed, renamed }
}

export function changesOf(saved: readonly ListLine[], lines: readonly ListLine[]): ListChanges {
  const out: ListChanges = {
    added: 0, removed: 0, switchedOn: 0, switchedOff: 0, changed: 0, moved: 0,
    groupsAdded: 0, groupsRemoved: 0, groupsRenamed: 0,
  }

  /* Every line gets a key, the same on both sides when it is the same line. */
  const keyBefore: (string | null)[] = saved.map(() => null)
  const keyAfter: (string | null)[] = lines.map(() => null)

  const byUrl = new Map<string, [number[], number[]]>()
  saved.forEach((l, i) => {
    if (l.url != null) (byUrl.get(l.url) ?? byUrl.set(l.url, [[], []]).get(l.url)!)[0].push(i)
  })
  lines.forEach((l, i) => {
    if (l.url != null) (byUrl.get(l.url) ?? byUrl.set(l.url, [[], []]).get(l.url)!)[1].push(i)
  })
  for (const [url, [before, after]] of byUrl) {
    const restBefore: number[] = []
    const restAfter = [...after]
    for (const i of before) {
      const k = restAfter.findIndex((j) => lines[j].raw === saved[i].raw)
      if (k < 0) {
        restBefore.push(i)
        continue
      }
      keyBefore[i] = keyAfter[restAfter[k]] = `L:${url}:${i}`
      restAfter.splice(k, 1)
    }
    const pairs = Math.min(restBefore.length, restAfter.length)
    for (let p = 0; p < pairs; p++) {
      const was = saved[restBefore[p]]
      const now = lines[restAfter[p]]
      keyBefore[restBefore[p]] = keyAfter[restAfter[p]] = `P:${url}:${p}`
      if (was.kind === now.kind && was.enabled && !now.enabled) out.switchedOff++
      else if (was.kind === now.kind && !was.enabled && now.enabled) out.switchedOn++
      else out.changed++
    }
    out.removed += restBefore.length - pairs
    out.added += restAfter.length - pairs
  }

  const headsBefore = headingIndexes(saved)
  const headsAfter = headingIndexes(lines)
  const heads = alignHeadings(
    headsBefore.map((i) => saved[i].raw),
    headsAfter.map((i) => lines[i].raw),
  )
  out.groupsAdded = heads.added
  out.groupsRemoved = heads.removed
  out.groupsRenamed = heads.renamed
  heads.from.forEach((g, h) => {
    if (g >= 0) keyBefore[headsBefore[g]] = keyAfter[headsAfter[h]] = `H:${g}`
  })

  /* The moves: a longest common subsequence of the kept keys, where a heading weighs
     more than all the lists together, so every kept heading is in it. */
  const kept = new Set(keyAfter.filter((k): k is string => k != null))
  const a = keyBefore.filter((k): k is string => k != null && kept.has(k))
  const b = keyAfter.filter((k): k is string => k != null)
  const weight = (k: string) => (k.startsWith('H:') ? lines.length + 1 : 1)
  let prev = Array<number>(b.length + 1).fill(0)
  for (let i = 1; i <= a.length; i++) {
    const row = [0]
    for (let j = 1; j <= b.length; j++) {
      row[j] = a[i - 1] === b[j - 1] ? prev[j - 1] + weight(a[i - 1]) : Math.max(prev[j], row[j - 1])
    }
    prev = row
  }
  const keptHeadings = b.filter((k) => k.startsWith('H:')).length
  const keptLists = b.length - keptHeadings
  out.moved = keptLists - (prev[b.length] - keptHeadings * (lines.length + 1))
  return out
}

/** The changes in words, in the bar's order; empty when there are none. */
export function changesText(c: ListChanges): string {
  const parts: string[] = []
  const put = (n: number, words: string) => {
    if (n > 0) parts.push(`${n} ${words}`)
  }
  put(c.added, 'added')
  put(c.removed, 'removed')
  put(c.switchedOn, 'switched on')
  put(c.switchedOff, 'switched off')
  put(c.changed, 'changed')
  put(c.moved, 'moved')
  put(c.groupsAdded, c.groupsAdded === 1 ? 'group added' : 'groups added')
  put(c.groupsRenamed, c.groupsRenamed === 1 ? 'group renamed' : 'groups renamed')
  put(c.groupsRemoved, c.groupsRemoved === 1 ? 'group removed' : 'groups removed')
  return parts.join(', ')
}
