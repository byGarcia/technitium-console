/*
Which colour each series is painted in.

The server sends its own colours inside the chart data (Bootstrap 3, half
transparent). They are replaced here, because colour is the one thing about
these charts that is entirely this console's business: the numbers, the labels
and the series are the server's and are not touched.

The mapping is by LABEL and not by position. The server does not promise an
order (a deployment with no blocking sends fewer series), and painting by index
would mean "Server Failure" changing colour depending on what else happened to
be measured that hour.
*/

/** Series whose name means something. Failure has to look like failure. */
const SEMANTIC: Record<string, string> = {
  Total: '--ch-total',
  /* The tile spells it out; the chart series is just "Total". Same thing. */
  'Total Queries': '--ch-total',
  'No Error': '--ch-ok',
  'Server Failure': '--ch-fail',
  'NX Domain': '--ch-nx',
  Refused: '--ch-refuse',
  Authoritative: '--ch-auth',
  Recursive: '--ch-rec',
  Cached: '--ch-cache',
  Blocked: '--ch-block',
  /* The Blocking section's stacked bars: what got through. Green because that is
     what Allowed already wears in the console (Lists.module.css, the Rules
     table); blue is Total everywhere and would read as the total. */
  Allowed: '--ch-ok',
  Dropped: '--ch-drop',
  Clients: '--ch-clients',
}

/** Open sets (record types, transport protocols) get position, not meaning. */
const CYCLE = ['--ch-1', '--ch-2', '--ch-3', '--ch-4', '--ch-5', '--ch-6', '--ch-7', '--ch-8']

/**
 * The custom property a series is painted with, by name and failing that by
 * position. Returned as the token and not as the value so that the stat tiles
 * can use it directly in CSS: the label's colour has to be the same in the tile
 * and in the chart, and it was not: "Authoritative" was olive up in the tile and
 * sky blue down in the chart, on the same screen.
 */
export function tokenForLabel(label: string, index: number): string {
  return SEMANTIC[label] ?? CYCLE[index % CYCLE.length] ?? '--ch-1'
}

/*
No colour fallback here, on purpose. The tokens are always there (`tokens.css`
goes into the same bundle as this file, through `ThemeProvider`), so a fallback
never painted anything. What it did was keep a second, unchecked copy of the dark
palette here, which any other theme would have silently disagreed with.
*/
export function readPalette(css: CSSStyleDeclaration) {
  const get = (name: string, fallback = '') => css.getPropertyValue(name).trim() || fallback
  return {
    /** The colour for a series, by its name and, failing that, by its position. */
    forLabel(label: string, index: number): string {
      return get(tokenForLabel(label, index))
    },
    ink: get('--mute'),
    faint: get('--faint'),
    grid: get('--line2'),
    panel: get('--pan'),
    surface: get('--pan2'),
    border: get('--line'),
    text: get('--ink'),
    mono: get('--font-mono', 'ui-monospace, monospace'),
    /** The alpha, in two hex digits, of the fill that fades under a line. */
    fade: get('--ch-fade', '2e'),
  }
}

export type Palette = ReturnType<typeof readPalette>
