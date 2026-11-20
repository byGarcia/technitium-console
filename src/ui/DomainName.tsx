import { Fragment } from 'react'
import styles from './DomainName.module.css'

/*
A domain name that wraps at its dots and nowhere else.

It used to be the text alone with `word-break: break-word` on the button that
holds it, and that rule does more than break a name that does not fit: it lets the
browser size the column as if the name could break after ANY letter. At 390 px the
Zones column shrank to five characters and `0.30.172.in-addr.arpa` came out in four
lines cut through the middle of its labels. A hyphen is no better place: `in-addr`
is one label, and the browser breaks after a hyphen of its own accord.

So each label (with the dot that closes it) is one unbreakable piece, and a `<wbr>`
after the dot is the only place a line may end. The column is then as narrow as
the longest label and no narrower; a table that cannot fit that scrolls, which is
what the table wrapper is for.

Nothing changes in what is read: `<wbr>` carries no text, so the accessible name,
the copied text and the find-in-page match are the name as the server sent it.
The root (`.`) and an empty name are left as plain text.

A name with no dot is one label, and it is one piece too. It used to be left as
plain text, so a record's relative name broke after its hyphen: at 1440 the
records' Name column was 125 px beside a Data column of 700, and
`living-room-tv` read `living-room-` over `tv`. As one piece it sets the column's
minimum instead.

Except a label longer than LONG_LABEL characters (a DNS label can have 63). Kept
whole, it set a records Name column of 500 px at 1440 and ran out of its card at
390, cut at the edge (2026-11-20). Such a label is the one piece that may wrap
inside itself: at its hyphens, which a name that long is made of, and at the edge
of the line only when it has none (`overflow-wrap: break-word`, which does not
shrink a column). 32 is the cap of a zone's records Name column (`.ownerName` in
Zones.module.css), so a label kept whole always fits that column.
*/
export const LONG_LABEL = 32

const piece = (text: string, label: string) =>
  <span className={label.length > LONG_LABEL ? styles.long : styles.label}>{text}</span>

export function DomainName({ name }: { name: string }) {
  if (name === '' || name === '.') return <>{name}</>
  if (!name.includes('.')) return piece(name, name)

  const labels = name.split('.')
  const last = labels.length - 1
  return (
    <>
      {labels.map((label, i) => (
        <Fragment key={i}>
          {piece(i < last ? `${label}.` : label, label)}
          {i < last && <wbr />}
        </Fragment>
      ))}
    </>
  )
}
