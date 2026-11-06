import { afterEach, describe, expect, it } from 'vitest'
import { dropParams, readParam, writeParams } from './url-state'

afterEach(() => window.history.replaceState(null, '', '/'))

describe('a view in the address bar', () => {
  it('writes and reads a parameter, replacing the entry and keeping the rest', () => {
    window.history.replaceState(null, '', '/zones/?zone=example.org')
    const before = window.history.length
    writeParams({ page: '3', name: 'ex*' })
    expect(window.location.search).toBe('?zone=example.org&page=3&name=ex*')
    expect(window.history.length).toBe(before)
    expect(readParam('page')).toBe('3')
    expect(readParam('name')).toBe('ex*')
  })

  it('an empty or null value leaves the parameter out, and drop takes them out', () => {
    window.history.replaceState(null, '', '/cache/?domain=com&type=NS')
    writeParams({ type: '' })
    expect(window.location.search).toBe('?domain=com')
    dropParams(['domain'])
    expect(window.location.search).toBe('')
    expect(readParam('domain')).toBeNull()
  })
})
