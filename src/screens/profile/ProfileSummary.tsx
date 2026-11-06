import { useState, type CSSProperties } from 'react'
import type { Profile } from '../../api/user'
import { Card, Count, StackBar, hotEvents, statStyles } from '../../ui/StatCard'
import { Icon } from '../../ui/Icon'
import { byKind, login, totpStatus } from './profile'
import styles from './Profile.module.css'

/*
THE ACCOUNT AT A GLANCE (deviation 21 in CONVENTIONS.md, 2026-11-06): four cards
over the page, drawn only from the `user/profile/get` answer on screen. They add no
call; they follow the answer, and a deleted session leaves them as it leaves the
table.

  · Active Sessions  how many, split by type in the colours the table uses; each
                     type narrows the table to it, pressing it again clears it.
  · 2FA Status       upstream's three words for it, with the shield Zones draws for
                     DNSSEC.
  · Member Of        the groups, as upstream's Member Of table listed them.
  · Logins           Recent Login and Previous Login, the two columns of
                     Administration › Users, which the same answer carries and the
                     stock My Profile does not draw.

Upstream's words: `Active Sessions`, `2FA Status`, `Enabled`, `Disabled`, `SSO
Managed`, `Member Of`, `No Group Found`, `Recent Login`, `Previous Login`, `Never`
and the session types. OURS: the title `Logins`, `from` (Users writes it the same
way), the `N more` of a long group list, and the chips' group name.
*/

/** The groups drawn on the Member Of card; the rest are counted in one line. */
const GROUPS_SHOWN = 6

export function ProfileSummary({
  profile,
  activeKind,
  onKind,
}: {
  profile: Profile
  /** The session type the table is narrowed to, `''` for none. */
  activeKind: string
  onKind: (kind: string) => void
}) {
  const [hot, setHot] = useState<string | null>(null)
  const sessions = profile.sessions ?? []
  const kinds = byKind(sessions)
  const status = totpStatus(profile)
  const groups = profile.memberOfGroups ?? []
  const shown = groups.slice(0, GROUPS_SHOWN)
  const recent = login(profile.recentSessionLoggedOn, profile.recentSessionRemoteAddress)
  const previous = login(profile.previousSessionLoggedOn, profile.previousSessionRemoteAddress)

  return (
    <div className={statStyles.grid}>
      <Card title="Active Sessions" colour="var(--ch-total)">
        <div className={statStyles.body}>
          <div className={statStyles.figure}><Count value={sessions.length} /></div>
          <StackBar
            label={kinds.map((k) => `${k.kind.name} ${k.count}`).join(', ')}
            parts={kinds.map((k) => ({ key: k.kind.key, name: k.kind.name, value: k.count, colour: k.kind.colour }))}
            hot={hot}
            onHot={setHot}
          />
          {kinds.length > 0 && (
            <div className={statStyles.types} role="group" aria-label="Sessions by type">
              {kinds.map((k) => (
                <button
                  key={k.kind.key}
                  type="button"
                  className={statStyles.typeChip}
                  style={{ '--sw': k.kind.colour } as CSSProperties}
                  aria-pressed={activeKind === k.kind.key}
                  data-hot={hot === k.kind.key || undefined}
                  onClick={() => onKind(activeKind === k.kind.key ? '' : k.kind.key)}
                  {...hotEvents(k.kind.key, setHot)}
                >
                  <span className={statStyles.typeLabel}>{k.kind.name}</span>
                  <span className={statStyles.typeCount}>{k.count}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </Card>

      <Card
        title="2FA Status"
        colour={status === 'Enabled' ? 'var(--ok)' : status === 'SSO Managed' ? 'var(--info)' : 'var(--ch-drop)'}
      >
        <div className={statStyles.body}>
          <div className={statStyles.state}>
            <span className={`${statStyles.shield}${status === 'Enabled' ? ` ${styles.shieldOk}` : ''}`}>
              <Icon name="shield" size={22} />
            </span>
            <span className={styles.bigState} data-testid="totp-status">{status}</span>
          </div>
        </div>
      </Card>

      <Card title="Member Of" colour="var(--ch-rec)">
        <div className={statStyles.body}>
          <div className={statStyles.figure}><Count value={groups.length} /></div>
          {groups.length === 0 ? (
            <div className={statStyles.caption}>No Group Found</div>
          ) : (
            <ul className={styles.groups} aria-label="Member Of">
              {shown.map((g) => (
                <li key={g}>{g}</li>
              ))}
              {groups.length > shown.length && (
                <li className={styles.more}>{groups.length - shown.length} more</li>
              )}
            </ul>
          )}
        </div>
      </Card>

      <Card title="Logins" colour="var(--ch-clients)">
        <dl className={`${statStyles.body} ${styles.logins}`}>
          <div>
            <dt>Recent Login</dt>
            <dd>
              <span className={styles.ago}>{recent.never ? 'Never' : recent.ago}</span>
              {!recent.never && (
                <span className={styles.when}>
                  {recent.date} from <span className={styles.addr}>{recent.address}</span>
                </span>
              )}
            </dd>
          </div>
          <div>
            <dt>Previous Login</dt>
            <dd>
              <span className={styles.agoSmall}>{previous.never ? 'Never' : previous.ago}</span>
              {!previous.never && (
                <span className={styles.when}>
                  {previous.date} from <span className={styles.addr}>{previous.address}</span>
                </span>
              )}
            </dd>
          </div>
        </dl>
      </Card>
    </div>
  )
}
