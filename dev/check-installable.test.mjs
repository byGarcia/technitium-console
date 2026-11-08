import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { checkDist, checkManifest, checkPage, readThemeColours } from './check-installable.mjs'

/*
The gate behind "the console can be installed from any route". The bench builds a
small `dist/` that passes, and each case breaks one thing on it. The real tree is
checked twice: `npm test` looks at the sources here, and the gate run on its own
looks at the build.
*/
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SCRIPT = join(ROOT, 'dev/check-installable.mjs')
const TOKENS = readFileSync(join(ROOT, 'src/theme/tokens.css'), 'utf8')
const colours = readThemeColours(TOKENS)

/** The eight bytes of the signature and an `IHDR`, which is all the gate reads. */
function png(side) {
  const b = Buffer.alloc(33)
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(b)
  b.writeUInt32BE(13, 8)
  b.write('IHDR', 12, 'latin1')
  b.writeUInt32BE(side, 16)
  b.writeUInt32BE(side, 20)
  return b
}

const page = (hops, route) => `<!doctype html><html><head>
${route == null ? '' : `<meta name="route" content="${route}" />`}
<link rel="icon" href="${hops}favicon.ico" sizes="48x48" />
<link rel="apple-touch-icon" href="${hops}icons/apple-touch-icon.png" sizes="180x180" />
<link rel="manifest" href="${hops}manifest.json" />
<meta name="theme-color" media="(prefers-color-scheme: light)" content="${colours.light.pan}" />
<meta name="theme-color" media="(prefers-color-scheme: dark)" content="${colours.dark.pan}" />
<meta name="mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-title" content="Technitium" />
<meta name="apple-mobile-web-app-status-bar-style" content="default" />
</head><body></body></html>`

const manifest = () => ({
  id: 'technitium-console',
  name: 'Technitium Console',
  short_name: 'Technitium',
  start_url: '.',
  scope: '.',
  display: 'standalone',
  theme_color: colours.dark.pan,
  background_color: colours.dark.bg,
  icons: [
    { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
    { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    { src: 'icons/maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
    { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ],
})

describe('the installable gate', () => {
  let dist

  const write = (rel, content) => {
    mkdirSync(dirname(join(dist, rel)), { recursive: true })
    writeFileSync(join(dist, rel), content)
  }
  const findings = () => checkDist(dist, TOKENS)

  beforeEach(() => {
    dist = mkdtempSync(join(tmpdir(), 'installable-'))
    write('index.html', page('./', null))
    write('zones/index.html', page('../', 'zones'))
    write('settings/logging/index.html', page('../../', 'settings/logging'))
    write('manifest.json', JSON.stringify(manifest()))
    write('favicon.ico', 'x')
    write('assets/index.js', 'console.log(1)')
    write('icons/apple-touch-icon.png', png(180))
    for (const name of ['icon', 'maskable']) {
      write(`icons/${name}-192.png`, png(192))
      write(`icons/${name}-512.png`, png(512))
    }
  })
  afterEach(() => rmSync(dist, { recursive: true, force: true }))

  it('passes a tree where every link resolves, at any depth and under a prefix', () => {
    expect(findings()).toEqual([])
  })

  it('finds a route whose links count one hop too few', () => {
    write('settings/logging/index.html', page('../', 'settings/logging'))
    expect(findings().join('\n')).toContain('settings/logging/index.html')
  })

  it('finds a route whose links climb out of a prefix', () => {
    write('zones/index.html', page('../../', 'zones'))
    expect(findings().join('\n')).toMatch(/zones\/index\.html.*outside the prefix/)
  })

  it('finds an absolute link, which no prefix can reach', () => {
    write('zones/index.html', page('/', 'zones'))
    expect(findings().join('\n')).toMatch(/zones\/index\.html.*not relative/)
  })

  it('finds a link to a file that was not shipped', () => {
    rmSync(join(dist, 'icons/apple-touch-icon.png'))
    expect(findings().join('\n')).toContain('icons/apple-touch-icon.png')
  })

  it('finds a page without its manifest link', () => {
    write('zones/index.html', page('../', 'zones').replace(/<link rel="manifest"[^>]*>/, ''))
    expect(findings().join('\n')).toMatch(/zones\/index\.html.*manifest/)
  })

  it('finds a theme-color that is not the token of its theme', () => {
    write('index.html', page('./', null).replace(`content="${colours.dark.pan}"`, 'content="#123456"'))
    expect(findings().join('\n')).toContain('#123456')
  })

  it('finds a manifest that does not parse', () => {
    write('manifest.json', '{ not json')
    expect(findings().join('\n')).toContain('manifest.json')
  })

  it.each([
    ['start_url', '/dashboard/'],
    ['scope', 'https://dns.example.net/'],
    ['id', '/technitium-console'],
  ])('finds a %s that hard-codes where the console hangs from', (member, value) => {
    write('manifest.json', JSON.stringify({ ...manifest(), [member]: value }))
    expect(findings().join('\n')).toContain(member)
  })

  it('finds a required member that is missing', () => {
    const { short_name: _gone, ...rest } = manifest()
    write('manifest.json', JSON.stringify(rest))
    expect(findings().join('\n')).toContain('short_name')
  })

  it('finds a display that does not install as an app', () => {
    write('manifest.json', JSON.stringify({ ...manifest(), display: 'browser' }))
    expect(findings().join('\n')).toContain('display')
  })

  it('finds a manifest colour that is not a token', () => {
    write('manifest.json', JSON.stringify({ ...manifest(), background_color: '#123456' }))
    expect(findings().join('\n')).toContain('background_color')
  })

  it('finds an icon that is not the size it declares', () => {
    write('icons/icon-512.png', png(256))
    expect(findings().join('\n')).toMatch(/icons\/icon-512\.png.*256/)
  })

  it('finds an icon that is not a PNG', () => {
    write('icons/icon-192.png', 'not an image, and long enough to reach the header bytes')
    expect(findings().join('\n')).toMatch(/icons\/icon-192\.png.*PNG/)
  })

  it('finds a size or purpose nobody declared', () => {
    write('manifest.json', JSON.stringify({ ...manifest(), icons: manifest().icons.slice(0, 3) }))
    expect(findings().join('\n')).toContain('512x512')
  })

  it('finds a touch icon of the wrong size', () => {
    write('icons/apple-touch-icon.png', png(152))
    expect(findings().join('\n')).toMatch(/apple-touch-icon\.png.*152/)
  })

  it('finds a service worker, which this console refuses on purpose', () => {
    write('assets/index.js', 'navigator.serviceWorker.register("sw.js")')
    expect(findings().join('\n')).toMatch(/assets\/index\.js.*service worker/i)
  })

  it('says so when there is nothing built, instead of passing', () => {
    expect(checkDist(join(dist, 'nothing-here'), TOKENS).join('\n')).toContain('no pages')
  })

  it('exits with the number of findings', () => {
    write('icons/icon-512.png', png(256))
    rmSync(join(dist, 'icons/maskable-512.png'))
    const run = spawnSync(process.execPath, [SCRIPT, dist], { encoding: 'utf8', timeout: 10_000 })
    expect(run.status).toBe(2)
  })

  it('exits with zero on a good tree', () => {
    const run = spawnSync(process.execPath, [SCRIPT, dist], { encoding: 'utf8', timeout: 10_000 })
    expect(run.stdout + run.stderr).toContain('3 pages')
    expect(run.status).toBe(0)
  })
})

describe('the sources of the installed app', () => {
  it('index.html links what public/ has, in the colours of the tokens', () => {
    const html = readFileSync(join(ROOT, 'index.html'), 'utf8')
    expect(checkPage(html, 'index.html', join(ROOT, 'public'), colours)).toEqual([])
  })

  it('public/manifest.json is valid and its icons are the sizes it declares', () => {
    expect(checkManifest(join(ROOT, 'public'), colours)).toEqual([])
  })

  it('reads the two tokens of each theme from tokens.css', () => {
    expect(readThemeColours(":root,\n[data-theme='dark'] {\n  --bg: #111111;\n  --pan: #222222;\n}\n[data-theme='light'] {\n  --bg: #333333;\n  --pan: #444444;\n}\n"))
      .toEqual({ dark: { bg: '#111111', pan: '#222222' }, light: { bg: '#333333', pan: '#444444' } })
  })
})
