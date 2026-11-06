/*
The domain tree's chain. Upstream draws a FLAT LIST: `[refresh]`, `[up]` and the
node's children (other-zones.js:120-137). Cache (its header's path) and Allowed and
Blocked (the trail inside Rules) draw the chain of ancestors as crumbs, each of them
its child's `[up]` taken one or more times. The tree column that drew it as nested
nodes went on 2026-11-06.
*/

/** Every ancestor of the domain, from the root down and not including it. */
export function ancestors(domain: string): string[] {
  const output: string[] = []
  let d = domain
  for (;;) {
    const i = d.indexOf('.')
    if (i === -1) break
    d = d.substring(i + 1)
    output.push(d)
  }
  return output.reverse()
}
