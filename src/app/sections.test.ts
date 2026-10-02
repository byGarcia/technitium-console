import { describe, expect, it } from 'vitest'
import { visibleSections, type Section } from './sections'

const P = (canView: boolean) => ({ canView, canModify: false, canDelete: false })

const LIST: Section[] = [
  { id: 'one', label: 'One', permission: 'One' },
  { id: 'any', label: 'Any', permission: ['A', 'B'] },
  { id: 'free', label: 'Free', permission: null },
]

describe('visibleSections', () => {
  it('a list of permissions means any of them', () => {
    const ids = (p: Parameters<typeof visibleSections>[0]) => visibleSections(p, LIST).map((s) => s.id)
    expect(ids({ One: P(true), A: P(false), B: P(true) })).toEqual(['one', 'any', 'free'])
    expect(ids({ One: P(false), A: P(false), B: P(false) })).toEqual(['free'])
    expect(ids(undefined)).toEqual(['one', 'any', 'free'])
  })
})
