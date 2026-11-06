import { useRef, type ReactNode, type TextareaHTMLAttributes } from 'react'
import styles from './CodeArea.module.css'

/*
A text field for a file's text: a config, a zone file (2026-11-06). It is the
same `<textarea>` the dialogs had, so what is typed and what is sent are the
same; what it adds is drawing: the line numbers in a gutter that scrolls with
the text, the console's mono face, and a status line under it for whatever the
screen wants to say about the text (`status`).
*/
export function CodeArea({
  value,
  status,
  className,
  ...rest
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { value: string; status?: ReactNode }) {
  const gutter = useRef<HTMLDivElement>(null)
  const lines = Math.max(1, value.split('\n').length)

  return (
    <div className={[styles.frame, className].filter(Boolean).join(' ')}>
      <div className={styles.body}>
        <div ref={gutter} className={styles.gutter} aria-hidden="true">
          {Array.from({ length: lines }, (_, i) => (
            <div key={i}>{i + 1}</div>
          ))}
        </div>
        <textarea
          {...rest}
          value={value}
          spellCheck={false}
          wrap="off"
          className={styles.text}
          onScroll={(e) => {
            if (gutter.current) gutter.current.scrollTop = e.currentTarget.scrollTop
            rest.onScroll?.(e)
          }}
        />
      </div>
      {status != null && <div className={styles.status}>{status}</div>}
    </div>
  )
}
