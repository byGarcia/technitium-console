import { Empty, Loading } from '../../ui/Empty'
import { RouteLink } from '../../ui/RouteLink'
import { LockedBody } from '../blocking/Locked'
import { useLoggingApp } from '../blocking/logging-app'
import { useQuerySample } from '../clients/query-sample'
import type { QueryLogEntry } from '../../api/logs'

/*
The Dashboard's one read of the query log (deviations 28 and 29): the newest 1,000
entries through the first query logs app, again each time the statistics answer,
shared by Response Time and How a query is resolved so the log is read once. Nothing
is read without `Logs.canView`.
*/
export type DashboardSample =
  | { kind: 'locked' }
  | { kind: 'noapp' }
  | { kind: 'loading' }
  | { kind: 'failed' }
  | { kind: 'ok'; entries: QueryLogEntry[] }

export function useDashboardSample(token: string | null, node: string, canView: boolean, refreshOn: unknown): DashboardSample {
  const app = useLoggingApp(token, canView)
  const sample = useQuerySample({ token, app, node, limit: 1000, refreshOn, enabled: canView })
  if (!canView) return { kind: 'locked' }
  if (app.kind === 'none') return { kind: 'noapp' }
  if (sample.kind === 'none') return { kind: 'noapp' }
  return sample
}

/** What a card says when the sample has no entries to draw. */
export function SampleState({ sample }: { sample: Exclude<DashboardSample, { kind: 'ok' }> }) {
  switch (sample.kind) {
    case 'locked':
      return <LockedBody need="Logs.canView" />
    case 'noapp':
      return (
        <Empty compact>
          Please install the &apos;Query Logs (Sqlite)&apos; DNS App or any other DNS app that supports query logging
          feature from the <RouteLink to={{ section: 'apps', sub: null }}>Apps</RouteLink> section.
        </Empty>
      )
    case 'loading':
      return <Loading compact />
    default:
      return <Empty compact>Could not load this data.</Empty>
  }
}
