import { useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import styles from './FoldHelp.module.css'

/*
A form row's help, under its label, folded to one line (2026-11-06, Adrián's
decision for Settings: deviation 22 in CONVENTIONS.md).

The dense form used to give the help a column of its own at the far right, 800 px
from the field it explained, and General's 41 paragraphs outweighed its fields.
Now the help sits under the label as one muted line, and a paragraph longer than
that line is cut at its end with a `more` button that unfolds it (and `less` that
folds it back). One line and not two: measured at 1440 on 2026-11-06, two lines
left General LONGER than the three columns it replaced (5,983 px against 5,476),
because nearly every row then grew to the height of its label and two lines of
help, twice a field's.

Nothing is summarised and nothing is removed:

  · the whole text is ALWAYS in the document: the fold is a visual clamp
    (`line-clamp`), so a screen reader and a find-in-page read every word;
  · the button appears only when the clamp really cut something, measured on the
    laid-out paragraph, and again whenever the paragraph's width changes;
  · while a search is narrowing the form (`data-searching` on an ancestor, see
    `screens/settings/search.ts`) every help is unfolded, because the words that
    matched may be the ones past the first line.
*/
export function FoldHelp({ className, children }: { className?: string; children: ReactNode }) {
  const id = useId()
  const box = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [cut, setCut] = useState(false)

  useLayoutEffect(() => {
    const el = box.current
    if (el == null || open) return
    const measure = () => setCut(el.scrollHeight > el.clientHeight + 1)
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const watch = new ResizeObserver(measure)
    watch.observe(el)
    return () => watch.disconnect()
  }, [open])

  return (
    <div className={[styles.fold, className].filter(Boolean).join(' ')}>
      <div ref={box} id={id} className={open ? undefined : styles.folded}>
        {children}
      </div>
      {(cut || open) && (
        <button
          type="button"
          className={styles.more}
          aria-expanded={open}
          aria-controls={id}
          data-search-skip=""
          onClick={() => setOpen((o) => !o)}
        >
          {open ? 'less' : 'more'}
        </button>
      )}
    </div>
  )
}
