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

The Overview passes its Blocked figure as `refreshOn`. A change refreshes the rows
without clearing the previous list, serializes overlapping reads, and retains the
last good list if a background read fails. Token, node and permission changes
invalidate the entire read context.
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
  /** Read the logs again when the Overview's Blocked figure changes. */
  refreshOn?: number
}) {
  const need = missing(permissions, 'Logs.canView')
  const [state, setState] = useState<Load>({ kind: 'loading' })
  const target = aggregate ? '' : node
  const requestRefresh = useRef<(() => void) | null>(null)
  const lastRefresh = useRef(refreshOn)

  useEffect(() => {
    if (need != null) return
    let live = true
    // These belong to this token/node only. A late answer cannot start a queued
    // refresh for another context or after permission is revoked.
    let busy = true
    let again = false
    let app: { name: string; classPath: string } | null = null
    lastRefresh.current = refreshOn
    setState({ kind: 'loading' })

    async function refresh() {
      if (!live || app == null) return
      if (busy) {
        again = true
        return
      }
      busy = true
      const r = await recentBlocked(token, app, target)
      if (!live) return
      if (r.kind === 'ok') setState({ kind: 'ok', ...r.data })
      busy = false
      if (again) {
        again = false
        void refresh()
      }
    }

    const request = () => {
      if (!live) return
      // A figure can change while the logging app or the first rows are loading.
      if (busy) again = true
      else void refresh()
    }
    requestRefresh.current = request

    void (async () => {
      const a = await listApps(token)
      if (!live) return
      if (a.kind !== 'ok') {
        busy = false
        setState({ kind: 'failed', text: noticeFromFailure(a).text })
        return
      }
      const found = appsWithQueryLogs(a.data.response.apps ?? [])[0]
      if (found == null) {
        busy = false
        setState({ kind: 'no-app' })
        return
      }
      app = { name: found.name, classPath: found.classPaths[0] }
      const r = await recentBlocked(token, app, target)
      if (!live) return
      setState(r.kind === 'ok' ? { kind: 'ok', ...r.data } : { kind: 'failed', text: noticeFromFailure(r).text })
      busy = false
      if (again) {
        again = false
        void refresh()
      }
    })()
    return () => {
      live = false
      if (requestRefresh.current === request) requestRefresh.current = null
    }
    // A new figure refreshes the existing context in the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, target, need])

  useEffect(() => {
    if (Object.is(lastRefresh.current, refreshOn)) return
    lastRefresh.current = refreshOn
    if (refreshOn !== undefined) requestRefresh.current?.()
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
