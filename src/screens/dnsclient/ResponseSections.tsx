import { useState, type CSSProperties } from 'react'
import { DataTable } from '../../ui/DataTable'
import { DomainName } from '../../ui/DomainName'
import { Raw } from '../../ui/Raw'
import { Segmented } from '../../ui/Segmented'
import { Table } from '../../ui/Table'
import tbl from '../../ui/Table.module.css'
import { Tag } from '../../ui/Tag'
import { recordColour } from '../zones/zone-colours'
import { dnssecTone, extendedErrors, ownerName, rdataPairs, type Datagram, type DnsRecord } from './response'
import styles from './ResponseSections.module.css'

/*
THE RESPONSE, SECTION BY SECTION (deviation 18 in CONVENTIONS.md, 2026-11-06).
Upstream prints the datagram as JSON and nothing else. Here the same object is laid
out in the four sections of a DNS message, each a table, with the type in its
Zones colour, and the JSON is the last tab: the very text upstream prints, whole,
under the same label it always had here.

  · The tabs carry each section's count, so an empty Authority says 0 before it is
    opened. The Answer tab is open first; JSON is first when the server's object is
    not a datagram this screen can lay out.
  · `Extended DNS Errors` is a tab only when the answer carries some: the EDNS
    options of that code and the client library's own, which upstream shows only
    inside the JSON.
  · A record's data is its RDATA as the server keyed it (`rdataPairs`).

Words of ours: the tab names (the datagram's own section keys, and `JSON`),
`Extended DNS Errors`, the column headers `Name`, `Type`, `Class`, `TTL`, `Data`,
`DNSSEC`, `Source`, `Info Code`, `Extra Text`, the sources `EDNS` and `DNS
Client`, and `No Record Found` (the zone table's own words for an empty table).
*/

type Tab = 'question' | 'answer' | 'authority' | 'additional' | 'errors' | 'json'

export function ResponseSections({
  d,
  json,
  label,
}: {
  /** The datagram, or null when the server's object is not one. */
  d: Datagram | null
  /** Upstream's output: `JSON.stringify(result, null, 2)`. */
  json: string
  /** The JSON block's accessible name. */
  label: string
}) {
  const errors = d == null ? [] : extendedErrors(d)
  const [tab, setTab] = useState<Tab>(d == null ? 'json' : 'answer')

  const options: { id: Tab; label: string }[] =
    d == null
      ? [{ id: 'json', label: 'JSON' }]
      : [
          { id: 'question', label: `Question (${(d.Question ?? []).length})` },
          { id: 'answer', label: `Answer (${(d.Answer ?? []).length})` },
          { id: 'authority', label: `Authority (${(d.Authority ?? []).length})` },
          { id: 'additional', label: `Additional (${(d.Additional ?? []).length})` },
          ...(errors.length > 0 ? [{ id: 'errors' as const, label: `Extended DNS Errors (${errors.length})` }] : []),
          { id: 'json', label: 'JSON' },
        ]

  return (
    <DataTable toolbar={<Segmented asTabs flat label="Response sections" options={options} active={tab} onChoose={setTab} />}>
      {tab === 'json' || d == null ? (
        <div className={styles.json}>
          <Raw text={label}>{json}</Raw>
        </div>
      ) : tab === 'question' ? (
        <Table
          stack
          header={
            <>
              <th>Name</th>
              <th className={styles.narrow}>Type</th>
              <th className={styles.narrow}>Class</th>
            </>
          }
          isEmpty={(d.Question ?? []).length === 0}
          emptyText="No Record Found"
          columns={3}
        >
          {(d.Question ?? []).map((q, i) => (
            <tr key={i}>
              <td className={`${tbl.lead} ${styles.mono}`}><DomainName name={ownerName(q.Name)} /></td>
              <td className={tbl.lead}><RecordType type={q.Type ?? ''} /></td>
              <td>{q.Class}</td>
            </tr>
          ))}
        </Table>
      ) : tab === 'errors' ? (
        <Table
          stack
          header={
            <>
              <th className={styles.narrow}>Source</th>
              <th>Info Code</th>
              <th>Extra Text</th>
            </>
          }
          columns={3}
        >
          {errors.map((e, i) => (
            <tr key={i}>
              <td className={styles.narrow}>{e.source}</td>
              <td className={tbl.lead}><Tag tone="warn">{e.infoCode}</Tag></td>
              <td className={styles.text}>{e.extraText}</td>
            </tr>
          ))}
        </Table>
      ) : (
        <Records records={(tab === 'answer' ? d.Answer : tab === 'authority' ? d.Authority : d.Additional) ?? []} />
      )}
    </DataTable>
  )
}

function Records({ records }: { records: DnsRecord[] }) {
  return (
    <Table
      stack
      header={
        <>
          <th className={styles.name}>Name</th>
          <th className={styles.narrow}>Type</th>
          <th className={styles.narrow}>Class</th>
          <th className={styles.ttl}>TTL</th>
          <th>Data</th>
          <th className={styles.narrow}>DNSSEC</th>
        </>
      }
      isEmpty={records.length === 0}
      emptyText="No Record Found"
      columns={6}
    >
      {records.map((r, i) => (
        /* A run of records with one owner draws the name once, as a zone's records
           do: the rows under it carry it faded out, for a reader and for the
           stacked card, where each record stands alone. */
        <tr key={i} className={i > 0 && records[i - 1].Name === r.Name ? styles.repeat : undefined}>
          <td className={`${tbl.lead} ${styles.mono} ${styles.owner}`}><DomainName name={ownerName(r.Name)} /></td>
          <td className={tbl.lead}><RecordType type={r.Type ?? ''} /></td>
          <td>{r.Class}</td>
          <td className={`${styles.mono} ${styles.ttl}`}>{r.TTL}</td>
          <td>
            <Data record={r} />
          </td>
          <td>
            <Status status={r.DnssecStatus} />
          </td>
        </tr>
      ))}
    </Table>
  )
}

/*
A record's DNSSEC status as a state. `Disabled` is the server saying validation
was not asked for: on every row of every answer without it, a pill would be noise,
so it is the quiet word instead.
*/
function Status({ status }: { status: string | undefined }) {
  if (status == null) return null
  if (status === 'Disabled') return <span className={styles.quiet}>{status}</span>
  return <Tag tone={dnssecTone(status)}>{status}</Tag>
}

/** A record type in the colour it has everywhere (`recordColour`), its name written. */
export function RecordType({ type }: { type: string }) {
  return (
    <span className={styles.rtype} style={{ '--rt': recordColour(type) } as CSSProperties}>
      {type}
    </span>
  )
}

/*
The RDATA: one value alone, or each key in the quiet label colour before its value.
Values are DNS data, so they are mono; a long key or signature wraps where it must
(`overflow-wrap: break-word`), never letter by letter in a short word.
*/
function Data({ record }: { record: DnsRecord }) {
  const pairs = rdataPairs(record.RDATA)
  if (pairs.length === 0) return null
  if (pairs.length === 1) return <span className={styles.value}>{pairs[0][1]}</span>
  return (
    <dl className={styles.pairs}>
      {pairs.map(([k, v]) => (
        <div key={k}>
          <dt>{k}</dt>
          <dd className={styles.value}>{v}</dd>
        </div>
      ))}
    </dl>
  )
}
