import { useEffect, useState } from 'react'
import { getTop, type Range, type TopKind, type TopEntry } from '../../api/dashboard'
import { Dialog } from '../../ui/Dialog'
import { Table } from '../../ui/Table'
import { DataTable, DataFoot, Grow } from '../../ui/DataTable'
import { Field, Input } from '../../ui/Field'
import { Loading } from '../../ui/Empty'
import { Notifier } from '../../ui/Notifier'
import tbl from '../../ui/Table.module.css'
import type { Notice } from '../../lib/notice'
import { useDomainAction } from '../../lib/allow-block'
import { TopRowMenu } from './TopRowMenu'
import styles from './TopStats.module.css'

/*
`modalTopStats` (main.js:2879). It is what sits behind the Dashboard's three
"More" buttons: the long list (1000 entries) of the top that was being seen
trimmed to five.

It was missing entirely: the three buttons were in place and did nothing. An
inventory sweep of upstream's modals uncovered it.

The title carries the limit inside it ("Top 1000 Clients"), and that is not
decorative: it says how many were asked for, which is different from how many
there are.

**A client is drawn with more things than a domain**: under the name goes the
domain it resolved, and if the server was rate-limiting it the row is marked and
the name carries "(rate limited)" after it. Both fields only come in
`TopClients`. A client with no domain gets no second line: upstream writes "."
there, and users read it as a stray trailing dot (issue #22). It is a written
deviation, see CONVENTIONS.md.

**Each row carries the panel's own menu** (`TopRowMenu`), and the modal is asked
for with the Dashboard's node, as upstream reads `optDashboardClusterNode`
(main.js:2932). Allowing or blocking from here reports INSIDE the modal
(`divTopStatsAlert`); jumping to DNS Client or Query Logs leaves the screen that
opened it, and the modal goes with it, which is upstream's
`$("#modalTopStats").modal("hide")`.

**The table reads like the console's other lists** (2026-11-06): ONE card
(`ui/DataTable`) with a search in its toolbar, one line per entry (a client's
domain beside its name, quieter, instead of under it) and upstream's `Total
Clients: N` in the card's foot, with `, K shown` while the search narrows it. The
search is OURS, a deviation (CONVENTIONS.md, deviation 7): upstream's modal has
none, and a thousand entries cannot be scanned by eye. It filters the list already
loaded, by the name and, for a client, its domain, and asks the server nothing.
Its words are OURS: `Search`, its placeholders and `N shown`; with no entry
matching, the table says upstream's own `No Data`.
*/

const LIMIT = 1000

const TITLES: Record<TopKind, string> = {
  TopClients: 'Clients',
  TopDomains: 'Domains',
  TopBlockedDomains: 'Blocked Domains',
}

const HEADER: Record<TopKind, string> = {
  TopClients: 'Client',
  TopDomains: 'Domain',
  TopBlockedDomains: 'Domain',
}

const PLACEHOLDER: Record<TopKind, string> = {
  TopClients: 'Client or domain',
  TopDomains: 'Domain',
  TopBlockedDomains: 'Domain',
}

/** An entry matches the search by its name and, for a client, its domain. */
export function matchesTop(f: TopEntry, search: string): boolean {
  const q = search.trim().toLowerCase()
  if (q === '') return true
  return f.name.toLowerCase().includes(q) || (f.domain ?? '').toLowerCase().includes(q)
}

const COUNT: Record<TopKind, string> = {
  TopClients: 'Queries',
  TopDomains: 'Hits',
  TopBlockedDomains: 'Hits',
}

export function TopStats({
  type,
  range,
  token,
  instants,
  node = '',
  onClose,
}: {
  /** `null` with the modal closed. */
  type: TopKind | null
  range: Range
  /** The two instants a `Custom` range is read between. */
  instants?: { start: string; end: string }
  token: string | null
  /** The cluster node the opening screen is reading; the aggregate is `cluster`. */
  node?: string
  onClose: () => void
}) {
  const [rows, setRows] = useState<TopEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [notice, setNotice] = useState<Notice | null>(null)
  const [search, setSearch] = useState('')
  const action = useDomainAction(token, setNotice)

  useEffect(() => {
    if (type == null) return
    setLoading(true)
    setRows([])
    setNotice(null)
    setSearch('')
    void getTop(token, range, type, LIMIT, node, instants).then((r) => {
      setRows(r)
      setLoading(false)
    })
  }, [type, range, instants, token, node])

  const isClient = type === 'TopClients'
  const shown = rows.filter((f) => matchesTop(f, search))
  const total = type == null ? '' : `Total ${TITLES[type]}: ${rows.length.toLocaleString()}`

  return (
    <Dialog
      open={type !== null}
      onOpenChange={(o) => !o && onClose()}
      /* Upstream gives it 600 px (`modalTopStats`), not the 940 of the wide
         tables, and the measurement proves it right: the domain column took 736 px
         for a text of 148. It is a two-column list, not a wide table. */
      size="form"
      title={type == null ? 'Top Stats' : `Top ${LIMIT} ${TITLES[type]}`}
    >
      <Notifier notice={notice} onClose={() => setNotice(null)} />
      {loading ? (
        <Loading compact />
      ) : (
        <DataTable
          toolbar={
            <Grow>
              <Field inline label="Search">
                {(id) => (
                  <Input
                    id={id}
                    search
                    placeholder={type == null ? '' : PLACEHOLDER[type]}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                )}
              </Field>
            </Grow>
          }
          foot={
            <DataFoot
              count={shown.length === rows.length ? total : `${total}, ${shown.length.toLocaleString()} shown`}
            />
          }
        >
          <Table
            className={styles.wrap}
            tableClass={styles.table}
            header={
              <>
                <th>{type == null ? '' : HEADER[type]}</th>
                <th className={styles.countHead}>{type == null ? '' : COUNT[type]}</th>
                <th className={tbl.actionsCell} />
              </>
            }
            isEmpty={shown.length === 0}
            emptyText="No Data"
            columns={3}
          >
            {shown.map((f, i) => (
              <tr key={`${f.name}|${i}`} className={f.rateLimited ? styles.limited : undefined}>
                <td>
                  <span className={styles.name}>
                    {f.name}
                    {f.rateLimited ? ' (rate limited)' : ''}
                  </span>
                  {isClient && f.domain != null && f.domain !== '' && (
                    <span className={styles.domain}>{f.domain}</span>
                  )}
                </td>
                <td className={styles.count}>{f.hits.toLocaleString()}</td>
                <td className={tbl.actionsCell}>
                  {type != null && <TopRowMenu kind={type} name={f.name} node={node} action={action} />}
                </td>
              </tr>
            ))}
          </Table>
        </DataTable>
      )}
    </Dialog>
  )
}
