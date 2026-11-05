import { useEffect, useState, type ReactNode } from 'react'
import { getZoneOptions, setZoneOptions, type ZoneOptions as Response } from '../../../api/zones'
import { Alert } from '../../../ui/Alert'
import { Button } from '../../../ui/Button'
import { Dialog } from '../../../ui/Dialog'
import { Field, Input, Select, Textarea } from '../../../ui/Field'
import { Loading } from '../../../ui/Empty'
import {
  QUERY_ACCESS,
  UPDATES,
  NOTIFICATIONS,
  TABS,
  XFR_PROTOCOLS,
  TRANSFERS,
  aclEditable,
  applyQuickTsigKey,
  buildOptionsBody,
  chooseCatalog,
  liveOptionsState,
  optionsState,
  formFromOptions,
  notifyWithList,
  type OptionsState,
  type OptionsForm,
  type OptionsTab,
  type CriterionOption,
} from '../options'
import type { Notice } from '../types'
import l from './layout.module.css'
import styles from './ZoneOptions.module.css'
import { External } from '../../../ui/External'
import { RFC_ZONEMD } from '../references'
import { Segmented } from '../../../ui/Segmented'
import { noticeFromFailure } from '../../../lib/notice'
import { Notifier } from '../../../ui/Notifier'

/*
`modalZoneOptions` (zone.js:1524 and 2380). Five tabs and a visibility matrix
that `options.ts` decides.

**The form is A SINGLE ONE**: "Save" sends the fields of all five tabs wherever
you are, just as in Settings. Chopping it up per tab would change what gets
saved.

And for that very reason, if the validation fails on a tab that is not in front,
it jumps to it: it is the same deliberate deviation decided in Settings, and for
the same reason: with one panel mounted at a time, without the jump the alert
would be impossible to resolve.
*/

export function ZoneOptions({
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
  const [response, setResponse] = useState<Response | null>(null)
  const [f, setF] = useState<OptionsForm | null>(null)
  const [tab, setTab] = useState<OptionsTab>('General')
  const [notice, setNotice] = useState<Notice | null>(null)
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  /* Quick Add's line stays shown, as upstream's select does; it is rebuilt blank
     each time the options load (zone.js:2100). */
  const [quickTsig, setQuickTsig] = useState('')

  useEffect(() => {
    if (!open) return
    setNotice(null)
    setQuickTsig('')
    setLoading(true)
    void getZoneOptions(token, zone, node).then((r) => {
      setLoading(false)
      if (r == null) {
        setNotice({ type: 'danger', title: 'Error!', text: 'Unable to connect to the server. Please try again.' })
        return
      }
      setResponse(r)
      setF(formFromOptions(r))
      setTab(optionsState(r).initialTab)
    })
  }, [open, token, zone, node])

  /* The tabs and the overrides follow the form's catalog (zone.js:199-286). */
  const e: OptionsState | null = response ? (f ? liveOptionsState(response, f) : optionsState(response)) : null

  const set = <K extends keyof OptionsForm>(k: K, value: OptionsForm[K]) =>
    setF((prev) => (prev == null ? prev : { ...prev, [k]: value }))

  async function save() {
    if (f == null || response == null) return

    const r = buildOptionsBody(f, response.type)
    if ('error' in r) {
      setTab(r.error.tab)
      setNotice({ type: 'warning', title: r.error.title, text: r.error.text })
      return
    }

    setBusy(true)
    const outcome = await setZoneOptions(token, { zone, ...r.body }, node)
    setBusy(false)

    if (outcome.kind !== 'ok') {
      setNotice(noticeFromFailure(outcome))
      return
    }

    onClose()
    onDone({ type: 'success', title: 'Options Saved!', text: 'Zone options were saved successfully.' })
  }

  const availableTsigKeys = response?.availableTsigKeyNames ?? []
  const availableCatalogs = response?.availableCatalogZoneNames ?? []

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !o && onClose()}
      size="medium"
      title={`Zone Options - ${zone === '.' ? '<root>' : zone}`}
      actions={
        <>
          <Button variant="primary" disabled={busy || f == null} onClick={() => void save()}>
            Save
          </Button>
        </>
      }
    >
      <Notifier notice={notice} onClose={() => setNotice(null)} />

      {loading || f == null || e == null ? (
        <Loading>Loading zone options…</Loading>
      ) : (
        <>
          {/* A segmented control, not the pagination button's class: a tab
              and a page number are not the same thing. Drawn flat, as the
              dialog's sections, and pinned while its tab scrolls. */}
          <div className={styles.tabs}>
            <Segmented
              asTabs
              flat
              label="Zone options"
              options={TABS.filter((t) => e.tabs.includes(t.id)).map((t) => ({
                id: t.id,
                label: t.label,
              }))}
              active={tab}
              onChoose={setTab}
            />
          </div>

          <div className={`${l.content} ${styles.panel}`}>
            {tab === 'General' && (
              <>
                {e.catalog && (
                  <section className={l.section}>
                    <div className={`${l.field} ${l.narrow}`}>
                      <Field label="Catalog Zone">
                        {(id) => (
                          <Select
                            id={id}
                            disabled={e.catalogLocked}
                            value={f.catalog}
                            onChange={(ev) => {
                              const catalog = ev.target.value
                              setF((prev) => (prev == null ? prev : chooseCatalog(prev, catalog)))
                            }}
                          >
                            <option value="" />
                            {(e.catalogLocked && f.catalog !== ''
                              ? [f.catalog]
                              : availableCatalogs
                            ).map((c) => (
                              <option key={c} value={c}>
                                {c}
                              </option>
                            ))}
                          </Select>
                        )}
                      </Field>
                      {/* The General tab's explanations, index.html:5313-5348 in v15.5.1. */}
                      <div className={l.help}>Select a Catalog zone to register as its member zone.</div>
                    </div>

                    {(e.overrideQueryAccess || e.overrideZoneTransfer || e.overrideNotify) && (
                      <div className={l.block}>
                        {e.overrideQueryAccess && (
                          <div>
                            <label className={l.check}>
                              <input
                                type="checkbox"
                                disabled={e.overrideLocked}
                                checked={f.overrideCatalogQueryAccess}
                                onChange={(ev) => set('overrideCatalogQueryAccess', ev.target.checked)}
                              />
                              Override Query Access Option
                            </label>
                            <div className={l.checkHelp}>Enable to override Query Access option in the Catalog zone.</div>
                          </div>
                        )}
                        {e.overrideZoneTransfer && (
                          <div>
                            <label className={l.check}>
                              <input
                                type="checkbox"
                                disabled={e.overrideLocked}
                                checked={f.overrideCatalogZoneTransfer}
                                onChange={(ev) => set('overrideCatalogZoneTransfer', ev.target.checked)}
                              />
                              Override Zone Transfer Option
                            </label>
                            <div className={l.checkHelp}>Enable to override Zone Transfer option in the Catalog zone.</div>
                          </div>
                        )}
                        {e.overrideNotify && (
                          <div>
                            <label className={l.check}>
                              <input
                                type="checkbox"
                                disabled={e.overrideLocked}
                                checked={f.overrideCatalogNotify}
                                onChange={(ev) => set('overrideCatalogNotify', ev.target.checked)}
                              />
                              Override Notify Option
                            </label>
                            <div className={l.checkHelp}>Enable to override Notify option in the Catalog zone.</div>
                          </div>
                        )}
                      </div>
                    )}
                    <Alert type="info" title="Note!">
                      When a zone becomes a member of a Catalog zone, all of the Catalog zone&apos;s Options are
                      inherited unless they are explicitly overridden using the Override Options.
                    </Alert>
                  </section>
                )}

                {e.primaryServer && (
                  <section className={l.section}>
                    <div className={l.field}>
                      <Field
                        label={
                          e.primaryServerRequired
                            ? 'Primary Name Server Addresses'
                            : 'Primary Name Server Addresses (Optional)'
                        }
                      >
                        {(id) => (
                          <Textarea
                            id={id}
                            mono
                            className={l.area}
                            disabled={e.primaryServerLocked}
                            value={f.primaryNameServerAddresses}
                            onChange={(ev) => set('primaryNameServerAddresses', ev.target.value)}
                          />
                        )}
                      </Field>
                      <div className={l.help}>
                        {e.primaryServerRequired
                          ? 'Enter the primary name server addresses to sync the zone from.'
                          : 'Enter the primary name server addresses to sync the zone from. When unspecified, the SOA Primary Name Server will be resolved and used.'}
                      </div>
                    </div>

                    {(e.xfrProtocol || e.tsigFromPrimary) && (
                      <div className={l.row2}>
                        {e.xfrProtocol && (
                          <div className={l.group}>
                            <div className={l.groupLabel}>Zone Transfer Protocol</div>
                            <div className={l.across}>
                              {XFR_PROTOCOLS.map((x) => (
                                <label key={x.value} className={l.check}>
                                  <input
                                    type="radio"
                                    name="zoneOptionsXfr"
                                    disabled={e.primaryServerLocked}
                                    checked={f.primaryZoneTransferProtocol === x.value}
                                    onChange={() => set('primaryZoneTransferProtocol', x.value)}
                                  />
                                  {x.label}
                                </label>
                              ))}
                            </div>
                          </div>
                        )}

                        {e.tsigFromPrimary && (
                          <Field label="TSIG Key Name (Optional)">
                            {(id) => (
                              <Select
                                id={id}
                                disabled={e.primaryServerLocked}
                                value={f.primaryZoneTransferTsigKeyName}
                                onChange={(ev) => set('primaryZoneTransferTsigKeyName', ev.target.value)}
                              >
                                <option value="" />
                                {availableTsigKeys.map((k) => (
                                  <option key={k} value={k}>
                                    {k}
                                  </option>
                                ))}
                              </Select>
                            )}
                          </Field>
                        )}
                      </div>
                    )}

                    {e.validateZone && (
                      <div className={l.block}>
                        <div>
                          <label className={l.check}>
                            <input
                              type="checkbox"
                              disabled={e.primaryServerLocked}
                              checked={f.validateZone}
                              onChange={(ev) => set('validateZone', ev.target.checked)}
                            />
                            Use <External href={RFC_ZONEMD}>ZONEMD</External> to Validate Zone
                          </label>
                          {/* index.html:5402 in v15.5.1. */}
                          <div className={l.checkHelp}>
                            When enabled, the secondary zone will be validated using the ZONEMD record after every
                            zone transfer. The zone will get disabled if the validation fails. The zone must be DNSSEC
                            signed for the validation to work.
                          </div>
                        </div>
                      </div>
                    )}
                  </section>
                )}
              </>
            )}

            {tab === 'Query Access' && (
              <section className={l.section}>
                <Criterion
                  name="zoneOptionsQueryAccess"
                  options={QUERY_ACCESS.filter(
                    (o) => e.queryAccessWithNameServers || !o.value.includes('ZoneNameServers'),
                  )}
                  value={f.queryAccess}
                  locked={e.queryAccessLocked}
                  onChanged2={(v) => set('queryAccess', v)}
                  list={f.queryAccessNetworkACL}
                  listLabel="Network Access Control List (ACL)"
                  listHelp={ACL_HELP}
                  editableList={aclEditable(f.queryAccess) && !e.queryAccessLocked}
                  onList={(v) => set('queryAccessNetworkACL', v)}
                />
                {/* index.html:5467 in v15.5.1. */}
                <Alert type="info" title="Note!">
                  The zone can always be queried from loopback IP addresses and internally by the DNS
                  Server irrespective of the Query Access configuration.
                </Alert>
              </section>
            )}

            {tab === 'Zone Transfer' && (
              <>
                <section className={l.section}>
                  <Criterion
                    name="zoneOptionsZoneTransfer"
                    options={TRANSFERS.filter(
                      (o) => e.zoneTransferWithNameServers || !o.value.includes('ZoneNameServers'),
                    )}
                    value={f.zoneTransfer}
                    locked={e.zoneTransferLocked}
                    onChanged2={(v) => set('zoneTransfer', v)}
                    list={f.zoneTransferNetworkACL}
                    listLabel="Network Access Control List (ACL)"
                    listHelp={ACL_HELP}
                    editableList={aclEditable(f.zoneTransfer) && !e.zoneTransferLocked}
                    onList={(v) => set('zoneTransferNetworkACL', v)}
                  />
                  {/* index.html:5522 in v15.5.1. */}
                  <Alert type="info" title="Note!">
                    Zone transfer should be allowed only for trusted name servers to sync their secondary zone.
                  </Alert>
                </section>
                <section className={l.section}>
                  <Field label="Zone Transfer TSIG Key Names">
                    {(id) => (
                      <Textarea
                        id={id}
                        mono
                        className={l.area}
                        disabled={e.zoneTransferLocked}
                        value={f.zoneTransferTsigKeyNames}
                        onChange={(ev) => set('zoneTransferTsigKeyNames', ev.target.value)}
                      />
                    )}
                  </Field>
                  {/* "Quick Add" only adds to the list above: it sends nothing. */}
                  <div className={styles.quick}>
                    <Field label="Quick Add">
                      {(id) => (
                        <Select
                          id={id}
                          disabled={e.zoneTransferLocked}
                          value={quickTsig}
                          onChange={(ev) => {
                            setQuickTsig(ev.target.value)
                            set('zoneTransferTsigKeyNames', applyQuickTsigKey(f.zoneTransferTsigKeyNames, ev.target.value))
                          }}
                        >
                          <option value="" />
                          <option value="none">None</option>
                          {availableTsigKeys.map((k) => (
                            <option key={k} value={k}>
                              {k}
                            </option>
                          ))}
                        </Select>
                      )}
                    </Field>
                  </div>
                  {/* index.html:5537 in v15.5.1. */}
                  <Alert type="info" title="Note!">
                    TSIG key names must be configured from the Settings before using them here. Entering one
                    or more TSIG key names above will cause the DNS Server to authenticate all zone transfer
                    requests. A secondary zone must be configured with one of the above keys to be able to
                    perform a zone transfer.
                  </Alert>
                </section>
              </>
            )}

            {tab === 'Notify' && (
              <section className={l.section}>
                <Criterion
                  name="zoneOptionsNotify"
                  options={NOTIFICATIONS.filter((o) => {
                    if (o.value === 'SeparateNameServersForCatalogAndMemberZones') return e.notifySeparate
                    if (o.value === 'ZoneNameServers' || o.value === 'BothZoneAndSpecifiedNameServers') {
                      return e.notifyWithNameServers
                    }
                    return true
                  })}
                  value={f.notify}
                  locked={false}
                  onChanged2={(v) => set('notify', v)}
                  list={f.notifyNameServers}
                  listLabel="Specified Name Servers"
                  listHelp="Enter only the IP addresses of the name servers above."
                  editableList={notifyWithList(f.notify)}
                  onList={(v) => set('notifyNameServers', v)}
                />
                {e.notifySeparate && (
                  <div className={l.field}>
                    <Field label="Secondary Catalog Name Servers">
                      {(id) => (
                        <Textarea
                          id={id}
                          mono
                          className={l.area}
                          disabled={f.notify !== 'SeparateNameServersForCatalogAndMemberZones'}
                          value={f.notifySecondaryCatalogsNameServers}
                          onChange={(ev) => set('notifySecondaryCatalogsNameServers', ev.target.value)}
                        />
                      )}
                    </Field>
                    <div className={l.help}>
                      Enter only the IP addresses of the Secondary Catalog name servers above.
                    </div>
                  </div>
                )}
                {response?.notifyFailed === true && (
                  <Alert type="warning" title="Notify Failed For:">
                    {(response.notifyFailedFor ?? []).join(', ')}
                  </Alert>
                )}
                {/* index.html:5607 in v15.5.1. */}
                <Alert type="info" title="Note!">
                  Notification must be enabled to allow other name servers to trigger a zone transfer
                  immediately when the zone is updated.
                </Alert>
              </section>
            )}

            {tab === 'Dynamic Updates' && (
              <>
                <section className={l.section}>
                  <Criterion
                    name="zoneOptionsUpdate"
                    options={UPDATES.filter(
                      (o) => e.updateWithNameServers || !o.value.includes('ZoneNameServers'),
                    )}
                    value={f.update}
                    locked={false}
                    onChanged2={(v) => set('update', v)}
                    list={f.updateNetworkACL}
                    listLabel="Network Access Control List (ACL)"
                    listHelp={ACL_HELP}
                    editableList={aclEditable(f.update)}
                    onList={(v) => set('updateNetworkACL', v)}
                  />
                  {/* index.html:5662-5663 in v15.5.1: Note, then Warning, after the list. */}
                  <Alert type="info" title="Note!">
                    Dynamic updates should be allowed only to trusted IP addresses since they will be able to
                    add/delete records in the zone.
                  </Alert>
                  <Alert type="warning" title="Warning!">
                    If no security policy is configured in the Primary Zone then access will be provided only
                    based on the options selected here. Thus setting up a security policy in the Primary Zone
                    is highly recommended.
                  </Alert>
                </section>

                {e.securityPolicies && (
                  <section className={l.section}>
                    <div className={l.title}>Security Policy</div>
                    {f.updateSecurityPolicies.length > 0 && (
                      <div className={styles.policies}>
                        {f.updateSecurityPolicies.map((row, i) => (
                          <div key={i} className={styles.policy}>
                            <Select
                              aria-label={`TSIG key name ${i + 1}`}
                              value={row.tsigKeyName}
                              onChange={(ev) =>
                                set(
                                  'updateSecurityPolicies',
                                  f.updateSecurityPolicies.map((x, j) =>
                                    j === i ? { ...x, tsigKeyName: ev.target.value } : x,
                                  ),
                                )
                              }
                            >
                              <option value="" />
                              {availableTsigKeys.map((k) => (
                                <option key={k} value={k}>
                                  {k}
                                </option>
                              ))}
                            </Select>
                            <Input
                              mono
                              aria-label={`Domain ${i + 1}`}
                              value={row.domain}
                              onChange={(ev) =>
                                set(
                                  'updateSecurityPolicies',
                                  f.updateSecurityPolicies.map((x, j) =>
                                    j === i ? { ...x, domain: ev.target.value } : x,
                                  ),
                                )
                              }
                            />
                            <Input
                              mono
                              aria-label={`Allowed types ${i + 1}`}
                              value={row.allowedTypes}
                              onChange={(ev) =>
                                set(
                                  'updateSecurityPolicies',
                                  f.updateSecurityPolicies.map((x, j) =>
                                    j === i ? { ...x, allowedTypes: ev.target.value } : x,
                                  ),
                                )
                              }
                            />
                            <Button
                              size="sm"
                              variant="danger"
                              lead="trash"
                              onClick={() =>
                                set(
                                  'updateSecurityPolicies',
                                  f.updateSecurityPolicies.filter((_, j) => j !== i),
                                )
                              }
                            >
                              Remove
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className={l.acts}>
                      <Button
                        lead="add"
                        onClick={() =>
                          set('updateSecurityPolicies', [
                            ...f.updateSecurityPolicies,
                            { tsigKeyName: '', domain: zone, allowedTypes: 'ANY' },
                          ])
                        }
                      >
                        Add Policy
                      </Button>
                    </div>
                    {/* index.html:5683 in v15.5.1: inside the Security Policy box. */}
                    <Alert type="info" title="Note!">
                      Configuring a security policy above will cause the DNS Server to authenticate all
                      dynamic update requests. A TSIG key can add/delete records only for the specified domain
                      name and allowed record types. TSIG key names must be configured from the Settings
                      before using them here. Use wildcard domain name to specify all sub domain names. Use a
                      comma separator to specify more than one record type. Use ANY to specify all record
                      types.
                    </Alert>
                  </section>
                )}
              </>
            )}
          </div>
        </>
      )}
    </Dialog>
  )
}

/**
 * All four sections have the same shape: a list of criteria and a text list that
 * can only be touched with some of them.
 */
function Criterion({
  name,
  options,
  value,
  locked,
  onChanged2,
  list,
  listLabel,
  listHelp,
  editableList,
  onList,
}: {
  name: string
  options: CriterionOption[]
  value: string
  locked: boolean
  onChanged2: (v: string) => void
  list: string
  listLabel: string
  /** The explanation upstream prints under the list's textarea. */
  listHelp: ReactNode
  editableList: boolean
  onList: (v: string) => void
}) {
  return (
    <>
      <div className={l.choices}>
        {options.map((o) => (
          <div key={o.value} className={l.choice}>
            <label className={l.check}>
              <input
                type="radio"
                name={name}
                disabled={locked}
                checked={value === o.value}
                onChange={() => onChanged2(o.value)}
              />
              {o.label}
            </label>
            <div className={l.help}>{o.help}</div>
          </div>
        ))}
      </div>
      <div className={l.field}>
        <Field label={listLabel}>
          {(id) => (
            <Textarea
              id={id}
              mono
              className={l.area}
              disabled={!editableList}
              value={list}
              onChange={(ev) => onList(ev.target.value)}
            />
          )}
        </Field>
        <div className={l.help}>{listHelp}</div>
      </div>
    </>
  )
}

/** The ACL explanation of the three ACL lists (index.html:5463, 5518 and 5658 in
 *  v15.5.1). Unlike Settings' version it ends in "deny all.", without "except
 *  loopback". */
const ACL_HELP = (
  <>
    Enter IP addresses or network addresses one below another to allow access. Add <code>!</code>{' '}
    character at the start to deny access, e.g. <code>!192.168.10.0/24</code> will deny entire subnet.
    The ACL is processed in the same order its listed. If no networks match, the default policy is to
    deny all.
  </>
)
