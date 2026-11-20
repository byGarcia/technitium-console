import { readParam, writeParams } from '../../lib/url-state'
import { RECORDS_DATA, RECORDS_NAME, RECORDS_PAGE, RECORDS_TYPE } from './zone-url'
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { readPerPage, writePerPage } from '../../lib/stored-per-page'
import {
  deletionBody,
  stateChangeBody,
  deleteRecord,
  getRecords,
  updateRecord,
  zoneHasSvcbAutoHint,
  type ResourceRecord,
  type ZoneDetails,
} from '../../api/records'
import {
  deleteZone,
  disableZone,
  enableZone,
  zoneState,
  typeLabel,
  exportZone,
  resyncZone,
  zoneNameOf,
  type Zone,
} from '../../api/zones'
import { Button } from '../../ui/Button'
import { DomainName } from '../../ui/DomainName'
import { Field, Input, Select } from '../../ui/Field'
import { DataCell } from './DataCell'
import { ZoneOverview } from './ZoneOverview'
import { recordColour, zoneColour } from './zone-colours'
import { dateTime, dateWithAge } from '../../lib/dates'
import { Menu, MenuItem, Separator } from '../../ui/Menu'
import { filterBy } from './filter'
import { statusText, pageWindow } from '../../lib/pagination'
import { rowActions, recordText, relativeName, hideDnssec } from './record-view'
import { zoneHeader, isSigned, writeHideDnssec, readHideDnssec } from './zone-view'
import { SectionHeader } from '../../ui/SectionHeader'
import { Empty, Loading } from '../../ui/Empty'
import { Tag } from '../../ui/Tag'
import tbl from '../../ui/Table.module.css'
import { RowAction, Th, useSort, type Keys, Table } from '../../ui/Table'
import { type TagTone } from '../../ui/Tag'
import styles from './Zones.module.css'
import type { Notice, Confirmation } from './types'
import { Pagination } from '../../ui/Pagination'
import { DataTable, DataFoot, End, Grow } from '../../ui/DataTable'
import { noticeFromFailure } from '../../lib/notice'

/*
A zone's records. A replica of `showEditZone` (zone.js:3079) and
`showEditZonePage` (3500).

ACTING ON SEVERAL RECORDS AT ONCE (deviation 54, 2026-11-20; OURS). A checkbox on
every record whose row offers both Delete Record and Disable Record (`rowActions`:
not the SOA, not the DNSSEC records, none in a zone whose rows offer nothing), and
`Delete Records`, `Disable Records` and `Enable Records` at the toolbar's end with
the count, the way the zone list carries `Delete Zones`. Each record is sent on its
own, one after another, with the body its row sends (`deletionBody`,
`stateChangeBody`, the SVCB hints included); Delete and Disable ask first, as the
row does, Enable does not; Disable sends only the enabled ones and Enable only the
disabled ones. Then the zone is read once, and one notice says all went or how many
failed, with the first reason. The selection is the page on screen: another page,
an applied filter, a sort, Hide DNSSEC Records or a new read clears it. Without
Modify and Delete on the zone, or with nothing selectable in it, none of this is
drawn. Its words, OURS: `Select all records`, `Select <name> <type> <data>`, `N of M
records selected`, the three verbs, the titles `Delete Records` and `Disable
Records`, `Are you sure you want to permanently delete the following N records?`,
`Are you sure you want to disable the following N records?` (`record` for one),
`Records Deleted!`, `Records Disabled!`, `Records Enabled!`, `All selected records
were deleted successfully.` (and `disabled`, `enabled`), `Failed To Delete!`
(`Disable`, `Enable`) and `A total of N record(s) of the selected M record(s)
failed to delete: <the first reason>` (`disable`, `enable`).

**Here the pagination is the client's**, the opposite of the zone list:
`zones/records/get` does not paginate, it brings the whole zone and upstream cuts
it in the browser. If this were done with a table library's default pagination,
the zone list would break and this one would not, or the other way round; that is
why both are written by hand and kept apart.
*/

/* index.html:620-627. Remembered under upstream's key (zone.js:634-640). */
const RECORDS_PER_PAGE = [10, 25, 50, 100, 250, 500] as const
const RECORDS_PER_PAGE_KEY = 'optEditZoneRecordsPerPage'

export interface ZoneRecordsProps {
  zone: string
  token: string | null
  node?: string
  canModify: boolean
  canDelete: boolean
  onBack: () => void
  /** The zone could not be read and there is nothing to draw (`Zones.tsx`). */
  onUnavailable?: () => void
  onNotice: (a: Notice) => void
  onConfirm: (c: Confirmation) => void
  onAddRecord: (zoneInfo: ZoneDetails, records: ResourceRecord[]) => void
  onEditRecord: (zoneInfo: ZoneDetails, record: ResourceRecord, records: ResourceRecord[]) => void
  onEditZoneFile: (zone: string) => void
  onImport: (zone: string) => void
  onConvert: (zone: string, type: string) => void
  onClone: (zone: string) => void
  onPermissions: (zone: string) => void
  onOptions: (zone: string) => void
  onSign: (zone: string) => void
  onUnsign: (zone: string) => void
  onViewDs: (zone: string) => void
  onDnssecProperties: (zone: string) => void
  /** Changes when an external modal forces a re-read of the zone. */
  refresh: number
}

/*
`sortTable('tableEditZoneBody', 0..4)` in upstream, which sorts by the cell's
text. Here TTL sorts as a number and the rest naturally (deviation 48). "Data" is
read through its already-formatted cells, which is what you see.

Upstream's `#` column is sortable too and here it is not: sorting by the row
number the sort itself has just handed out leads nowhere.
*/
const NOTHING_PICKED: ReadonlySet<ResourceRecord> = new Set()

/** A record as one line of a bulk confirmation: its name, type and data. */
function recordLine(r: ResourceRecord): string {
  const data = recordText(r)
  return `${r.name === '' ? '.' : r.name} ${r.type} ${data.length > 80 ? `${data.slice(0, 79)}…` : data}`
}

const BULK = {
  delete: { done: 'deleted', title: 'Records Deleted!', failed: 'Failed To Delete!' },
  disable: { done: 'disabled', title: 'Records Disabled!', failed: 'Failed To Disable!' },
  enable: { done: 'enabled', title: 'Records Enabled!', failed: 'Failed To Enable!' },
} as const

const KEYS: Keys<ResourceRecord> = {
  name: (r) => r.name,
  type: (r) => r.type,
  ttl: (r) => r.ttl,
  data: recordText,
}

export function ZoneRecords(p: ZoneRecordsProps) {
  const { zone, token, node = '', onNotice } = p

  const [zoneInfo, setZoneInfo] = useState<ZoneDetails | null>(null)
  const [records, setRecords] = useState<ResourceRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [hideDnssecRecords, setHideDnssecRecords] = useState(readHideDnssec)
  /* The ticked records (deviation 54). Whatever changes the rows on screen clears
     them: `showPage` (a page, a filter, Go), a sort, Hide DNSSEC Records and a read. */
  const [picked, setPicked] = useState<ReadonlySet<ResourceRecord>>(NOTHING_PICKED)

  /*
  What is typed and what is applied are kept apart: upstream reads the four
  fields only in `showEditZonePage` (zone.js:3594-3610), run by Go or by a page
  link, so typing a filter changes nothing on screen until then.
  */
  /* The bar's `?rname=`, `?rtype=` and `?rpage=` (`zone-url.ts`) are the records a
     reload or a copied link lands on: typed and applied, as Go would apply them. */
  const [nameField, setNameField] = useState(() => readParam(RECORDS_NAME) ?? '')
  const [typeField, setTypeField] = useState(() => readParam(RECORDS_TYPE) ?? '')
  /* `Data contains` (deviation 53): typed and applied apart, as Name and Type. */
  const [dataField, setDataField] = useState(() => readParam(RECORDS_DATA) ?? '')
  /* What is typed in Page Number; `null` shows the page on screen (zone.js:3733). */
  const [pageDraft, setPageDraft] = useState<string | null>(null)
  const [perPageField, setPerPageField] = useState(() => readPerPage(RECORDS_PER_PAGE_KEY, RECORDS_PER_PAGE, 10))
  const [nameFilter, setNameFilter] = useState(() => readParam(RECORDS_NAME) ?? '')
  const [typeFilter, setTypeFilter] = useState(() => readParam(RECORDS_TYPE) ?? '')
  const [dataFilter, setDataFilter] = useState(() => readParam(RECORDS_DATA) ?? '')
  const [perPage, setPerPage] = useState(perPageField)
  const [page, setPage] = useState(() => {
    const n = Number(readParam(RECORDS_PAGE) ?? 1)
    return Number.isInteger(n) && n > 0 ? n : 1
  })

  /* What is on screen goes to the bar, replacing the zone's entry, as the zone
     list keeps its page: Back still returns to the list, not to another page. */
  useEffect(() => {
    writeParams({
      [RECORDS_PAGE]: page > 1 ? String(page) : null,
      [RECORDS_NAME]: nameFilter,
      [RECORDS_TYPE]: typeFilter,
      [RECORDS_DATA]: dataFilter,
    })
  }, [page, nameFilter, typeFilter, dataFilter])

  /** `showEditZonePage(pageNumber)`: the fields applied, on that page or the
   *  one in Page Number (0 or empty is 1). */
  function showPage(pageNumber?: number, typeOverride?: string) {
    setPicked(NOTHING_PICKED)
    setNameFilter(nameField)
    setDataFilter(dataField)
    setTypeFilter(typeOverride ?? typeField)
    if (typeOverride != null) setTypeField(typeOverride)
    setPerPage(perPageField)
    const n = pageNumber ?? Number(pageDraft ?? page)
    setPage(Number.isNaN(n) || n === 0 ? 1 : n)
    setPageDraft(null)
  }

  /* This view is keyed by zone: a read that comes back after the view is gone
     (Back or Forward to another zone before it answered) says nothing. */
  const alive = useRef(true)
  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])

  /* Only the newest read's answer lands: a refresh can start one while another is
     in flight, and the older answer must not paint over it. */
  const readSeq = useRef(0)

  /** Reads the zone; true when it arrived (and is still the read asked last). */
  const load = useCallback(async (): Promise<boolean> => {
    const mine = ++readSeq.current
    setLoading(true)
    const r = await getRecords(token, zone, node)
    if (!alive.current || mine !== readSeq.current) return false
    setLoading(false)

    if (r.kind !== 'ok') {
      onNotice(noticeFromFailure(r))
      return false
    }
    setZoneInfo(r.data.zone)
    setRecords(r.data.records)
    setPicked(NOTHING_PICKED)
    return true
  }, [token, zone, node, onNotice])

  useEffect(() => {
    void load()
  }, [load, p.refresh])

  /* The records after Hide DNSSEC Records (only for a signed zone). */
  const shown = useMemo(() => {
    const signed = isSigned(zoneInfo?.dnssecStatus)
    return hideDnssecRecords && signed ? hideDnssec(records) : records
  }, [records, hideDnssecRecords, zoneInfo])

  // The DNSSEC filtering comes before the name/type filter, just as in
  // upstream: `editZoneRecords` already arrives trimmed to `showEditZonePage`.
  const visible = useMemo(
    () => filterBy(shown, { name: nameFilter, type: typeFilter, data: dataFilter }, zone),
    [shown, nameFilter, typeFilter, dataFilter, zone],
  )

  const { rows: sorted, sort, toggle: sortBy } = useSort(KEYS, visible)
  const toggle = (field: string) => {
    setPicked(NOTHING_PICKED)
    sortBy(field)
  }

  /*
  WHAT THE ZONE HOLDS, by type (an exception, 2026-11-05): `A 14 · NS 1 · SOA 1`,
  counted from the records already loaded, after Hide DNSSEC Records and before
  the Name and Type filters, so it describes the zone and not the page. Pressing a
  type puts it in the Type field and runs Go, the same as typing it; pressing the
  one already applied empties the field and runs Go.
  */
  const byType = useMemo(() => {
    const base = shown
    const counts = new Map<string, number>()
    for (const r of base) counts.set(r.type, (counts.get(r.type) ?? 0) + 1)
    return [...counts.entries()]
  }, [shown])

  const totalPages = Math.max(1, Math.ceil(visible.length / perPage))
  // Past the last page, or negative, is the last page (`showEditZonePage`).
  const currentPage = page < 0 || page > totalPages ? totalPages : Math.max(page, 1)
  const offset = (currentPage - 1) * perPage
  const onPage = sorted.slice(offset, offset + perPage)

  const head = zoneInfo ? zoneHeader(zoneInfo.type, zoneInfo.dnssecStatus) : null

  /** Runs a mutation on a record and reloads the whole zone. */
  async function mutateRecord(fn: () => Promise<{ kind: string; message?: string }>, success: Notice) {
    setBusy(true)
    const outcome = await fn()
    setBusy(false)

    if (outcome.kind !== 'ok') {
      onNotice(noticeFromFailure(outcome))
      return
    }
    await load()
    /* After a change upstream redraws with the fields as they stand, typed but not
       yet applied included, on the page in Page Number (zone.js:5282-5288). */
    showPage()
    onNotice(success)
  }

  function setRecordState(r: ResourceRecord, disable: boolean) {
    const name = r.name === '' ? '.' : r.name
    const hints = zoneHasSvcbAutoHint(records, r.type === 'A', r.type === 'AAAA')
    /* The record's own expiry TTL goes with it. Upstream reads the record
       dialog's field instead (`updateRecordState`, zone.js:6236): empty if it was
       never opened, else whatever was left there. Not copied (deviation 50). */
    const body = stateChangeBody(zone, r, disable, hints)

    const run = () =>
      mutateRecord(
        () => updateRecord(token, body, node),
        disable
          ? { type: 'success', title: 'Record Disabled!', text: 'Resource record was disabled successfully.' }
          : { type: 'success', title: 'Record Enabled!', text: 'Resource record was enabled successfully.' },
      )

    // Only disabling asks; enabling does not (zone.js:6241).
    if (!disable) {
      void run()
      return
    }

    p.onConfirm({
      title: 'Disable Record',
      text: `Are you sure to disable the ${r.type} record '${name}'?`,
      label: 'Disable',
      action: run,
    })
  }

  function removeRecord(r: ResourceRecord) {
    const name = r.name === '' ? '.' : r.name
    const hints = zoneHasSvcbAutoHint(records, r.type === 'A', r.type === 'AAAA')
    const body = deletionBody(zone, r)
    if (r.type === 'A' || r.type === 'AAAA') body.updateSvcbHints = String(hints)

    p.onConfirm({
      title: 'Delete Record',
      text: `Are you sure to permanently delete the ${r.type} record '${name}'?`,
      label: 'Delete',
      danger: true,
      action: () =>
        mutateRecord(() => deleteRecord(token, body, node), {
          type: 'success',
          title: 'Record Deleted!',
          text: 'Resource record was deleted successfully.',
        }),
    })
  }

  /* ── Several records at once (deviation 54) ───────────────────────── */

  /** Sends each record on its own, in order, then reads the zone once. */
  async function runBulk(verb: keyof typeof BULK, targets: ResourceRecord[]) {
    setBusy(true)
    const failed: string[] = []
    for (const r of targets) {
      const hints = zoneHasSvcbAutoHint(records, r.type === 'A', r.type === 'AAAA')
      let outcome: { kind: string; message?: string }
      if (verb === 'delete') {
        const body = deletionBody(zone, r)
        if (r.type === 'A' || r.type === 'AAAA') body.updateSvcbHints = String(hints)
        outcome = await deleteRecord(token, body, node)
      } else {
        outcome = await updateRecord(token, stateChangeBody(zone, r, verb === 'disable', hints), node)
      }
      if (!alive.current) return
      if (outcome.kind === 'ok') continue
      /* The session is gone: nothing more can go, and the Shell takes over. */
      if (outcome.kind !== 'error') {
        setBusy(false)
        onNotice(noticeFromFailure(outcome))
        return
      }
      failed.push(outcome.message ?? '')
    }
    setBusy(false)
    await load()
    showPage()
    const words = BULK[verb]
    onNotice(
      failed.length === 0
        ? { type: 'success', title: words.title, text: `All selected records were ${words.done} successfully.` }
        : {
            type: 'warning',
            title: words.failed,
            text: `A total of ${failed.length} record(s) of the selected ${targets.length} record(s) failed to ${verb}: ${failed[0]}`,
          },
    )
  }

  function bulkDelete(chosen: ResourceRecord[]) {
    const n = chosen.length
    p.onConfirm({
      title: 'Delete Records',
      text: `Are you sure you want to permanently delete the following ${n === 1 ? 'record' : `${n} records`}?\n\n${chosen.map(recordLine).join('\n')}`,
      label: 'Delete',
      danger: true,
      action: () => runBulk('delete', chosen),
    })
  }

  function bulkDisable(chosen: ResourceRecord[]) {
    const targets = chosen.filter((r) => !r.disabled)
    const n = targets.length
    p.onConfirm({
      title: 'Disable Records',
      text: `Are you sure you want to disable the following ${n === 1 ? 'record' : `${n} records`}?\n\n${targets.map(recordLine).join('\n')}`,
      label: 'Disable',
      action: () => runBulk('disable', targets),
    })
  }

  /* ── Actions on the whole zone ─────────────────────────────────────── */

  async function mutateZone(fn: () => Promise<{ kind: string; message?: string }>, success: Notice, back = false) {
    setBusy(true)
    const outcome = await fn()
    setBusy(false)

    if (outcome.kind !== 'ok') {
      onNotice(noticeFromFailure(outcome))
      return
    }
    onNotice(success)
    /* A deleted zone is not a place to go back to: its entry is replaced, as for
       a zone that cannot be read (`onUnavailable`), not pushed over. */
    if (back) (p.onUnavailable ?? p.onBack)()
    else await load()
  }

  function doEnableZone() {
    void mutateZone(() => enableZone(token, zone, node), {
      type: 'success',
      title: 'Zone Enabled!',
      text: `Zone '${zone}' was enabled successfully.`,
    })
  }

  function doDisableZone() {
    p.onConfirm({
      title: 'Disable Zone',
      text: `Are you sure you want to disable the zone '${zone}'?`,
      label: 'Disable',
      action: () =>
        mutateZone(() => disableZone(token, zone, node), {
          type: 'success',
          title: 'Zone Disabled!',
          text: `Zone '${zone}' was disabled successfully.`,
        }),
    })
  }

  function removeZone() {
    p.onConfirm({
      title: 'Delete Zone',
      text: `Are you sure you want to permanently delete the zone '${zone}' and all its records?`,
      label: 'Delete',
      danger: true,
      action: () =>
        mutateZone(
          () => deleteZone(token, zone, node),
          { type: 'success', title: 'Zone Deleted!', text: `Zone '${zone}' was deleted successfully.` },
          true,
        ),
    })
  }

  function resync() {
    if (zoneInfo == null) return
    const text =
      zoneInfo.type === 'Secondary'
        ? `The resync action will perform a full zone transfer (AXFR). You will need to check the logs to confirm if the resync action was successful.\n\nAre you sure you want to resync the '${zone}' zone?`
        : `The resync action will perform a full zone refresh. You will need to check the logs to confirm if the resync action was successful.\n\nAre you sure you want to resync the '${zone}' zone?`

    p.onConfirm({
      title: 'Resync Zone',
      text,
      label: 'Resync',
      action: () =>
        mutateZone(() => resyncZone(token, zone, node), {
          type: 'success',
          title: 'Resync Triggered!',
          text: `Zone '${zone}' resync was triggered successfully. Please check the Logs for confirmation.`,
        }),
    })
  }

  async function runExport() {
    const r = await exportZone(token, zone, node)
    if (!r.ok) return
    onNotice({ type: 'success', title: 'Zone Exported!', text: 'Zone file was exported successfully.' })
  }

  function toggleDnssec() {
    const blank = !hideDnssecRecords
    setPicked(NOTHING_PICKED)
    setHideDnssecRecords(blank)
    writeHideDnssec(blank)
  }

  /* Nothing was ever drawn and the read failed: the list takes over, as upstream's
     `showEditZone` does on its `error`. A later failure keeps the zone on screen. */
  const unavailable = !loading && zoneInfo == null
  const onUnavailable = p.onUnavailable
  useEffect(() => {
    if (unavailable) onUnavailable?.()
  }, [unavailable, onUnavailable])

  if (loading && zoneInfo == null) {
    return <Loading>Loading zone…</Loading>
  }

  if (zoneInfo == null) {
    return (
      <Empty title="Unable to open the zone">Go back to the list and try again.</Empty>
    )
  }

  const state = zoneState(zoneInfo as unknown as Zone)
  const signed = isSigned(zoneInfo.dnssecStatus)
  /* The header's tones, upstream's (zone.js:3286-3303). */
  const stateTone: TagTone =
    state === 'Disabled'
      ? 'neutral'
      : state === 'Sync Failed' || state === 'Notify Failed'
        ? 'warn'
        : state === 'Expired' || state === 'Validation Failed'
          ? 'dan'
          : 'ok'
  /* The catalog tag: membership in grey, or the catalog's own name in blue
     (zone.js:3240-3256). */
  const catalogTag =
    zoneInfo.catalog != null
      ? { text: zoneInfo.catalog, tone: 'neutral' as TagTone }
      : zoneInfo.type === 'Catalog' || zoneInfo.type === 'SecondaryCatalog'
        ? { text: zone, tone: 'info' as TagTone }
        : null
  /* `nameIdn (zone)` when the zone has one (zone.js:3566-3569). */
  const title = zoneNameOf({ name: zone === '.' ? '' : zone, nameIdn: zoneInfo.nameIdn })
  const text = statusText(offset + 1, onPage.length, visible.length, currentPage, totalPages, 'records')
  const pg = pageWindow(currentPage, totalPages)

  /* Here the last page is calculated on the client: the records are all
     loaded, there is no need to ask the server. */
  const pagination = (
    <Pagination window={pg} current={currentPage} last={totalPages} onGoTo={(n) => showPage(n)} />
  )

  /* Deviation 54: what a row may act on, and the selection of the view on screen. */
  const selectable = (r: ResourceRecord) => {
    const a = rowActions(zoneInfo.type, r.type)
    return !a.hidden && !a.editingOnly
  }
  const bulk = (p.canModify || p.canDelete) && shown.some(selectable)
  const pickable = bulk ? onPage.filter(selectable) : []
  const chosen = pickable.filter((r) => picked.has(r))
  const pick = (next: ResourceRecord[]) => setPicked(new Set(next))

  return (
    <>
      <SectionHeader
        section="Zones"
        onBack={p.onBack}
        title={title}
        titleAction={
          /* Upstream's refresh beside the title (index.html:555): it reads the
             zone again and shows it with the page and filters as they are typed,
             `showEditZone(zone, page, name, type)`. */
          <RowAction
            icon="refresh"
            name="Refresh"
            disabled={busy || loading}
            onClick={() => void load().then((ok) => ok && showPage())}
          />
        }
        labels={
          <>
            <Tag tone={stateTone}>{state}</Tag>
            {/* The zone's type in its series colour (zone-colours.ts), as in the list. */}
            <span className={styles.ztag} style={{ '--rt': zoneColour(zoneInfo.type) } as CSSProperties}>
              {typeLabel(zoneInfo.type)}
            </span>
            {signed && (
              <Tag tone={zoneInfo.hasDnssecPrivateKeys ? 'info' : 'neutral'} pill>DNSSEC</Tag>
            )}
            {catalogTag && <Tag tone={catalogTag.tone} pill>{catalogTag.text}</Tag>}
            {/* The secondary's expiry, under the title with its seconds, where
                upstream writes it (zone.js:3262-3265). */}
            {zoneInfo.expiry != null && <span className={styles.fact}>Expiry: {dateTime(zoneInfo.expiry)}</span>}
            {/* An exception (2026-11-05): the serial and the last change, which
                the same answer carries and upstream shows only in the list. */}
            {zoneInfo.soaSerial != null && <span className={styles.fact}>Serial <b>{zoneInfo.soaSerial}</b></span>}
            {zoneInfo.lastModified != null && (
              <span className={styles.fact}>Last Modified: {dateWithAge(zoneInfo.lastModified)}</span>
            )}
          </>
        }
        actions={
          <>
            {head?.addRecord && (
              <Button
                lead="add"
                variant="primary"
                disabled={!p.canModify || busy}
                onClick={() => p.onAddRecord(zoneInfo, records)}
              >
                Add Record
              </Button>
            )}
            <Menu size="md" label="Zone actions" text="Options">
              {(close) => (
                <>
                  {/* The same groups as the row menu in the zone list
                      (ZoneList, the row's `Menu`), in the order this menu
                      already had: the zone as a file or its refresh (a zone
                      has one or the other, never both: zone-view.ts), its data
                      in and out, and how it behaves and who may touch it.
                      Enable, Disable and Delete are not in here: they are the
                      header's own group, after this menu. */}
                  {/* The FIRST entry of upstream's Options menu (index.html:574
                      in v15.5.1). Not gated by permission: upstream shows it to
                      anyone who can open the zone, the read needs only
                      Zones: View, and it is the save that the server refuses. */}
                  {head?.editZoneFile && (
                    <MenuItem icon="file" onClick={() => { close(); p.onEditZoneFile(zone) }}>
                      Edit Zone File
                    </MenuItem>
                  )}
                  {head?.resync && (
                    <MenuItem icon="refresh" disabled={!p.canModify} onClick={() => { close(); resync() }}>
                      Resync
                    </MenuItem>
                  )}
                  <Separator />
                  {head?.runImport && (
                    <MenuItem icon="upload" disabled={!p.canModify} onClick={() => { close(); p.onImport(zone) }}>
                      Import Zone
                    </MenuItem>
                  )}
                  {head?.runExport && (
                    <MenuItem icon="download" onClick={() => { close(); void runExport() }}>
                      Export Zone
                    </MenuItem>
                  )}
                  {head?.convert && (
                    <MenuItem icon="convert" disabled={!p.canModify} onClick={() => { close(); p.onConvert(zone, zoneInfo.type) }}>
                      Convert Zone
                    </MenuItem>
                  )}
                  {head?.clone && (
                    <MenuItem icon="copy" disabled={!p.canModify} onClick={() => { close(); p.onClone(zone) }}>
                      Clone Zone
                    </MenuItem>
                  )}
                  <Separator />
                  {head?.options && (
                    <MenuItem icon="settings" disabled={!p.canModify} onClick={() => { close(); p.onOptions(zone) }}>
                      Zone Options
                    </MenuItem>
                  )}
                  {head?.permissions && (
                    <MenuItem icon="admin" onClick={() => { close(); p.onPermissions(zone) }}>
                      Permissions
                    </MenuItem>
                  )}
                </>
              )}
            </Menu>
            {/* What acts on the whole zone and is hard to take back: in the header,
                where it is always in view, but as its own group after Options,
                and Delete outlined in red (ui/Button, THE DESTRUCTIVE ONE). */}
            <span className={styles.actSep} aria-hidden="true" />
            {zoneInfo.disabled ? (
              <Button lead="power" disabled={!p.canModify || busy} onClick={doEnableZone}>
                Enable Zone
              </Button>
            ) : (
              <Button lead="power" disabled={!p.canModify || busy} onClick={doDisableZone}>
                Disable Zone
              </Button>
            )}
            <Button lead="trash" variant="danger" disabled={!p.canDelete || busy} onClick={removeZone}>
              Delete Zone
            </Button>

          </>
        }
      />

      {head && (
        <ZoneOverview
          zone={zone}
          info={zoneInfo}
          records={shown}
          head={head}
          hideDnssecRecords={hideDnssecRecords}
          canModify={p.canModify}
          busy={busy}
          onSign={() => p.onSign(zone)}
          onUnsign={() => p.onUnsign(zone)}
          onViewDs={() => p.onViewDs(zone)}
          onProperties={() => p.onDnssecProperties(zone)}
          onToggleDnssecRecords={toggleDnssec}
          byType={byType}
          activeType={typeFilter}
          onType={(t) => showPage(1, t)}
        />
      )}

      {/* The records, their toolbar and their foot as one card (`ui/DataTable`). */}
      <DataTable
        toolbar={
          <>
            <Grow>
              <Field inline label="Name">
                {(id) => (
                  <Input
                    id={id}
                    search
                    placeholder="abc or a* or *b* or a?c"
                    value={nameField}
                    onChange={(e) => setNameField(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && showPage()}
                  />
                )}
              </Field>
            </Grow>
            <div className={styles.typeField}>
              <Field inline label="Type">
                {(id) => (
                  <Input
                    id={id}
                    value={typeField}
                    onChange={(e) => setTypeField(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && showPage()}
                  />
                )}
              </Field>
            </div>
            {/* OURS (deviation 53): what the Data column says, applied with the two above. */}
            <div className={styles.dataField}>
              <Field inline label="Data contains">
                {(id) => (
                  <Input
                    id={id}
                    search
                    placeholder="10.0.0.5 or example.net"
                    value={dataField}
                    onChange={(e) => setDataField(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && showPage()}
                  />
                )}
              </Field>
            </div>
            <Button variant="primary" onClick={() => showPage()}>
              Go
            </Button>
            {/* The status above the table as well as under it, as upstream draws it;
                with records ticked, how many, and the three verbs (deviation 54). */}
            <End>
              {!bulk && <span>{text}</span>}
              {bulk && (
                <span className={styles.bulkActs}>
                  <span className={styles.bulkCount}>
                    {chosen.length > 0 ? `${chosen.length} of ${pickable.length} records selected` : text}
                  </span>
                  <Button
                    lead="power"
                    disabled={!p.canModify || busy || !chosen.some((r) => r.disabled)}
                    onClick={() => void runBulk('enable', chosen.filter((r) => r.disabled))}
                  >
                    Enable Records
                  </Button>
                  <Button
                    lead="power"
                    disabled={!p.canModify || busy || !chosen.some((r) => !r.disabled)}
                    onClick={() => bulkDisable(chosen)}
                  >
                    Disable Records
                  </Button>
                  <Button
                    lead="trash"
                    variant="danger"
                    disabled={!p.canDelete || busy || chosen.length === 0}
                    onClick={() => bulkDelete(chosen)}
                  >
                    Delete Records
                  </Button>
                </span>
              )}
            </End>
          </>
        }
        foot={
          <DataFoot count={text}>
              <div className={styles.pageField}>
                <Field inline label="Page Number">
                  {(id) => (
                    <Input
                      id={id}
                      mono
                      value={pageDraft ?? String(currentPage)}
                      onChange={(e) => setPageDraft(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && showPage()}
                    />
                  )}
                </Field>
              </div>
              <div className={styles.perPage}>
                <Field inline label="Records Per Page">
                  {(id) => (
                    <Select
                      id={id}
                      value={String(perPageField)}
                      onChange={(e) => {
                        // Remembered at once (zone.js:634-636); applied on Go.
                        const n = Number(e.target.value)
                        writePerPage(RECORDS_PER_PAGE_KEY, n)
                        setPerPageField(n)
                      }}
                    >
                      {RECORDS_PER_PAGE.map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </Select>
                  )}
                </Field>
              </div>
            {pagination}
          </DataFoot>
        }
      >
        <Table
          stack
          header={
            <>
              {bulk && (
                <th style={{ width: 38 }} className={tbl.checkCell}>
                  <label>
                    <input
                      type="checkbox"
                      aria-label="Select all records"
                      disabled={pickable.length === 0 || busy}
                      checked={pickable.length > 0 && chosen.length === pickable.length}
                      onChange={(e) => pick(e.target.checked ? pickable : [])}
                    />
                  </label>
                </th>
              )}
              <th style={{ width: 34 }}>#</th>
              <Th field="name" sort={sort} onSort={toggle} style={{ width: 110 }}>Name</Th>
              <Th field="type" sort={sort} onSort={toggle} style={{ width: 80 }}>Type</Th>
              <Th field="ttl" sort={sort} onSort={toggle} style={{ width: 110 }}>TTL</Th>
              <Th field="data" sort={sort} onSort={toggle}>Data</Th>
              {/* The actions column reserved 230 px with three labels inside;
                  with icons 120 is enough and the 110 left over go to the data,
                  which is what the table is about. */}
              <th style={{ width: 120 }} />
            </>
          }
        >
          {onPage.length === 0 ? (
            <tr>
              <td colSpan={bulk ? 7 : 6} className={tbl.noRows}>
                No Record Found
              </td>
            </tr>
          ) : (
            onPage.map((r, i) => {
              const actions = rowActions(zoneInfo.type, r.type)
              /* A run of records with one owner draws the name once: the rows under
                 it carry it too, faded out, for the screen reader and for the
                 stacked card, where each record stands alone. */
              const repeat = i > 0 && onPage[i - 1].name === r.name
              return (
                <tr key={`${r.name}|${r.type}|${offset + i}`} className={repeat ? styles.repeat : undefined}>
                  {bulk && (
                    <td className={tbl.checkCell}>
                      {selectable(r) && (
                        <label>
                          <input
                            type="checkbox"
                            aria-label={`Select ${relativeName(r.name, zone)} ${r.type} ${recordText(r)}`}
                            disabled={busy}
                            checked={chosen.includes(r)}
                            onChange={(e) => pick(e.target.checked ? [...chosen, r] : chosen.filter((x) => x !== r))}
                          />
                        </label>
                      )}
                    </td>
                  )}
                  <td className={styles.num2}>{offset + i + 1}</td>
                  <td className={`${styles.mono} ${tbl.lead} ${styles.owner}`}><span className={styles.ownerName}><DomainName name={relativeName(r.name, zone)} /></span></td>
                  <td className={tbl.lead}>
                    <span className={styles.typeCell}>
                      <span className={styles.rtype} style={{ '--rt': recordColour(r.type) } as CSSProperties}>
                        {r.type}
                      </span>
                      {r.disabled && <Tag>Disabled</Tag>}
                    </span>
                  </td>
                  <td className={styles.ttl}>
                    {r.ttl} <small>({r.ttlString})</small>
                  </td>
                  <td className={styles.dataCell}>
                    <DataCell record={r} notifyFailedFor={zoneInfo.notifyFailedFor} />
                  </td>
                  <td className={tbl.actionsCell}>
                    {!actions.hidden && (
                      <div className={tbl.actions}>
                        <RowAction
                          icon="edit"
                          name="Edit Record"
                          disabled={!p.canModify || busy}
                          onClick={() => p.onEditRecord(zoneInfo, r, records)}
                        />
                        <RowAction
                          icon="power"
                          name={r.disabled ? 'Enable Record' : 'Disable Record'}
                          disabled={actions.editingOnly || !p.canModify || busy}
                          onClick={() => setRecordState(r, !r.disabled)}
                        />
                        {/* Delete, inside the menu: the same rule as in the zone
                            list. */}
                        <Menu label={`Actions for ${relativeName(r.name, zone)} ${r.type}`}>
                          {(close) => (
                            <MenuItem
                              icon="trash"
                              tone="danger"
                              disabled={actions.editingOnly || !p.canDelete || busy}
                              onClick={() => { close(); removeRecord(r) }}
                            >
                              Delete Record
                            </MenuItem>
                          )}
                        </Menu>
                      </div>
                    )}
                  </td>
                </tr>
              )
            })
          )}
        </Table>
      </DataTable>
    </>
  )
}
