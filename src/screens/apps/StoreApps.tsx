import { useCallback, useEffect, useState } from 'react'
import { downloadAndInstall, downloadAndUpdate, listStoreApps, uninstallApp, type StoreApp } from '../../api/apps'
import { Button } from '../../ui/Button'
import { useSort } from '../../ui/Table'
import { Icon } from '../../ui/Icon'
import { Details } from '../../ui/Details'
import { Dialog } from '../../ui/Dialog'
import { error, type AlertState } from './Apps'
import { Empty, Loading } from '../../ui/Empty'
import { Tag } from '../../ui/Tag'
import styles from './Apps.module.css'
import { Notifier } from '../../ui/Notifier'
import { Confirm } from '../../ui/Confirm'

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

  /*
  Upstream's store header is a sort link —`sortTable('tableStoreAppsBody', 0)`,
  index.html:6166— and this screen had dropped it. It is the same class of loss
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
  apps.js:292-294 — the same literal confirmation as the tab's.

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

  const { rows: sorted, toggle } = useSort<StoreApp>({ name: (a) => a.name }, storeApps ?? [])

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      size="medium"
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

      {storeApps === null ? (
        <Loading />
      ) : storeApps.length === 0 ? (
        <Empty>No Apps Found</Empty>
      ) : (
        <>
          <div className={styles.sortRow}>
            <button
              type="button"
              className={styles.sortBy}
              aria-label="Sort by name"
              onClick={() => toggle('name')}
            >
              Store Apps
              <Icon name="sort" size={12} />
            </button>
          </div>
          <ul className={styles.store}>
            {sorted.map((app) => {
              const hasUpdate = app.installed && app.updateAvailable === true
              // apps.js:164 — installed shows ITS version; not installed, the store's.
              const version = app.installed ? (app.installedVersion ?? app.version) : app.version
              return (
                <li key={app.name} className={styles.srow} aria-label={app.name}>
                  <div>
                    <div className={styles.sname}>
                      {app.name}
                      <span className={styles.slabels}>
                        <Tag>Version {version}</Tag>
                        {hasUpdate && <Tag tone="warn">Update {app.version}</Tag>}
                      </span>
                    </div>
                    {/*
                    The catalogue is 27 apps and the dialog was 5.868 px of
                    scroll: to find one you rolled through six screens. Upstream
                    is the same —same fields, same length, and no filter either—
                    so what could not be done was to add a search box, which is a
                    control upstream does not have.

                    What CAN be done is decide what each row shows at rest, and
                    that is a design call. Two jobs, two depths: SCANNING wants
                    short rows and CONFIRMING wants the description, so the first
                    two lines stay visible and the rest goes behind the same
                    `More Details` the installed card next door already uses.

                    The zip URL and the size go with it: 70 monospaced characters
                    that matter when you are about to install, and never while
                    you are looking for the thing.
                    */}
                    <p className={styles.sdesc}>{app.description}</p>
                    <Details summary="More Details" className={styles.sdetails}>
                      <p className={styles.sdescFull}>{app.description}</p>
                      <div className={styles.smeta}>
                        <div>
                          <b>App Zip File</b>: {app.url}
                        </div>
                        <div>
                          <b>Size</b>: {app.size}
                        </div>
                      </div>
                    </Details>
                  </div>
                  <div className={styles.sacts}>
                    {!app.installed && (
                      <Button
                        variant="primary"
                        disabled={busy === app.name}
                        onClick={() => void install(app)}
                      >
                        Install
                      </Button>
                    )}
                    {hasUpdate && (
                      <Button disabled={busy === app.name} onClick={() => void update(app)}>
                        Update
                      </Button>
                    )}
                    {app.installed && (
                      <Button
                        variant="danger"
                        disabled={busy === app.name}
                        onClick={() => setPendingUninstall(app)}
                      >
                        Uninstall
                      </Button>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
          <div className={styles.total}>Total Apps: {storeApps.length}</div>
        </>
      )}
    </Dialog>
  )
}
