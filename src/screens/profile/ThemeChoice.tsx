import { Panel } from '../../ui/Panel'
import { useTheme } from '../../theme/useTheme'
import type { OfferedTheme } from '../../theme/theme'
import styles from './Profile.module.css'

/*
The Change Theme dialog's choice, on the page (deviation 21): the same three
options with the same labels (main.js:3215-3305, `modalChangeTheme`), each applying
and storing its theme the moment it is picked, with no Save, exactly as the dialog
does (`useTheme().setChoice`). A stored `amber` checks none, as there. The account
menu's `Change Theme` is still there and opens the dialog.

Each option shows the theme it picks: a small sketch of the console drawn inside
an element that carries that theme's `data-theme`, so its colours are the theme's
own tokens and change with them. System is half light and half dark. The sketch is
decoration (`aria-hidden`); the radio and its label say the choice.
*/

const OPTIONS: { value: OfferedTheme; label: string }[] = [
  { value: 'system', label: 'Use System Theme (default)' },
  { value: 'light', label: 'Light Theme' },
  { value: 'dark', label: 'Dark Theme' },
]

function Sketch({ theme }: { theme: 'light' | 'dark' }) {
  return (
    <span className={styles.sketch} data-theme={theme}>
      <span className={styles.sketchSide}>
        <i />
        <i />
        <i />
      </span>
      <span className={styles.sketchMain}>
        <i className={styles.sketchTitle} />
        <span className={styles.sketchCards}>
          <i />
          <i />
        </span>
        <i className={styles.sketchAcc} />
      </span>
    </span>
  )
}

export function ThemeChoice() {
  const { choice, setChoice } = useTheme()
  const checked = choice === 'amber' ? '' : (choice ?? 'system')

  return (
    <Panel title="Theme">
      <div className={styles.themes} role="radiogroup" aria-label="Theme">
        {OPTIONS.map((o) => (
          <label key={o.value} className={styles.theme} data-checked={checked === o.value || undefined}>
            <span className={styles.preview} aria-hidden="true">
              {o.value === 'system' ? (
                <>
                  <Sketch theme="light" />
                  <Sketch theme="dark" />
                </>
              ) : (
                <Sketch theme={o.value} />
              )}
            </span>
            <span className={styles.themeLabel}>
              <input
                type="radio"
                name="rdProfileTheme"
                value={o.value}
                checked={checked === o.value}
                onChange={() => setChoice(o.value)}
              />
              {o.label}
            </span>
          </label>
        ))}
      </div>
    </Panel>
  )
}
