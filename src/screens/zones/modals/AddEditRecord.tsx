import { useEffect, useRef, useState } from 'react'
import { listApps } from '../../../api/apps'
import {
  addRecord,
  updateRecord,
  zoneHasSvcbAutoHint,
  type ResourceRecord,
  type ZoneDetails,
} from '../../../api/records'
import { Button } from '../../../ui/Button'
import { Dialog } from '../../../ui/Dialog'
import { Field, Input, Select, Textarea } from '../../../ui/Field'
import {
  FORWARDER_PROTOCOLS,
  PROXY_TYPES,
  forwarderExample,
  proxyEditable,
} from './add-zone'
import {
  RECORD_TYPES,
  SVCB_KEYS,
  buildRecordBody,
  formForType,
  formFromRecord,
  emptyForm,
  namePlaceholder,
  recordDataTemplate,
  toggleForwarderThisServer,
  ttlDefault,
  type RecordApp,
  type RecordDefaults,
  type RecordForm,
  type RecordMode,
} from '../record-form'
import { typesHiddenWhenAdding } from '../zone-view'
import type { Notice } from '../types'
import styles from '../Zones.module.css'
import { GroupRow } from '../../../ui/Form'
import { noticeFromFailure } from '../../../lib/notice'
import { Notifier } from '../../../ui/Notifier'

/*
`modalAddEditRecord` (zone.js:4395 add, 5295 edit). A single form for all 23
types: changing the "Type" dropdown replaces the fields below.

All the logic about what travels and in what order it validates lives in
`record-form.ts`. Only the fields are here.

**On edit the type cannot be changed**: upstream leaves the dropdown fixed
because the server identifies the record by its content and changing the type
would be deleting one and creating another.
*/

const DS_ALGORITHMS = [
  'RSAMD5 (1)', 'RSASHA1 (5)', 'RSASHA256 (8)', 'RSASHA512 (10)',
  'ECDSAP256SHA256 (13)', 'ECDSAP384SHA384 (14)', 'ED25519 (15)', 'ED448 (16)',
]
const DIGESTS_DS = ['SHA1 (1)', 'SHA256 (2)', 'SHA384 (4)']
const SSHFP_ALGORITHMS = ['RSA', 'DSA', 'ECDSA', 'Ed25519', 'Ed448']
const SSHFP_FINGERPRINT_TYPES = ['SHA1', 'SHA256']
const TLSA_USAGES = ['PKIX-TA', 'PKIX-EE', 'DANE-TA', 'DANE-EE']
const TLSA_SELECTORS = ['Cert', 'SPKI']
const TLSA_MATCHING_TYPES = ['Full', 'SHA2-256', 'SHA2-512']

export interface AddEditRecordProps {
  open: boolean
  mode: RecordMode
  zone: string
  zoneInfo: ZoneDetails | null
  /** Every record in the zone: they are needed for the SVCB hints. */
  records: ResourceRecord[]
  /** Only on edit. */
  original?: ResourceRecord | null
  token: string | null
  node?: string
  /** The server's defaults: TTL placeholders and FWD's DNSSEC validation. */
  defaults?: RecordDefaults
  onClose: () => void
  onDone: (a: Notice) => void
  /** The expiry TTL is reported because the row's "Disable" button uses it. */
  onExpiryTtl: (v: string) => void
}

const FALLBACK_DEFAULTS: RecordDefaults = {
  defaultRecordTtl: 3600,
  defaultNsRecordTtl: 14400,
  defaultSoaRecordTtl: 900,
  dnssecValidation: true,
}

export function AddEditRecord(p: AddEditRecordProps) {
  const [f, setF] = useState<RecordForm>(emptyForm)
  const [notice, setNotice] = useState<Notice | null>(null)
  const [busy, setBusy] = useState(false)
  const [apps, setApps] = useState<RecordApp[]>([])
  const nameRef = useRef<HTMLInputElement>(null)
  const defaults = p.defaults ?? FALLBACK_DEFAULTS

  const editing = p.mode === 'update'
  const hiddenTypes = p.zoneInfo ? typesHiddenWhenAdding(p.zoneInfo.type, p.zoneInfo.dnssecStatus) : []

  useEffect(() => {
    if (!p.open) return

    if (editing && p.original) {
      setF(formFromRecord(p.original, p.zone))
    } else {
      /*
      `showAddRecordModal` (zone.js:4489-4506): a reverse zone opens on PTR, and
      otherwise the dropdown keeps the type it was left on (add or edit), unless
      that was SOA. A type this zone hides falls to the first visible one.
      */
      setF((prev) => {
        const reverse = p.zone.endsWith('.in-addr.arpa') || p.zone.endsWith('.ip6.arpa')
        const first = RECORD_TYPES.find((t) => t !== 'SOA' && !hiddenTypes.includes(t)) ?? 'A'
        const last = prev.type !== 'SOA' && !hiddenTypes.includes(prev.type) ? prev.type : first
        return formForType(emptyForm(), reverse ? 'PTR' : last, defaults)
      })
    }
    setNotice(null)
    nameRef.current?.focus()
    // `hiddenTypes` and `defaults` are recalculated on every render; depending on
    // them would loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.open, p.mode, p.original, p.zone])

  /*
  `loadAddRecordModalAppNames` (zone.js:4511-4566): the apps are read once, when
  the form turns to APP; changing the app only rebuilds the class paths from that
  list (zone.js:561-581).
  */
  useEffect(() => {
    if (!p.open || f.type !== 'APP') return
    void listApps(p.token, p.node ?? '').then((outcome) => {
      if (outcome.kind !== 'ok') return
      // Only the apps that bring an APP record handler (zone.js:4451).
      const withHandler = (outcome.data.response.apps ?? []).filter((a) =>
        (a.dnsApps ?? []).some((d) => d.isAppRecordRequestHandler),
      )
      setApps(withHandler.map((a) => ({ name: a.name, dnsApps: a.dnsApps ?? [] })))
    })
  }, [p.open, f.type, p.token, p.node])

  const classes = (apps.find((a) => a.name === f.appName)?.dnsApps ?? [])
    .filter((d) => d.isAppRecordRequestHandler)
    .map((d) => d.classPath)

  const set = <K extends keyof RecordForm>(k: K, value: RecordForm[K]) =>
    setF((prev) => ({ ...prev, [k]: value }))

  async function save() {
    const hints = zoneHasSvcbAutoHint(p.records, f.type === 'A', f.type === 'AAAA')
    const r = buildRecordBody(f, {
      zone: p.zone,
      mode: p.mode,
      original: p.original ?? undefined,
      updateSvcbHints: hints,
    })

    if ('error' in r) {
      setNotice({ type: 'warning', title: r.error.title, text: r.error.text })
      if (r.error.field === 'name') nameRef.current?.focus()
      return
    }

    setBusy(true)
    const outcome = editing
      ? await updateRecord(p.token, r.body, p.node ?? '')
      : await addRecord(p.token, r.body, p.node ?? '')
    setBusy(false)

    if (outcome.kind !== 'ok') {
      setNotice(noticeFromFailure(outcome))
      return
    }

    p.onExpiryTtl(f.expiryTtl)
    p.onClose()
    p.onDone(
      editing
        ? { type: 'success', title: 'Record Updated!', text: 'Resource record was updated successfully.' }
        : { type: 'success', title: 'Record Added!', text: 'Resource record was added successfully.' },
    )
  }

  return (
    <Dialog
      open={p.open}
      onOpenChange={(o) => !o && p.onClose()}
      size="medium"
      title={editing ? 'Edit Record' : 'Add Record'}
      actions={
        <>
          <Button variant="primary" disabled={busy} onClick={() => void save()}>
            Save
          </Button>
        </>
      }
    >
      <Notifier notice={notice} onClose={() => setNotice(null)} />

      <div className={styles.fields}>
        <Field label="Name">
          {(id) => (
            <div className={styles.inline}>
              <Input
                id={id}
                mono
                ref={nameRef}
                placeholder={namePlaceholder(f.type)}
                value={f.name}
                onChange={(e) => set('name', e.target.value)}
              />
              <span className={styles.suffix}>.{p.zone}</span>
            </div>
          )}
        </Field>

        <Field label="Type">
          {(id) => (
            <Select
              id={id}
              className={styles.medium}
              disabled={editing}
              value={f.type}
              onChange={(e) => {
                const type = e.target.value
                setNotice(null)
                setF((prev) => formForType(prev, type, defaults))
              }}
            >
              {RECORD_TYPES.filter(
                // SOA only appears on edit; the rest according to the zone type.
                (t) => (t === 'SOA' ? editing : !hiddenTypes.includes(t)),
              ).map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          )}
        </Field>

        <Field label="TTL">
          {(id) => (
            <div className={styles.inline}>
              <Input
                id={id}
                mono
                className={styles.short}
                placeholder={ttlDefault(f.type, defaults)}
                // FWD's TTL is fixed at 0 (zone.js:4729-4730).
                disabled={f.type === 'FWD'}
                value={f.ttl}
                onChange={(e) => set('ttl', e.target.value)}
              />
              <span className={styles.suffix}>seconds (default {ttlDefault(f.type, defaults)})</span>
            </div>
          )}
        </Field>

        <TypeFields
          f={f}
          set={set}
          setF={setF}
          apps={apps.map((a) => a.name)}
          classes={classes}
          onApp={(appName) =>
            // zone.js:561-581: the class paths are rebuilt (none chosen) and the data emptied.
            setF((prev) => ({ ...prev, appName, classPath: '', recordData: '' }))
          }
          onClass={(classPath) =>
            setF((prev) => ({ ...prev, classPath, recordData: recordDataTemplate(apps, prev.appName, classPath) }))
          }
          editing={editing}
        />

        {/* "Overwrite" only exists when adding. */}
        {!editing && (
          <label className={styles.chk}>
            <input type="checkbox" checked={f.overwrite} onChange={(e) => set('overwrite', e.target.checked)} />
            Overwrite existing records
          </label>
        )}

        <Field label="Comments">
          {(id) => (
            <Textarea
              id={id}
              rows={2}
              value={f.comments}
              onChange={(e) => set('comments', e.target.value)}
            />
          )}
        </Field>

        <Field label="Expiry TTL">
          {(id) => (
            <div className={styles.inline}>
              <Input
                id={id}
                mono
                className={styles.short}
                placeholder="0"
                value={f.expiryTtl}
                onChange={(e) => set('expiryTtl', e.target.value)}
              />
              <span className={styles.suffix}>seconds (set 0 to disable)</span>
            </div>
          )}
        </Field>
        <div className={styles.help}>
          Set to automatically delete the record when the value in seconds elapses since the record’s last
          modified time.
        </div>
      </div>
    </Dialog>
  )
}

interface FieldsProps {
  f: RecordForm
  set: <K extends keyof RecordForm>(k: K, value: RecordForm[K]) => void
  setF: (update: (prev: RecordForm) => RecordForm) => void
  apps: string[]
  classes: string[]
  onApp: (appName: string) => void
  onClass: (classPath: string) => void
  editing: boolean
}

function TypeFields({ f, set, setF, apps, classes, onApp, onClass, editing }: FieldsProps) {
  const text = (
    label: string,
    key: keyof RecordForm,
    options: { mono?: boolean; short?: boolean; placeholder?: string } = {},
  ) => (
    <Field label={label}>
      {(id) => (
        <Input
          id={id}
          mono={options.mono}
          className={options.short ? styles.short : undefined}
          placeholder={options.placeholder}
          value={String(f[key] ?? '')}
          onChange={(e) => set(key, e.target.value as never)}
        />
      )}
    </Field>
  )

  const dropdown = (label: string, key: keyof RecordForm, values2: string[]) => (
    <Field label={label}>
      {(id) => (
        <Select id={id} value={String(f[key] ?? '')} onChange={(e) => set(key, e.target.value as never)}>
          <option value="" />
          {values2.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </Select>
      )}
    </Field>
  )

  switch (f.type.toUpperCase()) {
    case 'A':
    case 'AAAA':
      return (
        <>
          {text(f.type === 'A' ? 'IPv4 Address' : 'IPv6 Address', 'value', { mono: true })}
          <label className={styles.chk}>
            <input type="checkbox" checked={f.ptr} onChange={(e) => set('ptr', e.target.checked)} />
            Add reverse (PTR) record
          </label>
          <label className={styles.chk}>
            {/* Enabled only while the PTR box is ticked (zone.js:543-546); unticking
                the PTR does not untick it. */}
            <input
              type="checkbox"
              checked={f.createPtrZone}
              disabled={!f.ptr}
              onChange={(e) => set('createPtrZone', e.target.checked)}
            />
            Create reverse zone if it does not exists
          </label>
        </>
      )

    case 'NS':
      return (
        <>
          {text('Name Server', 'nsNameServer', { mono: true })}
          <Field label="Glue Addresses">
            {(id) => (
              <Textarea
                placeholder={`192.168.1.1
2001:db8::`}
                id={id}
                mono
                className={styles.area}
                value={f.nsGlue}
                onChange={(e) => set('nsGlue', e.target.value)}
              />
            )}
          </Field>
        </>
      )

    case 'SOA':
      return (
        <>
          {text('Primary Name Server', 'soaPrimaryNameServer', { mono: true })}
          {text('Responsible Person', 'soaResponsiblePerson', { mono: true, placeholder: 'email address' })}
          {text('Serial', 'soaSerial', { mono: true, short: true })}
          {text('Refresh', 'soaRefresh', { mono: true, short: true })}
          {text('Retry', 'soaRetry', { mono: true, short: true })}
          {text('Expire', 'soaExpire', { mono: true, short: true })}
          {text('Minimum', 'soaMinimum', { mono: true, short: true })}
          <label className={styles.chk}>
            <input
              type="checkbox"
              checked={f.soaUseSerialDateScheme}
              onChange={(e) => set('soaUseSerialDateScheme', e.target.checked)}
            />
            Use Serial Date Scheme
          </label>
        </>
      )

    case 'CNAME':
      return text('Canonical Name', 'value', { mono: true })

    case 'PTR':
      return text('Domain Name', 'value', { mono: true })

    case 'DNAME':
      return text('Delegation Name', 'value', { mono: true })

    case 'ANAME':
      return text('ANAME', 'value', { mono: true })

    case 'MX':
      return (
        <>
          {text('Preference', 'mxPreference', { mono: true, short: true, placeholder: '1' })}
          {text('Exchange', 'mxExchange', { mono: true })}
        </>
      )

    case 'TXT':
      return (
        <>
          <Field label="Text Data">
            {(id) => (
              <Textarea
                id={id}
                mono
                className={styles.area}
                value={f.txt}
                onChange={(e) => set('txt', e.target.value)}
              />
            )}
          </Field>
          <label className={styles.chk}>
            <input
              type="checkbox"
              checked={f.txtSplitText}
              onChange={(e) => set('txtSplitText', e.target.checked)}
            />
            Split text into multiple character strings
          </label>
        </>
      )

    case 'RP':
      return (
        <>
          {text('Mailbox', 'rpMailbox', { mono: true, placeholder: 'email address' })}
          {text('TXT Domain', 'rpTxtDomain', { mono: true, placeholder: '.' })}
        </>
      )

    case 'SRV':
      return (
        <>
          {text('Priority', 'srvPriority', { mono: true, short: true })}
          {text('Weight', 'srvWeight', { mono: true, short: true })}
          {text('Port', 'srvPort', { mono: true, short: true })}
          {text('Target', 'srvTarget', { mono: true })}
        </>
      )

    case 'NAPTR':
      return (
        <>
          {text('Order', 'naptrOrder', { mono: true, short: true })}
          {text('Preference', 'naptrPreference', { mono: true, short: true })}
          {text('Flags', 'naptrFlags', { mono: true, short: true })}
          {text('Services', 'naptrServices', { mono: true })}
          {text('Regular Expression', 'naptrRegexp', { mono: true })}
          {text('Replacement', 'naptrReplacement', { mono: true })}
        </>
      )

    case 'DS':
      return (
        <>
          {text('Key Tag', 'dsKeyTag', { mono: true, short: true, placeholder: 'key tag' })}
          {dropdown('DNSSEC Algorithm', 'dsAlgorithm', DS_ALGORITHMS)}
          {dropdown('Digest Type', 'dsDigestType', DIGESTS_DS)}
          {text('Digest', 'dsDigest', { mono: true, placeholder: 'hash string' })}
        </>
      )

    case 'SSHFP':
      return (
        <>
          {dropdown('Algorithm', 'sshfpAlgorithm', SSHFP_ALGORITHMS)}
          {dropdown('Fingerprint Type', 'sshfpFingerprintType', SSHFP_FINGERPRINT_TYPES)}
          {text('Fingerprint', 'sshfpFingerprint', { mono: true, placeholder: 'hash string' })}
        </>
      )

    case 'TLSA':
      return (
        <>
          {dropdown('Certificate Usage', 'tlsaCertificateUsage', TLSA_USAGES)}
          {dropdown('Selector', 'tlsaSelector', TLSA_SELECTORS)}
          {dropdown('Matching Type', 'tlsaMatchingType', TLSA_MATCHING_TYPES)}
          <Field label="Certificate Association Data">
            {(id) => (
              <Textarea
                placeholder={`5F95253A20A0957648DEBAAEB032F7C5720CD4F0DCF928840C55650687921DAE
          OR
-----BEGIN CERTIFICATE-----
MII...
-----END CERTIFICATE-----
`}
                id={id}
                mono
                className={styles.area}
                value={f.tlsaCertificateAssociationData}
                onChange={(e) => set('tlsaCertificateAssociationData', e.target.value)}
              />
            )}
          </Field>
          {/* index.html:4783 in v15.5.1. */}
          <div className={styles.help}>
            Enter either a hash value that you have independently generated, OR enter the certificate in
            PEM format to automatically generate the association data based on the Selector and Matching
            Type values.
          </div>
        </>
      )

    case 'SVCB':
    case 'HTTPS':
      return (
        <>
          {text('Priority', 'svcbPriority', { mono: true, short: true })}
          {text('Target Name', 'svcbTargetName', { mono: true })}
          <div className={styles.group}>
            <div className={styles.groupTitle}>Params</div>
            {f.svcbParams.map((param, i) => (
              <div key={i} className={styles.inline}>
                {/* zone.js:5358-5385: a dropdown of the known keys; "Unknown" turns
                    the row into a key number and an empty hex string. */}
                {param.custom ? (
                  <Input
                    mono
                    aria-label={`Param key ${i + 1}`}
                    placeholder="key number"
                    value={param.key}
                    onChange={(e) =>
                      set(
                        'svcbParams',
                        f.svcbParams.map((x, j) => (j === i ? { ...x, key: e.target.value } : x)),
                      )
                    }
                  />
                ) : (
                  <Select
                    aria-label={`Param key ${i + 1}`}
                    value={param.key}
                    onChange={(e) => {
                      const key = e.target.value
                      set(
                        'svcbParams',
                        f.svcbParams.map((x, j) =>
                          j !== i ? x : key === 'Unknown' ? { key: '', value: '', custom: true } : { ...x, key },
                        ),
                      )
                    }}
                  >
                    {SVCB_KEYS.map((k) => (
                      <option key={k} value={k}>
                        {k}
                      </option>
                    ))}
                    <option value="Unknown">Unknown</option>
                  </Select>
                )}
                <Input
                  mono
                  aria-label={`Param value ${i + 1}`}
                  placeholder={param.custom ? 'hex string' : undefined}
                  value={param.value}
                  onChange={(e) =>
                    set(
                      'svcbParams',
                      f.svcbParams.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)),
                    )
                  }
                />
                <Button
                  size="sm"
                  onClick={() => set('svcbParams', f.svcbParams.filter((_, j) => j !== i))}
                >
                  Remove
                </Button>
              </div>
            ))}
            <div>
              {/* A new row opens on the dropdown's first key (zone.js:5374). */}
              <Button onClick={() => set('svcbParams', [...f.svcbParams, { key: 'mandatory', value: '' }])}>
                Add Param
              </Button>
            </div>
          </div>
          <label className={styles.chk}>
            <input
              type="checkbox"
              checked={f.svcbAutoIpv4Hint}
              onChange={(e) => set('svcbAutoIpv4Hint', e.target.checked)}
            />
            Use Automatic IPv4 Hint
          </label>
          <label className={styles.chk}>
            <input
              type="checkbox"
              checked={f.svcbAutoIpv6Hint}
              onChange={(e) => set('svcbAutoIpv6Hint', e.target.checked)}
            />
            Use Automatic IPv6 Hint
          </label>
        </>
      )

    case 'URI':
      return (
        <>
          {text('Priority', 'uriPriority', { mono: true, short: true })}
          {text('Weight', 'uriWeight', { mono: true, short: true })}
          {text('URI', 'uri', { mono: true })}
        </>
      )

    case 'CAA':
      return (
        <>
          {text('Flags', 'caaFlags', { mono: true, short: true, placeholder: '0' })}
          {text('Tag', 'caaTag', { mono: true, short: true, placeholder: 'issue' })}
          {text('Authority', 'caaValue', { mono: true })}
        </>
      )

    case 'FWD':
      return (
        <>
          <GroupRow modal label="Protocol">
            {FORWARDER_PROTOCOLS.map((x) => (
              <label key={x.value} className={styles.chk}>
                <input
                  type="radio"
                  name="recordForwarderProtocol"
                  checked={f.forwarderProtocol === x.value}
                  disabled={f.forwarderThisServer}
                  onChange={() => set('forwarderProtocol', x.value)}
                />
                {x.label}
              </label>
            ))}
          </GroupRow>
          {/* `updateAddEditFormForwarderThisServer` (zone.js:5336-5356): ticked, the
              forwarder is `this-server`, fixed, on UDP, and the proxy goes away. */}
          <label className={styles.chk}>
            <input
              type="checkbox"
              checked={f.forwarderThisServer}
              onChange={(e) => {
                const on = e.target.checked
                setF((prev) => toggleForwarderThisServer(prev, on))
              }}
            />
            Use &quot;This Server&quot;
          </label>
          <div className={styles.help}>
            When using &quot;This Server&quot;, if a record does not exists in the zone then the request is
            forwarded to the DNS Server&apos;s resolver internally. This allows you to override any record for
            the forwarded domain name or control its DNSSEC validation.
          </div>
          <Field label="Forwarder">
            {(id) => (
              <Input
                id={id}
                mono
                placeholder={forwarderExample(f.forwarderProtocol)}
                disabled={f.forwarderThisServer}
                value={f.forwarder}
                onChange={(e) => set('forwarder', e.target.value)}
              />
            )}
          </Field>
          {text('Forwarder Priority', 'forwarderPriority', { mono: true, short: true, placeholder: '0' })}
          <div className={styles.help}>
            Forwarders are sorted by priority value i.e. forwarder with low priority value will be
            queried before trying for forwarder with high priority value. Forwarders with the same
            priority value will be queried concurrently.
          </div>
          <label className={styles.chk}>
            <input
              type="checkbox"
              checked={f.forwarderDnssecValidation}
              onChange={(e) => set('forwarderDnssecValidation', e.target.checked)}
            />
            Enable DNSSEC Validation
          </label>
          {!f.forwarderThisServer && (
            <GroupRow modal label="Network Proxy">
              {PROXY_TYPES.map((x) => (
                <label key={x.value} className={styles.chk}>
                  <input
                    type="radio"
                    name="recordProxyType"
                    checked={f.proxyType === x.value}
                    onChange={() => set('proxyType', x.value)}
                  />
                  {x.label}
                </label>
              ))}
              <Field label="Proxy Server Address">
                {(id) => (
                  <Input
                    placeholder="domain name or IP address"
                    id={id}
                    mono
                    disabled={!proxyEditable(f.proxyType)}
                    value={f.proxyAddress}
                    onChange={(e) => set('proxyAddress', e.target.value)}
                  />
                )}
              </Field>
              <Field label="Proxy Server Port">
                {(id) => (
                  <Input
                    placeholder="port"
                    id={id}
                    mono
                    className={styles.short}
                    disabled={!proxyEditable(f.proxyType)}
                    value={f.proxyPort}
                    onChange={(e) => set('proxyPort', e.target.value)}
                  />
                )}
              </Field>
              <Field label="Proxy Server Username">
                {(id) => (
                  <Input
                    placeholder="username"
                    id={id}
                    disabled={!proxyEditable(f.proxyType)}
                    value={f.proxyUsername}
                    onChange={(e) => set('proxyUsername', e.target.value)}
                  />
                )}
              </Field>
              <Field label="Proxy Server Password">
                {(id) => (
                  <Input
                    placeholder="password"
                    id={id}
                    type="password"
                    disabled={!proxyEditable(f.proxyType)}
                    value={f.proxyPassword}
                    onChange={(e) => set('proxyPassword', e.target.value)}
                  />
                )}
              </Field>
            </GroupRow>
          )}
        </>
      )

    case 'APP':
      return (
        <>
          {/* On edit, the app and its class are read-only: only the data changes. */}
          <Field label="App Name">
            {(id) => (
              <Select
                id={id}
                disabled={editing}
                value={f.appName}
                onChange={(e) => onApp(e.target.value)}
              >
                <option value="" />
                {apps.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Class Path">
            {(id) => (
              <Select
                id={id}
                disabled={editing}
                value={f.classPath}
                onChange={(e) => onClass(e.target.value)}
              >
                <option value="" />
                {classes.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Record Data (if any)">
            {(id) => (
              <Textarea
                id={id}
                mono
                className={styles.area}
                value={f.recordData}
                onChange={(e) => set('recordData', e.target.value)}
              />
            )}
          </Field>
        </>
      )

    default:
      return (
        <>
          {text('RR Type', 'unknownType', { mono: true, short: true, placeholder: 'type' })}
          {text('RDATA', 'value', { mono: true, placeholder: 'hex string' })}
        </>
      )
  }
}
