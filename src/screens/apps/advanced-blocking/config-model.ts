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
import { parseJson, type JsonNode } from './json-tree'

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

export const GROUP_DEFAULTS = { enabled: true, txtReport: true, nxDomain: false } // App.cs:893-895
export const GENERAL_DEFAULTS = { enabled: true, ttl: '30', hours: '24', minutes: '0' } // App.cs:358-361

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

export function str(value: string): JsonNode {
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
