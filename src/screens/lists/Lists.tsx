import { ClusterNodeSelect, primaryNodeName } from '../../ui/ClusterNodeSelect'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
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
import { ancestors } from './Tree'
import { Children } from './CacheNav'
import { ResourceRecords } from './Records'
import { CacheSummary } from './CacheSummary'
import { CacheAcross } from './CacheAcross'
import { DataTable, DataFoot, Grow } from '../../ui/DataTable'
import { RowAction } from '../../ui/Table'
import { DomainName } from '../../ui/DomainName'
import styles from './Lists.module.css'
import { noticeFromFailure, type Notice } from '../../lib/notice'
import { Notifier } from '../../ui/Notifier'
import { dropParams, readParam, writeParams } from '../../lib/url-state'
import { Icon } from '../../ui/Icon'

/*
Cache, Allowed and Blocked. A single screen because in upstream they are three
copies of the same code (`refreshCachedZonesList`, `refreshAllowedZonesList` and
`refreshBlockedZonesList` are the same function three times, other-zones.js).

What really changes between the three are the TEXTS, and they are not
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

/* At the root the cache holds every top-level domain asked for: hundreds of
   chips. The first ones are shown, and the rest one press away. */
const CHILDREN_SHOWN = 40

/* Cache's view in the address bar (`lib/url-state.ts`). */
const CACHE_DOMAIN = 'domain'
const CACHE_TYPE = 'type'
/* Cache's `All nodes` view (deviation 35), `?nodes=all`: read on an initialised
   cluster only, so the same link on a single server opens the one-node view. */
const CACHE_NODES = 'nodes'

const TITLE: Record<List, string> = { cache: 'Cache', allowed: 'Allowed', blocked: 'Blocked' }

/*
Cache's line under its title at the root, OURS: upstream says nothing of the sort.
It separates "what the server resolved" from the administrator's own lists. Allowed
and Blocked lost theirs (and the identity band that carried it) on 2026-11-06: they
are drawn only inside Rules, whose toolbar already says which list is shown.
*/
const SUBTITLE = 'What the server resolved and stored'

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
  toolbarStart,
  toolbarEnd,
  footEnd,
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
  /** Allowed and Blocked: the host's controls at the start and the end of the
   *  card's toolbar (Rules' list and view switches), and in its foot (Rules'
   *  Import, Export and Flush), so the tree and the host's table are one card. */
  toolbarStart?: ReactNode
  toolbarEnd?: ReactNode
  footEnd?: ReactNode
}) {
  const [clusterNode, setClusterNode] = useState<string>('')
  /* Read by `load` through a ref, so choosing a node does not rebuild it (and
     re-run the mount effect that reads the root). */
  const cacheNode = useRef('')

  const [node, setNode] = useState<ListNode | null>(null)
  const [field, setField] = useState('')
  /* Cache: the record type the table is narrowed to (`CacheSummary`), and whether
     every zone under the node is shown or only the first CHILDREN_SHOWN. */
  const [cacheType, setCacheType] = useState(() => (list === 'cache' ? (readParam(CACHE_TYPE) ?? '') : ''))
  const [allChildren, setAllChildren] = useState(false)
  /* Cache: the `All nodes` view asked for (deviation 35). It is drawn only while the
     cluster is initialised; without one nothing on the screen changes. */
  const [allNodes, setAllNodes] = useState(() => list === 'cache' && readParam(CACHE_NODES) === 'all')
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
  Stale data. The same gap Zones had, and the same design rule (old data never
  looks like new data): the previous list
  stays (throwing it away would leave the user with nothing over a network error),
  but it has to be said that it is no longer current.
  */
  const [lastGood, setLastGood] = useState<string | null>(null)
  /*
  `load` reads whether there was earlier data, and it is also what sets it. Read
  as state, `lastGood` had to be one of `load`'s dependencies: every successful
  load made a new `load`, the mount effect ran it again from the root, and the
  screen asked `cache/list` for the root hundreds of times a second, and snapped
  back to the root whenever a node was opened. It is read through a ref instead,
  so `load` only changes with the list and the token (found 2026-09-30).
  */
  const hadData = useRef(false)
  const [stale, setStale] = useState(false)
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null)
  const [busy, setBusy] = useState(false)

  const isCache = list === 'cache'
  const domainList = list as DomainList
  /* The cluster's nodes side by side (deviation 35): Cache, a cluster, and asked for. */
  const clustered = isCache && !embedded && clusterInitialised && nodes.length > 0
  const across = clustered && allNodes
  /* `?nodes=all` while the view is drawn: a single server's bar never carries it. */
  useEffect(() => {
    if (isCache && !embedded) writeParams({ [CACHE_NODES]: across ? 'all' : null })
  }, [isCache, embedded, across])

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
      const node = list === 'cache' ? cacheNode.current : fromPrimary ? primary.current : ''
      const outcome = await listNode(list, token, domain, up ? 'up' : undefined, node)
      if (outcome.kind === 'ok') {
        setNode(outcome.data)
        /* Cache keeps the open node in the bar (`?domain=`), as Blocking keeps its
           filter: a reload or a copied link opens the same node. */
        if (list === 'cache') writeParams({ [CACHE_DOMAIN]: outcome.data.domain })
        setStale(false)
        setLastGood(new Date().toISOString())
        hadData.current = true
        return
      }
      /*
      Upstream's error handler leaves the list where it was and draws the server's
      errorMessage; the same here, and **it also says the data has gone stale**,
      which is what was missing.

      The same split as Zones and for the same reason: with previous data the
      strip reports it, saying since when and offering a retry, and the notice
      keeps quiet so the same failure is not reported twice; with no previous data
      there is nothing to go stale (marking it would promise an earlier tree that
      does not exist), so the notice speaks, carrying the server's message.
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

  /* Cache: the type the table is narrowed to travels with the node (`?type=`), and
     both leave the bar with the screen. */
  useEffect(() => {
    if (list === 'cache') writeParams({ [CACHE_TYPE]: cacheType })
  }, [list, cacheType])

  useEffect(() => {
    if (list !== 'cache') return
    return () => dropParams([CACHE_DOMAIN, CACHE_TYPE, CACHE_NODES])
  }, [list])
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
     that FAILED leaves `node` null too, but it sets the notice, and then this is
     not loading, it is a failure with nothing behind it. */
  const loading = node == null && notice == null && !failedOutside

  const domain = node?.domain ?? ''
  const nodeTitle = domain === '' ? '<ROOT>' : (node?.domainIdn ?? domain)
  const zones = node?.zones ?? []
  const records = node?.records ?? []
  /* Cache: the records of the type pressed on the Records card, or all. */
  const typed = cacheType === '' ? records : records.filter((r) => r.type === cacheType)

  // Cache: Delete hangs off the NODE. Allowed/Blocked: off there being records.
  const mayDelete = isCache ? domain !== '' : records.length > 0

  function navigate(d: string, up?: boolean) {
    // A new node starts unfiltered and with its zones folded.
    setCacheType('')
    setAllChildren(false)
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
          () => flushCache(token, clusterNode),
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
          () => deleteCacheNode(token, nodeTitle, clusterNode),
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
     of their old header (Allow, Block, Import, Export and Flush) in its add bar
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

  const nodeSelect = (
    <ClusterNodeSelect
      nodes={nodes}
      initialised={clusterInitialised}
      value={clusterNode}
      onChange={(n) => {
        cacheNode.current = n
        setClusterNode(n)
        void load(domain)
      }}
      label="Cluster Node"
    />
  )

  /* Cache's Domain field and Browse, in the records card's toolbar of both views. */
  const cacheSearch = (
    <Grow>
      <div className={styles.search}>
        <Field inline label={fieldName ?? 'Domain'}>
          {(id) => (
            <Input
              id={id}
              mono
              search
              placeholder="example.com"
              value={field}
              onChange={(e) => setField(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') navigate(field)
              }}
            />
          )}
        </Field>
        <Button lead="search" variant="primary" onClick={() => navigate(field)}>
          Browse
        </Button>
      </div>
    </Grow>
  )

  /* The zones under the node as chips: the chosen node's, or in `All nodes` those
     of any node (deviation 35). */
  const zoneBand = (zs: string[]) => (
    <div className={styles.children}>
      <span className={styles.childrenCount}>{zs.length === 1 ? '1 zone' : `${zs.length} zones`}</span>
      <Children
        domain={domain}
        zones={allChildren || zs.length <= CHILDREN_SHOWN ? zs : zs.slice(0, CHILDREN_SHOWN)}
        onNavigate={navigate}
      />
      {zs.length > CHILDREN_SHOWN && (
        <button type="button" className={styles.showIt} onClick={() => setAllChildren((v) => !v)}>
          {allChildren ? 'Show fewer' : `Show all ${zs.length}`}
        </button>
      )}
    </div>
  )

  return (
    <>
      {/* The node selector exists only on Cache: upstream has none on Allowed or
          Blocked (index.html:712, `optCachedZonesClusterNode`, is the only one).
          Changing it reloads the open domain from that node, and the list, Flush
          and Delete all go to it (other-zones.js:20-61, 106). */}
      {isCache && !embedded && (clustered ? (
        <div className={styles.nodeBar}>
          {nodeSelect}
          {/* Deviation 35: every node's cache side by side, for the domain on screen.
              The selector still chooses the node Flush Cache and Delete act on. */}
          <Button
            aria-pressed={allNodes}
            onClick={() => {
              setAllNodes((v) => !v)
              setCacheType('')
            }}
          >
            All nodes
          </Button>
        </div>
      ) : nodeSelect)}

      {!embedded && !isCache && <SectionHeader title={TITLE[list]} />}

      {/*
      Cache reads like a zone (2026-11-06, deviation 16): where you are, what the
      node holds, then its records. The header is the node itself: the path to it
      (every step opens that ancestor, upstream's `[up]`), its name as the title
      with Refresh beside it, and the two actions that delete, Delete for the node
      and Flush Cache for everything. At the root the title is the section's.
      */}
      {isCache && (
        <SectionHeader
          path={
            domain === ''
              ? undefined
              : [
                  { label: 'Cache', onOpen: () => navigate('', true) },
                  ...ancestors(domain).map((a) => ({
                    label: <DomainName name={a} />,
                    onOpen: () => navigate(a, true),
                  })),
                ]
          }
          title={domain === '' ? TITLE.cache : nodeTitle}
          subtitle={domain === '' ? SUBTITLE : undefined}
          titleAction={
            <RowAction icon="refresh" name="Refresh" disabled={loading} onClick={() => navigate(domain)} />
          }
          actions={
            <>
              {!loading && mayDelete && (
                <PermissionButton lead="trash" variant="danger" disabled={busy} onClick={askDeleteCacheNode}>
                  Delete
                </PermissionButton>
              )}
              <Button lead="trash" variant="danger" disabled={busy} onClick={askFlushCache}>
                Flush Cache
              </Button>
            </>
          }
        />
      )}

      <Notifier notice={notice} onClose={() => setNotice(null)} />

      {stale && <StaleData since={lastGood} onRetry={() => void load(node?.domain ?? '')} />}

      {isCache ? (
        /*
        Under the header, what the node holds at a glance (`CacheSummary.tsx`), and
        then ONE card that both moves and shows: the Domain field and Browse in its
        toolbar, the zones under the node as chips, and the node's records, one line
        each with the rest under Details. A type pressed on the Records card narrows
        the table to it.

        The cards and the table read the same `cache/list` answer the move asked
        for: nothing on this screen asks for more.
        */
        loading ? (
          <div className={styles.waiting}><Loading /></div>
        ) : across && node != null ? (
          <CacheAcross
            key={domain}
            token={token}
            nodes={nodes}
            node={node}
            chosen={cacheNode.current}
            nodeTitle={nodeTitle}
            toolbar={cacheSearch}
            band={zoneBand}
          />
        ) : (
          <>
            <CacheSummary records={records} activeType={cacheType} onType={setCacheType} />
            <DataTable
              toolbar={cacheSearch}
              foot={
                <DataFoot
                  count={
                    cacheType === '' ? (
                      <>
                        {records.length} records at <span className={styles.mono}>{nodeTitle}</span>
                      </>
                    ) : (
                      <>
                        {typed.length} of {records.length} records at{' '}
                        <span className={styles.mono}>{nodeTitle}</span>, {cacheType} only
                      </>
                    )
                  }
                />
              }
            >
              {zones.length > 0 && zoneBand(zones)}
              {typed.length > 0 ? (
                <ResourceRecords records={typed} withDnssec node={domain} />
              ) : (
                <div className={styles.empty}>
                  <Empty title="No records at this node">
                    {zones.length > 0
                      ? 'This node only contains sub-domains. Open one to see its records.'
                      : 'This node has no records and no sub-domains.'}
                  </Empty>
                </div>
              )}
            </DataTable>
          </>
        )
      ) : (
        /*
        Allowed and Blocked, inside Blocking's Rules (2026-11-06, deviation 2): laid out
        as Cache's node is, in ONE card. The host's controls and the Browse field in the
        toolbar; the node as a trail under it (every step but the last opens that
        ancestor with `direction=up`, upstream's `[up]`), with Refresh and Delete at its
        end; the zones under the node as chips; the node's records one line each, the
        rest under Details; the count and the host's own verbs in the foot. The tree
        column and the identity band are gone: the host's toolbar says which list it is.
        Every call is the one the tree made.
        */
        <DataTable
          toolbar={
            <>
              {toolbarStart}
              <Grow>
                <div className={styles.search}>
                  <Field inline label={fieldName ?? 'Domain'}>
                    {(id) => (
                      <Input
                        id={id}
                        mono
                        search
                        placeholder="example.com"
                        value={field}
                        onChange={(e) => setField(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') navigate(field)
                        }}
                      />
                    )}
                  </Field>
                  {/* "Browse" and not "Go": upstream's literal on all three list
                      screens. It takes you to that point of the tree; it sends nothing. */}
                  <Button lead="search" variant="primary" onClick={() => navigate(field)}>
                    Browse
                  </Button>
                </div>
              </Grow>
              {toolbarEnd}
            </>
          }
          foot={
            loading && footEnd == null ? undefined : (
              <DataFoot
                count={
                  loading ? null : (
                    <>
                      {records.length} records at <span className={styles.mono}>{nodeTitle}</span>
                    </>
                  )
                }
              >
                {footEnd}
              </DataFoot>
            )
          }
        >
          {loading ? (
            <div className={styles.empty}><Loading /></div>
          ) : (
            <>
              <div className={styles.trailBand}>
                <nav className={styles.trail} aria-label="Node">
                  {domain === '' ? (
                    <span className={styles.trailHere} aria-current="page">&lt;ROOT&gt;</span>
                  ) : (
                    <>
                      {['', ...ancestors(domain)].map((a) => (
                        <span key={a} className={styles.trailStep}>
                          <button type="button" className={styles.trailUp} onClick={() => navigate(a, true)}>
                            {a === '' ? '<ROOT>' : <DomainName name={a} />}
                          </button>
                          <Icon name="chevronRight" size={12} className={styles.trailSep} />
                        </span>
                      ))}
                      <span className={styles.trailHere} aria-current="page"><DomainName name={nodeTitle} /></span>
                    </>
                  )}
                </nav>
                <div className={styles.trailActs}>
                  <RowAction icon="refresh" name="Refresh" onClick={() => navigate(domain)} />
                  {/* Danger, row-sized: red text that fills on hover. It deletes the
                      node shown, so it sits at the end of the node's own line. */}
                  {mayDelete && (
                    <PermissionButton
                      size="sm"
                      lead="trash"
                      variant="danger"
                      disabled={busy}
                      permission={canDelete ? undefined : `${TITLE[list]}.canDelete`}
                      onClick={askDeleteDomain}
                    >
                      Delete
                    </PermissionButton>
                  )}
                </div>
              </div>
              {zones.length > 0 && (
                <div className={styles.children}>
                  <span className={styles.childrenCount}>
                    {zones.length === 1 ? '1 zone' : `${zones.length} zones`}
                  </span>
                  <Children
                    domain={domain}
                    zones={allChildren || zones.length <= CHILDREN_SHOWN ? zones : zones.slice(0, CHILDREN_SHOWN)}
                    onNavigate={navigate}
                  />
                  {zones.length > CHILDREN_SHOWN && (
                    <button type="button" className={styles.showIt} onClick={() => setAllChildren((v) => !v)}>
                      {allChildren ? 'Show fewer' : `Show all ${zones.length}`}
                    </button>
                  )}
                </div>
              )}
              {records.length > 0 ? (
                <ResourceRecords records={records} withDnssec={false} node={domain} />
              ) : (
                <div className={styles.empty}>
                  <Empty title="No records at this node">
                    {zones.length > 0
                      ? 'This node only contains sub-domains. Open one to see its records.'
                      : 'This node has no records and no sub-domains.'}
                  </Empty>
                </div>
              )}
            </>
          )}
        </DataTable>
      )}

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
  return (
    <Lists
      list="cache"
      token={token}
      nodes={nodes}
      clusterInitialised={clusterInitialised}
      initialDomain={readParam(CACHE_DOMAIN) ?? ''}
    />
  )
}
