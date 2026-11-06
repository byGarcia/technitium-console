import { useCallback, useEffect, useState } from 'react'
import { downloadAndInstall, downloadAndUpdate, listStoreApps, uninstallApp, type StoreApp } from '../../api/apps'
import { Button } from '../../ui/Button'
import { Table, Th, useSort } from '../../ui/Table'
import tbl from '../../ui/Table.module.css'
import { Details } from '../../ui/Details'
import { Dialog } from '../../ui/Dialog'
import { error, type AlertState } from './Apps'
import { Loading } from '../../ui/Empty'
import { DataFoot, DataTable, Grow } from '../../ui/DataTable'
import { Field, Input } from '../../ui/Field'
import { Menu, MenuItem } from '../../ui/Menu'
import { Tag } from '../../ui/Tag'
import styles from './Apps.module.css'
import { Notifier } from '../../ui/Notifier'
import { Confirm } from '../../ui/Confirm'
import { UrlText } from '../../ui/UrlText'

/*
A replica of `modalStoreApps` (index.html:6148-6183) and of the three actions
that come out of it: `installStoreApp`, `updateStoreApp` with `isModal` true and
`uninstallStoreApp` (apps.js:137-328).

The alerts of these three go INSIDE the modal, not on the page: upstream passes
them `divStoreAppsAlert` as a placeholder. The tab's ones (install by zip,
uninstall from the card, save config) go on the page. The difference is kept.

Upstream, after an action, patches the row by hand: hides "Install", shows
"Uninstall"… Here the list is asked for again. The visible result is the same and
it avoids upstream's lag, where `installedApp` comes without the update fields
and the freshly placed row is left without its "Store Update" button.
*/
export function StoreApps({
  open,
  onOpenChange,
  token,
  onChanged,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  token: string | null
  onChanged: () => void
}) {
  const [storeApps, setStoreApps] = useState<StoreApp[] | null>(null)
  const [alert, setAlert] = useState<AlertState | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [pendingUninstall, setPendingUninstall] = useState<StoreApp | null>(null)
  const [search, setSearch] = useState('')

  /*
  Upstream's store header is a sort link (`sortTable('tableStoreAppsBody', 0)`,
  index.html:6166), and this screen had dropped it. It is the same class of loss
  About turned up: `check-parity-controls.mjs` counts destinations, helps and
  examples, so a control that is none of the three walks straight past it.

  The hook is `ui/Table`'s, the one every sortable column in this console uses,
  even though what it orders here is a list and not a table.
  */

  const load = useCallback(async () => {
    const outcome = await listStoreApps(token)
    if (outcome.kind === 'ok') {
      setStoreApps(outcome.data.response.storeApps)
      return
    }
    setStoreApps([])
    setAlert(error(outcome))
  }, [token])

  useEffect(() => {
    if (!open) return
    setAlert(null)
    setStoreApps(null)
    setSearch('')
    void load()
  }, [open, load])

  async function runStoreAction(app: StoreApp, ok: AlertState, call: Promise<{ kind: string; message?: string }>) {
    setBusy(app.name)
    const outcome = await call
    setBusy(null)

    if (outcome.kind !== 'ok') {
      setAlert(error(outcome))
      return
    }
    setAlert(ok)
    onChanged()
    await load()
  }

  function install(app: StoreApp) {
    return runStoreAction(
      app,
      {
        type: 'success',
        title: 'Store App Installed!',
        text: `DNS application '${app.name}' was installed successfully from DNS App Store.`,
      },
      downloadAndInstall(token, app.name, app.url),
    )
  }

  function update(app: StoreApp) {
    return runStoreAction(
      app,
      {
        type: 'success',
        title: 'Store App Updated!',
        text: `DNS application '${app.name}' was updated successfully from DNS App Store.`,
      },
      downloadAndUpdate(token, app.name, app.url),
    )
  }

  /*
  apps.js:292-294. The same literal confirmation as the tab's.

  It stacks over this dialog, which is what Radix does with a modal inside
  another. Before it was the browser's native `confirm()`, the only step of this
  console that still opened the operating system's dialog.
  */
  function uninstall(app: StoreApp) {
    return runStoreAction(
      app,
      {
        type: 'success',
        title: 'Store App Uninstalled!',
        text: `DNS application '${app.name}' was uninstalled successfully.`,
      },
      uninstallApp(token, app.name),
    )
  }

  /*
  The search (deviation 17): the catalogue is 27 apps, and finding one meant
  scrolling through all of them. It narrows what the table draws by name and
  description, as typed, case aside; it asks the server nothing, and `Total Apps`
  still counts the whole catalogue, as upstream's footer does.
  */
  const needle = search.trim().toLowerCase()
  const found = (storeApps ?? []).filter(
    (a) => needle === '' || a.name.toLowerCase().includes(needle) || a.description.toLowerCase().includes(needle),
  )
  const { rows: sorted, sort, toggle } = useSort<StoreApp>({ name: (a) => a.name }, found)

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      size="wide"
      title="DNS App Store"
    >
      <Notifier notice={alert} onClose={() => setAlert(null)} />

      <Confirm
        open={pendingUninstall !== null}
        title="Uninstall App"
        text={`Are you sure you want to uninstall the DNS application '${pendingUninstall?.name ?? ''}'?`}
        label="Uninstall"
        onClose={() => setPendingUninstall(null)}
        onConfirm={() => pendingUninstall && uninstall(pendingUninstall)}
      />

      <DataTable
        toolbar={
          <Grow>
            <Field inline label="Search">
              {(id) => (
                <Input
                  id={id}
                  search
                  value={search}
                  disabled={storeApps === null}
                  onChange={(e) => setSearch(e.target.value)}
                />
              )}
            </Field>
          </Grow>
        }
        /* Upstream's footer (apps.js:180-183): the count, or `No Apps Found` when
           the store has nothing. */
        foot={
          storeApps != null && storeApps.length > 0 ? <DataFoot count={`Total Apps: ${storeApps.length}`} /> : undefined
        }
      >
        {storeApps === null ? (
          <Loading />
        ) : (
          <Table
            stack
            tableClass={styles.rows}
            header={
              <>
                <Th field="name" sort={sort} onSort={toggle}>Store Apps</Th>
                <th className={styles.sizeHead}>Size</th>
                <th className={tbl.actionsCell} />
              </>
            }
            isEmpty={sorted.length === 0}
            emptyText="No Apps Found"
            columns={3}
          >
            {sorted.map((app) => (
              <StoreRow
                key={app.name}
                app={app}
                busy={busy === app.name}
                onInstall={() => void install(app)}
                onUpdate={() => void update(app)}
                onUninstall={() => setPendingUninstall(app)}
              />
            ))}
          </Table>
        )}
      </DataTable>
    </Dialog>
  )
}

/*
One app of the catalogue. What upstream's row holds (index.html:6365, apps.js:
151-176), with three moves of the redesign (deviation 17):

  · `Installed` beside the version for an app this server has, so the installed
    ones read without looking for their Uninstall button;
  · the size in a column of its own, and the zip URL in More Details: 70
    characters that matter when you are about to install, never while you look;
  · the description two lines at rest, whole in More Details, because SCANNING
    wants short rows and CONFIRMING wants the description.

Install stays a button of the row and so does Update; Uninstall moves into the
row's `⋮` menu, as every destructive verb that repeats once per row in this
console. The confirmation is upstream's literal.
*/
function StoreRow({
  app,
  busy,
  onInstall,
  onUpdate,
  onUninstall,
}: {
  app: StoreApp
  busy: boolean
  onInstall: () => void
  onUpdate: () => void
  onUninstall: () => void
}) {
  const hasUpdate = app.installed && app.updateAvailable === true
  // apps.js:164. Installed shows ITS version; not installed, the store's.
  const version = app.installed ? (app.installedVersion ?? app.version) : app.version
  return (
    <tr aria-label={app.name}>
      <td className={tbl.lead}>
        <div className={styles.appHead}>
          <span className={styles.appName}>{app.name}</span>
          <Tag>Version {version}</Tag>
          {hasUpdate && <Tag tone="warn">Update {app.version}</Tag>}
          {app.installed && <Tag tone="ok">Installed</Tag>}
        </div>
        <p className={styles.descClamp}>{app.description}</p>
        <Details summary="More Details" className={styles.details}>
          <p className={styles.descFull}>{app.description}</p>
          <div className={styles.smeta}>
            <b>App Zip File</b>: <UrlText url={app.url} />
          </div>
        </Details>
      </td>
      <td className={styles.sizeCell}>{app.size}</td>
      <td className={tbl.actionsCell}>
        <div className={styles.storeActs}>
          {!app.installed && (
            <Button variant="primary" size="sm" lead="download" disabled={busy} onClick={onInstall}>
              Install
            </Button>
          )}
          {hasUpdate && (
            <Button size="sm" lead="download" disabled={busy} onClick={onUpdate}>
              Update
            </Button>
          )}
          {app.installed && (
            <Menu label={`Actions for ${app.name}`}>
              {(close) => (
                <>
                  {hasUpdate && (
                    <MenuItem icon="download" disabled={busy} onClick={() => { close(); onUpdate() }}>
                      Update
                    </MenuItem>
                  )}
                  <MenuItem icon="trash" tone="danger" disabled={busy} onClick={() => { close(); onUninstall() }}>
                    Uninstall
                  </MenuItem>
                </>
              )}
            </Menu>
          )}
        </div>
      </td>
    </tr>
  )
}
