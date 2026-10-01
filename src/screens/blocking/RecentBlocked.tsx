import { useEffect, useState } from 'react'
import { listApps } from '../../api/apps'
import { recentBlocked } from '../../api/blocking'
import type { QueryLogEntry } from '../../api/logs'
import { appsWithQueryLogs } from '../logs/QueryLogs'
import { toTrail } from '../../app/route'
import { Panel, Body } from '../../ui/Panel'
import { Table } from '../../ui/Table'
import { Chip } from '../../ui/Tag'
import { Icon } from '../../ui/Icon'
import { Empty, Loading, Failure } from '../../ui/Empty'
import { dateTime } from '../../lib/dates'
import { noticeFromFailure } from '../../lib/notice'
import { Locked } from './Locked'
import { missing, type Permissions } from './permissions'
import styles from './Overview.module.css'

/*
The latest blocked queries. OURS as a panel; the data is `logs/query`, merged across
the three blocked classes (`recentBlocked`). Logs belong to ONE node: with the
cluster aggregate chosen it reads the node the console is connected to, and the
header says which, so nobody reads one node's logs as the cluster's.

The app is the first one that serves query logs, as `QueryLogs.tsx` resolves it.
Without one, the sentence is upstream's (QueryLogs.tsx, logs.js:391) split only to
link "Apps"; the empty-state title is ours.
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
}: {
  token: string | null
  permissions: Permissions
  /** The Overview's node selector. */
  node: string
  /** The cluster aggregate is chosen: read the connected node instead. */
  aggregate: boolean
  /** The connected node's name, said in the header with the aggregate. */
  serverDomain: string | undefined
}) {
  const need = missing(permissions, 'Logs.canView')
  const [state, setState] = useState<Load>({ kind: 'loading' })
  const target = aggregate ? '' : node

  useEffect(() => {
    if (need != null) return
    let live = true
    setState({ kind: 'loading' })
    void (async () => {
      const a = await listApps(token)
      if (!live) return
      if (a.kind !== 'ok') {
        setState({ kind: 'failed', text: noticeFromFailure(a).text })
        return
      }
      const app = appsWithQueryLogs(a.data.response.apps ?? [])[0]
      if (app == null) {
        setState({ kind: 'no-app' })
        return
      }
      const r = await recentBlocked(token, { name: app.name, classPath: app.classPaths[0] }, target)
      if (!live) return
      setState(r.kind === 'ok' ? { kind: 'ok', ...r.data } : { kind: 'failed', text: noticeFromFailure(r).text })
    })()
    return () => {
      live = false
    }
  }, [token, target, need])

  if (need != null) return <Locked title="Recently Blocked" need={need} />

  const title = (
    <>
      Recently Blocked
      {aggregate && serverDomain != null && <span className={styles.where}> on {serverDomain}</span>}
    </>
  )

  return (
    <Panel
      title={title}
      actions={<a href={toTrail({ section: 'logs', sub: 'Query Logs' })}>Open Query Logs</a>}
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
            query logging feature from the <a href={toTrail({ section: 'apps', sub: null })}>Apps</a> section.
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
