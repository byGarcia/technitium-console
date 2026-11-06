import type { CSSProperties } from 'react'
import { dnsAppLabels, type InstalledApp } from '../../api/apps'
import { Details } from '../../ui/Details'
import { Menu, MenuItem, Separator } from '../../ui/Menu'
import { RowAction } from '../../ui/Table'
import tbl from '../../ui/Table.module.css'
import { Tag } from '../../ui/Tag'
import { Button } from '../../ui/Button'
import { kindColour, kindsOf } from './app-kinds'
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
  · The description shows two lines at rest when there is a More Details to read
    it whole in, as the store does; an app without classes shows it whole.
  · The actions are the row's group (`ui/Table`'s `.actions`): Config and Update as
    icons with their names in the tooltip, Store Update with its label when the
    store has one, and the `⋮` menu carrying every action by name, Uninstall
    included and only there, as on every other collection of this console.

`updateAvailable` may not come: the server only writes the three update fields if
the app is in the store's catalog. That is why it is checked as optional.
*/
export function AppRow({
  app,
  busy,
  onConfig,
  onUpdate,
  onStoreUpdate,
  onUninstall,
}: {
  app: InstalledApp
  busy: boolean
  onConfig: () => void
  onUpdate: () => void
  onStoreUpdate: () => void
  onUninstall: () => void
}) {
  const hasUpdate = app.updateAvailable === true && Boolean(app.updateUrl)
  const kinds = kindsOf(app)
  const withDetails = app.dnsApps.length > 0

  return (
    <tr aria-label={app.name}>
      <td className={tbl.lead}>
        <div className={styles.appHead}>
          <span className={styles.appName}>{app.name}</span>
          <Tag>Version {app.version}</Tag>
          {hasUpdate && <Tag tone="warn">Update {app.updateVersion}</Tag>}
        </div>
        {app.description != null && (
          <p className={withDetails ? styles.descClamp : styles.desc}>{app.description}</p>
        )}
        {withDetails && (
          <Details className={styles.details} summary="More Details">
            {app.description != null && <p className={styles.descFull}>{app.description}</p>}
            {app.dnsApps.map((d) => (
              <div key={d.classPath} className={styles.cls}>
                <div className={styles.classPath}>{d.classPath}</div>
                <div className={styles.kinds}>
                  {dnsAppLabels(d).map((l) => (
                    <KindChip key={l} kind={l} />
                  ))}
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
          </Details>
        )}
      </td>
      <td className={styles.kindCell}>
        <div className={styles.kinds}>
          {kinds.map((k) => (
            <KindChip key={k} kind={k} />
          ))}
        </div>
      </td>
      <td className={tbl.actionsCell}>
        <div className={tbl.actions}>
          <RowAction icon="settings" name="Config" disabled={busy} onClick={onConfig} />
          <RowAction icon="upload" name="Update" disabled={busy} onClick={onUpdate} />
          {hasUpdate && (
            <Button size="sm" lead="download" disabled={busy} onClick={onStoreUpdate}>
              Store Update
            </Button>
          )}
          <Menu label={`Actions for ${app.name}`}>
            {(close) => (
              <>
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
        </div>
      </td>
    </tr>
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
