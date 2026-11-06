import { ClusterNodeSelect } from '../../ui/ClusterNodeSelect'
import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { PermissionButton } from '../../ui/PermissionButton'
import { SectionHeader } from '../../ui/SectionHeader'
import { useSectionInView } from '../../ui/useSectionInView'
import { BlockAnchors } from '../../ui/PanelForm'
import { Empty } from '../../ui/Empty'
import { dropParams, readParam, writeParams } from '../../lib/url-state'
import { SettingsMenu } from './SettingsMenu'
import { countMatches, mark, narrow, unitTexts } from './search'
import { PaneMirror } from './panes/mirror'
import type { PaneProps } from './panes/types'
import type { BlockingExtra } from './panes/Blocking'
import { openDownload } from '../../api/user'
import {
  flushCache,
  forceUpdateBlockLists,
  getSettings,
  backupParams,
  restoreSettings,
  initialBackupSelection,
  setSettings,
  temporaryDisableBlocking,
  type DnsSettings,
  type SettingsEnvelope,
} from '../../api/settings'
import { buildBody, formFromSettings, enabled, selectedNode, type SettingsForm } from './model'
import { pendingByPane, pendingText } from './pending'
import { detectReverseProxy, REDIRECT_DELAY_MS, webConsoleRedirection } from './redirect'
import { General } from './panes/General'
import { WebService } from './panes/WebService'
import { OptionalProtocols } from './panes/OptionalProtocols'
import { Tsig } from './panes/Tsig'
import { Recursion } from './panes/Recursion'
import { Cache } from './panes/Cache'
import { Blocking } from './panes/Blocking'
import { ProxyForwarders } from './panes/ProxyForwarders'
import { Logging } from './panes/Logging'
import { BackupDialog, Confirm, RestoreDialog } from './dialogs'
import { Failure, Loading } from '../../ui/Empty'
import styles from './Settings.module.css'
import { noticeFromFailure, type Notice } from '../../lib/notice'
import { Notifier } from '../../ui/Notifier'

/*
Settings. The console's biggest screen: in upstream, the General sub-tab alone is
5,452 px tall.

It keeps A SINGLE form state for the nine sub-sections: upstream does not have
nine forms either, it has one with nine tabs, and "Save Settings" ALWAYS sends the
fields of all nine wherever you are. Chopping it up per pane would change what gets
saved.

## How it is laid out (2026-11-06, CONVENTIONS.md deviation 22: one form)

  · The header is the pane: `Settings ›` as the path, the sub-section as the title
    ("Cache" is also a section, so the path says which one), and at the right the
    verbs that are not the form's: Backup Settings, Restore Settings and Flush
    Cache, beside the cluster node.
  · ONE navigation, `SettingsMenu`, at the left of the form: the nine sub-sections
    (routes, as `ui/SubTabs` drew them) and, under the current one, its blocks
    (anchors, the one in view marked), with Search settings at its top. It replaced
    a row of tabs above a second row of block links that looked like tabs and only
    scrolled. Narrow, it folds into a bar at the top.
  · The form in ONE readable column, each row the label with its help under it and
    the control beside it (`ui/Form`, `ui/FoldHelp`).
  · The save bar, pinned to the bottom of the window for the whole screen, saying
    what the save would change (deviation 3) and holding Save Settings.

Two consequences of the single form to keep in mind:

  · A validation failure can be on another sub-tab. Upstream focuses the field
    even when its tab is hidden and the user sees nothing. Here the alert says
    what is missing and the screen jumps to the field's sub-tab (deviation 3).
  · The verbs ask for three different permissions: saving requires
    `Settings.canModify`, flushing the cache `Cache.canDelete`, and backup and
    restore `Settings.canDelete` (main.js:906-930).

And one consequence that is OURS (deviation 3, approved on 2026-10-16): since the
save sends all nine, the bar says which panes hold something it would change,
`Unsaved changes: General (2), Cache (1)`, and each of those carries a mark read
as `unsaved changes` in the menu. What counts as a change is `pending.ts`'s
business, and it only displays: saving, Backup, Restore, Flush Cache and the
blocking buttons do exactly what they did.
*/

export const SUB_TABS = [
  'General',
  'Web Service',
  'Optional Protocols',
  'TSIG',
  'Recursion',
  'Cache',
  'Blocking',
  'Proxy & Forwarders',
  'Logging',
] as const

export type SubTab = (typeof SUB_TABS)[number]

/** What `updateDnsSettingsDataAndGui` takes from a settings response. */
export interface ServerInfo {
  dnsServerDomain: string
  version: string
  uptimestamp: string
}

function serverInfoOf(s: DnsSettings): ServerInfo {
  return { dnsServerDomain: s.dnsServerDomain, version: s.version, uptimestamp: s.uptimestamp }
}

/*
What the zone forms read from the settings: `loadDnsSettings` rewrites the
session's default TTLs on every load, whatever the node (main.js:1194-1196), and
Add Zone and the FWD record read the DNSSEC and serial-scheme boxes the same load
fills (main.js:1228, zone.js:2825, 2836, 4746).
*/
export interface RecordSettings {
  defaultRecordTtl: number
  defaultNsRecordTtl: number
  defaultSoaRecordTtl: number
  useSoaSerialDateScheme: boolean
  dnssecValidation: boolean
}

function recordSettingsOf(s: DnsSettings): RecordSettings {
  return {
    defaultRecordTtl: s.defaultRecordTtl,
    defaultNsRecordTtl: s.defaultNsRecordTtl,
    defaultSoaRecordTtl: s.defaultSoaRecordTtl,
    useSoaSerialDateScheme: s.useSoaSerialDateScheme,
    dnssecValidation: s.dnssecValidation,
  }
}

export interface SettingsProps {
  /** The cluster nodes, for the node selector. */
  nodes?: { name: string; type: string }[]
  clusterInitialised?: boolean

  token: string | null
  /** The active sub-tab, the one the Shell's side panel marks. */
  sub?: string | null
  /** Lets the Shell follow the screen when a validation failure forces it to
   *  jump to another sub-tab. */
  onSubChange?: (sub: SubTab) => void
  canModify?: boolean
  canFlushCache?: boolean
  canBackup?: boolean
  /** The session's `info.dnsServerDomain`: upstream compares it with the
   *  `server` that answers a save or a restore before following the web
   *  console to a new address (main.js:2216, 3187). */
  serverDomain?: string
  /**
   * The rest of `updateDnsSettingsDataAndGui` (main.js:1158-1166): the session's
   * domain, version and start time, which the tab title, the header and About
   * draw. Called under the same conditions upstream calls it.
   */
  onServerInfo?: (info: ServerInfo) => void
  /** Every load and save, any node: what the zone forms read (`RecordSettings`). */
  onRecordSettings?: (s: RecordSettings) => void
}

export function Settings({
  token,
  sub,
  onSubChange,
  canModify = true,
  canFlushCache = true,
  canBackup = true,
  nodes = [],
  clusterInitialised = false,
  serverDomain,
  onServerInfo,
  onRecordSettings,
}: SettingsProps) {
  /*
  Settings is one of only two screens that offer the aggregate and remember the
  choice; the key is upstream's own (`cluster.js`).

  What travels is what upstream's selector HOLDS, not what was remembered: on a
  standalone server that is `""`, never `"cluster"` (the save decides which
  blocks to send from it, so `"cluster"` there would drop every node parameter).
  See `selectedNode`. Upstream stores the held value on every load
  (main.js:905), so a standalone server remembers `""`.
  */
  const [remembered, setNode] = useState<string | null>(() =>
    localStorage.getItem('settingsClusterNode'),
  )
  const node = selectedNode(remembered, clusterInitialised, nodes)
  useEffect(() => {
    localStorage.setItem('settingsClusterNode', node)
  }, [node])

  /*
  Two pieces of upstream's global state this screen reads and writes.

  `sessionDomain` is `sessionData.info.dnsServerDomain`: upstream's
  `updateDnsSettingsDataAndGui` (main.js:1158) rewrites it after a load of this
  server or the aggregate (main.js:914) and after a save or a restore of this
  server (main.js:2208, 3177), and the redirection check compares against the
  rewritten value, so renaming the server does not stop the console from
  following its new port. The rest of that function (the tab title, the domain
  in the header, About's version and uptime) goes up to the Shell through
  `onServerInfo`, under the same conditions.

  `reverseProxy` is `reverseProxyDetected` (main.js:21), set on every load.
  */
  const sessionDomain = useRef(serverDomain)
  const reverseProxy = useRef(false)

  const [settings, setSettingsState] = useState<DnsSettings | null>(null)
  const [form, setForm] = useState<SettingsForm | null>(null)
  /** The form as the server last answered it: what the bar compares against. */
  const [loadedForm, setLoadedForm] = useState<SettingsForm | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<Notice | null>(null)
  // The validation jump remembers which sub-tab it fired from: as soon as the
  // Shell asks for a different one, it stops holding. Deriving it this way avoids
  // an effect whose only job was to null it out, and the extra render it brings.
  const [jump, setJump] = useState<{ tab: SubTab; from: string } | null>(null)
  const [confirm, setConfirm] = useState<null | 'flush' | 'disable' | 'update'>(null)
  const [modal, setModal] = useState<null | 'backup' | 'restore'>(null)
  const [selection, setSelection] = useState<Record<string, boolean>>(initialBackupSelection)
  const [modalNotice, setModalNotice] = useState<{ title: string; text: string } | null>(null)
  const [nextList, setNextList] = useState<string | null | undefined>(undefined)

  const load = useCallback(async () => {
    setLoading(true)
    const s = await getSettings(token, node)
    if (s != null) {
      // main.js:914-918
      if (node === '' || node === 'cluster' || node === sessionDomain.current) {
        sessionDomain.current = s.dnsServerDomain
        onServerInfo?.(serverInfoOf(s))
      }
      onRecordSettings?.(recordSettingsOf(s))
      reverseProxy.current = detectReverseProxy(window.location, s)
    }
    apply(s)
    setLoading(false)
  }, [token, node, onServerInfo, onRecordSettings])

  function apply(s: DnsSettings | null) {
    const f = s ? formFromSettings(s) : null
    setSettingsState(s)
    setForm(f)
    setLoadedForm(f)
    setNextList(s?.blockListNextUpdatedOn)
  }

  useEffect(() => {
    void load()
  }, [load])

  const requested = (sub ?? 'General') as SubTab
  const valid: SubTab = SUB_TABS.includes(requested) ? requested : 'General'
  const active: SubTab = jump?.from === valid ? jump.tab : valid

  const set = useCallback((partial: Partial<SettingsForm>) => {
    setForm((f) => (f ? { ...f, ...partial } : f))
  }, [])

  /*
  Search settings (`search.ts`, `SettingsMenu`): the words, kept in the address bar
  as `?q=` (`lib/url-state.ts`, written by replacing the entry, read on arrival,
  dropped when the screen goes). Moving to another sub-section keeps them, since the
  Shell writes the next route with the search the bar holds.
  */
  const [query, setQuery] = useState(() => readParam('q') ?? '')
  const searching = query.trim() !== ''
  useEffect(() => {
    writeParams({ q: query.trim() === '' ? null : query })
  }, [query])
  useEffect(
    () => () => {
      dropParams(['q'])
      mark(null, '')
    },
    [],
  )

  /* Narrow screens only: the folded menu is open. */
  const [menuOpen, setMenuOpen] = useState(false)

  /*
  What the pane drew, read back after it is laid out and before paint: the search
  narrows its rows (`narrow`), then the menu's blocks are the titled blocks still in
  view (`data-section`, `BlockAnchors`), in page order, and the counts are what the
  search found here and in the other eight, drawn out of sight (`MirrorPanes`).
  */
  const paneBox = useRef<HTMLDivElement>(null)
  /* What the out-of-sight panes say, read by `MirrorPanes` each time it draws. */
  const mirrorTexts = useRef<Map<SubTab, string[]>>(new Map())
  const [sections, setSections] = useState<{ id: string; label: string }[]>([])
  const [counts, setCounts] = useState<Partial<Record<SubTab, number>> | null>(null)
  useLayoutEffect(() => {
    const box = paneBox.current
    if (box == null) return
    const shown = narrow(box, query)
    mark(box, query)
    const found = [...box.querySelectorAll<HTMLElement>('[data-section]:not([data-search-out])')].map((e) => ({
      id: e.id,
      label: e.dataset.section ?? '',
    }))
    setSections((was) => (JSON.stringify(was) === JSON.stringify(found) ? was : found))
    let next: Partial<Record<SubTab, number>> | null = null
    if (searching) {
      next = { [active]: shown }
      for (const [pane, texts] of mirrorTexts.current) {
        if (pane !== active) next[pane] = countMatches(texts, query)
      }
    }
    setCounts((was) => (JSON.stringify(was) === JSON.stringify(next) ? was : next))
    /* Everything the pane and the out-of-sight panes draw from: the form, the
       loaded settings, the blocking dates and the busy flag (Blocking's buttons). */
  }, [query, searching, active, loading, form, settings, nextList, busy])
  const here = useSectionInView(sections.map((x) => x.id))

  if (loading) return <Loading />
  if (form == null || settings == null) {
    return <Failure>Unable to load the DNS Server settings.</Failure>
  }

  const en = enabled(form)

  /** The part of the success path save and restore share (main.js:2208 and
   *  2216-2217, 3177 and 3187-3188). */
  function afterSaved(envelope: SettingsEnvelope) {
    if (node === '' || node === sessionDomain.current) {
      sessionDomain.current = envelope.response.dnsServerDomain
      onServerInfo?.(serverInfoOf(envelope.response))
    }
    onRecordSettings?.(recordSettingsOf(envelope.response))
    apply(envelope.response)
  }

  function followWebConsole(envelope: SettingsEnvelope) {
    if (sessionDomain.current !== envelope.server) return
    const url = webConsoleRedirection(window.location, envelope.response, reverseProxy.current)
    if (url == null) return
    // "delay redirection to allow web server to restart" (main.js:2300).
    setTimeout(() => window.open(url, '_self'), REDIRECT_DELAY_MS)
  }

  async function save() {
    if (form == null) return
    const result = buildBody(form, node)

    if (result.error) {
      const { title, text, tab } = result.error
      setNotice({ type: 'warning', title, text })
      const target = tab as SubTab
      setJump({ tab: target, from: valid })
      onSubChange?.(target)
      return
    }

    setBusy(true)
    const outcome = await setSettings(token, result.body!)
    setBusy(false)

    if (outcome.kind !== 'ok') {
      setNotice(noticeFromFailure(outcome))
      return
    }

    afterSaved(outcome.data)
    setNotice({
      type: 'success',
      title: 'Settings Saved!',
      text: 'DNS Server settings were saved successfully.',
    })
    followWebConsole(outcome.data)
  }

  async function doFlushCache() {
    setConfirm(null)
    setBusy(true)
    // index.html:2461. The flush goes to the node chosen in this selector.
    const ok = await flushCache(token, node)
    setBusy(false)
    if (ok) {
      setNotice({
        type: 'success',
        title: 'Flushed!',
        text: 'DNS Server cache was flushed successfully.',
      })
    }
  }

  function askDisableBlocking() {
    if (form == null) return
    if (form.temporaryDisableBlockingMinutes === '') {
      setNotice({
        type: 'warning',
        title: 'Missing!',
        text: 'Please enter a value in minutes to temporarily disable blocking.',
      })
      return
    }
    setConfirm('disable')
  }

  async function disableBlocking() {
    if (form == null) return
    const minutes = form.temporaryDisableBlockingMinutes
    setConfirm(null)
    setBusy(true)
    const till = await temporaryDisableBlocking(token, minutes)
    setBusy(false)
    if (till == null) return

    setSettingsState((a) => (a ? { ...a, temporaryDisableBlockingTill: till } : a))
    set({ enableBlocking: false })
    /* The server switched blocking off too (BlockListZoneManager.cs:994), so the
       unticked box is what it now holds, not an edit waiting for the save. */
    setLoadedForm((l) => (l ? { ...l, enableBlocking: false } : l))
    setNotice({
      type: 'success',
      title: 'Blocking Disabled!',
      text: `Blocking was successfully disabled temporarily for ${minutes} minute(s).`,
    })
  }

  async function updateLists() {
    setConfirm(null)
    setBusy(true)
    const ok = await forceUpdateBlockLists(token)
    setBusy(false)
    if (!ok) return
    // main.js:2356. The label becomes "Updating Now" without reloading the settings.
    setNextList(new Date(0).toISOString())
    setNotice({
      type: 'success',
      title: 'Updating Block List!',
      text: 'Block list update was triggered successfully.',
    })
  }

  async function runBackup() {
    if (!Object.values(selection).some(Boolean)) {
      setModalNotice({ title: 'Missing!', text: 'Please select at least one item to backup.' })
      return
    }
    setModalNotice(null)
    setBusy(true)
    const r = await openDownload(token, 'settings/backup', backupParams(selection, node), { ts: true })
    setBusy(false)
    if (!r.ok) return
    setModal(null)
    setNotice({
      type: 'success',
      title: 'Backed Up!',
      text: 'Settings were backed up successfully.',
    })
  }

  async function runRestore(file: File | null, remove: boolean) {
    // The validation order is upstream's: the file first, then that there is
    // at least one item checked (main.js:3137-3160).
    if (file == null) {
      setModalNotice({ title: 'Missing!', text: 'Please select a backup zip file to restore.' })
      return
    }
    if (!Object.values(selection).some(Boolean)) {
      setModalNotice({ title: 'Missing!', text: 'Please select at least one item to restore.' })
      return
    }
    setModalNotice(null)
    setBusy(true)
    const outcome = await restoreSettings(token, file, selection, remove, node)
    setBusy(false)

    if (outcome.kind !== 'ok') {
      setModalNotice(noticeFromFailure(outcome))
      return
    }

    afterSaved(outcome.data)
    setModal(null)
    setNotice({
      type: 'success',
      title: 'Restored!',
      text: 'Settings were restored successfully.',
    })
    followWebConsole(outcome.data)
  }

  const props = { f: form, set, en }
  const blockingExtra: BlockingExtra = {
    temporaryDisableBlockingTill: settings.temporaryDisableBlockingTill,
    blockListNextUpdatedOn: nextList,
    onTemporaryDisable: askDisableBlocking,
    onUpdateNow: () => setConfirm('update'),
    hasSavedBlockLists: settings.blockListUrls != null,
    busy,
  }

  /* What the save would change, pane by pane (`pending.ts`). */
  const pending = loadedForm == null ? [] : pendingByPane(loadedForm, form, node, SUB_TABS)
  const pendingWords = pendingText(pending)
  const nothingHere = searching && counts != null && counts[active] === 0

  return (
    <div className={styles.wrap} data-fills-window="" data-searching={searching ? '' : undefined}>
      <SectionHeader
        section="Settings"
        title={active}
        actions={
          <>
            <ClusterNodeSelect
              nodes={nodes}
              initialised={clusterInitialised}
              aggregate
              value={node}
              onChange={setNode}
              label="Cluster Node"
            />
            {/*
            The three verbs that are not the form's live in the header, where every
            screen keeps its actions; Save Settings stays in the bar at the foot.

            They are still THERE without the permission, disabled and with a padlock
            (*disabled, never hidden*). The permission names come from upstream and
            **are not deduced from the button**: `Flush Cache` asks for
            `Cache.canDelete` (another screen's), and Backup and Restore ask for
            `Settings.canDelete`, not `canModify`: a backup asking for the DELETE
            permission is not what anyone would assume.
            */}
            <PermissionButton
              lead="download"
              permission={canBackup ? undefined : 'Settings.canDelete'}
              onClick={() => {
                setSelection(initialBackupSelection())
                setModalNotice(null)
                setModal('backup')
              }}
            >
              Backup Settings
            </PermissionButton>
            <PermissionButton
              lead="upload"
              permission={canBackup ? undefined : 'Settings.canDelete'}
              onClick={() => {
                setSelection(initialBackupSelection())
                setModalNotice(null)
                setModal('restore')
              }}
            >
              Restore Settings
            </PermissionButton>
            <PermissionButton
              lead="trash"
              variant="danger"
              disabled={busy}
              permission={canFlushCache ? undefined : 'Cache.canDelete'}
              onClick={() => setConfirm('flush')}
            >
              Flush Cache
            </PermissionButton>
          </>
        }
      />

      <Notifier notice={notice} onClose={() => setNotice(null)} />

      <div className={styles.layout}>
        <SettingsMenu
          tabs={SUB_TABS}
          active={active}
          onChoose={(t) => onSubChange?.(t as SubTab)}
          marks={Object.fromEntries(pending.map((p) => [p.pane, 'unsaved changes']))}
          counts={counts}
          blocks={sections}
          here={here}
          query={query}
          onQuery={setQuery}
          open={menuOpen}
          onOpen={setMenuOpen}
        />

        <div className={styles.form}>
          <BlockAnchors prefix="settings">
            <div ref={paneBox}>
              <Pane tab={active} props={props} settings={settings} blocking={blockingExtra} />
            </div>
          </BlockAnchors>
          {nothingHere && (
            <Empty>
              No settings in {active} match &ldquo;{query.trim()}&rdquo;.
            </Empty>
          )}
        </div>
      </div>

      {/*
      The other eight panes, drawn out of sight while a search holds words, only so
      the menu can say how many matches each one has. `hidden` and `inert`: no one
      sees, reaches or reads them. They read nothing either (`PaneMirror`), and they
      draw the same form state, so what they count is what the pane will show.
      */}
      {searching && (
        <div hidden inert>
          <PaneMirror.Provider value>
            <MirrorPanes
              active={active}
              props={props}
              settings={settings}
              blocking={blockingExtra}
              onTexts={(texts) => {
                mirrorTexts.current = texts
              }}
            />
          </PaneMirror.Provider>
        </div>
      )}

      {/*
      The save bar, pinned to the bottom of the window for the whole screen, as
      upstream's Save is always there. It says what the save would change
      (deviation 3) or that nothing would, and holds the one verb that sends the
      form: Backup, Restore and Flush Cache moved up to the header.
      */}
      <div className={styles.bar} role="region" aria-label="Save">
        <div className={styles.barInner}>
          <span className={styles.pending} aria-live="polite">
            {pendingWords !== '' ? (
              <>
                <span className={styles.pendingDot} aria-hidden="true" />
                Unsaved changes: {pendingWords}
              </>
            ) : (
              <span className={styles.saved}>No unsaved changes</span>
            )}
          </span>
          <PermissionButton
            lead="save"
            variant="primary"
            disabled={busy}
            permission={canModify ? undefined : 'Settings.canModify'}
            onClick={() => void save()}
          >
            Save Settings
          </PermissionButton>
        </div>
      </div>

      <Confirm
        open={confirm === 'flush'}
        onClose={() => setConfirm(null)}
        title="Flush Cache"
        label="Flush"
        variant="primary"
        text="Are you sure to flush the DNS Server cache?"
        busy={busy}
        onConfirm={() => void doFlushCache()}
      />
      <Confirm
        open={confirm === 'disable'}
        onClose={() => setConfirm(null)}
        title="Temporary Disable Blocking"
        label="Disable"
        variant="primary"
        text={`Are you sure to temporarily disable blocking for ${form.temporaryDisableBlockingMinutes} minute(s)?`}
        busy={busy}
        onConfirm={() => void disableBlocking()}
      />
      <Confirm
        open={confirm === 'update'}
        onClose={() => setConfirm(null)}
        title="Update Block Lists"
        label="Update"
        variant="primary"
        text="Are you sure to force download and update the block lists?"
        busy={busy}
        onConfirm={() => void updateLists()}
      />

      <BackupDialog
        open={modal === 'backup'}
        onOpenChange={(o) => setModal(o ? 'backup' : null)}
        selection={selection}
        onSelection={setSelection}
        notice={modalNotice}
        busy={busy}
        onBackup={() => void runBackup()}
      />
      <RestoreDialog
        open={modal === 'restore'}
        onOpenChange={(o) => setModal(o ? 'restore' : null)}
        selection={selection}
        onSelection={setSelection}
        notice={modalNotice}
        busy={busy}
        onRestore={(file, remove) => void runRestore(file, remove)}
      />
    </div>
  )
}

interface PaneDraw {
  props: PaneProps
  settings: DnsSettings
  blocking: BlockingExtra
}

/** One sub-section's pane. */
function Pane({ tab, props, settings, blocking }: PaneDraw & { tab: SubTab }) {
  switch (tab) {
    case 'General':
      return <General {...props} />
    case 'Web Service':
      return <WebService {...props} loaded={settings} />
    case 'Optional Protocols':
      return <OptionalProtocols {...props} loaded={settings} />
    case 'TSIG':
      return <Tsig {...props} />
    case 'Recursion':
      return <Recursion {...props} />
    case 'Cache':
      return <Cache {...props} />
    case 'Blocking':
      return <Blocking {...props} extra={blocking} />
    case 'Proxy & Forwarders':
      return <ProxyForwarders {...props} />
    case 'Logging':
      return <Logging {...props} />
  }
}

/*
Every pane but the current one, for the search's counts. Memoised on what they
draw (the form state, the loaded settings, the blocking dates), so typing in the
search does not draw them again: only the counting runs. The callbacks are not
compared: an inert pane never calls its own, and `onTexts` only stores.
*/
const MirrorPanes = memo(
  function MirrorPanes({
    active,
    onTexts,
    ...draw
  }: PaneDraw & { active: SubTab; onTexts: (texts: Map<SubTab, string[]>) => void }) {
    const box = useRef<HTMLDivElement>(null)
    /* Read once per drawing, before the screen's own layout effect counts them:
       a child's layout effects run first. */
    useLayoutEffect(() => {
      const found = new Map<SubTab, string[]>()
      for (const el of box.current?.querySelectorAll<HTMLElement>('[data-pane]') ?? []) {
        found.set(el.dataset.pane as SubTab, unitTexts(el))
      }
      onTexts(found)
    })
    return (
      <div ref={box}>
        {SUB_TABS.filter((t) => t !== active).map((t) => (
          <div key={t} data-pane={t}>
            <Pane tab={t} {...draw} />
          </div>
        ))}
      </div>
    )
  },
  (a, b) =>
    a.active === b.active &&
    a.props.f === b.props.f &&
    a.settings === b.settings &&
    a.blocking.blockListNextUpdatedOn === b.blocking.blockListNextUpdatedOn &&
    a.blocking.temporaryDisableBlockingTill === b.blocking.temporaryDisableBlockingTill &&
    a.blocking.busy === b.blocking.busy,
)
