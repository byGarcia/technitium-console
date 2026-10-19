import { describe, expect, it } from 'vitest'
import { addToList, addToTable } from './table'

describe('addToList: the "Add User" / "Add Group" dropdowns', () => {
  it('"blank" touches nothing', () => {
    expect(addToList('Ops\n', 'blank')).toBe('Ops\n')
  })

  it('"none" empties the whole list', () => {
    expect(addToList('Ops\nDev\n', 'none')).toBe('')
  })

  it('it appends at the end with its newline', () => {
    expect(addToList('', 'Ops')).toBe('Ops\n')
    expect(addToList('Ops\n', 'Dev')).toBe('Ops\nDev\n')
  })

  it('it guarantees the newline if the text did not carry one', () => {
    expect(addToList('Ops', 'Dev')).toBe('Ops\nDev\n')
  })

  it('it does not duplicate an entry that was already there', () => {
    expect(addToList('Ops\nDev\n', 'Ops')).toBe('Ops\nDev\n')
  })
})

describe('addToTable: the dropdowns of the permissions modal', () => {
  const blank = (name: string) => ({ name, canView: false })

  it('"blank" touches nothing and "none" empties the table', () => {
    const rows = [{ name: 'ana', canView: true }]
    expect(addToTable(rows, 'blank', blank)).toBe(rows)
    expect(addToTable(rows, 'none', blank)).toEqual([])
  })

  it('it adds the row with the permissions false', () => {
    expect(addToTable([], 'ana', blank)).toEqual([{ name: 'ana', canView: false }])
  })

  it('it does not add a row that already exists', () => {
    const rows = [{ name: 'ana', canView: true }]
    expect(addToTable(rows, 'ana', blank)).toBe(rows)
  })
})

import { mappedLocalGroup } from './table'

/*
The Group Map's Local Group is a select built with the local groups
(auth.js:2271-2276 and 2445-2451): a mapping to a group that is not among them
(deleted, renamed, or set by an environment variable) leaves no option selected,
so the browser shows and saves the first one.
*/
describe('mappedLocalGroup', () => {
  it('keeps a group that exists', () => {
    expect(mappedLocalGroup('DNS Administrators', ['Administrators', 'DNS Administrators'])).toBe('DNS Administrators')
  })

  it('falls to the first group when the mapped one is not there', () => {
    expect(mappedLocalGroup('Old Group', ['Administrators', 'DNS Administrators'])).toBe('Administrators')
  })

  it('stays empty when there are no groups to show', () => {
    expect(mappedLocalGroup('Old Group', [])).toBe('')
  })
})
