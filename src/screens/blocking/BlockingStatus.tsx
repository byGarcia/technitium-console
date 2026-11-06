import { BlockingMenu } from '../dashboard/BlockingMenu'
import { PermissionButton } from '../../ui/PermissionButton'
import { Button } from '../../ui/Button'
import { Icon } from '../../ui/Icon'
import type { Notice } from '../../lib/notice'
import { missing, requiresText, type Permissions } from './permissions'
import { untilText, useBlockingState } from './blocking-state'
import styles from './Overview.module.css'

/*
Whether blocking is on, and the control to change it, in the Overview's header beside
the period (2026-11-06; until then a block of its own beside the check panel). The
status and its sentences are OURS (it says when blocking comes back; upstream only has
the menu), and so is the trigger's `Disable` / `Enable` (upstream's button says
"Blocking"); the menu and its eight durations are upstream's, reused whole from the
Dashboard (`BlockingMenu`, main.js:2429). It reads and writes on the node the console
is connected to, as that menu does.

The status is one pill: `Blocking is enabled` in green, `Blocking is paused` with the
time it comes back in amber, `Blocking is disabled` in red. Its longer sentence
(`Queries matching a block list or your rules are answered as blocked.`,
`Resumes automatically.`, `Nothing is being blocked.`) is its title and is read after
it. Without `Settings.canView` the pill says which permission is missing, and nothing
is read.

Three things the status owes the rules rather than the menu:

- A read that fails says so in the pill's place, `Could not read the blocking
  state.`, with a `Retry`, instead of leaving "Loading…" forever.
- A pause ends on the server by itself, so the state is read again when it should
  have ended: otherwise it would keep saying "paused" for as long as the screen is
  open (`blocking-state.ts`, AFTER_PAUSE_MS).
- Amber and red say "yours to change". Without `Settings.canModify` they are not,
  and the design rule is that the padlock wins: the pill goes neutral.
*/

const TITLE = { on: 'Blocking is enabled', paused: 'Blocking is paused', off: 'Blocking is disabled' } as const
const SENTENCE = {
  on: 'Queries matching a block list or your rules are answered as blocked.',
  paused: 'Resumes automatically.',
  off: 'Nothing is being blocked.',
} as const

export function BlockingStatus({
  token,
  permissions,
  onNotice,
}: {
  token: string | null
  permissions: Permissions
  onNotice: (n: Notice) => void
}) {
  const viewNeed = missing(permissions, 'Settings.canView')
  /* The reads (when, from where, and the one when a pause ends) are
     `useBlockingState`'s, shared with the sidebar's mark. A change made from the
     menu below reaches it as every settings write does (`lib/settings-signal.ts`). */
  const { state, retry } = useBlockingState(token, permissions)

  if (viewNeed != null) {
    return (
      <div className={styles.statusBar}>
        <span className={styles.pill} data-tone="locked">
          <Icon name="lock" size={13} />
          {requiresText(viewNeed)}
        </span>
      </div>
    )
  }

  const modifyNeed = missing(permissions, 'Settings.canModify')

  if (state === 'failed') {
    return (
      <div className={styles.statusBar}>
        <span className={styles.pill} data-tone="failed" role="alert">
          Could not read the blocking state.
        </span>
        <Button size="sm" onClick={retry}>
          Retry
        </Button>
      </div>
    )
  }

  if (state == null) {
    return (
      <div className={styles.statusBar}>
        <span className={styles.pill} data-tone="waiting" role="status">
          Loading…
        </span>
      </div>
    )
  }

  const verb = state.kind === 'on' ? 'Disable' : 'Enable'
  /* The padlock wins: a pause or a switch-off the user cannot lift is not coloured. */
  const tone = state.kind !== 'on' && modifyNeed != null ? 'neutral' : state.kind

  return (
    <div className={styles.statusBar}>
      <span className={styles.pill} data-tone={tone} title={SENTENCE[state.kind]}>
        <i className={styles.pillDot} aria-hidden="true" />
        <span>{TITLE[state.kind]}</span>
        {state.kind === 'paused' && <b className={styles.until}>{untilText(state.till)}</b>}
        <span className={styles.offscreen}>{SENTENCE[state.kind]}</span>
      </span>
      {modifyNeed != null ? (
        <PermissionButton size="sm" permission={modifyNeed}>{verb}</PermissionButton>
      ) : (
        <BlockingMenu token={token} text={verb} onNotice={onNotice} />
      )}
    </div>
  )
}
