import { describe, expect, it } from 'vitest'
import { joinDeleted, notRestoredNotice, restoreRules, undoMessage, undoNeed } from './undo'

const A = { domain: 'a.test', list: 'blocked' as const }
const B = { domain: 'b.test', list: 'allowed' as const }
const P = (m: boolean) => ({ canView: true, canModify: m, canDelete: true })

describe('undo', () => {
  it('a Delete joins a notice that still offers Undo, and starts a new one otherwise', () => {
    const one = joinDeleted(null, A)
    expect(joinDeleted(one, B)).toEqual({ rules: [A, B], phase: 'deleted' })
    expect(joinDeleted({ rules: [A], phase: 'restored' }, B)).toEqual({ rules: [B], phase: 'deleted' })
    expect(joinDeleted({ rules: [A], phase: 'restoring' }, B)).toEqual({ rules: [B], phase: 'deleted' })
  })

  it('one rule is said with upstream sentence, several are counted', () => {
    expect(undoMessage({ rules: [A], phase: 'deleted' })).toBe("Blocked zone 'a.test' was deleted successfully.")
    expect(undoMessage({ rules: [B], phase: 'deleted' })).toBe("Domain 'b.test' was deleted from Allowed Zone successfully.")
    expect(undoMessage({ rules: [A, B], phase: 'deleted' })).toBe('2 rules were deleted.')
    expect(undoMessage({ rules: [B], phase: 'restored' })).toBe("'b.test' is back in Allowed.")
    expect(undoMessage({ rules: [A, B], phase: 'restored' })).toBe('2 rules are back.')
  })

  it('Undo needs Modify on every list it puts a rule back in', () => {
    expect(undoNeed(undefined, [A, B])).toBeUndefined()
    expect(undoNeed({ Blocked: P(true), Allowed: P(false) }, [A])).toBeUndefined()
    expect(undoNeed({ Blocked: P(true), Allowed: P(false) }, [A, B])).toBe('Allowed.canModify')
  })

  it('puts back in order and stops at the first refusal', async () => {
    const asked: string[] = []
    const result = await restoreRules([A, B, A], async (r) => {
      asked.push(r.domain)
      return asked.length === 2 ? { kind: 'error', message: 'No.' } : { kind: 'ok', data: {} }
    })
    expect(result).toEqual({ restored: 1, failure: { kind: 'error', message: 'No.' } })
    expect(asked).toEqual(['a.test', 'b.test'])
    expect(notRestoredNotice([A, B, A], result)).toEqual({
      type: 'danger', title: 'Error!', text: '2 of 3 rules were not put back: No.',
    })
  })
})
