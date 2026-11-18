/*
Upstream's footer links.

They live in a `div#footer` hanging directly off the `body` (not off `#pageLogin`
nor `#pageMain`), so in upstream they are visible on EVERY screen: the login one
and the whole console. Here they were missing entirely, and two of them
(`technitium.com` and `dnsclient.net`) appeared nowhere else, so they had been lost
from the product.

The list lives in a module of its own because two different places paint it (the
sidebar and the login screen), and a repeated list of links is a list that ends up
half-updated as soon as somebody touches one.

"About" is not there: in upstream it is the footer's sixth link and here it is a
sidebar section, so it is already reachable.
*/
export interface FooterLink {
  text: string
  href: string
  /*
  An alternative accessible name, only when the visible one collides with another
  link on the same screen. It happens with "DNS Client": it is at once a sidebar
  section (`/dnsclient/`) and Technitium's other product (`dnsclient.net`), so
  anyone navigating by list of links heard the same thing twice pointing at
  different places. The name starts with the visible text, which is what the
  "label in name" criterion requires.
  */
  name?: string
}

export const FOOTER: FooterLink[] = [
  { text: 'Technitium', href: 'https://technitium.com/' },
  { text: 'Blog', href: 'https://blog.technitium.com/' },
  { text: 'Donate', href: 'https://go.technitium.com/?id=35' },
  { text: 'DNS Client', href: 'https://dnsclient.net/', name: 'DNS Client at dnsclient.net' },
  { text: 'GitHub', href: 'https://github.com/TechnitiumSoftware/DnsServer' },
]

/*
The theme credit. It is NOT upstream's: it is the only thing in the footer this
console adds, and that is why it lives outside `FOOTER` and outside the list
`dev/check-parity-controls.mjs` compares. Whoever reads this has to be able to
tell at a glance what is parity and what is our addition.

It goes on its own line and not as a sixth link: the five above are PRODUCT
destinations and this is an authorship credit. Put in the same row, with the same
pipes, it would read as one more Technitium site.
*/
export interface ThemeCredit {
  text: string
  href: string
  name: string
}

export const GARCIA_THEME_CREDIT: ThemeCredit = {
  text: 'byGarcia',
  href: 'https://github.com/byGarcia',
  name: 'byGarcia on GitHub',
}

export const VARUN_THEME_CREDIT: ThemeCredit = {
  text: 'byVarun',
  href: 'https://github.com/varunagarwal-pro',
  name: 'byVarun on GitHub',
}

export const THEME_CREDIT: ThemeCredit = GARCIA_THEME_CREDIT

/**
 * Return the appropriate theme authorship credit based on the active theme choice.
 * Custom palettes (Dark Grey / Charcoal, Amber, Glassmorphism) are authored by Varun.
 * Upstream themes (System, Light, Dark) are authored by Garcia.
 */
export function getThemeCredit(theme: string | null | undefined): ThemeCredit {
  if (theme === 'dark-grey' || theme === 'amber' || theme === 'glassmorphism') {
    return VARUN_THEME_CREDIT
  }
  return GARCIA_THEME_CREDIT
}
