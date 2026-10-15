import { useCallback, useEffect, useRef, useState } from 'react'
import { getSettings } from '../../api/settings'
import { minuteStamp } from '../../lib/dates'
import { onSettingsChanged } from '../../lib/settings-signal'
import { missing, type Permissions } from './permissions'

/*
Whether blocking is on, read where the Overview's status block reads it
(`settings/get`: `enableBlocking` and `temporaryDisableBlockingTill`, on the node the
console is connected to). OURS, as that block is. Two places draw it, so it lives
here: the block itself (`StatusPanel.tsx`) and the sidebar's mark on Blocking
(`app/Shell.tsx`), which nothing else on the page would keep current.

When it reads:
- once on mounting, unless the session lacks `Settings.canView`, in which case it
  never reads and stays `null` (the server would refuse, and the sidebar then shows
  no mark rather than a guess);
- whenever this console writes the settings (`lib/settings-signal.ts`): the
  Overview's and the Dashboard's Blocking menu, a Save in Settings;
- when a pause should have ended. The server's own timer is armed a hair BEFORE it
  computes `till` (BlockListZoneManager.cs:993-995), so reading a second after
  `till` finds blocking back on; the second also absorbs a small clock skew;
- when the browser tab is shown again after being hidden: the state may have been
  changed from elsewhere meanwhile, and a hidden tab is not kept current.
Reads are numbered, so an older answer arriving last cannot overwrite a newer one.
*/

/** How long after `till` to read again. See above. */
export const AFTER_PAUSE_MS = 1000
/** `setTimeout`'s ceiling (2^31 - 1 ms, about 24.8 days). Past it the browser fires
    AT ONCE, which with a far-off `till` would read in a loop; capped, it reads,
    finds the pause still on and waits again. */
export const MAX_TIMEOUT_MS = 2_147_483_647

export type BlockingState = { kind: 'on' } | { kind: 'paused'; till: string } | { kind: 'off' }

export function stateOf(enable: boolean, till: string | null | undefined, now = Date.now()): BlockingState {
  if (enable) return { kind: 'on' }
  if (till != null && Date.parse(till) > now) return { kind: 'paused', till }
  return { kind: 'off' }
}

/*
When a pause ends, as the pill says it: the hour alone when that is today, the date as
well when it is not (a three-hour pause at 23:00 ends tomorrow, and "Until 01:30"
alone would read as earlier today).
*/
export function untilText(till: string, now: Date = new Date()): string {
  const stamp = minuteStamp(till)
  const end = new Date(till)
  const today =
    end.getFullYear() === now.getFullYear() && end.getMonth() === now.getMonth() && end.getDate() === now.getDate()
  return `Until ${today ? stamp.slice(11) : stamp}`
}

/** `null` while the first read travels or when nothing is read; `'failed'` when it never arrived. */
export type BlockingRead = BlockingState | 'failed' | null

export function useBlockingState(
  token: string | null,
  permissions: Permissions,
  /** False reads nothing, as a missing `Settings.canView` does: the sidebar without
      a Blocking entry to mark. */
  enabled = true,
): { state: BlockingRead; reload: () => void; retry: () => void } {
  const viewNeed = enabled ? missing(permissions, 'Settings.canView') : 'Settings.canView'
  const [state, setState] = useState<BlockingRead>(null)
  const asked = useRef(0)

  const reload = useCallback(() => {
    if (viewNeed != null) return
    const mine = ++asked.current
    void getSettings(token).then((s) => {
      if (mine !== asked.current) return
      setState(s == null ? 'failed' : stateOf(s.enableBlocking, s.temporaryDisableBlockingTill))
    })
  }, [token, viewNeed])

  useEffect(() => {
    // A read already travelling must not land after the permission went.
    if (viewNeed != null) asked.current++
    else reload()
  }, [reload, viewNeed])

  useEffect(() => onSettingsChanged(reload), [reload])

  useEffect(() => {
    const shown = () => {
      if (document.visibilityState === 'visible') reload()
    }
    document.addEventListener('visibilitychange', shown)
    return () => document.removeEventListener('visibilitychange', shown)
  }, [reload])

  /* Without the permission nothing is known, whatever an earlier read said. */
  const known = viewNeed != null ? null : state
  const till = known != null && known !== 'failed' && known.kind === 'paused' ? known.till : null
  useEffect(() => {
    if (till == null) return
    const wait = Math.min(MAX_TIMEOUT_MS, Math.max(0, Date.parse(till) - Date.now()) + AFTER_PAUSE_MS)
    const timer = setTimeout(reload, wait)
    return () => clearTimeout(timer)
  }, [till, reload])

  const retry = useCallback(() => {
    setState(null)
    reload()
  }, [reload])

  return { state: known, reload, retry }
}

/*
The sidebar's mark on Blocking. Nothing while blocking is on, while it is unknown
or unreadable, and without `Settings.canView`. The visible word is short; the
accessible name and the title say the rest, with the time a pause ends. OURS:
`Off`, `Paused`, `Blocking, disabled`, `Blocking, paused until <time>`.

The tone follows the Overview's block: paused is amber ("yours to lift") only with
`Settings.canModify`, since the padlock wins; disabled is neutral, as the block's
mark is.
*/
export interface BlockingMark {
  text: string
  label: string
  tone: 'acc' | 'neutral'
}

export function blockingMark(state: BlockingRead, permissions: Permissions, now = new Date()): BlockingMark | null {
  if (state == null || state === 'failed' || state.kind === 'on') return null
  if (state.kind === 'off') return { text: 'Off', label: 'Blocking, disabled', tone: 'neutral' }
  const canLift = missing(permissions, 'Settings.canModify') == null
  return {
    text: 'Paused',
    label: `Blocking, paused ${untilText(state.till, now).replace(/^Until/, 'until')}`,
    tone: canLift ? 'acc' : 'neutral',
  }
}

/** The mark for the sidebar's Blocking entry; `visible` false when there is no entry. */
export function useBlockingMark(token: string | null, permissions: Permissions, visible: boolean): BlockingMark | null {
  const { state } = useBlockingState(token, permissions, visible)
  return blockingMark(state, permissions)
}
