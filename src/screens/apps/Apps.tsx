import { useCallback, useEffect, useState } from 'react'
import {
  downloadAndUpdate,
  getAppConfig,
  listApps,
  uninstallApp,
  type InstalledApp,
} from '../../api/apps'
import { type AlertType } from '../../ui/Alert'
import { Button } from '../../ui/Button'
import { SectionHeader } from '../../ui/SectionHeader'
import { AppConfig } from './AppConfig'
import { AppRow, KindChip } from './AppRow'
import { AppsSummary } from './AppsSummary'
import { kindsOf } from './app-kinds'
import { InstallApp } from './InstallApp'
import { StoreApps } from './StoreApps'
import { UpdateApp } from './UpdateApp'
import { Empty, Failure, Loading } from '../../ui/Empty'
import { Table, Th, useSort } from '../../ui/Table'
import tbl from '../../ui/Table.module.css'
import { DataFoot, DataTable, End, Grow } from '../../ui/DataTable'
import { Field, Input } from '../../ui/Field'
import { dropParams, readParam, writeParams } from '../../lib/url-state'
import styles from './Apps.module.css'
import { noticeFromFailure } from '../../lib/notice'
import { Notifier } from '../../ui/Notifier'
import { Confirm } from '../../ui/Confirm'

/*
A replica of the Apps tab (apps.js + index.html:807-835), redrawn on 2026-11-06 in
the language Zones got (deviation 17 in CONVENTIONS.md): four cards that say what
the apps are (`AppsSummary.tsx`), then the installed apps as a table in one card
with its toolbar and foot (`ui/DataTable`), one row per app (`AppRow.tsx`).

Two things from upstream that are kept:

  1. "Update" and "Store Update" are DIFFERENT actions (apps.js:130-131). The
     first uploads your own zip; the second downloads the store's version.
     Merging them would remove functionality, so "Store Update" stays and only
     appears when the server says `updateAvailable`.
  2. The "More Details" disclosure with the app's classes, their labels and the
     `recordDataTemplate` (apps.js:74-113). That template is what gets copied to
     write an APP record; without it the screen loses real usefulness.

What is NOT here: an Enabled/Disabled state. The API has no such concept (neither
`apps/list` nor `WriteAppAsJson` bring anything like it), and an installed app is
always active. Inventing it would be adding functionality.

Every call, confirmation, alert and validation is the one this screen already had.
*/
export interface AlertState { type: AlertType; title: string; text: string }

type Modal =
  | { kind: 'store' }
  | { kind: 'install' }
  | { kind: 'update'; name: string }
  | { kind: 'config'; name: string; config: string }

export function error(outcome: { kind: string; message?: string }): AlertState {
  return noticeFromFailure(outcome)
}

export function Apps({ token }: { token: string | null }) {
  const [apps, setApps] = useState<InstalledApp[] | null>(null)
  const [alert, setAlert] = useState<AlertState | null>(null)
  const [modal, setModal] = useState<Modal | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  /** Whether the last load failed: the gap is not drawn as an empty one. */
  const [failure, setFailure] = useState(false)
  const [pendingUninstall, setPendingUninstall] = useState<string | null>(null)
  /* The table's view, in the address bar as every list of the console keeps it
     (`lib/url-state.ts`): the kind pressed on the Classes card and the search. */
  const [kindFilter, setKindFilter] = useState(() => readParam('kind') ?? '')
  const [search, setSearch] = useState(() => readParam('q') ?? '')
  useEffect(() => {
    writeParams({ kind: kindFilter, q: search })
  }, [kindFilter, search])
  useEffect(() => () => dropParams(['kind', 'q']), [])

  const reload = useCallback(async () => {
    const outcome = await listApps(token)
    if (outcome.kind === 'ok') {
      setApps(outcome.data.response.apps)
      setFailure(false)
      return
    }
    /*
  The data is thrown away, as it was before: this screen does NOT keep the
  previous one, so there is nothing here to "go stale" and it does not carry the
  other collections' strip: inheriting the look is not inheriting behaviour it
  does not have.

  What does change is HOW the gap is drawn. It said "No apps installed" and
  offered to open the store, which is worse than saying nothing: it not only
  asserts something it does not know (there may be ten apps installed and the call
  may have fallen over), it invites you to act on that false premise.
    */
    setApps([])
    setFailure(true)
    setAlert(error(outcome))
  }, [token])

  useEffect(() => {
    void reload()
  }, [reload])

  /*
  apps.js:425-449. The confirmation and the alert are upstream literals.

  The confirmation step is `ui/Confirm`, as in the console's other eleven
  destructive actions. Here the browser's native `confirm()` had been left
  behind: the same operating-system dialog the redesign replaced everywhere, on
  an action that uninstalls an application from the server.
  */
  async function uninstall(name: string) {
    setBusy(name)
    const outcome = await uninstallApp(token, name)
    setBusy(null)

    if (outcome.kind !== 'ok') {
      setAlert(error(outcome))
      return
    }
    setAlert({
      type: 'success',
      title: 'App Uninstalled!',
      text: `DNS application '${name}' was uninstalled successfully.`,
    })
    await reload()
  }

  // apps.js:253-290, with `isModal` false: the alert comes out on the page.
  async function updateFromStore(app: InstalledApp) {
    if (!app.updateUrl) return

    setBusy(app.name)
    const outcome = await downloadAndUpdate(token, app.name, app.updateUrl)
    setBusy(null)

    if (outcome.kind !== 'ok') {
      setAlert(error(outcome))
      return
    }
    setAlert({
      type: 'success',
      title: 'Store App Updated!',
      text: `DNS application '${app.name}' was updated successfully from DNS App Store.`,
    })
    await reload()
  }

  // apps.js:459-491. The config is read BEFORE opening the modal, and from the
  // cluster's primary node. `config` can come null; the editor is left empty.
  async function openConfig(name: string) {
    setBusy(name)
    const outcome = await getAppConfig(token, name)
    setBusy(null)

    if (outcome.kind !== 'ok') {
      setAlert(error(outcome))
      return
    }
    setModal({ kind: 'config', name, config: outcome.data.response.config ?? '' })
  }

  /*
  The Kind filter (deviation 17): a kind of the apps' classes, set from the toolbar
  or by pressing a kind in the Classes card. It only narrows what the table draws;
  nothing is asked of the server.
  */
  const needle = search.trim().toLowerCase()
  const visible = (apps ?? []).filter(
    (a) =>
      (kindFilter === '' || kindsOf(a).includes(kindFilter)) &&
      (needle === '' || a.name.toLowerCase().includes(needle) || (a.description ?? '').toLowerCase().includes(needle)),
  )

  /*
  Upstream's installed list is a table and its `Installed Apps` header sorts it
  (`sortTable('tableAppsBody', 0)`). It is a table here as well, with that same
  header as its sortable column: the same hook as every sortable column in the
  console. `dev/check-parity-sort.mjs` counts it.
  */
  const { rows: sortedApps, sort, toggle } = useSort({ name: (a: InstalledApp) => a.name }, visible)

  return (
    <>
      <Notifier notice={alert} onClose={() => setAlert(null)} />

      <SectionHeader
        title="Apps"
        actions={
          <>
            <Button lead="store" variant="primary" onClick={() => setModal({ kind: 'store' })}>
              App Store
            </Button>
            <Button lead="upload" onClick={() => setModal({ kind: 'install' })}>Install from file</Button>
          </>
        }
      />

      {apps === null ? (
        <Loading />
      ) : failure ? (
          /* Solid and with no invitation: whether there are apps is not known, so
             the store is not offered, and no card is drawn: a count of an answer
             that never came would be invented. The server's message goes in the
             notice. */
        <Failure>Could not load the installed apps.</Failure>
      ) : (
        <>
          <AppsSummary apps={apps} activeKind={kindFilter} onKind={setKindFilter} />
          {apps.length === 0 ? (
            <Empty
              title="No apps installed"
              actions={
                <Button variant="primary" onClick={() => setModal({ kind: 'store' })}>
                  Open App Store
                </Button>
              }
            >
              DNS Apps add behaviour to the server (query logging, advanced blocking, split horizon)
              without touching the base configuration. Open the store to see what is available.
            </Empty>
          ) : (
            <DataTable
              toolbar={
                <>
                  <Grow>
                    <Field inline label="Search">
                      {(id) => (
                        <Input
                          id={id}
                          search
                          placeholder="Name or description"
                          value={search}
                          onChange={(e) => setSearch(e.target.value)}
                        />
                      )}
                    </Field>
                  </Grow>
                  {kindFilter !== '' && (
                    <End>
                      <button type="button" className={styles.applied} onClick={() => setKindFilter('')}>
                        <KindChip kind={kindFilter} />
                        <span className={styles.clear}>Clear</span>
                      </button>
                    </End>
                  )}
                </>
              }
              /* Upstream's footer, `Total Apps: N` (apps.js:41): every installed app,
                 whatever the Kind filter leaves on screen. */
              foot={
                <DataFoot
                  count={
                    visible.length === apps.length
                      ? `Total Apps: ${apps.length}`
                      : `Total Apps: ${apps.length}, ${visible.length} shown`
                  }
                />
              }
            >
              <Table
                stack
                tableClass={styles.rows}
                header={
                  <>
                    <Th field="name" sort={sort} onSort={toggle}>Installed Apps</Th>
                    <th className={styles.kindHead}>Kind</th>
                    <th className={tbl.actionsCell} />
                  </>
                }
                isEmpty={sortedApps.length === 0}
                emptyText="No Apps Found"
                columns={3}
              >
                {sortedApps.map((app) => (
                  <AppRow
                    key={app.name}
                    app={app}
                    busy={busy === app.name}
                    onConfig={() => void openConfig(app.name)}
                    onUpdate={() => setModal({ kind: 'update', name: app.name })}
                    onStoreUpdate={() => void updateFromStore(app)}
                    onUninstall={() => setPendingUninstall(app.name)}
                  />
                ))}
              </Table>
            </DataTable>
          )}
        </>
      )}

      <Confirm
        open={pendingUninstall !== null}
        title="Uninstall App"
        text={`Are you sure you want to uninstall the DNS application '${pendingUninstall ?? ''}'?`}
        label="Uninstall"
        onClose={() => setPendingUninstall(null)}
        onConfirm={() => pendingUninstall && uninstall(pendingUninstall)}
      />

      <StoreApps
        open={modal?.kind === 'store'}
        onOpenChange={(o) => setModal(o ? { kind: 'store' } : null)}
        token={token}
        onChanged={() => void reload()}
      />
      <InstallApp
        open={modal?.kind === 'install'}
        onOpenChange={(o) => setModal(o ? { kind: 'install' } : null)}
        token={token}
        onInstalled={(name) => {
          setModal(null)
          setAlert({
            type: 'success',
            title: 'App Installed!',
            text: `DNS application '${name}' was installed successfully.`,
          })
          void reload()
        }}
      />
      <UpdateApp
        open={modal?.kind === 'update'}
        onOpenChange={(o) => setModal(o && modal?.kind === 'update' ? modal : null)}
        token={token}
        name={modal?.kind === 'update' ? modal.name : ''}
        onUpdated={(name) => {
          setModal(null)
          setAlert({
            type: 'success',
            title: 'App Updated!',
            text: `DNS application '${name}' was updated successfully.`,
          })
          void reload()
        }}
      />
      <AppConfig
        open={modal?.kind === 'config'}
        onOpenChange={(o) => setModal(o && modal?.kind === 'config' ? modal : null)}
        token={token}
        name={modal?.kind === 'config' ? modal.name : ''}
        initialConfig={modal?.kind === 'config' ? modal.config : ''}
        onSaved={(name) => {
          setModal(null)
          setAlert({
            type: 'success',
            title: 'App Config Saved!',
            text: `The DNS application '${name}' config was saved and reloaded successfully.`,
          })
        }}
      />
    </>
  )
}
