import { useRef, useState } from 'react'
import { allowDomain, blockDomain, BLOCKED_TYPES } from '../api/blocking'
import { noticeFromFailure, type Notice } from './notice'

/*
The "Allow Domain" / "Block Domain" row action (other-zones.js:637-735), shared by
every row menu that offers it: Query Logs, the Dashboard's top lists, the Top
Stats modal and Blocking's top tables.

While a row's two calls are in flight upstream disables THAT row's menu
(other-zones.js:645, re-enabled when they settle), so a second click cannot start
a second sequence; the other rows stay usable. `key` names the row.

Where the alert comes out is the caller's: `onNotice` is the page's slot or the
modal's, as upstream passes `alertPlaceholderName` or not.
*/

export type DomainVerb = 'Allow Domain' | 'Block Domain'

/* other-zones.js:663 and 712, verbatim. */
export function domainActionNotice(verb: DomainVerb, domain: string): Notice {
  return verb === 'Allow Domain'
    ? { type: 'success', title: 'Allowed!', text: `Domain '${domain}' was added to Allowed Zone successfully.` }
    : { type: 'success', title: 'Blocked!', text: `Domain '${domain}' was added to Blocked Zone successfully.` }
}

/* Query Logs offers "Allow Domain" for these three response types and "Block
   Domain" for any other (logs.js:527-536), compared in lower case. */
const BLOCKED = BLOCKED_TYPES.map((t) => t.toLowerCase())

export function verbFor(responseType: string): DomainVerb {
  return BLOCKED.includes(responseType.toLowerCase()) ? 'Allow Domain' : 'Block Domain'
}

export function useDomainAction(token: string | null, onNotice: (n: Notice) => void) {
  const [busy, setBusy] = useState<ReadonlySet<string>>(new Set())
  /* Read by `run` so two clicks inside one render cannot both pass the guard. */
  const inFlight = useRef(new Set<string>())

  async function run(key: string, verb: DomainVerb, domain: string): Promise<boolean> {
    if (inFlight.current.has(key)) return false
    inFlight.current.add(key)
    setBusy(new Set(inFlight.current))
    const outcome = await (verb === 'Allow Domain' ? allowDomain(token, domain) : blockDomain(token, domain))
    inFlight.current.delete(key)
    setBusy(new Set(inFlight.current))
    if (outcome.kind !== 'ok') {
      onNotice(noticeFromFailure(outcome))
      return false
    }
    onNotice(domainActionNotice(verb, domain))
    return true
  }

  return { isBusy: (key: string) => busy.has(key), run }
}
