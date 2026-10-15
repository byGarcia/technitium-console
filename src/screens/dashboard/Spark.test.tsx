import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { Spark } from './Spark'

/* How many filled areas a trend draws: the line is always there, the area only
   when the series has a shape to show. */
const areas = (data: number[]) => {
  const { container } = render(<Spark data={data} />)
  return container.querySelectorAll('polyline[fill="currentColor"]').length
}

describe('Spark', () => {
  it('draws a series that comes down near its floor with its area', () => {
    expect(areas([0, 4, 10, 2])).toBe(1)
  })

  it('draws a near-flat series as a line only, so it does not fill its box', () => {
    expect(areas([9, 10, 11, 10])).toBe(0)
    expect(document.querySelectorAll('polyline').length).toBeGreaterThan(0)
  })

  it('keeps a gap as a break in the line, each run with its area', () => {
    expect(areas([0, 8, Number.NaN, 1, 9])).toBe(2)
  })
})
