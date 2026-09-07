import type { ComponentProps, ReactNode } from 'react'
import { Button } from './Button'
import { Icon } from './Icon'
import { Tooltip } from './Tooltip'

/*
A button the permission switches off — **and that does not disappear**.

It is rule 2 of phase 1, verbatim: *disabled, never hidden*. "A control that
disappears depending on who is looking makes the screen change shape and leaves
nobody aware that the action exists." And `Settings` did exactly the opposite:
without permission, `Save Settings`, `Flush Cache` and the two backup ones **were
not drawn**, so the bar had a different number of buttons depending on who looked
and nobody could tell a permission was missing.

The three pieces:

  · it is still **there**, switched off;
  · it carries a **padlock**, which is the word from the vocabulary: *padlock =
    you cannot*, and it is the opposite of the amber, which says you can;
  · and it **says WHICH** permission is missing, in a tooltip. A padlock that does
    not name the permission leaves the administrator guessing what to ask for.

`permission` is the server's string verbatim —`Settings.canModify`,
`Cache.canDelete`— and it is drawn as pilot 3 wrote it: `Requires Cache: Delete`.
It is neither translated nor reworded: it is what has to be asked for.

## Why the tooltip opens over a disabled button

A `<button disabled>` receives neither pointer nor focus events in any browser, so
a tooltip hanging off it would never open. It works here because `ui/Tooltip`
**already wraps its child in a `<span>` of its own** and hangs
`onMouseEnter`/`onFocus` off that: the trigger is that wrapper and the button
inside stays disabled. Checked in the browser on 2026-09-03 with a user with no
permissions — `Requires Settings: Modify` and `Requires Cache: Delete` appear on
hover.

There used to be one more `<span>` here, put in "so the tooltip had something
alive to wrap", and it was redundant: a negative test that stayed green after
removing it gave it away. A wrapper that can be removed without breaking anything
was holding nothing up.
*/
export function PermissionButton({
  permiso,
  children,
  ...rest
}: {
  /** The server's `Section.action`, or `undefined` when the permission is granted. */
  permiso?: string
  children: ReactNode
} & Omit<ComponentProps<typeof Button>, 'children'>) {
  if (permiso == null) {
    return <Button {...rest}>{children}</Button>
  }

  const [seccion, accion] = permiso.split('.')
  const verbo = (accion ?? '').replace(/^can/, '')
  return (
    <Tooltip text={`Requires ${seccion}: ${verbo}`}>
      <Button {...rest} disabled>
        <Icon name="lock" size={13} />
        {children}
      </Button>
    </Tooltip>
  )
}
