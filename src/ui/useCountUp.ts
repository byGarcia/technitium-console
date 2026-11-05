import { useEffect, useState } from 'react'

/*
A figure that counts up to its value once, when its card first appears.

It is part of ONE entrance (the cards fade in, the bars sweep, the meter fills, the
figures count), so it runs on mount only: a figure that changes later, after a
filter or a refresh, just shows its new value. Counting again on every change
would make the screen move each time the data does, which is the opposite of calm.

The rules:

  · 400 ms, the same ease-out as the console's controls (`--t-fast`'s curve), so
    it ends with the bars and not after them.
  · Never for whoever asks the system for less motion, and never without
    `matchMedia` (the tests, an old embedded browser): the value is drawn at once.
  · It only ever draws whole numbers between 0 and the value, and the LAST frame is
    the value itself, never a rounding of it.
*/
const DURATION = 400

function animates(): boolean {
  try {
    return typeof window.matchMedia === 'function' && !window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}

/** `cubic-bezier(0.2, 0.9, 0.3, 1)` is close enough to an ease-out cubic for digits. */
function ease(k: number): number {
  return 1 - Math.pow(1 - k, 3)
}

export function useCountUp(value: number): number {
  /* Decided once, on mount: whether this figure counts at all. */
  const [start] = useState<number | null>(() => (value > 0 && animates() ? performance.now() : null))
  const [now, setNow] = useState<number | null>(start)

  useEffect(() => {
    if (start == null) return
    let frame = requestAnimationFrame(function tick(t) {
      setNow(t)
      if (t - start < DURATION) frame = requestAnimationFrame(tick)
    })
    return () => cancelAnimationFrame(frame)
  }, [start])

  if (start == null || now == null) return value
  const k = Math.min(1, Math.max(0, (now - start) / DURATION))
  return k >= 1 ? value : Math.round(value * ease(k))
}
