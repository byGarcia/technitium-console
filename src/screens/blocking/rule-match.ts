import { allowRuleFor } from './check-domain'
import { requiresText } from './permissions'
import type { Rule } from './rules-model'

/*
"Already blocked?" while typing (2026-11-06, CONVENTIONS.md, deviation 32): under the
field of the Block / Allow / Check bar, whether the name typed is already one of YOUR
rules, blocked or allowed, the name itself or a parent rule that covers it. OURS, and
so is every sentence below.

It reads nothing per keystroke. The rules are the ones `blocked/export` and
`allowed/export` send, each read only with its View permission: on Rules, the table's
own (already loaded); on Overview, read once by the bar the first time a name is typed
and kept (`AddDomainBar.tsx`). The block lists are NOT looked at: asking them takes a
real DNS query, which is what `Check` is for.

A rule covers its subdomains (the same zone tree for both lists, BlockedZoneManager /
AllowedZoneManager), and an allow rule wins over every block (`IsAllowedAsync` first,
DnsServer.cs:4577-4605), so when both cover the name the allowed one is said first and
the blocked one after it.
*/

export interface RuleMatch {
  /** The most specific blocked rule covering the name, or null. */
  blocked: string | null
  /** The most specific allowed rule covering the name, or null. */
  allowed: string | null
}

/** The name as rules are written: trimmed, lower case, no final dot, in ASCII. */
export function asciiName(text: string): string | null {
  const t = text.trim().toLowerCase().replace(/\.$/, '')
  if (t === '' || /\s/.test(t)) return null
  if (/^[\x21-\x7e]+$/.test(t)) return t
  try {
    return new URL(`http://${t}`).hostname || null
  } catch {
    return null
  }
}

export function matchRules(ascii: string, rules: readonly Rule[]): RuleMatch {
  const of = (list: Rule['list']) => allowRuleFor(ascii, rules.filter((r) => r.list === list).map((r) => r.domain))
  return { blocked: of('blocked'), allowed: of('allowed') }
}

export interface RuleHint {
  tone: 'blocked' | 'allowed' | 'none'
  text: string
}

function said(list: 'blocked' | 'allowed', rule: string, ascii: string): string {
  return rule === ascii
    ? `Already ${list}: it is one of your rules.`
    : `Already ${list} by your rule ${rule}, which covers its subdomains.`
}

/**
 * The line under the field. `unread` holds the permission each list that was not read
 * lacks; a list that was read has none. Null when neither list may be read.
 */
export function ruleHint(
  ascii: string,
  rules: readonly Rule[],
  unread: { blocked?: string; allowed?: string },
): RuleHint | null {
  const m = matchRules(ascii, rules)
  if (m.allowed != null) {
    const text = said('allowed', m.allowed, ascii)
    return {
      tone: 'allowed',
      text: m.blocked != null ? `${text} It wins over your blocked rule ${m.blocked}.` : text,
    }
  }
  const notShown = (need: string | undefined, what: string) =>
    need == null ? '' : ` Your ${what} rules were not checked: ${requiresText(need)}.`
  if (m.blocked != null) {
    return { tone: 'blocked', text: `${said('blocked', m.blocked, ascii)}${notShown(unread.allowed, 'allowed')}` }
  }
  /* Neither list could be read: there is nothing to say, and the bar says nothing. */
  if (unread.blocked != null && unread.allowed != null) return null
  const lead = unread.blocked != null
    ? 'Not one of your allowed rules.'
    : unread.allowed != null
      ? 'Not one of your blocked rules.'
      : 'Not one of your rules.'
  return {
    tone: 'none',
    text: `${lead}${notShown(unread.blocked, 'blocked')}${notShown(unread.allowed, 'allowed')} Check asks the block lists.`,
  }
}
