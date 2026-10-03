import { createContext, useContext } from 'react'
import { AGGREGATE } from '../ui/ClusterNodeSelect'

/*
Upstream's two jumps from one screen to another, which the row menus of the
Dashboard, its Top Stats modal and Query Logs call:

  · `queryDnsServer(domain, type, node)` (dnsclient.js:231-257) fills DNS Client
    (this server, the domain, the type or "A", UDP, no EDNS Client Subnet, DNSSEC
    validation unchecked), switches to it and RUNS the query.
  · `showQueryLogs(domain, clientIp, node)` (logs.js:624-655) resets the Query
    Logs form, fills the domain and/or the client, switches to Logs › Query Logs
    and RUNS the query.

Both pick the target's cluster node only when they were given one and it is not
the aggregate; otherwise the target keeps the node it had, which here is the one
it starts on.

The screen that offers the jump asks through `useHandoff()`. The Shell owns the
switch: it moves to the section and hands the request to the target screen as a
prop, once. The target fills itself from it when it mounts and runs the query.
*/

export interface DnsClientRequest {
  domain: string
  type: string
  /** Empty: keep the node selector where it starts. */
  node: string
}

export interface QueryLogsRequest {
  domain: string | null
  clientIp: string | null
  /** Empty: keep the node selector where it starts. */
  node: string
}

export interface Handoff {
  queryDnsServer: (domain: string, type: string | null, node: string | null) => void
  showQueryLogs: (domain: string | null, clientIp: string | null, node: string | null) => void
}

export const HandoffContext = createContext<Handoff | null>(null)

/** `null` outside the Shell, where there is nowhere to go. */
export function useHandoff(): Handoff | null {
  return useContext(HandoffContext)
}

/* `if ((node != null) && (node != "cluster"))`, in both functions. */
export function targetNode(node: string | null): string {
  return node != null && node !== AGGREGATE ? node : ''
}
