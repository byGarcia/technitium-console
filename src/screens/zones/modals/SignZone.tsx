import { useEffect, useState } from 'react'
import { signZone, type Algorithm, type NxProof } from '../../../api/dnssec'
import { Button } from '../../../ui/Button'
import { Dialog } from '../../../ui/Dialog'
import { Field, Input, Select, Textarea } from '../../../ui/Field'
import {
  ALGORITHMS,
  ECDSA_CURVES,
  EDDSA_CURVES,
  GENERATIONS,
  HASHES_RSA,
  NX_PROOFS,
  RSA_KEY_SIZES,
  curveFor,
  signZoneZskRollover,
} from './dnssec-options'
import type { Notice } from '../types'
import l from './layout.module.css'
import { HelpText, External } from '../../../ui/External'
import { DNSSEC_HELP, RFC_NSEC3_ITERATIONS, RFC_NSEC3_SALT } from '../references'
import { noticeFromFailure } from '../../../lib/notice'
import { Notifier } from '../../../ui/Notifier'

/*
`modalDnssecSignZone` (zone.js:6539 and 6578).

The initial values are NOT those of an empty form: ECDSA with P256, automatic KSK
and ZSK, NSEC, TTL 3600 and a ZSK rollover every 30 days. And RSA's default sizes
are **different between KSK and ZSK** (2048 and 1280), which is the kind of detail
that gets lost when "cleaning up" a form.
*/

interface SignZoneForm {
  algorithm: Algorithm
  hashAlgorithm: string
  ecdsaCurve: string
  eddsaCurve: string
  kskGeneration: string
  kskKeySize: string
  pemKskPrivateKey: string
  zskGeneration: string
  zskKeySize: string
  pemZskPrivateKey: string
  nxProof: NxProof
  iterations: string
  saltLength: string
  dnsKeyTtl: string
  zskRolloverDays: string
}

function initial(): SignZoneForm {
  return {
    algorithm: 'ECDSA',
    hashAlgorithm: 'SHA256',
    ecdsaCurve: 'P256',
    eddsaCurve: 'ED25519',
    kskGeneration: 'Automatic',
    kskKeySize: '2048',
    pemKskPrivateKey: '',
    zskGeneration: 'Automatic',
    zskKeySize: '1280',
    pemZskPrivateKey: '',
    nxProof: 'NSEC',
    iterations: '0',
    saltLength: '0',
    dnsKeyTtl: '3600',
    zskRolloverDays: '30',
  }
}

export function SignZone({
  zone,
  open,
  token,
  node = '',
  onClose,
  onDone,
}: {
  zone: string
  open: boolean
  token: string | null
  node?: string
  onClose: () => void
  onDone: (a: Notice) => void
}) {
  const [f, setF] = useState<SignZoneForm>(initial)
  const [notice, setNotice] = useState<Notice | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    setF(initial())
    setNotice(null)
  }, [open])

  const set = <K extends keyof SignZoneForm>(k: K, value: SignZoneForm[K]) =>
    setF((prev) => ({ ...prev, [k]: value }))

  function changeAlgorithm(algorithm: Algorithm) {
    set('algorithm', algorithm)
  }

  async function sign() {
    setBusy(true)
    const outcome = await signZone(
      token,
      zone,
      {
        algorithm: f.algorithm,
        hashAlgorithm: f.hashAlgorithm,
        kskKeySize: f.kskKeySize,
        zskKeySize: f.zskKeySize,
        curve: curveFor(f.algorithm, f),
        // The PEMs only make sense with "Use Specified Private Key", but upstream
        // always sends them: if they are empty, they travel empty.
        pemKskPrivateKey: f.kskGeneration === 'UseSpecified' ? f.pemKskPrivateKey : '',
        pemZskPrivateKey: f.zskGeneration === 'UseSpecified' ? f.pemZskPrivateKey : '',
        dnsKeyTtl: f.dnsKeyTtl,
        zskRolloverDays: f.zskRolloverDays,
        nxProof: f.nxProof,
        iterations: f.iterations,
        saltLength: f.saltLength,
      },
      node,
    )
    setBusy(false)

    if (outcome.kind !== 'ok') {
      setNotice(noticeFromFailure(outcome))
      return
    }

    onClose()
    onDone({ type: 'success', title: 'Zone Signed!', text: 'The primary zone was signed successfully.' })
  }

  const isRsa = f.algorithm === 'RSA'
  const curves = f.algorithm === 'EDDSA' ? EDDSA_CURVES : ECDSA_CURVES

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !o && onClose()}
      /* Upstream's 780, the step of its long forms: two key blocks side by side. */
      size="medium"
      title={`Sign Zone - ${zone === '.' ? '<root>' : zone}`}
      actions={
        <>
          <Button variant="primary" disabled={busy} onClick={() => void sign()}>
            Sign Zone
          </Button>
        </>
      }
    >
      <Notifier notice={notice} onClose={() => setNotice(null)} />

      <div className={l.content}>
        <section className={l.section}>
          {/* What the keys are: the algorithm and its hash or curve, on one row. */}
          <div className={l.rowFit}>
            <div className={l.group}>
              <div className={l.groupLabel}>DNSKEY Algorithm</div>
              <div className={l.across}>
                {ALGORITHMS.map((a) => (
                  <label key={a.value} className={l.check}>
                    <input
                      type="radio"
                      name="signAlgorithm"
                      checked={f.algorithm === a.value}
                      onChange={() => changeAlgorithm(a.value as Algorithm)}
                    />
                    {a.label}
                  </label>
                ))}
              </div>
            </div>

            {isRsa ? (
              <Field label="Hash Algorithm">
                {(id) => (
                  <Select id={id} value={f.hashAlgorithm} onChange={(e) => set('hashAlgorithm', e.target.value)}>
                    {HASHES_RSA.map((h) => (
                      <option key={h.value} value={h.value}>
                        {h.label}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
            ) : (
              <Field label={f.algorithm === 'EDDSA' ? 'EdDSA Curve' : 'ECDSA Curve'}>
                {(id) => (
                  <Select
                    id={id}
                    value={curveFor(f.algorithm, f)}
                    onChange={(e) => set(f.algorithm === 'EDDSA' ? 'eddsaCurve' : 'ecdsaCurve', e.target.value)}
                  >
                    {curves.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
            )}
          </div>

          {/* The two keys, as a pair. */}
          <div className={`${l.row2} ${l.pair}`}>
            <SigningKey
              title="Key Signing Key (KSK)"
              name="signKsk"
              isRsa={isRsa}
              sizeLabel="KSK Size"
              sizeHelp="bits (recommended 2048)"
              pemLabel="KSK Private Key"
              generation={f.kskGeneration}
              size={f.kskKeySize}
              pem={f.pemKskPrivateKey}
              onGeneration={(v) => setF((prev) => ({ ...prev, kskGeneration: v, pemKskPrivateKey: '' }))}
              onSize={(v) => set('kskKeySize', v)}
              onPem={(v) => set('pemKskPrivateKey', v)}
            />

            <SigningKey
              title="Zone Signing Key (ZSK)"
              name="signZsk"
              isRsa={isRsa}
              sizeLabel="ZSK Size"
              sizeHelp="bits (default 1280)"
              pemLabel="ZSK Private Key"
              generation={f.zskGeneration}
              size={f.zskKeySize}
              pem={f.pemZskPrivateKey}
              onGeneration={(v) =>
                // zone.js:412-430: the rollover follows the generation, and the PEM is cleared.
                setF((prev) => ({
                  ...prev,
                  zskGeneration: v,
                  pemZskPrivateKey: '',
                  zskRolloverDays: signZoneZskRollover(v),
                }))
              }
              onSize={(v) => set('zskKeySize', v)}
              onPem={(v) => set('pemZskPrivateKey', v)}
            />
          </div>
        </section>

        <section className={l.section}>
          <div className={l.title}>Proof of Non-Existence</div>
          <div className={l.choices}>
            {NX_PROOFS.map((n) => (
              <div key={n.value} className={l.choice}>
                <label className={l.check}>
                  <input
                    type="radio"
                    name="signNxProof"
                    checked={f.nxProof === n.value}
                    onChange={() => set('nxProof', n.value as NxProof)}
                  />
                  {n.label}
                </label>
                <div className={l.help}>{n.help}</div>
              </div>
            ))}
          </div>

          {f.nxProof === 'NSEC3' && (
            <div className={l.row2}>
              <div className={l.field}>
                <Field label="NSEC3 Iterations">
                  {(id) => (
                    <div className={l.inline}>
                      <Input
                        placeholder="iterations"
                        id={id}
                        mono
                        className={l.short}
                        value={f.iterations}
                        onChange={(e) => set('iterations', e.target.value)}
                      />
                      <span className={l.suffix}>(valid range 0-50, recommended 0)</span>
                    </div>
                  )}
                </Field>
                <div className={l.help}>
                  The number of iterations used by NSEC3 for hashing the domain names. It is recommended
                  to use 0 iterations since more iterations will increase computational costs for both
                  the DNS Server and resolver while not providing much value against &quot;zone
                  walking&quot; [<External href={RFC_NSEC3_ITERATIONS}>RFC 9276</External>].
                </div>
              </div>
              <div className={l.field}>
                <Field label="NSEC3 Salt Length">
                  {(id) => (
                    <div className={l.inline}>
                      <Input
                        placeholder="length"
                        id={id}
                        mono
                        className={l.short}
                        value={f.saltLength}
                        onChange={(e) => set('saltLength', e.target.value)}
                      />
                      <span className={l.suffix}>bytes (valid range 0-32, recommended 0)</span>
                    </div>
                  )}
                </Field>
                <div className={l.help}>
                  The number of bytes of random salt to generate to be used with the NSEC3 hash
                  computation. It is recommended to not use salt by setting the length to 0
                  [<External href={RFC_NSEC3_SALT}>RFC 9276</External>].
                </div>
              </div>
            </div>
          )}
        </section>

        <section className={l.section}>
          <div className={l.row2}>
            <div className={l.field}>
              <Field label="DNSKEY TTL">
                {(id) => (
                  <div className={l.inline}>
                    <Input
                      placeholder="ttl"
                      id={id}
                      mono
                      className={l.short}
                      value={f.dnsKeyTtl}
                      onChange={(e) => set('dnsKeyTtl', e.target.value)}
                    />
                    <span className={l.suffix}>seconds (default 3600/1h)</span>
                  </div>
                )}
              </Field>
              <div className={l.help}>
                The TTL value to be used for DNSKEY records. A lower value will allow quicker addition or
                rollover to a new DNS Key at the cost of increased frequency of DNSKEY queries by
                resolvers.
              </div>
            </div>

            <div className={l.field}>
              <Field label="ZSK Automatic Rollover">
                {(id) => (
                  <div className={l.inline}>
                    <Input
                      placeholder="days"
                      id={id}
                      mono
                      className={l.short}
                      value={f.zskRolloverDays}
                      onChange={(e) => set('zskRolloverDays', e.target.value)}
                    />
                    <span className={l.suffix}>days (valid range 0-365; default 30; set 0 to disable)</span>
                  </div>
                )}
              </Field>
              <div className={l.help}>
                The frequency at which the DNS Server must automatically rollover the Zone Signing Key
                (ZSK).
              </div>
            </div>
          </div>

          {/* The link upstream closes `modalDnssecSignZone` with. */}
          <HelpText href={DNSSEC_HELP}>Help: How To Secure Your Domain Name With DNSSEC</HelpText>
        </section>
      </div>
    </Dialog>
  )
}

/** KSK and ZSK are the same block with different labels and defaults. */
function SigningKey({
  title,
  name,
  isRsa,
  sizeLabel,
  sizeHelp,
  pemLabel,
  generation,
  size,
  pem,
  onGeneration,
  onSize,
  onPem,
}: {
  title: string
  name: string
  isRsa: boolean
  sizeLabel: string
  sizeHelp: string
  pemLabel: string
  generation: string
  size: string
  pem: string
  onGeneration: (v: string) => void
  onSize: (v: string) => void
  onPem: (v: string) => void
}) {
  return (
    <div className={l.block}>
      <div className={l.title}>{title}</div>
      <div className={l.group}>
        {GENERATIONS.map((g) => (
          <label key={g.value} className={l.check}>
            <input
              type="radio"
              name={name}
              checked={generation === g.value}
              onChange={() => onGeneration(g.value)}
            />
            {g.label}
          </label>
        ))}
      </div>

      {/* The size only applies to RSA and only with automatic generation. */}
      {isRsa && generation === 'Automatic' && (
        <Field label={sizeLabel}>
          {(id) => (
            <div className={l.inline}>
              <Select id={id} className={l.short} value={size} onChange={(e) => onSize(e.target.value)}>
                {RSA_KEY_SIZES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </Select>
              <span className={l.suffix}>{sizeHelp}</span>
            </div>
          )}
        </Field>
      )}

      {generation === 'UseSpecified' && (
        <div className={l.field}>
          <Field label={pemLabel}>
            {(id) => (
              <Textarea
                id={id}
                mono
                className={l.area}
                spellCheck={false}
                value={pem}
                onChange={(e) => onPem(e.target.value)}
              />
            )}
          </Field>
          <div className={l.help}>Enter a private key in PEM format.</div>
        </div>
      )}
    </div>
  )
}
