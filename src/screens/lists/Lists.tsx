import { ClusterNodeSelect, primaryNodeName } from '../../ui/ClusterNodeSelect'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  deleteDomain,
  deleteCacheNode,
  parentDomain,
  importDomains,
  cleanList,
  listNode,
  flushCache,
  type List,
  type DomainList,
  type ListNode,
} from '../../api/zonelists'
import { Button } from '../../ui/Button'
import { PermissionButton } from '../../ui/PermissionButton'
import { Confirm } from '../../ui/Confirm'
import { Dialog } from '../../ui/Dialog'
import { Field, Input, LabeledTextarea } from '../../ui/Field'
import { SectionHeader } from '../../ui/SectionHeader'
import { Empty, Loading } from '../../ui/Empty'
import { StaleData } from '../StaleData'
import { Tree } from './Tree'
import { Path } from './Path'
import { ResourceRecords } from './Records'
import styles from './Lists.module.css'
import { noticeFromFailure, type Notice } from '../../lib/notice'
import { Notifier } from '../../ui/Notifier'
import { Icon } from '../../ui/Icon'

/*
Cache, Allowed and Blocked. A single screen because in upstream they are three
copies of the same code (`refreshCachedZonesList`, `refreshAllowedZonesList` and
`refreshBlockedZonesList` are the same function three times, other-zones.js).

What really changes between the three are the TEXTS —and they are not
interchangeable: deleting in Allowed says "Domain 'x' was deleted from Allowed
Zone successfully." and deleting in Blocked says "Blocked zone 'x' was deleted
successfully.". That is why each sentence is written out whole in its place
instead of being composed from templates: a template would have made the
asymmetry uniform and would have changed a text.

And what changes in the BEHAVIOUR is when the Delete button shows: in Cache it
depends on being outside the root (other-zones.js:143-152) and in Allowed and
Blocked on the node having records (lines 319-327). It is replicated as it is.

Cache is still a section of its own. Allowed and Blocked are not any more: their
tree is mounted `embedded` inside Blocking's Rules tab (screens/blocking/Rules.tsx).
*/

/** A confirmation waiting in the dialog. Also Rules' (screens/blocking/Rules.tsx),
 *  whose Delete is the same verb with the same sentences. */
export interface Confirmation {
  title: string
  text: string
  label: string
  action: () => Promise<void>
}

const TITLE: Record<List, string> = { cache: 'Cache', allowed: 'Allowed', blocked: 'Blocked' }

/*
The second line of the identity band, and it is OURS: upstream says nothing of
the sort on any of the three. It is here because the three screens are one
component and, without it, the only thing separating "what the server resolved"
from "what you decided" is a title.

English, like every other addition of ours on this screen —`Domain`, `No records
at this node`, `Could not refresh.`— because the console's interface is English:
upstream's literals set the language and ours follow it.
*/
const SUBTITLE: Record<List, string> = {
  cache: 'What the server resolved and stored',
  allowed: 'Domains the administrator lets through',
  blocked: 'Domains the administrator blocks',
}

/*
`importAllowedZones` / `importBlockedZones` (other-zones.js:589-661). The
empty-list alert goes INSIDE the modal, not on the page: upstream passes
`showAlert` the modal's own `divImportAllowedZonesAlert`.
*/
export function ImportDomains({
  list,
  open,
  token,
  onClose,
  onDone,
}: {
  list: DomainList
  open: boolean
  token: string | null
  onClose: () => void
  onDone: (n: Notice) => void
}) {
  const [text, setText] = useState('')
  const [notice, setNotice] = useState<Notice | null>(null)
  const [busy, setBusy] = useState(false)
  const area = useRef<HTMLTextAreaElement>(null)

  const isAllowed = list === 'allowed'
  const title = isAllowed ? 'Import Allowed Zones' : 'Import Blocked Zones'
  const label = isAllowed ? 'Allowed Zones' : 'Blocked Zones'
  const intro = isAllowed
    ? 'Enter domain names one below other to import into Allowed Zone:'
    : 'Enter domain names one below other to import into blocked zone:'

  // `resetImport*Modal`: on opening, the modal starts clean and with the focus inside.
  useEffect(() => {
    if (open) {
      setText('')
      setNotice(null)
      area.current?.focus()
    }
  }, [open])

  async function runImport() {
    const zones = cleanList(text)

    if (zones.length === 0 || zones === ',') {
      setNotice({
        type: 'warning',
        title: 'Missing!',
        text: isAllowed
          ? 'Please enter allowed zones to import.'
          : 'Please enter blocked zones to import.',
      })
      area.current?.focus()
      return
    }

    setBusy(true)
    const outcome = await importDomains(list, token, zones)
    setBusy(false)

    if (outcome.kind !== 'ok') {
      setNotice(noticeFromFailure(outcome))
      return
    }

    onClose()
    onDone({
      type: 'success',
      title: 'Imported!',
      text: isAllowed
        ? 'Domain names were imported into allowed zone successfully.'
        : 'Domain names were imported into blocked zone successfully.',
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title={title}
      actions={
        <>
          <Button variant="primary" disabled={busy} onClick={() => void runImport()}>
            Import
          </Button>
        </>
      }
    >
      <Notifier notice={notice} onClose={() => setNotice(null)} />
      <p className={styles.paragraph}>{intro}</p>
      <LabeledTextarea
        label={label}
        ref={area}
        mono
        className={styles.area}
        spellCheck={false}
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
    </Dialog>
  )
}

export function Lists({
  list,
  token,
  nodes = [],
  clusterInitialised = false,
  embedded = false,
  canDelete = true,
  initialFromPrimary = false,
  initialDomain = '',
  fieldName,
  onNotice,
  onChanged,
}: {
  list: List
  token: string | null
  /** The CLUSTER nodes. Not to be confused with `node` below, which is the
   *  selected node of the cache TREE: two different things, same word. F10. */
  nodes?: { name: string; type: string }[]
  clusterInitialised?: boolean
  /** Inside the Blocking section's Rules tab: no header (its verbs live in Rules)
   *  and no node selector. */
  embedded?: boolean
  /** Allowed/Blocked: whether the session may delete from this list. */
  canDelete?: boolean
  /**
   * The tree is mounted again BECAUSE of a change made outside it (Rules' table or
   * foot): its first read comes from the primary node, as every read after a
   * change does (other-zones.js:269 and 434). Read once, on mount.
   */
  initialFromPrimary?: boolean
  /**
   * The node the tree opens at on mount: the domain a Block or Allow just added,
   * as upstream's blockZone/allowZone open it (`refreshBlockedZonesList(domain,
   * null, true)`, other-zones.js:350 and 185). Read once, on mount.
   */
  initialDomain?: string
  /**
   * The tree field's label, when the screen already has another field labelled
   * "Domain" (Rules' add bar): shown, not only announced, so the two fields do not
   * read alike. Without it the field is "Domain", as in Cache.
   */
  fieldName?: string
  /**
   * Embedded only: the host's notifier. Rules has one alert slot at the top of the
   * page, and a Delete from the tree reporting inside the panel gave the same verb
   * two places on one screen. Cache never passes it.
   */
  onNotice?: (n: Notice) => void
  /** Embedded only: called after a Delete from the tree succeeded, so the host can
   *  read its own view of the list again. */
  onChanged?: () => void
}) {
  const [clusterNode, setClusterNode] = useState<string>('')

  const [node, setNode] = useState<ListNode | null>(null)
  const [field, setField] = useState('')
  const [notice, setNotice] = useState<Notice | null>(null)
  /* Where this screen's alerts go: the host's notifier when it gives one, its own
     otherwise. Read through a ref so `load` does not change with every render. */
  const host = useRef(onNotice)
  useEffect(() => {
    host.current = onNotice
  }, [onNotice])
  const report = useCallback((n: Notice) => (host.current != null ? host.current(n) : setNotice(n)), [])
  /* A first read that failed and was reported to the host: there is no notice here
     to tell "failed" from "still loading", so it is said apart. */
  const [failedOutside, setFailedOutside] = useState(false)
  /*
  Stale data. The same gap Zones had, and the same phase 1 rule: the previous list
  stays —throwing it away would leave the user with nothing over a network error—
  but it has to be said that it is no longer current.
  */
  const [lastGood, setLastGood] = useState<string | null>(null)
  /*
  `load` reads whether there was earlier data, and it is also what sets it. Read
  as state, `lastGood` had to be one of `load`'s dependencies: every successful
  load made a new `load`, the mount effect ran it again from the root, and the
  screen asked `cache/list` for the root hundreds of times a second — and snapped
  back to the root whenever a node was opened. It is read through a ref instead,
  so `load` only changes with the list and the token (found 2026-09-30).
  */
  const hadData = useRef(false)
  const [stale, setStale] = useState(false)
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null)
  const [busy, setBusy] = useState(false)

  const isCache = list === 'cache'
  const domainList = list as DomainList

  /*
  The primary node is read through a ref for the same reason as `hadData`: as a
  dependency of `load`, the `nodes = []` default is a new array on every render,
  and the mount effect would ask for the root forever again.
  */
  const primary = useRef('')
  useEffect(() => {
    primary.current = primaryNodeName(nodes, clusterInitialised)
  }, [nodes, clusterInitialised])

  const load = useCallback(
    async (domain: string, up?: boolean, fromPrimary = false) => {
      /* other-zones.js:269 and 434: after a change, Allowed and Blocked are read
         back from the PRIMARY node, where the change was made. Cache never is. */
      const node = fromPrimary && list !== 'cache' ? primary.current : ''
      const outcome = await listNode(list, token, domain, up ? 'up' : undefined, node)
      if (outcome.kind === 'ok') {
        setNode(outcome.data)
        setStale(false)
        setLastGood(new Date().toISOString())
        hadData.current = true
        return
      }
      /*
      Upstream's error handler leaves the list where it was and draws the server's
      errorMessage; the same here — and **it also says the data has gone stale**,
      which is what was missing.

      The same split as Zones and for the same reason: with previous data the
      strip reports it, saying since when and offering a retry, and the notice
      keeps quiet so the same failure is not reported twice; with no previous data
      there is nothing to go stale —marking it would promise an earlier tree that
      does not exist— so the notice speaks, carrying the server's message.
      */
      if (!hadData.current) {
        if (host.current != null) setFailedOutside(true)
        report(noticeFromFailure(outcome))
      } else setStale(true)
    },
    [list, token, report],
  )

  /* Read through a ref: it governs the mount only, and as a dependency it would
     read the root again whenever it changed. It is not reset after use, so
     StrictMode's second run of this effect reads from the same node. The primary
     node is already in `primary.current` here: its effect is declared above, and
     effects run in order. */
  const firstFromPrimary = useRef(initialFromPrimary)
  const firstDomain = useRef(initialDomain)
  useEffect(() => {
    void load(firstDomain.current, undefined, firstFromPrimary.current)
  }, [load])

  /** Wraps a mutation: runs it, and on failure draws the server's error. */
  async function mutate(
    fn: () => Promise<{ kind: string; message?: string }>,
    success: Notice,
    after: () => Promise<void>,
  ) {
    setBusy(true)
    const outcome = await fn()
    setBusy(false)

    if (outcome.kind !== 'ok') {
      report(noticeFromFailure(outcome))
      return
    }
    await after()
    report(success)
  }

  /* The first load, still in flight: `node` is null and nothing failed. A load
     that FAILED leaves `node` null too, but it sets the notice — and then this is
     not loading, it is a failure with nothing behind it. */
  const loading = node == null && notice == null && !failedOutside

  const domain = node?.domain ?? ''
  const nodeTitle = domain === '' ? '<ROOT>' : (node?.domainIdn ?? domain)
  const zones = node?.zones ?? []
  const records = node?.records ?? []

  // Cache: Delete hangs off the NODE. Allowed/Blocked: off there being records.
  const mayDelete = isCache ? domain !== '' : records.length > 0

  function navigate(d: string, up?: boolean) {
    void load(d, up)
  }

  // ---- Cache actions ------------------------------------------------------

  function askFlushCache() {
    setConfirmation({
      title: 'Flush Cache',
      text: 'Are you sure to flush the DNS Server cache?',
      label: 'Flush Cache',
      action: () =>
        mutate(
          () => flushCache(token),
          {
            type: 'success',
            title: 'Flushed!',
            text: 'DNS Server cache was flushed successfully.',
          },
          // Upstream leaves the list at `<ROOT>` and hides the viewer.
          () => load(''),
        ),
    })
  }

  function askDeleteCacheNode() {
    setConfirmation({
      title: 'Delete Cached Zone',
      text: `Are you sure you want to delete the cached zone '${nodeTitle}' and all its records?`,
      label: 'Delete',
      action: () =>
        mutate(
          () => deleteCacheNode(token, nodeTitle),
          {
            type: 'success',
            title: 'Deleted!',
            text: `Cached zone '${nodeTitle}' was deleted successfully.`,
          },
          () => load(parentDomain(nodeTitle) ?? '', true),
        ),
    })
  }

  // ---- Allowed and Blocked actions ----------------------------------------
  /* Only Delete is left here. Allowed and Blocked are no longer sections: this
     component draws them only inside Blocking's Rules tab, which owns the verbs
     of their old header —Allow, Block, Import, Export and Flush— in its add bar
     and its foot. The tree's field still browses on Enter. */

  function askDeleteDomain() {
    const isAllowed = domainList === 'allowed'
    setConfirmation({
      title: isAllowed ? 'Delete Allowed Zone' : 'Delete Blocked Zone',
      text: isAllowed
        ? `Are you sure you want to delete the allowed zone '${nodeTitle}'?`
        : `Are you sure you want to delete the blocked zone '${nodeTitle}'?`,
      label: 'Delete',
      action: () =>
        mutate(
          () => deleteDomain(domainList, token, nodeTitle),
          isAllowed
            ? {
                type: 'success',
                title: 'Deleted!',
                text: `Domain '${nodeTitle}' was deleted from Allowed Zone successfully.`,
              }
            : {
                type: 'success',
                title: 'Deleted!',
                text: `Blocked zone '${nodeTitle}' was deleted successfully.`,
              },
          async () => {
            await load(parentDomain(nodeTitle) ?? '', true, true)
            onChanged?.()
          },
        ),
    })
  }

  return (
    <>
      {/* The node selector exists only on Cache: upstream has none on Allowed or
          Blocked (index.html:712, `optCachedZonesClusterNode`, is the only one).
          Its value is still not sent; that is a known gap, out of scope here. */}
      {isCache && !embedded && (
        <ClusterNodeSelect
          nodes={nodes}
          initialised={clusterInitialised}
          value={clusterNode}
          onChange={setClusterNode}
          label="Cluster Node"
        />
      )}

      {!embedded && (
        <SectionHeader
          title={TITLE[list]}
          actions={
            isCache ? (
              <Button variant="danger" disabled={busy} onClick={askFlushCache}>
                Flush Cache
              </Button>
            ) : undefined
          }
        />
      )}

      <Notifier notice={notice} onClose={() => setNotice(null)} />

      {stale && <StaleData since={lastGood} onRetry={() => void load(node?.domain ?? '')} />}

      <div className={styles.split}>
        <div className={styles.tree}>
          <section className={styles.column} aria-label="Domain tree">
            <div className={styles.browse}>
              {/* The field is called "Domain" and the button "Browse". Upstream puts
                  no label here —only the `placeholder`— so this one is an
                  addition of ours and can be called whatever suits; what it
                  cannot be called is the same as the button next to it, which
                  does carry upstream's literal. Embedded under another "Domain"
                  field, it takes the name the screen gives it. */}
              <Field label={fieldName ?? 'Domain'}>
                {(id) => (
                  <Input
                    id={id}
                    mono
                    placeholder="example.com"
                    value={field}
                    onChange={(e) => setField(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') navigate(field)
                    }}
                  />
                )}
              </Field>
              {/* "Browse" and not "Go": it is upstream's literal on all three list
                  screens (Cache, Allowed and Blocked), and it also says better
                  what it does —it takes you to that point of the tree, it sends
                  nothing. */}
              <Button variant="primary" onClick={() => navigate(field)}>
                Browse
              </Button>
            </div>
            {/*
            Still loading is NOT the same as empty, and until 2026-09-07 it was
            drawn the same: `node` starts null, so the first load showed "0 zones"
            and an empty tree — the same picture a genuinely empty list shows. It is
            the same defect that was fixed for the failure state on this very
            screen, in the state it had not been measured in.

            A first load that FAILED does not come here: it leaves `node` null too,
            but it sets the notice, and that is what the reader has to see.
            */}
            {loading ? (
              <div className={styles.body}><Loading /></div>
            ) : (
              <>
                {/* The count lives in the count bar, like the records one: in the
                    header it looked exactly like a status pill. */}
                <div className={styles.count}>
                  <span>{zones.length === 1 ? '1 zone' : `${zones.length} zones`}</span>
                </div>
                <div className={styles.body}>
                  <Tree
                    domain={domain}
                    domainIdn={node?.domainIdn}
                    zones={zones}
                    onNavigate={navigate}
                  />
                </div>
              </>
            )}
          </section>
        </div>

        <div className={[styles.records, styles[list]].join(' ')}>
          <section className={styles.column} aria-label="Records">
            {/*
            Cache is what the server resolved and stored; Allowed and Blocked are
            the administrator's decisions. Three screens, one component, and until
            this round nothing on them said which was which.

            The icon and the second line are OURS —upstream has neither— and they
            are the two channels that do not depend on the colour, which is the
            rule `theme/tokens.css` already applies to itself in the seven
            conditions of Logs: colour reinforces, it is never the only channel.
            */}
            <div className={styles.identity}>
              <span className={styles.emblem}>
                <Icon name={list} size={15} />
              </span>
              <span className={styles.identityText}>
                <span className={styles.identityTitle}>{TITLE[list]}</span>
                <span className={styles.identitySub}>{SUBTITLE[list]}</span>
              </span>
            </div>

            <Path domain={domain} label={nodeTitle} />

            {/*
            No count bar while the request is in flight. Saying "0 records at
            <ROOT>" with nothing loaded yet is exactly the picture an empty list
            shows, which is the defect the tree had fixed on 2026-09-07 and this
            side still had.
            */}
            {!loading && (
              <div className={styles.count}>
                <span>
                  {records.length} records at <span className={styles.mono}>{nodeTitle}</span>
                </span>
                <div className={styles.countActs}>
                  <Button size="sm" onClick={() => navigate(domain)}>
                    Refresh
                  </Button>
                  {/*
                  `variant="danger"`, which it did not carry: deleting a node is
                  destructive and was drawn as a plain grey button, while `Flush`
                  next to it was already the filled red one. Same primitive, two
                  weights — the row-sized danger is red text that fills on hover,
                  precisely so a destructive verb in a bar does not shout.
                  */}
                  {mayDelete && (
                    <PermissionButton
                      size="sm"
                      variant="danger"
                      disabled={busy}
                      permission={isCache || canDelete ? undefined : `${TITLE[list]}.canDelete`}
                      onClick={isCache ? askDeleteCacheNode : askDeleteDomain}
                    >
                      Delete
                    </PermissionButton>
                  )}
                </div>
              </div>
            )}

            <div className={styles.bodyFlush}>
              {loading ? (
                /* The tree's placeholder above already announced this wait: two
                   `role="status"` for one request read it out twice. */
                <div className={styles.empty}><Loading announce={false} /></div>
              ) : records.length > 0 ? (
                <ResourceRecords records={records} withDnssec={isCache} node={domain} />
              ) : (
                <div className={styles.empty}>
                  <Empty title="No records at this node">
                    {zones.length > 0
                      ? 'This node only contains sub-domains. Open one in the tree to see its records.'
                      : 'This node has no records and no sub-domains.'}
                  </Empty>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>

      <Confirm
        open={confirmation !== null}
        title={confirmation?.title ?? ''}
        text={confirmation?.text}
        label={confirmation?.label ?? ''}
        onClose={() => setConfirmation(null)}
        onConfirm={() => confirmation?.action()}
      />
    </>
  )
}

export function Cache({ token, nodes, clusterInitialised }: {
  token: string | null
  nodes?: { name: string; type: string }[]
  clusterInitialised?: boolean
}) {
  return <Lists list="cache" token={token} nodes={nodes} clusterInitialised={clusterInitialised} />
}
