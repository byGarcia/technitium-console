import { Fragment } from 'react'
import { FOOTER, getThemeCredit } from '../app/footer'
import { useTheme } from '../theme/useTheme'
import styles from './FooterLinks.module.css'

/**
 * Upstream's footer links, and beneath them the theme credit (the only thing this
 * console adds here). Dynamically attributes custom themes to byVarun and standard themes to byGarcia.
 */
export function FooterLinks({ className }: { className?: string }) {
  const { choice, resolved } = useTheme()
  const credit = getThemeCredit(choice ?? resolved)

  return (
    <div className={[styles.footer, className].filter(Boolean).join(' ')}>
      {FOOTER.map((e, i) => (
        <Fragment key={e.href}>
          {i > 0 && <span className={styles.sep}> | </span>}
          <a href={e.href} aria-label={e.name} target="_blank" rel="noreferrer">
            {e.text}
          </a>
        </Fragment>
      ))}
      <div className={styles.credit}>
        Theme:{' '}
        <a href={credit.href} aria-label={credit.name} target="_blank" rel="noreferrer">
          {credit.text}
        </a>
      </div>
    </div>
  )
}
