import { describe, expect, it } from 'vitest'
import { deletedNotice, deleteNeed, joinDeleted, undoNeed } from './undo'

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

  it('taking back an added rule needs Delete, and says it with upstream Delete alert', () => {
    expect(deleteNeed('blocked')).toBe('Blocked.canDelete')
    expect(deleteNeed('allowed')).toBe('Allowed.canDelete')
    expect(deletedNotice(A)).toEqual({ type: 'success', title: 'Deleted!', text: "Blocked zone 'a.test' was deleted successfully." })
    expect(deletedNotice(B).text).toBe("Domain 'b.test' was deleted from Allowed Zone successfully.")
  })

  it('Undo needs Modify on every list it puts a rule back in', () => {
    expect(undoNeed(undefined, [A, B])).toBeUndefined()
    expect(undoNeed({ Blocked: P(true), Allowed: P(false) }, [A])).toBeUndefined()
    expect(undoNeed({ Blocked: P(true), Allowed: P(false) }, [A, B])).toBe('Allowed.canModify')
  })
})
