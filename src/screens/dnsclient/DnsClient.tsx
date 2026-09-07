import { ClusterNodeSelect } from '../../ui/ClusterNodeSelect'
import { useEffect, useState } from 'react'
import { PROTOCOLS, TYPES, prepararServidor, resolve } from '../../api/dnsclient'
import { type AlertType } from '../../ui/Alert'
import { Button } from '../../ui/Button'
import { Check } from '../../ui/Check'
import { LabeledInput, LabeledSelect } from '../../ui/Field'
import { loadQuickList, serverListOptions, type QuickServer } from '../../lib/quick-lists'
import { SectionHeader } from '../../ui/SectionHeader'
import { Empty } from '../../ui/Empty'
import { Raw } from '../../ui/Raw'
import { Details } from '../../ui/Details'
import styles from './DnsClient.module.css'
import { Body, Panel } from '../../ui/Panel'
import { noticeFromFailure } from '../../lib/notice'
import { Notifier } from '../../ui/Notifier'

/*
A replica of `resolveQuery()` (dnsclient.js:95-210). Both buttons call the same
endpoint: "Import" only adds `import=true`.

The alert texts are upstream literals.
*/
interface AlertState { type: AlertType; title: string; text: string }

export function DnsClient({
  token,
  nodes = [],
  clusterInitialised = false,
}: {
  token: string | null
  /** The cluster nodes, for the node selector. Spec F10. */
  nodes?: { name: string; type: string }[]
  clusterInitialised?: boolean
}) {
  /* Upstream mounts one here (`optDnsClientClusterNode`), no aggregate, no
     persistence. Spec F10. */
  const [clusterNode, setClusterNode] = useState<string>('')

  const [server, setServer] = useState('This Server {this-server}')

  /*
  The known name servers. Upstream attaches a dropdown to this field
  (`index.html:840-846`, filled by `dnsclient.js:78`) and this console kept the
  field and lost the list. The field stays free text: the list only fills it.
  See spec F8.
  */
  const [servers, setServers] = useState<string[]>([])
  useEffect(() => {
    let alive = true
    void loadQuickList<QuickServer>('dnsclient-server-list').then(
      (e) => alive && setServers(serverListOptions(e)),
    )
    return () => {
      alive = false
    }
  }, [])
  const [domain, setDomain] = useState('')
  const [type, setType] = useState('A')
  const [protocol, setProtocol] = useState('UDP')
  const [ecs, setEcs] = useState('')
  const [dnssec, setDnssec] = useState(true)
  const [output, setSalida] = useState<string | null>(null)
  /*
  The raw responses of each hop of the resolution.

  Upstream shows them in the second panel of its accordion —"Raw Responses (N)",
  collapsed and hidden if there are none (`dnsclient.js:178-194`)— and here it was
  missing entirely: the API type already declared `rawResponses`, but nobody drew
  it. It is what lets you see what each server answered along the way when a
  recursive query goes wrong, which is exactly when this screen gets opened.
  */
  const [raw, setCrudas] = useState<unknown[]>([])
  const [alert, setAlert] = useState<AlertState | null>(null)
  const [busy, setBusy] = useState(false)

  async function fire(runImport: boolean) {
    // The order is upstream's: extract first, check afterwards.
    const ready = prepararServidor(server, protocol)

    if (ready.server === '') {
      setAlert({ type: 'warning', title: 'Missing!', text: 'Please enter a valid Name Server.' })
      return
    }
    if (domain.trim() === '') {
      setAlert({ type: 'warning', title: 'Missing!', text: 'Please enter a domain name to query.' })
      return
    }

    setBusy(true)
    setAlert(null)
    const outcome = await resolve(token, {
      server: ready.server,
      domain,
      type,
      protocol: ready.protocol,
      dnssec,
      eDnsClientSubnet: ecs,
      runImport,
    })
    setBusy(false)

    if (outcome.kind !== 'ok') {
      setSalida(null)
      setCrudas([])
      setAlert(noticeFromFailure(outcome))
      return
    }

    const r = outcome.data.response
    setSalida(JSON.stringify(r.result, null, 2))
    setCrudas(r.rawResponses ?? [])

    if (r.warningMessage) {
      setAlert({ type: 'warning', title: 'Warning!', text: r.warningMessage })
    } else if (runImport) {
      setAlert({
        type: 'success',
        title: 'Records Imported!',
        text: 'Resource records resolved by this DNS client query were successfully imported into this server.',
      })
    }
  }

  return (
    <>
      <SectionHeader title="DNS Client" />

      <ClusterNodeSelect
        nodes={nodes}
        initialised={clusterInitialised}
        value={clusterNode}
        onChange={setClusterNode}
        label="Cluster Node"
      />

      <Notifier notice={alert} onClose={() => setAlert(null)} />

      {/*
      The query bar used labels made by hand with inline `style` —`fontSize: 11`,
      `gap: 5`, `marginBottom: 1`— instead of the system's fields. They were six
      values off the scale on a single screen, and that is why the "Type" and
      "DNS-over-" labels did not match the ones next to them.
      */}
      <div className={styles.flt}>
        <div className={styles.width}>
          <LabeledInput
            label="Server"
            mono
            value={server}
            onChange={(e) => setServer(e.target.value)}
            list="dnsclient-servers"
          />
          {/* A datalist and not a select: upstream's control is a text field with
              a dropdown attached, so an address that is not on the list can still
              be typed. Replacing it with a select would take that away. */}
          <datalist id="dnsclient-servers">
            {servers.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </div>
        <div className={styles.medio}>
          <LabeledInput label="Domain" placeholder="example.com" mono value={domain} onChange={(e) => setDomain(e.target.value)} />
        </div>
        <div className={styles.short}>
          <LabeledSelect label="Type" value={type} onChange={(e) => setType(e.target.value)}>
            {TYPES.map((t) => <option key={t}>{t}</option>)}
          </LabeledSelect>
        </div>
        <div className={styles.short}>
          <LabeledSelect label="DNS-over-" value={protocol} onChange={(e) => setProtocol(e.target.value)}>
            {PROTOCOLS.map((t) => <option key={t}>{t}</option>)}
          </LabeledSelect>
        </div>
        <div className={styles.ecs}>
          <LabeledInput label="EDNS Client Subnet" mono value={ecs} onChange={(e) => setEcs(e.target.value)} />
        </div>
          {/* It was a bare `<input>` inside a `<label>` with its own `.chk`: a
              THIRD name for the same gesture, and the only one in the console
              that came out at 34 px high. */}
        <Check label="Enable DNSSEC Validation" checked={dnssec} onChange={setDnssec} />
        <Button variant="primary" disabled={busy} onClick={() => void fire(false)}>
          Resolve
        </Button>
        <Button disabled={busy} onClick={() => void fire(true)}>
          Import
        </Button>
      </div>

      {output === null ? (
        <Empty>Run a query to see the response.</Empty>
      ) : (
        <Panel
          title="Response"
          actions={<span className={styles.meta}>{protocol} · {type}</span>}
          className={styles.panel}
        >
          <Body>
            {/* The label says which response it is: with `Import` and several
                queries in a row, a plain "DNS response" tells none of them apart. */}
            <Raw text={`DNS response for ${domain} ${type}`}>{output}</Raw>

            {raw.length > 0 && (
              <Details className={styles.raw} summary={`Raw Responses (${raw.length})`}>
                {raw.map((c, i) => (
                  <Raw key={i} text={`Raw response ${i + 1} of ${raw.length}`} height={220}>
                    {JSON.stringify(c, null, 2)}
                  </Raw>
                ))}
              </Details>
            )}
          </Body>
        </Panel>
      )}
    </>
  )
}
