import type { ResourceRecord, ZoneDetails } from '../../api/records'
import { Button } from '../../ui/Button'
import { Panel } from '../../ui/Panel'
import { Tag } from '../../ui/Tag'
import { DomainName } from '../../ui/DomainName'
import type { ZoneHeader } from './zone-view'
import type { CSSProperties, ReactNode } from 'react'
import { Icon } from '../../ui/Icon'
import { recordColour } from './zone-colours'
import styles from './ZoneOverview.module.css'

/** A card with its series colour as a straight bar inside its left edge, the way
 *  the Dashboard's figures carry theirs. */
export function Card({ title, colour, children }: { title: string; colour: string; children: ReactNode }) {
  return (
    <div className={styles.card} style={{ '--tc': colour } as CSSProperties}>
      <Panel title={title}>{children}</Panel>
    </div>
  )
}

/** How a whole splits, as one bar of coloured segments, widest first. */
export function StackBar({ parts, label }: { parts: { key: string; value: number; colour: string }[]; label: string }) {
  const total = parts.reduce((n, p) => n + p.value, 0)
  if (total === 0) return null
  return (
    <div className={styles.stack} role="img" aria-label={label}>
      {parts
        .filter((p) => p.value > 0)
        .map((p) => (
          <span key={p.key} className={styles.segment} style={{ flexGrow: p.value, background: p.colour }} />
        ))}
    </div>
  )
}

/*
A ZONE AT A GLANCE (deviation 12 in CONVENTIONS.md, 2026-11-05): four cards above
the records, drawn only from what `zones/records/get` already brought.

  · Records   how many the zone holds (after Hide DNSSEC Records) and of which
              types (pressing a type filters the table: WHAT THE ZONE HOLDS in
              ZoneRecords), how many are disabled, and how many have not
              answered a query since the server started. Not "never": the
              server keeps `lastUsedOn` in memory only (GenericRecordInfo.cs:35),
              so a restart sets every record back to `0001-01-01`.
  · SOA       the apex SOA's fields, which the table spreads over a row of nine.
  · Name Servers   the apex NS records, with upstream's `Notify Failed` mark on
              the ones the zone could not notify.
  · DNSSEC    the zone's signing state, and the DNSSEC actions themselves: they
              were a menu in the header; here they are the card's buttons, with
              upstream's literals and the same dialogs behind them, so the place
              that says whether a zone is signed is the place that signs it.

A card whose data the zone does not have (a Forwarder has no SOA, an unsigned
Secondary has no DNSSEC actions) is not drawn, rather than drawn empty.
*/

const NEVER = '0001-01-01T00:00:00'

function apex(r: ResourceRecord, zone: string): boolean {
  const name = r.name === '' ? '.' : r.name
  return name.toLowerCase() === zone.toLowerCase()
}

export interface ZoneOverviewProps {
  zone: string
  info: ZoneDetails
  /** What the table would list with no filter: Hide DNSSEC Records applied. */
  records: ResourceRecord[]
  head: ZoneHeader
  hideDnssecRecords: boolean
  canModify: boolean
  busy: boolean
  onSign: () => void
  onUnsign: () => void
  onViewDs: () => void
  onProperties: () => void
  onToggleDnssecRecords: () => void
  /** The types and their counts, and the one applied in the Type filter. */
  byType: [string, number][]
  activeType: string
  onType: (type: string) => void
}

export function ZoneOverview(p: ZoneOverviewProps) {
  const { zone, info, records, head } = p
  const disabled = records.filter((r) => r.disabled).length
  const neverUsed = records.filter((r) => r.lastUsedOn === NEVER).length
  const soa = records.find((r) => r.type === 'SOA' && apex(r, zone))
  const ns = records.filter((r) => r.type === 'NS' && apex(r, zone))
  const failed = info.notifyFailedFor ?? []
  const signed = info.dnssecStatus === 'SignedWithNSEC' || info.dnssecStatus === 'SignedWithNSEC3'

  const d = soa?.rData ?? {}
  const soaRows: [string, string][] = soa
    ? [
        ['Primary Name Server', String(d.primaryNameServer ?? '')],
        ['Responsible Person', String(d.responsiblePerson ?? '')],
        ['Refresh', `${String(d.refresh ?? '')} (${String(d.refreshString ?? '')})`],
        ['Retry', `${String(d.retry ?? '')} (${String(d.retryString ?? '')})`],
        ['Expire', `${String(d.expire ?? '')} (${String(d.expireString ?? '')})`],
        ['Minimum', `${String(d.minimum ?? '')} (${String(d.minimumString ?? '')})`],
      ]
    : []

  return (
    <div className={styles.grid}>
      <Card title="Records" colour="var(--ch-total)">
        <div className={styles.body}>
          <div className={styles.figure}>{records.length}</div>
          <StackBar
            label={p.byType.map(([t, n]) => `${t} ${n}`).join(', ')}
            parts={p.byType.map(([t, n]) => ({ key: t, value: n, colour: recordColour(t) }))}
          />
          {p.byType.length > 0 && (
            <div className={styles.types} role="group" aria-label="Records by type">
              {p.byType.map(([t, n]) => (
                <button
                  key={t}
                  type="button"
                  className={styles.typeChip}
                  style={{ '--sw': recordColour(t) } as CSSProperties}
                  aria-pressed={p.activeType.toUpperCase() === t}
                  onClick={() => p.onType(p.activeType.toUpperCase() === t ? '' : t)}
                >
                  <span className={styles.typeName}>{t}</span>
                  <span className={styles.typeCount}>{n}</span>
                </button>
              ))}
            </div>
          )}
          <dl className={styles.facts}>
            <div>
              <dt>Disabled</dt>
              <dd>{disabled}</dd>
            </div>
            <div>
              <dt>Not used since restart</dt>
              <dd>{neverUsed}</dd>
            </div>
          </dl>
        </div>
      </Card>

      {soa && (
        <Card title="SOA" colour={recordColour('SOA')}>
          <dl className={`${styles.body} ${styles.pairs}`}>
            {soaRows.map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
        </Card>
      )}

      {ns.length > 0 && (
        <Card title="Name Servers" colour={recordColour('NS')}>
          <ul className={`${styles.body} ${styles.list}`}>
            {ns.map((r) => {
              const server = String(r.rData.nameServer ?? '')
              return (
                <li key={server}>
                  <span className={styles.dot} style={{ background: failed.includes(server) ? 'var(--warn)' : r.disabled ? 'var(--ch-drop)' : 'var(--ok)' }} />
                  <span className={styles.mono}>
                    <DomainName name={server} />
                  </span>
                  {failed.includes(server) && <Tag tone="warn">Notify Failed</Tag>}
                  {r.disabled && <Tag>Disabled</Tag>}
                </li>
              )
            })}
          </ul>
        </Card>
      )}

      {head.dnssec && (
        <Card title="DNSSEC" colour={signed ? 'var(--info)' : 'var(--ch-drop)'}>
          <div className={styles.body}>
            <div className={styles.state}>
              <span className={`${styles.shield}${signed ? ` ${styles.shieldOn}` : ''}`}>
                <Icon name="shield" size={22} />
              </span>
              {signed ? (
                <Tag tone={info.hasDnssecPrivateKeys ? 'info' : 'neutral'}>
                  {info.dnssecStatus === 'SignedWithNSEC3' ? 'Signed with NSEC3' : 'Signed with NSEC'}
                </Tag>
              ) : (
                <span className={styles.quiet}>Unsigned</span>
              )}
            </div>
            <div className={styles.actions}>
              {head.sign && (
                <Button size="sm" lead="key" disabled={!p.canModify || p.busy} onClick={p.onSign}>
                  Sign Zone
                </Button>
              )}
              {head.viewDs && (
                <Button size="sm" onClick={p.onViewDs}>
                  View DS Info
                </Button>
              )}
              {head.properties && (
                <Button size="sm" disabled={!p.canModify || p.busy} onClick={p.onProperties}>
                  Properties
                </Button>
              )}
              {head.toggleDnssecRecords && (
                <Button size="sm" onClick={p.onToggleDnssecRecords}>
                  {p.hideDnssecRecords ? 'Show DNSSEC Records' : 'Hide DNSSEC Records'}
                </Button>
              )}
              {head.unsign && (
                <Button size="sm" variant="danger" disabled={!p.canModify || p.busy} onClick={p.onUnsign}>
                  Unsign Zone
                </Button>
              )}
            </div>
          </div>
        </Card>
      )}
    </div>
  )
}
