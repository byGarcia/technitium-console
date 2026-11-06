import type { Profile } from '../../api/user'
import { Panel } from '../../ui/Panel'
import { Tag } from '../../ui/Tag'
import { login } from './profile'
import styles from './Profile.module.css'

/*
The account's facts, a compact panel in the page's side column (2026-11-06): the
groups, as upstream's Member Of table listed them, as tags (or `No Group Found`,
upstream's empty foot), and the two logins `user/profile/get` carries, each on one
line written as Users writes them (`date from address`, or `Never`), after how long
ago it was.
*/
export function AccountPanel({ profile, className }: { profile: Profile; className?: string }) {
  const groups = profile.memberOfGroups ?? []
  const logins = [
    ['Recent Login', login(profile.recentSessionLoggedOn, profile.recentSessionRemoteAddress)],
    ['Previous Login', login(profile.previousSessionLoggedOn, profile.previousSessionRemoteAddress)],
  ] as const
  return (
    <Panel title="Account" className={className}>
      <dl className={styles.account}>
        <div>
          <dt>Member Of</dt>
          <dd>
            {groups.length === 0 ? (
              <span className={styles.quiet}>No Group Found</span>
            ) : (
              <ul className={styles.groupTags} aria-label="Member Of">
                {groups.map((g) => (
                  <li key={g}>
                    <Tag>{g}</Tag>
                  </li>
                ))}
              </ul>
            )}
          </dd>
        </div>
        {logins.map(([label, v]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd className={styles.login}>
              {v.never ? (
                'Never'
              ) : (
                <>
                  <span className={styles.ago}>{v.ago}</span>
                  {/* The dot travels with the date, so a narrow column breaks
                      the line before it and never leaves it hanging. */}
                  <span className={styles.when}>
                    <span className={styles.dot} aria-hidden="true">
                      ·
                    </span>
                    {v.date} from <span className={styles.addr}>{v.address}</span>
                  </span>
                </>
              )}
            </dd>
          </div>
        ))}
      </dl>
    </Panel>
  )
}
