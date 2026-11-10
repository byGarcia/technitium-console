import { useEffect, useState } from 'react'
import { getAppConfig, listApps, setAppConfig } from '../../../api/apps'
import { ADVANCED_BLOCKING_DETAIL } from '../../../app/sections'
import { noticeFromFailure, type Notice } from '../../../lib/notice'
import { Button } from '../../../ui/Button'
import { Check } from '../../../ui/Check'
import { Dialog } from '../../../ui/Dialog'
import { Loading } from '../../../ui/Empty'
import { Notifier } from '../../../ui/Notifier'
import { RouteLink } from '../../../ui/RouteLink'
import { openConfig, serializeConfig, type EditorModel } from './config-model'
import { allowedBy, allowedName, clientGroup, hasEndpointRows, withAllowed } from './allow-in-group'
import { blocking, validate } from './validate'
import { findBlockingApp, MIN_VERSION, versionState } from './version'
import styles from './AllowInGroup.module.css'

/*
`Allow in Advanced Blocking` from a Query Logs row (deviation 47, OURS: upstream's
row menu has only `Query DNS Server` and `Allow Domain`, logs.js:539-552). It adds
the row's name to the `allowed` list of the groups ticked here, and nothing else.

Its limits are the visual editor's (deviation 45): only `apps/list`,
`apps/config/get` and `apps/config/set`, with no `node`, so it edits the config of
the server the console is connected to, as Config does; the config is patched, not
rebuilt; before writing it reads the config again and writes nothing if it changed;
a config the editor would refuse is refused here too, with a way to the editor.

Its words, OURS: the title, `Allow`, `Open Visual Editor`, `Already allowed by
<line>.`, the sentences about the client's group, the endpoint note, the refusal
and conflict sentences, `Tick at least one group.` and the result.
*/

const CONFLICT = 'The config changed on the server while this was open. Nothing was saved.'

type Phase =
  | { kind: 'loading' }
  | { kind: 'failed'; text: string }
  | { kind: 'unusable'; text: string }
  | { kind: 'ready'; name: string; text: string; model: EditorModel }

/** Mounted when it opens and unmounted when it closes, so each opening starts clean. */
export function AllowInGroup({
  token,
  domain,
  clientIp,
  onClose,
  onDone,
}: {
  token: string | null
  domain: string
  clientIp: string
  onClose: () => void
  onDone: (n: Notice) => void
}) {
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' })
  const [chosen, setChosen] = useState<ReadonlySet<string>>(new Set())
  const [notice, setNotice] = useState<Notice | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let live = true
    void (async () => {
      const list = await listApps(token)
      if (!live) return
      if (list.kind !== 'ok') return setPhase({ kind: 'failed', text: noticeFromFailure(list).text })
      const app = findBlockingApp(list.data.response.apps ?? [])
      if (app == null) return setPhase({ kind: 'unusable', text: 'The Advanced Blocking app is not installed on this server.' })
      if (versionState(app.version) === 'too-old') {
        return setPhase({ kind: 'unusable', text: `This needs Advanced Blocking ${MIN_VERSION} or later. This server has ${app.version}.` })
      }
      const read = await getAppConfig(token, app.name)
      if (!live) return
      if (read.kind !== 'ok') return setPhase({ kind: 'failed', text: noticeFromFailure(read).text })
      const text = read.data.response.config ?? ''
      const opened = openConfig(read.data.response.config ?? null)
      if (opened.kind === 'refused') {
        return setPhase({ kind: 'unusable', text: `This config can only be edited as JSON. ${opened.reason}` })
      }
      const own = clientGroup(opened.model, clientIp)
      if (own != null && allowedBy(own, domain) == null) setChosen(new Set([own.id]))
      setPhase({ kind: 'ready', name: app.name, text, model: opened.model })
    })()
    return () => {
      live = false
    }
  }, [token, clientIp, domain])

  async function allow() {
    if (phase.kind !== 'ready') return
    if (chosen.size === 0) return setNotice({ type: 'warning', title: 'Warning!', text: 'Tick at least one group.' })
    const next = withAllowed(phase.model, [...chosen], domain)
    const errors = blocking(validate(next))
    if (errors.length > 0) {
      return setNotice({ type: 'danger', title: 'Error!', text: `Nothing was saved: ${errors[0].message} Open the visual editor to fix it.` })
    }
    setBusy(true)
    const read = await getAppConfig(token, phase.name)
    if (read.kind !== 'ok') {
      setBusy(false)
      return setNotice(noticeFromFailure(read))
    }
    if ((read.data.response.config ?? '') !== phase.text) {
      setBusy(false)
      return setNotice({ type: 'danger', title: 'Error!', text: CONFLICT })
    }
    const saved = await setAppConfig(token, phase.name, serializeConfig(next))
    setBusy(false)
    if (saved.kind !== 'ok') return setNotice(noticeFromFailure(saved))
    const names = phase.model.groups.filter((g) => chosen.has(g.id)).map((g) => `'${g.name}'`)
    onClose()
    onDone({
      type: 'success',
      title: 'Allowed!',
      text: `Domain '${allowedName(domain)}' was added to the allowed domains of Advanced Blocking ${names.length === 1 ? 'group' : 'groups'} ${names.join(', ')}.`,
    })
  }

  const editorLink = (
    <RouteLink to={{ section: 'apps', sub: ADVANCED_BLOCKING_DETAIL }} onClick={onClose}>
      Open Visual Editor
    </RouteLink>
  )

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={`Allow in Advanced Blocking - ${allowedName(domain)}`}
      close="Cancel"
      actions={
        phase.kind === 'ready' ? (
          <Button variant="primary" disabled={busy} onClick={() => void allow()}>
            Allow
          </Button>
        ) : undefined
      }
    >
      <Notifier notice={notice} onClose={() => setNotice(null)} />
      {phase.kind === 'loading' && <Loading />}
      {phase.kind === 'failed' && <p className={styles.note}>{phase.text}</p>}
      {phase.kind === 'unusable' && (
        <p className={styles.note}>
          {phase.text} {editorLink}
        </p>
      )}
      {phase.kind === 'ready' && <Groups phase={phase} domain={domain} clientIp={clientIp} chosen={chosen} onChange={setChosen} />}
    </Dialog>
  )
}

function Groups({
  phase,
  domain,
  clientIp,
  chosen,
  onChange,
}: {
  phase: Extract<Phase, { kind: 'ready' }>
  domain: string
  clientIp: string
  chosen: ReadonlySet<string>
  onChange: (next: ReadonlySet<string>) => void
}) {
  const { model } = phase
  const own = clientGroup(model, clientIp)
  if (model.groups.length === 0) return <p className={styles.note}>This config has no groups.</p>

  return (
    <>
      <p className={styles.note}>
        {own != null
          ? `Client ${clientIp} is in group '${own.name}'.`
          : `Client ${clientIp} matches no group, so Advanced Blocking blocks nothing for it.`}
        {hasEndpointRows(model) &&
          ' A local endpoint row can give it another group: the query log does not say which endpoint the query came in on.'}
      </p>
      <div className={styles.groups}>
        {model.groups.map((g) => {
          const by = allowedBy(g, domain)
          return (
            <Check
              key={g.id}
              label={g.name}
              checked={by != null || chosen.has(g.id)}
              disabled={by != null}
              help={by != null ? `Already allowed by ${by}.` : undefined}
              onChange={(v) => {
                const next = new Set(chosen)
                if (v) next.add(g.id)
                else next.delete(g.id)
                onChange(next)
              }}
            />
          )
        })}
      </div>
    </>
  )
}
