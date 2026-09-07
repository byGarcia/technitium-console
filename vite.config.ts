import { readFileSync } from 'node:fs'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { STATIC_ROUTES } from './src/app/static-routes.js'

/*
One folder with its own `index.html` for each route of the console.

The server serves `www/` with static files and `UseDefaultFiles()`
(DnsWebService.cs:1960): `/settings/logging/` resolves to
`/settings/logging/index.html`, and `/settings/logging` gets a 301 to the
trailing-slash version. With the file in place the URL is real —no `#/`— and F5
brings you back where you were, **without touching a line of C#**.

The asset paths are corrected to the depth of each copy (`../` or `../../`). It
is not cosmetic: `base` is relative on purpose —the server honours
`X-Forwarded-Prefix` by mounting a `PathBase`, and with an absolute base the
console breaks behind a prefixed proxy— so the only way for
`/dns/settings/logging/` to find `/dns/assets/…` is to count the hops.

And each copy carries its route in a `<meta>`, which is what lets the application
know its own root without knowing the prefix: the root is its `pathname` minus
those segments.
*/
function staticRoutes(): Plugin {
  return {
    name: 'static-routes',
    enforce: 'post',
    generateBundle(_opciones, paquete) {
      const indice = paquete['index.html']
      if (indice == null || indice.type !== 'asset') return

      for (const route of STATIC_ROUTES) {
        const saltos = '../'.repeat(route.split('/').length)
        const html = String(indice.source)
          .replace(/(href|src)="\.\//g, `$1="${saltos}`)
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
  El servidor de desarrollo, sólo para trabajar: `vite` no sirve la API, así que
  sin esto la consola arranca y no puede hablar con nadie.

  Reenvía `/api` al contenedor `dev` del harness (`dev/compose.yaml`, :5380). Lo
  que compra es HMR: el cambio entra sin recargar y **la sesión no se pierde**,
  que es lo que hacía que cada retoque costase un login a mano.

  No afecta a lo construido: `vite build` no mira `server`. El destino se puede
  cambiar con `DNS=` para apuntar a otra instancia del harness.
  */
  server: {
    proxy: {
      /*
      El patrón lleva `.*` delante por una razón concreta: en desarrollo la
      consola NO pide `/api/…`, pide `/dashboard/api/…`.

      Y lleva la exclusión de `src/`, `@` y `node_modules/` por otra: sin ella se
      tragaba `/src/api/client.ts` —el módulo que sirve el propio Vite— y lo
      reenviaba al servidor DNS, que devolvía JSON. El navegador rechazaba el
      módulo por MIME y la consola no arrancaba.

      `app/base.ts` calcula su raíz restándole al `pathname` los segmentos que
      declara el `<meta name="route">`, y ese meta **lo inyecta el plugin al
      construir**: en `vite dev` no existe, así que la raíz acaba siendo la ruta
      actual. Con un proxy de `/api` a secas la sesión no se restauraba nunca y
      la consola se quedaba en el login, mientras un `fetch('/api/…')` a mano
      funcionaba — que es lo que despistaba.
      */
      /* La consola servida desde la raíz —que es como se trabaja en dev— pide
         `/api/…` a secas. Ésta es esa. */
      '/api/': {
        target: process.env.DNS ?? 'http://127.0.0.1:5380',
        changeOrigin: true,
      },
      /* Y ésta, la de una ruta profunda abierta directamente. */
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
