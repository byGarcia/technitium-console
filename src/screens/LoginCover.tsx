import type { CSSProperties } from 'react'
import styles from './LoginCover.module.css'

/*
The login cover, OURS: a brand panel beside the stock login form. It is a
deliberate deviation from upstream (CONVENTIONS.md, "Deliberate deviations from
upstream behaviour", 2026-10-15), and it only changes the layout around the
form: every field, text, step and alert of `Login.tsx` is upstream's and stays so.

Every word in this file is OURS: the name `technitium-console`, the headline,
the `;; ANSWER SECTION:` line and the four TXT records (keys and values). They
are written so they do not age: nothing says "new", and each line is true of the
console as it ships today, which is why a line has to change the day it stops
being true. No screenshot and no figure is drawn here, because the panel is shown
before anyone has logged in and anything resembling data would be invented.

The look is the project's social banner: a thin amber rule, the name in Plex
Mono with an amber dot, an Archivo headline and a dig-style answer block.
*/

export const COVER_NAME = 'technitium-console'
export const COVER_HEADLINE = 'The same DNS server, in a rebuilt console.'

/** The answer block: one TXT record per thing the console offers. */
export const COVER_RECORDS: readonly { key: string; value: string }[] = [
  { key: 'features.', value: 'every stock feature, same API' },
  { key: 'blocking.', value: 'rules and lists in one place' },
  { key: 'themes.', value: 'light, dark or system' },
  { key: 'phone.', value: 'works on a phone' },
]

export function LoginCover() {
  return (
    <aside className={styles.cover}>
      <p className={styles.name}>
        <span className={styles.dot} aria-hidden="true" />
        <span>{COVER_NAME}</span>
        {/* The version from package.json, injected at build time (vite.config.ts). */}
        <span className={styles.version}>v{__CONSOLE_VERSION__}</span>
      </p>

      <p className={styles.headline}>{COVER_HEADLINE}</p>

      {/* The record type and the quotes are what makes it read as dig output;
          to a screen reader they are noise, so each row reads as
          "features. every stock feature, same API". */}
      <div className={styles.answer} data-testid="cover-answer">
        <span className={styles.section} aria-hidden="true">
          ;; ANSWER SECTION:
        </span>
        <ul className={styles.records}>
          {COVER_RECORDS.map((r, i) => (
            <li key={r.key} className={styles.record} style={{ '--row': i } as CSSProperties}>
              <span className={styles.key}>{r.key}</span>
              <span className={styles.type} aria-hidden="true">
                TXT
              </span>
              <span className={styles.value}>
                <span aria-hidden="true">"</span>
                {r.value}
                <span aria-hidden="true">"</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  )
}
