/*
Search settings (2026-11-06, CONVENTIONS.md deviation 22). OURS: upstream has no
search.

It narrows what the form shows, on the page and only there: it asks the server
nothing, changes no field and no value, and a field it hides is still in the form
the save sends (`Save Settings` sends the nine panes whatever is on screen, as it
always did).

What it searches is what the form SAYS, not what it holds: a row's label, its help,
its options' labels and their help, a notice's text. A field's value is not
searched (an address in a text area, the option a dropdown shows), so typing
`8.8.8.8` does not find the forwarders: that is a value, and this is a search of
the settings, not of their contents.

The units it narrows are marked by the panel-form kit itself (`ui/PanelForm`,
`ui/Form`): every page row, every block of notices, a loose paragraph, a help link,
a preformatted sample (`data-unit`), and every block (`data-block`). A block left
with no unit in view goes too. Hidden is `data-search-out`, which the screen's CSS
turns into `display: none`; nothing is removed from the document.

A match is every word of the query, in any order, anywhere in the unit, ignoring
case: `ttl default` finds "Default Record TTL".
*/

/** What a unit says, without the values its controls hold. */
export function unitText(unit: Element): string {
  let out = ''
  const walk = (n: Node) => {
    if (n.nodeType === Node.TEXT_NODE) {
      out += n.textContent ?? ''
      return
    }
    if (n.nodeType !== Node.ELEMENT_NODE) return
    const el = n as Element
    if (SKIP.some((s) => el.matches(s))) return
    for (const c of el.childNodes) walk(c)
    out += ' '
  }
  walk(unit)
  return out
}

/* A text area's text is its value; a dropdown's button shows the value chosen and
   its list the values it offers; the fold's own `More`/`Less` is not the help. */
const SKIP = ['textarea', '[role="combobox"]', '[role="listbox"]', 'option', '[data-search-skip]']

/** The query's words, lower case. None for a blank query. */
export function words(q: string): string[] {
  return q.toLowerCase().split(/\s+/).filter((w) => w !== '')
}

export function matches(text: string, terms: readonly string[]): boolean {
  const t = text.toLowerCase()
  return terms.every((w) => t.includes(w))
}

/* The outermost units only: a unit inside another one (a notice inside a row) is
   that row's text, shown or hidden with it. */
function units(root: Element): Element[] {
  return [...root.querySelectorAll('[data-unit]')].filter((u) => {
    const outer = u.parentElement?.closest('[data-unit]')
    return outer == null || !root.contains(outer)
  })
}

/** What each unit under `root` says, read once so a search can be typed against it. */
export function unitTexts(root: Element): string[] {
  return units(root).map((u) => unitText(u).toLowerCase())
}

/** How many of these texts (`unitTexts`) the query finds. */
export function countMatches(texts: readonly string[], q: string): number {
  const terms = words(q)
  if (terms.length === 0) return 0
  return texts.filter((t) => matches(t, terms)).length
}

/**
 * Narrows the units under `root` to the ones the query finds, and the blocks to
 * the ones still holding one; a blank query shows everything again. Returns how
 * many units are in view.
 */
export function narrow(root: Element, q: string): number {
  const terms = words(q)
  let shown = 0
  for (const u of units(root)) {
    const ok = terms.length === 0 || matches(unitText(u), terms)
    toggle(u, ok)
    if (ok) shown += 1
  }
  for (const b of root.querySelectorAll('[data-block]')) {
    toggle(b, terms.length === 0 || b.querySelector('[data-unit]:not([data-search-out])') != null)
  }
  return shown
}

function toggle(el: Element, shown: boolean) {
  if (shown) el.removeAttribute('data-search-out')
  else el.setAttribute('data-search-out', '')
}

/*
The words found, marked where they are, with the CSS Custom Highlight API: the
browser paints the ranges and the document is not touched (no `<mark>` is
inserted into what React drew). Where the API is missing (older browsers, the
tests) nothing is marked and the search narrows all the same.
*/
const HIGHLIGHT = 'settings-search'

export function mark(root: Element | null, q: string): void {
  const registry = typeof CSS !== 'undefined' ? (CSS as unknown as { highlights?: Map<string, unknown> }).highlights : undefined
  const Ctor = (globalThis as { Highlight?: new (...r: Range[]) => unknown }).Highlight
  if (registry == null || Ctor == null) return
  const terms = words(q)
  if (root == null || terms.length === 0) {
    registry.delete(HIGHLIGHT)
    return
  }
  const ranges: Range[] = []
  for (const u of units(root)) {
    if (u.hasAttribute('data-search-out')) continue
    const walker = document.createTreeWalker(u, NodeFilter.SHOW_TEXT, {
      acceptNode: (n) => (n.parentElement?.closest(SKIP.join(',')) != null ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
    })
    for (let n = walker.nextNode(); n != null; n = walker.nextNode()) {
      const t = (n.textContent ?? '').toLowerCase()
      for (const w of terms) {
        for (let i = t.indexOf(w); i !== -1; i = t.indexOf(w, i + w.length)) {
          const r = document.createRange()
          r.setStart(n, i)
          r.setEnd(n, i + w.length)
          ranges.push(r)
        }
      }
    }
  }
  registry.set(HIGHLIGHT, new Ctor(...ranges))
}
