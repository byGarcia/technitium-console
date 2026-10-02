import type { SettingsForm } from '../model'
import { enabled } from '../model'

/** Props common to the nine sub-tabs. `en` are the enablement rules already
 *  derived from the state (see `enabled` in model.ts). */
export interface PaneProps {
  f: SettingsForm
  set: (partial: Partial<SettingsForm>) => void
  en: ReturnType<typeof enabled>
}
