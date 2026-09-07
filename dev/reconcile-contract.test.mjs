import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { EVIDENCE, VARIANT_EVIDENCE, reconcile } from './reconcile-contract.mjs'

const readJson = (path) => {
  let value = JSON.parse(readFileSync(path, 'utf8'))
  if (typeof value === 'string') value = JSON.parse(value)
  return value
}

describe('dialog contract reconciliation', () => {
  const report = reconcile(readJson(EVIDENCE), readJson(VARIANT_EVIDENCE))

  it('uses the captured multi-state evidence', () => {
    expect(report.AddZone.variantStates).toBe(9)
    expect(report.AddEditRecord.variantStates).toBe(24)
    expect(report.ZoneOptions.variantStates).toBe(6)
    expect(report.SignZone.variantStates).toBe(6)
    expect(report.DnssecProperties.variantStates).toBe(5)
  })

  it('has no unexplained name-coverage differences', () => {
    for (const [dialog, result] of Object.entries(report)) {
      expect(result.inSourceNotOnScreen, dialog).toEqual([])
      expect(result.onScreenNotInSource, dialog).toEqual([])
    }
  })
})
