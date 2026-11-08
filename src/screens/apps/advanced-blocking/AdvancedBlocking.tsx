import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getAppConfig, listApps, setAppConfig } from '../../../api/apps'
import { navigateTo } from '../../../app/route'
import { dropParams, readParam } from '../../../lib/url-state'
import { Alert } from '../../../ui/Alert'
import { Button } from '../../../ui/Button'
import { Confirm } from '../../../ui/Confirm'
import { Failure, Loading } from '../../../ui/Empty'
import { Notifier } from '../../../ui/Notifier'
import { Panel, Body } from '../../../ui/Panel'
import { SectionHeader } from '../../../ui/SectionHeader'
import { SectionIndex } from '../../../ui/SectionIndex'
import { Tag } from '../../../ui/Tag'
import { useSectionInView } from '../../../ui/useSectionInView'
import { AppConfig } from '../AppConfig'
import { error, type AlertState } from '../Apps'
import { ClientsTable } from './ClientsTable'
import {
  addGroup,
  addList,
  addRow,
  deleteGroup,
  isUnchanged,
  openConfig,
  pendingSections,
  removeList,
  removeRow,
  serializeConfig,
  setGeneral,
  setGroup,
  setList,
  setRow,
  type EditorModel,
} from './config-model'
import { GeneralPanel } from './GeneralPanel'
import { GroupEditor } from './GroupEditor'
import { blocking, validate } from './validate'
import { CHECKED_VERSION, findBlockingApp, MIN_VERSION, versionState } from './version'
import styles from './AdvancedBlocking.module.css'

/*
The visual editor of the Advanced Blocking app's config (CONVENTIONS.md, deviation
45). Reached from the app's row in Apps; the app's `Config` button and its raw JSON
do not change, and `Edit as JSON` here is that same dialog.

This screen owns the moment of saving. It holds the text the server gave and an
editor model built from it (`config-model.ts`): with nothing changed, Save sends that
text back byte for byte; with changes, only the changed paths of the original
document are rewritten. Before writing, it reads the config again and refuses if
someone else changed it (only `config/get` and `config/set`: there is no version to
compare). The calls are the Config button's, with no `node`
(apps.js:503, `Apps.tsx`), so the check and the write hit the same server.

Validation is `validate.ts`, measured against a real server. A problem that blocks
is drawn at its control after the first Save; Save then moves the focus to the
first one.

OURS, and every word of it, since the stock console has no such page: the subtitle,
the independence Warning (from the app's own README and DnsServer.cs:4568-4597,
4772), the refusal, version and conflict sentences, `Visual Editor`, `Edit as JSON`,
`Unsaved changes:`, `No unsaved changes`, `Discard`, `Add group`, `<n> problems to fix
before saving`, the Delete Group sentences and `Reload`. `App Config Saved!` and its
sentence are upstream's (apps.js:512).
*/

const INDEPENDENCE =
  "Advanced Blocking is separate from the server's Blocking section. It does not use those rules, lists or settings, and turning Blocking off does not stop it. If both are on, a domain allowed by either one is not blocked by the other."
const CONFLICT = 'This config changed on the server after you opened it. Nothing was saved.'

type Phase =
  | { kind: 'loading' }
  | { kind: 'failed'; message: string }
  | { kind: 'missing' }
  | { kind: 'too-old'; name: string; version: string; text: string }
  | { kind: 'refused'; name: string; version: string; text: string; reason: string }
  | { kind: 'editable'; name: string; version: string; text: string }

const sectionId = (section: string) => `ab-sec-${section}`

export function AdvancedBlocking({ token }: { token: string | null }) {
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' })
  const [model, setModel] = useState<EditorModel | null>(null)
  const [notice, setNotice] = useState<AlertState | null>(null)
  const [conflict, setConflict] = useState(false)
  const [showProblems, setShowProblems] = useState(false)
  const [busy, setBusy] = useState(false)
  const [jsonOpen, setJsonOpen] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<string | null>(null)
  const [focusId, setFocusId] = useState<string | null>(null)
  const [scrollTo, setScrollTo] = useState<string | null>(null)
  const appName = useRef(readParam('app') ?? undefined)
  /* Once the page has drawn, a failed reload must not take it away. */
  const drawn = useRef(false)

  useEffect(() => () => dropParams(['app']), [])

  const load = useCallback(async () => {
    setConflict(false)
    setShowProblems(false)
    const failed = (outcome: { kind: string; message?: string }) => {
      if (drawn.current) setNotice(error(outcome))
      else setPhase({ kind: 'failed', message: error(outcome).text })
    }
    const list = await listApps(token)
    if (list.kind !== 'ok') {
      failed(list)
      return
    }
    const app = findBlockingApp(list.data.response.apps, appName.current)
    if (app == null) {
      setPhase({ kind: 'missing' })
      return
    }
    const read = await getAppConfig(token, app.name)
    if (read.kind !== 'ok') {
      failed(read)
      return
    }
    drawn.current = true
    const text = read.data.response.config ?? ''
    const base = { name: app.name, version: app.version, text }
    if (versionState(app.version) === 'too-old') {
      setModel(null)
      setPhase({ kind: 'too-old', ...base })
      return
    }
    const opened = openConfig(read.data.response.config ?? null)
    if (opened.kind === 'refused') {
      setModel(null)
      setPhase({ kind: 'refused', ...base, reason: opened.reason })
      return
    }
    setModel(opened.model)
    setPhase({ kind: 'editable', ...base })
  }, [token])

  useEffect(() => {
    void load()
  }, [load])

  const dirty = model != null && !isUnchanged(model)
  useEffect(() => {
    if (!dirty) return
    const warn = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  useEffect(() => {
    if (focusId == null) return
    document.getElementById(focusId)?.focus()
    setFocusId(null)
  }, [focusId])

  useEffect(() => {
    if (scrollTo == null) return
    document.getElementById(scrollTo)?.scrollIntoView?.()
    setScrollTo(null)
  }, [scrollTo])

  const problems = useMemo(() => (model == null ? [] : validate(model)), [model])
  const errors = useMemo(() => blocking(problems), [problems])

  const sectionIds = useMemo(
    () => (model == null ? [] : ['clients', ...model.groups.map((g) => g.id), 'general'].map(sectionId)),
    [model],
  )
  const inView = useSectionInView(sectionIds)

  const path = [{ label: 'Apps', onOpen: () => navigateTo({ section: 'apps', sub: null }) }]

  /** The re-read before any write: same text, or nothing is written. */
  const unchangedOnServer = useCallback(async (name: string, text: string): Promise<AlertState | null> => {
    const read = await getAppConfig(token, name)
    if (read.kind !== 'ok') return error(read)
    if ((read.data.response.config ?? '') !== text) {
      setConflict(true)
      return { type: 'danger', title: 'Error!', text: CONFLICT }
    }
    return null
  }, [token])

  const savedNotice = (name: string): AlertState => ({
    type: 'success',
    title: 'App Config Saved!',
    text: `The DNS application '${name}' config was saved and reloaded successfully.`,
  })

  /** Reads the config again; nothing can be edited until the answer is in. */
  async function reload() {
    setBusy(true)
    await load()
    setBusy(false)
  }

  if (phase.kind === 'loading') return <Loading />
  if (phase.kind === 'failed') return <Failure>{phase.message}</Failure>

  if (phase.kind === 'missing') {
    return (
      <>
        <SectionHeader path={path} title="Advanced Blocking" />
        <Panel>
          <Body>
            <p className={styles.lead}>The Advanced Blocking app is not installed on this server.</p>
            <Button variant="primary" lead="store" onClick={() => navigateTo({ section: 'apps', sub: null })}>
              Open Apps
            </Button>
          </Body>
        </Panel>
      </>
    )
  }

  const { name, version, text } = phase
  const drafted = model != null && !isUnchanged(model) && errors.length === 0
  const header = (
    <SectionHeader
      path={path}
      title="Advanced Blocking"
      subtitle="Different blocking for different clients. Changes wait until you save."
      labels={<Tag>Version {version}</Tag>}
      actions={
        <Button lead="file" disabled={busy} onClick={() => setJsonOpen(true)}>
          Edit as JSON
        </Button>
      }
    />
  )
  const jsonDialog = (
    <AppConfig
      open={jsonOpen}
      onOpenChange={setJsonOpen}
      token={token}
      name={name}
      initialConfig={drafted ? serializeConfig(model) : text}
      note={
        model != null && !isUnchanged(model) && errors.length > 0 ? (
          <Alert type="info" title="Note!">
            Your unsaved changes have problems, so this shows the saved config.
          </Alert>
        ) : undefined
      }
      beforeSave={() => unchangedOnServer(name, text)}
      onSaved={(n) => {
        setJsonOpen(false)
        setNotice(savedNotice(n))
        void reload()
      }}
    />
  )
  const conflictAlert = conflict && (
    <div className={styles.note}>
      <Alert
        type="danger"
        title="Error!"
        action={
          <Button size="sm" disabled={busy} onClick={() => void reload()}>
            Reload
          </Button>
        }
      >
        {CONFLICT}
      </Alert>
    </div>
  )

  if (phase.kind === 'too-old' || phase.kind === 'refused') {
    return (
      <>
        <Notifier notice={notice} onClose={() => setNotice(null)} />
        {header}
        {conflictAlert}
        <Alert type="warning" title="Warning!">
          {phase.kind === 'too-old'
            ? `The visual editor needs Advanced Blocking ${MIN_VERSION} or later. This server has ${version}.`
            : `This config can only be edited as JSON. ${phase.reason} Nothing here has been changed.`}
        </Alert>
        {jsonDialog}
      </>
    )
  }

  if (model == null) return <Loading />

  const pending = pendingSections(model)
  const problemSections = new Set(showProblems ? errors.map((p) => p.section) : [])
  const pendingNames = new Set(pending)
  const markOf = (section: string, label: string): 'problem' | 'unsaved' | undefined =>
    problemSections.has(section) ? 'problem' : pendingNames.has(label) ? 'unsaved' : undefined
  const sections = [
    { id: sectionId('clients'), label: 'Clients', mark: markOf('clients', 'Clients') },
    ...model.groups.map((g) => ({ id: sectionId(g.id), label: g.name || 'Unnamed', mark: markOf(g.id, g.name) })),
    { id: sectionId('general'), label: 'General', mark: markOf('general', 'General') },
  ]

  async function save() {
    if (model == null) return
    if (errors.length > 0) {
      setShowProblems(true)
      setFocusId(`ab-${errors[0].target}-${errors[0].field}`)
      return
    }
    /* The form is disabled from here until the page holds what was written, so
       nothing typed meanwhile can be lost. */
    setBusy(true)
    try {
      const refused = await unchangedOnServer(name, text)
      if (refused != null) {
        if (refused.text !== CONFLICT) setNotice(refused)
        return
      }
      const sent = isUnchanged(model) ? text : serializeConfig(model)
      const outcome = await setAppConfig(token, name, sent)
      if (outcome.kind !== 'ok') {
        setNotice(error(outcome))
        return
      }
      setNotice(savedNotice(name))
      /* The server stores the text it was given (DnsApplication.cs:235-248): the page
         goes on from that text, with no reload that could fail after a good save. */
      const opened = openConfig(sent)
      if (opened.kind !== 'editable') {
        await load()
        return
      }
      setConflict(false)
      setShowProblems(false)
      setModel(opened.model)
      setPhase({ kind: 'editable', name, version, text: sent })
    } finally {
      setBusy(false)
    }
  }

  function discard() {
    const opened = openConfig(text)
    if (opened.kind === 'editable') setModel(opened.model)
    setShowProblems(false)
  }

  const deleting = pendingDelete == null ? null : model.groups.find((g) => g.id === pendingDelete)
  const deletingUsers = deleting == null ? 0 : model.rows.filter((r) => r.groupId === deleting.id).length

  return (
    <>
      <Notifier notice={notice} onClose={() => setNotice(null)} />
      {header}
      {versionState(version) === 'newer' && (
        <div className={styles.note}>
          <Alert type="info" title="Note!">
            This server runs Advanced Blocking {version}; this console was checked against {CHECKED_VERSION}. Anything it does not recognise is kept as it is.
          </Alert>
        </div>
      )}
      <div className={styles.note}>
        <Alert type="warning" title="Warning!">
          {INDEPENDENCE}
        </Alert>
      </div>
      {conflictAlert}

      <div className={styles.layout}>
        <div className={styles.index}>
          <SectionIndex sections={sections} active={inView ?? sections[0].id} />
          <div className={styles.indexAdd}>
            <Button
              size="sm"
              lead="add"
              disabled={busy}
              onClick={() => {
                const made = addGroup(model)
                setModel(made.model)
                setScrollTo(sectionId(made.id))
              }}
            >
              Add group
            </Button>
          </div>
        </div>

        <fieldset className={styles.content} disabled={busy} aria-busy={busy}>
          <section id={sectionId('clients')} className={styles.section}>
            <ClientsTable
              rows={model.rows}
              groups={model.groups}
              problems={problems}
              showProblems={showProblems}
              onAdd={(map) => setModel((m) => (m == null ? m : addRow(m, map)))}
              onChange={(id, patch) => setModel((m) => (m == null ? m : setRow(m, id, patch)))}
              onRemove={(id) => setModel((m) => (m == null ? m : removeRow(m, id)))}
              onOpenGroup={(id) => setScrollTo(sectionId(id))}
            />
          </section>

          {model.groups.map((g) => (
            <section key={g.id} id={sectionId(g.id)} className={styles.section}>
              <GroupEditor
                key={g.id}
                group={g}
                clients={model.rows.filter((r) => r.groupId === g.id && r.address !== '').map((r) => r.address)}
                problems={problems}
                showProblems={showProblems}
                onChange={(patch) => setModel((m) => (m == null ? m : setGroup(m, g.id, patch)))}
                onDelete={() => setPendingDelete(g.id)}
                onShowClients={() => setScrollTo(sectionId('clients'))}
                onAddList={(kind, url) => setModel((m) => (m == null ? m : addList(m, g.id, kind, url)))}
                onChangeList={(listId, patch) => setModel((m) => (m == null ? m : setList(m, g.id, listId, patch)))}
                onRemoveList={(listId) => setModel((m) => (m == null ? m : removeList(m, g.id, listId)))}
              />
            </section>
          ))}

          <section id={sectionId('general')} className={styles.section}>
            <GeneralPanel
              enabled={model.enabled}
              ttl={model.ttl}
              hours={model.hours}
              minutes={model.minutes}
              problems={problems}
              showProblems={showProblems}
              onChange={(patch) => setModel((m) => (m == null ? m : setGeneral(m, patch)))}
            />
          </section>

          <div className={styles.bar} role="region" aria-label="Save">
            <span className={styles.pending} aria-live="polite">
              {showProblems && errors.length > 0 ? (
                <span className={styles.problems}>
                  {errors.length} {errors.length === 1 ? 'problem' : 'problems'} to fix before saving
                </span>
              ) : pending.length > 0 ? (
                <>
                  <span className={styles.dot} aria-hidden="true" />
                  Unsaved changes: {pending.join(', ')}
                </>
              ) : (
                <span className={styles.saved}>No unsaved changes</span>
              )}
            </span>
            <span className={styles.barActions}>
              <Button disabled={!dirty || busy} onClick={discard}>
                Discard
              </Button>
              <Button lead="save" variant="primary" disabled={busy} onClick={() => void save()}>
                Save
              </Button>
            </span>
          </div>
        </fieldset>
      </div>

      <Confirm
        open={deleting != null}
        title="Delete Group"
        text={
          deleting == null
            ? ''
            : deletingUsers > 0
              ? `${deletingUsers} client ${deletingUsers === 1 ? 'row uses' : 'rows use'} '${deleting.name}'. They stay, and have to get another group before you can save.`
              : `Are you sure you want to delete the group '${deleting.name}'?`
        }
        label="Delete"
        onClose={() => setPendingDelete(null)}
        onConfirm={() => {
          if (pendingDelete != null) setModel((m) => (m == null ? m : deleteGroup(m, pendingDelete)))
          setPendingDelete(null)
        }}
      />
      {jsonDialog}
    </>
  )
}
