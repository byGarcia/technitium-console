import { useEffect, useId, useRef, useState } from 'react'
import { recentBlocked } from '../../api/blocking'
import type { TopEntry } from '../../api/dashboard'
import type { QueryLogEntry } from '../../api/logs'
import { useHandoff } from '../../app/handoff'
import { tokenForLabel } from '../dashboard/palette'
import { num2, percentage } from '../dashboard/metrics'
import { Panel, Body } from '../../ui/Panel'
import { Menu } from '../../ui/Menu'
import { Icon } from '../../ui/Icon'
import { Empty, Failure, Loading } from '../../ui/Empty'
import { countByClient, countByType, SAMPLE } from './blocked-sample'
import type { LoggingApp } from './logging-app'
import dash from '../dashboard/Dashboard.module.css'
import styles from './Overview.module.css'

/*
"Blocked by client": which clients got the most blocked answers lately, and below
them which query types were blocked. OURS as a card, its counts and its words; the
data is `logs/query` through the query logs app, the call Recently Blocked makes, with
the three blocked classes merged the same way (`recentBlocked`), asking for the newest
`SAMPLE` (1,000) instead of ten. It is NOT the period of the page: the log has no
counts per period, so the card counts a sample and says which one, `In the last N
blocked queries`, beside its title. Logs belong to ONE node: with the cluster
aggregate it reads the node the console is connected to and says `on <node>`, as
Recently Blocked does.

The rows are drawn as the Dashboard's top lists are (`dashboard/Panels.tsx`, `Top`):
rank, the address with the name the server's Top Clients gives it when it is there,
the count and a bar in the Blocked colour. A row's menu has upstream's `Show Query
Logs` (the Dashboard's Top Clients menu, main.js:2796), which opens Query Logs for
that client, and filtered by its response type when all its counted queries share
one: Query Logs filters by one response type, and the three blocked classes are
three. The types are a stacked bar with its legend, as the Dashboard's Query Types
(`dashboard/Breakdown.tsx`), in the same colours.

It reads again whenever the Overview's statistics answer again (`refreshOn`): with
each period, node and minute reload, never with the live figures every 2 seconds.
A read that fails after a good one keeps the good one.

Its words, all OURS: `Blocked by client`, `Blocked by type`, `In the last N blocked
queries`, `on <node>`, `No blocked queries.` (Recently Blocked's) and `Some blocked
queries could not be read.` (Recently Blocked's), `Actions for <client>`, and the
bars' `<client>: N blocked`. Without a query logs app the Overview does not draw the
card at all: Recently Blocked says why, once.
*/

/** How many clients the card lists: the Dashboard's top lists show five. */
const ROWS = 5

type Sample =
  | { kind: 'loading' }
  | { kind: 'failed' }
  | { kind: 'ok'; entries: QueryLogEntry[]; partial: boolean }

export function BlockedBy({
  token,
  app,
  node,
  aggregate,
  serverDomain,
  names,
  refreshOn,
}: {
  token: string | null
  /** The query logs app (`useLoggingApp`). */
  app: LoggingApp
  /** The Overview's node selector. */
  node: string
  /** The cluster aggregate is chosen: read the connected node instead. */
  aggregate: boolean
  serverDomain: string | undefined
  /** The period's Top Clients, for the names of the addresses. */
  names: readonly TopEntry[]
  /** Read again when this changes: the Overview's statistics answer. */
  refreshOn: unknown
}) {
  const [sample, setSample] = useState<Sample>({ kind: 'loading' })
  const target = aggregate ? '' : node
  const ready = app.kind === 'ok' ? app.app : null
  /* Numbers the reads, so an older answer arriving last cannot replace a newer one. */
  const asked = useRef(0)
  /* The context the rows on screen answer: a new token, node or app starts empty. */
  const context = `${token ?? ''}|${target}|${ready?.name ?? ''}|${ready?.classPath ?? ''}`
  const shown = useRef('')

  useEffect(() => {
    if (ready == null) return
    const mine = ++asked.current
    if (shown.current !== context) {
      shown.current = context
      setSample({ kind: 'loading' })
    }
    void recentBlocked(token, ready, target, SAMPLE).then((r) => {
      if (mine !== asked.current) return
      if (r.kind === 'ok') setSample({ kind: 'ok', ...r.data })
      else setSample((prev) => (prev.kind === 'ok' ? prev : { kind: 'failed' }))
    })
    // `ready` is read through `context`, which names it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [context, refreshOn])

  const where = aggregate && serverDomain != null ? ` on ${serverDomain}` : ''
  const count = sample.kind === 'ok' ? sample.entries.length : 0
  const basis = count > 0
    ? `In the last ${count === 1 ? 'blocked query' : `${count.toLocaleString()} blocked queries`}${where}`
    : null

  return (
    <Panel
      title="Blocked by client"
      className={styles.byCard}
      actions={basis != null ? <span className={styles.basis}>{basis}</span> : undefined}
    >
      <Body className={styles.byBody}>
        {(app.kind === 'loading' || (app.kind === 'ok' && sample.kind === 'loading')) && <Loading compact />}
        {(app.kind === 'failed' || sample.kind === 'failed') && <Failure>Could not load this data.</Failure>}
        {app.kind === 'ok' && sample.kind === 'ok' && (
          <>
            {sample.partial && (
              <div className={styles.partialLine}>
                <Icon name="warning" size={14} />
                Some blocked queries could not be read.
              </div>
            )}
            {count === 0 ? (
              <Empty compact>No blocked queries.</Empty>
            ) : (
              <Counts entries={sample.entries} names={names} node={node} />
            )}
          </>
        )}
      </Body>
    </Panel>
  )
}

function Counts({ entries, names, node }: { entries: QueryLogEntry[]; names: readonly TopEntry[]; node: string }) {
  const handoff = useHandoff()
  const clients = countByClient(entries, names).slice(0, ROWS)
  const types = countByType(entries)
  const largest = clients[0]?.count ?? 0
  const typesTotal = types.reduce((n, t) => n + t.count, 0)
  const typesId = useId()
  return (
    <>
      <div className={styles.clients} style={{ ['--bar' as string]: 'var(--ch-block)' }}>
        {clients.map((c, i) => (
          <div className={dash.toprow} key={c.ip}>
            <span className={dash.topRank}>{i + 1}</span>
            <span className={dash.n} title={c.name != null ? `${c.ip} ${c.name}` : c.ip}>
              <span className={`${dash.topLabel} ${styles.mono}`}>{c.ip}</span>
              {c.name != null && <span className={dash.topDomain}>{c.name}</span>}
            </span>
            <span className={dash.c}>{num2(c.count)}</span>
            {handoff != null ? (
              <Menu label={`Actions for ${c.ip}`} quiet>
                {(close) => (
                  <button
                    type="button"
                    onClick={() => {
                      close()
                      handoff.showQueryLogs(
                        null,
                        c.ip,
                        node,
                        c.responseType != null ? { responseType: c.responseType } : undefined,
                      )
                    }}
                  >
                    Show Query Logs
                  </button>
                )}
              </Menu>
            ) : (
              <span />
            )}
            <span className={dash.topBar} role="img" aria-label={`${c.ip}: ${num2(c.count)} blocked`}>
              <i style={{ width: `${largest > 0 ? (c.count / largest) * 100 : 0}%` }} />
            </span>
          </div>
        ))}
      </div>
      {types.length > 0 && (
        <section className={styles.byType} aria-labelledby={typesId}>
          <h3 className={dash.partTitle} id={typesId}>Blocked by type</h3>
          <div className={dash.stack}>
            {types.map((t, i) => (
              <i
                key={t.type}
                className={dash.segment}
                title={`${t.type}: ${num2(t.count)} (${percentage(t.count, typesTotal)})`}
                style={{ flexGrow: t.count, background: `var(${tokenForLabel(t.type, i)})` }}
                aria-hidden="true"
              />
            ))}
          </div>
          <div className={`${dash.stackLegend} ${dash.legend}`}>
            {types.map((t, i) => (
              <span key={t.type} className={`${dash.lg} ${dash.lgStill}`} title={`${num2(t.count)} blocked`}>
                <i style={{ background: `var(${tokenForLabel(t.type, i)})` }} />
                {t.type} <b>{percentage(t.count, typesTotal)}</b>
              </span>
            ))}
          </div>
        </section>
      )}
    </>
  )
}
