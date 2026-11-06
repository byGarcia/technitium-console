import { useEffect, useState } from 'react'
import { listApps } from '../../api/apps'
import { appsWithQueryLogs } from '../logs/QueryLogs'
import { noticeFromFailure } from '../../lib/notice'

/*
Which app serves query logs, as `QueryLogs.tsx` resolves it (the first one), for the
Overview's Blocked by client (`BlockedBy.tsx`). Read once per token through
`apps/list`, the call Recently Blocked makes for the same reason; nothing is read
without `enabled` (the session lacks `Logs.canView`). A new token keeps the last
answer until its own arrives: which apps are installed does not change with it.
*/
export type LoggingApp =
  | { kind: 'loading' }
  | { kind: 'none' }
  | { kind: 'failed'; text: string }
  | { kind: 'ok'; app: { name: string; classPath: string } }

export function useLoggingApp(token: string | null, enabled: boolean): LoggingApp {
  const [state, setState] = useState<LoggingApp>({ kind: 'loading' })
  useEffect(() => {
    if (!enabled) return
    let live = true
    void listApps(token).then((a) => {
      if (!live) return
      if (a.kind !== 'ok') {
        setState({ kind: 'failed', text: noticeFromFailure(a).text })
        return
      }
      const found = appsWithQueryLogs(a.data.response.apps ?? [])[0]
      setState(found == null ? { kind: 'none' } : { kind: 'ok', app: { name: found.name, classPath: found.classPaths[0] } })
    })
    return () => {
      live = false
    }
  }, [token, enabled])
  return state
}
