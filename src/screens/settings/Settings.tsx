import { ClusterNodeSelect } from '../../ui/ClusterNodeSelect'
import { useCallback, useEffect, useRef, useState } from 'react'
import { PermissionButton } from '../../ui/PermissionButton'
import { SectionHeader } from '../../ui/SectionHeader'
import { SubTabs } from '../../ui/SubTabs'
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
import panelFormStyles from '../../ui/PanelForm.module.css'
import { noticeFromFailure, type Notice } from '../../lib/notice'
import { Notifier } from '../../ui/Notifier'

/*
Settings. The console's biggest screen: in upstream, the General sub-tab alone is
5,452 px tall.

The sub-navigation is NOT mounted here. The nine sub-tabs live in the Shell's
side panel, nested under Settings, and arrive through the `sub` prop. This
component only decides which panel it draws and keeps A SINGLE form state for the
nine: upstream does not have nine forms either, it has one with nine tabs, and
"Save Settings" ALWAYS sends the fields of all nine wherever you are. Chopping it
up per tab would change what gets saved.

Two consequences of that to keep in mind:

  · A validation failure can be on another sub-tab. Upstream focuses the field
    even when its tab is hidden and the user sees nothing. Here the alert says
    what is missing and the screen jumps to the field's sub-tab.
  · The three permissions on the bar are different: saving requires
    `Settings.canModify`, flushing the cache `Cache.canDelete`, and backup and
    restore `Settings.canDelete` (main.js:906-930).
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
      reverseProxy.current = detectReverseProxy(window.location, s)
    }
    apply(s)
    setLoading(false)
  }, [token, node, onServerInfo])

  function apply(s: DnsSettings | null) {
    setSettingsState(s)
    setForm(s ? formFromSettings(s) : null)
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

  return (
    <div className={styles.wrap}>
      {/*
      The title is the SECTION and the nine panes are the bar underneath, which is
      what the dense-form design draws and states: "the nine leave the sidebar and
      live above the title at every width". The title used to
      be the pane with "Settings" as a breadcrumb, and that was the answer to a
      different problem (nine sub-tabs all titled "Settings"), which the bar solves
      better: the active pane is named, and it is named where you click to change
      it.
      */}
      <SectionHeader
        title="Settings"
        tabs={
          <SubTabs
            label="Settings sections"
            section="settings"
            tabs={SUB_TABS}
            active={active}
            onChoose={(t) => onSubChange?.(t as SubTab)}
          />
        }
        actions={
          <ClusterNodeSelect
            nodes={nodes}
            initialised={clusterInitialised}
            aggregate
            value={node}
            onChange={setNode}
            label="Cluster Node"
          />
        }
      />

      <Notifier notice={notice} onClose={() => setNotice(null)} />

      <div>
        {active === 'General' && <General {...props} />}
        {active === 'Web Service' && <WebService {...props} loaded={settings} />}
        {active === 'Optional Protocols' && <OptionalProtocols {...props} loaded={settings} />}
        {active === 'TSIG' && <Tsig {...props} />}
        {active === 'Recursion' && <Recursion {...props} />}
        {active === 'Cache' && <Cache {...props} />}
        {active === 'Blocking' && (
          <Blocking
            {...props}
            extra={{
              temporaryDisableBlockingTill: settings.temporaryDisableBlockingTill,
              blockListNextUpdatedOn: nextList,
              onTemporaryDisable: askDisableBlocking,
              onUpdateNow: () => setConfirm('update'),
              hasSavedBlockLists: settings.blockListUrls != null,
              busy,
            }}
          />
        )}
        {active === 'Proxy & Forwarders' && <ProxyForwarders {...props} />}
        {active === 'Logging' && <Logging {...props} />}
      </div>

      <div className={panelFormStyles.bar}>
        {/*
        The four verbs are still THERE without the permission, disabled and with a
        padlock.

        They used to disappear (`{canModify && …}`), and that breaks the console's
        design rule *disabled, never hidden* twice over: the bar changed shape depending on who was looking, and
        nobody could tell the action exists and a permission is missing.

        The permission names come from upstream and **are not deduced from the
        button**: these four verbs ask for THREE different permissions, and `Flush
        Cache` asks for `Cache.canDelete` (another screen's), one of the three
        controls, among the nine compared with upstream, that "does not ask for the
        permission of the screen whose name it carries". Backup and restore ask for
        `Settings.canDelete`, not `canModify`, and that has to be read off upstream
        too: a backup asking for the DELETE permission is not what anyone would
        assume.
        */}
        <PermissionButton
          variant="primary"
          disabled={busy}
          permission={canModify ? undefined : 'Settings.canModify'}
          onClick={() => void save()}
        >
          Save Settings
        </PermissionButton>
        <PermissionButton
          variant="danger"
          disabled={busy}
          permission={canFlushCache ? undefined : 'Cache.canDelete'}
          onClick={() => setConfirm('flush')}
        >
          Flush Cache
        </PermissionButton>
        <div className={panelFormStyles.spacer} />
        <PermissionButton
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
          permission={canBackup ? undefined : 'Settings.canDelete'}
          onClick={() => {
            setSelection(initialBackupSelection())
            setModalNotice(null)
            setModal('restore')
          }}
        >
          Restore Settings
        </PermissionButton>
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
