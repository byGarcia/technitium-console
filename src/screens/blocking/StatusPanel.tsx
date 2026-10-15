import { BlockingMenu } from '../dashboard/BlockingMenu'
import { Panel, Body } from '../../ui/Panel'
import { PermissionButton } from '../../ui/PermissionButton'
import { Button } from '../../ui/Button'
import { Failure, Loading } from '../../ui/Empty'
import { Icon } from '../../ui/Icon'
import { Tag } from '../../ui/Tag'
import type { Notice } from '../../lib/notice'
import { Locked } from './Locked'
import { missing, type Permissions } from './permissions'
import { untilText, useBlockingState } from './blocking-state'
import shared from './Blocking.module.css'
import styles from './Overview.module.css'

/*
Whether blocking is on, and the control to change it. The block and its sentences are
OURS (it says when blocking comes back; upstream only has the menu), and so
is the trigger's `Disable` / `Enable` (upstream's button says "Blocking"); the menu
and its eight durations are upstream's, reused whole from the Dashboard
(`BlockingMenu`, main.js:2429). It reads and writes on the node the console is
connected to, as that menu does.

Three things the block owes the rules rather than the menu:

- A read that fails says so with `Failure` and a `Retry` (the design rule: continuous =
  error), instead of leaving "Loading…" on screen forever.
- A pause ends on the server by itself, so the block reads again when it should
  have ended: otherwise it would keep saying "paused" for as long as the screen is
  open (`blocking-state.ts`, AFTER_PAUSE_MS).
- The amber of "paused" says "yours to change". Without `Settings.canModify` it is
  not, and the design rule is that the padlock wins: the mark goes neutral.
*/

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
  /* The reads (when, from where, and the one when a pause ends) are
     `useBlockingState`'s, shared with the sidebar's mark. A change made from the
     menu below reaches it as every settings write does (`lib/settings-signal.ts`). */
  const { state, retry } = useBlockingState(token, permissions)

  if (viewNeed != null) return <Locked title="Blocking" need={viewNeed} />

  const modifyNeed = missing(permissions, 'Settings.canModify')

  if (state === 'failed') {
    return (
      <Panel className={shared.centred}>
        <Body>
          <Failure>
            Could not read the blocking state.{' '}
            <Button size="sm" onClick={retry}>
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

  /* Centred: the panel shares its row with the taller add bar and stretches to it. */
  return (
    <Panel className={shared.centred}>
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
                {/* The state as a pill, as the drawing has it. Paused, the amber says
                    "yours to lift": without Settings.canModify it is neutral, because
                    the padlock wins. */}
                {state.kind === 'on' && <Tag tone="ok">Active</Tag>}
                {state.kind === 'paused' &&
                  (modifyNeed == null ? (
                    <Tag tone="acc">{untilText(state.till)}</Tag>
                  ) : (
                    <Tag>{untilText(state.till)}</Tag>
                  ))}
              </div>
              <div className={styles.statusSub}>
                {state.kind === 'paused'
                  ? 'Resumes automatically.'
                  : state.kind === 'on'
                    ? 'Queries matching a block list or your rules are answered as blocked.'
                    : 'Nothing is being blocked.'}
              </div>
            </div>
            {modifyNeed != null ? (
              <PermissionButton permission={modifyNeed}>{verb}</PermissionButton>
            ) : (
              <BlockingMenu token={token} text={verb} onNotice={onNotice} />
            )}
          </div>
        )}
      </Body>
    </Panel>
  )
}
