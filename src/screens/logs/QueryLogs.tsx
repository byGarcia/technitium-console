import type { ReactNode } from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'
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
import { Input, Select } from '../../ui/Field'
import { SectionHeader } from '../../ui/SectionHeader'
import { aIso, dateTime } from './dates'
import { Loading } from '../../ui/Empty'
import { Check } from '../../ui/Check'
import { Tag } from '../../ui/Tag'
import { Table } from '../../ui/Table'
import styles from './Logs.module.css'
import { pageWindow } from '../../lib/pagination'
import { Pagination } from '../../ui/Pagination'
import { noticeFromFailure, type Notice } from '../../lib/notice'
import { Notifier } from '../../ui/Notifier'

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

What is NOT here: each row's menu ("Query DNS Server", "Allow Domain" / "Block
Domain", logs.js:539-552). Its three actions live on other screens —DNS Client
and Allowed/Blocked— and there is no way to invoke them from here without
touching the Shell. It is noted as an integration gap, not half-solved.
*/


export const ENTRIES_PER_PAGE_KEY = 'optQueryLogsEntriesPerPage'

interface Filters {
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
function defaultFilters(appName: string, classPath: string): Filters {
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
legend falls short and nobody notices — which is exactly how this screen came to
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

/** The counter's text (logs.js:594-597). */
export function statusText(p: QueryLogPage): string {
  if (p.entries.length === 0) return '0 logs'
  const first = p.entries[0].rowNumber
  const last = p.entries[p.entries.length - 1].rowNumber
  return `${first}-${last} (${p.entries.length}) of ${p.totalEntries} logs (page ${p.pageNumber} of ${p.totalPages})`
}

/*
The ten pages centred on the current one. It was a letter-for-letter copy of
`lib/paginacion.ts` —that one cited `zone.js:880-905` and this one
`logs.js:571-586`, two places in upstream doing the same thing— with tests of its
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
}

export function QueryLogs({ tabs, token, node = '' }: QueryLogsProps) {
  const [apps, setApps] = useState<{ name: string; classPaths: string[] }[] | null>(null)
  const [f, setF] = useState<Filters>(() => defaultFilters('', ''))
  const [page, setPage] = useState<QueryLogPage | null>(null)
  const [notice, setNotice] = useState<Notice | null>(null)
  const [busy, setBusy] = useState(false)
  const [live, setLive] = useState(false)

  const since2 = useRef<HTMLInputElement>(null)
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

  useEffect(() => {
    let live = true
    void (async () => {
      const outcome = await listApps(token)
      if (!live) return
      if (outcome.kind !== 'ok') {
        /*
        Without this, a failure here left the "Source App Name" dropdown at
        "—", which is the same thing a server with no logging app installed
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
      setF(defaultFilters(first?.name ?? '', first?.classPaths[0] ?? ''))
    })()
    return () => {
      live = false
    }
  }, [token])

  const appClasses = apps?.find((a) => a.name === f.appName)?.classPaths ?? []

  const params = useCallback((filters: Filters, pageNumber: string): QueryLogsParams => {
    // logs.js:405 — fewer than 1 entry per page falls to 10.
    const n = Number(filters.entriesPerPage)
    const entriesPerPage = String(n < 1 || Number.isNaN(n) ? 10 : n)

    return {
      name: filters.appName,
      classPath: filters.classPath,
      pageNumber,
      entriesPerPage,
      descendingOrder: filters.descendingOrder,
      start: aIso(filters.start),
      end: aIso(filters.end),
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
      const filters = filtersRef.current

      // logs.js:389-401 — the app and the class, in that order.
      if (filters.appName === '') {
        setNotice({
          type: 'warning',
          title: 'Missing!',
          text: "Please install the 'Query Logs (Sqlite)' DNS App or any other DNS app that supports query logging feature from the Apps section.",
        })
        appRef.current?.focus()
        return
      }
      if (filters.classPath === '') {
        setNotice({
          type: 'warning',
          title: 'Missing!',
          text: 'Please select a Class Path to query logs.',
        })
        classRef.current?.focus()
        return
      }

      // logs.js:407-424 — "From" before "To", and only if the browser says
      // what was typed is not a date.
      if (since2.current?.validity.badInput === true) {
        setNotice({
          type: 'warning',
          title: 'Missing!',
          text: "Please enter correct date and time for 'From' field.",
        })
        since2.current.focus()
        return
      }
      if (until.current?.validity.badInput === true) {
        setNotice({
          type: 'warning',
          title: 'Missing!',
          text: "Please enter correct date and time for 'To' field.",
        })
        until.current.focus()
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

      setPage(outcome.data.response)
    },
    [token, params],
  )

  const queryRef = useRef(query)
  useEffect(() => {
    queryRef.current = query
  }, [query])

  /* logs.js:610 — while "Live Update" is checked, it repeats every 2 s. */
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

  function cambiarApp(name: string) {
    // logs.js:21 — on changing app its classes reload and the first is taken.
    const classes = apps?.find((a) => a.name === name)?.classPaths ?? []
    set({ appName: name, classPath: classes[0] ?? '' })
  }

  function restart() {
    const first = apps?.[0]
    setF(defaultFilters(first?.name ?? '', first?.classPaths[0] ?? ''))
  }

  function toggleLive(checked: boolean) {
    if (checked) {
      // logs.js:34-42 — pins page and order, and empties the date range.
      set({ pageNumber: '1', descendingOrder: 'true', start: '', end: '' })
      setLive(true)
      return
    }
    setLive(false)
    restart()
  }

  async function runExport() {
    // logs.js:612-625 — the app alert does NOT carry "from the Apps section." and
    // the dates are not checked here.
    if (f.appName === '') {
      setNotice({
        type: 'warning',
        title: 'Missing!',
        text: "Please install the 'Query Logs (Sqlite)' DNS App or any other DNS app that supports query logging feature.",
      })
      appRef.current?.focus()
      return
    }
    if (f.classPath === '') {
      setNotice({
        type: 'warning',
        title: 'Missing!',
        text: 'Please select a Class Path to query logs.',
      })
      classRef.current?.focus()
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


  return (
    <div className={styles.wrap}>
      <SectionHeader
        title="Logs"
        tabs={tabs}
        labels={f.appName !== '' ? <Tag>app: {f.appName}</Tag> : undefined}
        actions={<>
          <Button
            variant="primary"
            disabled={busy || live}
            onClick={() => void query(f.pageNumber, false)}
          >
            Query
          </Button>
          <Button disabled={busy} onClick={() => void runExport()}>
            Export
          </Button>
          <Button onClick={restart}>Reset</Button>
        </>}
      />

      <Notifier notice={notice} onClose={() => setNotice(null)} />

      <div className={styles.fs}>
        <h3 className={styles.fsTitle}>Filters</h3>
        <div className={styles.fsIn}>
          <div className={styles.frow}>
            <div className={styles.frowLabel}>Source</div>
            <div className={styles.frowCtl}>
              <div className={styles.field} style={{ width: 220 }}>
                <label htmlFor="ql-appName">App Name</label>
                <Select
                  id="ql-appName"
                  ref={appRef}
                  value={f.appName}
                  onChange={(e) => cambiarApp(e.target.value)}
                >
                  {apps.map((a) => (
                    <option key={a.name} value={a.name}>
                      {a.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div className={styles.field} style={{ width: 220 }}>
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
          </div>

          {/*
          The MODE group: the switch and the FOUR fields it turns off, together.

          They used to be spread about —`From`, `To` and `Order` in "Period", and
          `Page Number` at the end of "Response"— so the off signal jumped from one
          group to another and had to be repeated. Together, the edge runs down
          them once and **one** pill is enough for all four, which is the
          `Settings` master-switch rule.

          And `Logs Per Page` stays OUT on purpose, in its own group: it is the
          only one the mode does NOT turn off and the only one remembered between
          sessions. Putting it here would say it is turned off, and it is not.
          */}
          <div className={`${styles.frow}${live ? ` ${styles.byMode}` : ''}`}>
            <div className={styles.frowLabel}>
              Mode
              {/*
              The pill carries the OPPOSITE POLARITY to the one in `Settings`.

              There it says `Needs {switch}`: "turn it on and this becomes active".
              Here the truth is the reverse —they are off because `Live Update` is
              ON— and `Needs Live Update` would say exactly the opposite of how to
              get them back. A control that lies about how to recover it is worse
              than a control with no signal at all.

              Same amber and same edge, because the situation is the same in what
              matters: **the user can undo it themselves**, which is what the amber
              means. If the permission were missing too, the padlock wins.
              */}
              {live && <Tag tone="acc">While Live Update</Tag>}
            </div>
            <div className={styles.frowCtl}>
              {/*
              Not wrapped in `.field`, and `dev/uniformity.js` caught this.

              Put inside, `.field label` changed its label to 11 px and grey —the
              `settings-checkbox` family went from ONE signature to two, and the
              second existed only on this route. A checkbox **is** its own label;
              `.field` is for a control that carries a separate label above it.
              */}
              <Check label="Live Update" checked={live} onChange={toggleLive} />
              <div className={styles.field} style={{ width: 200 }}>
                <label htmlFor="ql-start">From</label>
                <Input
                  id="ql-start"
                  ref={since2}
                  type="datetime-local"
                  disabled={live}
                  value={f.start}
                  onChange={(e) => set({ start: e.target.value })}
                />
              </div>
              <div className={styles.field} style={{ width: 200 }}>
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
              <div className={styles.field} style={{ width: 140 }}>
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
              <div className={styles.field} style={{ width: 110 }}>
                <label htmlFor="ql-pageNumber">Page Number</label>
                <Input
                  id="ql-pageNumber"
                  type="number"
                  disabled={live}
                  value={f.pageNumber}
                  onChange={(e) => set({ pageNumber: e.target.value })}
                />
              </div>
            </div>
          </div>

          <div className={styles.frow}>
            <div className={styles.frowLabel}>Query</div>
            <div className={styles.frowCtl}>
              <div className={styles.field} style={{ width: 260 }}>
                <label htmlFor="ql-qname">Domain</label>
                <Input
                  id="ql-qname"
                  mono
                  placeholder="example.com or *.com"
                  value={f.qname}
                  onChange={(e) => set({ qname: e.target.value })}
                />
              </div>
              <div className={styles.field} style={{ width: 130 }}>
                <label htmlFor="ql-qtype">Type</label>
                <Input
                  id="ql-qtype"
                  placeholder="A, AAAA, etc."
                  value={f.qtype}
                  onChange={(e) => set({ qtype: e.target.value })}
                />
              </div>
              <div className={styles.field} style={{ width: 110 }}>
                <label htmlFor="ql-qclass">Class</label>
                <Select
                  id="ql-qclass"
                  value={f.qclass}
                  onChange={(e) => set({ qclass: e.target.value })}
                >
                  {QCLASSES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </Select>
              </div>
              <div className={styles.field} style={{ width: 180 }}>
                <label htmlFor="ql-clientIpAddress">Client IP Address</label>
                <Input
                  id="ql-clientIpAddress"
                  mono
                  value={f.clientIpAddress}
                  onChange={(e) => set({ clientIpAddress: e.target.value })}
                />
              </div>
            </div>
          </div>

          <div className={styles.frow}>
            <div className={styles.frowLabel}>Response</div>
            <div className={styles.frowCtl}>
              <div className={styles.field} style={{ width: 150 }}>
                <label htmlFor="ql-protocol">Protocol</label>
                <Select
                  id="ql-protocol"
                  value={f.protocol}
                  onChange={(e) => set({ protocol: e.target.value })}
                >
                  {PROTOCOLS.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </Select>
              </div>
              <div className={styles.field} style={{ width: 200 }}>
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
              <div className={styles.field} style={{ width: 160 }}>
                <label htmlFor="ql-rcode">RCODE</label>
                <Select
                  id="ql-rcode"
                  value={f.rcode}
                  onChange={(e) => set({ rcode: e.target.value })}
                >
                  {RCODES.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
          </div>

          {/* On its own, and not in "Response", because it is not a search
              criterion: it is how many rows fit. And it is the only control on
              this screen that survives a `Reset` — it is re-read from
              `localStorage`. */}
          <div className={styles.frow}>
            <div className={styles.frowLabel}>Paging</div>
            <div className={styles.frowCtl}>
              <div className={styles.field} style={{ width: 130 }}>
                <label htmlFor="ql-entriesPerPage">Logs Per Page</label>
                <Select
                  id="ql-entriesPerPage"
                  value={f.entriesPerPage}
                  onChange={(e) => saveEntriesPerPage(e.target.value)}
                >
                  {ENTRIES_PER_PAGE.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
          </div>
        </div>
      </div>

      {page != null && (
        <>
          <div className={styles.count}>
            <span>{statusText(page)}</span>
            {/* logs.js:589 — "Last" is asked for with -1; the server resolves it. */}
            <Pagination
              window={pageWindow(page.pageNumber, page.totalPages)}
              current={page.pageNumber}
              last={-1}
              onIr={(n) => void query(String(n), false)}
            />
          </div>

            {/* Always all seven, whether or not they appear on this page: see `LEGEND_ROWS`. */}
          <div className={styles.legend}>
            <span className={styles.legendTitle}>Row colours</span>
            {LEGEND_ROWS.map((e) => (
              <span key={e.name} className={styles.legendItem}>
                <span className={`${styles.testigo} ${e.cls}`} aria-hidden="true" />
                <span className={styles.legendName}>{e.name}</span>
                <span className={styles.legendWhen}>{e.when}</span>
              </span>
            ))}
          </div>

          <Table
            header={
              <>
                <th>#</th>
                <th>Timestamp</th>
                <th>Client IP Address</th>
                <th>Protocol</th>
                <th>Response Type</th>
                <th>RCODE</th>
                <th>Domain</th>
                <th>Type</th>
                <th>Class</th>
                <th>Answer</th>
              </>
            }
          >
            {page.entries.map((e) => (
              <tr key={e.rowNumber} className={rowClass(e)}>
                <td className={styles.mono}>{e.rowNumber}</td>
                <td className={`${styles.mono} ${styles.nowrap}`}>{dateTime(e.timestamp)}</td>
                <td className={`${styles.mono} ${styles.breakUp}`}>{e.clientIpAddress}</td>
                <td>{e.protocol}</td>
                <td>
                  {e.responseType}
                  {e.responseRtt != null && (
                    <div className={styles.rtt}>({e.responseRtt.toFixed(2)} ms)</div>
                  )}
                </td>
                <td>{e.rcode}</td>
                {/* logs.js:518 — the root is written with a dot. */}
                <td className={`${styles.mono} ${styles.breakUp}`}>
                  {e.qname === '' ? '.' : (e.qname ?? '')}
                </td>
                <td>{e.qtype ?? ''}</td>
                <td>{e.qclass ?? ''}</td>
                <td className={`${styles.mono} ${styles.breakUp}`}>{e.answer ?? ''}</td>
              </tr>
            ))}
          </Table>

          <div className={styles.count}>
            <span>{statusText(page)}</span>
          </div>
        </>
      )}
    </div>
  )
}
