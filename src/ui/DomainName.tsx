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
the copied text and the find-in-page match are the name as the server sent it. A
name with no dot (`<root>`, `@`, a single label) is left as plain text.
*/
export function DomainName({ name }: { name: string }) {
  if (!name.includes('.') || name === '.') return <>{name}</>

  const labels = name.split('.')
  const last = labels.length - 1
  return (
    <>
      {labels.map((label, i) => (
        <Fragment key={i}>
          <span className={styles.label}>{i < last ? `${label}.` : label}</span>
          {i < last && <wbr />}
        </Fragment>
      ))}
    </>
  )
}
