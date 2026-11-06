import { Panel } from '../../ui/Panel'
import { Icon } from '../../ui/Icon'
import { useTheme } from '../../theme/useTheme'
import type { OfferedTheme } from '../../theme/theme'
import styles from './Profile.module.css'

/*
The Change Theme dialog's choice, on the page (deviation 21): the same three
options with the same labels (main.js:3215-3305, `modalChangeTheme`), each applying
and storing its theme the moment it is picked, with no Save, exactly as the dialog
does (`useTheme().setChoice`). A stored `amber` checks none, as there. The account
menu's `Change Theme` is still there and opens the dialog.

A compact choice for the page's side column: one bordered strip of three lines,
the picked one tinted and ticked. Each carries a swatch of the theme it picks,
drawn inside an element that has that theme's `data-theme`, so its colours are the
theme's own tokens; System is half light and half dark. The swatch and the tick are
decoration (`aria-hidden`); the radio and its label say the choice. The radio is
kept, visually hidden, so the arrow keys move through the group as in the dialog.
*/

const OPTIONS: { value: OfferedTheme; label: string }[] = [
  { value: 'system', label: 'Use System Theme (default)' },
  { value: 'light', label: 'Light Theme' },
  { value: 'dark', label: 'Dark Theme' },
]

function Swatch({ theme }: { theme: 'light' | 'dark' }) {
  return (
    <span className={styles.swatchHalf} data-theme={theme}>
      <i />
    </span>
  )
}

export function ThemeChoice({ className }: { className?: string }) {
  const { choice, setChoice } = useTheme()
  const checked = choice === 'amber' ? '' : (choice ?? 'system')

  return (
    <Panel title="Theme" className={className}>
      <div className={styles.themes} role="radiogroup" aria-label="Theme">
        {OPTIONS.map((o) => (
          <label key={o.value} className={styles.theme} data-checked={checked === o.value || undefined}>
            <input
              type="radio"
              className={styles.hidden}
              name="rdProfileTheme"
              value={o.value}
              checked={checked === o.value}
              onChange={() => setChoice(o.value)}
            />
            <span className={styles.swatch} aria-hidden="true">
              {o.value === 'system' ? (
                <>
                  <Swatch theme="light" />
                  <Swatch theme="dark" />
                </>
              ) : (
                <Swatch theme={o.value} />
              )}
            </span>
            <span className={styles.themeLabel}>{o.label}</span>
            {checked === o.value && <Icon name="check" size={14} className={styles.tick} />}
          </label>
        ))}
      </div>
    </Panel>
  )
}
