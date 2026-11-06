import { useState, type ChangeEvent, type Ref } from 'react'
import { Icon } from './Icon'
import styles from './FilePick.module.css'

/*
A file field drawn as a drop zone (2026-11-06). The browser's own file input
("Choose File / No file chosen") was the one control in the console still drawn
by the browser, in its font and its grey button, in five dialogs.

It IS the browser's file input: the real `<input type="file">` covers the whole
zone, transparent, so a click anywhere opens the picker, a file dropped on it is
taken by the browser exactly as before, the keyboard reaches it with Tab and
opens it with Enter or Space, and `ref.current.files` and `onChange` are what
the dialogs already read. What the zone adds is only drawing: the invitation
while it is empty, and the chosen file's name and size once there is one.
*/
export function FilePick({
  id,
  accept,
  ref,
  onChange,
  disabled,
}: {
  id: string
  accept?: string
  ref?: Ref<HTMLInputElement>
  onChange?: (e: ChangeEvent<HTMLInputElement>) => void
  disabled?: boolean
}) {
  const [file, setFile] = useState<File | null>(null)
  const [over, setOver] = useState(false)

  return (
    <div className={styles.zone} data-over={over || undefined} data-chosen={file != null || undefined}>
      <input
        id={id}
        ref={ref}
        type="file"
        accept={accept}
        disabled={disabled}
        className={styles.input}
        onChange={(e) => {
          setFile(e.target.files?.[0] ?? null)
          onChange?.(e)
        }}
        onDragEnter={() => setOver(true)}
        onDragLeave={() => setOver(false)}
        onDrop={() => setOver(false)}
      />
      <span className={styles.icon} aria-hidden="true">
        <Icon name={file == null ? 'upload' : 'save'} size={18} />
      </span>
      {file == null ? (
        <span className={styles.text} aria-hidden="true">
          <span className={styles.main}>Drop a file here or choose one</span>
        </span>
      ) : (
        <span className={styles.text} aria-hidden="true">
          <span className={styles.name}>{file.name}</span>
          <span className={styles.size}>{size(file.size)}</span>
        </span>
      )}
    </div>
  )
}

function size(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}
