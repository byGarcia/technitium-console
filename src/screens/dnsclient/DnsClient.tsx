import { ClusterNodeSelect } from '../../ui/ClusterNodeSelect'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { DnsClientRequest } from '../../app/handoff'
import { PROTOCOLS, TYPES, prepareServer, resolve } from '../../api/dnsclient'
import { Button } from '../../ui/Button'
import { Check } from '../../ui/Check'
import { Confirm } from '../../ui/Confirm'
import { Field, Input, LabeledInput, LabeledSelect } from '../../ui/Field'
import { Menu } from '../../ui/Menu'
import { loadQuickList, protocolForServer, serverListOptions, type QuickServer } from '../../lib/quick-lists'
import { SectionHeader } from '../../ui/SectionHeader'
import { Empty, Loading } from '../../ui/Empty'
import { Icon } from '../../ui/Icon'
import styles from './DnsClient.module.css'
import { noticeFromFailure, type Notice } from '../../lib/notice'
import { Notifier } from '../../ui/Notifier'
import { asDatagram, stripUrl } from './response'
import { ResponseSummary } from './ResponseSummary'
import { ResponseSections } from './ResponseSections'
import { RawResponses } from './RawResponses'

/*
A replica of `resolveQuery()` (dnsclient.js:95-210). Both buttons call the same
endpoint: "Import" only adds `import=true`, after upstream's confirmation.

The alert texts, the confirmation and the buttons' busy labels are upstream
literals.

`request` is `queryDnsServer` (dnsclient.js:231-257), the jump other screens' row
menus make: the form starts filled with it and the query runs on arrival.

What this screen draws of the answer is deviation 18 in CONVENTIONS.md: the cards
(`ResponseSummary.tsx`), the sections and the JSON (`ResponseSections.tsx`) and the
raw responses (`RawResponses.tsx`), all read from the one response.
*/

/** What a query sends, fixed at the moment upstream would have read the form. */
interface Query {
  server: string
  /** The field as typed, which joins the server list (dnsclient.js:216-227). */
  serverText: string
  domain: string
  type: string
  protocol: string
  dnssec: boolean
  ecs: string
  node: string
}

interface Shown {
  result: unknown
  raw: unknown[]
  /** For the JSON block's name: which query this answer is. */
  domain: string
  type: string
  /** A new answer remounts the sections and folds the raw responses again, as upstream does. */
  seq: number
}

export function DnsClient({
  token,
  nodes = [],
  clusterInitialised = false,
  request,
}: {
  token: string | null
  /** The cluster nodes, for the node selector. */
  nodes?: { name: string; type: string }[]
  clusterInitialised?: boolean
  /** A query another screen asked for: fill the form with it and run it. */
  request?: DnsClientRequest
}) {
  /* Upstream mounts one here (`optDnsClientClusterNode`), no aggregate, no
     persistence. The jump picks a node only when it was given one. */
  const [clusterNode, setClusterNode] = useState<string>(() => request?.node ?? '')

  const [server, setServer] = useState('This Server {this-server}')
  /* Upstream focuses the field a validation names (dnsclient.js:123 and 129). */
  const serverField = useRef<HTMLInputElement>(null)
  const domainField = useRef<HTMLInputElement>(null)

  /*
  The known name servers. Upstream attaches a dropdown to this field
  (`index.html:840-846`, filled by `dnsclient.js:78`). The field stays free text:
  the list only fills it. A server typed by hand joins the top of the list once a
  query is sent with it (dnsclient.js:216-227).
  */
  const [servers, setServers] = useState<string[]>([])
  const combo = useRef<HTMLDivElement>(null)
  useEffect(() => {
    let alive = true
    void loadQuickList<QuickServer>('dnsclient-server-list').then(
      (e) => {
        if (!alive) return
        const known = serverListOptions(e)
        // A server typed and queried before the list arrived stays on top of it.
        setServers((typed) => [...typed.filter((t) => !known.includes(t)), ...known])
      },
    )
    return () => {
      alive = false
    }
  }, [])
  const [domain, setDomain] = useState(() => request?.domain ?? '')
  const [type, setType] = useState(() => request?.type ?? 'A')
  const [protocol, setProtocol] = useState('UDP')
  const [ecs, setEcs] = useState('')
  /* The one field the jump does not leave at its default: it UNCHECKS validation
     (dnsclient.js:240). */
  const [dnssec, setDnssec] = useState(() => request == null)
  const [shown, setShown] = useState<Shown | null>(null)
  const [alert, setAlert] = useState<Notice | null>(null)
  /* Which button is busy: it reads `Resolving...` or `Importing...` (index.html:915-916)
     and the other one is disabled. */
  const [busy, setBusy] = useState<'resolve' | 'import' | null>(null)
  /* The import waiting for upstream's `confirm()`. */
  const [asking, setAsking] = useState<Query | null>(null)
  const seq = useRef(0)

  function fire(runImport: boolean) {
    /* The dropdown itself moves to UDP for these two, before anything is checked
       (dnsclient.js:101-102). */
    if (server.includes('recursive-resolver') || server.includes('system-dns')) setProtocol('UDP')

    // The order is upstream's: extract first, check afterwards.
    const ready = prepareServer(server, protocol)

    if (ready.server === '') {
      setAlert({ type: 'warning', title: 'Missing!', text: 'Please enter a valid Name Server.' })
      serverField.current?.focus()
      return
    }
    /* Upstream compares with "" and does not trim: a domain of spaces travels and
       the server answers it. */
    if (domain === '') {
      setAlert({ type: 'warning', title: 'Missing!', text: 'Please enter a domain name to query.' })
      domainField.current?.focus()
      return
    }

    const name = stripUrl(domain)
    if (name !== domain) setDomain(name)

    const q: Query = {
      server: ready.server,
      serverText: server,
      domain: name,
      type,
      protocol: ready.protocol,
      dnssec,
      ecs,
      node: clusterNode,
    }
    if (runImport) setAsking(q)
    else void send(q, false)
  }

  async function send(q: Query, runImport: boolean) {
    // Add the server to the list if it is not there yet (dnsclient.js:216-227).
    setServers((list) => (list.includes(q.serverText) ? list : [q.serverText, ...list]))

    setBusy(runImport ? 'import' : 'resolve')
    setShown(null)
    const outcome = await resolve(token, {
      server: q.server,
      domain: q.domain,
      type: q.type,
      protocol: q.protocol,
      dnssec: q.dnssec,
      eDnsClientSubnet: q.ecs,
      runImport,
      node: q.node,
    })
    setBusy(null)

    if (outcome.kind !== 'ok') {
      setAlert(noticeFromFailure(outcome))
      return
    }

    const r = outcome.data.response
    seq.current += 1
    setShown({ result: r.result, raw: r.rawResponses ?? [], domain: q.domain, type: q.type, seq: seq.current })

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

  /* `resolveQuery()` on arrival (dnsclient.js:256), once per request. The ref
     outlives the development double-run of effects, so it is still once there. */
  const ran = useRef<DnsClientRequest | null>(null)
  useEffect(() => {
    if (request == null || ran.current === request) return
    ran.current = request
    fire(false)
    // Only a new request runs it; `fire` reads the state this render holds.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request])

  /* Upstream's Resolve is the form's submit button: Enter in any field resolves. */
  function submit(e: FormEvent) {
    e.preventDefault()
    if (busy == null) fire(false)
  }

  const d = shown == null ? null : asDatagram(shown.result)
  const datagram = d != null && typeof d.RCODE === 'string' ? d : null

  return (
    <>
      <SectionHeader title="DNS Client" />

      <Notifier notice={alert} onClose={() => setAlert(null)} />

      {/*
      THE QUERY BAR (deviation 18): what is asked on the first line, how it is asked
      on the second, and the two verbs at its end. The same fields, labels, options
      and order as upstream's form (index.html:838-919), its node selector beside
      the buttons as upstream has it.
      */}
      <form className={styles.bar} onSubmit={submit} aria-label="Query">
        <div className={styles.ask}>
          <div className={styles.server}>
            {/*
            A field with a menu hanging off it, as upstream's (`index.html:840-846`):
            the field stays free text, and the arrow opens EVERY server whatever the
            field holds (a `<datalist>` filters by the field's text, issue #15).
            Choosing also moves the protocol (`dnsclient.js:30-46`).
            */}
            <Field label="Server">
              {(id) => (
                <div className={styles.combo} ref={combo}>
                  <Input id={id} ref={serverField} mono value={server} onChange={(e) => setServer(e.target.value)} />
                  <Menu label="Server list" icon="chevronDown" anchor="left" alignTo={combo}>
                    {(close) =>
                      servers.map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => {
                            setServer(s)
                            setProtocol((p) => protocolForServer(s, p))
                            close()
                          }}
                        >
                          {s}
                        </button>
                      ))
                    }
                  </Menu>
                </div>
              )}
            </Field>
          </div>
          <div className={styles.domain}>
            <Field label="Domain">
              {(id) => (
                <Input
                  id={id}
                  ref={domainField}
                  placeholder="example.com"
                  mono
                  search
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                />
              )}
            </Field>
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
        </div>
        <div className={styles.how}>
          <div className={styles.ecs}>
            <LabeledInput label="EDNS Client Subnet" mono value={ecs} onChange={(e) => setEcs(e.target.value)} />
          </div>
          <div className={styles.check}>
            <Check label="Enable DNSSEC Validation" checked={dnssec} onChange={setDnssec} />
          </div>
          <div className={styles.verbs}>
            <ClusterNodeSelect
              nodes={nodes}
              initialised={clusterInitialised}
              value={clusterNode}
              onChange={setClusterNode}
              label="Cluster Node"
            />
            <Button type="submit" lead="run" variant="primary" disabled={busy != null}>
              {busy === 'resolve' ? 'Resolving...' : 'Resolve'}
            </Button>
            <Button type="button" lead="download" disabled={busy != null} onClick={() => fire(true)}>
              {busy === 'import' ? 'Importing...' : 'Import'}
            </Button>
          </div>
        </div>
      </form>

      {/* Upstream hides the answer while a query travels and shows its loader. */}
      {busy != null ? (
        <Loading />
      ) : shown == null ? (
        <Empty>
          <span className={styles.hint}>
            <Icon name="dnsclient" size={16} />
            Run a query to see the response.
          </span>
        </Empty>
      ) : (
        <div key={shown.seq} className={styles.answer}>
          {datagram != null && <ResponseSummary d={datagram} />}
          <ResponseSections
            d={datagram}
            json={JSON.stringify(shown.result, null, 2)}
            label={`DNS response for ${shown.domain} ${shown.type}`}
          />
          {shown.raw.length > 0 && <RawResponses responses={shown.raw} />}
        </div>
      )}

      <Confirm
        open={asking != null}
        title="Import"
        text={`Importing all the records from the response of this query will add them into an existing primary or conditional forwarder zone. If a matching zone does not exists, a new primary zone for '${asking?.domain ?? ''}' will be created.\n\nAre you sure you want to import all records?`}
        label="Import"
        variant="primary"
        onClose={() => setAsking(null)}
        onConfirm={() => {
          const q = asking
          setAsking(null)
          if (q != null) void send(q, true)
        }}
      />
    </>
  )
}
