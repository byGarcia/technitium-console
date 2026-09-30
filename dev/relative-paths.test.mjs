import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/*
Upstream is one page, so a relative path in its markup always resolves against
the root. This console has real routes: a relative `sso/login` link drawn at
`/dashboard/` goes to `/dashboard/sso/login`. It happened twice on 2026-09-30 —
the SSO Redirect URI and the SSO login link, the second one found on the home
server as a 404 — so every path in the markup has to hang from the root
(`publicUrl`, `urlApi`), and this is what keeps a literal one from coming back.

It lives in `dev/` and not beside the code for the reason
`master-switch-signal.test.mjs` gives: `src/` compiles without node's types, and
a `node:fs` in there passes the suite and breaks `tsc -b`.
*/
const SRC = resolve(dirname(fileURLToPath(import.meta.url)), '../src') + '/'

function files(dir) {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n)
    if (statSync(p).isDirectory()) return files(p)
    return /\.tsx$/.test(n) && !/\.test\./.test(n) ? [p] : []
  })
}

const RELATIVE = /\b(?:href|src|action)=["'`](?!https?:|mailto:|data:|#|\/)[^"'`{}\s]+["'`]/g

describe('paths in the markup', () => {
  it('no literal href, src or action is relative to the route it is drawn at', () => {
    const found = files(SRC).flatMap((f) =>
      [...readFileSync(f, 'utf8').matchAll(RELATIVE)].map((m) => `${f.slice(SRC.length)}: ${m[0]}`),
    )
    expect(found).toEqual([])
  })
})
