import { useRef, useState } from 'react'
import type { DhcpLease, DhcpScope, DhcpScopeRow } from '../../api/dhcp'
import { Button } from '../../ui/Button'
import { Tag } from '../../ui/Tag'
import { useTooltip } from '../../ui/Tooltip'
import { Card, Count, StackBar, hotEvents, statStyles as stat } from '../../ui/StatCard'
import { leaseColour } from './lease-colours'
import { LEASE_TYPES } from './LeaseSummary'
import { leaseTime, rangeSize } from './pool'
import styles from './Dhcp.module.css'

/*
A SCOPE AT A GLANCE (deviation 19 in CONVENTIONS.md, 2026-11-06): four cards between
a scope's header and its form, as a zone's page has them over its records. They read
what the page already holds: the scope's row of `scopes/list`, the `scopes/get` that
filled the form, and the `leases/list` the Scopes tab reads beside the list. No call
is added. They say what the server holds, not what the form below has typed.

  · Address Pool     the leases this scope holds, of the addresses in its range;
                     the range, the mask, the network and the broadcast.
  · Leases           how many, Dynamic against Reserved, and `Open in Leases`, which
                     shows the Leases tab narrowed to this scope.
  · Reserved Leases  how many reservations, and whether a client holds each one.
  · Options          the lease time, the router, the DNS servers, the domain name.

Words of ours, all in this file: the titles (Reserved Leases and the field names
are upstream's), `of N`, `addresses in range leased`, `The leases could not be
read.`, `Open in Leases`, `N of M leased`, `Leased`, `Not leased`, `N more`, `None`, `This DNS
Server`, the lease time written `1d 4h 30m`, and the tooltip "A reservation is in
the Leases list only once its client has taken it."
*/

/** Whether a client holds this reservation now: a lease of the scope with its MAC. */
function held(mac: string, scope: string, leases: DhcpLease[]): boolean {
  const m = mac.trim().toUpperCase().replace(/:/g, '-')
  return leases.some((l) => l.scope === scope && l.hardwareAddress.toUpperCase() === m)
}

const SHOWN = 4

function ReservedCaption() {
  const ref = useRef<HTMLSpanElement>(null)
  const tip = useTooltip({
    text: 'A reservation is in the Leases list only once its client has taken it.',
    placement: 'top',
    anchor: ref,
  })
  return (
    <span ref={ref} className={styles.explained} tabIndex={0} aria-describedby={tip.describedBy()} {...tip.events}>
      leased
      {tip.bubble}
    </span>
  )
}

export function ScopeOverview({
  row,
  scope,
  leases,
  onOpenLeases,
}: {
  row: DhcpScopeRow | undefined
  scope: DhcpScope
  leases: DhcpLease[] | null
  onOpenLeases: () => void
}) {
  const [hot, setHot] = useState<string | null>(null)
  const mine = (leases ?? []).filter((l) => l.scope === scope.name)
  const size = rangeSize(scope.startingAddress, scope.endingAddress)
  const share = size == null || size === 0 ? 0 : Math.min(1, mine.length / size)
  const types = LEASE_TYPES.map((t) => ({
    key: t,
    name: t,
    value: mine.filter((l) => l.type === t).length,
    colour: leaseColour(t),
  }))
  const reserved = scope.reservedLeases
  const takenCount = leases == null ? 0 : reserved.filter((r) => held(r.hardwareAddress, scope.name, leases)).length
  const servers = (scope.dnsServers ?? []).join(', ')
  /* Words are drawn in the interface face; addresses and names in mono. */
  const word = (text: string) => <span className={styles.word}>{text}</span>
  const dns = scope.useThisDnsServer ? word('This DNS Server') : servers || word('None')

  return (
    <div className={stat.grid}>
      <Card title="Address Pool" colour="var(--info)">
        <div className={stat.body}>
          {leases == null ? (
            <>
              <div className={stat.figure}>
                <Count value={size ?? 0} />
                <span className={stat.of}> addresses in range</span>
              </div>
              <div className={styles.unread}>The leases could not be read.</div>
            </>
          ) : (
            <>
              <div className={stat.figure}>
                <Count value={mine.length} />
                <span className={stat.of}> of {size ?? 0}</span>
              </div>
              <div
                className={stat.meter}
                role="img"
                aria-label={`${mine.length} of ${size ?? 0} addresses in range leased`}
              >
                <span style={{ width: `${Math.round(share * 100)}%` }} />
              </div>
              <div className={stat.caption}>addresses in range leased</div>
            </>
          )}
          <dl className={`${stat.pairs} ${styles.cardPairs}`}>
            <div>
              <dt>Range</dt>
              <dd>
                {scope.startingAddress} - {scope.endingAddress}
              </dd>
            </div>
            <div>
              <dt>Subnet Mask</dt>
              <dd>{scope.subnetMask}</dd>
            </div>
            {row != null && (
              <>
                <div>
                  <dt>Network</dt>
                  <dd>{row.networkAddress}</dd>
                </div>
                <div>
                  <dt>Broadcast</dt>
                  <dd>{row.broadcastAddress}</dd>
                </div>
              </>
            )}
          </dl>
        </div>
      </Card>

      <Card title="Leases" colour={leaseColour('Dynamic')}>
        <div className={stat.body}>
          {leases == null ? (
            <div className={styles.unread}>The leases could not be read.</div>
          ) : (
            <>
              <div className={stat.figure}><Count value={mine.length} /></div>
              <StackBar
                label={types.map((t) => `${t.name} ${t.value}`).join(', ')}
                parts={types}
                hot={hot}
                onHot={setHot}
              />
              <dl className={stat.facts}>
                {types.map((t) => (
                  <div key={t.key} {...hotEvents(t.key, setHot)}>
                    <dt>
                      <span className={stat.dot} style={{ background: t.colour }} /> {t.name}
                    </dt>
                    <dd><Count value={t.value} /></dd>
                  </div>
                ))}
              </dl>
              <div className={stat.actions}>
                <Button size="sm" lead="dhcp" onClick={onOpenLeases}>
                  Open in Leases
                </Button>
              </div>
            </>
          )}
        </div>
      </Card>

      <Card title="Reserved Leases" colour={leaseColour('Reserved')}>
        <div className={stat.body}>
          <div className={stat.figure}><Count value={reserved.length} /></div>
          {leases != null && reserved.length > 0 && (
            <div className={stat.caption}>
              {takenCount} of {reserved.length} <ReservedCaption />
            </div>
          )}
          {reserved.length === 0 ? (
            <div className={stat.quiet}>None</div>
          ) : (
            <ul className={styles.reservations}>
              {reserved.slice(0, SHOWN).map((r) => (
                <li key={`${r.hardwareAddress}|${r.address}`}>
                  <span className={styles.resWho}>
                    <span className={styles.resName}>{r.hostName || r.address}</span>
                    <span className={styles.resAddress}>{r.hostName ? r.address : r.hardwareAddress}</span>
                  </span>
                  {leases != null && (
                    <Tag tone={held(r.hardwareAddress, scope.name, leases) ? 'ok' : 'neutral'}>
                      {held(r.hardwareAddress, scope.name, leases) ? 'Leased' : 'Not leased'}
                    </Tag>
                  )}
                </li>
              ))}
              {reserved.length > SHOWN && <li className={styles.more}>{reserved.length - SHOWN} more</li>}
            </ul>
          )}
        </div>
      </Card>

      <Card title="Options" colour="var(--ch-5)">
        <div className={stat.body}>
          <dl className={stat.pairs}>
            <div>
              <dt>Lease Time</dt>
              <dd>{leaseTime(scope.leaseTimeDays, scope.leaseTimeHours, scope.leaseTimeMinutes)}</dd>
            </div>
            <div>
              <dt>Router Address</dt>
              <dd>{scope.routerAddress || word('None')}</dd>
            </div>
            <div>
              <dt>DNS Servers</dt>
              <dd>{dns}</dd>
            </div>
            <div>
              <dt>Domain Name</dt>
              <dd>{scope.domainName || word('None')}</dd>
            </div>
          </dl>
        </div>
      </Card>
    </div>
  )
}
