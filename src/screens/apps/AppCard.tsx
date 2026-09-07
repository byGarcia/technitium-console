import { dnsAppLabels, type InstalledApp } from '../../api/apps'
import { Button } from '../../ui/Button'
import { Menu } from '../../ui/Menu'
import { Details } from '../../ui/Details'
import { Chip } from '../../ui/Tag'
import styles from './Apps.module.css'

/*
One card per installed app. In upstream it is a table row (apps.js:63-135); the
redesign turns it into a card because the description is long. What is shown is
the same, and in the same order.

`updateAvailable` may not come: the server only writes the three update fields if
the app is in the store's catalog. That is why it is checked as optional and not
as a boolean.
*/
export function AppCard({
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

  return (
    <li className={styles.app} aria-label={app.name}>
      <div className={styles.ah}>
        <div>
          <h2>{app.name}</h2>
          {/*
          The version, and the update when there is one. It used to read
          `v11.1 · installed` — and "installed" is true of every card in this
          list, so it was a word spending a line to say nothing. What replaces it
          is nothing: the version alone, and the update beside it when it exists.
          */}
          <div className={styles.view}>
            v{app.version}
            {hasUpdate && (
              <>
                {' · '}
                <span className={styles.blank}>Update v{app.updateVersion}</span>
              </>
            )}
          </div>
        </div>
      </div>

      {app.description && <p className={styles.desc}>{app.description}</p>}

      {app.dnsApps.length > 0 && (
        <Details className={styles.details} summary="More Details">
          {app.dnsApps.map((d) => (
            <div key={d.classPath} className={styles.cls}>
              <div className={styles.classPath}>{d.classPath}</div>
              <div className={styles.caps}>
                {dnsAppLabels(d).map((l) => (
                  <Chip key={l}>{l}</Chip>
                ))}
              </div>
              <p className={styles.classDesc}>{d.description}</p>
              {/* apps.js:82 — the template is only shown for the classes that
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

      <div className={styles.foot}>
        <Button disabled={busy} onClick={onConfig}>
          Config
        </Button>
        <Button disabled={busy} onClick={onUpdate}>
          Update
        </Button>
        {hasUpdate && (
          <Button variant="primary" disabled={busy} onClick={onStoreUpdate}>
            Store Update
          </Button>
        )}
        {/*
        `Uninstall` goes in the menu, and that is the console's rule and not a
        preference: `ui/Menu` says destructive things live there because an
        action that repeats once per item cannot be a loose button next to the
        harmless ones, and `ui/Button` says the FILLED danger is not for a
        repeated row —"a red block per row turns the table into an alarm"—.

        This grid is a row list: four cards at 1440 meant four filled red blocks
        abreast, and one more for every app installed. Zones, Users, Groups,
        Sessions and Cluster all put their destructive verb in the menu; this was
        the one place that did not.
        */}
        <Menu label={`Actions — ${app.name}`}>
          {(close) => (
            <Button
              variant="danger"
              size="sm"
              disabled={busy}
              onClick={() => {
                close()
                onUninstall()
              }}
            >
              Uninstall
            </Button>
          )}
        </Menu>
      </div>
    </li>
  )
}
