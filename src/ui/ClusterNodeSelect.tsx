import { Select } from './Select'
import { Field } from './Field'

/*
Which cluster node a screen is looking at.

Upstream puts one of these on ten surfaces (`cluster.js`,
`updateAllClusterNodeDropDowns`) and this console had it on none of them: spec
F10. It is not decoration — the server proxies the whole request to the chosen
node (`DnsWebService.cs:2378`), so without it a console can only ever show the
node it happens to be served from.

Three rules, all upstream's:

  · It exists only when the server says `clusterInitialized`. On a single-server
    install there is nothing to choose and nothing is drawn.
  · Two of the ten —Dashboard and Settings— also offer **Cluster**, the aggregate,
    and it is their default. The other eight start on this server.
  · A node is listed as `name (type)`, with the type lowercased.
*/

export interface ClusterNode {
  name: string
  type: string
}

/** Upstream's word for the aggregate. The API client does not send it. */
export const AGGREGATE = 'cluster'

export function nodeOptions(
  nodes: ClusterNode[],
  { aggregate = false }: { aggregate?: boolean } = {},
): { value: string; label: string }[] {
  const out = aggregate ? [{ value: AGGREGATE, label: 'Cluster' }] : []
  for (const n of nodes) out.push({ value: n.name, label: `${n.name} (${n.type.toLowerCase()})` })
  return out
}

/** What a screen shows before anyone chooses: the aggregate where there is one,
 *  and this server everywhere else. */
export function defaultNode(aggregate: boolean, thisServer: string): string {
  return aggregate ? AGGREGATE : thisServer
}

export function ClusterNodeSelect({
  nodes,
  initialised,
  aggregate = false,
  value,
  onChange,
  label = 'Node',
}: {
  nodes: ClusterNode[]
  initialised: boolean
  aggregate?: boolean
  value: string
  onChange: (node: string) => void
  label?: string
}) {
  if (!initialised) return null

  return (
    <Field label={label}>
      {(id) => (
        <Select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
          {nodeOptions(nodes, { aggregate }).map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
      )}
    </Field>
  )
}
