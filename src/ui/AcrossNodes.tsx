import type { CSSProperties } from 'react'
import styles from './AcrossNodes.module.css'

/*
Two pieces the `All nodes` views of Query Logs and DHCP share (deviations 37 and
38 in CONVENTIONS.md), drawn as Zones and Cache draw them across nodes
(deviations 33 and 35):

  · `NodeName`: a node's name after a square of its colour, the series colour of
    its place in the session's list of nodes (`dashboard/palette.ts`, `nodeToken`,
    which the caller passes as a CSS value).
  · `NodesFailed`: the nodes that did not answer, each named once with the server's
    message, `<node> did not answer: <message>`, the words of deviation 33, and once
    under them that what is on screen is partial (or that no node answered).

Its words, OURS: `did not answer:`, `Their rows are missing here: only the nodes that
answered are listed.` and `No node answered.`
*/

export interface NodeFailure {
  node: string
  message: string
}

export function NodeName({ name, colour }: { name: string; colour: string }) {
  return (
    <span className={styles.name} style={{ '--nd': colour } as CSSProperties}>
      {name}
    </span>
  )
}

export function NodesFailed({ failed, answered }: { failed: readonly NodeFailure[]; answered: number }) {
  if (failed.length === 0) return null
  return (
    <div className={styles.failed} role="status">
      <ul>
        {failed.map((f) => (
          <li key={f.node}>
            <b>{f.node}</b>
            {` did not answer: ${f.message}`}
          </li>
        ))}
      </ul>
      <p>{answered === 0 ? 'No node answered.' : 'Their rows are missing here: only the nodes that answered are listed.'}</p>
    </div>
  )
}
