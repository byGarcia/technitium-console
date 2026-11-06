import { readSettings } from '../../api/settings'
import { getDashboardStats } from '../../api/dashboard'
import type { ClusterNode } from '../../ui/ClusterNodeSelect'
import { noticeFromFailure } from '../../lib/notice'

/*
BLOCK LISTS ACROSS NODES (deviation 39 in CONVENTIONS.md, 2026-11-06). The list
URLs are one cluster-wide setting, but each node fetches and keeps its own copy of the lists, so
how many domains it holds and when it downloads them are each node's own. This
reads, once per node and with that node's `node`, the two calls the Lists tab
already makes for the connected node:

  · `dashboard/stats/get` (Last Hour, as the strip reads it) for `blockListZones`,
    only with `Dashboard: View`;
  · `settings/get` for `blockListNextUpdatedOn` and `blockListUpdateIntervalHours`,
    the two values the strip's Next update cell and its `Last updated` come from
    (deviation 32).

A read that fails keeps the server's message; the row says it once. An answer with
no count in it (`stats` missing, as a node mid-restart can send) is a failed count
and not a thrown read, which would have left the whole card loading: its words,
OURS, are `NO_COUNT`.
*/

export const NO_COUNT = 'The answer carried no Block List Domains.'

export type Read<T> = { kind: 'ok'; value: T } | { kind: 'failed'; message: string }

export interface NodeLists {
  node: string
  /** `null` when it was not asked for: no `Dashboard: View`. */
  domains: Read<number> | null
  schedule: Read<{ next: string | null; interval: number | null }>
}

export function readListsOnNodes(
  token: string | null,
  nodes: readonly ClusterNode[],
  withCounts: boolean,
): Promise<NodeLists[]> {
  return Promise.all(
    nodes.map(async (n): Promise<NodeLists> => {
      const [settings, stats] = await Promise.all([
        readSettings(token, n.name),
        withCounts ? getDashboardStats(token, 'LastHour', undefined, n.name) : Promise.resolve(null),
      ])
      return {
        node: n.name,
        domains:
          stats == null
            ? null
            : stats.kind !== 'ok'
              ? { kind: 'failed', message: noticeFromFailure(stats).text }
              : typeof stats.data.stats?.blockListZones === 'number'
                ? { kind: 'ok', value: stats.data.stats.blockListZones }
                : { kind: 'failed', message: NO_COUNT },
        schedule:
          settings.kind === 'ok'
            ? {
                kind: 'ok',
                value: {
                  // Omitted when null (CONVENTIONS.md): absent is "Not Scheduled".
                  next: settings.data.blockListNextUpdatedOn ?? null,
                  interval: settings.data.blockListUpdateIntervalHours ?? null,
                },
              }
            : { kind: 'failed', message: noticeFromFailure(settings).text },
      }
    }),
  )
}

/** The node's failure, said once: the whole row when neither read answered. */
export function nodeFailure(n: NodeLists): string | null {
  if (n.schedule.kind !== 'failed') return null
  if (n.domains != null && n.domains.kind !== 'failed') return null
  return n.schedule.message
}
