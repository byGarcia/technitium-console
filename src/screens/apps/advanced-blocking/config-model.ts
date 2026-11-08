/*
  The Advanced Blocking config as the editor sees it: rows, groups and lists, read
  from the lossless tree of json-tree.ts. The model never replaces the document. It
  holds the original tree in `root`, and saving patches only what changed.

  Schema read from Apps/AdvancedBlockingApp/App.cs at v11.2.1, and
  TechnitiumLibrary's JsonExtensions.cs. `App.cs:n` below is that file.

  A config is refused, and only offered as JSON, when opening it could lose something
  or misread it. Every refusal names the line or the path. The words of the refusals
  are ours (the sentence around them is in the page that shows them):
  `The config is empty.`, `Line N is not valid JSON: ...`, `Line N has a comment, which
  this editor could not keep.`, `Line N has a trailing comma.`, `Line N repeats the key
  ...`, `The config is not a JSON object.`, `<path> is missing.`, and the `<path> is
  not ...` and `<path> has ...` sentences of readers below.
*/
import { parseJson, stringifyJson, type JsonNode } from './json-tree'

export type MapName = 'localEndPointGroupMap' | 'networkGroupMap'
export type ListKind = 'blockListUrls' | 'regexBlockListUrls' | 'adblockListUrls' | 'allowListUrls' | 'regexAllowListUrls'
export type TextList = 'allowed' | 'blocked' | 'allowedRegex' | 'blockedRegex'

export interface ClientRow {
  id: string
  map: MapName
  address: string
  groupId: string | null
  missingGroup: string | null
  loaded: boolean
}

export interface ListRow {
  id: string
  kind: ListKind
  url: string
  answer: 'group' | 'nx' | 'addresses'
  addresses: string
  node: JsonNode | null
}

export interface GroupModel {
  id: string
  loadedIndex: number | null
  name: string
  enabled: boolean
  txtReport: boolean
  nxDomain: boolean
  addresses: string
  text: Record<TextList, string>
  lists: ListRow[]
  unknownKeys: string[]
}

export interface EditorModel {
  root: JsonNode
  enabled: boolean
  ttl: string
  hours: string
  minutes: string
  rows: ClientRow[]
  groups: GroupModel[]
}

export type OpenResult = { kind: 'editable'; model: EditorModel } | { kind: 'refused'; reason: string; where: string }

type ObjectNode = Extract<JsonNode, { t: 'obj' }>

export const LIST_KINDS: ListKind[] = ['blockListUrls', 'regexBlockListUrls', 'adblockListUrls', 'allowListUrls', 'regexAllowListUrls']
export const TEXT_LISTS: TextList[] = ['allowed', 'blocked', 'allowedRegex', 'blockedRegex']
const MAP_NAMES: MapName[] = ['localEndPointGroupMap', 'networkGroupMap']

/* App.cs:932 and :937 read these two with plain strings, and the other three with
   UrlEntry, string or object (App.cs:933, :938, :940). */
const STRING_ONLY_KINDS: ListKind[] = ['allowListUrls', 'regexAllowListUrls']

const GROUP_DEFAULTS = { enabled: true, txtReport: true, nxDomain: false } // App.cs:893-895
const GENERAL_DEFAULTS = { enabled: true, ttl: '30', hours: '24', minutes: '0' } // App.cs:358-361

const KNOWN_GROUP_KEYS = new Set<string>([
  'name', 'enableBlocking', 'allowTxtBlockingReport', 'blockAsNxDomain', 'blockingAddresses', ...TEXT_LISTS, ...LIST_KINDS,
])

const UINT32_MAX = 4294967295n
const INT32_MIN = -2147483648n
const INT32_MAX = 2147483647n

class Refusal extends Error {
  readonly where: string
  constructor(reason: string, where: string) {
    super(reason)
    this.where = where
  }
}

export function entryOf(obj: ObjectNode, key: string): JsonNode | undefined {
  return obj.entries.find((e) => e.key === key)?.value
}

function str(value: string): JsonNode {
  return { t: 'str', value, raw: JSON.stringify(value) }
}

function readBool(obj: ObjectNode, key: string, path: string, fallback: boolean): boolean {
  const v = entryOf(obj, key)
  if (v === undefined) return fallback
  if (v.t !== 'bool') throw new Refusal(`${path} is not true or false.`, path)
  return v.value
}

/* GetUInt32 and GetInt32 (JsonExtensions.cs): a plain integer of the type's range. A
   fraction or an exponent makes them throw, even for a whole value. */
function readInteger(root: ObjectNode, key: string, min: bigint, max: bigint, fallback: string): string {
  const v = entryOf(root, key)
  if (v === undefined) return fallback
  if (v.t !== 'num' || !/^-?[0-9]+$/.test(v.raw) || BigInt(v.raw) < min || BigInt(v.raw) > max) {
    throw new Refusal(`${key} is not a whole number from ${min} to ${max}.`, key)
  }
  return v.raw
}

/* The checks of a list the editor shows one value per line: anything a text box could
   not give back exactly stops the edit here. */
function readLine(item: JsonNode, path: string): string {
  if (item.t !== 'str') throw new Refusal(`${path} is not text.`, path)
  if (item.value === '' || item.value !== item.value.trim() || /[\r\n]/.test(item.value)) {
    throw new Refusal(`${path} is empty, has a line break or has spaces at its edges, so a text box could not give it back unchanged.`, path)
  }
  return item.value
}

function readLines(node: JsonNode | undefined, path: string, nullable: boolean): string[] {
  if (node === undefined) return []
  if (node.t === 'null' && nullable) return []
  if (node.t !== 'arr') throw new Refusal(`${path} is not a list.`, path)
  return node.items.map((item, i) => readLine(item, `${path}[${i}]`))
}

interface ReadRow {
  url: string
  answer: ListRow['answer']
  addresses: string
}

/* App.cs:754-792. blockAsNxDomain decides; with it absent, blockingAddresses makes it
   an answer of its own, and an object with neither follows the group. */
function readListEntry(item: JsonNode, kind: ListKind, path: string): ReadRow {
  if (item.t === 'str') return { url: item.value, answer: 'group', addresses: '' }
  if (item.t !== 'obj' || STRING_ONLY_KINDS.includes(kind)) {
    throw new Refusal(`${path} is not ${STRING_ONLY_KINDS.includes(kind) ? 'a URL as text' : 'a URL as text or an object with url'}.`, path)
  }
  const url = entryOf(item, 'url')
  if (url === undefined || url.t !== 'str') throw new Refusal(`${path} has no url as text.`, path)
  const nx = entryOf(item, 'blockAsNxDomain')
  if (nx !== undefined && nx.t !== 'bool') throw new Refusal(`${path}.blockAsNxDomain is not true or false.`, `${path}.blockAsNxDomain`)
  const addresses = entryOf(item, 'blockingAddresses')
  const lines = readLines(addresses, `${path}.blockingAddresses`, false)
  const answer = nx !== undefined && nx.t === 'bool' ? (nx.value ? 'nx' : 'addresses') : addresses !== undefined ? 'addresses' : 'group'
  return { url: url.value, answer, addresses: lines.join('\n') }
}

function readGroup(node: JsonNode, index: number, nextId: () => string): GroupModel {
  const path = `groups[${index}]`
  if (node.t !== 'obj') throw new Refusal(`${path} is not an object.`, path)
  const name = entryOf(node, 'name')
  if (name === undefined || name.t !== 'str') throw new Refusal(`${path}.name is not text.`, `${path}.name`)

  const text = {} as Record<TextList, string>
  for (const list of TEXT_LISTS) text[list] = readLines(entryOf(node, list), `${path}.${list}`, true).join('\n')

  const lists: ListRow[] = []
  for (const kind of LIST_KINDS) {
    const value = entryOf(node, kind)
    const listPath = `${path}.${kind}`
    if (value === undefined || value.t === 'null') continue
    if (value.t !== 'arr') throw new Refusal(`${listPath} is not a list.`, listPath)
    value.items.forEach((item, i) => {
      lists.push({ id: nextId(), kind, node: item, ...readListEntry(item, kind, `${listPath}[${i}]`) })
    })
  }

  return {
    id: nextId(),
    loadedIndex: index,
    name: name.value,
    enabled: readBool(node, 'enableBlocking', `${path}.enableBlocking`, GROUP_DEFAULTS.enabled),
    txtReport: readBool(node, 'allowTxtBlockingReport', `${path}.allowTxtBlockingReport`, GROUP_DEFAULTS.txtReport),
    nxDomain: readBool(node, 'blockAsNxDomain', `${path}.blockAsNxDomain`, GROUP_DEFAULTS.nxDomain),
    addresses: readLines(entryOf(node, 'blockingAddresses'), `${path}.blockingAddresses`, false).join('\n'),
    text,
    lists,
    unknownKeys: node.entries.map((e) => e.key).filter((k) => !KNOWN_GROUP_KEYS.has(k)),
  }
}

function readRows(root: ObjectNode, map: MapName, groups: GroupModel[], nextId: () => string): ClientRow[] {
  const value = entryOf(root, map)
  if (value === undefined) {
    if (map === 'localEndPointGroupMap') return [] // optional, App.cs:366
    throw new Refusal(`${map} is missing.`, map)
  }
  /* Measured on a v11.2.1 server: null loads here and not for networkGroupMap. */
  if (value.t === 'null' && map === 'localEndPointGroupMap') return []
  if (value.t !== 'obj') throw new Refusal(`${map} is not an object.`, map)
  return value.entries.map((entry) => {
    const path = `${map}[${JSON.stringify(entry.key)}]`
    /* App.cs:372 and :384: GetString() ?? "", so a null is a reference to "". */
    if (entry.value.t !== 'str' && entry.value.t !== 'null') throw new Refusal(`${path} is not a group name.`, path)
    const name = entry.value.t === 'str' ? entry.value.value : ''
    const group = groups.find((g) => g.name === name)
    return { id: nextId(), map, address: entry.key, groupId: group?.id ?? null, missingGroup: group === undefined ? name : null, loaded: true }
  })
}

function parseFailure(result: Extract<ReturnType<typeof parseJson>, { ok: false }>): Refusal {
  const where = `line ${result.line}`
  switch (result.code) {
    case 'comment':
      return new Refusal(`Line ${result.line} has a comment, which this editor could not keep.`, where)
    case 'trailing-comma':
      return new Refusal(`Line ${result.line} has a trailing comma.`, where)
    case 'duplicate-key':
      return new Refusal(`Line ${result.line}: ${result.detail}.`, where)
    case 'syntax':
      return new Refusal(`Line ${result.line} is not valid JSON: ${result.detail}.`, where)
  }
}

export function openConfig(text: string | null): OpenResult {
  let n = 0
  const nextId = () => `n${++n}`
  try {
    if (text === null || text === '') throw new Refusal('The config is empty.', 'the whole config')
    const parsed = parseJson(text)
    if (!parsed.ok) throw parseFailure(parsed)
    const root = parsed.root
    if (root.t !== 'obj') throw new Refusal('The config is not a JSON object.', 'the top level')

    const enabled = readBool(root, 'enableBlocking', 'enableBlocking', GENERAL_DEFAULTS.enabled)
    const ttl = readInteger(root, 'blockingAnswerTtl', 0n, UINT32_MAX, GENERAL_DEFAULTS.ttl)
    const hours = readInteger(root, 'blockListUrlUpdateIntervalHours', INT32_MIN, INT32_MAX, GENERAL_DEFAULTS.hours)
    const minutes = readInteger(root, 'blockListUrlUpdateIntervalMinutes', INT32_MIN, INT32_MAX, GENERAL_DEFAULTS.minutes)

    if (entryOf(root, 'networkGroupMap') === undefined) throw new Refusal('networkGroupMap is missing.', 'networkGroupMap')
    const rawGroups = entryOf(root, 'groups')
    if (rawGroups === undefined) throw new Refusal('groups is missing.', 'groups')
    if (rawGroups.t !== 'arr' && rawGroups.t !== 'null') throw new Refusal('groups is not a list.', 'groups')

    /* Measured on a v11.2.1 server: `groups: null` loads. */
    const groupNodes = rawGroups.t === 'arr' ? rawGroups.items : []
    const groups = groupNodes.map((node, i) => readGroup(node, i, nextId))
    const rows = MAP_NAMES.flatMap((map) => readRows(root, map, groups, nextId))
    return { kind: 'editable', model: { root, enabled, ttl, hours, minutes, rows, groups } }
  } catch (e) {
    if (e instanceof Refusal) return { kind: 'refused', reason: e.message, where: e.where }
    throw e
  }
}

/* ---- Writing back ------------------------------------------------------------

   The tree is never rebuilt from the model. Each part is compared with what the
   tree says, and a part that reads the same keeps its node. A rename therefore
   rewrites exactly the name and the rows bound to that group by id. */

type Entry = ObjectNode['entries'][number]

function lineList(text: string): string[] {
  return text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l !== '')
}

function sameLines(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i])
}

function setKey(obj: ObjectNode, key: string, value: JsonNode): ObjectNode {
  if (obj.entries.some((e) => e.key === key)) {
    return { t: 'obj', entries: obj.entries.map((e) => (e.key === key ? { ...e, value } : e)) }
  }
  return { t: 'obj', entries: [...obj.entries, { key, rawKey: JSON.stringify(key), value }] }
}

function nodeLines(node: JsonNode | undefined): string[] {
  return node !== undefined && node.t === 'arr' ? node.items.map((i) => (i.t === 'str' ? i.value : '')) : []
}

/** An array of text, keeping the node (so the spelling) of each value that stayed. */
function lineArray(values: string[], prev: JsonNode | undefined): JsonNode {
  const kept = new Map<string, JsonNode>()
  if (prev !== undefined && prev.t === 'arr') {
    for (const item of prev.items) if (item.t === 'str') kept.set(item.value, item)
  }
  return { t: 'arr', items: values.map((v) => kept.get(v) ?? str(v)) }
}

function patchLines(obj: ObjectNode, key: string, text: string): ObjectNode {
  const prev = entryOf(obj, key)
  const next = lineList(text)
  return sameLines(next, nodeLines(prev)) ? obj : setKey(obj, key, lineArray(next, prev))
}

function patchBool(obj: ObjectNode, key: string, value: boolean, fallback: boolean): ObjectNode {
  const prev = entryOf(obj, key)
  const read = prev !== undefined && prev.t === 'bool' ? prev.value : fallback
  return read === value ? obj : setKey(obj, key, { t: 'bool', value })
}

function isInteger(s: string): boolean {
  return /^-?[0-9]+$/.test(s)
}

function freshListNode(row: ListRow, urlNode: JsonNode): JsonNode {
  const url = { key: 'url', rawKey: '"url"', value: urlNode }
  const entry = (key: string, value: JsonNode): Entry => ({ key, rawKey: JSON.stringify(key), value })
  if (row.answer === 'group') return urlNode
  if (row.answer === 'nx') return { t: 'obj', entries: [url, entry('blockAsNxDomain', { t: 'bool', value: true })] }
  return {
    t: 'obj',
    entries: [url, entry('blockAsNxDomain', { t: 'bool', value: false }), entry('blockingAddresses', lineArray(lineList(row.addresses), undefined))],
  }
}

function listNode(row: ListRow): JsonNode {
  if (row.node === null) return freshListNode(row, str(row.url))
  const was = readListEntry(row.node, row.kind, '')
  const addressesChanged = !sameLines(lineList(row.addresses), lineList(was.addresses))
  if (row.url === was.url && row.answer === was.answer && !(row.answer === 'addresses' && addressesChanged)) return row.node

  if (row.node.t === 'str') return freshListNode(row, row.url === was.url ? row.node : str(row.url))

  let out = row.node as ObjectNode
  if (row.url !== was.url) out = setKey(out, 'url', str(row.url))
  if (row.answer === 'group') {
    if (was.answer === 'group') return out
    out = { t: 'obj', entries: out.entries.filter((e) => e.key !== 'blockAsNxDomain' && e.key !== 'blockingAddresses') }
    return out.entries.length === 1 && out.entries[0].key === 'url' ? out.entries[0].value : out
  }
  if (row.answer === 'nx') return was.answer === 'nx' ? out : setKey(out, 'blockAsNxDomain', { t: 'bool', value: true })
  if (was.answer !== 'addresses') out = setKey(out, 'blockAsNxDomain', { t: 'bool', value: false })
  return addressesChanged ? patchLines(out, 'blockingAddresses', row.addresses) : out
}

function patchGroup(node: ObjectNode, g: GroupModel): ObjectNode {
  let out = node
  const name = entryOf(node, 'name')
  if (name === undefined || name.t !== 'str' || name.value !== g.name) out = setKey(out, 'name', str(g.name))
  out = patchBool(out, 'enableBlocking', g.enabled, GROUP_DEFAULTS.enabled)
  out = patchBool(out, 'allowTxtBlockingReport', g.txtReport, GROUP_DEFAULTS.txtReport)
  out = patchBool(out, 'blockAsNxDomain', g.nxDomain, GROUP_DEFAULTS.nxDomain)
  out = patchLines(out, 'blockingAddresses', g.addresses)
  for (const list of TEXT_LISTS) out = patchLines(out, list, g.text[list])
  for (const kind of LIST_KINDS) {
    const prev = entryOf(node, kind)
    const items = prev !== undefined && prev.t === 'arr' ? prev.items : []
    const next = g.lists.filter((l) => l.kind === kind).map(listNode)
    if (next.length !== items.length || next.some((n, i) => n !== items[i])) out = setKey(out, kind, { t: 'arr', items: next })
  }
  return out
}

/* A new group is written whole: every list exists, as the server needs on v11.2.1. */
function newGroupNode(g: GroupModel): ObjectNode {
  const entry = (key: string, value: JsonNode): Entry => ({ key, rawKey: JSON.stringify(key), value })
  const lines = (text: string) => lineArray(lineList(text), undefined)
  const lists = (kind: ListKind): JsonNode => ({ t: 'arr', items: g.lists.filter((l) => l.kind === kind).map(listNode) })
  return {
    t: 'obj',
    entries: [
      entry('name', str(g.name)),
      entry('enableBlocking', { t: 'bool', value: g.enabled }),
      entry('allowTxtBlockingReport', { t: 'bool', value: g.txtReport }),
      entry('blockAsNxDomain', { t: 'bool', value: g.nxDomain }),
      entry('blockingAddresses', lines(g.addresses)),
      entry('allowed', lines(g.text.allowed)),
      entry('blocked', lines(g.text.blocked)),
      entry('allowListUrls', lists('allowListUrls')),
      entry('blockListUrls', lists('blockListUrls')),
      entry('allowedRegex', lines(g.text.allowedRegex)),
      entry('blockedRegex', lines(g.text.blockedRegex)),
      entry('regexAllowListUrls', lists('regexAllowListUrls')),
      entry('regexBlockListUrls', lists('regexBlockListUrls')),
      entry('adblockListUrls', lists('adblockListUrls')),
    ],
  }
}

function loadedGroupNodes(root: ObjectNode): JsonNode[] {
  const groups = entryOf(root, 'groups')
  return groups !== undefined && groups.t === 'arr' ? groups.items : []
}

function groupNode(root: ObjectNode, g: GroupModel): ObjectNode {
  if (g.loadedIndex === null) return newGroupNode(g)
  return patchGroup(loadedGroupNodes(root)[g.loadedIndex] as ObjectNode, g)
}

/** Reads the same as App.cs:372 and :384: a null is the name "". */
function reference(node: JsonNode): string {
  return node.t === 'str' ? node.value : ''
}

function patchMap(root: ObjectNode, map: MapName, m: EditorModel, note: (why: string) => void): ObjectNode {
  const value = entryOf(root, map)
  const old = value !== undefined && value.t === 'obj' ? value.entries : []
  const byKey = new Map(old.map((e) => [e.key, e]))
  const names = new Map(m.groups.map((g) => [g.id, g.name]))
  const seen = new Set<string>()
  const entries = m.rows.filter((r) => r.map === map).map((row): Entry => {
    if (seen.has(row.address)) note(`two rows of ${map} would write the same key: ${row.address}`)
    seen.add(row.address)
    const target = row.groupId !== null ? names.get(row.groupId) ?? null : row.missingGroup
    if (target === null) note(`the row ${row.address} has no group`)
    const prev = byKey.get(row.address)
    if (prev !== undefined && target !== null && reference(prev.value) === target) return prev
    return { key: row.address, rawKey: prev?.rawKey ?? JSON.stringify(row.address), value: target === null ? { t: 'null' } : str(target) }
  })
  if (entries.length === old.length && entries.every((e, i) => e === old[i])) return root
  return setKey(root, map, { t: 'obj', entries })
}

function patchInteger(root: ObjectNode, key: string, text: string, fallback: string, note: (why: string) => void): ObjectNode {
  if (!isInteger(text)) {
    note(`${key} is not a whole number: ${text}`)
    return setKey(root, key, str(text))
  }
  const prev = entryOf(root, key)
  const read = prev !== undefined && prev.t === 'num' ? prev.raw : fallback
  return BigInt(text) === BigInt(read) ? root : setKey(root, key, { t: 'num', raw: BigInt(text).toString() })
}

function patchRootFields(root: ObjectNode, m: EditorModel, note: (why: string) => void): ObjectNode {
  let out = patchBool(root, 'enableBlocking', m.enabled, GENERAL_DEFAULTS.enabled)
  out = patchInteger(out, 'blockingAnswerTtl', m.ttl, GENERAL_DEFAULTS.ttl, note)
  out = patchInteger(out, 'blockListUrlUpdateIntervalHours', m.hours, GENERAL_DEFAULTS.hours, note)
  return patchInteger(out, 'blockListUrlUpdateIntervalMinutes', m.minutes, GENERAL_DEFAULTS.minutes, note)
}

function patchGroups(root: ObjectNode, m: EditorModel): ObjectNode {
  const items = loadedGroupNodes(root)
  const next = m.groups.map((g) => groupNode(root, g))
  if (next.length === items.length && next.every((n, i) => n === items[i])) return root
  return setKey(root, 'groups', { t: 'arr', items: next })
}

function build(m: EditorModel): { root: JsonNode; invalid: string | null } {
  let invalid: string | null = null
  const note = (why: string) => {
    invalid ??= why
  }
  const source = m.root as ObjectNode
  let out = patchRootFields(source, m, note)
  for (const map of MAP_NAMES) out = patchMap(out, map, m, note)
  out = patchGroups(out, m)
  return { root: out, invalid }
}

/**
 * The document to send when something changed. It throws on what the validation
 * blocks and JSON could only carry by inventing a value (a row with no group, a
 * number that is not one, one key twice): those must never reach the server.
 */
export function serializeConfig(model: EditorModel): string {
  const { root, invalid } = build(model)
  if (invalid !== null) throw new Error(`The config cannot be written: ${invalid}.`)
  return stringifyJson(root)
}

export function isUnchanged(model: EditorModel): boolean {
  return stringifyJson(build(model).root) === stringifyJson(model.root)
}

function sameJson(a: JsonNode | undefined, b: JsonNode | undefined): boolean {
  return a === b || (a !== undefined && b !== undefined && stringifyJson(a) === stringifyJson(b))
}

/** 'Clients', group names and 'General', in page order. A deleted group keeps its
    place under the name it had, or the bar could say there is nothing to save. */
export function pendingSections(model: EditorModel): string[] {
  const source = model.root as ObjectNode
  const out: string[] = []
  const note = () => undefined
  let clients = source
  for (const map of MAP_NAMES) clients = patchMap(clients, map, model, note)
  if (MAP_NAMES.some((map) => !sameJson(entryOf(clients, map), entryOf(source, map)))) out.push('Clients')

  loadedGroupNodes(source).forEach((node, i) => {
    const group = model.groups.find((g) => g.loadedIndex === i)
    if (group === undefined) out.push(reference(entryOf(node as ObjectNode, 'name') as JsonNode))
    else if (!sameJson(patchGroup(node as ObjectNode, group), node)) out.push(group.name)
  })
  for (const g of model.groups) if (g.loadedIndex === null) out.push(g.name)

  const general = patchRootFields(source, model, note)
  if (!sameJson(general, source)) out.push('General')
  return out
}

/* ---- The edits, each a pure function of the model ----------------------------- */

function nextId(m: EditorModel): string {
  const ids = [...m.rows.map((r) => r.id), ...m.groups.map((g) => g.id), ...m.groups.flatMap((g) => g.lists.map((l) => l.id))]
  return `n${ids.reduce((max, id) => Math.max(max, Number(id.slice(1)) || 0), 0) + 1}`
}

export function setGeneral(m: EditorModel, patch: Partial<Pick<EditorModel, 'enabled' | 'ttl' | 'hours' | 'minutes'>>): EditorModel {
  return { ...m, ...patch }
}

export function addRow(m: EditorModel, map: MapName): EditorModel {
  const row: ClientRow = { id: nextId(m), map, address: '', groupId: null, missingGroup: null, loaded: false }
  const rows = [...m.rows]
  const after = rows.map((r) => r.map).lastIndexOf(map)
  /* The blocks are endpoints first, then networks. */
  rows.splice(after !== -1 ? after + 1 : map === 'localEndPointGroupMap' ? 0 : rows.length, 0, row)
  return { ...m, rows }
}

export function setRow(m: EditorModel, id: string, patch: { address?: string; groupId?: string | null }): EditorModel {
  return {
    ...m,
    rows: m.rows.map((r) => {
      if (r.id !== id) return r
      const out = { ...r, ...(patch.address !== undefined ? { address: patch.address } : {}) }
      /* `loaded` is about the reference: a dangling group the user never touched is
         spared, whatever happens to the address. */
      if (patch.groupId !== undefined && (patch.groupId !== r.groupId || r.missingGroup !== null)) {
        return { ...out, groupId: patch.groupId, missingGroup: null, loaded: false }
      }
      return out
    }),
  }
}

export function removeRow(m: EditorModel, id: string): EditorModel {
  return { ...m, rows: m.rows.filter((r) => r.id !== id) }
}

/* The values the approved page starts a new group with. */
export function addGroup(m: EditorModel): { model: EditorModel; id: string } {
  const id = nextId(m)
  let n = m.groups.length + 1
  while (m.groups.some((g) => g.name === `group ${n}`)) n++
  const group: GroupModel = {
    id,
    loadedIndex: null,
    name: `group ${n}`,
    enabled: true,
    txtReport: true,
    nxDomain: true,
    addresses: '0.0.0.0\n::',
    text: { allowed: '', blocked: '', allowedRegex: '', blockedRegex: '' },
    lists: [],
    unknownKeys: [],
  }
  return { model: { ...m, groups: [...m.groups, group] }, id }
}

export function setGroup(m: EditorModel, id: string, patch: Partial<Omit<GroupModel, 'id' | 'loadedIndex' | 'lists' | 'unknownKeys'>>): EditorModel {
  return { ...m, groups: m.groups.map((g) => (g.id === id ? { ...g, ...patch } : g)) }
}

export function deleteGroup(m: EditorModel, id: string): EditorModel {
  return {
    ...m,
    groups: m.groups.filter((g) => g.id !== id),
    rows: m.rows.map((r) => (r.groupId === id ? { ...r, groupId: null, missingGroup: null, loaded: false } : r)),
  }
}

function withLists(m: EditorModel, groupId: string, update: (lists: ListRow[]) => ListRow[]): EditorModel {
  return { ...m, groups: m.groups.map((g) => (g.id === groupId ? { ...g, lists: update(g.lists) } : g)) }
}

export function addList(m: EditorModel, groupId: string, kind: ListKind, url: string): EditorModel {
  const row: ListRow = { id: nextId(m), kind, url, answer: 'group', addresses: '', node: null }
  return withLists(m, groupId, (lists) => LIST_KINDS.flatMap((k) => [...lists.filter((l) => l.kind === k), ...(k === kind ? [row] : [])]))
}

export function setList(m: EditorModel, groupId: string, listId: string, patch: Partial<Pick<ListRow, 'url' | 'answer' | 'addresses'>>): EditorModel {
  return withLists(m, groupId, (lists) => lists.map((l) => {
    if (l.id !== listId) return l
    /* An allow list has no answer of its own (App.cs:932, :937). */
    return STRING_ONLY_KINDS.includes(l.kind) ? { ...l, ...(patch.url !== undefined ? { url: patch.url } : {}) } : { ...l, ...patch }
  }))
}

export function removeList(m: EditorModel, groupId: string, listId: string): EditorModel {
  return withLists(m, groupId, (lists) => lists.filter((l) => l.id !== listId))
}
