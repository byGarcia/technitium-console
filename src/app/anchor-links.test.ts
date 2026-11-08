import { afterEach, describe, expect, it } from 'vitest'
import { forgetRoot } from './base'
import { anchorHeadLinks } from './anchor-links'

/*
Each document is served at its own depth, so its links arrive as `./x`, `../x` or
`../../x` (the `static-routes` plugin in `vite.config.ts` counts the hops). What
these cases hold is that all of them end up hanging from the console's root, also
when that root is a prefix.
*/
function documentAt(path: string, route: string | null, links: Array<[string, string]>) {
  window.history.pushState({}, '', path)
  forgetRoot()
  document.head.innerHTML = [
    route == null ? '' : `<meta name="route" content="${route}">`,
    ...links.map(([rel, href]) => `<link rel="${rel}" href="${href}">`),
  ].join('')
}

const href = (rel: string) => document.querySelector(`link[rel="${rel}"]`)?.getAttribute('href')

afterEach(() => {
  document.head.innerHTML = ''
  window.history.pushState({}, '', '/')
  forgetRoot()
})

describe('the links of the document head', () => {
  it('anchors the root document at the root', () => {
    documentAt('/', null, [['icon', './favicon.ico'], ['manifest', './manifest.json']])
    anchorHeadLinks()
    expect(href('icon')).toBe('/favicon.ico')
    expect(href('manifest')).toBe('/manifest.json')
  })

  it('anchors a document one level down, under no prefix', () => {
    documentAt('/zones/', 'zones', [['apple-touch-icon', '../icons/apple-touch-icon.png']])
    anchorHeadLinks()
    expect(href('apple-touch-icon')).toBe('/icons/apple-touch-icon.png')
  })

  it('keeps a document two levels down inside its prefix', () => {
    documentAt('/dns/settings/logging/', 'settings/logging', [
      ['icon', '../../favicon.ico'],
      ['manifest', '../../manifest.json'],
      ['apple-touch-icon', '../../icons/apple-touch-icon.png'],
    ])
    anchorHeadLinks()
    expect(href('icon')).toBe('/dns/favicon.ico')
    expect(href('manifest')).toBe('/dns/manifest.json')
    expect(href('apple-touch-icon')).toBe('/dns/icons/apple-touch-icon.png')
  })

  it('still points at the same file after the application moves the address', () => {
    documentAt('/dns/settings/', 'settings', [['manifest', '../manifest.json']])
    anchorHeadLinks()
    window.history.replaceState({}, '', '/dns/settings/general/')
    expect((document.querySelector('link[rel="manifest"]') as HTMLLinkElement).href)
      .toBe(`${window.location.origin}/dns/manifest.json`)
  })

  it('leaves the stylesheet alone, which the browser has already fetched', () => {
    documentAt('/zones/', 'zones', [['stylesheet', '../assets/index.css']])
    anchorHeadLinks()
    expect(href('stylesheet')).toBe('../assets/index.css')
  })
})
