import { useEffect, useRef, useState } from 'react'
import { newestQueries, type QueryLogEntry } from '../../api/logs'
import type { LoggingApp } from '../blocking/logging-app'

/*
The Clients page's reads of the log (CONVENTIONS.md, deviation 25): the newest
queries, every response type, of every client (the page's sample) or of one (a
row's details). The query logs app is the one Blocking › Overview resolves
(`useLoggingApp`), and the read behaves as its Blocked by client card's does
(`blocking/BlockedBy.tsx`): it reads again whenever `refreshOn` changes (the page's
statistics answered again), never two answers out of order, and a read that fails
after a good one keeps the good one. A new token, node, client or app starts empty.
*/
export type QuerySample =
  /** No query logs app, or the read is not allowed: nothing is asked. */
  | { kind: 'none' }
  | { kind: 'loading' }
  | { kind: 'failed' }
  | { kind: 'ok'; entries: QueryLogEntry[] }

export function useQuerySample({
  token,
  app,
  node,
  clientIp = '',
  limit,
  refreshOn,
  enabled = true,
}: {
  token: string | null
  app: LoggingApp
  /** The node whose log is read; empty for the one the console is connected to. */
  node: string
  clientIp?: string
  limit: number
  refreshOn: unknown
  enabled?: boolean
}): QuerySample {
  const [sample, setSample] = useState<QuerySample>({ kind: 'loading' })
  const ready = enabled && app.kind === 'ok' ? app.app : null
  const asked = useRef(0)
  const context = `${token ?? ''}|${node}|${clientIp}|${limit}|${ready?.name ?? ''}|${ready?.classPath ?? ''}`
  const shown = useRef('')

  useEffect(() => {
    if (ready == null) return
    const mine = ++asked.current
    if (shown.current !== context) {
      shown.current = context
      setSample({ kind: 'loading' })
    }
    void newestQueries(token, ready, { node, limit, clientIpAddress: clientIp }).then((r) => {
      if (mine !== asked.current) return
      if (r.kind === 'ok') setSample({ kind: 'ok', entries: r.data })
      else setSample((prev) => (prev.kind === 'ok' ? prev : { kind: 'failed' }))
    })
    // `ready`, `node`, `limit` and `clientIp` are read through `context`, which names them.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [context, refreshOn])

  if (!enabled || app.kind === 'none') return { kind: 'none' }
  if (app.kind === 'loading') return { kind: 'loading' }
  if (app.kind === 'failed') return { kind: 'failed' }
  return sample
}
