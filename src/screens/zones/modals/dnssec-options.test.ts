import { describe, expect, it } from 'vitest'
import { addKeyRollover, curveFor, signZoneZskRollover } from './dnssec-options'

/*
The automatic rollover the forms set by themselves, from zone.js. The server
refuses a KSK with any rollover but 0 (DnssecPrivateKey.cs:458), so the defaults
are not cosmetic: Add Key opened as a KSK with 30 and failed.
*/
describe('addKeyRollover (zone.js:448-523)', () => {
  it('a KSK always gets 0, whatever its generation', () => {
    expect(addKeyRollover('KeySigningKey', 'Automatic')).toBe('0')
    expect(addKeyRollover('KeySigningKey', 'UseSpecified')).toBe('0')
  })

  it('a ZSK gets 30 when generated and 0 when specified', () => {
    expect(addKeyRollover('ZoneSigningKey', 'Automatic')).toBe('30')
    expect(addKeyRollover('ZoneSigningKey', 'UseSpecified')).toBe('0')
  })
})

describe('signZoneZskRollover (zone.js:412-430)', () => {
  it('30 for a generated ZSK, 0 for a specified one', () => {
    expect(signZoneZskRollover('Automatic')).toBe('30')
    expect(signZoneZskRollover('UseSpecified')).toBe('0')
  })
})

/* Upstream keeps one ECDSA curve select and one EdDSA select, each with its own
   value, so switching algorithm and back does not lose the curve picked. */
describe('curveFor', () => {
  it('sends the curve of the algorithm chosen', () => {
    const curves = { ecdsaCurve: 'P384', eddsaCurve: 'ED448' }
    expect(curveFor('ECDSA', curves)).toBe('P384')
    expect(curveFor('EDDSA', curves)).toBe('ED448')
  })
})
