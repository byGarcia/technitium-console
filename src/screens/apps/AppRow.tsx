import { useId, useState, type CSSProperties } from 'react'
import { dnsAppLabels, type InstalledApp } from '../../api/apps'
import { ADVANCED_BLOCKING_DETAIL } from '../../app/sections'
import { Menu, MenuItem, MenuRouteItem, Separator } from '../../ui/Menu'
import { RouteButton } from '../../ui/RouteLink'
import { RowAction } from '../../ui/Table'
import tbl from '../../ui/Table.module.css'
import { Tag } from '../../ui/Tag'
import { Button } from '../../ui/Button'
import { isAdvancedBlocking, kindColour, kindsOf } from './app-kinds'
import styles from './Apps.module.css'

/*
One installed app, one row of the installed table. Upstream's is a table row too
(apps.js:63-135): the name with `Version X` and, when the store has a newer one,
`Update Y`; the description; `More Details` with each class, its labels, its
description and, for the classes that serve APP records, the `Record Data
Template`; and the buttons Config, Update, Store Update and Uninstall.

What the redesign changes (deviation 17), and nothing here acts differently:

  · The kinds of the app's classes are also a column of their own (`Kind`), each
    in its series colour (`app-kinds.ts`), so what an app plugs into reads without
    opening it. More Details still lists them per class, coloured the same.
  · One line per app (2026-11-06): its name, version and update, its kinds and its
    actions. The description and the classes are upstream's More Details, opened
    under the row by the chevron that carries that name.
  · The actions: Store Update with its label when the store has one, Config and
    Update (from a file) as icons with their names in the tooltip, and the `⋮`
    menu carrying every action by name, Uninstall only there, as on every other
    collection of this console.
  · `Visual Editor` (OURS), on the row and in the menu of the Advanced Blocking app:
    a link to its editor page. It sits before Config, which still opens the same
    JSON dialog. It is not disabled while the row is busy: it only goes to a page.
    When more than one app has that class, the address says which (`?name=`).

`updateAvailable` may not come: the server only writes the three update fields if
the app is in the store's catalog. That is why it is checked as optional.
*/
export function AppRow({
  app,
  busy,
  namedEditor,
  onConfig,
  onUpdate,
  onStoreUpdate,
  onUninstall,
}: {
  app: InstalledApp
  busy: boolean
  /** Another installed app has this app's Advanced Blocking class. */
  namedEditor: boolean
  onConfig: () => void
  onUpdate: () => void
  onStoreUpdate: () => void
  onUninstall: () => void
}) {
  const hasUpdate = app.updateAvailable === true && Boolean(app.updateUrl)
  const kinds = kindsOf(app)
  const editor = isAdvancedBlocking(app)
    ? {
        to: { section: 'apps', sub: ADVANCED_BLOCKING_DETAIL },
        search: namedEditor ? `?${new URLSearchParams({ name: app.name }).toString()}` : '',
      }
    : null

  const [open, setOpen] = useState(false)
  const detail = useId()

  return (
    <>
      <tr aria-label={app.name} className={open ? styles.openRow : undefined}>
        <td className={tbl.lead}>
          <div className={styles.appHead}>
            <span className={styles.appName}>{app.name}</span>
            <Tag>Version {app.version}</Tag>
            {hasUpdate && <Tag tone="warn">Update {app.updateVersion}</Tag>}
          </div>
        </td>
        <td className={styles.kindCell}>
          <div className={styles.kinds}>
            {kinds.map((k) => (
              <KindChip key={k} kind={k} />
            ))}
          </div>
        </td>
        <td className={`${tbl.actionsCell} ${styles.actionsCell}`}>
          <div className={`${tbl.actions} ${styles.actions}`}>
            {hasUpdate && (
              <Button size="sm" lead="download" disabled={busy} onClick={onStoreUpdate}>
                Store Update
              </Button>
            )}
            {editor != null && (
              <RouteButton {...editor} lead="edit">
                Visual Editor
              </RouteButton>
            )}
            <RowAction icon="settings" name="Config" disabled={busy} onClick={onConfig} />
            <RowAction icon="upload" name="Update" disabled={busy} onClick={onUpdate} />
            <Menu label={`Actions for ${app.name}`}>
              {(close) => (
                <>
                  {editor != null && (
                    <MenuRouteItem {...editor} icon="edit" onClick={close}>
                      Visual Editor
                    </MenuRouteItem>
                  )}
                  <MenuItem icon="settings" disabled={busy} onClick={() => { close(); onConfig() }}>
                    Config
                  </MenuItem>
                  <MenuItem icon="upload" disabled={busy} onClick={() => { close(); onUpdate() }}>
                    Update
                  </MenuItem>
                  {hasUpdate && (
                    <MenuItem icon="download" disabled={busy} onClick={() => { close(); onStoreUpdate() }}>
                      Store Update
                    </MenuItem>
                  )}
                  <Separator />
                  <MenuItem icon="trash" tone="danger" disabled={busy} onClick={() => { close(); onUninstall() }}>
                    Uninstall
                  </MenuItem>
                </>
              )}
            </Menu>
            <RowAction
              icon={open ? 'chevronDown' : 'chevronRight'}
              name="More Details"
              aria-expanded={open}
              aria-controls={detail}
              onClick={() => setOpen((v) => !v)}
            />
          </div>
        </td>
      </tr>
      {open && (
        <tr id={detail} className={styles.detailRow}>
          <td colSpan={3}>
            {app.description != null && <p className={styles.descFull}>{app.description}</p>}
            {app.dnsApps.map((d) => (
              <div key={d.classPath} className={styles.cls}>
                <div className={styles.classHead}>
                  <span className={styles.classPath}>{d.classPath}</span>
                  <span className={styles.kinds}>
                    {dnsAppLabels(d).map((l) => (
                      <KindChip key={l} kind={l} />
                    ))}
                  </span>
                </div>
                <p className={styles.classDesc}>{d.description}</p>
                {/* apps.js:82. The template is only shown for the classes that
                    serve APP records, which are the ones that bring it. */}
                {d.isAppRecordRequestHandler && d.recordDataTemplate != null && (
                  <>
                    <div className={styles.templateK}>Record Data Template</div>
                    <pre className={styles.template}>{d.recordDataTemplate}</pre>
                  </>
                )}
              </div>
            ))}
          </td>
        </tr>
      )}
    </>
  )
}

/** A kind, in its series colour and with its name written beside it. */
export function KindChip({ kind }: { kind: string }) {
  return (
    <span className={styles.kind} style={{ '--sw': kindColour(kind) } as CSSProperties}>
      {kind}
    </span>
  )
}
