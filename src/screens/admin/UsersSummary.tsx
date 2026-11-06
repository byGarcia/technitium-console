import { useState, type CSSProperties } from 'react'
import type { AdminUser } from '../../api/admin'
import { Card, Count, StackBar, hotEvents, statStyles as stat } from '../../ui/StatCard'
import { STATUS_COLOURS, lastLogin, loginParts, typeColour, typesOf, userStatus } from './user-facts'
import styles from './AdminLists.module.css'

/*
THE USERS AT A GLANCE (deviation 23): four cells over the table, counted from the
`admin/users/list` the table already loads. No call is added.

  · Users        how many, Enabled against Disabled. Pressing a state narrows the
                 table to it, pressing it again clears it.
  · Type         how many of each type, by upstream's labels; pressing filters.
  · 2FA          how many have it on, of those whose 2FA this server keeps (an SSO
                 user's is the provider's), and the SSO Managed count when any.
  · Recent Login who logged in last, when, and from where.

Both states are always drawn, a zero as 0. Words OURS: the four titles, `of`,
`Nobody yet`.
*/
export function UsersSummary({
  users,
  status,
  type,
  onStatus,
  onType,
}: {
  users: AdminUser[]
  status: string
  type: string
  onStatus: (s: string) => void
  onType: (t: string) => void
}) {
  const [hotStatus, setHotStatus] = useState<string | null>(null)
  const [hotType, setHotType] = useState<string | null>(null)

  const states = (['Enabled', 'Disabled'] as const).map((s) => ({
    key: s,
    name: s,
    value: users.filter((u) => userStatus(u) === s).length,
    colour: STATUS_COLOURS[s],
  }))
  const types = typesOf(users).map((t) => ({ key: t.label, name: t.label, value: t.count, colour: typeColour(t.label) }))
  const keeps2fa = users.filter((u) => u.type !== 'RemoteSSO')
  const on2fa = keeps2fa.filter((u) => u.totpEnabled === true).length
  const managed = users.length - keeps2fa.length
  const last = lastLogin(users)
  const login = last == null ? null : loginParts(last.recentSessionLoggedOn, last.recentSessionRemoteAddress)

  return (
    <div className={stat.grid}>
      <Card title="Users" colour="var(--ch-total)">
        <div className={stat.body}>
          <div className={stat.figure}><Count value={users.length} /></div>
          <StackBar
            label={states.map((p) => `${p.name} ${p.value}`).join(', ')}
            parts={states}
            hot={hotStatus}
            onHot={setHotStatus}
          />
          <div className={stat.types} role="group" aria-label="Users by status">
            {states.map((p) => (
              <button
                key={p.key}
                type="button"
                className={stat.typeChip}
                style={{ '--sw': p.colour } as CSSProperties}
                aria-pressed={status === p.key}
                data-hot={hotStatus === p.key || undefined}
                onClick={() => onStatus(status === p.key ? '' : p.key)}
                {...hotEvents(p.key, setHotStatus)}
              >
                <span className={stat.typeLabel}>{p.name}</span>
                <span className={stat.typeCount}>{p.value}</span>
              </button>
            ))}
          </div>
        </div>
      </Card>

      <Card title="Type" colour="var(--ch-1)">
        <div className={stat.body}>
          <StackBar
            label={types.map((p) => `${p.name} ${p.value}`).join(', ')}
            parts={types}
            hot={hotType}
            onHot={setHotType}
          />
          <div className={stat.types} role="group" aria-label="Users by type">
            {types.map((p) => (
              <button
                key={p.key}
                type="button"
                className={stat.typeChip}
                style={{ '--sw': p.colour } as CSSProperties}
                aria-pressed={type === p.key}
                data-hot={hotType === p.key || undefined}
                onClick={() => onType(type === p.key ? '' : p.key)}
                {...hotEvents(p.key, setHotType)}
              >
                <span className={stat.typeLabel}>{p.name}</span>
                <span className={stat.typeCount}>{p.value}</span>
              </button>
            ))}
          </div>
        </div>
      </Card>

      <Card title="2FA" colour="var(--ch-ok)">
        <div className={stat.body}>
          <div className={stat.figure}>
            <Count value={on2fa} /> <span className={stat.of}>of {keeps2fa.length}</span>
          </div>
          <div
            className={stat.meter}
            role="img"
            aria-label={`2FA Enabled ${on2fa} of ${keeps2fa.length}`}
          >
            <span style={{ width: keeps2fa.length === 0 ? 0 : `${(on2fa / keeps2fa.length) * 100}%` }} />
          </div>
          <div className={stat.caption}>
            Enabled
            {managed > 0 && `, SSO Managed ${managed}`}
          </div>
        </div>
      </Card>

      <Card title="Recent Login" colour="var(--acc)">
        <div className={stat.body}>
          {last == null || login == null ? (
            <div className={stat.quiet}>Nobody yet</div>
          ) : (
            <>
              <div className={styles.lastName}>{last.username}</div>
              <div className={styles.lastWhen} title={login.date}>
                {login.ago} from <span className={styles.from}>{login.address}</span>
              </div>
            </>
          )}
        </div>
      </Card>
    </div>
  )
}
