import { readFileSync } from 'node:fs'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { STATIC_ROUTES } from './src/app/static-routes.js'

/*
One folder with its own `index.html` for each route of the console.

The server serves `www/` with static files and `UseDefaultFiles()`
(DnsWebService.cs:1960): `/settings/logging/` resolves to
`/settings/logging/index.html`, and `/settings/logging` gets a 301 to the
trailing-slash version. With the file in place the URL is real (no `#/`) and F5
brings you back where you were, **without touching a line of C#**.

The asset paths are corrected to the depth of each copy (`../` or `../../`). It
is not cosmetic: `base` is relative on purpose. The server honours
`X-Forwarded-Prefix` by mounting a `PathBase`, and with an absolute base the
console breaks behind a prefixed proxy, so the only way for
`/dns/settings/logging/` to find `/dns/assets/…` is to count the hops.

And each copy carries its route in a `<meta>`, which is what lets the application
know its own root without knowing the prefix: the root is its `pathname` minus
those segments.
*/
function staticRoutes(): Plugin {
  return {
    name: 'static-routes',
    enforce: 'post',
    generateBundle(_options, bundle) {
      const index = bundle['index.html']
      if (index == null || index.type !== 'asset') return

      for (const route of STATIC_ROUTES) {
        const hops = '../'.repeat(route.split('/').length)
        const html = String(index.source)
          .replace(/(href|src)="\.\//g, `$1="${hops}`)
          .replace('<head>', `<head>\n    <meta name="route" content="${route}" />`)

        this.emitFile({ type: 'asset', fileName: `${route}/index.html`, source: html })
      }
    },
  }
}

/*
The console's own version, from package.json at build time.

It cannot be discovered at runtime: the server's CSP is `default-src 'self'`
with no `connect-src`, so the browser cannot reach GitHub to ask what the latest
release is. Verified against a running server. Whoever installs it is told by the
installer, and here it is only reported.
*/
const version = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')).version

export default defineConfig(({ mode }) => ({
  define: { __CONSOLE_VERSION__: JSON.stringify(version) },
  /*
  The development server, for working only: `vite` does not serve the API, so
  without this the console starts and cannot talk to anyone.

  It forwards `/api` to the harness's `dev` container (`dev/compose.yaml`, :5380).
  What it buys is HMR: a change goes in without a reload and **the session is not
  lost**, which is what made every tweak cost a login by hand.

  It does not affect the build: `vite build` does not read `server`. The target
  can be changed with `DNS=` to point at another instance of the harness.
  */
  server: {
    proxy: {
      /*
      The pattern starts with `.*` for a concrete reason: in development the
      console does NOT ask for `/api/…`, it asks for `/dashboard/api/…`.

      And it excludes `src/`, `@` and `node_modules/` for another: without that it
      swallowed `/src/api/client.ts` (the module Vite itself serves) and
      forwarded it to the DNS server, which answered with JSON. The browser
      rejected the module by MIME type and the console did not start.

      `app/base.ts` works out its root by taking off the `pathname` the segments
      declared by `<meta name="route">`, and that meta **is injected by the plugin
      at build time**: under `vite dev` it does not exist, so the root ends up
      being the current path. With a bare `/api` proxy the session was never
      restored and the console stayed on the login, while a hand-made
      `fetch('/api/…')` worked, which is what made it confusing.
      */
      /* The console served from the root, which is how dev works, asks for a
         bare `/api/…`. This is that one. */
      '/api/': {
        target: process.env.DNS ?? 'http://127.0.0.1:5380',
        changeOrigin: true,
      },
      /* And this one, for a deep route opened directly. */
      '^/(?!src/|@|node_modules/).*/api/': {
        target: process.env.DNS ?? 'http://127.0.0.1:5380',
        changeOrigin: true,
        rewrite: (path: string) => path.replace(/^.*\/api\//, '/api/'),
      },
    },
  },
  // The build output is what gets installed as the server's web root. The
  // server honours X-Forwarded-Prefix by mounting a PathBase, so base has to be
  // relative: with an absolute base the console works in Docker and breaks
  // behind a prefixed proxy.
  base: './',
  build: {
    outDir: mode === 'check' ? 'dist-check' : 'dist',
    emptyOutDir: true,
    // Every asset that has to ship lives in public/ and the build emits it
    // again, so emptying the output directory is safe.
  },
  plugins: [react(), staticRoutes()],
}))
