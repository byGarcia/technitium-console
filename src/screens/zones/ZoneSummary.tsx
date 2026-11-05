import { typeLabel, zoneNameOf, zoneState, type Zone } from '../../api/zones'
import { fromNow } from '../../lib/dates'
import type { CSSProperties } from 'react'
import { Icon } from '../../ui/Icon'
import { Card, StackBar } from './ZoneOverview'
import { zoneColour } from './zone-colours'
import styles from './ZoneOverview.module.css'

/*
THE ZONES AT A GLANCE (deviation 12 in CONVENTIONS.md, 2026-11-05): four cards
over the zone list, counted across EVERY zone the user may see, not just the page.
They read one `zones/list` with no page (`listAllZones`), about 230 bytes a zone,
under the same Zones: View the list already needs.

  · Zones     how many, and of which types; pressing a type writes it in the Type
              filter and runs Go, exactly as choosing it there would.
  · Health    Enabled, the ones with a problem (upstream's own states: Expired,
              Validation Failed, Sync Failed, Notify Failed) and Disabled.
  · DNSSEC    how many of the zones that can be signed are, and how many of those
              this server holds no keys for.
  · Last change   the zone changed most recently, and when.

A count is a fact of the server, so a zero is drawn as 0 (DESIGN, rule 4).
*/

const PROBLEMS = ['Expired', 'Validation Failed', 'Sync Failed', 'Notify Failed']

export function ZoneSummary({
  zones,
  activeType,
  onType,
}: {
  zones: Zone[]
  activeType: string
  onType: (type: string) => void
}) {
  const types = new Map<string, number>()
  for (const z of zones) types.set(z.type, (types.get(z.type) ?? 0) + 1)

  const states = zones.map((z) => zoneState(z))
  const enabled = states.filter((s) => s === 'Enabled').length
  const disabled = states.filter((s) => s === 'Disabled').length
  const problems = states.filter((s) => PROBLEMS.includes(s)).length

  /* Only Primary and Secondary zones carry `dnssecStatus`: the ones that can be signed. */
  const signable = zones.filter((z) => z.dnssecStatus != null)
  const signed = signable.filter((z) => z.dnssecStatus === 'SignedWithNSEC' || z.dnssecStatus === 'SignedWithNSEC3')
  const noKeys = signed.filter((z) => z.hasDnssecPrivateKeys === false).length

  const latest = zones.reduce<Zone | null>(
    (best, z) => (z.lastModified != null && (best == null || z.lastModified > best.lastModified) ? z : best),
    null,
  )

  const health = [
    { key: 'Enabled', value: enabled, colour: 'var(--ok)' },
    { key: 'Problems', value: problems, colour: 'var(--warn)' },
    { key: 'Disabled', value: disabled, colour: 'var(--ch-drop)' },
  ]
  const share = signable.length === 0 ? 0 : signed.length / signable.length

  return (
    <div className={styles.grid}>
      <Card title="All Zones" colour="var(--ch-total)">
        <div className={styles.body}>
          <div className={styles.figure}>{zones.length}</div>
          <StackBar
            label={[...types.entries()].map(([t, n]) => `${typeLabel(t)} ${n}`).join(', ')}
            parts={[...types.entries()].map(([t, n]) => ({ key: t, value: n, colour: zoneColour(t) }))}
          />
          {types.size > 0 && (
            <div className={styles.types} role="group" aria-label="Zones by type">
              {[...types.entries()].map(([t, n]) => (
                <button
                  key={t}
                  type="button"
                  className={styles.typeChip}
                  style={{ '--sw': zoneColour(t) } as CSSProperties}
                  aria-pressed={activeType === t}
                  onClick={() => onType(activeType === t ? '' : t)}
                >
                  <span className={styles.typeLabel}>{typeLabel(t)}</span>
                  <span className={styles.typeCount}>{n}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </Card>

      <Card title="Health" colour={problems > 0 ? 'var(--warn)' : 'var(--ok)'}>
        <div className={styles.body}>
          <dl className={`${styles.facts} ${styles.factsLarge}`}>
            {health.map((h) => (
              <div key={h.key}>
                <dt>
                  <span className={styles.dot} style={{ background: h.colour }} /> {h.key}
                </dt>
                <dd className={h.key === 'Problems' && h.value > 0 ? styles.bad : undefined}>{h.value}</dd>
              </div>
            ))}
          </dl>
          <StackBar label={health.map((h) => `${h.key} ${h.value}`).join(', ')} parts={health} />
        </div>
      </Card>

      <Card title="DNSSEC" colour={signed.length > 0 ? 'var(--info)' : 'var(--ch-drop)'}>
        <div className={styles.body}>
          <div className={styles.state}>
            <span className={`${styles.shield}${signed.length > 0 ? ` ${styles.shieldOn}` : ''}`}>
              <Icon name="shield" size={22} />
            </span>
            <div className={styles.figure}>
              {signed.length}
              <span className={styles.of}> of {signable.length}</span>
            </div>
          </div>
          <div className={styles.meter} role="img" aria-label={`${signed.length} of ${signable.length} signed`}>
            <span style={{ width: `${Math.round(share * 100)}%` }} />
          </div>
          <div className={styles.caption}>
            signed{noKeys > 0 ? `, ${noKeys} with no keys on this server` : ''}
          </div>
        </div>
      </Card>

      <Card title="Last change" colour="var(--acc)">
        <div className={styles.body}>
          {latest == null ? (
            <div className={styles.quiet}>No zones</div>
          ) : (
            <>
              <div className={styles.lastName}>{zoneNameOf(latest)}</div>
              <div className={styles.caption}>
                <Icon name="refresh" size={12} /> {fromNow(latest.lastModified)} · {typeLabel(latest.type)}
              </div>
            </>
          )}
        </div>
      </Card>
    </div>
  )
}
