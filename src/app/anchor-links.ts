import { publicUrl } from './base'

/*
The icons and the manifest are anchored before anything else.

In the HTML they go relative (`./favicon.ico`, and `../../favicon.ico` in a copy two
levels down: the `static-routes` plugin counts the hops), so they are right in the
document as served, before any script runs, under any prefix. But the browser can
resolve them LATE, against whatever address is current at that moment, and the
application normalises the route as soon as it starts (`/settings/` →
`/settings/general/`): the resolution landed one level below and asked for
`/settings/favicon.ico`, a 404 on every route that is not the root. The manifest is
read late by design, when the browser decides whether to offer installation.

Pinning them here makes them absolute once, with the root already deduced, and they
stop depending on what the address bar says afterwards. Every leading `./` and `../`
goes, not only a `./`: kept, the hops climbed out of a prefix (`/dns/../../x` is
`/x`).
*/
const ANCHORED = 'link[rel="icon"], link[rel="apple-touch-icon"], link[rel="manifest"]'

export function anchorHeadLinks(): void {
  for (const link of document.querySelectorAll<HTMLLinkElement>(ANCHORED)) {
    const href = link.getAttribute('href')
    if (href != null) link.setAttribute('href', publicUrl(href.replace(/^(?:\.{1,2}\/)+/, '')))
  }
}
