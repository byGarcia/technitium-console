import { createContext, useContext } from 'react'
import { AGGREGATE } from '../ui/ClusterNodeSelect'

/*
Upstream's two jumps from one screen to another, which the row menus of the
Dashboard, its Top Stats modal and Query Logs call:

  · `queryDnsServer(domain, type, node)` (dnsclient.js:231-257) fills DNS Client
    (this server, the domain, the type or "A", UDP, no EDNS Client Subnet, DNSSEC
    validation unchecked), switches to it and RUNS the query.
  · `showQueryLogs(domain, clientIp, node, rcode, responseType)` (logs.js:629-663)
    resets the Query Logs form, fills the domain and/or the client, and since
    v15.6.2 the response code and/or the response type (the Dashboard's count
    cards, logs.js:21-24), switches to Logs › Query Logs and RUNS the query.

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

/*
The form's fields a jump fills besides the domain and the client, each by its name in
that form and written in the form's own format (`From`/`To` are `datetime-local`
values in the browser's zone). `rcode` and `responseType` are upstream's, from the
Dashboard's count cards. The rest is what the Dashboard's charts add (deviation 7 in
CONVENTIONS.md, this console's own): the time window of a point of the Queries chart,
and the value of a slice or a bar, over the period. Upstream's jump never carries a
time window, a protocol or a query type.
*/
export interface QueryLogsFilters {
  start?: string
  end?: string
  responseType?: string
  rcode?: string
  protocol?: string
  qtype?: string
}

export interface QueryLogsRequest {
  domain: string | null
  clientIp: string | null
  /** Empty: keep the node selector where it starts. */
  node: string
  filters?: QueryLogsFilters
}

export interface Handoff {
  queryDnsServer: (domain: string, type: string | null, node: string | null) => void
  showQueryLogs: (
    domain: string | null,
    clientIp: string | null,
    node: string | null,
    filters?: QueryLogsFilters,
  ) => void
  /** Whether Query Logs is there to land on. The row menus offer the jump anyway,
   *  as upstream does, and it does nothing; a chart only invites the click when it
   *  will go somewhere. Absent means it is. */
  canShowQueryLogs?: boolean
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
