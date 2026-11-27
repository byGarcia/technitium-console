import { describe, expect, it } from 'vitest'
import { bucketsWindow } from './jump'
import { bucketAt, selectionBox } from './drag-window'

/* Deviation 41: a drag's buckets, its box, and the window it opens in Query Logs. */

/* A plot from x 40 to 640, 60 slots 10 px apart, the first point at 45. */
const AREA = { left: 40, right: 640, top: 10, bottom: 210 }
const pixelFor = (i: number) => 45 + i * 10
const valueFor = (x: number) => Math.round((x - 45) / 10)

describe('the buckets a drag covers', () => {
  it('maps a pixel to the nearest bucket, clamped to the plot', () => {
    expect(bucketAt(45, AREA, valueFor, 60)).toBe(0)
    expect(bucketAt(149, AREA, valueFor, 60)).toBe(10)
    expect(bucketAt(5, AREA, valueFor, 60)).toBe(0)
    expect(bucketAt(9999, AREA, valueFor, 60)).toBe(59)
    expect(bucketAt(100, AREA, () => undefined, 60)).toBeNull()
    expect(bucketAt(100, AREA, valueFor, 0)).toBeNull()
  })

  it('draws from half a slot before the first bucket to half a slot after the last, inside the plot', () => {
    expect(selectionBox(10, 14, AREA, pixelFor, 60)).toEqual({ left: 140, width: 50, top: 10, height: 200 })
    expect(selectionBox(0, 59, AREA, pixelFor, 60)).toEqual({ left: 40, width: 600, top: 10, height: 200 })
  })
})

describe('the window a drag opens', () => {

  it('a chart without instants opens nothing', () => {
    expect(bucketsWindow({ labels: ['a', 'b'], datasets: [] }, 0, 1)).toBeNull()
  })
})
