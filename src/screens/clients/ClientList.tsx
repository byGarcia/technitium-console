import { DataTable, DataFoot, Grow } from '../../ui/DataTable'
import { Field, Input, Select } from '../../ui/Field'
import { Button } from '../../ui/Button'
import { Pagination } from '../../ui/Pagination'
import { Failure, Loading } from '../../ui/Empty'
import { pageWindow } from '../../lib/pagination'
import { num2 } from '../dashboard/metrics'
import {
  blockedShare, label, type ClientRow, type Filter, type SortBy,
} from './clients-model'
import { Tags } from './ClientCard'
import styles from './Clients.module.css'

/*
The Clients page's list (CONVENTIONS.md, deviation 25): one card, the search in its
toolbar, the filters as chips with their counts and the order as a select under it,
one line per client, the count and the pages in the foot. A line is a button that
opens the client's card; the open one is marked (`aria-current`).

A line reads: the client's initial in a circle (as the account row draws its own),
its name and address, its tags, and at the end its queries in the period, how much
of its queries in the log sample were blocked (`N% blocked`, nothing when it is not
in the sample or there is none) and a thin bar of the same split, Blocked purple and
the rest green.

Its words, all OURS save upstream's `No Data`: `Search`, `Name or IP`, `Filter`,
`All`, `Heavy blocking`, `Quiet`, `Sort by`, `Most queries`, `Most blocked`, `Name`,
`N of M`, `N% blocked`, `No clients for this period.`, `Could not load this data.`
(the Overview's) and each bar's `Blocked N%`.
*/

export const FILTER_LABEL: Record<Filter, string> = { all: 'All', heavy: 'Heavy blocking', quiet: 'Quiet' }
export const SORT_LABEL: Record<SortBy, string> = { queries: 'Most queries', blocked: 'Most blocked', name: 'Name' }

export function ClientList({
  rows,
  all,
  shown,
  counts,
  filters,
  filter,
  onFilter,
  sort,
  onSort,
  query,
  onQuery,
  page,
  totalPages,
  onPage,
  selected,
  onSelect,
  loading,
  failure,
}: {
  /** The rows of this page. */
  rows: ClientRow[]
  all: number
  shown: number
  counts: Record<Filter, number>
  /** The filters this session can count: Heavy blocking needs the log sample. */
  filters: readonly Filter[]
  filter: Filter
  onFilter: (f: Filter) => void
  sort: SortBy
  onSort: (s: SortBy) => void
  query: string
  onQuery: (q: string) => void
  page: number
  totalPages: number
  onPage: (p: number) => void
  selected: string | null
  onSelect: (ip: string) => void
  loading: boolean
  failure: boolean
}) {
  return (
    <DataTable
      toolbar={
        <Grow>
          <Field inline label="Search">
            {(id) => (
              <Input id={id} search placeholder="Name or IP" value={query} onChange={(e) => onQuery(e.target.value)} />
            )}
          </Field>
        </Grow>
      }
      foot={
        totalPages > 1 ? (
          <DataFoot count={null}>
            <Pagination window={pageWindow(page, totalPages)} current={page} last={totalPages} onGoTo={onPage} />
          </DataFoot>
        ) : undefined
      }
    >
      <div className={styles.listControls}>
        <div className={styles.chips} role="group" aria-label="Filter">
          {filters.map((f) => (
            <Button key={f} size="sm" aria-pressed={filter === f} onClick={() => onFilter(f)}>
              {FILTER_LABEL[f]}
              {!loading && !failure && <> <span className={styles.chipCount}>{num2(counts[f])}</span></>}
            </Button>
          ))}
        </div>
        <div className={styles.sortLine}>
          <Field inline label="Sort by">
            {(id) => (
              <Select id={id} value={sort} onChange={(e) => onSort(e.target.value as SortBy)}>
                {(Object.keys(SORT_LABEL) as SortBy[]).map((s) => (
                  <option key={s} value={s}>
                    {SORT_LABEL[s]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          {!loading && !failure && <span className={styles.ofCount}>{`${num2(shown)} of ${num2(all)}`}</span>}
        </div>
      </div>
      {failure ? (
        <div className={styles.listGap}>
          <Failure>Could not load this data.</Failure>
        </div>
      ) : loading ? (
        <div className={styles.listGap}>
          <Loading />
        </div>
      ) : rows.length === 0 ? (
        <p className={styles.noRows}>{all === 0 ? 'No clients for this period.' : 'No Data'}</p>
      ) : (
        <ul className={styles.list} aria-label="Clients">
          {rows.map((r) => (
            <li key={r.ip}>
              <Line row={r} current={r.ip === selected} onSelect={() => onSelect(r.ip)} />
            </li>
          ))}
        </ul>
      )}
    </DataTable>
  )
}

function Line({ row, current, onSelect }: { row: ClientRow; current: boolean; onSelect: () => void }) {
  const share = blockedShare(row)
  const pct = share == null ? null : Math.round(share * 100)
  const name = label(row)
  return (
    <button type="button" className={styles.line} aria-current={current || undefined} onClick={onSelect}>
      <span className={styles.avatar} aria-hidden="true" data-current={current || undefined}>
        {name.trim().charAt(0).toUpperCase()}
      </span>
      <span className={styles.lineWho}>
        <span className={styles.lineName}>{name}</span>
        <span className={styles.lineSub}>
          {row.name != null && <span className={styles.mono}>{row.ip}</span>}
          <Tags row={row} />
        </span>
      </span>
      <span className={styles.lineFigures}>
        <span className={styles.lineHits}>{num2(row.hits)}</span>
        {pct != null && <span className={styles.lineBlocked}>{`${pct}% blocked`}</span>}
        {share != null && (
          <span className={styles.lineBar} role="img" aria-label={`Blocked ${pct}%`}>
            <i className={styles.lineBarBlocked} style={{ flexGrow: share }} />
            <i className={styles.lineBarAllowed} style={{ flexGrow: 1 - share }} />
          </span>
        )}
      </span>
    </button>
  )
}
