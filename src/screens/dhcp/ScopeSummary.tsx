import { useState, type CSSProperties } from 'react'
import type { DhcpLease, DhcpScopeRow } from '../../api/dhcp'
import { Card, Count, StackBar, hotEvents, statStyles as stat } from '../../ui/StatCard'
import { DISABLED_COLOUR, ENABLED_COLOUR, leaseColour } from './lease-colours'
import { LEASE_TYPES } from './LeaseSummary'
import { poolTotals } from './pool'
import styles from './Dhcp.module.css'

/*
THE SCOPES AT A GLANCE (deviation 19 in CONVENTIONS.md, 2026-11-06): three cards
over the scope table.

  · All Scopes    how many, Enabled against Disabled (`scopes/list`). Pressing a
                  state sets the table's State filter, pressing it again clears it.
  · Address Pool  the leases held in the enabled scopes, of the addresses in their
                  ranges (`pool.ts` says what is and is not counted).
  · Leases        how many, Dynamic against Reserved.

The last two read `dhcp/leases/list`, the one call this deviation adds to the
Scopes tab: the list the Leases tab already loads, under the same DHCP: View. When
it fails the scope table and the first card are unaffected, and the two cards say
they could not read it instead of drawing a zero that would be false.

Words of ours, all in this file: the three titles, `of`, `addresses in range`,
`leased in the enabled scopes`, `in the enabled scopes` and `The leases could
not be read.`.
*/

export function ScopeSummary({
  scopes,
  leases,
  state,
  onState,
}: {
  scopes: DhcpScopeRow[]
  leases: DhcpLease[] | null
  /** The table's State filter, `''` for all. */
  state: string
  onState: (state: string) => void
}) {
  const [hotState, setHotState] = useState<string | null>(null)
  const [hotType, setHotType] = useState<string | null>(null)
  const enabled = scopes.filter((s) => s.enabled).length
  const states = [
    { key: 'Enabled', name: 'Enabled', value: enabled, colour: ENABLED_COLOUR },
    { key: 'Disabled', name: 'Disabled', value: scopes.length - enabled, colour: DISABLED_COLOUR },
  ]
  const pool = poolTotals(scopes, leases ?? [])
  const share = pool.addresses === 0 ? 0 : Math.min(1, pool.leased / pool.addresses)
  const types = LEASE_TYPES.map((t) => ({
    key: t,
    name: t,
    value: (leases ?? []).filter((l) => l.type === t).length,
    colour: leaseColour(t),
  }))

  return (
    <div className={`${stat.grid} ${styles.cards3}`}>
      <Card title="All Scopes" colour="var(--ch-total)">
        <div className={stat.body}>
          <div className={stat.figure}><Count value={scopes.length} /></div>
          <StackBar
            label={states.map((s) => `${s.name} ${s.value}`).join(', ')}
            parts={states}
            hot={hotState}
            onHot={setHotState}
          />
          <div className={stat.types} role="group" aria-label="Scopes by state">
            {states.map((s) => (
              <button
                key={s.key}
                type="button"
                className={stat.typeChip}
                style={{ '--sw': s.colour } as CSSProperties}
                aria-pressed={state === s.key}
                data-hot={hotState === s.key || undefined}
                onClick={() => onState(state === s.key ? '' : s.key)}
                {...hotEvents(s.key, setHotState)}
              >
                <span className={stat.typeLabel}>{s.name}</span>
                <span className={stat.typeCount}>{s.value}</span>
              </button>
            ))}
          </div>
        </div>
      </Card>

      <Card title="Address Pool" colour="var(--info)">
        <div className={stat.body}>
          {leases == null ? (
            <>
              <div className={stat.figure}>
                <Count value={pool.addresses} />
                <span className={stat.of}> addresses in range</span>
              </div>
              <div className={stat.caption}>in the enabled scopes</div>
              <div className={styles.unread}>The leases could not be read.</div>
            </>
          ) : (
            <>
              <div className={stat.figure}>
                <Count value={pool.leased} />
                <span className={stat.of}> of {pool.addresses}</span>
              </div>
              <div
                className={stat.meter}
                role="img"
                aria-label={`${pool.leased} of ${pool.addresses} addresses in range leased`}
              >
                <span style={{ width: `${Math.round(share * 100)}%` }} />
              </div>
              <div className={stat.caption}>leased in the enabled scopes</div>
            </>
          )}
        </div>
      </Card>

      <Card title="Leases" colour={leaseColour('Dynamic')}>
        <div className={stat.body}>
          {leases == null ? (
            <div className={styles.unread}>The leases could not be read.</div>
          ) : (
            <>
              <div className={stat.figure}><Count value={leases.length} /></div>
              <StackBar
                label={types.map((t) => `${t.name} ${t.value}`).join(', ')}
                parts={types}
                hot={hotType}
                onHot={setHotType}
              />
              <dl className={stat.facts}>
                {types.map((t) => (
                  <div key={t.key} {...hotEvents(t.key, setHotType)}>
                    <dt>
                      <span className={stat.dot} style={{ background: t.colour }} /> {t.name}
                    </dt>
                    <dd><Count value={t.value} /></dd>
                  </div>
                ))}
              </dl>
            </>
          )}
        </div>
      </Card>
    </div>
  )
}
