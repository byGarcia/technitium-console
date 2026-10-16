import type { ReactNode } from 'react'
import { SectionIndex } from './SectionIndex'
import styles from './IndexedForm.module.css'

/*
A dense form with its section index (`ui/SectionIndex`): beside the form where the
form can spare the width, a strip above it everywhere else. Settings' long panes
and Administration › SSO use it; the decision about widths is in
`IndexedForm.module.css`.

The index is drawn twice and only one is ever shown: the strip and the column are
the same entries and the same `active`, and which one shows is the screen's width,
which only CSS knows without a measuring pass. The hidden one is `display: none`,
so it is out of the accessibility tree too: a reader meets one index, not two.

The structure around `children` never changes with `sections`, so a form that reads
its own sections back from the page (Settings does) is not remounted when they
arrive.
*/
export function IndexedForm({
  sections,
  active,
  children,
}: {
  /** The sections, in page order; with none there is no index and the form keeps its width. */
  sections: { id: string; label: string }[]
  /** The section in view (`ui/useSectionInView`). */
  active?: string
  children: ReactNode
}) {
  const on = sections.length > 0
  return (
    <div className={styles.room}>
      {on && (
        <div className={styles.strip}>
          <SectionIndex sections={sections} active={active} strip />
        </div>
      )}
      <div className={on ? `${styles.form} ${styles.withIndex}` : undefined}>
        <div className={styles.column}>{children}</div>
        {on && (
          <div className={styles.side}>
            <SectionIndex sections={sections} active={active} />
          </div>
        )}
      </div>
    </div>
  )
}
