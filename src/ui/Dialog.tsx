import * as RadixDialog from '@radix-ui/react-dialog'
import { createContext, type ReactNode } from 'react'
import { Button } from './Button'
import { Icon } from './Icon'
import styles from './Dialog.module.css'

/*
The footer is NOT free text. When it was, 23 modals put the action first and 17
put it last, and in five of them the action was destructive: `Delete` and `Close`
swapped places between two dialogs on the same screen.

Here the order belongs to the component, not to whoever uses it:

    [ actions … ] [ Close ]

`actions` are the buttons that DO something; the dismiss one is painted by
`Dialog` and always goes last, in the corner upstream had it in all 40 of its
modals. That way no new modal can pick its own order again.
*/

/*
Enter submits, as it does in the stock console, where every modal is a `<form>` and
its primary button is `type="submit"` (index.html, e.g. Add Zone at 3929 and 4232).
Here too the dialog is one form, and the button that upstream submits with says
`type="submit"`; every other `Button` is `type="button"` by default. So Enter in a
text field presses that button, and only it: its own `onClick` runs, with its
validation and its busy state, and the browser does the rest. A textarea keeps
Enter for a new line, and a disabled primary (busy, or nothing to send) means Enter
does nothing. A destructive confirmation has no submit, so an Enter meant for
something else never deletes: `ui/Confirm`, and the dialogs whose only action
removes something (the cluster's Remove, Promote, Leave and Delete, Unsign Zone,
Remove Lease). Upstream marks five of those `submit` (all but Remove Lease, which
is a plain button there too); they have no text field, only checkboxes, so there
is no Enter in a field to keep. That is deviation 49 in CONVENTIONS.md.

The form only lends its Enter: its own submission is always cancelled, and stopped
there, because React carries a portal's events to the components it was drawn from,
and a dialog opened from a form would otherwise submit that one too. It does not
validate either (`noValidate`): the checks and their texts are upstream's, in the
screens. `display: contents` keeps it out of the layout. A dialog's body therefore
holds no `<form>` of its own.
*/

/** True inside a dialog: a `Notifier` there stays in the dialog, beside what it is about. */
export const InDialog = createContext(false)

export function Dialog({
  open,
  onOpenChange,
  title,
  children,
  actions,
  close = 'Close',
  size = 'form',
  lead,
  plain = false,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  children: ReactNode
  /** The buttons that do something. The dismiss one is not passed: Dialog adds it. */
  actions?: ReactNode
  /** Label for the dismiss button. `Cancel` when the modal is a question. */
  close?: string
  /**
   * The size, decided by the CONTENT and not by taste:
   *
   * · `compact`: a question and two buttons. The longest confirmation literal
   *   in the console measures 405 px in the real typeface, so at 440 they all fit
   *   on one line. Upstream does not have this size because its confirmations are
   *   the browser's `confirm()`.
   * · `form`: fields with their labels. The ones upstream leaves at 600.
   * · `medium`: long forms and narrow tables. Upstream's 750-800.
   * · `wide`: real tables. Upstream's 940.
   *
   * The steps are upstream's, which did decide modal by modal; the figures are
   * lower because our typography runs tighter.
   */
  size?: 'compact' | 'form' | 'medium' | 'wide'
  /** A glyph before the title: a confirmation's tone. Decorative, so hidden from
   *  assistive technology; the title and the verb carry the meaning. */
  lead?: ReactNode
  /** One surface with no hairlines: the title, the body and the actions flow as
   *  one block. For a question in a few lines (`ui/Confirm`), where two rules
   *  would cut it into three boxes. */
  plain?: boolean
}) {
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className={styles.overlay} />
        <RadixDialog.Content
          className={`${styles.content} ${styles[size]}${plain ? ` ${styles.plain}` : ''}`}
          data-size={size}
        >
          <form
            className={styles.shell}
            noValidate
            onSubmit={(e) => {
              e.preventDefault()
              e.stopPropagation()
            }}
          >
          <div className={styles.head}>
            {lead ? (
              <div className={styles.heading}>
                <span className={styles.lead} aria-hidden="true">{lead}</span>
                <RadixDialog.Title className={styles.title}>{title}</RadixDialog.Title>
              </div>
            ) : (
              <RadixDialog.Title className={styles.title}>{title}</RadixDialog.Title>
            )}
            <RadixDialog.Close className={styles.close} aria-label="Close">
              <Icon name="close" size={16} />
            </RadixDialog.Close>
          </div>
          <div className={styles.body}><InDialog.Provider value={true}>{children}</InDialog.Provider></div>
          <div className={styles.foot}>
            {actions}
            <Button onClick={() => onOpenChange(false)}>{close}</Button>
          </div>
          </form>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  )
}
