import { Fragment, useState } from 'react'
import { DataTable } from '../../ui/DataTable'
import { Details } from '../../ui/Details'
import { DomainName } from '../../ui/DomainName'
import { Raw } from '../../ui/Raw'
import { RowAction, Table } from '../../ui/Table'
import tbl from '../../ui/Table.module.css'
import { RecordType } from './ResponseSections'
import { asDatagram, ownerName, rcodeColour } from './response'
import styles from './RawResponses.module.css'

/*
"Raw Responses (N)": the second panel of upstream's accordion (dnsclient.js:178-194),
collapsed, and absent when the list is empty. Upstream stacks one JSON block per
response; the recursive resolver's walk can be sixteen of them, and the question a
user opens this panel with ("which server said what, and where did it stop?") meant
scrolling through all sixteen.

Here each response is one row first (deviation 18): the server that sent it, the
question it answered, its response code in the Dashboard's colour, its three
section counts and its round trip, all read from that datagram. Each row opens its
own JSON, the same text upstream prints for it, so nothing upstream shows is more
than one press away.

Words of ours: the headers `Name Server`, `Question`, `RCODE`, `Answer`,
`Authority`, `Additional`, `Round Trip Time`, and the row toggle's names `Show raw
response N` and `Hide raw response N`.
*/
export function RawResponses({ responses }: { responses: unknown[] }) {
  const [open, setOpen] = useState<Set<number>>(() => new Set())
  const n = responses.length

  function toggle(i: number) {
    setOpen((s) => {
      const next = new Set(s)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      return next
    })
  }

  return (
    <Details className={styles.raw} summary={`Raw Responses (${n})`}>
      <div className={styles.frame}>
        <DataTable>
        <Table
          stack
          header={
            <>
              <th className={styles.num}>#</th>
              <th>Name Server</th>
              <th>Question</th>
              <th className={styles.narrow}>RCODE</th>
              <th className={styles.narrow}>Answer</th>
              <th className={styles.narrow}>Authority</th>
              <th className={styles.narrow}>Additional</th>
              <th className={styles.narrow}>Round Trip Time</th>
              <th className={styles.narrow} />
            </>
          }
        >
          {responses.map((r, i) => {
            const d = asDatagram(r)
            const q = d?.Question?.[0]
            const shown = open.has(i)
            return (
              <Fragment key={i}>
                <tr>
                  <td className={styles.num}>{i + 1}</td>
                  <td className={`${tbl.lead} ${styles.mono}`}>{d?.Metadata?.NameServer}</td>
                  <td>
                    {q != null && (
                      <span className={styles.question}>
                        <span className={styles.mono}><DomainName name={ownerName(q.Name)} /></span>
                        <RecordType type={q.Type ?? ''} />
                      </span>
                    )}
                  </td>
                  <td>
                    {d?.RCODE != null && (
                      <span className={styles.rcode}>
                        <span className={styles.dot} style={{ background: rcodeColour(d.RCODE) }} />
                        {d.RCODE}
                      </span>
                    )}
                  </td>
                  <td className={styles.count}>{d?.Answer?.length}</td>
                  <td className={styles.count}>{d?.Authority?.length}</td>
                  <td className={styles.count}>{d?.Additional?.length}</td>
                  <td className={styles.mono}>{d?.Metadata?.RoundTripTime}</td>
                  <td className={tbl.actionsCell}>
                    <div className={tbl.actions}>
                      <RowAction
                        icon={shown ? 'chevronDown' : 'chevronRight'}
                        name={`${shown ? 'Hide' : 'Show'} raw response ${i + 1}`}
                        aria-expanded={shown}
                        onClick={() => toggle(i)}
                      />
                    </div>
                  </td>
                </tr>
                {shown && (
                  <tr className={styles.open}>
                    <td colSpan={9}>
                      <Raw text={`Raw response ${i + 1} of ${n}`} height={220}>
                        {JSON.stringify(r, null, 2)}
                      </Raw>
                    </td>
                  </tr>
                )}
              </Fragment>
            )
          })}
        </Table>
        </DataTable>
      </div>
    </Details>
  )
}
