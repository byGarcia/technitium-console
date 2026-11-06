import { Tag } from '../../ui/Tag'
import { Button } from '../../ui/Button'
import { useId, useState, type CSSProperties } from 'react'
import type { DnsRecord } from '../../api/zonelists'
import { rdataEntries, extras, meta, splitTtl, type Entry } from './record'
import { dnssecTone, isStale } from './cache-facts'
import { recordColour } from '../zones/zone-colours'
import tbl from '../../ui/Table.module.css'
import { RowAction, Table } from '../../ui/Table'
import styles from './Lists.module.css'

/*
The table that replaces the `<pre>` with the raw JSON.

Only HOW it reads changes: there is not one new control. The two row buttons
("RRSIG" and "Glue") call no endpoint: they expand fields that already came in
the same JSON (`dnssecRecords` and `glueRecords`) and that in upstream's dump read
just as badly as the rest.
*/

/*
A record type in its series colour (`zones/zone-colours`), the word in the colour on
a tint of it, as Zones draws its records' types (2026-11-06, deviation 16): a column
of types reads by colour before it is read, and the type is the same colour on the
Cache cards above. Allowed and Blocked share this table and get it too.
*/
export function RecordType({ type }: { type: string }) {
  return (
    <span className={styles.rtype} style={{ '--rt': recordColour(type) } as CSSProperties}>
      {type}
    </span>
  )
}

// The same cut-off as in Zones: it was 48 here and 64 there, for the same control.
const CUTOFF = 64

/*
Only a long value with no spaces breaks by characters: a key, a signature, a hex
string. Everything else, an address, a name, a type name or the server's
sentence for a negative answer (`NegativeCache: NoError; com. 637 IN SOA …`),
ends its lines between words. Every value used to take the key's `break-all`,
which also told the table the Data column could shrink to one letter: at 1024
and at 390 it did, and one record of `google.com` stood 1,671 px tall, a letter
per line.
*/
function Value({ e }: { e: Entry }) {
  const [open, setOpen] = useState(false)
  const cls = e.long && !/\s/.test(e.value) ? styles.key : styles.words

  if (!e.long || open) return <span className={cls}>{e.value}</span>

  return (
    <>
      <span className={cls}>{e.value.slice(0, CUTOFF)}…</span>{' '}
      <button type="button" className={styles.showIt} onClick={() => setOpen(true)}>
        show full
      </button>
    </>
  )
}

/*
The record's data on one line (2026-10-16). It was a two-column `dl`, a label
over each value, so a DNSKEY stood five lines tall and a DS four, and at `com`
four records took 640 px. Now the pairs run inline, label in grey and value in
ink, and wrap between pairs only when the cell is full: the same DS reads on one
line at 1440.

A record with a single field drops its label from the screen and keeps it for
the screen reader (`.srOnly`): `IP Address` in front of every A record said
again what the type chip beside it already says. Nothing is removed: the label
is still in the page, in find and in the copy.
*/
function Inline({ entries, className, bare = false }: {
  entries: Entry[]
  className?: string
  /** A lone field shows its value alone (the rData of an A, an NS, a CNAME). */
  bare?: boolean
}) {
  if (entries.length === 0) return null
  const single = bare && entries.length === 1
  return (
    <dl className={[styles.inline, className].filter(Boolean).join(' ')}>
      {entries.map((e) => (
        <div key={e.key} className={styles.pair}>
          <dt className={single ? styles.srOnly : undefined}>{e.key}</dt>
          <dd>
            <Value e={e} />
          </dd>
        </div>
      ))}
    </dl>
  )
}

/*
A record on ONE line, its details folded (Cache, 2026-11-06, deviation 16). The
row says what the record is: its type, its time left, its data and its DNSSEC
state. Where the answer came from, when it was used, a name server's health and
the glue and signatures that came with it are one press away, in the row's
Details, which opens a line under it. Nothing is dropped: it is the same text the
two-line row wrote, and the glue and RRSIG blocks its two buttons opened.
*/
function CompactRow({ r, node }: { r: DnsRecord; node: string }) {
  const [open, setOpen] = useState(false)
  const ttl = splitTtl(r)
  const extra = extras(r)
  const name = r.nameIdn ?? r.name
  const differentName = r.name !== node && name !== node
  const detail = useId()

  return (
    <>
      <tr className={open ? styles.openRow : undefined}>
        <td className={tbl.lead}>
          <RecordType type={r.type} />
          {differentName && <span className={styles.name}>{name === '' ? '<ROOT>' : name}</span>}
        </td>
        <td className={styles.ttl}>
          {ttl.value} {ttl.human && <small>({ttl.human})</small>}
          {isStale(r) && <span className={styles.stale}><Tag tone="warn">Stale</Tag></span>}
        </td>
        <td>
          <Inline entries={rdataEntries(r.rData)} bare />
        </td>
        <td>
          <Tag tone={dnssecTone(r.dnssecStatus)}>{r.dnssecStatus ?? '—'}</Tag>
        </td>
        <td className={tbl.actionsCell}>
          <div className={tbl.actions}>
            <RowAction
              icon={open ? 'chevronDown' : 'chevronRight'}
              name="Details"
              aria-expanded={open}
              aria-controls={detail}
              onClick={() => setOpen((v) => !v)}
            />
          </div>
        </td>
      </tr>
      {open && (
        <tr id={detail} className={styles.detailRow}>
          <td colSpan={5}>
            <div className={styles.meta}>
              <span title={r.lastUsedOn}>{meta(r).join(' · ')}</span>
              {extra.length > 0 && <Inline entries={extra} className={styles.extra} />}
            </div>
            {r.glueRecords && (
              <>
                <div className={styles.detailLabel}>Glue</div>
                <pre className={styles.signatures}>{r.glueRecords.join('\n')}</pre>
              </>
            )}
            {r.dnssecRecords && (
              <>
                <div className={styles.detailLabel}>RRSIG</div>
                <pre className={styles.signatures}>{r.dnssecRecords.join('\n')}</pre>
              </>
            )}
          </td>
        </tr>
      )}
    </>
  )
}

function Row({ r, withDnssec, node }: { r: DnsRecord; withDnssec: boolean; node: string }) {
  const [signatures, setSignatures] = useState(false)
  const [glue, setGlue] = useState(false)

  const ttl = splitTtl(r)
  const extra = extras(r)
  const name = r.nameIdn ?? r.name
  // The name always matches the open node; it is only said when it does NOT.
  const differentName = r.name !== node && name !== node

  return (
    <tr>
      <td className={tbl.lead}>
        <RecordType type={r.type} />
        {differentName && <span className={styles.name}>{name === '' ? '<ROOT>' : name}</span>}
      </td>
      <td className={styles.ttl}>
        {ttl.value} {ttl.human && <small>({ttl.human})</small>}
        {/* The server writes a record kept past its TTL as `0 (0s)`; the word says
            so (deviation 16, the Records card's `Stale`). */}
        {isStale(r) && <span className={styles.stale}><Tag tone="warn">Stale</Tag></span>}
      </td>
      <td>
        <Inline entries={rdataEntries(r.rData)} bare />
        {/* The second line: where the answer came from and when it was used, and
            then whatever else the record carries (a name server's health, a field
            the server adds tomorrow). It was a third and fourth block of
            label-over-value rows; it is the grey line now, the same weight as the
            metadata beside it, because none of it is the record's data. */}
        <div className={styles.meta}>
          <span title={r.lastUsedOn}>{meta(r).join(' · ')}</span>
          {extra.length > 0 && <Inline entries={extra} className={styles.extra} />}
        </div>
        {signatures && r.dnssecRecords && (
          <pre className={styles.signatures}>{r.dnssecRecords.join('\n')}</pre>
        )}
        {glue && r.glueRecords && <pre className={styles.signatures}>{r.glueRecords.join('\n')}</pre>}
      </td>
      {withDnssec && (
        <td>
          <Tag tone={dnssecTone(r.dnssecStatus)}>
            {r.dnssecStatus ?? '—'}
          </Tag>
        </td>
      )}
      <td className={tbl.actionsCell}>
        <div className={tbl.actions}>
          {r.glueRecords && (
            <Button
              size="sm"
              aria-pressed={glue}
              onClick={() => setGlue((v) => !v)}
            >
              Glue
            </Button>
          )}
          {r.dnssecRecords && (
            <Button
              size="sm"
              aria-pressed={signatures}
              onClick={() => setSignatures((v) => !v)}
            >
              RRSIG
            </Button>
          )}
        </div>
      </td>
    </tr>
  )
}

export function ResourceRecords({
  records,
  withDnssec,
  node,
  compact = false,
}: {
  records: DnsRecord[]
  /** The DNSSEC column belongs to Cache only; elsewhere it drops to the grey line. */
  withDnssec: boolean
  node: string
  /** One line per record, the rest under Details (Cache). */
  compact?: boolean
}) {
  if (compact) {
    return (
      <Table
        stack
        header={
          <>
            <th style={{ width: 110 }}>Type</th>
            <th style={{ width: 150 }}>TTL</th>
            <th>Data</th>
            <th style={{ width: 120 }}>DNSSEC</th>
            <th style={{ width: 56 }}>
              <span className="sr-only" />
            </th>
          </>
        }
      >
        {records.map((r, i) => (
          <CompactRow key={`${r.name}|${r.type}|${i}`} r={r} node={node} />
        ))}
      </Table>
    )
  }
  return (
    <Table
      stack
      header={
        <>
          <th style={{ width: 110 }}>Type</th>
          <th style={{ width: 120 }}>TTL</th>
          <th>Data</th>
          {withDnssec && <th style={{ width: 100 }}>DNSSEC</th>}
          <th style={{ width: 120 }}>
            <span className="sr-only" />
          </th>
        </>
      }
    >
      {records.map((r, i) => (
        <Row key={`${r.name}|${r.type}|${i}`} r={r} withDnssec={withDnssec} node={node} />
      ))}
    </Table>
  )
}
