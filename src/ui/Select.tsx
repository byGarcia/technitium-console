import {
  Children,
  isValidElement,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type Ref,
} from 'react'
import { Icon } from './Icon'
import styles from './Select.module.css'

/*
The dropdown, built here.

It used to be the operating system's `<select>` with a chevron painted on top:
the closed box almost passed, but on opening it the system list appeared (the
OS's font, size, colours and corners) and the console changed appearance
depending on the machine. And that is why it "looked very much the same": half
the control was not ours.

It is rebuilt as a listbox following the ARIA specification's rules:

  · the trigger is a `combobox`, with `aria-expanded` and `aria-activedescendant`
  · the list is a `listbox` and each line an `option` with `aria-selected`
  · full keyboard: ↑ ↓ Home End, Enter and Space open and choose, Esc closes and
    returns focus, and typing jumps to the option starting with it
  · focus does not move into the list, so the screen reader keeps announcing the
    field and its label

The list is `position: fixed` computed from the trigger, not absolute: otherwise,
inside a modal (which has `overflow: auto`) it would be clipped. For the same
reason it closes on scroll, which is what the native `select` does.

`searchable` is the console's own, and opt-in: only Blocking › Lists turns it on,
for a Quick Add catalogue too long to scroll through. It puts a search field at
the top of the open list. The field takes the focus and is the combobox while the
list is open (`aria-autocomplete="list"`); typing filters the options by their
label, or by the `data-search` text an `<option>` may carry, case-insensitively;
↑ ↓ move through what is left, Enter chooses, Esc closes and returns focus to
the trigger, and Home, End and Space stay with the text, as in any text field.
No match leaves a `noMatchText` line, announced as a status. The list keeps the
width it opened with (and, opened upwards, its height), so filtering does not
move the field. Without `searchable` nothing here changes: same DOM, same keys,
same look.

`<optgroup>` children become a `group` labelled by their `label`, a line that
cannot be chosen, as in the native element. Nothing used them before the Quick
Add of Blocking › Lists, so no other dropdown changes.
*/

export interface Option {
  value: string
  label: string
  disabled?: boolean
  /** The `<optgroup>` it sits in, by its label. */
  group?: string
  /** What a search matches besides the label: the option's `data-search`. */
  search?: string
}

const MAX_HEIGHT = 280
/** What the list keeps clear of the window's edges, the same 8 px as `ui/Menu`. */
const MARGIN = 8
/** The search field's line, added to the list's cap so as many options show. */
const SEARCH_ROOM = 44

/*
The options are read from the `<option>` children, as in the element it replaces.
It could have taken an array and forced a rewrite of the twenty-five places that
use it, but then the change would stop being design-only: each of those places is
a list with its own logic (TSIG keys, catalogs, record types, DNSSEC algorithms),
and rewriting it is an opportunity to break it.
*/
function optionsFromChildren(children: ReactNode, group?: string): Option[] {
  const outside: Option[] = []
  for (const child of Children.toArray(children)) {
    if (!isValidElement(child)) continue
    if (child.type === 'optgroup') {
      const g = child.props as { label?: string; children?: ReactNode }
      outside.push(...optionsFromChildren(g.children, g.label ?? ''))
      continue
    }
    if (child.type !== 'option') continue
    const p = child.props as {
      value?: string | number; children?: ReactNode; disabled?: boolean; 'data-search'?: string
    }
    const text = typeof p.children === 'string' || typeof p.children === 'number' ? String(p.children) : ''
    const o: Option = {
      value: p.value != null ? String(p.value) : text,
      label: text,
      disabled: p.disabled,
    }
    if (group != null) o.group = group
    if (p['data-search'] != null) o.search = p['data-search']
    outside.push(o)
  }
  return outside
}

/** The indices of the options a search shows, in order: all of them for an empty one. */
function visibleFor(options: Option[], query: string): number[] {
  const needle = query.trim().toLowerCase()
  if (needle === '') return options.map((_, i) => i)
  const out: number[] = []
  options.forEach((o, i) => {
    if (o.label.toLowerCase().includes(needle) || (o.search ?? '').toLowerCase().includes(needle)) out.push(i)
  })
  return out
}

export function Select({
  id,
  value,
  children,
  onChange,
  disabled = false,
  placeholder,
  className,
  ref,
  'aria-label': ariaLabel,
  searchable = false,
  searchLabel = 'Search',
  noMatchText = 'No matches',
}: {
  id?: string
  value: string | number
  children?: ReactNode
  /** The same signature as the native element, so existing callers are untouched. */
  onChange?: (e: { target: { value: string } }) => void
  disabled?: boolean
  /** What to show when the value is not among the options. */
  placeholder?: string
  className?: string
  ref?: Ref<HTMLButtonElement>
  'aria-label'?: string
  /** A search field on top of the open list (see the header). Off by default. */
  searchable?: boolean
  /** The search field's accessible name and placeholder. */
  searchLabel?: string
  /** The line shown when the search matches nothing. */
  noMatchText?: string
}) {
  const options = optionsFromChildren(children)
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const [query, setQuery] = useState('')
  /* `fixed` and `tall`: the width a searchable list opened with, and its height when it
     opened upwards, both kept while it is filtered. */
  const [box, setBox] = useState<
    { left: number; top: number; width: number; up: boolean; fixed?: number; tall?: number } | null
  >(null)
  const trigger = useRef<HTMLButtonElement>(null)
  /** The floating box: the listbox itself, or the box holding search and listbox. */
  const list = useRef<HTMLDivElement>(null)
  const search = useRef<HTMLInputElement>(null)
  const keys2 = useRef({ text: '', until: 0 })
  const listId = useId()

  const visible = searchable ? visibleFor(options, query) : options.map((_, i) => i)
  const selectedIndex = options.findIndex((o) => o.value === String(value))
  const chosen = selectedIndex >= 0 ? options[selectedIndex] : undefined
  const activeShown = open && visible.includes(active)

  function openList() {
    if (disabled) return
    setQuery('')
    const all = options.map((_, i) => i)
    setActive(selectedIndex >= 0 ? selectedIndex : firstUsable(options, all, 0, 1))
    setOpen(true)
  }

  function close(returnFocus = true) {
    setOpen(false)
    if (returnFocus) trigger.current?.focus()
  }

  function choose(i: number) {
    const o = options[i]
    if (o == null || o.disabled || !visible.includes(i)) return
    onChange?.({ target: { value: o.value } })
    close()
  }

  // The box is measured right before painting, so it does not visibly jump.
  useLayoutEffect(() => {
    if (!open) { setBox(null); return }
    const r = trigger.current?.getBoundingClientRect()
    if (r == null) return
    const below = window.innerHeight - r.bottom
    const room = searchable ? SEARCH_ROOM : 0
    const up = below < Math.min(MAX_HEIGHT, options.length * 30 + 8) + room && r.top > below
    setBox({ left: r.left, top: up ? r.top : r.bottom, width: r.width, up })
  }, [open, options.length, searchable])

  /*
  The list is at least as wide as its trigger and grows to its longest option, up
  to the window. It used to be exactly the trigger's width, so a narrow trigger
  cut its options to a letter and scrolled them sideways (Blocking › Lists, Quick
  Add, "Steven Black [adware + malware]" as "Ste"). Grown, it may cross the
  window's right edge: it is pulled back left, before painting, as far as needed.
  */
  useLayoutEffect(() => {
    const el = list.current
    if (box == null || el == null) return
    const room = window.innerWidth - MARGIN
    const fixed = searchable ? (box.fixed ?? el.offsetWidth) : undefined
    /* Opened upwards, the list hangs from the trigger by its bottom edge: shrinking as
       it filters, it would drag the field being typed in down with it. */
    const tall = searchable && box.up ? (box.tall ?? el.offsetHeight) : undefined
    const right = box.left + el.offsetWidth
    const left = right <= room ? box.left : Math.max(MARGIN, room - el.offsetWidth)
    if (left !== box.left || fixed !== box.fixed || tall !== box.tall) setBox({ ...box, left, fixed, tall })
  }, [box, searchable])

  /* A searchable list hands the focus to its field as soon as it is drawn. Without
     scrolling: a scroll would close it. */
  const drawn = open && box != null
  useEffect(() => {
    if (searchable && drawn) search.current?.focus({ preventScroll: true })
  }, [searchable, drawn])

  useEffect(() => {
    if (!open) return
    const outside = (e: MouseEvent) => {
      const t = e.target as Node
      if (!trigger.current?.contains(t) && !list.current?.contains(t)) setOpen(false)
    }
    /* Scrolling the page closes it, scrolling the list itself does not: with more
       options than its height cap, the wheel and the arrow keys (through
       `scrollIntoView`) scroll the list, and they closed it, so an option below
       the eighth was out of reach. The same guard as `ui/Menu`, and for the same
       reason: `resize` shares the handler and its `target` is `window`, not a node. */
    const onScroll = (e: Event) => {
      if (e.target instanceof Node && list.current?.contains(e.target)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', outside)
    // `true` so it also hears a container's scroll, not only the page's:
    // inside a modal the thing that scrolls is the modal.
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onScroll)
    return () => {
      document.removeEventListener('mousedown', outside)
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onScroll)
    }
  }, [open])

  // The selected option is kept in view when moving with the keyboard.
  useEffect(() => {
    if (!open) return
    const checked = list.current?.querySelector('[data-active="true"]')
    // `scrollIntoView` does not exist in jsdom, and nothing breaks without it.
    checked?.scrollIntoView?.({ block: 'nearest' })
  }, [open, active])

  function onKeyDown(e: React.KeyboardEvent) {
    if (disabled) return

    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        openList()
      }
      return
    }

    switch (e.key) {
      case 'Escape':
        e.preventDefault()
        close()
        return
      case 'Tab':
        setOpen(false)
        return
      case 'Enter':
      case ' ':
        e.preventDefault()
        choose(active)
        return
      case 'ArrowDown':
        e.preventDefault()
        setActive((i) => step(options, visible, i, 1))
        return
      case 'ArrowUp':
        e.preventDefault()
        setActive((i) => step(options, visible, i, -1))
        return
      case 'Home':
        e.preventDefault()
        setActive(firstUsable(options, visible, 0, 1))
        return
      case 'End':
        e.preventDefault()
        setActive(firstUsable(options, visible, visible.length - 1, -1))
        return
      default:
        break
    }

    // Typing jumps to the option starting with what was typed, like the native one.
    if (e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) {
      const now = Date.now()
      keys2.current.text = now > keys2.current.until ? e.key : keys2.current.text + e.key
      keys2.current.until = now + 600
      const wanted = keys2.current.text.toLowerCase()
      const i = options.findIndex((o) => !o.disabled && o.label.toLowerCase().startsWith(wanted))
      if (i >= 0) setActive(i)
    }
  }

  /* The search field's keys: the list's, minus the ones a text field keeps (Home,
     End, Space and the letters, which are the search). */
  function onSearchKeyDown(e: React.KeyboardEvent) {
    switch (e.key) {
      case 'Escape':
        e.preventDefault()
        close()
        return
      case 'Tab':
        setOpen(false)
        return
      case 'Enter':
        e.preventDefault()
        if (activeShown) choose(active)
        return
      case 'ArrowDown':
        e.preventDefault()
        setActive((i) => step(options, visible, i, 1))
        return
      case 'ArrowUp':
        e.preventDefault()
        setActive((i) => step(options, visible, i, -1))
        return
      default:
        break
    }
  }

  function onSearch(text: string) {
    setQuery(text)
    const shown = visibleFor(options, text)
    const first = firstUsable(options, shown, 0, 1, -1)
    setActive(first)
  }

  /* Consecutive options of one `<optgroup>` are drawn inside one group. */
  const runs: { group?: string; items: number[] }[] = []
  for (const i of visible) {
    const g = options[i].group
    const last = runs[runs.length - 1]
    if (last != null && last.group === g) last.items.push(i)
    else runs.push({ group: g, items: [i] })
  }

  const option = (i: number) => {
    const o = options[i]
    return (
      <div
        key={o.value}
        id={`${listId}-${i}`}
        role="option"
        aria-selected={o.value === String(value)}
        aria-disabled={o.disabled}
        data-active={i === active}
        className={styles.option}
        onMouseEnter={() => !o.disabled && setActive(i)}
        onClick={() => choose(i)}
      >
        <span className={styles.brand}>
          {o.value === String(value) && <Icon name="check" size={13} />}
        </span>
        {o.label === '' ? <span className={styles.isEmpty}>—</span> : o.label}
      </div>
    )
  }

  const lines = runs.flatMap((run, n) =>
    run.group == null
      ? run.items.map(option)
      : [
          /* The label sits beside the group and names it, not inside it: a group
             holds options only. */
          <div key={`group-${n}`} role="presentation">
            <div id={`${listId}-g${n}`} role="presentation" className={styles.groupLabel}>
              {run.group}
            </div>
            <div role="group" aria-labelledby={`${listId}-g${n}`}>
              {run.items.map(option)}
            </div>
          </div>,
        ],
  )

  const place = box && {
    left: box.left,
    minWidth: box.width,
    maxWidth: window.innerWidth - 2 * MARGIN,
    ...(box.fixed != null ? { width: box.fixed } : {}),
    ...(box.tall != null ? { height: box.tall } : {}),
    maxHeight: MAX_HEIGHT + (searchable ? SEARCH_ROOM : 0),
    ...(box.up
      ? { bottom: window.innerHeight - box.top + 4 }
      : { top: box.top + 4 }),
  }

  return (
    <>
      <button
        type="button"
        id={id}
        ref={merge(trigger, ref)}
        role="combobox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={open && !searchable ? `${listId}-${active}` : undefined}
        aria-label={ariaLabel}
        disabled={disabled}
        className={[styles.trigger, className].filter(Boolean).join(' ')}
        onClick={() => (open ? close(false) : openList())}
        onKeyDown={onKeyDown}
      >
        {/*
        An option with no label (a filter's "any") is drawn with a dash, just as
        it is inside the list. Completely empty, the control reads as a broken box
        rather than as "nothing is selected".
        */}
        <span className={chosen?.label ? styles.value : styles.emptyText}>
          {chosen?.label || placeholder || '—'}
        </span>
        <Icon name="chevronDown" size={14} className={styles.chevron} />
      </button>

      {open && place && (searchable ? (
        <div ref={list} className={`${styles.list} ${styles.searching}`} style={place}>
          <input
            ref={search}
            type="text"
            role="combobox"
            aria-expanded="true"
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={activeShown ? `${listId}-${active}` : undefined}
            aria-label={searchLabel}
            placeholder={searchLabel}
            autoComplete="off"
            spellCheck={false}
            className={styles.search}
            value={query}
            onChange={(e) => onSearch(e.target.value)}
            onKeyDown={onSearchKeyDown}
          />
          <div id={listId} role="listbox" aria-label={ariaLabel} className={styles.scroll}>
            {lines}
          </div>
          <div role="status" className={visible.length === 0 ? styles.none : undefined}>
            {visible.length === 0 ? noMatchText : ''}
          </div>
        </div>
      ) : (
        <div
          ref={list}
          id={listId}
          role="listbox"
          className={styles.list}
          style={place}
        >
          {lines}
        </div>
      ))}
    </>
  )
}

/*
Moving is over the options shown (`shown`, indices into `options`): all of them
unless a search is filtering. `from` and the result are positions in `shown`
turned back into indices.
*/

/** The first usable option from position `from` in that direction; if there is
 *  none, `fallback` (by default the option at `from`). */
function firstUsable(options: Option[], shown: number[], from: number, dir: number, fallback?: number): number {
  for (let p = from; p >= 0 && p < shown.length; p += dir) {
    if (!options[shown[p]].disabled) return shown[p]
  }
  return fallback ?? shown[from] ?? -1
}

/** The next usable option after `current` in that direction; if there is none, it
 *  stays put. From an option not shown, it starts at the first or the last. */
function step(options: Option[], shown: number[], current: number, dir: number): number {
  const p = shown.indexOf(current)
  const from = p < 0 ? (dir > 0 ? 0 : shown.length - 1) : p + dir
  return firstUsable(options, shown, from, dir, p < 0 ? -1 : current)
}

/** Merges the internal ref with whatever the caller may pass. */
function merge(own: React.RefObject<HTMLButtonElement | null>, outside?: Ref<HTMLButtonElement>) {
  return (node: HTMLButtonElement | null) => {
    own.current = node
    if (typeof outside === 'function') outside(node)
    else if (outside != null) (outside as { current: HTMLButtonElement | null }).current = node
  }
}
