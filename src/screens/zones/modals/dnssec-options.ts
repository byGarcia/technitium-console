/*
The dropdowns of the two DNSSEC forms (signing a zone and adding a key). **The
label and the value do NOT match**: you see "SHA256 (default)" and `SHA256`
travels, you see "Ed25519 (default)" and `ED25519` travels in uppercase. Copying
the label as the value would break the request without it showing on screen.
*/

export const ALGORITHMS = [
  { value: 'RSA', label: 'RSA' },
  { value: 'ECDSA', label: 'ECDSA (recommended)' },
  { value: 'EDDSA', label: 'EdDSA' },
]

export const HASHES_RSA = [
  { value: 'MD5', label: 'MD5 (obsolete)' },
  { value: 'SHA1', label: 'SHA1 (obsolete)' },
  { value: 'SHA256', label: 'SHA256 (default)' },
  { value: 'SHA512', label: 'SHA512' },
]

export const ECDSA_CURVES = [
  { value: 'P256', label: 'P256 (default)' },
  { value: 'P384', label: 'P384' },
]

export const EDDSA_CURVES = [
  { value: 'ED25519', label: 'Ed25519 (default)' },
  { value: 'ED448', label: 'Ed448' },
]

export const RSA_KEY_SIZES = ['1024', '1280', '1536', '2048', '3072', '4096']

export const KEY_TYPES = [
  { value: 'KeySigningKey', label: 'Key Signing Key (KSK)' },
  { value: 'ZoneSigningKey', label: 'Zone Signing Key (ZSK)' },
]

/* Each with the explanation upstream prints under its radio, literally (comma
   after "NSEC3" included), in both Sign Zone and DNSSEC Properties
   (index.html:5874, 5883, 6208 and 6217 in v15.5.1). */
export const NX_PROOFS = [
  {
    value: 'NSEC',
    label: 'Next Secure (NSEC) (recommended)',
    help: 'With NSEC, all the records in your zone can be discovered by anyone using "zone walking" technique. NSEC is recommended if your zone does not contain any private/internal records.',
  },
  {
    value: 'NSEC3',
    label: 'Next Secure 3 (NSEC3)',
    help: 'NSEC3, makes it difficult to perform "zone walking" since it uses hashing with a random salt. NSEC3 should be used if your zone contains any private/internal records that you do not wish to be enumerable.',
  },
]

export const GENERATIONS = [
  { value: 'Automatic', label: 'Automatic Private Key Generation (default)' },
  { value: 'UseSpecified', label: 'Use Specified Private Key' },
]


/*
The automatic rollover Add Key sets by itself, from zone.js:448-523. Only a ZSK
has one (the field is hidden for a KSK), and only a generated ZSK starts at 30:
changing the key type or the generation rewrites the field. The server refuses
any rollover but 0 on a KSK (DnssecPrivateKey.cs:458).
*/
export function addKeyRollover(keyType: string, generation: string): string {
  return keyType === 'ZoneSigningKey' && generation === 'Automatic' ? '30' : '0'
}

/* The same for Sign Zone's ZSK (zone.js:412-430): its generation rewrites it. */
export function signZoneZskRollover(generation: string): string {
  return generation === 'Automatic' ? '30' : '0'
}

/* One curve per family, as upstream's two selects: switching algorithm and back
   keeps what was picked in each. */
export function curveFor(algorithm: string, c: { ecdsaCurve: string; eddsaCurve: string }): string {
  return algorithm === 'EDDSA' ? c.eddsaCurve : c.ecdsaCurve
}
