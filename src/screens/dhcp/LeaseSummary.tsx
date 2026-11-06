import { useState, type CSSProperties } from 'react'
import type { DhcpLease } from '../../api/dhcp'
import { fromNow, minuteStamp } from '../../lib/dates'
import { Icon } from '../../ui/Icon'
import { Card, Count, StackBar, hotEvents, statStyles as stat } from '../../ui/StatCard'
import { leaseColour } from './lease-colours'
import { expiringSoon, leasesPerScope, newest } from './pool'
import styles from './Dhcp.module.css'

/*
THE LEASES AT A GLANCE (deviation 19 in CONVENTIONS.md, 2026-11-06): four cards
over the lease table, counted from the `dhcp/leases/list` the table already loads.
No call is added.

  · All Leases       how many, Dynamic against Reserved. Pressing a type sets the
                     table's Type filter, pressing it again clears it.
  · Leases per Scope how many each scope holds; pressing one sets the Scope filter.
  · Expiring Soon    the leases that run out within the next hour, and the first.
  · Newest Lease     the lease obtained last, and when.

The two types are always both drawn, a zero as 0 (DESIGN, rule 5: a legend names
every label the server sends). Words of ours, all in this file: the four titles,
`within the next hour`, `next:`, `obtained` and `None`. With no leases the
table's own row says `No Lease Found`; the cards draw their zeros and do not say
it again.
*/

export const LEASE_TYPES = ['Dynamic', 'Reserved'] as const

export function LeaseSummary({
  leases,
  now,
  type,
  scope,
  onType,
  onScope,
}: {
  leases: DhcpLease[]
  /** The clock the expiry figures are read against, injected for the tests. */
  now: number
  type: string
  scope: string
  onType: (type: string) => void
  onScope: (scope: string) => void
}) {
  const [hot, setHot] = useState<string | null>(null)
  const parts = LEASE_TYPES.map((t) => ({
    key: t,
    name: t,
    value: leases.filter((l) => l.type === t).length,
    colour: leaseColour(t),
  }))
  const per = [...leasesPerScope(leases).entries()]
  const most = Math.max(1, ...per.map(([, n]) => n))
  const soon = expiringSoon(leases, now)
  const last = newest(leases)

  return (
    <div className={stat.grid}>
      <Card title="All Leases" colour="var(--ch-total)">
        <div className={stat.body}>
          <div className={stat.figure}><Count value={leases.length} /></div>
          <StackBar
            label={parts.map((p) => `${p.name} ${p.value}`).join(', ')}
            parts={parts}
            hot={hot}
            onHot={setHot}
          />
          <div className={stat.types} role="group" aria-label="Leases by type">
            {parts.map((p) => (
              <button
                key={p.key}
                type="button"
                className={stat.typeChip}
                style={{ '--sw': p.colour } as CSSProperties}
                aria-pressed={type === p.key}
                data-hot={hot === p.key || undefined}
                onClick={() => onType(type === p.key ? '' : p.key)}
                {...hotEvents(p.key, setHot)}
              >
                <span className={stat.typeLabel}>{p.name}</span>
                <span className={stat.typeCount}>{p.value}</span>
              </button>
            ))}
          </div>
        </div>
      </Card>

      <Card title="Leases per Scope" colour="var(--ch-5)">
        <div className={stat.body}>
          {per.length === 0 ? (
            <div className={stat.figure}><Count value={0} /></div>
          ) : (
            <div className={styles.scopeList} role="group" aria-label="Leases per scope">
              {per.map(([name, n]) => (
                <button
                  key={name}
                  type="button"
                  className={styles.scopeRow}
                  aria-pressed={scope === name}
                  onClick={() => onScope(scope === name ? '' : name)}
                >
                  <span className={styles.scopeName}>{name}</span>
                  <span className={styles.scopeCount}>{n}</span>
                  <span className={styles.scopeTrack} aria-hidden="true">
                    <span style={{ width: `${(n / most) * 100}%` }} />
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </Card>

      <Card title="Expiring Soon" colour={soon.length > 0 ? 'var(--warn)' : 'var(--ch-drop)'}>
        <div className={stat.body}>
          <div className={stat.figure}><Count value={soon.length} /></div>
          <div className={stat.caption}>within the next hour</div>
          {soon.length > 0 && (
            <div className={styles.next}>
              <span className={styles.nextLabel}>next:</span>{' '}
              <span className={styles.nextName}>{soon[0].hostName || soon[0].address}</span>{' '}
              <span className={styles.nextWhen} title={minuteStamp(soon[0].leaseExpires)}>
                {fromNow(soon[0].leaseExpires, now)}
              </span>
            </div>
          )}
        </div>
      </Card>

      <Card title="Newest Lease" colour="var(--acc)">
        <div className={stat.body}>
          {last == null ? (
            <div className={stat.quiet}>None</div>
          ) : (
            <>
              <div className={stat.lastName}>{last.hostName || last.address}</div>
              {last.hostName ? <div className={styles.lastAddress}>{last.address}</div> : null}
              <div className={stat.caption} title={minuteStamp(last.leaseObtained)}>
                <Icon name="refresh" size={12} /> obtained {fromNow(last.leaseObtained, now)}
              </div>
            </>
          )}
        </div>
      </Card>
    </div>
  )
}
