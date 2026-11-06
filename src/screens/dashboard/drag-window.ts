/*
CHOOSING A WINDOW ON THE QUERIES CHART (deviation 41 in CONVENTIONS.md,
2026-11-06): the geometry of a drag across a line chart, apart from Chart.js so it
can be tested. The x axis is a category scale, one slot per bucket: a pixel maps to
the bucket whose point is nearest, and a selection runs from half a slot before its
first bucket to half a slot after its last, inside the plot area.
*/

export interface Area {
  left: number
  right: number
  top: number
  bottom: number
}

/** How far the pointer must travel before a press is a drag and not a click. */
export const DRAG_THRESHOLD_PX = 6

/** The bucket under `x`, from the scale's own `getValueForPixel`, clamped to the chart. */
export function bucketAt(x: number, area: Area, valueForPixel: (x: number) => number | undefined, count: number): number | null {
  if (count <= 0) return null
  const clamped = Math.min(area.right, Math.max(area.left, x))
  const v = valueForPixel(clamped)
  if (v == null || !Number.isFinite(v)) return null
  return Math.min(count - 1, Math.max(0, Math.round(v)))
}

/** The first and last bucket of a drag, in order. */
export function spanOf(a: number, b: number): [number, number] {
  return a <= b ? [a, b] : [b, a]
}

/** The box a selection of buckets `[first, last]` covers, in the canvas's pixels. */
export function selectionBox(
  first: number,
  last: number,
  area: Area,
  pixelFor: (index: number) => number,
  count: number,
): { left: number; width: number; top: number; height: number } {
  const step = count > 1 ? pixelFor(1) - pixelFor(0) : area.right - area.left
  const left = Math.max(area.left, pixelFor(first) - step / 2)
  const right = Math.min(area.right, pixelFor(last) + step / 2)
  return { left, width: Math.max(0, right - left), top: area.top, height: area.bottom - area.top }
}
