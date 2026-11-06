import type { LogFile } from '../../api/logs'

/*
What View Logs says about its files and about the file it has open (deviation 20
in CONVENTIONS.md, 2026-11-06). Everything here reads what the screen's two calls
already bring: the `logs/list` answer (each file's name and the size the server
already formatted) and the text `logs/download` returned for the viewer. Nothing
asks the server for more.

The server names its files by day, `yyyy-MM-dd.log` (LogManager.cs), and
`logs/list` strips the extension. Any other name in that folder is still listed,
drawn and openable; it just has no day, so it never counts as the newest or the
oldest.
*/

const UNITS = ['B', 'KB', 'MB', 'GB', 'TB']

/** A size as the server writes it (`"24.44 KB"`, `"6 KB"`, `"2.39 MB"`) in bytes,
 *  or `null` when it does not read as one. */
export function sizeBytes(size: string): number | null {
  const m = /^\s*(\d+(?:\.\d+)?)\s*([KMGT]?B)\s*$/i.exec(size)
  if (m == null) return null
  const unit = UNITS.indexOf(m[2].toUpperCase())
  return unit < 0 ? null : Number(m[1]) * 1024 ** unit
}

/** Bytes in the server's own format: two decimals at most, none when they are 0. */
export function formatBytes(bytes: number): string {
  let value = bytes
  let unit = 0
  while (value >= 1024 && unit < UNITS.length - 1) {
    value /= 1024
    unit++
  }
  return `${Math.round(value * 100) / 100} ${UNITS[unit]}`
}

/** The file's day when its name is one (`2026-11-06`), `null` otherwise. */
export function fileDay(name: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(name)) return null
  const d = new Date(`${name}T00:00:00Z`)
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== name ? null : name
}

export interface FilesSummary {
  count: number
  /** The sum of the sizes the server wrote; `null` if one of them does not read. */
  total: number | null
  largest: LogFile | null
  newest: LogFile | null
  oldest: LogFile | null
}

export function summariseFiles(files: LogFile[]): FilesSummary {
  const sizes = files.map((f) => sizeBytes(f.size))
  const readable = sizes.every((s) => s != null)
  const total = readable ? sizes.reduce<number>((n, s) => n + (s ?? 0), 0) : null
  let largest: LogFile | null = null
  let most = -1
  files.forEach((f, i) => {
    const s = sizes[i]
    if (s != null && s > most) {
      most = s
      largest = f
    }
  })
  const dated = files.filter((f) => fileDay(f.fileName) != null).sort((a, b) => (a.fileName < b.fileName ? -1 : 1))
  return {
    count: files.length,
    total,
    largest,
    newest: dated.length > 0 ? dated[dated.length - 1] : null,
    oldest: dated.length > 0 ? dated[0] : null,
  }
}

/** A file's share of the folder, from 0 to 1, for the bar in its row. */
export function shareOf(file: LogFile, total: number | null): number | null {
  const s = sizeBytes(file.size)
  if (s == null || total == null || total === 0) return null
  return s / total
}

/* The prefix the server writes before every entry (LogManager.cs:605-614), the
   same one `LogText` marks. */
const STAMP = /^\0*\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2} (?:UTC|Local))\] /gm

export interface TextFacts {
  /** The lines that start with the server's timestamp. */
  entries: number
  /** The first and the last of those timestamps, as the file writes them. */
  first: string | null
  last: string | null
}

export function textFacts(text: string): TextFacts {
  let entries = 0
  let first: string | null = null
  let last: string | null = null
  for (const m of text.matchAll(STAMP)) {
    entries++
    if (first == null) first = m[1]
    last = m[1]
  }
  return { entries, first, last }
}

/* `limit=2` asks for the first 2 MB (WebServiceLogsApi.cs:100). */
const VIEWER_LIMIT = 2 * 1024 * 1024

/** Whether the viewer holds only the start of the file: the server stops at the
 *  viewer's 2 MB, so a text that reaches them is the file's first 2 MB. */
export function cutShort(text: string): boolean {
  return text.length * 4 >= VIEWER_LIMIT && new TextEncoder().encode(text).length >= VIEWER_LIMIT
}
