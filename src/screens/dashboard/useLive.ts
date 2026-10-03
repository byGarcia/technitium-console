import { useEffect, useMemo, useState } from 'react'
import { getMetrics, type DashboardStats } from '../../api/dashboard'
import { AGGREGATE, type ClusterNode } from '../../ui/ClusterNodeSelect'
import { advance, applyLive, record, sum, zero, type LiveMinute, type Sample } from './live'

/*
Reads the server's lifetime counters every 2 s, the cadence of the stock console's
Query Logs Live Update, and returns what happened since the last baseline, per
minute (`live.ts`). This console's own code: deviation 5 in CONVENTIONS.md.

  · `targets`: the node names to read and add up; `''` is the server answering,
    read without `node`. The aggregate is the sum of every node, because
    `node=cluster` answers the local node only.
  · `epoch`: a new value (the Dashboard passes each `stats/get` result) empties
    the minutes and takes a new baseline, since that result already holds what
    came before it.
  · Readings are chained, never overlapping. A tab out of sight reads nothing and
    forgets its baseline, so the time away is not poured into the current minute.
  · Three failed rounds in a row (an older server without the endpoint, one that
    changed it, a user without Dashboard: View) stop it until the next epoch: the
    Dashboard is then exactly the stock console's.
*/
export const LIVE_POLL_MS = 2_000
export const LIVE_MAX_FAILURES = 3

export function useLive({
  token,
  targets,
  epoch,
  active,
}: {
  token: string | null
  targets: string[]
  epoch: unknown
  active: boolean
}): LiveMinute[] {
  const [minutes, setMinutes] = useState<LiveMinute[]>([])
  const key = targets.join('\n')

  useEffect(() => {
    setMinutes([])
    if (!active) return
    let cancelled = false
    let timer: number | undefined
    let failures = 0
    const samples = new Map<string, Sample>()
    const nodes = key.split('\n')

    const schedule = () => {
      timer = window.setTimeout(() => void poll(), LIVE_POLL_MS)
    }

    async function poll() {
      if (document.hidden) {
        samples.clear()
        schedule()
        return
      }
      const results = await Promise.all(nodes.map((n) => getMetrics(token, n === '' ? undefined : n)))
      if (cancelled) return
      if (results.some((r) => r.kind !== 'ok')) {
        failures += 1
        if (failures < LIVE_MAX_FAILURES) schedule()
        return
      }
      failures = 0
      let delta = zero()
      results.forEach((r, i) => {
        if (r.kind !== 'ok') return
        const step = advance(samples.get(nodes[i]), r.data)
        samples.set(nodes[i], step.sample)
        delta = sum(delta, step.delta)
      })
      setMinutes((m) => record(m, delta, Date.now()))
      schedule()
    }

    void poll()
    return () => {
      cancelled = true
      if (timer != null) window.clearTimeout(timer)
    }
  }, [token, key, epoch, active])

  return minutes
}

/** Last Hour's reload, as upstream's (main.js:258-262). Shared by the Dashboard and
 *  Blocking › Overview, which read the same `stats/get`. */
export const LAST_HOUR_REFRESH_MS = 60_000

/** Which nodes to read: every node by name for the aggregate of a cluster, else the
 *  one chosen, `''` being the server answering. */
export function liveTargets(node: string, nodes: ClusterNode[], clusterInitialised: boolean): string[] {
  if (clusterInitialised && node === AGGREGATE) return nodes.map((n) => n.name)
  return [node === AGGREGATE ? '' : node]
}

/** The screen's `stats/get` with the live figures laid over it while Last Hour is
 *  shown; anything else passes through untouched. Every new `data` is a new
 *  baseline. */
export function useLiveView({
  token,
  lastHour,
  node,
  nodes,
  clusterInitialised,
  data,
  active,
}: {
  token: string | null
  lastHour: boolean
  node: string
  nodes: ClusterNode[]
  clusterInitialised: boolean
  data: DashboardStats | null
  active: boolean
}): DashboardStats | null {
  const minutes = useLive({
    token,
    targets: lastHour ? liveTargets(node, nodes, clusterInitialised) : [],
    epoch: data,
    active: lastHour && active && data != null,
  })
  return useMemo(
    () => (data != null && lastHour ? applyLive(data, minutes) : data),
    [data, lastHour, minutes],
  )
}
