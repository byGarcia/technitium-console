import type { Profile } from '../../api/user'
import { Panel } from '../../ui/Panel'
import { Tag } from '../../ui/Tag'
import { login } from './profile'
import styles from './Profile.module.css'

/*
The account's facts beside the Profile form (2026-11-06): the groups, as upstream's
Member Of table listed them, and the two logins `user/profile/get` carries, written
as Users writes them (`date from address`, or `Never`). They were two of the
page's four cards; on a page of tabs they sit with the form they describe.
*/
export function AccountPanel({ profile }: { profile: Profile }) {
  const groups = profile.memberOfGroups ?? []
  const recent = login(profile.recentSessionLoggedOn, profile.recentSessionRemoteAddress)
  const previous = login(profile.previousSessionLoggedOn, profile.previousSessionRemoteAddress)
  return (
    <Panel title="Account">
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
        {[
          ['Recent Login', recent],
          ['Previous Login', previous],
        ].map(([label, l]) => {
          const v = l as ReturnType<typeof login>
          return (
            <div key={label as string}>
              <dt>{label as string}</dt>
              <dd>
                {v.never ? (
                  'Never'
                ) : (
                  <>
                    <span className={styles.ago}>{v.ago}</span>
                    <span className={styles.when}>
                      {v.date} from <span className={styles.addr}>{v.address}</span>
                    </span>
                  </>
                )}
              </dd>
            </div>
          )
        })}
      </dl>
    </Panel>
  )
}
