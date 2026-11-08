import type { Problem } from './validate'
import styles from './FieldProblems.module.css'

/*
The contract between a control of this screen and what the checks say about it:
the control is `ab-<target>-<field>`, its messages sit directly under it in
`ab-<target>-<field>-error`, `aria-describedby` ties the two and `aria-invalid`
marks an error. The Save bar moves the focus by that id.

An error waits for `showProblems` (the first Save). A warning does not: it is about
a value that was already there and that nothing obliges anyone to change.

No words of its own: the messages are the checks'.
*/

export function problemsAt(problems: Problem[], showProblems: boolean, target: string, field: string): Problem[] {
  return problems.filter((p) => p.target === target && p.field === field && (showProblems || p.severity === 'warning'))
}

/** What the control itself carries, given the messages shown for it. */
export function controlProps(target: string, field: string, shown: Problem[]) {
  const id = `ab-${target}-${field}`
  return {
    id,
    'aria-describedby': shown.length > 0 ? `${id}-error` : undefined,
    'aria-invalid': shown.some((p) => p.severity === 'error') || undefined,
  }
}

export function FieldProblems({ target, field, shown }: { target: string; field: string; shown: Problem[] }) {
  if (shown.length === 0) return null
  return (
    <div id={`ab-${target}-${field}-error`} className={styles.messages}>
      {shown.map((p, i) => (
        <div key={i} className={p.severity === 'error' ? styles.error : styles.warning}>
          {p.message}
        </div>
      ))}
    </div>
  )
}
