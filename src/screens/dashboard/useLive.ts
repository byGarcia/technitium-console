import { useEffect, useMemo, useRef, useState } from 'react'
import { getMetrics, type DashboardStats } from '../../api/dashboard'
import { AGGREGATE, type ClusterNode } from '../../ui/ClusterNodeSelect'
import { advance, applyLive, prune, record, sum, zero, type LiveReading, type Sample } from './live'

/*
Reads the server's lifetime counters every 2 s, the cadence of the stock console's
Query Logs Live Update, and returns every reading that brought something, with its
time (`live.ts` decides which of them the server has not counted yet). This console's own code: deviation 5 in CONVENTIONS.md.

  · `targets`: the node names to read and add up; `''` is the server answering,
    read without `node`. The aggregate is the sum of every node, because
    `node=cluster` answers the local node only.
  · The readings are KEPT across reloads, bounded to the displayed hour:
    `applyLive` only lays over the server's data those after its last label.
    Emptying them at each reload dropped every query of the minute the server had
    not counted yet, and the figures fell back until the next reload.
  · Readings are chained, never overlapping. A tab out of sight reads nothing and
    forgets its baseline, so the time away is not poured into the current minute.
  · Three failed rounds in a row (an older server without the endpoint, one that
    changed it, a user without Dashboard: View) stop it until the next `epoch`
    (the Dashboard passes each `stats/get` result): the screen is then exactly
    what it is without it.
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
}): LiveReading[] {
  const [readings, setReadings] = useState<LiveReading[]>([])
  const key = targets.join('\n')
  /* The response it stopped on after three failures; a new one starts it again. */
  const [stoppedOn, setStoppedOn] = useState<{ epoch: unknown; token: string | null; key: string } | null>(null)
  const latest = useRef(epoch)
  latest.current = epoch
  const running = active && targets.length > 0 && !(stoppedOn != null &&
    stoppedOn.epoch === epoch && stoppedOn.token === token && stoppedOn.key === key)

  useEffect(() => {
    setReadings([])
    if (!running) return
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
        else setStoppedOn({ epoch: latest.current, token, key })
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
      const now = Date.now()
      setReadings((r) => prune(record(r, delta, now), now))
      schedule()
    }

    void poll()
    return () => {
      cancelled = true
      if (timer != null) window.clearTimeout(timer)
    }
  }, [token, key, running])

  return readings
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
 *  shown; anything else passes through untouched. */
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
  const readings = useLive({
    token,
    targets: lastHour ? liveTargets(node, nodes, clusterInitialised) : [],
    epoch: data,
    active: lastHour && active && data != null,
  })
  /* When this response arrived: the cut for a server whose labels are not instants. */
  const [arrived, setArrived] = useState(0)
  useEffect(() => setArrived(Date.now()), [data])
  return useMemo(
    () => (data != null && lastHour ? applyLive(data, readings, arrived) : data),
    [data, lastHour, readings, arrived],
  )
}
