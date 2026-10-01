import { describe, expect, it } from 'vitest'
import { byLegendOrder } from './legend-order'

describe('byLegendOrder', () => {
  it('reads the series in the order given, whatever order they are stacked in', () => {
    const items = [{ text: 'Blocked' }, { text: 'Allowed' }]
    expect([...items].sort(byLegendOrder(['Allowed', 'Blocked'])).map((i) => i.text)).toEqual(['Allowed', 'Blocked'])
  })

  it('a series it does not name goes after the named ones, in its own order', () => {
    const items = [{ text: 'Other' }, { text: 'Blocked' }, { text: 'Third' }, { text: 'Allowed' }]
    expect([...items].sort(byLegendOrder(['Allowed', 'Blocked'])).map((i) => i.text)).toEqual([
      'Allowed', 'Blocked', 'Other', 'Third',
    ])
  })

  it('reads the dataset label too, for the tooltip items', () => {
    const items = [{ dataset: { label: 'Blocked' } }, { dataset: { label: 'Allowed' } }]
    expect([...items].sort(byLegendOrder(['Allowed', 'Blocked'])).map((i) => i.dataset.label)).toEqual(['Allowed', 'Blocked'])
  })
})
