import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { visibleSections, visibleSubs, type Permission } from './sections'
import { useAllNavMarks } from './nav-marks'
import { toSlug } from './slug'
import text from '../ui/text.module.css'
import { toTrail, writeRoute, readRoute, translateLegacyRoute, plainClick } from './route'
import { ChangePassword } from '../screens/modals/ChangePassword'
import { ChangeTheme } from '../screens/modals/ChangeTheme'
import { Configure2FA } from '../screens/modals/Configure2FA'
import { CreateApiToken } from '../screens/modals/CreateApiToken'
import { Profile } from '../screens/profile/Profile'
import { Dashboard } from '../screens/dashboard/Dashboard'
import { DnsClient } from '../screens/dnsclient/DnsClient'
import { About } from '../screens/about/About'
import { Apps } from '../screens/apps/Apps'
import { Cache } from '../screens/lists/Lists'
import { Blocking } from '../screens/blocking/Blocking'
import { MENU_TABS, Settings, type RecordSettings, type ServerInfo } from '../screens/settings/Settings'
import { Zones } from '../screens/zones/Zones'
import { Dhcp } from '../screens/dhcp/Dhcp'
import { Logs } from '../screens/logs/Logs'
import { Admin } from '../screens/admin/Admin'
import { SlotProvider } from './ChromeSlot'
import {
  HandoffContext,
  targetNode,
  type DnsClientRequest,
  type Handoff,
  type QueryLogsRequest,
} from './handoff'
import styles from './Shell.module.css'
import { Icon, type IconName } from '../ui/Icon'
import { Menu } from '../ui/Menu'
import { ThisServerName } from '../ui/ClusterNodeSelect'
import { FooterLinks } from '../ui/FooterLinks'
import { Versions } from './Versions'
import { CommandPalette, PALETTE_KEYS } from './palette/CommandPalette'
import { accountItems, actionItems, pageItems, zoneItem, type PaletteItem, type Target } from './palette/items'
import { listAllZones } from '../api/zones'
import { useTheme } from '../theme/useTheme'
import { BrandMark } from './BrandMark'
import { BlockingMark } from './BlockingMark'
import { useBlockingMark } from '../screens/blocking/blocking-state'
import { Confirm } from '../ui/Confirm'
import { Notifier } from '../ui/Notifier'
import type { Notice } from '../lib/notice'
import {
  silenceUpdateNotification,
  unsilenceUpdateNotification,
  updateNotificationSilenced,
} from '../api/user'

type ModalId = 'password' | 'twofa' | 'token' | 'theme'

/** One glyph per section. No icon dependency: the server's CSP does not allow a
 *  CDN and an icon font would have to ship as a file in www/. */
/* The section icons live in `ui/Icon`, drawn; here we only say which one each
   section carries. Blocking carries Blocked's: it is the section that took its place. */
/*
The sidebar, by what you came to do (2026-11-06, CONVENTIONS.md deviation 24).

It was upstream's flat order in three unnamed groups. Now each group carries a
short heading (`Monitoring`, `DNS`, `Network`, `Tools`, `System`, OURS), and the sections with
screens of their own unfold them right here, under the open section: Blocking,
DHCP and Administration. Their sub-tabs under the title are gone, so a screen is
one click from anywhere and the page starts with its content. Logs is two entries
under Monitoring, Query Logs first: they are two different tools, and Query Logs
is the one opened every day. Settings keeps its own menu beside the form (nine panes and a search do
not fit a sidebar), so it unfolds nothing here.
*/
interface NavEntry {
  section: string
  /** An entry that is one sub-section of its section (Logs' two). */
  sub?: string
}
const NAV: { heading: string | null; entries: NavEntry[] }[] = [
  { heading: null, entries: [{ section: 'dashboard' }] },
  { heading: 'Monitoring', entries: [{ section: 'logs', sub: 'Query Logs' }, { section: 'logs', sub: 'View Logs' }] },
  { heading: 'DNS', entries: [{ section: 'zones' }, { section: 'cache' }, { section: 'blocking' }] },
  { heading: 'Network', entries: [{ section: 'dhcp' }] },
  { heading: 'Tools', entries: [{ section: 'dnsclient' }] },
  { heading: 'System', entries: [{ section: 'settings' }, { section: 'apps' }, { section: 'admin' }, { section: 'about' }] },
]
/** The sections whose sub-sections unfold in the sidebar. */
const UNFOLDS = new Set(['blocking', 'dhcp', 'admin'])

const ICONS: Record<string, IconName> = {
  dashboard: 'dashboard', zones: 'zones', cache: 'cache', blocking: 'blocked',
  apps: 'apps', dnsclient: 'dnsclient', settings: 'settings',
  dhcp: 'dhcp', admin: 'admin', logs: 'logs', about: 'about',
}
/* Logs' two entries: the query search, and the server's log files. */
const SUB_ICONS: Partial<Record<string, IconName>> = { 'Query Logs': 'search', 'View Logs': 'file' }

export interface ShellSession {
  token: string
  displayName: string
  username: string
  /** `Local`, `RemoteSSO` or `RemoteLDAP` since v15.5 (flat in `user/session/get`
   *  and `user/login`, WebServiceAuthApi.cs:74). */
  type?: string
  /** Obsolete since v15.5 (line 75): still sent, no longer read. */
  isSsoUser?: boolean
  /** Omitted for a `RemoteSSO` user (lines 77-82). */
  totpEnabled?: boolean
  info?: {
    version: string
    uptimestamp: string
    dnsServerDomain: string
    permissions?: Record<string, Permission>
    clusterInitialized?: boolean
    /** Only on an initialised cluster (WebServiceAuthApi.cs:104-106). */
    clusterDomain?: string
    clusterNodes?: { name: string; type: string }[]
    /* The record defaults the zone forms show (WebServiceAuthApi.cs:96-100). */
    defaultRecordTtl?: number
    defaultNsRecordTtl?: number
    defaultSoaRecordTtl?: number
    useSoaSerialDateScheme?: boolean
    dnssecValidation?: boolean
  }
}

export function Shell({
  session,
  onLogout,
  forcePasswordChange = false,
}: {
  session: ShellSession
  onLogout: () => void
  /** A factory-credentials login: Change Password opens at once with `admin` filled in (auth.js:283-284). */
  forcePasswordChange?: boolean
}) {
  const permissions = session.info?.permissions
  // Memoised: if it is recreated on every render, the `hashchange` resubscribes on each.
  const sections = useMemo(() => visibleSections(permissions), [permissions])
  /* The starting section comes from the address bar if it carries one, and only
     if not, from the first visible one. See `app/route.ts` for the reasoning. */
  /* Read once, on mount. `/allowed/` and `/blocked/` are Blocking's Rules tab now:
     the bar is rewritten (`replaceState`) before the route is read, here in the
     initialiser and not in the render body, so the side effect runs once; see
     `app/route.ts`. */
  const [initialRoute] = useState(() => {
    translateLegacyRoute()
    return readRoute(sections)
  })
  const [active, setActive] = useState(() => initialRoute?.section ?? sections[0]?.id ?? 'about')
  const [drawer, setDrawer] = useState(false)
  const [modal, setModal] = useState<ModalId | null>(forcePasswordChange ? 'password' : null)
  /* The factory password travels only with the opening the login caused; from the
     user menu `showChangePasswordModal()` is called with nothing (main.js). */
  const [forcedCurrentPassword, setForcedCurrentPassword] = useState<string | undefined>(
    forcePasswordChange ? 'admin' : undefined,
  )
  const [sub, setSub] = useState<string | null>(initialRoute?.sub ?? null)
  const [displayName, setDisplayName] = useState(session.displayName)
  const [totpEnabled, setTotpEnabled] = useState(session.totpEnabled ?? false)
  /* Bumped when an account dialog changes what My Profile shows (2FA, a new
     token), so the page reads `user/profile/get` again (deviation 21). */
  const [accountRevision, setAccountRevision] = useState(0)

  /*
  Silencing the update notice (`main.js:702-732`), which this console could read
  and not write: `checkForUpdate` already refused to call the endpoint while the
  preference was on, but nothing could ever turn it on, so the branch was
  unreachable and the user had no way to stop being told. Restored on 2026-09-04,
  checking About against upstream.

  It is a per-browser preference and not a server setting, which is why it lives
  in `localStorage` and why silencing it on your laptop does not silence it
  anywhere else.
  */
  const [silenced, setSilenced] = useState(() => updateNotificationSilenced())
  const [askSilence, setAskSilence] = useState(false)
  const [chromeNotice, setChromeNotice] = useState<Notice | null>(null)
  /*
  Once hidden in a session, the mark does not come back, and that is upstream's
  behaviour, not an oversight of ours: `disableUpdateNotification` calls
  `$("#lnkUpdateAvailable").hide()` and `enableUpdateNotification` never shows it
  again. You get the notice back by logging in again. Replicated as it stands, the
  same way `Quick Add`'s substring comparison is.
  */
  const [markHidden, setMarkHidden] = useState(false)

  function silence() {
    setAskSilence(false)
    silenceUpdateNotification()
    setSilenced(true)
    setMarkHidden(true)
    setChromeNotice({
      type: 'success',
      title: 'Notification Disabled!',
      text: 'Update notification was disabled successfully.',
    })
  }

  /* Enabling does NOT re-check, exactly as upstream: it writes the preference and
     says so. The next check is the next login. */
  function unsilence() {
    unsilenceUpdateNotification()
    setSilenced(false)
    setChromeNotice({
      type: 'success',
      title: 'Notification Enabled!',
      text: 'Update notification was enabled successfully.',
    })
  }

  function open(id: ModalId) {
    setModal(id)
  }

  /*
  `sessionData.info` is not fixed at login upstream: every load of this server's
  settings, and every save or restore of them, rewrites its domain, version and
  start time and redraws the tab title, the header and About
  (`updateDnsSettingsDataAndGui`, main.js:1158-1166). Settings reports them here.
  */
  const [serverInfo, setServerInfo] = useState<ServerInfo | null>(null)
  /* The record defaults, from login until Settings loads them again
     (main.js:1194-1196 and 1228). */
  const [recordSettings, setRecordSettings] = useState<RecordSettings | null>(null)
  const info = session.info && serverInfo ? { ...session.info, ...serverInfo } : session.info

  // main.js: the document title carries the server domain and the version.
  const title = info ? `${info.dnsServerDomain} - Technitium DNS Server v${info.version}` : null
  useEffect(() => {
    if (title != null) document.title = title
  }, [title])

  const current = sections.find((s) => s.id === active) ?? sections[0]
  const navMarks = useAllNavMarks()
  /* Whether blocking is off or paused, marked on its entry (`BlockingMark.tsx`). */
  const blockingNow = useBlockingMark(session.token, permissions, sections.some((s) => s.id === 'blocking'))

  /*
  The jumps other screens' row menus make (`app/handoff.ts`). The section switch
  and the request land in the same render, so the target mounts already holding
  it; the effect below then forgets it, because the target has taken what it
  needs, and coming back later through the sidebar must find a clean screen.

  A section the user cannot see is not opened: there would be no screen to land
  on.
  */
  const [pending, setPending] = useState<
    { dnsclient: DnsClientRequest } | { logs: QueryLogsRequest } | null
  >(null)
  useEffect(() => {
    if (pending != null) setPending(null)
  }, [pending])

  /*
  The command palette (deviation 26): Ctrl+K or ⌘K anywhere, or the field under the
  brand. The zones are read when it opens, at most once a minute, and only for a
  session that may see Zones.
  */
  const [palette, setPalette] = useState(false)
  const [paletteJump, setPaletteJump] = useState(0)
  /*
  The address a jump asked for. The screen that remounts reads it on its first
  render; the one it replaces may then take its own parameters out of the bar as it
  goes, some of them a microtask later (Zones drops `?zone=` that way, so the back
  button keeps the zone's own entry). A task after the remount, once all of that has
  run, the bar is set back to what was asked, replacing the entry.
  */
  const jumpUrl = useRef<string | null>(null)
  useEffect(() => {
    const asked = jumpUrl.current
    if (asked == null) return
    /* Cleared in the task, not here: StrictMode's rehearsal runs this twice and
       its cleanup cancels the first task. */
    const t = window.setTimeout(() => {
      jumpUrl.current = null
      if (window.location.pathname + window.location.search !== asked) {
        window.history.replaceState(null, '', asked)
      }
    }, 0)
    return () => window.clearTimeout(t)
  }, [paletteJump])
  const theme = useTheme()
  const zonesForPalette = useRef<{ at: number; items: PaletteItem[] } | null>(null)
  const [zoneItems, setZoneItems] = useState<PaletteItem[]>([])
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPalette((v) => !v)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  useEffect(() => {
    if (!palette || !sections.some((x) => x.id === 'zones')) return
    const kept = zonesForPalette.current
    if (kept != null && Date.now() - kept.at < 60_000) {
      setZoneItems(kept.items)
      return
    }
    let alive = true
    void listAllZones(session.token).then((zones) => {
      if (!alive || zones == null) return
      const items = zones.map((z) => zoneItem(z.name, z.type))
      zonesForPalette.current = { at: Date.now(), items }
      setZoneItems(items)
    })
    return () => {
      alive = false
    }
  }, [palette, sections, session.token])

  const paletteItems = useCallback(
    (query: string): PaletteItem[] => {
      const visible = (id: string) => sections.some((x) => x.id === id)
      const pages = pageItems(
        sections.filter((x) => x.id !== 'profile'),
        (x) => (x.id === 'settings' ? MENU_TABS.slice() : visibleSubs(x, permissions)),
      )
      return [
        ...actionItems(query, visible),
        ...pages,
        ...zoneItems,
        ...accountItems({
          canChangePassword: session.type !== 'RemoteSSO' && session.type !== 'RemoteLDAP',
          canConfigure2fa: session.type !== 'RemoteSSO',
        }),
      ]
    },
    [sections, permissions, zoneItems, session.type],
  )

  function runTarget(t: Target) {
    setDrawer(false)
    switch (t.kind) {
      case 'route': {
        const search = t.params != null ? `?${new URLSearchParams(t.params).toString()}` : ''
        window.history.pushState(null, '', toTrail({ section: t.section, sub: t.sub }) + search)
        window.dispatchEvent(new PopStateEvent('popstate'))
        if (search !== '') {
          jumpUrl.current = toTrail({ section: t.section, sub: t.sub }) + search
          setPaletteJump((n) => n + 1)
        }
        return
      }
      case 'dnsclient':
        handoff.queryDnsServer(t.domain, null, null)
        return
      case 'logs':
        handoff.showQueryLogs(t.domain, t.clientIp, null)
        return
      case 'modal':
        open(t.id)
        return
      case 'theme':
        theme.setChoice(t.choice)
        return
      case 'logout':
        onLogout()
    }
  }

  const handoff = useMemo<Handoff>(() => {
    const visible = (id: string) => sections.some((s) => s.id === id)
    return {
      queryDnsServer(domain, type, node) {
        if (!visible('dnsclient')) return
        setPending({ dnsclient: { domain, type: type ?? 'A', node: targetNode(node) } })
        setActive('dnsclient')
        setSub(null)
        setDrawer(false)
      },
      showQueryLogs(domain, clientIp, node, filters) {
        if (!visible('logs')) return
        setPending({ logs: { domain, clientIp, node: targetNode(node), ...(filters != null ? { filters } : {}) } })
        setActive('logs')
        setSub('Query Logs')
        setDrawer(false)
      },
      canShowQueryLogs: visible('logs'),
    }
  }, [sections])

  /*
  The effective sub. A section with sub-sections is ALWAYS in one of them, so
  `null` means "the first one".

  It is resolved here and not in each branch (there were five loose
  `sub ?? 'General'`, and the sidebar repeated the same workaround to decide what
  to mark) because a rule spread around is precisely the one that goes out of
  sync: the menu said "General" and the address bar said `/settings/`, which is
  half a page.
  */
  const currentSub = current?.subs != null ? (sub ?? current.subs[0] ?? null) : null

  /*
  The URL follows the state, and the state follows the URL. The guard is in
  `writeRoute`, which does not touch history if the route is already the current
  one: without it, responding to `popstate` by setting the state would write the
  route again.
  */
  // The first write normalises the URL and must leave no history entry.
  const firstRender = useRef(true)

  const activeRef = useRef({ section: current?.id ?? 'about', sub })
  useEffect(() => {
    if (current == null) return
    activeRef.current = { section: current.id, sub: currentSub }
    writeRoute({ section: current.id, sub: currentSub }, firstRender.current)
    firstRender.current = false
  }, [current, sub, currentSub])

  useEffect(() => {
    function onChanged() {
      translateLegacyRoute()
      const r = readRoute(sections)
      if (r == null) {
        // A route that does not resolve left the bar and the screen saying different
        // things. The screen rules: the URL is corrected.
        writeRoute({ section: activeRef.current.section, sub: activeRef.current.sub }, true)
        return
      }
      /*
      A half address (`/settings/`, with no sub) is completed here and not in the
      effect that writes the route: on going "back" the state does not change
      (`sub` was already `null`), so that effect does not run again and the bar was
      left saying half a page.

      And it is completed by replacing: pushing would leave a new entry pointing at
      where we already are, and the back button would go round in circles.
      */
      const section = sections.find((x) => x.id === r.section)
      const own = r.sub ?? section?.subs?.[0] ?? null
      if (own !== r.sub) writeRoute({ section: r.section, sub: own }, true)

      setActive((v) => (v === r.section ? v : r.section))
      setSub((v) => (v === own ? v : own))
    }
    window.addEventListener('popstate', onChanged)
    return () => window.removeEventListener('popstate', onChanged)
  }, [sections])

  return (
    <HandoffContext.Provider value={handoff}>
    <ThisServerName.Provider value={info?.dnsServerDomain ?? session.info?.dnsServerDomain ?? ''}>
    <SlotProvider>
      {(slot) => (
    <div className={styles.shell}>
      {drawer && (
        <button
          type="button"
          className={styles.veil}
          aria-label="Close menu"
          onClick={() => setDrawer(false)}
        />
      )}

      <aside className={styles.side} data-open={drawer}>
        {/*
        What is running sits where each thing is named (2026-11-06): this console's
        version beside its name, the DNS server's under the account that is signed in
        to it. `Versions` runs the update checks once and hands back each mark.
        */}
        <Versions
          token={session.token}
          serverVersion={info?.version}
          domain={info?.dnsServerDomain}
          markHidden={markHidden}
          canCheckConsole={permissions?.DnsClient?.canView === true}
        >
          {({ serverMark, consoleMark }) => (
        <>
        <div className={styles.sbrand}>
          <BrandMark size={30} />
          <span className={styles.brandText}>
            <span className={styles.brandLine}>
              <span className={styles.brandName}>Technitium</span>
              <span className={styles.chipVer} title="Web Console version">
                <span className={text.sr}>Web Console </span>v{__CONSOLE_VERSION__}
              </span>
            </span>
            <span className={styles.brandLine}>
              <span className={styles.brandSub}>Console</span>
              {consoleMark}
            </span>
          </span>
        </div>
        {/* The palette's door: a field that is a button, with its shortcut. */}
        <button type="button" className={styles.find} onClick={() => setPalette(true)} aria-keyshortcuts="Control+K Meta+K">
          <Icon name="search" size={15} />
          <span className={styles.findText}>Search or jump to…</span>
          <kbd className={styles.findKeys}>{PALETTE_KEYS}</kbd>
        </button>
        <nav className={styles.slist} role="navigation" aria-label="Sections">
          {/*
          This is a navigation menu, and until now it claimed to be a `tablist`.

          It was declared as tabs when the console had no addresses: twelve
          `role="tab"` over a single panel. Once it gained real routes
          (`app/route.ts`) the description stopped being true (the ARIA guidance is
          explicit: if activating the element leads to another URL, it is a link,
          not a tab), and on top of that the sub-sections hung INSIDE the `tablist`
          as loose buttons, which is a child that role does not allow. It announced
          "tab 3 of 12" and navigated.

          Now they are links with real `href`s: they open in a new tab, they are
          copied and bookmarked. The plain click is intercepted by the application
          (there is no reload); the modifier click is passed through to the
          browser, which is what the routes existing as files is for. The active
          section is marked with `data-active` (that is visual state) and
          `aria-current="page"` is reserved for ONE thing: the page you are on,
          which is the sub-section when there is one.
          */}
          {NAV.map((group, g) => {
            const entries = group.entries.filter((e) => sections.some((sec) => sec.id === e.section))
            if (entries.length === 0) return null
            const headingId = group.heading != null ? `nav-${toSlug(group.heading)}` : undefined
            return (
              <div className={styles.group} key={g} role={headingId != null ? 'group' : undefined} aria-labelledby={headingId}>
                {group.heading != null && (
                  <span className={styles.heading} id={headingId}>{group.heading}</span>
                )}
                {entries.map((entry) => {
                  const sec = sections.find((x) => x.id === entry.section)!
                  const subs = UNFOLDS.has(sec.id) ? visibleSubs(sec, permissions) : []
                  const target = entry.sub ?? subs[0] ?? sec.subs?.[0] ?? null
                  const here = sec.id === current?.id
                  const active = here && (entry.sub == null || entry.sub === currentSub)
                  const open = here && subs.length > 0
                  const label = entry.sub ?? sec.label
                  return (
                    <div key={`${sec.id}/${entry.sub ?? ''}`}>
                      <a
                        className={styles.s}
                        href={toTrail({ section: sec.id, sub: target })}
                        data-active={active}
                        data-open={subs.length > 0 ? open : undefined}
                        aria-current={active && !open ? 'page' : undefined}
                        title={sec.id === 'blocking' ? blockingNow?.label : undefined}
                        onClick={(e) => {
                          if (!plainClick(e)) return
                          e.preventDefault()
                          setActive(sec.id)
                          setSub(target)
                          setDrawer(false)
                        }}
                      >
                        <span className={styles.ico}>
                          <Icon name={(entry.sub != null ? SUB_ICONS[entry.sub] : undefined) ?? ICONS[sec.id] ?? 'about'} size={16} />
                        </span>
                        {label}
                        {sec.id === 'blocking' && <BlockingMark mark={blockingNow} />}
                      </a>
                      {open && (
                        <div className={styles.sub}>
                          {subs.map((t) => (
                            <a
                              key={t}
                              className={styles.s2}
                              href={toTrail({ section: sec.id, sub: t })}
                              aria-current={t === currentSub ? 'page' : undefined}
                              onClick={(e) => {
                                if (!plainClick(e)) return
                                e.preventDefault()
                                setSub(t)
                                setDrawer(false)
                              }}
                            >
                              {t}
                              {navMarks[sec.id]?.[t] != null && (
                                <>
                                  <span className={text.sr}>, {navMarks[sec.id]?.[t]}</span>
                                  <span className={styles.subMark} aria-hidden="true" />
                                </>
                              )}
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )
          })}
        </nav>

        {/* The server and the account, at the foot. When narrow you reach it via the drawer. */}
        <div className={styles.footSide}>
          {/*
          Upstream's footer links, recovered.

          Upstream has them in a `div#footer` hanging off the `body`, so they are
          visible on ALL its screens, the login one included: Technitium, Blog,
          Donate, DNS Client and GitHub. There were none here, and two of them
          (technitium.com and dnsclient.net) appeared nowhere else in the console:
          they had been lost entirely.

          "About" is not repeated because in this redesign it is a sidebar section,
          right above.
          */}
          {/*
          What is running, and whether there is anything newer. The server's
          domain heads it because the block is about that server, which is the
          pairing upstream makes in its panel title.
          */}
          {/* The server the account is signed in to, and the version it runs. */}
          <div className={styles.server}>
            <span className={styles.serverName} title={info?.dnsServerDomain}>{info?.dnsServerDomain ?? ''}</span>
            <span className={styles.serverLine}>
              <span className={styles.serverVer}>
                DNS Server <b>{info?.version ?? '—'}</b>
              </span>
              {serverMark}
            </span>
          </div>
          <Menu label={displayName} text={displayName} anchor="left" asRow>
            {(close) => (
              <>
                {/* A page since 2026-11-06 (deviation 21): it navigates to
                    `/profile/`, where upstream opens `modalMyProfile`. */}
                <button
                  type="button"
                  onClick={() => {
                    close()
                    setActive('profile')
                    setSub(null)
                    setDrawer(false)
                  }}
                >
                  My Profile
                </button>
                {/* main.js:71-87 (v15.5.1) switches on `sessionData.type`:
                    `RemoteSSO` hides both, `RemoteLDAP` hides only the password
                    (the directory owns it, the 2FA is still this server's) and
                    `Local` or anything else shows both. */}
                {session.type !== 'RemoteSSO' && session.type !== 'RemoteLDAP' && (
                  <button type="button" onClick={() => { close(); open('password') }}>
                    Change Password
                  </button>
                )}
                {session.type !== 'RemoteSSO' && (
                  <button type="button" onClick={() => { close(); open('twofa') }}>
                    Configure 2FA
                  </button>
                )}
                <button type="button" onClick={() => { close(); open('token') }}>
                  Create API Token
                </button>
                {/* index.html:71: after the account's own entries, before the
                    update notification. */}
                <button type="button" onClick={() => { close(); open('theme') }}>
                  Change Theme
                </button>
                {/*
                One entry and not two: upstream declares both and hides one
                (`index.html:72-73`, `initUpdateNotificationMenu`), which is how
                you write a toggle in jQuery. The literal of each is upstream's.
                */}
                {silenced ? (
                  <button type="button" onClick={() => { close(); unsilence() }}>
                    Enable Update Notification
                  </button>
                ) : (
                  <button type="button" onClick={() => { close(); setAskSilence(true) }}>
                    Disable Update Notification
                  </button>
                )}
                <button type="button" onClick={() => { close(); onLogout() }}>
                  Logout
                </button>
              </>
            )}
          </Menu>
        </div>
        </>
          )}
        </Versions>
      </aside>

      <div className={styles.main}>
        {/*
        On a WIDE screen there is no header: it only carried the server domain and
        the account menu, both pinned to the right edge, and it measured 1224×52
        with 78 % of the width empty (952 px out of 1224), pushing every section's
        title down to `y=76`. Both things move down to the foot of the sidebar,
        which had 377 px free, 42 % of its height.

        On a NARROW screen it is needed, because the sidebar is a closed drawer and
        its trigger has to live outside.
        */}
        <header className={styles.rtop}>
          <button
            type="button"
            className={styles.hamburger}
            aria-label="Menu"
            aria-expanded={drawer}
            onClick={() => setDrawer((v) => !v)}
          >
            <Icon name="menu" size={18} />
          </button>
          <button type="button" className={styles.findIcon} aria-label="Search" onClick={() => setPalette(true)}>
            <Icon name="search" size={17} />
          </button>
          <span className={styles.topBrand}>
            <BrandMark size={26} />
            <span className={styles.brandText}>
              <span className={styles.brandName}>Technitium</span>
              <span className={styles.brandSub}>Console</span>
            </span>
          </span>
        </header>

        {/* Neither `tabpanel` nor `aria-labelledby`: ever since each section has its
            own URL this is not a panel being switched, it is the page. */}
        <main className={styles.body} id="panel-section">
        {/*
      The chrome slot: the chrome provides the PLACE, the screen provides the
      control. See `ChromeSlot.tsx`: the node selector belongs to each screen,
      with its memory and its options, and none of them hears about the others.

      It stays empty while nobody uses it, and then it takes up nothing: it is a
      `div` with no content.
        */}
        <div ref={slot} className={styles.chromeSlot} />
        {/* The chrome's own alert slot. Upstream's `showAlert` with no
            destination is a page-level alert, and until now the chrome had
            nowhere to put one. */}
        <Notifier notice={chromeNotice} onClose={() => setChromeNotice(null)} />
        {/* Keyed on the palette's jumps, so a screen it opens on a name reads the
            address bar again even when it was already on screen. */}
        <Fragment key={paletteJump}>
        {current?.id === 'dashboard' ? (
          <Dashboard
            token={session.token}
            nodes={session.info?.clusterNodes ?? []}
            clusterInitialised={session.info?.clusterInitialized === true}
          />
        ) : current?.id === 'dnsclient' ? (
          <DnsClient
            token={session.token}
            nodes={session.info?.clusterNodes ?? []}
            clusterInitialised={session.info?.clusterInitialized === true}
            request={pending != null && 'dnsclient' in pending ? pending.dnsclient : undefined}
          />
        ) : current?.id === 'profile' ? (
          <Profile
            token={session.token}
            nodes={session.info?.clusterNodes ?? []}
            clusterInitialised={session.info?.clusterInitialized === true}
            revision={accountRevision}
            onProfile={(p) => {
              setDisplayName(p.displayName)
              setTotpEnabled(p.totpEnabled)
            }}
            onOpen={open}
          />
        ) : current?.id === 'about' ? (
          <About info={info} />
        ) : current?.id === 'apps' ? (
          <Apps token={session.token} />
        ) : current?.id === 'cache' ? (
          <Cache token={session.token} nodes={session.info?.clusterNodes ?? []} clusterInitialised={session.info?.clusterInitialized === true} />
        ) : current?.id === 'blocking' && currentSub === 'Settings' && permissions?.Settings?.canView !== false ? (
          /* Blocking's Settings page: the Settings form with its Blocking pane alone
             (deviation 24). Same permissions as Settings' own Save. */
          <Settings
            only={{ pane: 'Blocking', section: 'Blocking', title: 'Settings' }}
            token={session.token}
            nodes={session.info?.clusterNodes ?? []}
            clusterInitialised={session.info?.clusterInitialized === true}
            canModify={permissions?.Settings?.canModify !== false}
            canFlushCache={permissions?.Cache?.canDelete !== false}
            canBackup={permissions?.Settings?.canDelete !== false}
            serverDomain={session.info?.dnsServerDomain}
            onServerInfo={setServerInfo}
            onRecordSettings={setRecordSettings}
          />
        ) : current?.id === 'blocking' ? (
          <Blocking
            token={session.token}
            sub={currentSub}
            onSubChange={setSub}
            permissions={permissions}
            nodes={session.info?.clusterNodes ?? []}
            clusterInitialised={session.info?.clusterInitialized === true}
            serverDomain={info?.dnsServerDomain}
          />
        ) : current?.id === 'zones' ? (
          <Zones
            token={session.token}
            nodes={session.info?.clusterNodes ?? []}
            clusterInitialised={session.info?.clusterInitialized === true}
            canModify={permissions?.Zones?.canModify !== false}
            canDelete={permissions?.Zones?.canDelete !== false}
            clusterDomain={session.info?.clusterDomain}
            useSoaSerialDateScheme={(recordSettings ?? session.info)?.useSoaSerialDateScheme === true}
            dnssecValidation={(recordSettings ?? session.info)?.dnssecValidation !== false}
            recordTtls={{
              defaultRecordTtl: (recordSettings ?? session.info)?.defaultRecordTtl ?? 3600,
              defaultNsRecordTtl: (recordSettings ?? session.info)?.defaultNsRecordTtl ?? 14400,
              defaultSoaRecordTtl: (recordSettings ?? session.info)?.defaultSoaRecordTtl ?? 900,
            }}
          />
        ) : current?.id === 'dhcp' ? (
          <Dhcp
            token={session.token}
            nodes={session.info?.clusterNodes ?? []}
            clusterInitialised={session.info?.clusterInitialized === true}
            sub={currentSub ?? 'Leases'}
            onSubChange={setSub}
            canModify={permissions?.DhcpServer?.canModify !== false}
            canDelete={permissions?.DhcpServer?.canDelete !== false}
          />
        ) : current?.id === 'logs' ? (
          /* "Delete All Stats" lives on the Logs screen but asks for the
             Dashboard's permission (WebServiceLogsApi.cs:135). Not an oversight. */
          <Logs
            token={session.token}
            nodes={session.info?.clusterNodes ?? []}
            clusterInitialised={session.info?.clusterInitialized === true}
            sub={currentSub ?? 'View Logs'}
            onSubChange={setSub}
            canDeleteLogs={permissions?.Logs?.canDelete !== false}
            canDeleteStats={permissions?.Dashboard?.canDelete !== false}
            request={pending != null && 'logs' in pending ? pending.logs : undefined}
          />
        ) : current?.id === 'admin' ? (
          /* No permission props on purpose: upstream hides and disables nothing
             inside Administration, only the whole section (main.js:165). */
          <Admin token={session.token} sub={currentSub ?? 'Sessions'} onSubChange={setSub} />
        ) : current?.id === 'settings' ? (
          /* main.js:906-930: three different permissions in a single bar:
             saving requires Settings.canModify, flushing the cache
             Cache.canDelete, and backup/restore Settings.canDelete. */
          <Settings
            token={session.token}
            nodes={session.info?.clusterNodes ?? []}
            clusterInitialised={session.info?.clusterInitialized === true}
            sub={currentSub ?? 'General'}
            onSubChange={setSub}
            canModify={permissions?.Settings?.canModify !== false}
            canFlushCache={permissions?.Cache?.canDelete !== false}
            canBackup={permissions?.Settings?.canDelete !== false}
            serverDomain={session.info?.dnsServerDomain}
            onServerInfo={setServerInfo}
            onRecordSettings={setRecordSettings}
          />
        ) : null}
        </Fragment>
        </main>

        {/*
        Upstream's links, at the foot of the page and not in the side panel.

        Upstream hangs them off a `div#footer` on the `body`, below everything:
        they are destinations you go to when you have finished, not navigation you
        use while working. In the side panel they sat between the sections and the
        account, competing with both; here they close the page, which is where
        they were.
        */}
        <footer className={styles.footMain}>
          <FooterLinks />
        </footer>
      </div>

      <ChangePassword
        open={modal === 'password'}
        onOpenChange={(o) => {
          setModal(o ? 'password' : null)
          if (!o) setForcedCurrentPassword(undefined)
        }}
        totpEnabled={totpEnabled}
        token={session.token}
        username={session.username}
        currentPassword={forcedCurrentPassword}
        onNotice={setChromeNotice}
      />
      <Configure2FA
        open={modal === 'twofa'}
        onOpenChange={(o) => setModal(o ? 'twofa' : null)}
        token={session.token}
        username={session.username}
        onChanged={(enabled) => {
          setTotpEnabled(enabled)
          setAccountRevision((n) => n + 1)
        }}
        onNotice={setChromeNotice}
      />
      <CreateApiToken
        open={modal === 'token'}
        onOpenChange={(o) => setModal(o ? 'token' : null)}
        username={session.username}
        token={session.token}
        onCreated={() => setAccountRevision((n) => n + 1)}
      />
      <CommandPalette open={palette} onOpenChange={setPalette} items={paletteItems} onRun={(item) => runTarget(item.target)} />
      <ChangeTheme
        open={modal === 'theme'}
        onOpenChange={(o) => setModal(o ? 'theme' : null)}
      />

      {/* Upstream asks with a native `confirm()`; this console asks with its own,
          and the sentence is upstream's, whole. */}
      <Confirm
        open={askSilence}
        title="Disable Update Notification"
        text={
          'Disabling update notification will prevent the Web Console from showing new update notification when you login. You will have to manually find out if a new update is available.\n\nAre you sure you want to disable update notification?'
        }
        label="Disable"
        onClose={() => setAskSilence(false)}
        onConfirm={silence}
      />
    </div>
      )}
    </SlotProvider>
    </ThisServerName.Provider>
    </HandoffContext.Provider>
  )
}
