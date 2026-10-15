import type { ApiOutcome } from '../../api/client'
import type { DomainList } from '../../api/zonelists'
import { noticeFromFailure, type Notice } from '../../lib/notice'
import { missing, type Need, type Permissions } from './permissions'
import type { Rule } from './rules-model'

/*
Undoing a Delete of the Rules table (Rules.tsx, the header). OURS, words included:
`Undo`, `N rules were deleted.`, `'<domain>' is back in Blocked.` / `… Allowed.`,
`N rules are back.`, `'<domain>' was not put back: <reason>` and
`N of M rules were not put back: <reason>`. A single deletion is announced with
upstream's own success sentence, the one its confirmed Delete shows
(other-zones.js), because that is what happened.

The notice moves through three phases: `deleted` (Undo offered), `restoring`
(Undo running: its button is off and the clock holds) and `restored` (said, and
gone after RESTORED_MS). A failure ends it instead and the page's notifier says
which rules did not come back, with the server's reason.
*/

export type UndoState = { rules: Rule[]; phase: 'deleted' | 'restoring' | 'restored' }

/** How long Undo is offered, and how long "is back" stays (a success alert's 5 s). */
export const UNDO_MS = 8000
export const RESTORED_MS = 5000

const LABEL: Record<DomainList, string> = { blocked: 'Blocked', allowed: 'Allowed' }

/** What putting a rule back asks for: `allowed/add` and `blocked/add` need Modify
    (WebServiceOtherZonesApi.cs:355, 560), where the Delete needed Delete. */
export function modifyNeed(list: DomainList): Need {
  return list === 'allowed' ? 'Allowed.canModify' : 'Blocked.canModify'
}

/** The permission Undo lacks, if any, for the rules it would put back. */
export function undoNeed(perms: Permissions, rules: readonly Rule[]): Need | undefined {
  for (const r of rules) {
    const need = missing(perms, modifyNeed(r.list))
    if (need != null) return need
  }
  return undefined
}

/** A Delete while Undo is offered joins it; otherwise it starts a new notice. */
export function joinDeleted(current: UndoState | null, rule: Rule): UndoState {
  if (current != null && current.phase === 'deleted') return { rules: [...current.rules, rule], phase: 'deleted' }
  return { rules: [rule], phase: 'deleted' }
}

export function undoMessage(state: UndoState): string {
  const [first] = state.rules
  const n = state.rules.length
  if (state.phase === 'restored') {
    return n === 1 ? `'${first.domain}' is back in ${LABEL[first.list]}.` : `${n} rules are back.`
  }
  if (n > 1) return `${n} rules were deleted.`
  // Upstream's success sentences for the confirmed Delete (other-zones.js).
  return first.list === 'allowed'
    ? `Domain '${first.domain}' was deleted from Allowed Zone successfully.`
    : `Blocked zone '${first.domain}' was deleted successfully.`
}

export interface Restore {
  /** How many were put back before the first failure. */
  restored: number
  failure?: { kind: string; message?: string }
}

/*
One `add` after another, in the order they were deleted, stopping at the first that
fails: what stops one (an expired session, a permission taken away meanwhile) stops
the rest, and asking again would only repeat the same refusal.
*/
export async function restoreRules(
  rules: readonly Rule[],
  add: (rule: Rule) => Promise<ApiOutcome<unknown>>,
): Promise<Restore> {
  let restored = 0
  for (const rule of rules) {
    const outcome = await add(rule)
    if (outcome.kind !== 'ok') return { restored, failure: outcome }
    restored++
  }
  return { restored }
}

export function notRestoredNotice(rules: readonly Rule[], result: Restore): Notice {
  const reason = noticeFromFailure(result.failure ?? { kind: 'error' }).text
  const left = rules.length - result.restored
  return {
    type: 'danger',
    title: 'Error!',
    text:
      rules.length === 1
        ? `'${rules[0].domain}' was not put back: ${reason}`
        : `${left} of ${rules.length} rules were not put back: ${reason}`,
  }
}
