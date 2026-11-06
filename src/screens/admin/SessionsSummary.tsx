import { useState, type CSSProperties } from 'react'
import type { AdminSession } from '../../api/admin'
import { Card, Count, StackBar, hotEvents, statStyles as stat } from '../../ui/StatCard'
import { kindsOf, tally } from './session-facts'
import styles from './AdminLists.module.css'

/*
THE SESSIONS AT A GLANCE (deviation 23): three cells over the table, counted from
the `admin/sessions/list` the table already loads for the chosen node. No call is
added.

  · Sessions          how many, by upstream's type labels in the series colours My
                      Profile gives them (`profile/profile.ts`). Pressing a type
                      narrows the table to it; pressing it again clears it.
  · Users             how many users hold a session, the four with most.
  · Remote Addresses  how many addresses were last seen, the four with most.

Pressing a user or an address writes it in the Search, as typing it would;
pressing the one searched empties it. Words OURS: the three titles, `N more`.
*/

const SHOWN = 4

export function SessionsSummary({
  sessions,
  kind,
  search,
  onKind,
  onSearch,
}: {
  sessions: AdminSession[]
  kind: string
  search: string
  onKind: (k: string) => void
  onSearch: (q: string) => void
}) {
  const [hot, setHot] = useState<string | null>(null)
  const parts = kindsOf(sessions).map((k) => ({ key: k.kind.key, name: k.kind.name, value: k.count, colour: k.kind.colour }))
  const users = tally(sessions.map((s) => s.username))
  const addresses = tally(sessions.map((s) => s.lastSeenRemoteAddress))

  return (
    <div className={stat.grid}>
      <Card title="Sessions" colour="var(--ch-total)">
        <div className={stat.body}>
          <div className={stat.figure}><Count value={sessions.length} /></div>
          <StackBar label={parts.map((p) => `${p.name} ${p.value}`).join(', ')} parts={parts} hot={hot} onHot={setHot} />
          <div className={stat.types} role="group" aria-label="Sessions by type">
            {parts.map((p) => (
              <button
                key={p.key}
                type="button"
                className={stat.typeChip}
                style={{ '--sw': p.colour } as CSSProperties}
                aria-pressed={kind === p.key}
                data-hot={hot === p.key || undefined}
                onClick={() => onKind(kind === p.key ? '' : p.key)}
                {...hotEvents(p.key, setHot)}
              >
                <span className={stat.typeLabel}>{p.name}</span>
                <span className={stat.typeCount}>{p.value}</span>
              </button>
            ))}
          </div>
        </div>
      </Card>
      <Top title="Users" colour="var(--ch-5)" items={users} search={search} onSearch={onSearch} mono={false} />
      <Top title="Remote Addresses" colour="var(--ch-3)" items={addresses} search={search} onSearch={onSearch} mono />
    </div>
  )
}

function Top({
  title,
  colour,
  items,
  search,
  onSearch,
  mono,
}: {
  title: string
  colour: string
  items: { value: string; count: number }[]
  search: string
  onSearch: (q: string) => void
  mono: boolean
}) {
  return (
    <Card title={title} colour={colour}>
      <div className={stat.body}>
        <div className={stat.figure}><Count value={items.length} /></div>
        {items.length > 0 && (
          <ul className={styles.top} aria-label={title}>
            {items.slice(0, SHOWN).map((it) => (
              <li key={it.value}>
                <button
                  type="button"
                  className={styles.topItem}
                  aria-pressed={search === it.value}
                  onClick={() => onSearch(search === it.value ? '' : it.value)}
                >
                  <span className={mono ? `${styles.topName} ${styles.from}` : styles.topName}>{it.value}</span>
                  <span className={styles.topCount}>{it.count}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {items.length > SHOWN && <div className={styles.more}>{`${items.length - SHOWN} more`}</div>}
      </div>
    </Card>
  )
}
