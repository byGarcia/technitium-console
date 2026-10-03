import { useEffect, useRef, useState } from 'react'
import { listApps } from '../../api/apps'
import { recentBlocked } from '../../api/blocking'
import type { QueryLogEntry } from '../../api/logs'
import { appsWithQueryLogs } from '../logs/QueryLogs'
import { RouteLink } from '../../ui/RouteLink'
import { Panel, Body } from '../../ui/Panel'
import { Table } from '../../ui/Table'
import { Chip } from '../../ui/Tag'
import { Icon } from '../../ui/Icon'
import { Empty, Loading, Failure } from '../../ui/Empty'
import { dateTime } from '../../lib/dates'
import { noticeFromFailure } from '../../lib/notice'
import { Locked } from './Locked'
import { missing, type Permissions } from './permissions'
import shared from './Blocking.module.css'
import styles from './Overview.module.css'

/*
The latest blocked queries. OURS as a panel; the data is `logs/query`, merged across
the three blocked classes (`recentBlocked`). Logs belong to ONE node: with the
cluster aggregate chosen it reads the node the console is connected to, and the
header says which, so nobody reads one node's logs as the cluster's.

The app is the first one that serves query logs, as `QueryLogs.tsx` resolves it.
Without one, the sentence is upstream's (QueryLogs.tsx, logs.js:391) split only to
link "Apps"; the empty-state title is ours. Ours too: the panel title `Recently
Blocked`, `on <node>`, `Open Query Logs`, the columns `Time`, `Client`, `Domain` and
`Type` (upstream's Query Logs table calls them otherwise), `No blocked queries.` and
`Some blocked queries could not be read.`

It reads again whenever `refreshOn` changes: the Overview passes the Blocked figure it
shows, which moves in real time on Last Hour, so a new blocked query shows up here as
it shows up in the count. The query logs app writes the row at once (measured against
v15.6.0: five blocked queries were five rows on the very next read). A refresh keeps
the rows on screen while it travels, never runs two at a time, and a failed one
leaves the last good list in place.
*/

type Load =
  | { kind: 'loading' }
  | { kind: 'no-app' }
  | { kind: 'failed'; text: string }
  | { kind: 'ok'; entries: QueryLogEntry[]; partial: boolean }

export function RecentBlocked({
  token,
  permissions,
  node,
  aggregate,
  serverDomain,
  refreshOn,
}: {
  token: string | null
  permissions: Permissions
  /** The Overview's node selector. */
  node: string
  /** The cluster aggregate is chosen: read the connected node instead. */
  aggregate: boolean
  /** The connected node's name, said in the header with the aggregate. */
  serverDomain: string | undefined
  /** A new value reads the list again (the Overview's Blocked figure). */
  refreshOn?: unknown
}) {
  const need = missing(permissions, 'Logs.canView')
  const [state, setState] = useState<Load>({ kind: 'loading' })
  const target = aggregate ? '' : node
  /* The app the first read found, for the refreshes; `null` until then or without one. */
  const app = useRef<{ name: string; classPath: string } | null>(null)
  /* Numbers the first reads, so a refresh started for a previous node is dropped. */
  const round = useRef(0)
  const busy = useRef(false)
  const again = useRef(false)

  useEffect(() => {
    if (need != null) return
    let live = true
    const mine = ++round.current
    app.current = null
    setState({ kind: 'loading' })
    void (async () => {
      const a = await listApps(token)
      if (!live) return
      if (a.kind !== 'ok') {
        setState({ kind: 'failed', text: noticeFromFailure(a).text })
        return
      }
      const found = appsWithQueryLogs(a.data.response.apps ?? [])[0]
      if (found == null) {
        setState({ kind: 'no-app' })
        return
      }
      const which = { name: found.name, classPath: found.classPaths[0] }
      const r = await recentBlocked(token, which, target)
      if (!live) return
      if (mine === round.current) app.current = which
      setState(r.kind === 'ok' ? { kind: 'ok', ...r.data } : { kind: 'failed', text: noticeFromFailure(r).text })
    })()
    return () => {
      live = false
    }
  }, [token, target, need])

  useEffect(() => {
    if (need != null || refreshOn === undefined) return
    async function refresh() {
      const which = app.current
      if (which == null) return
      if (busy.current) {
        again.current = true
        return
      }
      busy.current = true
      const mine = round.current
      const r = await recentBlocked(token, which, target)
      busy.current = false
      if (mine === round.current && r.kind === 'ok') setState({ kind: 'ok', ...r.data })
      if (again.current) {
        again.current = false
        void refresh()
      }
    }
    void refresh()
    // Only a new figure reads again; the node and the token start over above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshOn])

  if (need != null) return <Locked title="Recently Blocked" need={need} />

  const title = (
    <>
      Recently Blocked
      {/* The space goes OUTSIDE the span: inside it, the accessible name is built
          from the span's trimmed text and reads "Recently Blockedon …". */}
      {aggregate && serverDomain != null && (
        <>
          {' '}
          <span className={styles.where}>on {serverDomain}</span>
        </>
      )}
    </>
  )

  return (
    <Panel
      title={title}
      actions={<RouteLink to={{ section: 'logs', sub: 'Query Logs' }}>Open Query Logs</RouteLink>}
    >
      {state.kind === 'loading' && (
        <Body>
          <Loading compact />
        </Body>
      )}
      {state.kind === 'failed' && (
        <Body>
          <Failure>{state.text}</Failure>
        </Body>
      )}
      {state.kind === 'no-app' && (
        <Body>
          <Empty title="No query logging app">
            Please install the &apos;Query Logs (Sqlite)&apos; DNS App or any other DNS app that supports
            query logging feature from the <RouteLink to={{ section: 'apps', sub: null }}>Apps</RouteLink> section.
          </Empty>
        </Body>
      )}
      {state.kind === 'ok' && (
        <>
          {state.partial && (
            <div className={styles.partial}>
              <Icon name="warning" size={14} />
              Some blocked queries could not be read.
            </div>
          )}
          <Table
            header={
              <>
                <th>Time</th>
                <th>Client</th>
                <th>Domain</th>
                <th>Type</th>
              </>
            }
            isEmpty={state.entries.length === 0}
            emptyText="No blocked queries."
            columns={4}
            className={shared.inPanel}
          >
            {state.entries.map((e) => (
              <tr key={`${e.responseType}:${e.rowNumber}:${e.timestamp}`}>
                <td className={styles.time}>{dateTime(e.timestamp)}</td>
                <td className={styles.mono}>{e.clientIpAddress}</td>
                <td className={styles.name}>{e.qname ?? '.'}</td>
                <td>{e.qtype != null && <Chip>{e.qtype}</Chip>}</td>
              </tr>
            ))}
          </Table>
        </>
      )}
    </Panel>
  )
}
