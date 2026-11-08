/*
Can the build be installed, from every route, under any prefix?

Nothing else looks at this, and every part of it fails silently: a browser that
cannot read a manifest or an icon says nothing, it only stops offering the install.
The console also has one real folder per route with its own `index.html`, so a link
right at the root can be wrong two levels down, and right on `/` and wrong under
`/dns/`.

For every `index.html` in the build, each link to the manifest and the icons is
resolved as a browser would, from that page's own address, with no prefix and under
`/dns/`, and has to land on a file that exists and stay inside the prefix. Then it
checks the manifest (it parses, the members that make it installable, `start_url`,
`scope` and `id` hanging from no host or absolute path), that each icon is a PNG of
the size it declares, that the theme colours are `--pan` and `--bg` from
`tokens.css` (the two places a colour has to be written outside it), and that no
service worker has crept in: a stale admin interface in front of an updated server
is the one thing installing must not cost.

    npm run build && node dev/check-installable.mjs
    node dev/check-installable.mjs path/to/dist

Exit code is the number of findings. `npm test` runs the same page and manifest
checks on `index.html` and `public/`, which needs no build, through
`check-installable.test.mjs`.
*/
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const PREFIXES = ['/', '/dns/']
const LINKS = ['manifest', 'apple-touch-icon', 'icon']
const TOUCH_ICON = 180
const ICON_SIZES = [192, 512]
const REQUIRED = ['id', 'name', 'short_name', 'start_url', 'scope', 'display', 'theme_color', 'background_color']
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

/** `--bg` and `--pan` of each theme. The light block is the one headed by its selector at the start of a line. */
export function readThemeColours(tokens) {
  const [dark, light] = tokens.split(/^\[data-theme='light'\] \{/m)
  const read = (block, name) => block.match(new RegExp(`^\\s*--${name}:\\s*(#[0-9a-fA-F]+);`, 'm'))?.[1]
  return {
    dark: { bg: read(dark, 'bg'), pan: read(dark, 'pan') },
    light: { bg: read(light ?? '', 'bg'), pan: read(light ?? '', 'pan') },
  }
}

/** The tags of one element in a document, each as a map of its attributes. */
function tags(html, element) {
  return [...html.matchAll(new RegExp(`<${element}\\b[^>]*>`, 'g'))].map(([tag]) =>
    Object.fromEntries([...tag.matchAll(/([\w-]+)="([^"]*)"/g)].map((m) => [m[1], m[2]])),
  )
}

/** The size of a PNG file, or why it cannot be read as one. */
function pngSide(file) {
  const bytes = readFileSync(file)
  if (bytes.length < 24 || !bytes.subarray(0, 8).equals(PNG)) return { error: 'is not a PNG' }
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) }
}

function isRelative(url) {
  return typeof url === 'string' && url !== '' && !url.startsWith('/') && !/^[a-z][a-z0-9+.-]*:/i.test(url)
}

/**
 * One document. `name` is its path inside `root`, and its address is that folder:
 * the same thing the server does with `UseDefaultFiles()`.
 */
export function checkPage(html, name, root, colours) {
  const findings = []
  const folder = dirname(name) === '.' ? '' : `${dirname(name)}/`
  const links = tags(html, 'link')

  for (const rel of LINKS) {
    const found = links.filter((l) => l.rel === rel)
    if (found.length === 0) findings.push(`${name}: no <link rel="${rel}"> (manifest and icons are read from the document)`)
    for (const { href } of found) {
      if (!isRelative(href)) {
        findings.push(`${name}: ${rel} href "${href}" is not relative, so no prefix can reach it`)
        continue
      }
      for (const prefix of PREFIXES) {
        const { pathname } = new URL(href, `https://dns.example.net${prefix}${folder}`)
        if (!pathname.startsWith(prefix)) {
          findings.push(`${name}: ${rel} href "${href}" resolves outside the prefix ${prefix} (${pathname})`)
        } else if (!existsSync(join(root, pathname.slice(prefix.length)))) {
          findings.push(`${name}: ${rel} href "${href}" is ${pathname} under ${prefix}, and that file is not there`)
        }
      }
    }
  }

  const themeColor = tags(html, 'meta').filter((m) => m.name === 'theme-color')
  for (const scheme of ['light', 'dark']) {
    const meta = themeColor.find((m) => m.media === `(prefers-color-scheme: ${scheme})`)
    if (meta == null) findings.push(`${name}: no theme-color for prefers-color-scheme: ${scheme}`)
    else if (meta.content?.toLowerCase() !== colours[scheme].pan?.toLowerCase()) {
      findings.push(`${name}: theme-color for ${scheme} is ${meta.content}, and --pan of that theme is ${colours[scheme].pan}`)
    }
  }

  const meta = (metaName) => tags(html, 'meta').find((m) => m.name === metaName)?.content
  for (const capable of ['mobile-web-app-capable', 'apple-mobile-web-app-capable']) {
    if (meta(capable) !== 'yes') findings.push(`${name}: <meta name="${capable}"> is not yes`)
  }
  for (const present of ['apple-mobile-web-app-title', 'apple-mobile-web-app-status-bar-style']) {
    if (!meta(present)) findings.push(`${name}: no <meta name="${present}">`)
  }
  return findings
}

function touchIconFinding(root, html) {
  const href = tags(html, 'link').find((l) => l.rel === 'apple-touch-icon')?.href
  if (!isRelative(href)) return []
  const file = join(root, href.replace(/^(?:\.{1,2}\/)+/, ''))
  if (!existsSync(file)) return []
  const side = pngSide(file)
  if (side.error) return [`${href} ${side.error}`]
  return side.width === TOUCH_ICON && side.height === TOUCH_ICON
    ? []
    : [`${href} is ${side.width}x${side.height}, not ${TOUCH_ICON}x${TOUCH_ICON}`]
}

/** `manifest.json` in `root`, and the files it names. */
export function checkManifest(root, colours) {
  let manifest
  try {
    manifest = JSON.parse(readFileSync(join(root, 'manifest.json'), 'utf8'))
  } catch (e) {
    return [`manifest.json does not parse or is not there: ${e.message}`]
  }

  const findings = []
  for (const member of REQUIRED) {
    if (typeof manifest[member] !== 'string' || manifest[member] === '') findings.push(`manifest.json: ${member} is missing`)
  }
  for (const member of ['id', 'start_url', 'scope']) {
    if (manifest[member] != null && !isRelative(manifest[member])) {
      findings.push(`manifest.json: ${member} "${manifest[member]}" is not relative, so it does not follow the prefix`)
    }
  }
  if (manifest.display !== 'standalone') findings.push(`manifest.json: display is ${manifest.display}, not standalone`)
  if (manifest.theme_color?.toLowerCase() !== colours.dark.pan?.toLowerCase()) {
    findings.push(`manifest.json: theme_color is ${manifest.theme_color}, and --pan of the dark theme is ${colours.dark.pan}`)
  }
  if (manifest.background_color?.toLowerCase() !== colours.dark.bg?.toLowerCase()) {
    findings.push(`manifest.json: background_color is ${manifest.background_color}, and --bg of the dark theme is ${colours.dark.bg}`)
  }

  const icons = Array.isArray(manifest.icons) ? manifest.icons : []
  for (const side of ICON_SIZES) {
    for (const purpose of ['any', 'maskable']) {
      if (!icons.some((i) => i.sizes === `${side}x${side}` && i.purpose === purpose)) {
        findings.push(`manifest.json: no ${side}x${side} icon for purpose ${purpose}`)
      }
    }
  }
  for (const icon of icons) {
    if (!isRelative(icon.src)) {
      findings.push(`manifest.json: icon "${icon.src}" is not relative`)
      continue
    }
    const file = join(root, icon.src)
    if (!existsSync(file)) {
      findings.push(`manifest.json: ${icon.src} is not there`)
      continue
    }
    const side = pngSide(file)
    if (side.error) findings.push(`${icon.src} ${side.error}`)
    else if (`${side.width}x${side.height}` !== icon.sizes) {
      findings.push(`${icon.src} is ${side.width}x${side.height}, and the manifest says ${icon.sizes}`)
    }
  }
  return findings
}

function walk(dir, found = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p, found)
    else found.push(p)
  }
  return found
}

/** Every page of a build, its manifest and its icons. */
export function checkDist(dist, tokens) {
  if (!existsSync(dist)) return [`${dist}: no pages found. Build first: npm run build`]
  const colours = readThemeColours(tokens)
  const files = walk(dist)
  const pages = files.filter((f) => f.endsWith('/index.html'))
  if (pages.length === 0) return [`${dist}: no pages found. Build first: npm run build`]

  const findings = pages.flatMap((p) => {
    const html = readFileSync(p, 'utf8')
    return checkPage(html, relative(dist, p), dist, colours)
  })
  findings.push(...touchIconFinding(dist, readFileSync(join(dist, 'index.html'), 'utf8')))
  findings.push(...checkManifest(dist, colours))
  for (const file of files.filter((f) => f.endsWith('.js'))) {
    if (/navigator\.serviceWorker|serviceWorker\.register/.test(readFileSync(file, 'utf8'))) {
      findings.push(`${relative(dist, file)}: registers a service worker, which this console refuses on purpose`)
    }
  }
  return findings
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const dist = resolve(process.argv[2] ?? join(ROOT, 'dist'))
  const tokens = readFileSync(join(ROOT, 'src/theme/tokens.css'), 'utf8')
  const findings = checkDist(dist, tokens)
  for (const f of findings) console.log(`  ${f}`)
  if (findings.length === 0) {
    const pages = walk(dist).filter((f) => f.endsWith('/index.html')).length
    console.log(`\n  Installable: ${pages} pages, each with its manifest and icons on real files, with no prefix and under /dns/.\n`)
  } else {
    console.log(`\n  ${findings.length} findings.\n`)
  }
  process.exit(findings.length)
}
