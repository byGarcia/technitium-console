import { useState } from 'react'
import { allowDomain, blockDomain } from '../../api/blocking'
import type { Range, TopEntry } from '../../api/dashboard'
import { TopStats } from '../dashboard/TopStats'
import { Panel } from '../../ui/Panel'
import { Table } from '../../ui/Table'
import { Menu } from '../../ui/Menu'
import { Button } from '../../ui/Button'
import { Icon } from '../../ui/Icon'
import { Tooltip } from '../../ui/Tooltip'
import { noticeFromFailure, type Notice } from '../../lib/notice'
import { missing, requiresText, type Permissions } from './permissions'
import styles from './Overview.module.css'

/*
Top Blocked Domains with "Allow Domain", Top Domains with "Block Domain": upstream's
row menus (main.js:2826-2857), which this console's Dashboard does not have. Each is
TWO calls (other-zones.js:637, 686), so each asks for two permissions, and the
padlock names the first one missing. Upstream's: the titles, the `Domain` and
`Hits` columns and the two verbs. OURS: the `Share` column (upstream's tops have
only Domain and Hits), `No domains for this period.` (upstream says "No Data") and
the `Actions` / `Actions for <domain>` labels.

The disabled item explains itself the way `PermissionButton` does —padlock plus
the `Tooltip` with `Requires X: Y`— and not with a native `title`: that is the one
pattern the console has for "you cannot", and a menu item is no exception.
*/

type Kind = 'TopBlockedDomains' | 'TopDomains'

const TITLE: Record<Kind, string> = { TopBlockedDomains: 'Top Blocked Domains', TopDomains: 'Top Domains' }

export function TopTable({
  kind,
  rows,
  range,
  token,
  permissions,
  failure,
  onNotice,
  onChanged,
}: {
  kind: Kind
  rows: TopEntry[]
  range: Range
  token: string | null
  permissions: Permissions
  /** The stats never arrived: the screen says so, and this table must not claim "no domains". */
  failure: boolean
  onNotice: (n: Notice) => void
  onChanged: () => void
}) {
  const [more, setMore] = useState(false)
  /* The domains whose two calls are in flight. Upstream disables THAT row's control
     until they settle (other-zones.js:645, re-enabled at 660, 666 and 676), so a
     second click cannot start a second sequence; the other rows stay usable. */
  const [busy, setBusy] = useState<ReadonlySet<string>>(new Set())
  const isBlocked = kind === 'TopBlockedDomains'
  const need = isBlocked
    ? missing(permissions, 'Blocked.canDelete', 'Allowed.canModify')
    : missing(permissions, 'Allowed.canDelete', 'Blocked.canModify')
  const top = rows[0]?.hits ?? 0
  const verb = isBlocked ? 'Allow Domain' : 'Block Domain'

  async function act(domain: string) {
    if (busy.has(domain)) return
    setBusy((b) => new Set(b).add(domain))
    const outcome = await (isBlocked ? allowDomain(token, domain) : blockDomain(token, domain))
    setBusy((b) => {
      const next = new Set(b)
      next.delete(domain)
      return next
    })
    if (outcome.kind !== 'ok') {
      onNotice(noticeFromFailure(outcome))
      return
    }
    // other-zones.js:663 and 712, verbatim.
    onNotice(
      isBlocked
        ? { type: 'success', title: 'Allowed!', text: `Domain '${domain}' was added to Allowed Zone successfully.` }
        : { type: 'success', title: 'Blocked!', text: `Domain '${domain}' was added to Blocked Zone successfully.` },
    )
    onChanged()
  }

  return (
    <Panel
      title={TITLE[kind]}
      actions={
        <Button size="sm" onClick={() => setMore(true)}>
          More
        </Button>
      }
    >
      <Table
        header={
          <>
            <th>Domain</th>
            <th aria-label="Share" />
            <th>Hits</th>
            <th aria-label="Actions" />
          </>
        }
        isEmpty={rows.length === 0}
        emptyText={failure ? undefined : 'No domains for this period.'}
        columns={4}
      >
        {rows.map((r) => (
          <tr key={r.name}>
            <td className={styles.name}>{r.name}</td>
            <td>
              <span className={`${styles.share} ${isBlocked ? styles.shareBlocked : styles.shareTotal}`}>
                <i style={{ width: `${top === 0 ? 0 : (r.hits * 100) / top}%` }} />
              </span>
            </td>
            <td className={styles.hits}>{r.hits.toLocaleString()}</td>
            <td>
              <Menu label={`Actions for ${r.name}`}>
                {(close) =>
                  need == null ? (
                    <button
                      type="button"
                      disabled={busy.has(r.name)}
                      onClick={() => {
                        close()
                        void act(r.name)
                      }}
                    >
                      {verb}
                    </button>
                  ) : (
                    <Tooltip text={requiresText(need)}>
                      <button type="button" className={styles.locked} disabled>
                        <Icon name="lock" size={13} />
                        {verb}
                      </button>
                    </Tooltip>
                  )
                }
              </Menu>
            </td>
          </tr>
        ))}
      </Table>
      <TopStats type={more ? kind : null} range={range} token={token} onClose={() => setMore(false)} />
    </Panel>
  )
}
