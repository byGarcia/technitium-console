import type { CSSProperties, ReactNode } from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  deleteAllLogs,
  deleteLog,
  downloadLogText,
  listLogFiles,
  openLogDownload,
  type LogFile,
} from '../../api/logs'
import { deleteAllStats } from '../../api/dashboard'
import { Confirm } from '../../ui/Confirm'
import { Raw } from '../../ui/Raw'
import { LogText, stampWidth } from './LogText'
import { PermissionButton } from '../../ui/PermissionButton'
import { Button } from '../../ui/Button'
import { SectionHeader } from '../../ui/SectionHeader'
import { Loading } from '../../ui/Empty'
import { DataFoot, DataTable } from '../../ui/DataTable'
import { RowAction, Table } from '../../ui/Table'
import { Icon } from '../../ui/Icon'
import tbl from '../../ui/Table.module.css'
import styles from './Logs.module.css'
import { noticeFromFailure, type Notice } from '../../lib/notice'
import { Notifier } from '../../ui/Notifier'
import { dropParams, readParam, writeParams } from '../../lib/url-state'
import { LogFilesSummary } from './LogFilesSummary'
import { cutShort, shareOf, summariseFiles, textFacts } from './log-files'

/*
Logs › View Logs (logs.js:105-268).

Four things from upstream that govern this screen:

  1. **The three delete actions are NOT of the same section.** "delete all logs"
     and deleting a file ask for `Logs.Delete`; "delete all stats" deletes the
     Dashboard's statistics and asks for `Dashboard.Delete`
     (`WebServiceLogsApi.cs:107,123,135`). They sit together on the screen and
     they are different permissions.
  2. **"delete all stats" is ALWAYS offered; "delete all logs" only if there are
     files** (logs.js:119-127). With no files it says "No Log File Was Found".
  3. **The viewer asks for only 2 MB** and the "Download" button for the whole
     file; they are two different calls to the same endpoint.
  4. **A server error is drawn INSIDE the viewer**, formatted as JSON, instead of
     as an alert (logs.js:170-172). It is not an oversight: the endpoint returns
     text and the only way to show the error is in that same space.

HOW IT IS LAID OUT (deviation 20, 2026-11-06), the way Cache and a zone read: a
list of things, and the thing you open as the page.

  · **The folder.** The header is the section's, with Refresh beside the title
    (the same `logs/list` the tab reads on arrival) and the two folder-wide verbs,
    Delete All Logs and Delete All Stats, at the right. Under it, up to four cards
    (`LogFilesSummary.tsx`) and ONE table of the files, one line each: the file's
    name, which opens it, and its size with its share of the folder. Upstream
    draws the same list as links with the size in brackets (logs.js:129-131).
  · **The open file is the page.** Opening one makes its name the header (the
    trail's `View Logs` goes back to the list), with Refresh beside it (the same
    2 MB read that opening it made) and the file's own verbs, Download and Delete,
    at the right, where the viewer's header had them. Under it the text, in a box
    that takes the rest of the window, with a band over it saying what the text
    holds: the size the list wrote, how many entries, the first and the last
    entry's time, and, when the server stopped at the viewer's 2 MB, that it did.
  · **The open file is in the address bar** (`?file=`, `lib/url-state.ts`),
    written by replacing the entry, read on arrival (the file opens once the list
    says it is there; otherwise the list stays) and dropped when the screen goes.

How the file is read is design, and it is ours (upstream draws a plain `<pre>`
that grows with the page, index.html:3272):

  - **The viewer takes the window's height.** The screen marks itself
    `data-fills-window` while a file is open, the Shell makes its body a flex
    column for it, and the height runs down that chain (screen, reader, `Raw`'s
    `fill` box) so the page itself does not scroll on a desktop, whatever the
    file's size. Its floor is 240 px, about twelve lines. At 720 px and below the
    reader is 70 % of the window, tall enough to read in, short enough to leave
    page around it to scroll by on a touch screen.
  - **Long lines wrap, under their own message.** See `ui/Raw` (`wrap`) for the
    measurement and `LogText` for the timestamp and the break points. Nothing is
    added to the text: copying the viewer gives the file back as it came.
*/

export const FILE_PARAM = 'file'

export interface ViewLogsProps {
  /** The section sub-navigation, drawn under the header. */
  tabs?: ReactNode
  token: string | null
  node?: string
  /** `Logs.canDelete`: deleting a log and deleting them all. */
  canDeleteLogs?: boolean
  /** `Dashboard.canDelete`: deleting all the statistics. */
  canDeleteStats?: boolean
}

type Confirmation = 'log' | 'allLogs' | 'allStats'

/*
A body that is really the server's error.

Upstream returns it as TEXT through the same endpoint as the file, so there is no
way to tell it apart by the transport: it is told apart by its shape. What arrives
is the API's error JSON (`{"status":"error", ...}`), and a log file never starts
with a brace.

It is checked at the START and not by looking for `"error"` inside, because a log
file is full of the word "error" and we would mark ordinary content as a failure.
*/
function isError(text: string | null): boolean {
  return text != null && /^\s*\{\s*"status"\s*:\s*"error"/.test(text)
}

/** What the open text holds, over the viewer. */
function TextBand({ file, text }: { file: LogFile | undefined; text: string }) {
  const facts = textFacts(text)
  return (
    <div className={styles.textBand}>
      <dl className={styles.textFacts}>
        {file != null && (
          <div>
            <dt>Size</dt>
            <dd>{file.size}</dd>
          </div>
        )}
        <div>
          <dt>Entries</dt>
          <dd>{facts.entries}</dd>
        </div>
        {facts.first != null && (
          <div>
            <dt>First</dt>
            <dd className={styles.mono}>{facts.first}</dd>
          </div>
        )}
        {facts.last != null && (
          <div>
            <dt>Last</dt>
            <dd className={styles.mono}>{facts.last}</dd>
          </div>
        )}
      </dl>
      {cutShort(text) && (
        <p className={styles.textCut}>
          <Icon name="warning" size={14} /> Showing the first 2 MB. Download gives the whole file.
        </p>
      )}
    </div>
  )
}

export function ViewLogs({
  tabs,
  token,
  node = '',
  canDeleteLogs = true,
  canDeleteStats = true,
}: ViewLogsProps) {
  const [files, setFiles] = useState<LogFile[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [open, setOpen] = useState<string | null>(null)
  const [body, setBody] = useState<string | null>(null)
  const [loadingBody, setLoadingBody] = useState(false)
  const [loadingList, setLoadingList] = useState(false)
  const [notice, setNotice] = useState<Notice | null>(null)
  const [busy, setBusy] = useState(false)
  const [confirm, setConfirm] = useState<Confirmation | null>(null)
  /* The file the bar asked for on arrival, opened once the list says it exists. */
  const [arrival] = useState(() => readParam(FILE_PARAM))

  // A failure on load is not drawn as an empty list; see `dhcp/Leases`.
  const load = useCallback(async (): Promise<LogFile[] | null> => {
    setLoadingList(true)
    const r = await listLogFiles(token, node)
    setLoadingList(false)
    if (r.kind === 'ok') {
      setFiles(r.data)
      setFailed(false)
      return r.data
    }
    setFiles([])
    setFailed(true)
    setNotice(noticeFromFailure(r))
    return null
  }, [token, node])

  /*
  The list is read again whenever the node changes, and an open file follows it
  (logs.js:101-106 and 144-154): the same name is opened on the new node, or the
  viewer closes if that node has no file by that name. Read through a ref so the
  effect does not run again on opening a file. The first read also opens the file
  the address bar named, when the list has it.
  */
  const openRef = useRef(open)
  useEffect(() => {
    openRef.current = open
  }, [open])
  const arrivalRef = useRef(arrival)
  const viewRef = useRef<(fileName: string) => Promise<void>>(async () => {})
  useEffect(() => {
    let live = true
    void (async () => {
      const list = await load()
      /* Spent only by the run that counts: StrictMode's rehearsal run is cancelled
         before it answers, and must leave the link for the real one. */
      if (!live) return
      const was = openRef.current ?? arrivalRef.current
      arrivalRef.current = null
      if (was == null || list == null) return
      if (list.some((f) => f.fileName === was)) void viewRef.current(was)
      else {
        setOpen(null)
        setBody(null)
      }
    })()
    return () => {
      live = false
    }
  }, [load])

  /* The open file in the bar, and out of it when the screen goes. */
  useEffect(() => {
    writeParams({ [FILE_PARAM]: open })
  }, [open])
  useEffect(() => () => dropParams([FILE_PARAM]), [])

  async function view(fileName: string) {
    setOpen(fileName)
    setBody(null)
    setLoadingBody(true)
    const text = await downloadLogText(token, fileName, node)
    setLoadingBody(false)
    setBody(text)
  }
  useEffect(() => {
    viewRef.current = view
  })

  function close() {
    setOpen(null)
    setBody(null)
  }

  async function download() {
    if (open == null) return
    setBusy(true)
    await openLogDownload(token, open, node)
    setBusy(false)
  }

  async function removeLogFile() {
    if (open == null) return
    setConfirm(null)
    setBusy(true)
    const outcome = await deleteLog(token, open, node)
    setBusy(false)
    if (outcome.kind !== 'ok') return

    await load()
    close()
    setNotice({
      type: 'success',
      title: 'Log Deleted!',
      text: 'Log file was deleted successfully.',
    })
  }

  async function removeAllLogs() {
    setConfirm(null)
    setBusy(true)
    const outcome = await deleteAllLogs(token, node)
    setBusy(false)
    if (outcome.kind !== 'ok') return

    await load()
    close()
    setNotice({
      type: 'success',
      title: 'Logs Deleted!',
      text: 'All log files were deleted successfully.',
    })
  }

  async function removeAllStats() {
    setConfirm(null)
    setBusy(true)
    const outcome = await deleteAllStats(token)
    setBusy(false)
    if (outcome.kind !== 'ok') return

    setNotice({
      type: 'success',
      title: 'Stats Deleted!',
      text: 'All stats files were deleted successfully.',
    })
  }

  if (files == null) return <Loading />

  const CONFIRM_TEXT: Record<Confirmation, { title: string; text: string; label: string }> = {
    log: {
      title: 'Delete Log',
      text: `Are you sure you want to permanently delete the log file '${open ?? ''}'?`,
      label: 'Delete',
    },
    allLogs: {
      title: 'Delete All Logs',
      text: 'Are you sure you want to permanently delete all log files?',
      label: 'Delete All Logs',
    },
    allStats: {
      title: 'Delete All Stats',
      text: 'Are you sure you want to permanently delete all stats files?',
      label: 'Delete All Stats',
    },
  }

  const confirmation = (
    <Confirm
      open={confirm !== null}
      title={confirm ? CONFIRM_TEXT[confirm].title : ''}
      text={confirm ? CONFIRM_TEXT[confirm].text : ''}
      label={confirm ? CONFIRM_TEXT[confirm].label : ''}
      busy={busy}
      onClose={() => setConfirm(null)}
      onConfirm={() => {
        if (confirm === 'log') void removeLogFile()
        else if (confirm === 'allLogs') void removeAllLogs()
        else if (confirm === 'allStats') void removeAllStats()
      }}
    />
  )
  const notifier = <Notifier notice={notice} onClose={() => setNotice(null)} />

  if (open != null) {
    const file = files.find((f) => f.fileName === open)
    return (
      <div className={styles.viewLogs} data-fills-window="">
        <SectionHeader
          path={[{ label: 'View Logs', onOpen: close }]}
          title={open}
          tabs={tabs}
          titleAction={
            <RowAction icon="refresh" name="Refresh" disabled={loadingBody} onClick={() => void view(open)} />
          }
          actions={
            <>
              {/* `Download` asks for no permission at all: it stays enabled. */}
              <Button lead="download" disabled={busy} onClick={() => void download()}>
                Download
              </Button>
              <PermissionButton
                lead="trash"
                variant="danger"
                disabled={busy}
                permission={canDeleteLogs ? undefined : 'Logs.canDelete'}
                onClick={() => setConfirm('log')}
              >
                Delete
              </PermissionButton>
            </>
          }
        />
        {notifier}
        <div className={styles.reader}>
          {loadingBody ? (
            <Loading />
          ) : (
            <>
              {body != null && !isError(body) && <TextBand file={file} text={body} />}
              <div className={styles.readerBody}>
                {/*
                The server's error is drawn HERE and not as a notice, because the
                endpoint returns text and this is the only place it fits
                (`logs.js:170-172`). The frame turns `--dan` so it is framed and
                not disguised as the file's content.
                */}
                <Raw
                  text={`${open} log file`}
                  fill
                  height={240}
                  wrap
                  hang={stampWidth(body ?? '') || 2}
                  tone={isError(body) ? 'error' : 'normal'}
                >
                  <LogText text={body ?? ''} />
                </Raw>
              </div>
            </>
          )}
        </div>
        {confirmation}
      </div>
    )
  }

  const total = summariseFiles(files).total

  return (
    <div className={styles.wrap}>
      <SectionHeader
        section="Logs"
        title="View Logs"
        tabs={tabs}
        titleAction={
          <RowAction icon="refresh" name="Refresh" disabled={loadingList} onClick={() => void load()} />
        }
        actions={
          <>
            {/*
            Two destructive verbs asking for permissions from DIFFERENT SECTIONS,
            and one condition that is not a permission.

            `Delete All Logs` only exists when there are files (`logs.js:121`);
            that is its object not being there, not a missing permission, so there
            it does disappear: "disabled, never hidden" is about who you are, not
            about whether there is anything to delete. `Delete All Stats` is
            offered ALWAYS (`logs.js:117`).

            And the stats one asks for `Dashboard.canDelete`, from another screen:
            it deletes the Dashboard's statistics, not the logs.
            */}
            {files.length > 0 && (
              <PermissionButton
                lead="trash"
                variant="danger"
                disabled={busy}
                permission={canDeleteLogs ? undefined : 'Logs.canDelete'}
                onClick={() => setConfirm('allLogs')}
              >
                Delete All Logs
              </PermissionButton>
            )}
            <PermissionButton
              lead="trash"
              variant="danger"
              disabled={busy}
              permission={canDeleteStats ? undefined : 'Dashboard.canDelete'}
              onClick={() => setConfirm('allStats')}
            >
              Delete All Stats
            </PermissionButton>
          </>
        }
      />

      {notifier}

      {!failed && <LogFilesSummary files={files} onOpen={(n) => void view(n)} />}

      <DataTable
        foot={
          <DataFoot
            count={failed ? null : files.length === 1 ? '1 log file' : `${files.length} log files`}
          />
        }
      >
        <Table
          stack
          isEmpty={files.length === 0}
          emptyText={failed ? 'Unable to load the log files.' : 'No Log File Was Found'}
          columns={2}
          header={
            <>
              <th>Log File</th>
              <th className={styles.sizeHead}>Size</th>
            </>
          }
        >
          {files.map((f) => {
            const share = shareOf(f, total)
            return (
              <tr key={f.fileName}>
                <td className={tbl.lead}>
                  <button type="button" className={styles.fileName} onClick={() => void view(f.fileName)}>
                    <Icon name="file" size={15} />
                    <span>{f.fileName}</span>
                    <Icon name="chevronRight" size={12} className={styles.fileGo} />
                  </button>
                </td>
                <td className={styles.sizeCell}>
                  <span className={styles.sizeText}>{f.size}</span>
                  {share != null && (
                    <span className={styles.sizeBar} aria-hidden="true">
                      <span style={{ '--share': share } as CSSProperties} />
                    </span>
                  )}
                </td>
              </tr>
            )
          })}
        </Table>
      </DataTable>

      {confirmation}
    </div>
  )
}
