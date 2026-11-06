import type { CSSProperties } from 'react'
import { Tag } from '../../ui/Tag'
import styles from './AdminLists.module.css'

/* The pieces the Users, Groups and Sessions tables share (deviation 23). */

/** A filter set from the strip, in the toolbar: its word, pressed to clear it. */
export function Applied({ label, colour, onClear }: { label: string; colour: string; onClear: () => void }) {
  return (
    <button
      type="button"
      className={styles.applied}
      style={{ '--sw': colour } as CSSProperties}
      aria-label={`${label}, Clear`}
      onClick={onClear}
    >
      {label}
      <span className={styles.clear} aria-hidden="true">Clear</span>
    </button>
  )
}

/** A login's date on the row's line, or `Never`. */
export function LoginDate({ date, never }: { date: string; never: boolean }) {
  return never ? <span className={styles.never}>Never</span> : <span className={styles.mono}>{date}</span>
}

/*
SSO's and LDAP's state on the header line (deviation 23): `Enabled` or `Disabled`
as the server saved it, and `Not configured` while what the login needs is empty
(SSO: the authority and the client ID; LDAP: the server). Read from the `get` the
form already makes.
*/
export function ConfigState({ enabled, configured }: { enabled: boolean; configured: boolean }) {
  return (
    <>
      {enabled ? <Tag tone="ok">Enabled</Tag> : <Tag>Disabled</Tag>}
      {!configured && <Tag tone={enabled ? 'warn' : 'neutral'}>Not configured</Tag>}
    </>
  )
}
