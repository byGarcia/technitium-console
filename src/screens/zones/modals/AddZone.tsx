import { FilePick } from '../../../ui/FilePick'
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { createZone, listCatalogs } from '../../../api/zones'
import { getTsigKeyNames } from '../../../api/settings'
import { Button } from '../../../ui/Button'
import { Dialog } from '../../../ui/Dialog'
import { Field, Input, Select, Textarea } from '../../../ui/Field'
import type { Notice } from '../types'
import z from './zone-dialog.module.css'
import { Group, Tile } from './zone-dialog'
import { zoneColour } from '../zone-colours'
import {
  acceptsZoneFile,
  buildAddParams,
  forwarderExample,
  initialAddZoneForm,
  proxyEditable,
  FORWARDER_PROTOCOLS,
  TRANSFER_PROTOCOLS,
  visibleSections,
  ADD_TYPES,
  PROXY_TYPES,
  type AddZoneForm,
  type AddZoneKind,
} from './add-zone'
import { HelpText, External } from '../../../ui/External'
import { RFC_ZONEMD } from '../references'
import { noticeFromFailure } from '../../../lib/notice'
import { Notifier } from '../../../ui/Notifier'

/*
`modalAddZone` (zone.js:2726 and 2911). Eight zone types, each with its own form.
The decision about what shows and what travels is in `add-zone.ts`, which
tests without mounting anything.

The catalog is only offered **if the server returned one**: upstream marks the
dropdown with `hasItems` and the `switch`'s branches check it before showing it.
A server with no catalog zones does not show that field at all.
*/

/** "Secondary ROOT Zone" is a Secondary (`add-zone.ts`), so it takes that colour. */
function typeColour(type: AddZoneKind): string {
  return zoneColour(type === 'SecondaryRoot' ? 'Secondary' : type)
}

export function AddZone({
  open,
  token,
  node = '',
  useSoaSerialDateScheme,
  dnssecValidation,
  clusterDomain,
  onClose,
  onCreated,
}: {
  open: boolean
  token: string | null
  node?: string
  /** Both inherit from Settings' global setting, not from `false`. */
  useSoaSerialDateScheme: boolean
  dnssecValidation: boolean
  /** On an initialised cluster, its catalog is preselected (zone.js:2873-2876). */
  clusterDomain?: string
  onClose: () => void
  onCreated: (domain: string, notice: Notice) => void
}) {
  const [f, setF] = useState<AddZoneForm>(() =>
    initialAddZoneForm(useSoaSerialDateScheme, dnssecValidation),
  )
  const [catalogs, setCatalogs] = useState<string[]>([])
  const [tsigKeys, setTsigKeys] = useState<string[]>([])
  const [zoneFile, setZoneFile] = useState<File | null>(null)
  const [notice, setNotice] = useState<Notice | null>(null)
  const [busy, setBusy] = useState(false)
  const zoneRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    setF(initialAddZoneForm(useSoaSerialDateScheme, dnssecValidation))
    setZoneFile(null)
    setNotice(null)
    void listCatalogs(token, node).then((c) => {
      const list = c ?? []
      setCatalogs(list)
      /* zone.js:2871-2876 and `loadCatalogZoneNamesFrom`: the cluster's catalog
         comes up chosen when the server lists it; otherwise the blank line. */
      const clusterCatalog = clusterDomain ? `cluster-catalog.${clusterDomain}` : ''
      if (clusterCatalog !== '' && list.includes(clusterCatalog)) {
        setF((prev) => ({ ...prev, catalog: clusterCatalog }))
      }
    })
    void getTsigKeyNames(token, node).then(setTsigKeys)
    zoneRef.current?.focus()
  }, [open, token, node, useSoaSerialDateScheme, dnssecValidation, clusterDomain])

  const v = visibleSections(f.type, f.initializeForwarder)
  const set = <K extends keyof AddZoneForm>(k: K, value: AddZoneForm[K]) =>
    setF((prev) => ({ ...prev, [k]: value }))

  function changeType(type: AddZoneKind) {
    const sections = visibleSections(type, f.initializeForwarder)
    /* The three types with a TSIG key read the names again and start on none
       (`loadTsigKeyNames(…, null)`, zone.js:58 and 98). */
    const tsig = type === 'Secondary' || type === 'SecondaryForwarder' || type === 'SecondaryCatalog'
    setF((prev) => ({
      ...prev,
      type,
      zone: sections.fixedZone ?? prev.zone,
      tsigKeyName: tsig ? '' : prev.tsigKeyName,
    }))
    if (tsig) void getTsigKeyNames(token, node).then(setTsigKeys)
  }

  async function create() {
    const r = buildAddParams(f)
    if ('error' in r) {
      setNotice({ type: 'warning', title: r.error.title, text: r.error.text })
      if (r.error.field === 'zone') zoneRef.current?.focus()
      return
    }

    setBusy(true)
    const outcome = await createZone(
      token,
      r.params,
      acceptsZoneFile(f.type) ? zoneFile : null,
      node,
    )
    setBusy(false)

    if (outcome.kind !== 'ok') {
      setNotice(noticeFromFailure(outcome))
      return
    }

    onClose()
    // Upstream opens the newly created zone, it does not go back to the list.
    onCreated(outcome.data.response.domain, {
      type: 'success',
      title: 'Zone Added!',
      text: 'Zone was added successfully.',
    })
  }

  /* Whether the type has any field of its own: Catalog has none (see
     `visibleSections`). The block is then hidden, not unmounted, because the
     zone file input lives in it and must keep its file across type changes. */
  const typeFields =
    (v.catalog && catalogs.length > 0) ||
    v.initializeForwarderCheckbox ||
    v.zoneFile ||
    v.soaSerial ||
    v.primaryServers ||
    v.transferProtocol ||
    v.tsig ||
    v.validateZone ||
    v.forwarderFields

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !o && onClose()}
      size="medium"
      title="Add Zone"
      actions={
        <>
          <Button variant="primary" disabled={busy} onClick={() => void create()}>
            Add
          </Button>
        </>
      }
    >
      <Notifier notice={notice} onClose={() => setNotice(null)} />

      {/*
      Redrawn on 2026-11-05, same fields in upstream's order: the zone's name, its
      type as a grid of tiles (each with its colour from `zone-colours.ts`), and
      the type's own fields in one block under it, as the record form puts a
      record type's. Every label sits above its control (`zone-dialog.module.css`).
      */}
      <div className={z.form}>
        <Field label="Zone">
          {(id) => (
            <Input
              placeholder="example.com or 192.168.0.0/24 or 2001:db8::/64"
              id={id}
              mono
              ref={zoneRef}
              disabled={v.fixedZone != null}
              value={f.zone}
              onChange={(e) => set('zone', e.target.value)}
            />
          )}
        </Field>

        <Group label="Zone Type" radios={z.tiles}>
          {ADD_TYPES.map((t) => (
            <Tile
              key={t.value}
              name="addZoneType"
              checked={f.type === t.value}
              onChange={() => changeType(t.value)}
              colour={typeColour(t.value)}
            >
              {t.label}
              {t.reference && (
                <>
                  {' ('}
                  <External href={t.reference.href}>{t.reference.text}</External>
                  {')'}
                </>
              )}
            </Tile>
          ))}
        </Group>

        <section
          className={z.block}
          hidden={!typeFields}
          style={{ '--zt': typeColour(f.type) } as CSSProperties}
        >
          {v.catalog && catalogs.length > 0 && (
            <Field label="Catalog Zone">
              {(id) => (
                <>
                  <Select id={id} value={f.catalog} onChange={(e) => set('catalog', e.target.value)}>
                    <option value="" />
                    {catalogs.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </Select>
                  <div className={z.help}>Select a Catalog zone to register as its member zone.</div>
                </>
              )}
            </Field>
          )}

          {v.initializeForwarderCheckbox && (
            <Group label="Conditional Forwarder">
              <label className={z.chk}>
                <input
                  type="checkbox"
                  checked={f.initializeForwarder}
                  onChange={(e) => set('initializeForwarder', e.target.checked)}
                />
                Initialize Forwarder (FWD) Record
              </label>
            </Group>
          )}

          {/* Hidden, not unmounted, as upstream hides it (zone.js:26-41): the input
              keeps the file it shows across type changes. */}
          <div hidden={!v.zoneFile}>
            <Field label="Import Zone File (Optional)">
              {(id) => (
                <FilePick id={id} onChange={(e) => setZoneFile(e.target.files?.[0] ?? null)} />
              )}
            </Field>
          </div>

          {v.soaSerial && (
            <Group label="Zone Serial">
              <label className={z.chk}>
                <input
                  type="checkbox"
                  checked={f.useSoaSerialDateScheme}
                  onChange={(e) => set('useSoaSerialDateScheme', e.target.checked)}
                />
                Use SOA Serial Date Scheme
              </label>
            </Group>
          )}

          {v.primaryServers && (
            <Field
              label={
                v.primaryServersRequired
                  ? 'Primary Name Server Addresses'
                  : 'Primary Name Server Addresses (Optional)'
              }
            >
              {(id) => (
                <>
                  <Textarea
                    id={id}
                    mono
                    className={z.area}
                    spellCheck={false}
                    value={f.primaryNameServerAddresses}
                    onChange={(e) => set('primaryNameServerAddresses', e.target.value)}
                  />
                  <div className={z.help}>
                    {v.primaryServersRequired
                      ? 'Enter the primary name server addresses to sync the zone from.'
                      : 'Enter the primary name server addresses to sync the zone from. When unspecified, the SOA Primary Name Server will be resolved and used.'}
                  </div>
                </>
              )}
            </Field>
          )}

          {v.transferProtocol && (
            <Group label="Zone Transfer Protocol" radios={z.run}>
              {TRANSFER_PROTOCOLS.map((p) => (
                <label key={p.value} className={z.chk}>
                  <input
                    type="radio"
                    name="addZoneTransferProtocol"
                    checked={f.zoneTransferProtocol === p.value}
                    onChange={() => set('zoneTransferProtocol', p.value)}
                  />
                  {p.label}
                </label>
              ))}
            </Group>
          )}

          {v.tsig && (
            <Field label="TSIG Key Name (Optional)">
              {(id) => (
                <Select id={id} value={f.tsigKeyName} onChange={(e) => set('tsigKeyName', e.target.value)}>
                  <option value="" />
                  {tsigKeys.map((k) => (
                    <option key={k} value={k}>
                      {k}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          )}

          {v.validateZone && (
            <Group label="Zone Validation">
              <label className={z.chk}>
                <input
                  type="checkbox"
                  checked={f.validateZone}
                  onChange={(e) => set('validateZone', e.target.checked)}
                />
                {/* Wrapped, so the link stays inside its sentence (`.chk` is flex). */}
                <span>
                  Use <External href={RFC_ZONEMD}>ZONEMD</External> to Validate Zone
                </span>
              </label>
              <div className={z.help}>
                When enabled, the secondary zone will be validated using the ZONEMD record after every
                zone transfer. The zone will get disabled if the validation fails. The zone must be DNSSEC
                signed for the validation to work.
              </div>
            </Group>
          )}

          {v.forwarderFields && (
            <>
              <Group label="Protocol" radios={z.run}>
                {FORWARDER_PROTOCOLS.map((p) => (
                  <label key={p.value} className={z.chk}>
                    <input
                      type="radio"
                      name="addZoneForwarderProtocol"
                      disabled={f.useThisServer}
                      checked={f.forwarderProtocol === p.value}
                      onChange={() => set('forwarderProtocol', p.value)}
                    />
                    {p.label}
                  </label>
                ))}
              </Group>

              {/* Two help paragraphs: upstream's two, one about "This Server" and
                  another about adding more forwarders later. */}
              <Field label="Forwarder">
                {(id) => (
                  <>
                    <Input
                      id={id}
                      mono
                      disabled={f.useThisServer}
                      placeholder={forwarderExample(f.forwarderProtocol)}
                      value={f.useThisServer ? 'this-server' : f.forwarder}
                      onChange={(e) => set('forwarder', e.target.value)}
                    />
                    <label className={z.chk}>
                      <input
                        type="checkbox"
                        checked={f.useThisServer}
                        onChange={(e) => {
                          /* `updateAddZoneFormForwarderThisServer` (zone.js:2979-2998):
                             ticked, the protocol goes to UDP; unticked, the field is emptied. */
                          const on = e.target.checked
                          setF((prev) =>
                            on
                              ? { ...prev, useThisServer: true, forwarderProtocol: 'Udp' }
                              : { ...prev, useThisServer: false, forwarder: '' },
                          )
                        }}
                      />
                      Use &quot;This Server&quot;
                    </label>
                    <div className={z.help}>
                      <p>
                        When using &quot;This Server&quot;, if a record does not exists in the zone then the
                        request is forwarded to the DNS Server&apos;s resolver internally. This allows you to
                        override any record for the forwarded domain name or control its DNSSEC validation.
                      </p>
                      <p>
                        Enter a forwarder server address above. You can add more forwarders by adding FWD
                        records after the zone is added.
                      </p>
                    </div>
                  </>
                )}
              </Field>

              <Group label="DNSSEC">
                <label className={z.chk}>
                  <input
                    type="checkbox"
                    checked={f.dnssecValidation}
                    onChange={(e) => set('dnssecValidation', e.target.checked)}
                  />
                  Enable DNSSEC Validation
                </label>
              </Group>

              {/* "this-server" takes no proxy: upstream hides the whole block. */}
              {!f.useThisServer && (
                <Group label="Network Proxy">
                  <div className={z.run}>
                    {PROXY_TYPES.map((p) => (
                      <label key={p.value} className={z.chk}>
                        <input
                          type="radio"
                          name="addZoneProxyType"
                          checked={f.proxyType === p.value}
                          onChange={() => set('proxyType', p.value)}
                        />
                        {p.label}
                      </label>
                    ))}
                  </div>
                  <div className={`${z.pair} ${z.pairShort}`}>
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
                          disabled={!proxyEditable(f.proxyType)}
                          value={f.proxyPort}
                          onChange={(e) => set('proxyPort', e.target.value)}
                        />
                      )}
                    </Field>
                  </div>
                  <div className={z.pair}>
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
                  </div>
                </Group>
              )}
            </>
          )}
        </section>

        {/* Upstream closes this dialog with its help link (`modalAddZone`). */}
        <HelpText href="https://blog.technitium.com/2022/06/how-to-self-host-your-own-domain-name.html">
          Help: How To Self Host Your Own Domain Name
        </HelpText>
      </div>
    </Dialog>
  )
}
