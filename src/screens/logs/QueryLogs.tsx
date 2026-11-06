import type { CSSProperties, ReactNode } from 'react'
import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { listApps, type InstalledApp } from '../../api/apps'
import {
  ENTRIES_PER_PAGE,
  PROTOCOLS,
  QCLASSES,
  RCODES,
  RESPONSE_TYPES,
  exportLogsCsv,
  queryLogs,
  type QueryLogEntry,
  type QueryLogPage,
  type QueryLogsParams,
} from '../../api/logs'
import { Button } from '../../ui/Button'
import { Field, Input, Select } from '../../ui/Field'
import { SectionHeader } from '../../ui/SectionHeader'
import { toIso, dateTime } from './dates'
import { Loading } from '../../ui/Empty'
import { Check } from '../../ui/Check'
import { Tag } from '../../ui/Tag'
import { RowAction, Table } from '../../ui/Table'
import styles from './Logs.module.css'
import { pageWindow } from '../../lib/pagination'
import { Pagination } from '../../ui/Pagination'
import { DataTable, DataFoot, End, Grow } from '../../ui/DataTable'
import { noticeFromFailure, type Notice } from '../../lib/notice'
import { Notifier } from '../../ui/Notifier'
import { Menu } from '../../ui/Menu'
import tbl from '../../ui/Table.module.css'
import { useHandoff, type Handoff, type QueryLogsRequest } from '../../app/handoff'
import { useDomainAction, verbFor } from '../../lib/allow-block'
import { useMedia } from '../../lib/use-media'
import { Icon } from '../../ui/Icon'
import { dropParams, writeParams } from '../../lib/url-state'
import { recordColour } from '../zones/zone-colours'
import { QuerySummary, type Pick } from './QuerySummary'
import { QUERY_PARAMS, filtersFromBar, queryParams } from './query-url'

/*
Logs › Query Logs (logs.js:20-101 and 270-710).

Five upstream behaviours that are contract and not preferences:

  1. **The two "the app is missing" alerts do NOT say the same thing.** The
     "Query" one ends in "…from the Apps section."; the "Export" one does not
     (logs.js:391 vs 614). Making them uniform would be changing a text.
  2. **The validation order of "Query"**: the app first, then the class, then the
     "From" date and lastly the "To" one. "Export" only validates the first two:
     it does not look at the dates.
  3. **"Live Update" is not a refresh: it is a mode.** On checking it, it pins
     page 1 and descending order, EMPTIES "From" and "To", disables those four
     controls and the "Query" button, and queries again every 2 s. On unchecking
     it, it RESETS the whole form, not just those fields.
  4. **"Logs Per Page" is remembered in `localStorage`** under the key
     `optQueryLogsEntriesPerPage`, and re-read on every reset (logs.js:23-26 and
     63-65). The form's default value is 10, not the server's 25.
  5. **The "Last" page is asked for with `pageNumber=-1`**: the server returns
     the last one. Checked against a v15.4 instance.

Each row carries upstream's menu (logs.js:522-538): "Query DNS Server", then
"Allow Domain" for the three blocked response types and "Block Domain" for any
other. The jump to DNS Client goes through the Shell (`app/handoff.ts`), and the
other way round, `showQueryLogs` from the Dashboard arrives here as `request`:
the form is reset, filled with it and queried once the apps are known, which is
`refreshQueryLogsTab(true)`.

HOW IT IS LAID OUT (deviation 20 in CONVENTIONS.md, 2026-11-06), the way Cache and
the zone list read: what the page holds, then ONE card that both asks and shows.

  · **Four cards** over the results (`QuerySummary.tsx`), counted from the page on
    screen: its entries by response type and by RCODE, its top clients and its top
    names. Pressing one sets that filter and queries, as choosing it would.
  · **The results card** (`ui/DataTable`): its toolbar is the question, `Domain`
    and the screen's four verbs in upstream's order (Query, Export, Reset, Live
    Update) with the status at its end; under it, the band of the other filters;
    then the legend, the rows and, in the foot, the status, Page Number, Logs Per
    Page and the pager. Upstream draws a form panel over a table.
  · **One line per row**: when, who, what was asked, how it was answered and the
    answer, cut where its column ends. The rest (`#`, `Protocol`, `Class`, the
    response time and the whole answer, one record a line) is under the row's
    `Details`, beside upstream's row menu.
  · **The query is in the address bar** (`query-url.ts`), written once a query
    lands and read on arrival, which queries it with Live Update off.
*/


export const ENTRIES_PER_PAGE_KEY = 'optQueryLogsEntriesPerPage'

/** Where the table is short of room the timestamp breaks between the date and the
 *  time (`.stamp` in Logs.module.css), never inside either. */
function Stamp({ text }: { text: string }) {
  const [date, ...time] = text.split(' ')
  if (time.length === 0) return <span className={styles.nowrap}>{text}</span>
  return (
    <>
      <span className={styles.nowrap}>{date}</span> <span className={styles.nowrap}>{time.join(' ')}</span>
    </>
  )
}

/** A filter's width on a wide screen; on a phone every filter takes the whole
 *  line (`.field` in Logs.module.css), which an inline `width` would not allow. */
function fieldWidth(px: number): CSSProperties {
  return { '--ql-field': `${px}px` } as CSSProperties
}

/*
One line per row, whatever the value. Domain, Answer and the client address are
drawn on a single line and cut with an ellipsis where the column ends, and the
whole value stays reachable: it is the element's text (selected, copied and read
by a screen reader in full) and its `title` (shown on hover). The cut is only
visual. Before, these cells broke anywhere (`word-break: break-all`, as upstream
writes it, logs.js:514-518): `www.clou` / `dflare.c` / `om`, and a row with a long
answer reached 200 px.
*/
export function Clip({ text, className }: { text: string; className: string }) {
  if (text === '') return null
  return (
    <span className={className} title={text}>
      {text}
    </span>
  )
}

export interface Filters {
  appName: string
  classPath: string
  pageNumber: string
  entriesPerPage: string
  descendingOrder: string
  start: string
  end: string
  clientIpAddress: string
  protocol: string
  responseType: string
  rcode: string
  qname: string
  qtype: string
  qclass: string
}

/** `resetQueryLogsForm` (logs.js:50). The form returns to its default values and
 *  re-reads from `localStorage` how many entries per page. */
export function defaultFilters(appName: string, classPath: string): Filters {
  let entriesPerPage: string = ENTRIES_PER_PAGE[0]
  try {
    const saved = localStorage.getItem(ENTRIES_PER_PAGE_KEY)
    if (saved != null) entriesPerPage = saved
  } catch {
    /* Without localStorage the form's default value is used. */
  }

  return {
    appName,
    classPath,
    pageNumber: '1',
    entriesPerPage,
    descendingOrder: 'true',
    start: '',
    end: '',
    clientIpAddress: '',
    protocol: '',
    responseType: '',
    rcode: '',
    qname: '',
    qtype: '',
    qclass: '',
  }
}

/** The apps that offer query logs and, for each one, its classes that offer it
 *  (logs.js:69-84 and 300-325). */
export function appsWithQueryLogs(apps: InstalledApp[]): { name: string; classPaths: string[] }[] {
  return apps
    .map((a) => ({
      name: a.name,
      classPaths: a.dnsApps.filter((d) => d.isQueryLogs).map((d) => d.classPath),
    }))
    .filter((a) => a.classPaths.length > 0)
}

/** A row's background (logs.js:452-508): the RCODE rules, and within it the
 *  response type. It is the table's only colour signal. */
/*
The seven legend entries, in the SAME file as `rowClass` and on purpose.

They are two lists that have to say the same thing: the one that paints and the
one that explains. If they live apart, the first time somebody adds a colour the
legend falls short and nobody notices, which is exactly how this screen came to
have seven colours and no legend.

The condition is written the way `rowClass` evaluates it, not the way it sounds
best: `Blocked` is not "blocked", it is "NXDOMAIN **and** a blocked response
type", and that is the difference from `NX Domain`.
*/
export const LEGEND_ROWS: { cls: string; name: string; when: string }[] = [
  { cls: styles.rServerFailure, name: 'Server Failure', when: 'RCODE ServerFailure' },
  { cls: styles.rBlocked, name: 'Blocked', when: 'NXDOMAIN and a blocked response type' },
  { cls: styles.rNxDomain, name: 'NX Domain', when: 'NXDOMAIN without blocking' },
  { cls: styles.rRefused, name: 'Refused', when: 'RCODE Refused' },
  { cls: styles.rAuthoritative, name: 'Authoritative', when: 'Authoritative response type' },
  { cls: styles.rRecursive, name: 'Recursive', when: 'Recursive response type' },
  { cls: styles.rCached, name: 'Cached', when: 'Cached response type' },
]

export function rowClass(entry: QueryLogEntry): string {
  const locked = ['blocked', 'upstreamblocked', 'upstreamblockedcached']
  const type = entry.responseType.toLowerCase()

  switch (entry.rcode.toLowerCase()) {
    case 'serverfailure':
      return styles.rServerFailure
    case 'nxdomain':
      return locked.includes(type) ? styles.rBlocked : styles.rNxDomain
    case 'refused':
      return styles.rRefused
    default:
      if (type === 'authoritative') return styles.rAuthoritative
      if (type === 'recursive') return styles.rRecursive
      if (type === 'cached') return styles.rCached
      if (locked.includes(type)) return styles.rBlocked
      return ''
  }
}

/*
FOLDING, below `--bp-index` (960 px): the band of filters and the legend's conditions.

At 390x844 the fourteen filters were one column of fields 1,173 px tall, the legend
another 217 px, and the first result row ended at y=1,905: two full screens of
scrolling before a single log. So under this width the band closes and a `Filters`
toggle joins the toolbar, beside `Domain`, which stays on its line with the verbs:
it is the field most queries start from, and the Top Domains card sets it.

What it does NOT do, and each of these is the reason it is allowed:
  - **it never hides that the results are filtered.** Closed, the band lists every
    field it holds that differs from what `Reset` would give (`activeFilters`), by
    its own label and with the value it holds. `Domain`, `Page Number` and `Logs Per
    Page` are on screen anyway and are not repeated;
  - **it never leaves a validation without its field.** Upstream focuses the field
    that failed (logs.js:389-424 and 612-625). Here a closed band opens first, in
    the same task (`flushSync`), so the focus lands on a field that is on screen;
  - **it changes no request.** The fields stay mounted while closed (`hidden`, not
    unmounted), so their values, refs and the Live Update loop are the same ones,
    and Query, Export and Reset send exactly what they sent.

It starts closed, and `Query` closes it again: that is the moment the user asks
for results, and the results are below. Above 960 none of this exists: there is no
toggle and the band is always open.

Why not `ui/Details`, the console's disclosure: it is a `<details>`, which cannot
be pinned open above a width without leaving a toggle that does nothing, and a
field inside a closed `<details>` cannot take focus. It borrows its chevron.
*/
export const FOLD_QUERY = '(max-width: 960px)'

/** The filters that differ from what `Reset` gives, in the form's order, each with
 *  its field's own label and its value as the field shows it. */
export function activeFilters(f: Filters, reset: Filters): { label: string; value: string }[] {
  const optionLabel = (list: { value: string; label: string }[], v: string) =>
    list.find((o) => o.value === v)?.label ?? v
  /* `datetime-local` hands over `2026-10-16T09:00`; the field draws it as a date
     and a time, so the summary does not show the `T`. */
  const when = (v: string) => v.replace('T', ' ')
  const all: [keyof Filters, string, string][] = [
    ['appName', 'App Name', f.appName],
    ['classPath', 'Class Path', f.classPath],
    ['start', 'From', when(f.start)],
    ['end', 'To', when(f.end)],
    ['descendingOrder', 'Order', f.descendingOrder === 'true' ? 'Descending' : 'Ascending'],
    ['pageNumber', 'Page Number', f.pageNumber],
    ['entriesPerPage', 'Logs Per Page', f.entriesPerPage],
    ['qname', 'Domain', f.qname],
    ['qtype', 'Type', f.qtype],
    ['qclass', 'Class', f.qclass],
    ['clientIpAddress', 'Client IP Address', f.clientIpAddress],
    ['protocol', 'Protocol', optionLabel(PROTOCOLS, f.protocol)],
    ['responseType', 'Response Type', optionLabel(RESPONSE_TYPES, f.responseType)],
    ['rcode', 'RCODE', optionLabel(RCODES, f.rcode)],
  ]
  return all.filter(([key]) => f[key] !== reset[key]).map(([, label, value]) => ({ label, value }))
}

/*
The legend of the seven (see `LEGEND_ROWS`), which folds below 960 too, but only
its conditions: the seven pills, the vocabulary, stay on screen at every width, and
`Row colours` becomes the toggle that adds what paints each one. At 390 the full
legend was 217 px between the pager and the table.
*/
function RowLegend({ fold }: { fold: boolean }) {
  const [open, setOpen] = useState(false)
  const folded = fold && !open
  return (
    <div className={`${styles.legend}${folded ? ` ${styles.legendFolded}` : ''}`}>
      {fold ? (
        <button
          type="button"
          className={`${styles.legendTitle} ${styles.legendToggle}`}
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          <Icon name="chevronRight" size={12} className={styles.chevron} />
          Row colours
        </button>
      ) : (
        <span className={styles.legendTitle}>Row colours</span>
      )}
      {LEGEND_ROWS.map((e) => (
        <span key={e.name} className={styles.legendItem}>
          <span className={`${styles.tone} ${e.cls}`}>{e.name}</span>
          <span className={styles.legendWhen}>{e.when}</span>
        </span>
      ))}
    </div>
  )
}

/** The counter's text (logs.js:594-597). */
export function statusText(p: QueryLogPage): string {
  if (p.entries.length === 0) return '0 logs'
  const first = p.entries[0].rowNumber
  const last = p.entries[p.entries.length - 1].rowNumber
  return `${first}-${last} (${p.entries.length}) of ${p.totalEntries} logs (page ${p.pageNumber} of ${p.totalPages})`
}

/*
The ten pages centred on the current one. It was a letter-for-letter copy of
`lib/pagination.ts` (that one cited `zone.js:880-905` and this one
`logs.js:571-586`, two places in upstream doing the same thing), with tests of its
own. The name is kept because this screen's tests use it.
*/
export function pageRange(pageNumber: number, totalPages: number): number[] {
  return pageWindow(pageNumber, totalPages).pages
}

export interface QueryLogsProps {
  /** The section sub-navigation, drawn under the header. */
  tabs?: ReactNode
  token: string | null
  node?: string
  /** `showQueryLogs` from another screen: these filters, queried on arrival. */
  request?: QueryLogsRequest
}

/** The fields the folded band does not repeat: they stay on screen below 960. */
const ALWAYS_SHOWN = ['Domain', 'Page Number', 'Logs Per Page']

/** A query type in its series colour (`zones/zone-colours`), as Zones and Cache
 *  draw a record's type: the word in the colour, on a tint of it. */
function QType({ type }: { type: string | null }) {
  if (type == null || type === '') return null
  return (
    <span className={styles.qtype} style={{ '--rt': recordColour(type) } as CSSProperties}>
      {type}
    </span>
  )
}

/*
The answer whole, one record a line. The server writes the records of an answer
joined by `, ` (`A 1.2.3.4, A 5.6.7.8`); each piece is its own block here and keeps
its comma, so the text read, found and copied is the answer as it came. A record's
data can hold `, ` too (a TXT), so the split is only where the next piece starts
with a record type; a TXT that holds one breaks one line early and loses nothing.
*/
function AnswerLines({ text }: { text: string }) {
  const pieces = text.split(/(?<=,) (?=[A-Z][A-Z0-9]* )/)
  return (
    <span className={styles.answerLines}>
      {pieces.map((p, i) => (
        <span key={i}>
          {p}
          {i < pieces.length - 1 ? ' ' : ''}
        </span>
      ))}
    </span>
  )
}

/*
ONE LINE PER ROW, its details folded (deviation 20, 2026-11-06), as Cache draws a
record. The line says what happened: when, which client, what it asked (the name
and the type, the row's lead in a stacked table), how it was answered (the
response type on its row colour, and the RCODE) and the answer, cut where the
column ends. `Details` opens a line under it with the rest of upstream's columns,
`#`, `Protocol` and `Class`, the response time upstream writes under the response
type, and the answer whole. Upstream's row menu stays beside it.
*/
function QueryRow({
  e,
  node,
  handoff,
  action,
  fresh = false,
}: {
  e: QueryLogEntry
  node: string
  handoff: Handoff | null
  action: ReturnType<typeof useDomainAction>
  /** It came in on Live Update's last turn: it flashes once. */
  fresh?: boolean
}) {
  const [open, setOpen] = useState(false)
  const detail = useId()
  const cls = [rowClass(e), open ? styles.openRow : ''].filter(Boolean).join(' ')

  return (
    <>
      <tr className={cls || undefined} data-fresh={fresh ? '' : undefined}>
        <td className={`${styles.mono} ${styles.stamp}`}>
          <Stamp text={dateTime(e.timestamp)} />
        </td>
        <td className={styles.mono}>
          <Clip text={e.clientIpAddress} className={styles.clipClient} />
        </td>
        {/* logs.js:518. The root is written with a dot. */}
        <td className={`${styles.mono} ${tbl.lead}`}>
          <Clip text={e.qname === '' ? '.' : (e.qname ?? '')} className={styles.clipDomain} />
        </td>
        <td className={tbl.lead}>
          <QType type={e.qtype} />
        </td>
        <td>
          {/* The row's colour, in this cell: see `.tone` in Logs.module.css. */}
          <span className={styles.tone}>{e.responseType}</span>
          {/* logs.js:517: the round trip under the response type, as upstream draws
              it in the row (it had gone under Details only; back on 2026-11-06). */}
          {e.responseRtt != null && <span className={styles.rttRow}>({e.responseRtt.toFixed(2)} ms)</span>}
        </td>
        <td>{e.rcode}</td>
        <td className={`${styles.mono} ${styles.answer}`}>
          <Clip text={e.answer ?? ''} className={styles.clipAnswer} />
        </td>
        <td className={tbl.actionsCell}>
          <div className={tbl.actions}>
            <RowAction
              icon={open ? 'chevronDown' : 'chevronRight'}
              name="Details"
              aria-expanded={open}
              aria-controls={detail}
              onClick={() => setOpen((v) => !v)}
            />
            <Menu label={`Actions for row ${e.rowNumber}`}>
              {(close) => {
                const verb = verbFor(e.responseType)
                const key = String(e.rowNumber)
                /* The domain is the row's `qname` as it came (the root is the empty
                   string, not the dot drawn above). */
                const domain = e.qname ?? ''
                return (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        close()
                        /* Upstream writes the type into the handler as text, so a
                           missing one travels as "null", not as no type. */
                        handoff?.queryDnsServer(domain, String(e.qtype), node)
                      }}
                    >
                      Query DNS Server
                    </button>
                    <button
                      type="button"
                      disabled={action.isBusy(key)}
                      onClick={() => {
                        close()
                        void action.run(key, verb, domain)
                      }}
                    >
                      {verb}
                    </button>
                  </>
                )
              }}
            </Menu>
          </div>
        </td>
      </tr>
      {open && (
        <tr id={detail} className={styles.detailRow}>
          <td colSpan={8}>
            <dl className={styles.details}>
              <div>
                <dt>#</dt>
                <dd className={styles.mono}>{e.rowNumber}</dd>
              </div>
              <div>
                <dt>Protocol</dt>
                <dd>{e.protocol}</dd>
              </div>
              <div>
                <dt>Class</dt>
                <dd>{e.qclass ?? ''}</dd>
              </div>
              <div>
                <dt>Response Type</dt>
                <dd>
                  {e.responseType}
                  {e.responseRtt != null && <span className={styles.rtt}>({e.responseRtt.toFixed(2)} ms)</span>}
                </dd>
              </div>
              {e.answer != null && e.answer !== '' && (
                <div className={styles.detailWide}>
                  <dt>Answer</dt>
                  <dd className={styles.mono}>
                    <AnswerLines text={e.answer} />
                  </dd>
                </div>
              )}
            </dl>
          </td>
        </tr>
      )}
    </>
  )
}

export function QueryLogs({ tabs, token, node = '', request }: QueryLogsProps) {
  const [apps, setApps] = useState<{ name: string; classPaths: string[] }[] | null>(null)
  const [f, setF] = useState<Filters>(() => defaultFilters('', ''))
  const [page, setPage] = useState<QueryLogPage | null>(null)
  /* The filters the page on screen was asked with: the pressed card chips, and
     what goes to the address bar. */
  const [applied, setApplied] = useState<Filters | null>(null)
  const [notice, setNotice] = useState<Notice | null>(null)
  const [busy, setBusy] = useState(false)
  const [live, setLive] = useState(false)
  /*
  What Live Update brought, for the eye only (2026-11-06, deviation 27): the rows
  that were not on the previous turn's page flash once as they come in, and the
  switch counts how many arrived since it was turned on. It reads only what the
  loop already reads; the loop, its calls and its timing are upstream's.
  */
  const seen = useRef<{ rows: Set<number>; total: number; asked: string } | null>(null)
  const [fresh, setFresh] = useState<ReadonlySet<number>>(() => new Set())
  const [arrived, setArrived] = useState(0)
  /* What the Live Update switch says right now, for the guard at the top of
     `query`: set in the same handler as the switch, so a click on the
     pagination one frame after it already sees it. */
  const liveRef = useRef(false)
  /* Below 960 the band folds (see FOLD_QUERY); it starts closed. */
  const fold = useMedia(FOLD_QUERY)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const folded = fold && !filtersOpen
  const handoff = useHandoff()
  /* Allowing or blocking from a row reports on the page (logs.js:531 and 535
     pass no alert placeholder). */
  const action = useDomainAction(token, setNotice)
  /* The jump that brought us here, applied once the apps list arrives. */
  const pending = useRef(request)
  /* The query the address bar asked for on arrival (`query-url.ts`), read before
     anything writes to it; a jump from another screen wins over it. */
  const [bar] = useState(() => window.location.search)
  const barRef = useRef<string | null>(bar)

  const since = useRef<HTMLInputElement>(null)
  const until = useRef<HTMLInputElement>(null)
  // The dropdown is `ui/Select`, so what gets focused is its trigger.
  const appRef = useRef<HTMLButtonElement>(null)
  const classRef = useRef<HTMLButtonElement>(null)
  /* The "Live Update" loop and the validations ALWAYS read the current
     filters, but rebuilding the timer every time a field is typed into would
     restart it. Hence the ref, synced after each commit. */
  const filtersRef = useRef(f)
  useEffect(() => {
    filtersRef.current = f
  }, [f])
  /* What Reset gives, for the address bar and the folded summary. */
  const resetRef = useRef<Filters>(defaultFilters('', ''))

  /* Upstream focuses the field that failed. A folded band opens first, and in the
     same task, so the field is on screen when it takes the focus; above 960 the
     state is not read and this changes nothing. */
  const reveal = useCallback((field: HTMLElement | null) => {
    flushSync(() => setFiltersOpen(true))
    field?.focus()
  }, [])

  const appClasses = apps?.find((a) => a.name === f.appName)?.classPaths ?? []

  const params = useCallback((filters: Filters, pageNumber: string): QueryLogsParams => {
    // logs.js:405. Fewer than 1 entry per page falls to 10.
    const n = Number(filters.entriesPerPage)
    const entriesPerPage = String(n < 1 || Number.isNaN(n) ? 10 : n)

    return {
      name: filters.appName,
      classPath: filters.classPath,
      pageNumber,
      entriesPerPage,
      descendingOrder: filters.descendingOrder,
      start: toIso(filters.start),
      end: toIso(filters.end),
      clientIpAddress: filters.clientIpAddress,
      protocol: filters.protocol,
      responseType: filters.responseType,
      rcode: filters.rcode,
      qname: filters.qname,
      qtype: filters.qtype,
      qclass: filters.qclass,
      node,
    }
  }, [node])

  const query = useCallback(
    async (pageNumber: string, live: boolean) => {
      /* logs.js:386-387. Any query that is not the loop's own does nothing
         while Live Update is checked: the pagination's links included, which
         upstream draws and leaves dead. */
      if (!live && liveRef.current) return
      const filters = filtersRef.current

      // The app and the class, in that order (logs.js:389-401).
      if (filters.appName === '') {
        setNotice({
          type: 'warning',
          title: 'Missing!',
          text: "Please install the 'Query Logs (Sqlite)' DNS App or any other DNS app that supports query logging feature from the Apps section.",
        })
        reveal(appRef.current)
        return
      }
      if (filters.classPath === '') {
        setNotice({
          type: 'warning',
          title: 'Missing!',
          text: 'Please select a Class Path to query logs.',
        })
        reveal(classRef.current)
        return
      }

      // logs.js:407-424. "From" before "To", and only if the browser says
      // what was typed is not a date.
      if (since.current?.validity.badInput === true) {
        setNotice({
          type: 'warning',
          title: 'Missing!',
          text: "Please enter correct date and time for 'From' field.",
        })
        reveal(since.current)
        return
      }
      if (until.current?.validity.badInput === true) {
        setNotice({
          type: 'warning',
          title: 'Missing!',
          text: "Please enter correct date and time for 'To' field.",
        })
        reveal(until.current)
        return
      }

      if (!live) setBusy(true)
      const outcome = await queryLogs(token, params(filters, pageNumber))
      if (!live) setBusy(false)

      if (outcome.kind !== 'ok') {
        if (!live) {
          setNotice(noticeFromFailure(outcome))
        }
        return
      }

      const landed = outcome.data.response
      if (live && liveRef.current) {
        /* Only a turn that asked what the last one asked is compared with it: a
           filter or node changed in between starts a new count from there. */
        const asked = JSON.stringify(params(filters, pageNumber))
        const before = seen.current?.asked === asked ? seen.current : null
        if (seen.current != null && before == null) setFresh((f) => (f.size === 0 ? f : new Set()))
        const rows = new Set(landed.entries.map((e) => e.rowNumber))
        if (before != null) {
          setFresh(new Set(landed.entries.filter((e) => !before.rows.has(e.rowNumber)).map((e) => e.rowNumber)))
          /* Counted from the log's total, not the page: more than a page can arrive
             between two turns. A total that shrinks (logs deleted) counts nothing. */
          const grew = landed.totalEntries - before.total
          if (grew > 0) setArrived((n) => n + grew)
        }
        seen.current = { rows, total: landed.totalEntries, asked }
      } else if (!live) {
        seen.current = null
        setFresh((f) => (f.size === 0 ? f : new Set()))
      }
      setPage(landed)
      setApplied(filters)
      /* The query on screen goes to the bar, replacing the entry: the filters it
         sent and the page the server answered (`query-url.ts`). */
      writeParams(queryParams(filters, resetRef.current, landed.pageNumber))
    },
    [token, params, reveal],
  )

  const queryRef = useRef(query)
  useEffect(() => {
    queryRef.current = query
  }, [query])

  /* The bar's query leaves with the screen, as Cache's node does. */
  useEffect(() => () => dropParams(QUERY_PARAMS), [])

  /*
  A node change runs the query again when there are results on screen
  (logs.js:108-113), on the page the form says. With Live Update on, upstream's
  `queryLogs()` returns at once (logs.js:386-387) and the loop picks the new node
  up by itself.
  */
  const shownRef = useRef({ page, live })
  useEffect(() => {
    shownRef.current = { page, live }
  }, [page, live])
  const lastNode = useRef(node)
  useEffect(() => {
    if (lastNode.current === node) return
    lastNode.current = node
    const shown = shownRef.current
    if (shown.page != null && !shown.live) void queryRef.current(filtersRef.current.pageNumber, false)
  }, [node])

  /* Declared after `queryRef`, which the jump's arrival uses below. */
  useEffect(() => {
    let live = true
    void (async () => {
      const outcome = await listApps(token)
      if (!live) return
      if (outcome.kind !== 'ok') {
        /*
        Without this, a failure here left the "Source App Name" dropdown at
        the empty-value dash, which is the same thing a server with no logging app installed
        shows. And there is no way out of that: with no app there is no query to
        run, so the screen sat dead without saying why.
        */
        setApps([])
        setNotice(noticeFromFailure(outcome))
        return
      }
      const list = appsWithQueryLogs(outcome.data.response.apps ?? [])
      setApps(list)
      const first = list[0]
      const base = defaultFilters(first?.name ?? '', first?.classPaths[0] ?? '')
      resetRef.current = base
      const req = pending.current
      const fromBar = barRef.current != null ? filtersFromBar(barRef.current, base, list) : null
      barRef.current = null
      if (req == null) {
        if (fromBar == null) {
          setF(base)
          return
        }
        /* A link to a query: that form, queried once, as Query would. */
        setF(fromBar)
        filtersRef.current = fromBar
        void queryRef.current(fromBar.pageNumber, false)
        return
      }
      /* `showQueryLogs` (logs.js:624-655): the reset form, the domain and/or the
         client, and the query. From a Dashboard chart the jump also carries a time
         window or a value for this form's own fields (deviation 7, `app/handoff.ts`).
         The ref is written here because the query reads it before the next commit
         would. */
      pending.current = undefined
      const next = { ...base, qname: req.domain ?? '', clientIpAddress: req.clientIp ?? '', ...req.filters }
      setF(next)
      filtersRef.current = next
      void queryRef.current(next.pageNumber, false)
    })()
    return () => {
      live = false
    }
  }, [token])

  /* logs.js:610. While "Live Update" is checked, it repeats every 2 s. */
  useEffect(() => {
    if (!live) return
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined

    async function cycle() {
      await queryRef.current('1', true)
      if (cancelled) return
      timer = setTimeout(() => void cycle(), 2000)
    }
    void cycle()

    return () => {
      cancelled = true
      if (timer !== undefined) clearTimeout(timer)
    }
  }, [live])

  function set(partial: Partial<Filters>) {
    setF((prev) => ({ ...prev, ...partial }))
  }

  function changeApp(name: string) {
    // logs.js:21. On changing app its classes reload and the first is taken.
    const classes = apps?.find((a) => a.name === name)?.classPaths ?? []
    set({ appName: name, classPath: classes[0] ?? '' })
  }

  function restart() {
    const first = apps?.[0]
    setF(defaultFilters(first?.name ?? '', first?.classPaths[0] ?? ''))
  }

  function toggleLive(checked: boolean) {
    if (checked) {
      // logs.js:34-42. Pins page and order, and empties the date range.
      set({ pageNumber: '1', descendingOrder: 'true', start: '', end: '' })
      liveRef.current = true
      setLive(true)
      return
    }
    liveRef.current = false
    setLive(false)
    seen.current = null
    setFresh(new Set())
    setArrived(0)
    restart()
  }

  /*
  A card pressed (`QuerySummary`): the value goes into its field and Query runs
  from page 1, as choosing it and pressing Query would; the ref is written first
  because the query reads it before the next commit. With Live Update on Query is
  off, and the loop's next turn sends the field as it is.
  */
  function pick(field: Pick, value: string) {
    const next = { ...filtersRef.current, [field]: value, pageNumber: '1' }
    setF(next)
    filtersRef.current = next
    if (!liveRef.current) void query('1', false)
  }

  async function runExport() {
    // logs.js:612-625. The app alert does NOT carry "from the Apps section." and
    // the dates are not checked here.
    if (f.appName === '') {
      setNotice({
        type: 'warning',
        title: 'Missing!',
        text: "Please install the 'Query Logs (Sqlite)' DNS App or any other DNS app that supports query logging feature.",
      })
      reveal(appRef.current)
      return
    }
    if (f.classPath === '') {
      setNotice({
        type: 'warning',
        title: 'Missing!',
        text: 'Please select a Class Path to query logs.',
      })
      reveal(classRef.current)
      return
    }

    setBusy(true)
    await exportLogsCsv(token, params(f, f.pageNumber))
    setBusy(false)
  }

  function saveEntriesPerPage(value: string) {
    set({ entriesPerPage: value })
    try {
      localStorage.setItem(ENTRIES_PER_PAGE_KEY, value)
    } catch {
      /* Without localStorage it is not remembered; the filter still works. */
    }
  }

  if (apps == null) return <Loading />

  /* What the folded band lists (FOLD_QUERY): its own fields that are set. */
  const active = activeFilters(f, defaultFilters(apps[0]?.name ?? '', apps[0]?.classPaths[0] ?? '')).filter(
    (a) => !ALWAYS_SHOWN.includes(a.label),
  )

  return (
    <div className={styles.wrap}>
      <SectionHeader
        section="Logs"
        title="Query Logs"
        tabs={tabs}
        labels={f.appName !== '' ? <Tag>app: {f.appName}</Tag> : undefined}
      />

      <Notifier notice={notice} onClose={() => setNotice(null)} />

      {page != null && applied != null && (
        <QuerySummary
          page={page}
          applied={{
            responseType: applied.responseType,
            rcode: applied.rcode,
            clientIpAddress: applied.clientIpAddress,
            qname: applied.qname,
          }}
          onPick={pick}
        />
      )}

      {/*
      ONE card that asks and shows (`ui/DataTable`), the way the zone list and Cache
      draw theirs: the question in its toolbar, the other filters in a band under it,
      then the legend, the rows and, in its foot, the status, the page fields and the
      pager. The page reads top to bottom as it is used.

        · The toolbar: `Domain`, the field a query most often starts from, and the
          screen's verbs in upstream's order (index.html:3565-3569) with the same
          handlers: Query, Export, Reset and Live Update. At its end the status,
          because upstream writes it above the table as well as under it
          (`tableQueryLogsTopStatus`, logs.js:589).
        · The band: the other ten filters, the ones Live Update turns off together
          under one edge. Upstream draws all of them in a form panel above the table.
        · The foot: the status again (`tableQueryLogsFooterStatus`, logs.js:592), the
          two fields that say WHICH page (Live Update still disables Page Number, and
          Logs Per Page is still remembered) and the pager, once.

      The card is drawn before the first query too, with its toolbar, band and page
      fields, because they are the form and upstream shows them all from the start;
      the status, the pager, the legend and the table only arrive with a result, as
      upstream's `divQueryLogsTable` does.
      */}
      <DataTable
        toolbar={
          <>
            <Grow>
              <Field inline label="Domain">
                {(id) => (
                  <Input
                    id={id}
                    mono
                    search
                    placeholder="example.com or *.com"
                    value={f.qname}
                    onChange={(e) => set({ qname: e.target.value })}
                  />
                )}
              </Field>
            </Grow>
            {fold && (
              <Button
                aria-expanded={filtersOpen}
                aria-controls="ql-filters"
                aria-describedby={folded && active.length > 0 ? 'ql-filters-set' : undefined}
                onClick={() => setFiltersOpen(!filtersOpen)}
              >
                <Icon name="chevronRight" size={12} className={styles.chevron} />
                Filters
              </Button>
            )}
            <div className={styles.runActs}>
              <Button lead="search"
                variant="primary"
                disabled={busy || live}
                onClick={() => {
                  /* Folded, Query closes the band: the results are what comes next.
                     A validation that fails opens it again on its field (`reveal`). */
                  if (fold) setFiltersOpen(false)
                  void query(f.pageNumber, false)
                }}
              >
                Query
              </Button>
              <Button lead="download" disabled={busy} onClick={() => void runExport()}>
                Export
              </Button>
              <Button onClick={restart}>Reset</Button>
              {/*
              "Live Update" is a MODE of the whole screen, not a filter: it governs
              Query, the From/To/Order group, Page Number and the table at once. So it
              sits with the screen's actions and is drawn as `ui/Check`'s switch, which
              this console uses for a state that stays put. Underneath it is the same
              checkbox with the same label, in upstream's place in the order (after
              Reset, index.html:3565-3569), and the same handler.

              Not wrapped in `.field`: `dev/uniformity.js` caught that once, when it
              turned the label into an 11 px grey one.
              */}
              <span className={styles.live}>
                <Check toggle label="Live Update" checked={live} onChange={toggleLive} />
                {live && (
                  <span className={styles.liveNow} title="Live Update reads page 1 every 2 seconds">
                    {arrived === 1 ? '1 new' : `${arrived} new`}
                  </span>
                )}
              </span>
            </div>
            {page != null && (
              <End>
                <span>{statusText(page)}</span>
              </End>
            )}
          </>
        }
        foot={
          <DataFoot count={page != null ? statusText(page) : null}>
            <div className={styles.pageField}>
              <Field inline label="Page Number">
                {(id) => (
                  <Input
                    id={id}
                    type="number"
                    disabled={live}
                    value={f.pageNumber}
                    onChange={(e) => set({ pageNumber: e.target.value })}
                  />
                )}
              </Field>
            </div>
            {/* The only control on this screen that survives a `Reset`: it is
                re-read from `localStorage`. And the only one of the page's two
                that Live Update leaves alone. */}
            <div className={styles.perPage}>
              <Field inline label="Logs Per Page">
                {(id) => (
                  <Select
                    id={id}
                    value={f.entriesPerPage}
                    onChange={(e) => saveEntriesPerPage(e.target.value)}
                  >
                    {ENTRIES_PER_PAGE.map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
            </div>
            {/* logs.js:589. "Last" is asked for with -1; the server resolves it. */}
            {page != null && (
              <Pagination
                window={pageWindow(page.pageNumber, page.totalPages)}
                current={page.pageNumber}
                last={-1}
                onGoTo={(n) => void query(String(n), false)}
              />
            )}
          </DataFoot>
        }
      >
        {/* Folded, what is set, so a filtered table never reads as the whole log. */}
        {folded && active.length > 0 && (
          <p id="ql-filters-set" className={styles.fsSet}>
            {active.map((a) => (
              <span key={a.label} className={styles.fsSetItem}>
                <span className={styles.fsSetLabel}>{a.label}:</span> {a.value}
              </span>
            ))}
          </p>
        )}
        <div id="ql-filters" className={styles.band} hidden={folded}>
          <div className={styles.field} style={fieldWidth(190)}>
            <label htmlFor="ql-responseType">Response Type</label>
            <Select
              id="ql-responseType"
              value={f.responseType}
              onChange={(e) => set({ responseType: e.target.value })}
            >
              {RESPONSE_TYPES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </Select>
          </div>
          <div className={styles.field} style={fieldWidth(140)}>
            <label htmlFor="ql-rcode">RCODE</label>
            <Select id="ql-rcode" value={f.rcode} onChange={(e) => set({ rcode: e.target.value })}>
              {RCODES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </Select>
          </div>
          <div className={styles.field} style={fieldWidth(160)}>
            <label htmlFor="ql-clientIpAddress">Client IP Address</label>
            <Input
              id="ql-clientIpAddress"
              mono
              value={f.clientIpAddress}
              onChange={(e) => set({ clientIpAddress: e.target.value })}
            />
          </div>
          <div className={styles.field} style={fieldWidth(110)}>
            <label htmlFor="ql-qtype">Type</label>
            <Input
              id="ql-qtype"
              placeholder="A, AAAA, etc."
              value={f.qtype}
              onChange={(e) => set({ qtype: e.target.value })}
            />
          </div>
          <div className={styles.field} style={fieldWidth(96)}>
            <label htmlFor="ql-qclass">Class</label>
            <Select id="ql-qclass" value={f.qclass} onChange={(e) => set({ qclass: e.target.value })}>
              {QCLASSES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </div>
          <div className={styles.field} style={fieldWidth(120)}>
            <label htmlFor="ql-protocol">Protocol</label>
            <Select id="ql-protocol" value={f.protocol} onChange={(e) => set({ protocol: e.target.value })}>
              {PROTOCOLS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </Select>
          </div>

          {/*
          The MODE group: the fields "Live Update" turns off, together, so the edge
          runs down them once and ONE pill is enough, which is the `Settings`
          master-switch rule. `Page Number`, the fourth, is in the foot beside the
          pager, drawn disabled while the mode is on.

          The pill carries the OPPOSITE POLARITY to the one in `Settings`: there it
          says `Needs {switch}`; here they are off because `Live Update` is ON, and
          `Needs Live Update` would say exactly the opposite of how to get them back.
          Same amber and same edge, because the user can undo it themselves, which is
          what the amber means.
          */}
          <div className={`${styles.mode}${live ? ` ${styles.byMode}` : ''}`}>
            <div className={styles.field} style={fieldWidth(190)}>
              <label htmlFor="ql-start">From</label>
              <Input
                id="ql-start"
                ref={since}
                type="datetime-local"
                disabled={live}
                value={f.start}
                onChange={(e) => set({ start: e.target.value })}
              />
            </div>
            <div className={styles.field} style={fieldWidth(190)}>
              <label htmlFor="ql-end">To</label>
              <Input
                id="ql-end"
                ref={until}
                type="datetime-local"
                disabled={live}
                value={f.end}
                onChange={(e) => set({ end: e.target.value })}
              />
            </div>
            <div className={styles.field} style={fieldWidth(130)}>
              <label htmlFor="ql-order">Order</label>
              <Select
                id="ql-order"
                disabled={live}
                value={f.descendingOrder}
                onChange={(e) => set({ descendingOrder: e.target.value })}
              >
                <option value="false">Ascending</option>
                <option value="true">Descending</option>
              </Select>
            </div>
            {live && (
              <span className={styles.modePill}>
                <Tag tone="acc">While Live Update</Tag>
              </span>
            )}
          </div>

          {/* Which app's log is read, and through which class: upstream's first two
              fields, which the header's `app:` tag names. */}
          <div className={styles.field} style={fieldWidth(200)}>
            <label htmlFor="ql-appName">App Name</label>
            <Select id="ql-appName" ref={appRef} value={f.appName} onChange={(e) => changeApp(e.target.value)}>
              {apps.map((a) => (
                <option key={a.name} value={a.name}>
                  {a.name}
                </option>
              ))}
            </Select>
          </div>
          <div className={styles.field} style={fieldWidth(200)}>
            <label htmlFor="ql-classPath">Class Path</label>
            <Select
              id="ql-classPath"
              ref={classRef}
              value={f.classPath}
              onChange={(e) => set({ classPath: e.target.value })}
            >
              {appClasses.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </div>
        </div>

        {page != null && (
          <>
            {/* Always all seven, whether or not they appear on this page: see `LEGEND_ROWS`. */}
            <RowLegend fold={fold} />

            <Table
              stack
              tableClass={styles.queryTable}
              header={
                <>
                  <th>Timestamp</th>
                  <th>Client IP Address</th>
                  <th>Domain</th>
                  <th>Type</th>
                  <th>Response Type</th>
                  <th>RCODE</th>
                  <th>Answer</th>
                  <th className={tbl.actionsCell} />
                </>
              }
            >
              {page.entries.map((e) => (
                <QueryRow key={e.rowNumber} e={e} node={node} handoff={handoff} action={action} fresh={fresh.has(e.rowNumber)} />
              ))}
            </Table>
          </>
        )}
      </DataTable>
    </div>
  )
}
