import styles from './SectionIndex.module.css'

/*
The section index of a long screen.

`Segmented` looks like it and **is not**, and confusing the two is what pilot 3
itself warned against —"the same shape in the same place would be two
indistinguishable things". The difference is not one of appearance but of what
happens to the screen:

  · `Segmented` **chooses a value**: it changes what you see, and what was there
    stops being there. That is why it is announced with `aria-selected` or
    `aria-pressed`.
  · `SectionIndex` **changes nothing, it moves the wheel**. The ten sections of
    `Settings › General` are all still there before and after pressing; the only
    thing that moves is the point of the page you are looking at.

Everything else follows from that without having to be decided:

  · They are **links**, not buttons. An `href="#section"` navigates and scrolls,
    which is exactly what this does and nothing more. And it comes with focus, the
    keyboard, "open in another tab" and a copyable link already in place: there is
    nothing to reimplement and therefore nothing to reimplement badly.
  · The active one carries **`aria-current="location"`**, not `aria-selected`. It
    is the difference said out loud: `selected` asserts you have chosen one of
    several exclusive options; `location` says where you are inside something that
    is still whole.

## What it does NOT do, deliberately

**It does not watch the scroll.** `active` comes in as a prop. Who works it out —an
`IntersectionObserver`, the URL hash, the pane that draws it— is screen wiring and
belongs to phase 3. Bringing it in here, the primitive would start having an
opinion about its caller's DOM, and would stop being testable without mounting the
whole screen.

**It hides nothing and owns no content.** It takes no children, draws no panels and
marks nothing as `hidden`. If it ever did, it would be `Segmented` under another
name.
*/
export function SectionIndex({
  sections,
  active,
  label = 'On this page',
}: {
  /** The sections, in the order they appear on the page. */
  sections: { id: string; label: string }[]
  /** The `id` of the section you are in. Without it, none is marked. */
  active?: string
  /** The index's name, for whoever cannot see the screen. */
  label?: string
}) {
  return (
    <nav className={styles.index} aria-label={label}>
      <ul className={styles.list}>
        {sections.map((s) => (
          <li key={s.id}>
            <a
              href={`#${s.id}`}
              className={styles.item}
          /* Only on the active one: an `aria-current="false"` on the other nine
             is noise that some readers go as far as announcing. */
              aria-current={s.id === active ? 'location' : undefined}
            >
              {s.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}
