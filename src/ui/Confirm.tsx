import { useState, type ReactNode } from 'react'
import { Button } from './Button'
import { Check } from './Check'
import { Dialog } from './Dialog'
import styles from './Confirm.module.css'
import { Icon } from './Icon'
import text from './text.module.css'

/*
The "are you sure?" step.

Upstream solves it with a native `confirm()`; the text and the step are the same,
because you still need to confirm before the request goes out.

It was written six times: once as a component inside Administration (from where
the Dashboard, Zones and the lists screens imported it, none of which have
anything to do with Administration), another as a component inside Settings, and
four times bare with `Dialog` + one button + `close="Cancel"` +
`size="compact"` in Logs, DHCP and again Zones and the lists. Outside one table
(the rules of Blocking › Rules, which offers Undo through `ui/Toast`) this console
has no undo, so the place where six versions are least welcome is precisely this
one.

Of the six, two (Zones and the lists) kept the "busy" flag and the closing INSIDE
the dialog, and the other four asked each call site for them. The first form is
better and no second API is needed to have it: if `onConfirm` returns a promise,
this component disables the button while it runs and closes when it settles.
Whoever already tracks their own state keeps passing `busy`.

It does not cover the "Remove Lease?" dialog, and that is deliberate: that one is
not a one-line confirmation but four paragraphs of warning with its list of
alternatives and its slot for a server alert. That it would fit in `text` does
not make it the same thing.
*/
export function Confirm({
  open,
  title,
  text: body,
  label,
  variant = 'danger',
  busy,
  onClose,
  onConfirm,
}: {
  open: boolean
  title: string
  text: ReactNode
  /** The action's verb: "Delete", "Convert", "Disable". */
  label: string
  variant?: 'primary' | 'danger'
  busy?: boolean
  onClose: () => void
  /** If it returns a promise, the dialog stays busy while it runs and closes when it settles. */
  onConfirm: () => unknown
}) {
  const [inProgress, setInProgress] = useState(false)

  function confirm() {
    const r = onConfirm()
    if (!(r instanceof Promise)) return
    setInProgress(true)
    void r.finally(() => {
      setInProgress(false)
      onClose()
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title={title}
      lead={
        variant === 'danger' ? (
          <span className={styles.danger}>
            <Icon name="warning" size={16} />
          </span>
        ) : undefined
      }
      plain
      actions={
        <Button variant={variant} disabled={busy || inProgress} onClick={confirm}>
          {label}
        </Button>
      }
      close="Cancel"
      size="compact"
    >
      {/*
      Redrawn 2026-11-06: one surface, read top to bottom in one glance. The
      title says what, the name says on what, the sentence says the rest, and
      the verb ends it. A destructive one is told by the red triangle in front
      of the title and the solid red verb (`ui/Button`); there is no badge in the
      body any more, and any other confirmation carries no glyph at all, because
      a question that is not dangerous needs no decoration to be asked. The
      sentence hangs under the title's text, past the triangle, so the left edge
      reads as one column.
      */}
      <div className={styles.question} data-tone={variant}>
        <Sentence body={body} />
      </div>
    </Dialog>
  )
}

/*
The name in the sentence.

Upstream writes the object of the action inside the sentence, between quotes
(`'com'`), brackets (`[testuser]`) or, for a DNSSEC key, parentheses (`(12345)`),
and there it drowns: it is the one word you check before pressing the verb. So it
is drawn in the data face and in ink, with its delimiters kept and quieted.

The characters do not change, but the DOM does (the name becomes an element of
its own), and a split string is no longer one text node: a screen reader could
read it in pieces and `getByText` would stop finding it. So the drawn copy is
hidden from assistive technology and the sentence, whole and untouched, goes
beside it for whoever does not see the screen. Only a plain string is marked; a
sentence that comes as elements is the caller's own drawing and is left alone.

The quote is only taken as one when it opens after a space or the start and
closes before a space, punctuation or the end, so an apostrophe inside a word
never opens a name.
*/
const NAME = /(?<=^|[\s(])'[^'\n]+'(?=$|[\s.,?!:;)])|\[[^\]\n]+\]|\(\d+\)/g

function Sentence({ body }: { body: ReactNode }) {
  if (typeof body !== 'string') return <>{body}</>
  const parts: ReactNode[] = []
  let at = 0
  for (const m of body.matchAll(NAME)) {
    const i = m.index
    if (i > at) parts.push(body.slice(at, i))
    const s = m[0]
    parts.push(
      <span key={i} className={styles.name}>
        <span className={styles.mark}>{s[0]}</span>
        {s.slice(1, -1)}
        <span className={styles.mark}>{s[s.length - 1]}</span>
      </span>,
    )
    at = i + s.length
  }
  if (at === 0) return <>{body}</>
  if (at < body.length) parts.push(body.slice(at))
  return (
    <>
      <span className={text.sr}>{body}</span>
      <span aria-hidden="true">{parts}</span>
    </>
  )
}

/*
The `Force …` box of the four Cluster dialogs, as a block and not as a row.

Why it is not a prop of `Confirm`, which is where the design placed it: none of
the four dialogs that carry one IS a `Confirm`. They keep upstream's `Close`
rather than `Cancel`, they carry two paragraphs instead of one line, and they end
with their own `Note!`. `Confirm`'s own header already says it does not cover that
shape (it says so about "Remove Lease?"), and adding a slot to it that no `Confirm`
would ever use is a prop written for a drawing rather than for a call site.

So the slot is this block, and the four dialogs place it where the design put it:
last among the controls, before the `Note!`.

The reasoning lives in `Confirm.module.css`.
*/
export function ForceBlock({
  label,
  help,
  checked,
  onChange,
}: {
  /** Upstream's literal: "Force Delete Cluster", "Force Remove Node"… */
  label: string
  /** Upstream's help for that box, whole. It is the only sentence the product
   *  writes about forcing, and it is not paraphrased. */
  help: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div className={styles.force} data-armed={checked}>
      <Check label={label} help={help} checked={checked} onChange={onChange} />
    </div>
  )
}
