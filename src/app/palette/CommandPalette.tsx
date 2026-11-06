import * as RadixDialog from '@radix-ui/react-dialog'
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { Icon } from '../../ui/Icon'
import text from '../../ui/text.module.css'
import { rank, readRecent, remember, type Group, type PaletteItem } from './items'
import styles from './CommandPalette.module.css'

/*
The command palette (OURS, CONVENTIONS.md deviation 26): Ctrl+K (⌘K on a Mac), or
the search field at the top of the sidebar, opens one field that goes anywhere the
console goes. It lists the recent entries while empty; typing narrows every page,
zone and account step, and offers the steps that take what was typed (resolve it,
check it, find it in the logs, the cache, the rules or the settings).

It is a combobox over a listbox: the focus stays in the field, the arrows move the
active option (`aria-activedescendant`), Enter runs it, Escape closes. It runs
nothing itself: it hands the entry to `onRun`, the Shell, which navigates or opens
the dialog as the sidebar and the account menu do.

Its words, all OURS: `Search or jump to…`, `Search`, the group names (`Recent`,
`Actions`, `Pages`, `Zones`, `Account`), `No matches for "<q>".`, and the keys line.
*/
export function CommandPalette({
  open,
  onOpenChange,
  items,
  onRun,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Pages, zones and account entries; `Actions` are built from the query. */
  items: (query: string) => PaletteItem[]
  onRun: (item: PaletteItem) => void
}) {
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const listId = useId()
  const list = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open) {
      setQuery('')
      setActive(0)
    }
  }, [open])

  const shown = useMemo(() => {
    if (!open) return []
    const q = query.trim()
    if (q === '') return [...readRecent(), ...rank(items(''), '').filter((i) => i.group === 'Pages').slice(0, 6)]
    return rank(items(q), q)
  }, [open, query, items])

  useEffect(() => setActive(0), [query])
  useEffect(() => {
    const el = list.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)
    /* jsdom has no layout, and no `scrollIntoView`. */
    if (el != null && typeof el.scrollIntoView === 'function') el.scrollIntoView({ block: 'nearest' })
  }, [active])

  function run(item: PaletteItem | undefined) {
    if (item == null) return
    remember(item)
    onOpenChange(false)
    onRun(item)
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((a) => (shown.length === 0 ? 0 : (a + 1) % shown.length))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((a) => (shown.length === 0 ? 0 : (a - 1 + shown.length) % shown.length))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      run(shown[active])
    }
  }

  let lastGroup: Group | null = null
  const optionId = (i: number) => `${listId}-o${i}`

  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className={styles.overlay} />
        <RadixDialog.Content className={styles.palette} aria-describedby={undefined}>
          <RadixDialog.Title className={text.sr}>Search</RadixDialog.Title>
          <div className={styles.field}>
            <Icon name="search" size={18} />
            <input
              className={styles.input}
              autoFocus
              role="combobox"
              aria-expanded="true"
              aria-controls={listId}
              aria-autocomplete="list"
              aria-activedescendant={shown.length > 0 ? optionId(active) : undefined}
              aria-label="Search"
              placeholder="Search or jump to…"
              spellCheck={false}
              autoComplete="off"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onKeyDown}
            />
            <kbd className={styles.esc}>Esc</kbd>
          </div>
          <div className={styles.list} id={listId} role="listbox" aria-label="Results" ref={list}>
            {shown.length === 0 && query.trim() !== '' && (
              <p className={styles.none}>No matches for &ldquo;{query.trim()}&rdquo;.</p>
            )}
            {shown.map((item, i) => {
              const heading = item.group !== lastGroup ? item.group : null
              lastGroup = item.group
              return (
                <div key={`${item.group}/${item.id}`} role="presentation">
                  {heading != null && (
                    <div className={styles.group} role="presentation">
                      {heading}
                    </div>
                  )}
                  <div
                    id={optionId(i)}
                    data-index={i}
                    role="option"
                    aria-selected={i === active}
                    className={styles.option}
                    onMouseMove={() => setActive(i)}
                    onClick={() => run(item)}
                  >
                    <span className={styles.ico} aria-hidden="true">
                      <Icon name={item.icon} size={16} />
                    </span>
                    <span className={styles.label}>{item.label}</span>
                    {item.hint != null && <span className={styles.hint}>{item.hint}</span>}
                    <span className={styles.enter} aria-hidden="true">
                      <Icon name="chevronRight" size={14} />
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
          <div className={styles.keys} aria-hidden="true">
            <span><kbd>↑</kbd><kbd>↓</kbd> to move</span>
            <span><kbd>Enter</kbd> to open</span>
            <span><kbd>Esc</kbd> to close</span>
          </div>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  )
}

/** Ctrl+K, or ⌘K on a Mac: the palette's shortcut, shown where it is offered. */
export const PALETTE_KEYS =
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘K' : 'Ctrl K'
