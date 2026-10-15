import type { BlockingMark as Mark } from '../screens/blocking/blocking-state'
import text from '../ui/text.module.css'
import styles from './BlockingMark.module.css'

/*
The sidebar's mark on Blocking: whether blocking is disabled or paused, from
anywhere in the console. OURS; what it says and when it reads are in
`screens/blocking/blocking-state.ts`. The only count or state the sidebar carries.

The link's accessible name gains the sentence (`Blocking, paused until 14:30`)
through hidden text, so the link keeps a name made of its own content; the short
word is drawn and hidden from assistive technology, which already has the
sentence. The Shell puts the same sentence in the link's `title`.
*/

export function BlockingMark({ mark }: { mark: Mark | null }) {
  if (mark == null) return null
  return (
    <>
      <span className={text.sr}>{mark.label.replace(/^Blocking/, '')}</span>
      <span className={styles.mark} data-tone={mark.tone} aria-hidden="true">
        {mark.text}
      </span>
    </>
  )
}
