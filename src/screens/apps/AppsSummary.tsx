import { useRef, useState, type CSSProperties } from 'react'
import { dnsAppLabels, type InstalledApp } from '../../api/apps'
import { Card, Count, StackBar, hotEvents, statStyles as styles } from '../../ui/StatCard'
import { useTooltip } from '../../ui/Tooltip'
import { KINDS, NO_STORE_WHY, kindColour, updateState, type UpdateState } from './app-kinds'
import own from './Apps.module.css'

/*
THE APPS AT A GLANCE (deviation 17 in CONVENTIONS.md, 2026-11-06): four cards over
the installed list, drawn only from the `apps/list` the screen already reads.

  · Installed Apps   how many, and how they stand against the DNS App Store: up to
                     date, with an update, or with no store version (the server
                     wrote none of the three update fields; see api/apps.ts).
  · Classes          the DNS app classes the apps bring, by kind; pressing a kind
                     sets the table's Kind filter, exactly as choosing it there.
  · Query Logs       the apps whose classes serve Logs › Query Logs, and how many
                     classes log queries.
  · APP Records      the classes an APP record can name, the ones whose
                     `recordDataTemplate` More Details shows.

A count is a fact of the server, so a zero is drawn as 0 (DESIGN, rule 4).

Words of ours, all part of the deviation: the card titles `Classes`, `Query Logs`
and `APP Records` (the last two are upstream's own labels), `Up to date`, `Update
available`, `No store version` and its tooltip, `Read by Query Logs in the Logs
section.`, `Query Logger` as a fact, `None installed`, `Classes an APP record can
use.` and `N more`.
*/

const STATE_COLOUR: Record<UpdateState, string> = {
  'Up to date': 'var(--ok)',
  'Update available': 'var(--warn)',
  'No store version': 'var(--ch-drop)',
}

/** The APP record classes listed by name before the rest are counted. */
const APP_RECORD_SHOWN = 4

export function AppsSummary({
  apps,
  activeKind,
  onKind,
}: {
  apps: InstalledApp[]
  activeKind: string
  onKind: (kind: string) => void
}) {
  const [hotState, setHotState] = useState<string | null>(null)
  const [hotKind, setHotKind] = useState<string | null>(null)

  const states = (['Up to date', 'Update available', 'No store version'] as UpdateState[]).map((s) => ({
    key: s,
    name: s,
    value: apps.filter((a) => updateState(a) === s).length,
    colour: STATE_COLOUR[s],
  }))

  const classes = apps.flatMap((a) => a.dnsApps)
  const kinds = KINDS.map((k) => ({
    key: k,
    name: k,
    value: classes.filter((d) => dnsAppLabels(d).includes(k)).length,
    colour: kindColour(k),
  })).filter((k) => k.value > 0)

  const queryLogs = apps.filter((a) => a.dnsApps.some((d) => d.isQueryLogs))
  const loggers = classes.filter((d) => d.isQueryLogger).length
  const appRecords = classes.filter((d) => d.isAppRecordRequestHandler)

  return (
    <div className={styles.grid}>
      <Card title="Installed Apps" colour="var(--ch-total)">
        <div className={styles.body}>
          <div className={styles.figure}><Count value={apps.length} /></div>
          <StackBar
            label={states.map((s) => `${s.name} ${s.value}`).join(', ')}
            parts={states}
            hot={hotState}
            onHot={setHotState}
          />
          <dl className={own.stateRows}>
            {states.map((s) =>
              s.key === 'No store version' ? (
                <NoStoreVersion key={s.key} value={s.value} hot={hotState === s.key} onHot={setHotState} />
              ) : (
                <div key={s.key} data-hot={hotState === s.key || undefined} {...hotEvents(s.key, setHotState)}>
                  <dt>
                    <span className={styles.dot} style={{ background: s.colour }} /> {s.key}
                  </dt>
                  <dd className={s.key === 'Update available' && s.value > 0 ? styles.bad : undefined}>
                    <Count value={s.value} />
                  </dd>
                </div>
              ),
            )}
          </dl>
        </div>
      </Card>

      <Card title="Classes" colour="var(--ch-6)">
        <div className={styles.body}>
          <div className={styles.figure}><Count value={classes.length} /></div>
          <StackBar
            label={kinds.map((k) => `${k.name} ${k.value}`).join(', ')}
            parts={kinds}
            hot={hotKind}
            onHot={setHotKind}
          />
          {kinds.length > 0 && (
            <div className={styles.types} role="group" aria-label="Classes by kind">
              {kinds.map((k) => (
                <button
                  key={k.key}
                  type="button"
                  className={styles.typeChip}
                  style={{ '--sw': k.colour } as CSSProperties}
                  aria-pressed={activeKind === k.key}
                  data-hot={hotKind === k.key || undefined}
                  onClick={() => onKind(activeKind === k.key ? '' : k.key)}
                  {...hotEvents(k.key, setHotKind)}
                >
                  <span className={styles.typeLabel}>{k.name}</span>
                  <span className={styles.typeCount}>{k.value}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </Card>

      <Card title="Query Logs" colour={kindColour('Query Logs')}>
        <div className={styles.body}>
          {queryLogs.length === 0 ? (
            <div className={styles.quiet}>None installed</div>
          ) : (
            <ul className={`${styles.list} ${own.cardList}`} aria-label="Apps that serve Query Logs">
              {queryLogs.map((a) => (
                <li key={a.name}>
                  <span className={styles.dot} style={{ background: kindColour('Query Logs') }} />
                  <span className={own.cardName}>{a.name}</span>
                </li>
              ))}
            </ul>
          )}
          <div className={styles.caption}>Read by Query Logs in the Logs section.</div>
          <dl className={styles.facts}>
            <div>
              <dt>
                <span className={styles.dot} style={{ background: kindColour('Query Logger') }} /> Query Logger
              </dt>
              <dd><Count value={loggers} /></dd>
            </div>
          </dl>
        </div>
      </Card>

      <Card title="APP Records" colour={kindColour('APP Record')}>
        <div className={styles.body}>
          <div className={styles.figure}><Count value={appRecords.length} /></div>
          {appRecords.length > 0 && (
            <ul className={`${styles.list} ${own.cardList}`} aria-label="APP record classes">
              {appRecords.slice(0, APP_RECORD_SHOWN).map((d) => (
                <li key={d.classPath} className={own.classLine}>{d.classPath}</li>
              ))}
              {appRecords.length > APP_RECORD_SHOWN && (
                <li className={styles.quiet}>{appRecords.length - APP_RECORD_SHOWN} more</li>
              )}
            </ul>
          )}
          <div className={styles.caption}>Classes an APP record can use.</div>
        </div>
      </Card>
    </div>
  )
}

/*
The one fact whose meaning is not on the screen: an app with no store version may
come from a file, may have no version in the store for this server, or the store
may not have answered in time. The server says none of that, so the tooltip says
all three, as one sentence. The fact is a tab stop for it, with its label
underlined in dots, as Zones' "Not used since restart".
*/
function NoStoreVersion({ value, hot, onHot }: { value: number; hot: boolean; onHot: (k: string | null) => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const tip = useTooltip({ text: NO_STORE_WHY, placement: 'top', anchor: ref })
  const key = 'No store version'
  return (
    <div
      ref={ref}
      className={styles.explained}
      tabIndex={0}
      aria-describedby={tip.describedBy()}
      data-hot={hot || undefined}
      onMouseEnter={() => { tip.events.onMouseEnter(); onHot(key) }}
      onMouseLeave={() => { tip.events.onMouseLeave(); onHot(null) }}
      onFocus={() => { tip.events.onFocus(); onHot(key) }}
      onBlur={() => { tip.events.onBlur(); onHot(null) }}
    >
      <dt>
        <span className={styles.dot} style={{ background: STATE_COLOUR[key] }} /> {key}
      </dt>
      <dd>
        <Count value={value} />
        {tip.bubble}
      </dd>
    </div>
  )
}
