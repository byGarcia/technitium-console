import { useCallback, useEffect, useState } from 'react'
import { getSettings } from '../../api/settings'
import { BlockingMenu } from '../dashboard/BlockingMenu'
import { Panel, Body } from '../../ui/Panel'
import { PermissionButton } from '../../ui/PermissionButton'
import { Loading } from '../../ui/Empty'
import { Icon } from '../../ui/Icon'
import { dateTime } from '../../lib/dates'
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
*/

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
  const [state, setState] = useState<State | null>(null)

  const load = useCallback(async () => {
    const s = await getSettings(token)
    if (s != null) setState(stateOf(s.enableBlocking, s.temporaryDisableBlockingTill))
  }, [token])

  useEffect(() => {
    if (viewNeed == null) void load()
  }, [load, viewNeed])

  if (viewNeed != null) return <Locked title="Blocking" need={viewNeed} />

  const modifyNeed = missing(permissions, 'Settings.canModify')
  const verb = state?.kind === 'on' ? 'Disable' : 'Enable'

  return (
    <Panel>
      <Body>
        {state == null ? (
          <Loading compact />
        ) : (
          <div className={styles.status}>
            <span className={`${styles.mark} ${styles[state.kind]}`}>
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
                  ? `Until ${dateTime(state.till)}`
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
