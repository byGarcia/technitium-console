import { describe, expect, it } from 'vitest'
import { missing, requiresText } from './permissions'

const P = (canView: boolean, canModify: boolean, canDelete: boolean) => ({ canView, canModify, canDelete })

describe('missing', () => {
  it('nothing is missing without a permissions map (the session did not send one)', () => {
    expect(missing(undefined, 'Blocked.canDelete')).toBeUndefined()
  })

  it('returns the first need the session does not have', () => {
    const perms = { Blocked: P(true, true, false), Allowed: P(true, false, false) }
    expect(missing(perms, 'Blocked.canView')).toBeUndefined()
    expect(missing(perms, 'Blocked.canDelete', 'Allowed.canModify')).toBe('Blocked.canDelete')
    expect(missing({ ...perms, Blocked: P(true, true, true) }, 'Blocked.canDelete', 'Allowed.canModify')).toBe('Allowed.canModify')
  })

  it('a section the map does not mention is not denied', () => {
    expect(missing({}, 'Logs.canView')).toBeUndefined()
  })
})

describe('requiresText', () => {
  it('is PermissionButton literal', () => {
    expect(requiresText('Logs.canView')).toBe('Requires Logs: View')
  })
})
