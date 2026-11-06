import { useRef, useState, type CSSProperties } from 'react'
import type { DnsRecord } from '../../api/zonelists'
import { Card, Count, StackBar, hotEvents, statStyles } from '../../ui/StatCard'
import { useTooltip } from '../../ui/Tooltip'
import { recordColour } from '../zones/zone-colours'
import { RecordType } from './Records'
import { byDnssec, byServer, byType, dnssecColour, isNegative, isStale, ttlLeft } from './cache-facts'
import styles from './Lists.module.css'

/*
A CACHE NODE AT A GLANCE (deviation 16 in CONVENTIONS.md, 2026-11-06): up to four
cards over the node's records, drawn only from the records of the `cache/list`
answer on screen (`cache-facts.ts`). They add no call and no control: the cards
follow the node the way the table does, and change only when it does.

  · Records       how many the node holds and of which types, in the series colour
                  each type has everywhere in the console (`zones/zone-colours`),
                  and how many are negative answers.
  · Time Left     the record that leaves the cache first, how soon, the longest
                  time left on any record, and how many are stale (past their TTL).
                  Like the TTL column, it is the time left when the node was read.
  · DNSSEC        the records by validation state.
  · Answered By   the servers the records came from, most first.

Upstream draws none of this: it dumps the records as JSON (other-zones.js:157).
The Records card is always drawn (a count is a fact, so an empty node says 0); a
card whose data the node does not have is left out rather than drawn empty.

Every word on these cards is OURS and part of deviation 16: the four titles, `Next
to expire`, `Longest`, `Stale`, `Negative`, their two sentences below, and `more`.
The DNSSEC states and the server names are the server's own.
*/

const STALE_WHY = 'Its TTL has run out. The server keeps it for Serve Stale and shows its TTL as 0 (0s).'
const NEGATIVE_WHY = 'A cached answer that the name, or a record of that type, does not exist.'

/** The servers listed on the Answered By card; the rest are counted in one line. */
const SERVERS_SHOWN = 4

/** A fact whose meaning is not on the screen: a dotted label, and its sentence in a
 *  bubble on hover and on focus (the Zones card's `Not used since restart`). */
function Explained({ label, value, why }: { label: string; value: number; why: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const tip = useTooltip({ text: why, placement: 'top', anchor: ref })
  return (
    <div ref={ref} className={statStyles.explained} tabIndex={0} aria-describedby={tip.describedBy()} {...tip.events}>
      <dt>{label}</dt>
      <dd>
        <Count value={value} />
        {tip.bubble}
      </dd>
    </div>
  )
}

export function CacheSummary({
  records,
  activeType,
  onType,
}: {
  records: DnsRecord[]
  /** The type the records table is narrowed to, `''` for none. */
  activeType: string
  /** Pressing a type narrows the table to it; pressing the pressed one clears it. */
  onType: (type: string) => void
}) {
  /* The type, and the DNSSEC state, lit by hovering its key or its fact (`StackBar`). */
  const [hotType, setHotType] = useState<string | null>(null)
  const [hotState, setHotState] = useState<string | null>(null)

  const types = byType(records)
  const states = byDnssec(records)
  const servers = byServer(records)
  const left = ttlLeft(records)
  const stale = records.filter(isStale).length
  const negative = records.filter(isNegative).length
  const bogus = states.find(([s]) => s === 'Bogus')?.[1] ?? 0
  const secure = states.find(([s]) => s === 'Secure')?.[1] ?? 0
  const shown = servers.slice(0, SERVERS_SHOWN)
  const others = servers.length - shown.length

  return (
    <div className={statStyles.grid}>
      <Card title="Records" colour="var(--ch-cache)">
        <div className={statStyles.body}>
          <div className={statStyles.figure}><Count value={records.length} /></div>
          <StackBar
            label={types.map(([t, n]) => `${t} ${n}`).join(', ')}
            parts={types.map(([t, n]) => ({ key: t, name: t, value: n, colour: recordColour(t) }))}
            hot={hotType}
            onHot={setHotType}
          />
          {types.length > 0 && (
            /* Each type narrows the records table to it, as a zone's Records card
               does; the table says so in its foot. */
            <div className={statStyles.types} role="group" aria-label="Records by type">
              {types.map(([t, n]) => (
                <button
                  key={t}
                  type="button"
                  className={statStyles.typeChip}
                  style={{ '--sw': recordColour(t) } as CSSProperties}
                  aria-pressed={activeType === t}
                  data-hot={hotType === t || undefined}
                  onClick={() => onType(activeType === t ? '' : t)}
                  {...hotEvents(t, setHotType)}
                >
                  <span className={statStyles.typeName}>{t}</span>
                  <span className={statStyles.typeCount}>{n}</span>
                </button>
              ))}
            </div>
          )}
          <dl className={statStyles.facts}>
            <Explained label="Negative" value={negative} why={NEGATIVE_WHY} />
          </dl>
        </div>
      </Card>

      {(left != null || stale > 0) && (
        <Card title="Time Left" colour="var(--ch-total)">
          <div className={statStyles.body}>
            {left != null && (
              <dl className={styles.left}>
                <div>
                  <dt>Next to expire</dt>
                  <dd>
                    <span className={statStyles.figure}>{left.next.human}</span>
                    <RecordType type={left.next.record.type} />
                  </dd>
                </div>
              </dl>
            )}
            <dl className={statStyles.facts}>
              {left != null && (
                <div>
                  <dt>Longest</dt>
                  <dd>{left.longest}</dd>
                </div>
              )}
              <Explained label="Stale" value={stale} why={STALE_WHY} />
            </dl>
          </div>
        </Card>
      )}

      {states.length > 0 && (
        <Card title="DNSSEC" colour={bogus > 0 ? 'var(--dan)' : secure > 0 ? 'var(--ok)' : 'var(--ch-drop)'}>
          <div className={statStyles.body}>
            <dl className={styles.states}>
              {states.map(([s, n]) => (
                <div key={s} data-hot={hotState === s || undefined} {...hotEvents(s, setHotState)}>
                  <dt>
                    <span className={statStyles.dot} style={{ background: dnssecColour(s) }} /> {s}
                  </dt>
                  <dd className={s === 'Bogus' && n > 0 ? statStyles.bad : undefined}>
                    <Count value={n} />
                  </dd>
                </div>
              ))}
            </dl>
            <StackBar
              label={states.map(([s, n]) => `${s} ${n}`).join(', ')}
              parts={states.map(([s, n]) => ({ key: s, name: s, value: n, colour: dnssecColour(s) }))}
              hot={hotState}
              onHot={setHotState}
            />
          </div>
        </Card>
      )}

      {servers.length > 0 && (
        <Card title="Answered By" colour="var(--ch-rec)">
          <ul className={`${statStyles.body} ${styles.servers}`} aria-label="Answered By">
            {shown.map(([server, n]) => (
              <li key={server}>
                <span className={styles.server}>{server}</span>
                <span className={styles.serverCount}>{n}</span>
              </li>
            ))}
            {others > 0 && <li className={statStyles.caption}>{others} more</li>}
          </ul>
        </Card>
      )}
    </div>
  )
}
