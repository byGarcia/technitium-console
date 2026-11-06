import { useRef, useState, type CSSProperties } from 'react'
import { Card, Count, StackBar, hotEvents, statStyles as stat } from '../../ui/StatCard'
import { Tag } from '../../ui/Tag'
import { useTooltip } from '../../ui/Tooltip'
import { recordColour } from '../zones/zone-colours'
import { FLAGS, dnssecTone, countByStatus, countByType, extendedErrors, rcodeColour, type Datagram } from './response'
import styles from './ResponseSummary.module.css'

/*
A RESPONSE AT A GLANCE (deviation 18 in CONVENTIONS.md, 2026-11-06): four cards
over the sections, each built ONLY from the datagram the query just returned
(`response.ts`). Nothing is asked for them and nothing is kept between queries.

  · Response      the response code, in the Dashboard's colour for it, with the
                  opcode, the message ID and the Extended DNS Error codes the
                  answer carries.
  · Answer        how many records answered, by type (`recordColour`, the
                  colour that type has in Zones), and the Authority and
                  Additional counts.
  · Server        who answered, over what, how fast and how big
                  (`Metadata`). Not drawn when the datagram has no `Metadata`.
  · Flags         the six header bits, the EDNS payload size and flags, and the
                  DNSSEC status of the answer's records.

A count is a fact of the response, so a zero is drawn as 0 (DESIGN, rule 4).

Words of ours, all part of deviation 18: the card titles `Response`, `Answer`,
`Server`, `Flags`; the facts `Opcode`, `ID`, `Extended DNS Errors`, `Authority`,
`Additional`, `Name Server`, `Protocol`, `Round Trip Time`, `Datagram Size`,
`UDP Payload Size`, `EDNS Flags`, `DNSSEC`; and the flags' abbreviations (dig's)
with their names in the tooltip, which are the datagram's keys split into words.
*/

export function ResponseSummary({ d }: { d: Datagram }) {
  const [hot, setHot] = useState<string | null>(null)
  const answer = d.Answer ?? []
  const byType = countByType(answer)
  const errors = extendedErrors(d)
  const codes = [...new Set(errors.map((e) => e.infoCode).filter((c) => c !== ''))]
  const statuses = countByStatus(answer)
  const m = d.Metadata

  return (
    <div className={stat.grid}>
      <Card title="Response" colour={rcodeColour(d.RCODE)}>
        <div className={stat.body}>
          <div className={styles.code}>
            <span className={stat.dot} style={{ background: rcodeColour(d.RCODE) }} />
            <span className={stat.figure}>{d.RCODE}</span>
          </div>
          <dl className={stat.facts}>
            {d.OPCODE != null && (
              <div>
                <dt>Opcode</dt>
                <dd>{d.OPCODE}</dd>
              </div>
            )}
            {d.Identifier != null && (
              <div>
                <dt>ID</dt>
                <dd>{d.Identifier}</dd>
              </div>
            )}
          </dl>
          {codes.length > 0 && (
            <dl className={styles.block}>
              <dt>Extended DNS Errors</dt>
              <dd className={styles.tags}>
                {codes.map((c) => (
                  <Tag key={c} tone="warn">{c}</Tag>
                ))}
              </dd>
            </dl>
          )}
        </div>
      </Card>

      <Card title="Answer" colour="var(--ch-total)">
        <div className={stat.body}>
          <div className={stat.figure}><Count value={answer.length} /></div>
          <StackBar
            label={byType.map(([t, n]) => `${t} ${n}`).join(', ')}
            parts={byType.map(([t, n]) => ({ key: t, name: t, value: n, colour: recordColour(t) }))}
            hot={hot}
            onHot={setHot}
          />
          {byType.length > 0 && (
            <ul className={`${stat.types} ${styles.chips}`} aria-label="Answer by type">
              {byType.map(([t, n]) => (
                <li
                  key={t}
                  className={`${stat.typeChip} ${styles.still}`}
                  style={{ '--sw': recordColour(t) } as CSSProperties}
                  data-hot={hot === t || undefined}
                  {...hotEvents(t, setHot)}
                >
                  <span className={stat.typeName}>{t}</span>
                  <span className={stat.typeCount}>{n}</span>
                </li>
              ))}
            </ul>
          )}
          <dl className={stat.facts}>
            <div>
              <dt>Authority</dt>
              <dd>{(d.Authority ?? []).length}</dd>
            </div>
            <div>
              <dt>Additional</dt>
              <dd>{(d.Additional ?? []).length}</dd>
            </div>
          </dl>
        </div>
      </Card>

      {m != null && (
        <Card title="Server" colour="var(--ch-5)">
          <div className={stat.body}>
            <dl className={styles.block}>
              <dt>Name Server</dt>
              <dd className={styles.server}>{m.NameServer}</dd>
            </dl>
            <dl className={`${stat.facts} ${styles.wrapFacts}`}>
              {m.Protocol != null && (
                <div>
                  <dt>Protocol</dt>
                  <dd>{m.Protocol}</dd>
                </div>
              )}
              {m.RoundTripTime != null && (
                <div>
                  <dt>Round Trip Time</dt>
                  <dd>{m.RoundTripTime}</dd>
                </div>
              )}
              {m.DatagramSize != null && (
                <div>
                  <dt>Datagram Size</dt>
                  <dd>{m.DatagramSize}</dd>
                </div>
              )}
            </dl>
          </div>
        </Card>
      )}

      <Card title="Flags" colour={d.AuthenticData === true ? 'var(--info)' : 'var(--ch-drop)'}>
        <div className={stat.body}>
          <ul className={styles.flags} aria-label="Header flags">
            {FLAGS.map((f) => (
              <Flag key={f.key} short={f.short} name={f.name} value={d[f.key]} />
            ))}
          </ul>
          {d.EDNS != null && (
            <dl className={`${stat.facts} ${styles.wrapFacts}`}>
              {d.EDNS.UdpPayloadSize != null && (
                <div>
                  <dt>UDP Payload Size</dt>
                  <dd>{d.EDNS.UdpPayloadSize}</dd>
                </div>
              )}
              {d.EDNS.Flags != null && (
                <div>
                  <dt>EDNS Flags</dt>
                  <dd>{d.EDNS.Flags}</dd>
                </div>
              )}
            </dl>
          )}
          {statuses.length > 0 && (
            <dl className={styles.block}>
              <dt>DNSSEC</dt>
              <dd className={styles.tags}>
                {statuses.map(([s, n]) => (
                  <Tag key={s} tone={dnssecTone(s)}>
                    {s} {n}
                  </Tag>
                ))}
              </dd>
            </dl>
          )}
        </div>
      </Card>
    </div>
  )
}

/*
One header bit: its abbreviation, lit when set. Its name is in the tooltip and,
for a reader, in the item's text with the value the JSON gives it, so the state is
never carried by the colour alone.
*/
function Flag({ short, name, value }: { short: string; name: string; value: boolean | undefined }) {
  const ref = useRef<HTMLLIElement>(null)
  const tip = useTooltip({ text: name, placement: 'top', anchor: ref, describe: false })
  const on = value === true
  return (
    <li ref={ref} className={styles.flag} data-on={on || undefined} tabIndex={0} {...tip.events}>
      <span aria-hidden="true">{short}</span>
      <span className={styles.hidden}>
        {name}: {value == null ? '' : String(value)}
      </span>
      {tip.bubble}
    </li>
  )
}
