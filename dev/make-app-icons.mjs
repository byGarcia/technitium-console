/*
The icons a phone or a desktop installs the console with, drawn from its own mark.

`public/favicon.svg` is the only source (the tile and the maze, CONVENTIONS.md
"Four constraints"), so a change to the mark is one edit and one run of this. Three
variations of that one drawing, rendered by a headless Chromium:

  icon-*.png            As the mark is: a rounded tile on transparent corners.
  maskable-*.png        The tile bleeds to the edges and the maze shrinks into the
                        safe zone, which is a circle of radius 40% of the icon (W3C
                        manifest, "Icon masks"). The maze's outer corner is what
                        reaches furthest: 49.8 units wide once its stroke is
                        counted, so at a scale of .54 its half diagonal is 19.02 of
                        48, inside the 19.2 the circle allows.
  apple-touch-icon.png  The tile bleeds to the edges, with the maze at its usual
                        size. iOS rounds the corners itself and paints whatever is
                        transparent black.

    node dev/make-app-icons.mjs
    CHROME=/path/to/chrome node dev/make-app-icons.mjs

Not part of the build: the PNGs are committed, and `dev/check-installable.mjs`
checks what they declare. Without `CHROME`, the newest headless shell Playwright
has installed is used.
*/
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'public/icons')

function chrome() {
  if (process.env.CHROME) return process.env.CHROME
  const cache = join(homedir(), '.cache/ms-playwright')
  const newest = readdirSync(cache).filter((d) => d.startsWith('chromium_headless_shell-')).sort().pop()
  if (newest == null) throw new Error(`no headless shell under ${cache}: set CHROME`)
  return join(cache, newest, 'chrome-headless-shell-linux64/chrome-headless-shell')
}

/** The text replaced, refusing to go on if the mark no longer has it. */
function swap(svg, from, to) {
  if (!svg.includes(from)) throw new Error(`public/favicon.svg no longer has ${from}`)
  return svg.replace(from, to)
}

const mark = readFileSync(join(ROOT, 'public/favicon.svg'), 'utf8')
const fullBleed = swap(mark, ' rx="11"', '')
const inset = swap(fullBleed, 'translate(6 6) scale(.75)', 'translate(11.04 11.04) scale(.54)')

const ICONS = [
  ['icon-192.png', 192, mark],
  ['icon-512.png', 512, mark],
  ['maskable-192.png', 192, inset],
  ['maskable-512.png', 512, inset],
  ['apple-touch-icon.png', 180, fullBleed],
]

const work = mkdtempSync(join(tmpdir(), 'app-icons-'))
mkdirSync(OUT, { recursive: true })
try {
  for (const [name, size, svg] of ICONS) {
    const page = join(work, `${name}.html`)
    writeFileSync(page, `<!doctype html><style>html,body{margin:0;background:transparent}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`)
    execFileSync(chrome(), [
      '--headless', '--no-sandbox', '--disable-gpu', '--hide-scrollbars',
      '--force-device-scale-factor=1', '--default-background-color=00000000',
      `--window-size=${size},${size}`, `--screenshot=${join(OUT, name)}`, `file://${page}`,
    ], { stdio: 'ignore' })
    console.log(`${name}  ${readFileSync(join(OUT, name)).length} bytes`)
  }
} finally {
  rmSync(work, { recursive: true, force: true })
}
