/*
  What the editor checks before saving, from the table of the spec.

  Values the server accepts, the console accepts. Anything the server would refuse
  blocks always, since saving it would fail the same. What was already in the config
  and the user never touched is spared if the server takes it: it comes out as a
  warning on its row and is written back as it was. Forcing a fix there would change
  the policy of a client nobody touched to add one domain.

  Every message below is ours, and the page draws them as they are:
  `Enter an address.`, `Not an IP address or network.`, `Not an address or name the
  server can read.`, `Same network as another row.`, `Same endpoint as another row.`,
  `Choose a group.`, `Group "x" does not exist, so this client is not filtered.`, `This
  row has no group name, so this client is not filtered.`, `A group is now called "x",
  so this client would start using it. Choose its group.`, `Enter a group name.`, `This
  group has no name.`, `Another group has this name.`, `Not an IP address: x.` (with
  `and N more`), `Saved as it is, but the server ignores it: x.`, `Enter a URL with a
  scheme, such as https://, or a full path.`, `This URL is already in this list.`, `Enter
  a whole number from 0 to N.`, `Outside 0 to N, and kept because it was already there.`,
  `With both at 0, the lists update every minute.`, `Capital letters never match:
  domains are compared in lower case: x.`, `This looks like a URL, not a domain: x.`,
  `Your browser cannot read this pattern, so the server decides: x.`
*/
import { entryOf, TEXT_LISTS, type ClientRow, type EditorModel, type GroupModel, type ListRow, type TextList } from './config-model'
import { isAbsoluteUri, parseEndpoint, parseIp, parseNetwork } from './dotnet-parse'
import type { JsonNode } from './json-tree'

export interface Problem {
  /** A row, group or list id, or 'general'. */
  target: string
  /** 'address' or 'group'; 'name', 'addresses' or a TextList key; 'url' or
      'addresses'; 'ttl', 'hours' or 'minutes'. */
  field: string
  message: string
  severity: 'error' | 'warning'
  /** 'clients', 'general', or the group id. */
  section: string
}

const UINT32_MAX = 4294967295n
const INT32_MAX = 2147483647n
const CLIENTS = 'clients'
const GENERAL = 'general'

type ObjectNode = Extract<JsonNode, { t: 'obj' }>

function linesOf(text: string): string[] {
  return text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l !== '')
}

function nodeStrings(node: JsonNode | undefined): string[] {
  return node !== undefined && node.t === 'arr' ? node.items.flatMap((i) => (i.t === 'str' ? [i.value] : [])) : []
}

/** "x" or "x and 2 more", so a long box says one thing and not five thousand. */
function firstAndRest(values: string[]): string {
  return values.length === 1 ? values[0] : `${values[0]} and ${values.length - 1} more`
}

function withDuplicates<T>(items: T[], keyOf: (item: T) => string | null, flag: (item: T) => void): void {
  const groups = new Map<string, T[]>()
  for (const item of items) {
    const key = keyOf(item)
    if (key !== null) groups.set(key, [...(groups.get(key) ?? []), item])
  }
  for (const same of groups.values()) if (same.length > 1) same.forEach(flag)
}

function validateRows(m: EditorModel, out: Problem[]): void {
  const source = m.root as ObjectNode
  const names = new Set(m.groups.map((g) => g.name))
  const keysOf = (row: ClientRow) => {
    const value = entryOf(source, row.map)
    return value !== undefined && value.t === 'obj' ? value.entries.map((e) => e.key) : []
  }

  /* A problem per field, so the address and the group each get their own line. */
  const addressProblem = new Map<string, Problem>()
  const canonical = new Map<string, string>()
  for (const row of m.rows) {
    const parsed = row.map === 'networkGroupMap' ? parseNetwork(row.address) : parseEndpoint(row.address)
    /* The server reads an empty endpoint as the root (DomainEndPoint.cs:64-90) and
       keeps one that is already there, but a row left blank is an unfinished row. */
    const blank = row.address === '' && (row.map === 'networkGroupMap' || !keysOf(row).includes(''))
    if (blank) {
      addressProblem.set(row.id, { target: row.id, field: 'address', message: 'Enter an address.', severity: 'error', section: CLIENTS })
    } else if (parsed === null) {
      const message = row.map === 'networkGroupMap' ? 'Not an IP address or network.' : 'Not an address or name the server can read.'
      addressProblem.set(row.id, { target: row.id, field: 'address', message, severity: 'error', section: CLIENTS })
    } else {
      canonical.set(row.id, `${row.map}|${parsed.canonical}`)
    }
  }
  withDuplicates(m.rows, (r) => canonical.get(r.id) ?? null, (r) => {
    const message = r.map === 'networkGroupMap' ? 'Same network as another row.' : 'Same endpoint as another row.'
    addressProblem.set(r.id, { target: r.id, field: 'address', message, severity: 'error', section: CLIENTS })
  })

  for (const row of m.rows) {
    const address = addressProblem.get(row.id)
    if (address !== undefined) out.push(address)
    const group = groupProblem(row, names)
    if (group !== null) out.push(group)
  }
}

function groupProblem(row: ClientRow, names: Set<string>): Problem | null {
  const base = { target: row.id, field: 'group', section: CLIENTS }
  if (row.groupId !== null) return null
  if (row.missingGroup === null) return { ...base, message: 'Choose a group.', severity: 'error' }
  /* App.cs:570: a row with no such group is not filtered. A rename onto that name
     would silently put this client under a policy, so it has to be chosen. */
  if (names.has(row.missingGroup)) {
    return { ...base, message: `A group is now called "${row.missingGroup}", so this client would start using it. Choose its group.`, severity: 'error' }
  }
  const message = row.missingGroup === '' ? 'This row has no group name, so this client is not filtered.' : `Group "${row.missingGroup}" does not exist, so this client is not filtered.`
  return { ...base, message, severity: 'warning' }
}

/* Non-IP lines in an address box. Those the file already had are ignored by the server
   (App.cs:906, :770), so they stay a warning; a new one is an error unless the box is
   switched off, where the page could not take the focus to it. */
function addressProblems(text: string, loaded: string[], target: string, section: string, disabled: boolean, out: Problem[]): void {
  const bad = linesOf(text).filter((l) => parseIp(l) === null)
  if (bad.length === 0) return
  const known = new Set(loaded)
  const old = bad.filter((l) => known.has(l))
  const typed = bad.filter((l) => !known.has(l))
  if (typed.length > 0) {
    out.push({ target, field: 'addresses', message: `Not an IP address: ${firstAndRest(typed)}.`, severity: disabled ? 'warning' : 'error', section })
  }
  if (old.length > 0) {
    out.push({ target, field: 'addresses', message: `Saved as it is, but the server ignores it: ${firstAndRest(old)}.`, severity: 'warning', section })
  }
}

function textWarnings(g: GroupModel, list: TextList, out: Problem[]): void {
  const lines = linesOf(g.text[list])
  const push = (message: string) => out.push({ target: g.id, field: list, message, severity: 'warning', section: g.id })
  if (list === 'allowed' || list === 'blocked') {
    const capitals = lines.filter((l) => /[A-Z]/.test(l))
    if (capitals.length > 0) push(`Capital letters never match: domains are compared in lower case: ${firstAndRest(capitals)}.`) // App.cs:157, :1031
    const urls = lines.filter((l) => /\/|\s/.test(l))
    if (urls.length > 0) push(`This looks like a URL, not a domain: ${firstAndRest(urls)}.`)
    return
  }
  /* .NET and the browser are different engines, so this can only ever be a warning. */
  const unreadable = lines.filter((l) => {
    try {
      new RegExp(l)
      return false
    } catch {
      return true
    }
  })
  if (unreadable.length > 0) push(`Your browser cannot read this pattern, so the server decides: ${firstAndRest(unreadable)}.`)
}

/** Scheme and host in lower case, what the app's Dictionary of Uri compares. */
function uriKey(url: string): string {
  const t = url.trim()
  const m = /^([a-zA-Z][a-zA-Z0-9+.-]*:\/\/)([^/?#]*)(.*)$/s.exec(t)
  return m === null ? t : `${m[1].toLowerCase()}${m[2].toLowerCase()}${m[3]}`
}

function listAddresses(row: ListRow): string[] {
  if (row.node === null || row.node.t !== 'obj') return []
  return nodeStrings(entryOf(row.node, 'blockingAddresses'))
}

function validateLists(g: GroupModel, out: Problem[]): void {
  const urlProblem = new Map<string, Problem>()
  for (const l of g.lists) {
    if (!isAbsoluteUri(l.url)) {
      urlProblem.set(l.id, { target: l.id, field: 'url', message: 'Enter a URL with a scheme, such as https://, or a full path.', severity: 'error', section: g.id })
    }
  }
  withDuplicates(g.lists, (l) => (urlProblem.has(l.id) ? null : `${l.kind}|${uriKey(l.url)}`), (l) => {
    urlProblem.set(l.id, { target: l.id, field: 'url', message: 'This URL is already in this list.', severity: 'error', section: g.id })
  })
  for (const l of g.lists) {
    const problem = urlProblem.get(l.id)
    if (problem !== undefined) out.push(problem)
    if (l.answer === 'addresses') addressProblems(l.addresses, listAddresses(l), l.id, g.id, false, out)
  }
}

function loadedGroup(m: EditorModel, g: GroupModel): ObjectNode | null {
  if (g.loadedIndex === null) return null
  const groups = entryOf(m.root as ObjectNode, 'groups')
  return groups !== undefined && groups.t === 'arr' ? (groups.items[g.loadedIndex] as ObjectNode) : null
}

function validateGroup(m: EditorModel, g: GroupModel, nameProblem: Map<string, Problem>, out: Problem[]): void {
  const node = loadedGroup(m, g)
  const name = nameProblem.get(g.id)
  if (name !== undefined) {
    out.push(name)
  } else if (g.name === '') {
    const read = node === null ? undefined : entryOf(node, 'name')
    const untouched = read !== undefined && read.t === 'str' && read.value === ''
    out.push(untouched
      ? { target: g.id, field: 'name', message: 'This group has no name.', severity: 'warning', section: g.id }
      : { target: g.id, field: 'name', message: 'Enter a group name.', severity: 'error', section: g.id })
  }
  addressProblems(g.addresses, node === null ? [] : nodeStrings(entryOf(node, 'blockingAddresses')), g.id, g.id, g.nxDomain, out)
  for (const list of TEXT_LISTS) textWarnings(g, list, out)
  validateLists(g, out)
}

function validateInteger(text: string, loaded: JsonNode | undefined, max: bigint, field: string, out: Problem[]): void {
  const base = { target: GENERAL, field, section: GENERAL }
  const whole = /^[0-9]+$/.test(text) && BigInt(text) <= max
  if (whole) return
  if (loaded !== undefined && loaded.t === 'num' && loaded.raw === text) {
    out.push({ ...base, message: `Outside 0 to ${max}, and kept because it was already there.`, severity: 'warning' })
    return
  }
  out.push({ ...base, message: `Enter a whole number from 0 to ${max}.`, severity: 'error' })
}

function validateGeneral(m: EditorModel, out: Problem[]): void {
  const root = m.root as ObjectNode
  validateInteger(m.ttl, entryOf(root, 'blockingAnswerTtl'), UINT32_MAX, 'ttl', out)
  validateInteger(m.hours, entryOf(root, 'blockListUrlUpdateIntervalHours'), INT32_MAX, 'hours', out)
  validateInteger(m.minutes, entryOf(root, 'blockListUrlUpdateIntervalMinutes'), INT32_MAX, 'minutes', out)
  /* App.cs:96: the timer would update on each of its one-minute ticks. */
  const isZero = (s: string) => /^[0-9]+$/.test(s) && BigInt(s) === 0n
  if (isZero(m.hours) && isZero(m.minutes)) {
    out.push({ target: GENERAL, field: 'hours', message: 'With both at 0, the lists update every minute.', severity: 'warning', section: GENERAL })
  }
}

/** Every problem in page order: Clients, each group, General. */
export function validate(m: EditorModel): Problem[] {
  const out: Problem[] = []
  validateRows(m, out)

  const nameProblem = new Map<string, Problem>()
  withDuplicates(m.groups, (g) => (g.name === '' ? null : g.name), (g) => {
    nameProblem.set(g.id, { target: g.id, field: 'name', message: 'Another group has this name.', severity: 'error', section: g.id })
  })
  for (const g of m.groups) validateGroup(m, g, nameProblem, out)

  validateGeneral(m, out)
  return out
}

export function blocking(p: Problem[]): Problem[] {
  return p.filter((x) => x.severity === 'error')
}
