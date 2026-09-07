import type { ReactNode } from 'react'
import styles from './Tag.module.css'

/*
A pill says ONE state. The five tones and what they mean:

  · neutro — a classification fact that is neither good nor bad: `Primary`, `IPv4`
  · ok     — the desirable state: `Enabled`, `Online`
  · warn   — something wants attention but works: `Updating`, `Expiring`
  · dan    — it is broken or switched off: `Disabled`, `Expired`
  · info   — an active feature that is not a judgement: `DNSSEC`

No pill is painted outside this: counts go in the bar above the table, not in a
capsule with this same look.
*/

/*
`acc` is the sixth and the youngest: the pill that **names the master switch** of
a control that is off. The phase 1 vocabulary gives it the amber because "amber =
you can": that is off and **you** can switch it on, which is the opposite of the
padlock. `warn` would not do because it means "careful", and using it here would
confuse "be careful" with "this is yours to change".

Sixth in this list and fifth in `tones.module.css`: `neutral` has no tone class.
And it is sixth for what it MEANS, not for how it looks: against `warn` it gives
ΔE00 8.8 on the text and 0.0 on the fill, below the collision threshold of
`dev/palette-distance.mjs`. It stands because today the two never meet on one
screen, and `dev/master-switch-signal.test.mjs` is the guard that warns if that
changes.
*/
export type TagTone = 'neutral' | 'ok' | 'warn' | 'dan' | 'info' | 'acc'

export function Tag({ tone = 'neutral', children }: { tone?: TagTone; children: ReactNode }) {
  return (
    <span className={`${styles.tag}${tone === 'neutral' ? '' : ` ${styles[tone]}`}`}>
      {children}
    </span>
  )
}

/** The code chip: a record type, an app's class. Neither round nor coloured: it
 *  does not say whether something is good or bad, it says WHAT it is. */
export function Chip({ children }: { children: ReactNode }) {
  return <span className={styles.chip}>{children}</span>
}
