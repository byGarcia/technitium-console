import { Dialog } from '../../ui/Dialog'
import { GroupRow } from '../../ui/Form'
import { Radios } from '../../ui/PanelForm'
import { useTheme } from '../../theme/useTheme'
import type { OfferedTheme } from '../../theme/theme'

/*
A replica of `showChangeThemeModal()` / `changeTheme()` (main.js:3215-3305 in
v15.5.1) and of `modalChangeTheme` (index.html:3818-3862).

Each radio applies its theme the moment it is clicked and stores it: there is no
Save, and the footer has only Close. Upstream offers four themes; Amber is not
offered here (CONVENTIONS.md, deliberate deviations), so its radio is the one
missing.

Which radio is checked follows what is stored, as upstream reads `localStorage`
on opening: Light and Dark their own, System for "system" and for anything it does
not recognise. A stored "amber" (picked in the stock console) checks NONE: the
page draws dark, but saying "Dark Theme" would claim a choice the user never made,
and the value stays untouched until they pick one here.

One difference nobody can see: upstream's `onclick` fires on a radio that is
already checked and stores it again; `onChange` does not. Re-storing "system" over
an unrecognised value would change nothing drawn, since both mean System.
*/

const OPTIONS: { value: OfferedTheme; label: string }[] = [
  { value: 'system', label: 'Use System Theme (default)' },
  { value: 'light', label: 'Light Theme' },
  { value: 'dark', label: 'Dark Theme' },
]

export function ChangeTheme({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
}) {
  const { choice, setChoice } = useTheme()
  const checked = choice === 'amber' ? '' : (choice ?? 'system')

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Change Theme">
      <GroupRow modal label="Theme" role="radiogroup">
        <Radios
          name="rdChangeTheme"
          value={checked}
          options={OPTIONS}
          onChange={(v) => setChoice(v as OfferedTheme)}
        />
      </GroupRow>
    </Dialog>
  )
}
