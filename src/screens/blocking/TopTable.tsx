import { useState } from 'react'
import type { Range, TopEntry } from '../../api/dashboard'
import { TopStats } from '../dashboard/TopStats'
import { Panel } from '../../ui/Panel'
import { Table } from '../../ui/Table'
import { Menu } from '../../ui/Menu'
import { Button } from '../../ui/Button'
import type { Notice } from '../../lib/notice'
import { useDomainAction } from '../../lib/allow-block'
import { missing, type Permissions } from './permissions'
import { LockedItem } from './Locked'
import shared from './Blocking.module.css'
import styles from './Overview.module.css'

/*
Top Blocked Domains with "Allow Domain", Top Domains with "Block Domain": upstream's
row menus (main.js:2825 and 2853), here only the blocking verb of each; the
Dashboard carries the whole menus (`dashboard/TopRowMenu`). Each is
TWO calls (other-zones.js:637, 686), so each asks for two permissions, and the
padlock names the first one missing. Upstream's: the titles, the `Domain` and
`Hits` columns and the two verbs. OURS: the `Share` column (upstream's tops have
only Domain and Hits), `No domains for this period.` (upstream says "No Data") and
the `Actions` / `Actions for <domain>` labels.

The disabled item is `LockedItem`, the section's one padlocked menu entry.
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
  /* Upstream's two calls, alert included, and the row disabled while they run
     (`lib/allow-block.ts`). */
  const action = useDomainAction(token, onNotice)
  const isBlocked = kind === 'TopBlockedDomains'
  const need = isBlocked
    ? missing(permissions, 'Blocked.canDelete', 'Allowed.canModify')
    : missing(permissions, 'Allowed.canDelete', 'Blocked.canModify')
  const top = rows[0]?.hits ?? 0
  const verb = isBlocked ? 'Allow Domain' : 'Block Domain'

  async function act(domain: string) {
    if (await action.run(domain, verb, domain)) onChanged()
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
            <th className={styles.hitsHead}>Hits</th>
            <th aria-label="Actions" />
          </>
        }
        isEmpty={rows.length === 0}
        emptyText={failure ? undefined : 'No domains for this period.'}
        columns={4}
        className={shared.inPanel}
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
                      disabled={action.isBusy(r.name)}
                      onClick={() => {
                        close()
                        void act(r.name)
                      }}
                    >
                      {verb}
                    </button>
                  ) : (
                    <LockedItem need={need}>{verb}</LockedItem>
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
