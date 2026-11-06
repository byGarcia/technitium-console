import { useEffect, useId, useRef } from 'react'
import { plainClick, toTrail } from '../../app/route'
import { Icon } from '../../ui/Icon'
import { Input } from '../../ui/Field'
import text from '../../ui/text.module.css'
import styles from './Settings.module.css'

/*
Settings' ONE navigation (2026-11-06, CONVENTIONS.md deviation 22).

It replaces two rows that looked alike and were not the same thing: the nine
sub-sections, which change the page, and under General a second row of blocks,
which only scrolled it (`ui/SectionIndex`). Now both are one menu at the left of
the form:

  · the nine sub-sections are what `ui/SubTabs` drew: real links to their routes,
    a plain click intercepted so there is no reload, the current one
    `aria-current="page"`, and the dot and `, unsaved changes` of deviation 3 on a
    pane holding something the save would change;
  · under the current one, its blocks, by their own titles (`BlockAnchors`), as
    in-page links (`#settings-<title>`), the one in view `aria-current="location"`
    (`ui/useSectionInView`). A pane with fewer than two titled blocks lists none: one
    entry is not an index;
  · at its top, Search settings (`search.ts`): while it holds words, every
    sub-section with something it finds carries how many, so a match in another
    pane is one click away, and the blocks listed are the ones still in view.

On a screen narrower than the menu and a readable form (the CSS decides, by the
screen's own width), the menu folds into a bar at the top: the current sub-section
as a button that opens the same list, and the search beside it.
*/
export function SettingsMenu({
  tabs,
  active,
  onChoose,
  marks,
  counts,
  blocks,
  here,
  query,
  onQuery,
  open,
  onOpen,
}: {
  tabs: readonly string[]
  active: string
  onChoose: (tab: string) => void
  /** A sub-section's mark: the words a screen reader hears after its name. */
  marks: Partial<Record<string, string>>
  /** While searching, how many units each sub-section has that match; otherwise null. */
  counts: Partial<Record<string, number>> | null
  /** The current sub-section's titled blocks, in page order. */
  blocks: { id: string; label: string }[]
  /** The block in view. */
  here?: string
  query: string
  onQuery: (q: string) => void
  /** Narrow screens only: whether the folded list is open. */
  open: boolean
  onOpen: (open: boolean) => void
}) {
  const listId = useId()
  const searchId = useId()
  const root = useRef<HTMLDivElement>(null)
  const current = blocks.find((b) => b.id === here)

  /* Folded and open, Escape and a click elsewhere close it, as a menu does. */
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onOpen(false)
    const onDown = (e: PointerEvent) => {
      if (root.current != null && !root.current.contains(e.target as Node)) onOpen(false)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onDown)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onDown)
    }
  }, [open, onOpen])

  return (
    <div ref={root} className={styles.menu} data-open={open ? '' : undefined}>
      <div className={styles.menuTop}>
        <button
          type="button"
          className={styles.toggle}
          aria-expanded={open}
          aria-controls={listId}
          onClick={() => onOpen(!open)}
        >
          <span className={styles.toggleText}>
            <span className={styles.toggleSection}>{active}</span>
            {current != null && <span className={styles.toggleBlock}>{current.label}</span>}
          </span>
          <Icon name="chevronDown" size={14} />
        </button>
        <div className={styles.search}>
          <label htmlFor={searchId} className={text.sr}>
            Search settings
          </label>
          <Input
            id={searchId}
            type="search"
            search
            placeholder="Search settings"
            autoComplete="off"
            spellCheck={false}
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape' && query !== '') {
                e.preventDefault()
                onQuery('')
              }
            }}
          />
        </div>
      </div>

      <nav id={listId} className={styles.nav} aria-label="Settings sections">
        <ul className={styles.tabs}>
          {tabs.map((t) => {
            const n = counts?.[t] ?? 0
            return (
              <li key={t}>
                <a
                  className={styles.tab}
                  href={toTrail({ section: 'settings', sub: t })}
                  aria-current={t === active ? 'page' : undefined}
                  data-none={counts != null && n === 0 ? '' : undefined}
                  onClick={(e) => {
                    if (!plainClick(e)) return
                    e.preventDefault()
                    onOpen(false)
                    onChoose(t)
                  }}
                >
                  <span className={styles.tabName}>
                    {t}
                    {marks[t] != null && (
                      <>
                        <span className={text.sr}>, {marks[t]}</span>
                        <span className={styles.mark} aria-hidden="true" />
                      </>
                    )}
                  </span>
                  {counts != null && n > 0 && (
                    <span className={styles.found}>
                      <span className={text.sr}>, </span>
                      {n}
                      <span className={text.sr}> {n === 1 ? 'match' : 'matches'}</span>
                    </span>
                  )}
                </a>
                {t === active && blocks.length > 1 && (
                  <ul className={styles.blocks}>
                    {blocks.map((b) => (
                      <li key={b.id}>
                        <a
                          className={styles.block}
                          href={`#${b.id}`}
                          aria-current={b.id === here ? 'location' : undefined}
                          onClick={() => onOpen(false)}
                        >
                          {b.label}
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            )
          })}
        </ul>
      </nav>
    </div>
  )
}
