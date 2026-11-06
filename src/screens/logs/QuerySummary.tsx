import { useState, type CSSProperties, type ReactNode } from 'react'
import { DomainName } from '../../ui/DomainName'
import type { QueryLogPage } from '../../api/logs'
import { Card, Count, StackBar, hotEvents, statStyles } from '../../ui/StatCard'
import {
  blockedCount,
  byClient,
  byDomain,
  byRcode,
  byResponseType,
  percent,
  rcodeColour,
  responseColour,
  type Tally,
} from './query-facts'
import styles from './Logs.module.css'

/*
THE PAGE ON SCREEN AT A GLANCE (deviation 20 in CONVENTIONS.md, 2026-11-06): four
cards over the results, counted from the entries of the page `logs/query` returned
(`query-facts.ts`). No call is added; they follow the page exactly as the table
does, every 2 s with Live Update.

  · Response Types  how many entries the page holds, of how many logs, split by
                    response type in the Dashboard's colours, and how many of them
                    were answered blocked.
  · RCODE           the same entries by response code.
  · Top Clients     the clients that asked most on this page.
  · Top Domains     the names asked most on this page.

A type, a code, a client or a name pressed sets that filter in the form and runs
Query from page 1, exactly as choosing it there and pressing Query would; pressing
the one the page was queried with empties the field and runs Query again. With
Live Update on, Query is off: pressing only sets the field, which the next turn of
the loop already sends. A value the form has no option for is drawn, not pressed.

Every word on these cards is OURS and part of deviation 20: the four titles, `of N
logs`, `Blocked` as a share, `on this page` and `N more`. The values are the
server's, the labels the dropdowns' own.
*/

/** The clients and names a card lists; the rest are counted in one line. */
const SHOWN = 4

export type Pick = 'responseType' | 'rcode' | 'clientIpAddress' | 'qname'

function Chips({
  label,
  rows,
  colour,
  applied,
  hot,
  setHot,
  onPick,
}: {
  label: string
  rows: Tally[]
  colour: (value: string) => string
  applied: string
  hot: string | null
  setHot: (key: string | null) => void
  onPick: (value: string) => void
}) {
  return (
    <div className={statStyles.types} role="group" aria-label={label}>
      {rows.map((r) => {
        const style = { '--sw': colour(r.value) } as CSSProperties
        const inner = (
          <>
            <span className={statStyles.typeLabel}>{r.label}</span>{' '}
            <span className={statStyles.typeCount}>{r.count}</span>
          </>
        )
        return r.known ? (
          <button
            key={r.value}
            type="button"
            className={statStyles.typeChip}
            style={style}
            aria-pressed={applied === r.value}
            data-hot={hot === r.value || undefined}
            onClick={() => onPick(applied === r.value ? '' : r.value)}
            {...hotEvents(r.value, setHot)}
          >
            {inner}
          </button>
        ) : (
          <span key={r.value} className={`${statStyles.typeChip} ${styles.chipStill}`} style={style}>
            {inner}
          </span>
        )
      })}
    </div>
  )
}

function Top({
  label,
  rows,
  applied,
  onPick,
  name = (v) => <span className={styles.topClip} title={v}>{v}</span>,
}: {
  label: string
  rows: Tally[]
  applied: string
  onPick: (value: string) => void
  /** How a value is written: a client is cut with an ellipsis (its whole value in
   *  the title), a name wraps at its dots (`ui/DomainName`). */
  name?: (value: string) => ReactNode
}) {
  const shown = rows.slice(0, SHOWN)
  const others = rows.length - shown.length
  const most = shown[0]?.count ?? 0
  return (
    <div className={statStyles.body}>
      <ul className={styles.top} aria-label={label}>
        {shown.map((r) => {
          const inner = (
            <>
              <span className={styles.topName}>{name(r.value)}</span>{' '}
              <span className={styles.topCount}>{r.count}</span>
              <span className={styles.topBar} aria-hidden="true">
                <span style={{ inlineSize: `${(r.count / most) * 100}%` }} />
              </span>
            </>
          )
          /* The root is asked as `''`, which is also the empty filter: it is drawn
             but cannot be pressed. */
          return (
            <li key={r.value}>
              {r.value === '' ? (
                <span className={styles.topPick}>{inner}</span>
              ) : (
                <button
                  type="button"
                  className={styles.topPick}
                  aria-pressed={applied === r.value}
                  onClick={() => onPick(applied === r.value ? '' : r.value)}
                >
                  {inner}
                </button>
              )}
            </li>
          )
        })}
      </ul>
      <div className={statStyles.caption}>
        {others > 0 ? `${others} more, on this page` : 'on this page'}
      </div>
    </div>
  )
}

export function QuerySummary({
  page,
  applied,
  onPick,
}: {
  page: QueryLogPage
  /** The filters the page on screen was queried with: the pressed chips. */
  applied: Record<Pick, string>
  onPick: (field: Pick, value: string) => void
}) {
  const [hotType, setHotType] = useState<string | null>(null)
  const [hotCode, setHotCode] = useState<string | null>(null)
  const { entries } = page
  const types = byResponseType(entries)
  const codes = byRcode(entries)
  const clients = byClient(entries)
  const domains = byDomain(entries)
  const blocked = blockedCount(entries)

  return (
    <div className={statStyles.grid}>
      <Card title="Response Types" colour="var(--ch-total)">
        <div className={statStyles.body}>
          <div className={statStyles.figure}>
            <Count value={entries.length} />
            <span className={statStyles.of}> of {page.totalEntries} logs</span>
          </div>
          <StackBar
            label={types.map((t) => `${t.label} ${t.count}`).join(', ')}
            parts={types.map((t) => ({ key: t.value, name: t.label, value: t.count, colour: responseColour(t.value) }))}
            hot={hotType}
            onHot={setHotType}
          />
          <Chips
            label="Entries by response type"
            rows={types}
            colour={responseColour}
            applied={applied.responseType}
            hot={hotType}
            setHot={setHotType}
            onPick={(v) => onPick('responseType', v)}
          />
          <dl className={statStyles.facts}>
            <div>
              <dt>Blocked</dt>
              <dd>
                <Count value={blocked} />{' '}
                <span className={styles.share}>{percent(blocked, entries.length)}</span>
              </dd>
            </div>
          </dl>
        </div>
      </Card>

      <Card title="RCODE" colour="var(--ch-ok)">
        <div className={statStyles.body}>
          <StackBar
            label={codes.map((c) => `${c.label} ${c.count}`).join(', ')}
            parts={codes.map((c) => ({ key: c.value, name: c.label, value: c.count, colour: rcodeColour(c.value) }))}
            hot={hotCode}
            onHot={setHotCode}
          />
          <Chips
            label="Entries by RCODE"
            rows={codes}
            colour={rcodeColour}
            applied={applied.rcode}
            hot={hotCode}
            setHot={setHotCode}
            onPick={(v) => onPick('rcode', v)}
          />
          <div className={statStyles.caption}>on this page</div>
        </div>
      </Card>

      {clients.length > 0 && (
        <Card title="Top Clients" colour="var(--ch-clients)">
          <Top
            label="Top Clients"
            rows={clients}
            applied={applied.clientIpAddress}
            onPick={(v) => onPick('clientIpAddress', v)}
          />
        </Card>
      )}

      {domains.length > 0 && (
        <Card title="Top Domains" colour="var(--ch-5)">
          <Top
            label="Top Domains"
            rows={domains}
            applied={applied.qname}
            onPick={(v) => onPick('qname', v)}
            name={(v) => <DomainName name={v === '' ? '.' : v} />}
          />
        </Card>
      )}
    </div>
  )
}
