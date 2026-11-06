import type { LogFile } from '../../api/logs'
import { Card, Count, statStyles } from '../../ui/StatCard'
import { Icon } from '../../ui/Icon'
import { formatBytes, summariseFiles } from './log-files'
import styles from './Logs.module.css'

/*
THE SERVER'S LOG FOLDER AT A GLANCE (deviation 20 in CONVENTIONS.md, 2026-11-06):
up to four cards over the file list, read from the `logs/list` answer already on
screen (`log-files.ts`). No call is added.

  · Log Files   how many there are.
  · Total Size  the sum of the sizes the server writes for them, and the largest.
  · Newest      the latest day, which opens its file, as its row does.
  · Oldest      the earliest day, the same.

`Log Files` and `Total Size` are always drawn, so an empty folder says 0 and 0 B;
`Newest` and `Oldest` only when a file is named by its day, which is how the
server names them (a name that is not a day is listed, never ranked). Nothing is
drawn when the list failed: the cards would count a list nobody read.

Every word here is OURS and part of deviation 20: the four titles, `Largest` and
the `to` of the span the files cover.
*/

function Day({ file, onOpen }: { file: LogFile; onOpen: (name: string) => void }) {
  return (
    <div className={`${statStyles.body} ${styles.day}`}>
      <button type="button" className={styles.dayPick} onClick={() => onOpen(file.fileName)}>
        <Icon name="file" size={15} />
        <span className={styles.dayName}>{file.fileName}</span>
        <Icon name="chevronRight" size={12} />
      </button>
      <span className={statStyles.caption}>{file.size}</span>
    </div>
  )
}

export function LogFilesSummary({ files, onOpen }: { files: LogFile[]; onOpen: (name: string) => void }) {
  const s = summariseFiles(files)
  return (
    <div className={statStyles.grid}>
      <Card title="Log Files" colour="var(--ch-total)">
        <div className={statStyles.body}>
          <div className={statStyles.figure}>
            <Count value={s.count} />
          </div>
          {s.oldest != null && s.newest != null && s.oldest !== s.newest && (
            <div className={statStyles.caption}>
              {s.oldest.fileName} to {s.newest.fileName}
            </div>
          )}
        </div>
      </Card>
      <Card title="Total Size" colour="var(--ch-3)">
        <div className={statStyles.body}>
          <div className={statStyles.figure}>{s.total != null ? formatBytes(s.total) : '—'}</div>
          {s.largest != null && files.length > 1 && (
            <dl className={statStyles.facts}>
              <div>
                <dt>Largest</dt>
                <dd>
                  <span className={styles.mono}>{s.largest.fileName}</span>{' '}
                  <span className={styles.share}>{s.largest.size}</span>
                </dd>
              </div>
            </dl>
          )}
        </div>
      </Card>
      {s.newest != null && (
        <Card title="Newest" colour="var(--ch-2)">
          <Day file={s.newest} onOpen={onOpen} />
        </Card>
      )}
      {s.oldest != null && s.oldest !== s.newest && (
        <Card title="Oldest" colour="var(--ch-drop)">
          <Day file={s.oldest} onOpen={onOpen} />
        </Card>
      )}
    </div>
  )
}
