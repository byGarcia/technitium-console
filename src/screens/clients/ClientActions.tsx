import { useState, type ReactNode } from 'react'
import { setSettings, type DnsSettings } from '../../api/settings'
import { convertToDynamicLease, convertToReservedLease, type DhcpLease } from '../../api/dhcp'
import { PermissionButton } from '../../ui/PermissionButton'
import { Confirm } from '../../ui/Confirm'
import { Icon } from '../../ui/Icon'
import { noticeFromFailure, type Notice } from '../../lib/notice'
import { requiresText, type Need } from '../blocking/permissions'
import { addBody, membership, removeBody, type BypassList } from './client-actions'
import styles from './Clients.module.css'

/*
The client card's Actions (CONVENTIONS.md, deviation 25, approved on 2026-11-06):
three operations the console already performs elsewhere, with the same calls, and
upstream's texts wherever upstream has them.

  · `Blocking Bypass List` and `QPM Limit Bypass List`: whether the client's
    address is in Settings' list (`settings/get`, read by the page with `Settings:
    View`), and a button that adds it or takes it out. The save is `settings/set`
    with the list alone and its node, as Blocking › Lists saves `blockListUrls`
    (`client-actions.ts`); it needs `Settings: Modify`. The answer carries the
    settings as the server keeps them, and the state is redrawn from it. Upstream
    asks nothing before saving its settings, but these buttons change a server
    setting from a page that reads like a report, so each asks first, naming the
    list and the address (OUR words). The QPM row is drawn only when the server
    sends `qpmLimitBypassList`.
  · `DHCP Lease`: with a lease that hands out the client's address, its type and
    the conversion DHCP › Leases offers for it: `Convert To Reserved Lease` for a
    dynamic one (`dhcp/leases/convertToReserved`), `Convert To Dynamic Lease` for a
    reserved one (`dhcp/leases/convertToDynamic`), with the lease's scope and client
    identifier and the node the leases were read on, behind upstream's `confirm()`
    (dhcp.js:87, 124) and with its `Reserved!` / `Unreserved!` notices. It needs
    `DhcpServer: Modify`. The page reads the leases again after it.

A failure says the server's message (upstream's `Error!`, `noticeFromFailure`). A
permission the session lacks keeps its button, disabled with the padlock.

Its words, OURS save upstream's list names, `Dynamic`, `Reserved`, the two
conversions, their confirmations, `Convert`, `Settings Saved!` with its sentence and
`Reserved!` / `Unreserved!` with theirs: `Actions`, `DHCP Lease`, `Applies`,
`Bypassed`, `Exempt`, `Through <network>`, `Bypass Blocking`, `Apply Blocking`,
`Exempt from Rate Limiting`, `Apply Rate Limiting`, `Add`, `Remove`, the four
confirmations (`Add <ip> to the Blocking Bypass List? …` and the rest, `ASK` below)
and `Could not read the settings.`
*/

export type SettingsRead =
  | { kind: 'loading' }
  | { kind: 'failed' }
  | { kind: 'locked'; need: Need }
  | { kind: 'ok'; data: DnsSettings }

interface ListWords {
  name: string
  on: string
  off: string
  add: string
  remove: string
}

const LISTS: Record<BypassList, ListWords> = {
  blockingBypassList: {
    name: 'Blocking Bypass List',
    on: 'Bypassed',
    off: 'Applies',
    add: 'Bypass Blocking',
    remove: 'Apply Blocking',
  },
  qpmLimitBypassList: {
    name: 'QPM Limit Bypass List',
    on: 'Exempt',
    off: 'Applies',
    add: 'Exempt from Rate Limiting',
    remove: 'Apply Rate Limiting',
  },
}

/** The confirmations of the two lists. OURS. */
export const ASK: Record<BypassList, { add: (ip: string) => string; remove: (ip: string) => string }> = {
  blockingBypassList: {
    add: (ip) => `Add ${ip} to the Blocking Bypass List? Blocking will no longer apply to its queries.`,
    remove: (ip) => `Remove ${ip} from the Blocking Bypass List? Blocking will apply to its queries again.`,
  },
  qpmLimitBypassList: {
    add: (ip) => `Add ${ip} to the QPM Limit Bypass List? Its queries will no longer count against the queries per minute limits.`,
    remove: (ip) => `Remove ${ip} from the QPM Limit Bypass List? Its queries will count against the queries per minute limits again.`,
  },
}

type Ask =
  | { kind: 'list'; name: BypassList; add: boolean }
  | { kind: 'lease'; reserve: boolean }

export function ClientActions({
  ip,
  token,
  settings,
  onSettings,
  settingsNode,
  settingsNeed,
  lease,
  dhcpNode,
  dhcpNeed,
  onLeaseChanged,
  onNotice,
}: {
  ip: string
  token: string | null
  settings: SettingsRead
  /** The settings as the server answered a save. */
  onSettings: (s: DnsSettings) => void
  /** Where the two lists live (`settingsNode`). */
  settingsNode: string
  /** `Settings.canModify` when it is missing. */
  settingsNeed: Need | undefined
  lease: DhcpLease | null
  /** The node the leases were read on. */
  dhcpNode: string
  /** `DhcpServer.canModify` when it is missing. */
  dhcpNeed: Need | undefined
  onLeaseChanged: () => void
  onNotice: (n: Notice) => void
}) {
  const [ask, setAsk] = useState<Ask | null>(null)
  const [busy, setBusy] = useState(false)

  async function saveList(name: BypassList, add: boolean) {
    if (settings.kind !== 'ok') return
    const list = settings.data[name]
    const body = add ? addBody(name, list, ip, settingsNode) : removeBody(name, list, ip, settingsNode)
    setBusy(true)
    const r = await setSettings(token, body)
    setBusy(false)
    if (r.kind !== 'ok') {
      onNotice(noticeFromFailure(r))
      return
    }
    onSettings(r.data.response)
    // Settings.tsx:253-257, as Blocking › Lists says it.
    onNotice({ type: 'success', title: 'Settings Saved!', text: 'DNS Server settings were saved successfully.' })
  }

  async function convert(reserve: boolean) {
    if (lease == null) return
    setBusy(true)
    const r = reserve
      ? await convertToReservedLease(token, lease.scope, lease.clientIdentifier, dhcpNode)
      : await convertToDynamicLease(token, lease.scope, lease.clientIdentifier, dhcpNode)
    setBusy(false)
    if (r.kind !== 'ok') {
      onNotice(noticeFromFailure(r))
      return
    }
    // dhcp.js:111 and 148.
    onNotice(
      reserve
        ? { type: 'success', title: 'Reserved!', text: 'The dynamic lease was converted to reserved lease successfully.' }
        : { type: 'success', title: 'Unreserved!', text: 'The reserved lease was converted to dynamic lease successfully.' },
    )
    onLeaseChanged()
  }

  const listRow = (name: BypassList) => {
    const words = LISTS[name]
    if (settings.kind === 'ok' && settings.data[name] === undefined) return null
    let state: ReactNode
    let action: ReactNode = null
    if (settings.kind === 'locked') {
      state = (
        <span className={styles.actionQuiet}>
          <Icon name="lock" size={13} /> {requiresText(settings.need)}
        </span>
      )
    } else if (settings.kind === 'loading') {
      state = <span className={styles.actionQuiet}>Loading…</span>
    } else if (settings.kind === 'failed') {
      state = <span className={styles.actionQuiet}>Could not read the settings.</span>
    } else {
      const m = membership(settings.data[name], ip)
      state =
        m.entry == null ? (
          <span>{words.off}</span>
        ) : (
          <span className={styles.actionOn}>
            {words.on}
            {!m.exact && <span className={styles.actionQuiet}>{` Through ${m.entry}`}</span>}
          </span>
        )
      /* A network entry holds it: taking the address out would change nothing. */
      if (m.entry == null || m.exact) {
        action = (
          <PermissionButton
            size="sm"
            permission={settingsNeed}
            disabled={busy}
            onClick={() => setAsk({ kind: 'list', name, add: m.entry == null })}
          >
            {m.entry == null ? words.add : words.remove}
          </PermissionButton>
        )
      }
    }
    return <Row key={name} name={words.name} state={state} action={action} />
  }

  const reserve = lease?.type === 'Dynamic'

  return (
    <section className={styles.actionsArea} aria-label="Actions">
      <h3 className={styles.actionsTitle}>Actions</h3>
      <dl className={styles.actionRows}>
        {listRow('blockingBypassList')}
        {listRow('qpmLimitBypassList')}
        {lease != null && (
          <Row
            name="DHCP Lease"
            state={<span>{lease.type}</span>}
            action={
              <PermissionButton
                size="sm"
                permission={dhcpNeed}
                disabled={busy}
                onClick={() => setAsk({ kind: 'lease', reserve })}
              >
                {reserve ? 'Convert To Reserved Lease' : 'Convert To Dynamic Lease'}
              </PermissionButton>
            }
          />
        )}
      </dl>

      <Confirm
        open={ask?.kind === 'list'}
        title={ask?.kind === 'list' ? (ask.add ? LISTS[ask.name].add : LISTS[ask.name].remove) : ''}
        text={ask?.kind === 'list' ? (ask.add ? ASK[ask.name].add(ip) : ASK[ask.name].remove(ip)) : ''}
        label={ask?.kind === 'list' && !ask.add ? 'Remove' : 'Add'}
        variant="primary"
        busy={busy}
        onClose={() => setAsk(null)}
        onConfirm={() => (ask?.kind === 'list' ? saveList(ask.name, ask.add) : undefined)}
      />
      {/* dhcp.js:87 and 124, as DHCP › Leases asks them. */}
      <Confirm
        open={ask?.kind === 'lease'}
        title={ask?.kind === 'lease' && !ask.reserve ? 'Convert To Dynamic Lease' : 'Convert To Reserved Lease'}
        text={
          ask?.kind === 'lease' && !ask.reserve
            ? 'Are you sure you want to convert the reserved lease to dynamic lease?'
            : 'Are you sure you want to convert the dynamic lease to reserved lease?'
        }
        label="Convert"
        variant="primary"
        busy={busy}
        onClose={() => setAsk(null)}
        onConfirm={() => (ask?.kind === 'lease' ? convert(ask.reserve) : undefined)}
      />
    </section>
  )
}

function Row({ name, state, action }: { name: string; state: ReactNode; action: ReactNode }) {
  return (
    <div className={styles.actionRow}>
      <dt>{name}</dt>
      <dd className={styles.actionState}>{state}</dd>
      <dd className={styles.actionDo}>{action}</dd>
    </div>
  )
}
