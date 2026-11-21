import { useEffect, useRef, useState, type ReactNode } from 'react'
import { readSettings } from '../../api/settings'
import { loadQuickList, type QuickEntry } from '../../lib/quick-lists'
import { PermissionButton } from '../../ui/PermissionButton'
import { RouteLink } from '../../ui/RouteLink'
import { reportedListName } from '../blocking/check-domain'
import { moreLists } from '../blocking/extra-lists'
import {
  cachedReport, fileName, heldText, listLabel, lookUpNames, silenceOf, type Held,
} from '../blocking/list-hits'
import styles from './Dashboard.module.css'

/*
WHICH LIST BLOCKS EACH OF TOP BLOCKED DOMAINS' NAMES (deviation 46, extended on
2026-11-20; upstream issue #2293 asks for it). Upstream's panel says how often a name
was blocked and never why, and the server keeps no per-list counter. Here the panel
offers `Show lists` under its rows (its header keeps upstream's Blocking menu and
More, and a third control there broke the title into three lines), and only a press
reads anything: the same two steps Blocking ›
Overview's Count lists takes (`list-hits.ts`), without its log read.

  · `settings/get` for the node the panel reads (the connected one on the cluster
    aggregate), and `apps/list` only when a setting would stop it (`silenceOf`).
    Blocking disabled or paused, `Allow TXT Blocking Report` off, or this server on
    its own Blocking Bypass List: nothing is looked up, and the panel says why with
    Count lists' sentence and its link to Blocking › Settings. Without
    `Settings: View` it says the settings were not checked and looks nothing up;
    without `DnsClient: View` the button is locked.
  · One TXT query per name on screen through DNS Client (`lookUpNames`), at most the
    five the panel draws, four at a time, read as a blocking report the way Check and
    Count lists read it. A name already read, here or by Count lists, is not asked
    again while its report is remembered (`cachedReport`).
  · Each row then says what blocks it where a client's domain goes: the list's name
    (the catalogue's, else its file name), `Advanced Blocking` and its group, `Your
    rule`, `No list reported` or `Lookup failed`. A name that came in with a later
    refresh says nothing until the next press. The answer is what blocks the name
    now, which the note under the rows says, not what blocked it in the period.

Nothing is read on load, on a refresh or on a period change, and the More dialog is
not touched. Before a press, and while one runs, the line beside the button says
what a press costs, as Count lists says it before its own: its lookups come from
this server, so they are logged as blocked queries and count in this Dashboard's
Top Blocked Domains and Top Clients. Its words, OURS: `Show lists`, its title
`Asks this server which list blocks each name shown. Allow TXT Blocking Report has
to be enabled.`, `One click asks this server about the names shown and sends at
most 5 lookups.`, `Your rule`,
`Which list blocks each name now, as <server> reports it.` (`this server` off the
aggregate), and those it shares with Count lists (`No list reported`, `Lookup
failed`, `Each lookup is logged as blocked from this server.`, `The Advanced Blocking
app names only the first list.`, the held sentences and `Blocking › Settings`).
*/

/** At most the rows the panel draws. */
const SHOWN = 5

type View =
  | { kind: 'idle' }
  | { kind: 'busy' }
  | { kind: 'held'; held: Held }
  | { kind: 'done'; catalog: readonly QuickEntry[] }

/** What blocks a name, from its remembered report, or `null` when it was not read. */
export function blockedBy(node: string, name: string, catalog: readonly QuickEntry[]): string | null {
  const report = cachedReport(node, name.toLowerCase())
  if (report == null) return null
  if (!report.ok) return 'Lookup failed'
  const labels: string[] = []
  for (const reason of report.reasons) {
    const label =
      reason.source === 'list'
        ? (reportedListName(reason.url, catalog) ?? fileName(reason.url))
        : reason.source === 'app'
          ? listLabel({ app: true, url: '', group: reason.group }, catalog)
          : reason.source === 'rule'
            ? 'Your rule'
            : null
    if (label != null && !labels.includes(label)) labels.push(label)
  }
  return labels.length > 0 ? labels.join(', ') : 'No list reported'
}

export function useBlockedLists({
  token,
  node,
  names,
  serverDomain,
  aggregate,
  dnsNeed,
  settingsNeed,
}: {
  token: string | null
  /** The node lookups go to: `''` for the connected one. */
  node: string
  /** The names the panel draws, in its order. */
  names: string[]
  serverDomain?: string
  aggregate: boolean
  /** `DnsClient.canView` when it is missing: the lookups need it. */
  dnsNeed?: string
  /** `Settings.canView` when it is missing: the gate reads the settings first. */
  settingsNeed?: string
}): { foot: ReactNode; detail: (name: string) => string | null } {
  const [view, setView] = useState<View>({ kind: 'idle' })
  const asked = useRef(0)
  /* What is on screen answers one node and one token: another starts over. */
  const context = `${token ?? ''}|${node}`
  const shown = useRef(context)
  useEffect(() => {
    if (shown.current === context) return
    shown.current = context
    asked.current += 1
    setView({ kind: 'idle' })
  }, [context])

  async function show() {
    const mine = ++asked.current
    const where = node
    const wanted = names.slice(0, SHOWN).map((n) => n.toLowerCase())
    if (settingsNeed != null) {
      setView({ kind: 'held', held: { kind: 'unread', missing: { need: settingsNeed } } })
      return
    }
    setView({ kind: 'busy' })
    const [settings, catalog] = await Promise.all([
      readSettings(token, where),
      loadQuickList('quick-block-lists').then((entries) => [...entries, ...moreLists(entries)]),
    ])
    if (mine !== asked.current) return
    if (settings.kind !== 'ok') {
      setView({ kind: 'held', held: { kind: 'unread', missing: { failed: true } } })
      return
    }
    const silence = await silenceOf(token, settings.data, where)
    if (mine !== asked.current) return
    if (silence != null) {
      setView({ kind: 'held', held: silence })
      return
    }
    await lookUpNames(token, wanted.filter((n) => cachedReport(where, n) == null), where)
    if (mine !== asked.current) return
    setView({ kind: 'done', catalog })
  }

  const done = view.kind === 'done' ? view : null
  const detail = (name: string) => (done == null ? null : blockedBy(node, name, done.catalog))
  const fromApp = done != null && names.slice(0, SHOWN).some((n) => detail(n)?.startsWith('Advanced Blocking'))
  const who = aggregate && serverDomain != null && serverDomain !== '' ? serverDomain : 'this server'

  const action = (
    <PermissionButton
      size="sm"
      permission={dnsNeed}
      disabled={view.kind === 'busy' || names.length === 0}
      title="Asks this server which list blocks each name shown. Allow TXT Blocking Report has to be enabled."
      onClick={() => void show()}
    >
      Show lists
    </PermissionButton>
  )

  const note =
    (view.kind === 'idle' || view.kind === 'busy') && names.length > 0 ? (
      <p className={styles.listsNote}>
        {`One click asks this server about the names shown and sends at most ${SHOWN} lookups. Each lookup is logged as blocked from this server.`}
      </p>
    ) : view.kind === 'held' ? (
      <p className={styles.listsNote}>
        {heldText(view.held)}
        {view.held.kind !== 'unread' && (
          <>
            {' '}
            <RouteLink to={{ section: 'blocking', sub: 'Settings' }}>Blocking › Settings</RouteLink>
          </>
        )}
      </p>
    ) : done != null ? (
      <p className={styles.listsNote}>
        {`Which list blocks each name now, as ${who} reports it. Each lookup is logged as blocked from this server.`}
        {fromApp ? ' The Advanced Blocking app names only the first list.' : ''}
      </p>
    ) : null

  /* The note, when there is one, and the button at the end of its line. */
  const foot = (
    <div className={styles.listsFoot}>
      {note}
      {action}
    </div>
  )
  return { foot, detail }
}
