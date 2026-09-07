import { describe, expect, it } from 'vitest'
import { tokenForLabel } from './palette'

describe('chart palette', () => {
  /*
  The defect this guards: each stat tile carried its own hex and they disagreed
  with the charts on the same screen. "Authoritative" was olive in the tile and
  sky blue in the doughnut. Tile and chart now ask the same function.
  */
  it('gives one label one colour, wherever it is asked from', () => {
    expect(tokenForLabel('Authoritative', 5)).toBe(tokenForLabel('Authoritative', 0))
    expect(tokenForLabel('Cached', 7)).toBe(tokenForLabel('Cached', 2))
  })

  /* The tile spells out what the chart series abbreviates. Same measurement. */
  it('the total is the same colour whichever name it is given', () => {
    expect(tokenForLabel('Total Queries', 0)).toBe(tokenForLabel('Total', 0))
  })

  /* Position must not decide colour: a deployment with no blocking sends fewer
     series, and "Server Failure" cannot change colour because of that. */
  it('a known series does not change colour with its position', () => {
    expect(tokenForLabel('Server Failure', 2)).toBe(tokenForLabel('Server Failure', 9))
  })

  it('outcomes that mean something keep the meaning', () => {
    expect(tokenForLabel('No Error', 0)).toBe('--ch-ok')
    expect(tokenForLabel('Server Failure', 0)).toBe('--ch-fail')
  })

  /* Record types and protocols are open sets: nobody can enumerate them, so
     they get position. It only has to be stable and to stay inside the cycle. */
  it('unknown series fall back to the cycle, and repeat only after it runs out', () => {
    const first = tokenForLabel('AAAA', 0)
    expect(tokenForLabel('AAAA', 0)).toBe(first)
    expect(tokenForLabel('SRV', 1)).not.toBe(first)
    expect(tokenForLabel('CAA', 8)).toBe(first)
  })
})
