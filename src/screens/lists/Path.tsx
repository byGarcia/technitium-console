import { ancestors } from './Tree'
import styles from './Lists.module.css'

/*
Where you are in the tree, written out.

Upstream says it in one place only, inside `N records at <node>`, in mono and
with no path. On a three-level tree that does not tell you what the node you are
looking at hangs off, and this screen is a tree.

## Why it does not navigate

Because navigating is the tree's job. A second clickable path would be a second
way to do the same thing —behaviour upstream does not have— and this round is
design only. So it is a paragraph and not a list of links: nothing here is
focusable, and the separators are hidden from the screen reader, which reads the
domains and not the chevrons.

The `<ROOT>` at the head is not decoration: it is the same literal the count bar
uses when `domain` is empty (`Lists.tsx`), so the two sides of the screen name
the same node the same way.
*/
export function Path({ domain, label }: {
  /** The open node. Empty string is the root. */
  domain: string
  /** What to call the node; the IDN form when there is one. */
  label: string
}) {
  const chain = ancestors(domain)
  const atRoot = domain === ''

  return (
    <p className={styles.path}>
      <span className={styles.pathLabel}>Node</span>
      <span className={[styles.pathRoot, atRoot && styles.pathHere].filter(Boolean).join(' ')}>
        &lt;ROOT&gt;
      </span>
      {chain.map((parent) => (
        <span key={parent} style={{ display: 'contents' }}>
          <span className={styles.pathSep} aria-hidden="true">&rsaquo;</span>
          <span className={styles.pathUp}>{parent}</span>
        </span>
      ))}
      {!atRoot && (
        <>
          <span className={styles.pathSep} aria-hidden="true">&rsaquo;</span>
          <span className={styles.pathHere}>{label}</span>
        </>
      )}
    </p>
  )
}
