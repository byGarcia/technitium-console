import type { Compared } from './compare'

/* The eleven figures, in the two bands `Figures.tsx` draws them in. */
export type Metric = { k: Compared; label: string; pct?: boolean; series: string }

export const KEYS: Metric[] = [
  { k: 'totalQueries', label: 'Total Queries', series: 'Total' },
  { k: 'totalBlocked', label: 'Blocked', pct: true, series: 'Blocked' },
  { k: 'totalCached', label: 'Cached', pct: true, series: 'Cached' },
  { k: 'totalClients', label: 'Clients', series: 'Clients' },
]

export const FAMILIES: Metric[][] = [
  [
    { k: 'totalNoError', label: 'No Error', pct: true, series: 'No Error' },
    { k: 'totalServerFailure', label: 'Server Failure', pct: true, series: 'Server Failure' },
    { k: 'totalNxDomain', label: 'NX Domain', pct: true, series: 'NX Domain' },
    { k: 'totalRefused', label: 'Refused', pct: true, series: 'Refused' },
  ],
  [
    { k: 'totalAuthoritative', label: 'Authoritative', pct: true, series: 'Authoritative' },
    { k: 'totalRecursive', label: 'Recursive', pct: true, series: 'Recursive' },
    { k: 'totalDropped', label: 'Dropped', pct: true, series: 'Dropped' },
  ],
]

/*
The numbers come out as in upstream, and upstream does NOT pin a locale: it uses
a bare `toLocaleString()` (main.js:2632-2650), that is, the browser's.
*/
export const num2 = (n: number) => n.toLocaleString()

/*
The percentage carries no locale, neither in upstream nor here: it is
`toFixed(2)`, which always writes the dot (main.js:2652-2676). And with zero
queries it is a literal "0%", not "0.00%".
*/
export function percentage(value: number, total: number): string {
  if (total === 0) return '0%'
  return ((value * 100) / total).toFixed(2) + '%'
}

