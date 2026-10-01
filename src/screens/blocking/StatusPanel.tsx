import { useCallback, useEffect, useState } from 'react'
import { getSettings } from '../../api/settings'
import { BlockingMenu } from '../dashboard/BlockingMenu'
import { Panel, Body } from '../../ui/Panel'
import { PermissionButton } from '../../ui/PermissionButton'
import { Button } from '../../ui/Button'
import { Failure, Loading } from '../../ui/Empty'
import { Icon } from '../../ui/Icon'
import { minuteStamp } from '../../lib/dates'
import type { Notice } from '../../lib/notice'
import { Locked } from './Locked'
import { missing, type Permissions } from './permissions'
import styles from './Overview.module.css'

/*
Whether blocking is on, and the control to change it. The block and its sentences are
OURS (AdGuard shows when protection comes back; upstream only has the menu); the menu
and its eight durations are upstream's, reused whole from the Dashboard
(`BlockingMenu`, main.js:2429). It reads and writes on the node the console is
connected to, as that menu does.

Three things the block owes the rules rather than the menu:

- A read that fails says so with `Failure` and a `Retry` (DESIGN.md: continuous =
  error), instead of leaving "Loading…" on screen forever.
- A pause ends on the server by itself, so the block reads again when it should
  have ended: otherwise it would keep saying "paused" for as long as the screen is
  open. The server's own timer is armed a hair BEFORE it computes `till`
  (BlockListZoneManager.cs:993-995), so reading a second after `till` finds
  blocking back on; the second also absorbs a small clock skew.
- The amber of "paused" says "yours to change". Without `Settings.canModify` it is
  not, and DESIGN.md says the padlock wins: the mark goes neutral.
*/

/** How long after `till` to read again. See above. */
const AFTER_PAUSE_MS = 1000
/** `setTimeout`'s ceiling (2^31 - 1 ms, about 24.8 days). Past it the browser fires
    AT ONCE, which with a far-off `till` would read in a loop; capped, it reads,
    finds the pause still on and waits again. */
const MAX_TIMEOUT_MS = 2_147_483_647

type State = { kind: 'on' } | { kind: 'paused'; till: string } | { kind: 'off' }

function stateOf(enable: boolean, till: string | null | undefined): State {
  if (enable) return { kind: 'on' }
  if (till != null && Date.parse(till) > Date.now()) return { kind: 'paused', till }
  return { kind: 'off' }
}

export function StatusPanel({
  token,
  permissions,
  onNotice,
}: {
  token: string | null
  permissions: Permissions
  onNotice: (n: Notice) => void
}) {
  const viewNeed = missing(permissions, 'Settings.canView')
  /** `null` while the first read travels; `'failed'` when it never arrived. */
  const [state, setState] = useState<State | 'failed' | null>(null)

  const load = useCallback(async () => {
    const s = await getSettings(token)
    setState(s == null ? 'failed' : stateOf(s.enableBlocking, s.temporaryDisableBlockingTill))
  }, [token])

  useEffect(() => {
    if (viewNeed == null) void load()
  }, [load, viewNeed])

  const till = state != null && state !== 'failed' && state.kind === 'paused' ? state.till : null
  useEffect(() => {
    if (till == null) return
    const wait = Math.min(MAX_TIMEOUT_MS, Math.max(0, Date.parse(till) - Date.now()) + AFTER_PAUSE_MS)
    const timer = setTimeout(() => void load(), wait)
    return () => clearTimeout(timer)
  }, [till, load])

  if (viewNeed != null) return <Locked title="Blocking" need={viewNeed} />

  const modifyNeed = missing(permissions, 'Settings.canModify')

  if (state === 'failed') {
    return (
      <Panel>
        <Body>
          <Failure>
            Could not read the blocking state.{' '}
            <Button size="sm" onClick={() => { setState(null); void load() }}>
              Retry
            </Button>
          </Failure>
        </Body>
      </Panel>
    )
  }

  const verb = state?.kind === 'on' ? 'Disable' : 'Enable'
  /* The padlock wins: a pause the user cannot lift is not drawn in amber. */
  const tone = state?.kind === 'paused' && modifyNeed != null ? 'off' : state?.kind

  return (
    <Panel>
      <Body>
        {state == null ? (
          <Loading compact />
        ) : (
          <div className={styles.status}>
            <span className={`${styles.mark} ${styles[tone ?? 'off']}`} data-tone={tone}>
              <Icon name={state.kind === 'on' ? 'blocked' : 'power'} size={18} />
            </span>
            <div className={styles.statusText}>
              <div className={styles.statusTitle}>
                {state.kind === 'on'
                  ? 'Blocking is enabled'
                  : state.kind === 'paused'
                    ? 'Blocking is paused'
                    : 'Blocking is disabled'}
              </div>
              <div className={styles.statusSub}>
                {state.kind === 'paused'
                  ? `Until ${minuteStamp(state.till)}`
                  : state.kind === 'on'
                    ? 'Queries matching a block list or your rules are answered as blocked.'
                    : 'Nothing is being blocked.'}
              </div>
            </div>
            {modifyNeed != null ? (
              <PermissionButton permission={modifyNeed}>{verb}</PermissionButton>
            ) : (
              <BlockingMenu token={token} text={verb} onNotice={onNotice} onChanged={() => void load()} />
            )}
          </div>
        )}
      </Body>
    </Panel>
  )
}
