import type { ButtonHTMLAttributes, Ref } from 'react'
import styles from './Button.module.css'
import { Icon, type IconName } from './Icon'

export type ButtonVariant = 'primary' | 'secondary' | 'danger'

/*
`size="sm"` is the button for a table row. It existed as `.ib` copied across three
modules and did not exist in DHCP, which used the large button: the same action
("Edit") looked different depending on which screen you were on.

`type` is `button` unless it is said otherwise. HTML's own default is `submit`, and
every dialog is a form (`ui/Dialog`): a button there without a type would be the one
Enter presses. The action Enter runs says so with `type="submit"`, as upstream's do.
*/
export function Button({
  type = 'button',
  variant = 'secondary',
  size = 'md',
  icon = false,
  lead,
  className,
  ref,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
  size?: 'md' | 'sm'
  /** No label: an icon only. The width comes from the icon, not from text. */
  icon?: boolean
  /** An icon before the label. Decorative: the label is still the button's name. */
  lead?: IconName
  ref?: Ref<HTMLButtonElement>
}) {
  return (
    <button
      ref={ref}
      // Spelled out so the lint rule `react/button-has-type` can read every value.
      type={type === 'submit' ? 'submit' : type === 'reset' ? 'reset' : 'button'}
      data-variant={variant}
      data-icon={icon || undefined}
      className={[styles.btn, size === 'sm' && styles.sm, variant !== 'secondary' && styles[variant], className]
        .filter(Boolean)
        .join(' ')}
      {...rest}
    >
      {lead && (
        <span className={styles.lead}>
          <Icon name={lead} size={15} />
        </span>
      )}
      {children}
    </button>
  )
}
