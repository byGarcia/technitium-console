import { describe, expect, it } from 'vitest'
import { place, type Rect } from './tooltip-place'

/*
These tests do NOT depend on jsdom, and that is the reason the arithmetic was
taken out of the component: with a fake layout —every rect at zero— it is
impossible to check that the bubble does not go off screen, which is exactly the
defect it had. Numbers go in and numbers come out.

The case that rules is 390: it is the narrow width the three pilots draw, and
where a 240 px bubble beside a control almost never fits any more.
*/
const v = (width: number, height: number): Rect => ({ top: 0, left: 0, width, height })
const r = (left: number, top: number, width = 32, height = 32): Rect => ({ left, top, width, height })
const burbuja = (width = 240, height = 40): Rect => ({ left: 0, top: 0, width, height })

describe('place', () => {
  it('to the right, centred on the trigger', () => {
    const p = place({ trigger: r(100, 300), bubble: burbuja(), viewport: v(1440, 900) })
    expect(p.placement).toBe('right')
    expect(p.left).toBe(140) // 100 + 32 + 8
    expect(p.top).toBe(300 + 16 - 20) // the trigger centre minus half a bubble
  })

  /* The rail case at 1440: there is room to spare and it must not move. */
  it('it does not flip when it fits', () => {
    const p = place({ trigger: r(60, 200), bubble: burbuja(), viewport: v(1440, 900) })
    expect(p.placement).toBe('right')
  })

  it('it flips left when it does not fit on the right', () => {
    /* Disparador pegado al borde derecho de 1440. */
    const p = place({ trigger: r(1380, 300), bubble: burbuja(), viewport: v(1440, 900) })
    expect(p.placement).toBe('left')
    expect(p.left).toBe(1380 - 8 - 240)
  })

  it('it flips from top to bottom when it does not fit above', () => {
    const p = place({ trigger: r(600, 10), bubble: burbuja(), viewport: v(1440, 900), placement: 'top' })
    expect(p.placement).toBe('bottom')
    expect(p.top).toBe(10 + 32 + 8)
  })

  /*
  390. A 240 bubble does not fit to the right of almost anything, and flipped to
  the left it does not either: so it is not flipped to a place just as bad, it is
  clamped. What must NOT happen is that it goes off screen.
  */
  it('at 390 it never goes off screen, on the right or on the left', () => {
    for (const x of [0, 8, 40, 120, 200, 300, 358]) {
      const p = place({ trigger: r(x, 300), bubble: burbuja(), viewport: v(390, 844) })
      expect(p.left, `disparador en x=${x}`).toBeGreaterThanOrEqual(8)
      expect(p.left + 240, `disparador en x=${x}`).toBeLessThanOrEqual(390 - 8)
    }
  })

  it('it does not flip to a place just as bad', () => {
    /* At 390 with a 240 bubble it fits on neither side: it stays where it was
       asked for and is clamped, instead of jumping from one edge to the other. */
    const p = place({ trigger: r(180, 300), bubble: burbuja(), viewport: v(390, 844) })
    expect(p.placement).toBe('right')
  })

  it('it clamps the cross axis too: a tall bubble by the top edge', () => {
    const p = place({ trigger: r(100, 4), bubble: burbuja(240, 120), viewport: v(1440, 900) })
    expect(p.top).toBe(8) // centring would have put it negative
  })

  it('and by the bottom edge', () => {
    const p = place({ trigger: r(100, 880), bubble: burbuja(240, 120), viewport: v(1440, 900) })
    expect(p.top).toBe(900 - 8 - 120)
  })

  /* Taller than the screen: it is cut off at the bottom, where there is scroll,
     and not at the top, where there is none. */
  it('a bubble taller than the viewport starts at the margin', () => {
    const p = place({ trigger: r(100, 300), bubble: burbuja(240, 2000), viewport: v(1440, 900) })
    expect(p.top).toBe(8)
  })
})
