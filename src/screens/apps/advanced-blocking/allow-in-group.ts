/*
  Allowing a blocked name in Advanced Blocking groups, from a Query Logs row
  (deviation 47 in CONVENTIONS.md). It edits the same model the visual editor
  edits (config-model.ts), so the config is patched, never rebuilt: only the
  `allowed` list of each chosen group changes.

  App.cs below is Apps/AdvancedBlockingApp/App.cs on upstream/master (2026-09-26).
*/
import type { EditorModel, GroupModel } from './config-model'
import { networkContains } from '../../blocking/check-domain'

/* `[::]/0` ships in the app's default config: the brackets are the URI spelling of
   an IPv6 address, which NetworkAddress.TryParse accepts. */
function unbracket(network: string): string {
  return network.trim().replace(/^\[([^\]]*)\]/, '$1')
}

function prefixOf(network: string): number {
  const [base, prefix] = network.trim().split('/')
  if (prefix != null) return Number(prefix)
  return base.includes(':') ? 128 : 32
}

/**
 * The group the app gives a client by its address: the most specific network of
 * `networkGroupMap` that holds it (GetGroupName, App.cs:328-341). A row naming a
 * missing group gives no group, and the app then blocks nothing for that client
 * (App.cs:569-573). `localEndPointGroupMap` wins over this (App.cs:285-326), but a
 * query log entry does not say which endpoint the query came in on.
 */
export function clientGroup(model: EditorModel, ip: string): GroupModel | null {
  let best: { prefix: number; groupId: string | null } | null = null
  for (const row of model.rows) {
    const network = unbracket(row.address)
    if (row.map !== 'networkGroupMap' || !networkContains(network, ip)) continue
    const prefix = prefixOf(network)
    if (best == null || prefix > best.prefix) best = { prefix, groupId: row.groupId }
  }
  return best?.groupId == null ? null : model.groups.find((g) => g.id === best.groupId) ?? null
}

/** Whether the endpoint map has rows, which could give this client another group. */
export function hasEndpointRows(model: EditorModel): boolean {
  return model.rows.some((r) => r.map === 'localEndPointGroupMap')
}

/** The name as the app compares it: lower case (App.cs:1031), no final dot. */
export function allowedName(domain: string): string {
  return domain.trim().toLowerCase().replace(/\.$/, '')
}

/** The line of the group's `allowed` list that already covers the name: the name
    itself or a parent, as IsZoneFound walks up (App.cs:153-169). */
export function allowedBy(group: GroupModel, domain: string): string | null {
  const name = allowedName(domain)
  let best: string | null = null
  for (const raw of group.text.allowed.split(/\r?\n/)) {
    const line = allowedName(raw)
    if (line === '') continue
    if ((name === line || name.endsWith(`.${line}`)) && (best == null || line.length > best.length)) best = line
  }
  return best
}

/** The model with the name added at the end of each chosen group's `allowed` list. */
export function withAllowed(model: EditorModel, groupIds: readonly string[], domain: string): EditorModel {
  const name = allowedName(domain)
  return {
    ...model,
    groups: model.groups.map((g) => {
      if (!groupIds.includes(g.id) || allowedBy(g, name) != null) return g
      const allowed = g.text.allowed.trim() === '' ? name : `${g.text.allowed.replace(/\s+$/, '')}\n${name}`
      return { ...g, text: { ...g.text, allowed } }
    }),
  }
}
