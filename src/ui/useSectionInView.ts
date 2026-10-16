import { useEffect, useState } from 'react'

/*
Which section of a long screen you are looking at, for `ui/SectionIndex`'s `active`.

`SectionIndex` deliberately does not watch the scroll: working out the active
entry is wiring of the screen that draws the sections, and the primitive stays
testable without one. This hook is that wiring, written once. Administration ›
Permissions wired it first, inline; Settings needed the same lines, and two copies
of an observer drift the way two copies of a style did.

It takes the ids of the sections in page order and finds them in the document, so
the screen only has to give each section box its `id`, which the index's links
need anyway. An empty list observes nothing and answers `undefined`.
*/
export function useSectionInView(ids: readonly string[]): string | undefined {
  const [here, setHere] = useState<string | undefined>(undefined)
  /* The ids, as a value: a new array with the same ids is not a new list. */
  const key = ids.join('\n')

  useEffect(() => {
    const order = key === '' ? [] : key.split('\n')
    const boxes = order.map((id) => document.getElementById(id)).filter((e): e is HTMLElement => e != null)
    if (boxes.length === 0) return
    const seen = new Set<string>()
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) seen.add(e.target.id)
          else seen.delete(e.target.id)
        }
        // The topmost one that is on screen: with ten sections several are, and
        // marking the last would say you are further down than you are.
        setHere(order.find((id) => seen.has(id)))
      },
      // The band a section has to cross to count: below the top 72 px and above
      // the bottom 60 % of the window, the part the eye is on.
      { rootMargin: '-72px 0px -60% 0px' },
    )
    for (const el of boxes) observer.observe(el)
    return () => observer.disconnect()
  }, [key])

  // A section that has left the list (another pane, another page) is nowhere.
  return here != null && ids.includes(here) ? here : undefined
}
