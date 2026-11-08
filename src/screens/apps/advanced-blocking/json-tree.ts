/*
  A JSON document as a tree that remembers how it was written.

  The Advanced Blocking editor must never change what it was not asked to change,
  and `JSON.parse` loses too much for that: it moves numeric keys to the front,
  rounds big integers, merges repeated keys and forgets every escape. So the editor
  reads the document with this parser and patches the tree: key order, the lexeme
  of each number and the spelling of each string stay as they came.

  It reads strict RFC 8259 with one difference that is the server's:
  `JsonDocument.Parse` stops at 64 levels of nesting (`JsonDocumentOptions.MaxDepth`
  left at its default, App.cs:47 and :355). Comments and trailing commas get a code
  of their own, because the app's parser skips comments (App.cs:47) and this tree
  could not put them back.

  Every word here is ours: the `detail` texts are drawn inside a refusal message.
*/

export type JsonNode =
  | { t: 'obj'; entries: { key: string; rawKey: string; value: JsonNode }[] }
  | { t: 'arr'; items: JsonNode[] }
  | { t: 'str'; value: string; raw: string }
  | { t: 'num'; raw: string }
  | { t: 'bool'; value: boolean }
  | { t: 'null' }

export type ParseResult =
  | { ok: true; root: JsonNode }
  | { ok: false; code: 'syntax' | 'comment' | 'trailing-comma' | 'duplicate-key'; line: number; detail: string }

type FailCode = Extract<ParseResult, { ok: false }>['code']

const MAX_DEPTH = 64
const NUMBER = /-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?/y
const SIMPLE_ESCAPES: Record<string, string> = {
  '"': '"', '\\': '\\', '/': '/', b: '\b', f: '\f', n: '\n', r: '\r', t: '\t',
}

class Refused extends Error {
  readonly code: FailCode
  readonly at: number
  constructor(code: FailCode, at: number, detail: string) {
    super(detail)
    this.code = code
    this.at = at
  }
}

export function parseJson(text: string): ParseResult {
  let pos = 0

  const syntax = (detail: string, at = pos) => new Refused('syntax', at, detail)

  /* Whitespace is the four characters RFC 8259 names. A U+FEFF at the start is not
     one of them, so a BOM falls out as a syntax error, as in the server's reader. */
  function skip(): void {
    for (;;) {
      const c = text.charCodeAt(pos)
      if (c === 0x20 || c === 0x09 || c === 0x0a || c === 0x0d) pos++
      else break
    }
    if (text[pos] === '/' && (text[pos + 1] === '/' || text[pos + 1] === '*')) {
      throw new Refused('comment', pos, 'it has a comment')
    }
  }

  function readString(): { value: string; raw: string } {
    const start = pos
    pos++ // the opening quote
    let value = ''
    let run = pos
    for (;;) {
      if (pos >= text.length) throw syntax('a string is not closed', start)
      const c = text.charCodeAt(pos)
      if (c === 0x22) {
        value += text.slice(run, pos)
        pos++
        return { value, raw: text.slice(start, pos) }
      }
      if (c < 0x20) throw syntax('a string holds a raw control character')
      if (c !== 0x5c) {
        pos++
        continue
      }
      value += text.slice(run, pos)
      const e = text[pos + 1]
      if (e === 'u') {
        const hex = text.slice(pos + 2, pos + 6)
        if (!/^[0-9a-fA-F]{4}$/.test(hex)) throw syntax('a string has a bad \\u escape')
        value += String.fromCharCode(parseInt(hex, 16))
        pos += 6
      } else if (e !== undefined && e in SIMPLE_ESCAPES) {
        value += SIMPLE_ESCAPES[e]
        pos += 2
      } else {
        throw syntax('a string has a bad escape')
      }
      run = pos
    }
  }

  function readValue(depth: number): JsonNode {
    skip()
    const c = text[pos]
    if (c === '{' || c === '[') {
      if (depth === MAX_DEPTH) throw syntax(`it is nested deeper than ${MAX_DEPTH} levels`)
      return c === '{' ? readObject(depth + 1) : readArray(depth + 1)
    }
    if (c === '"') return { t: 'str', ...readString() }
    if (text.startsWith('true', pos)) {
      pos += 4
      return { t: 'bool', value: true }
    }
    if (text.startsWith('false', pos)) {
      pos += 5
      return { t: 'bool', value: false }
    }
    if (text.startsWith('null', pos)) {
      pos += 4
      return { t: 'null' }
    }
    NUMBER.lastIndex = pos
    const m = NUMBER.exec(text)
    if (m === null) throw syntax(pos >= text.length ? 'it ends too early' : `unexpected ${JSON.stringify(c)}`)
    pos += m[0].length
    return { t: 'num', raw: m[0] }
  }

  function readObject(depth: number): JsonNode {
    pos++ // the opening brace
    const entries: { key: string; rawKey: string; value: JsonNode }[] = []
    const seen = new Set<string>()
    skip()
    if (text[pos] === '}') {
      pos++
      return { t: 'obj', entries }
    }
    for (;;) {
      skip()
      if (text[pos] !== '"') throw syntax('a property name was expected')
      const at = pos
      const { value: key, raw: rawKey } = readString()
      if (seen.has(key)) throw new Refused('duplicate-key', at, `the key ${rawKey} is repeated`)
      seen.add(key)
      skip()
      if (text[pos] !== ':') throw syntax('a colon was expected')
      pos++
      entries.push({ key, rawKey, value: readValue(depth) })
      skip()
      if (text[pos] === '}') {
        pos++
        return { t: 'obj', entries }
      }
      if (text[pos] !== ',') throw syntax('a comma or a closing brace was expected')
      const comma = pos
      pos++
      skip()
      if (text[pos] === '}') throw new Refused('trailing-comma', comma, 'it has a trailing comma')
    }
  }

  function readArray(depth: number): JsonNode {
    pos++ // the opening bracket
    const items: JsonNode[] = []
    skip()
    if (text[pos] === ']') {
      pos++
      return { t: 'arr', items }
    }
    for (;;) {
      items.push(readValue(depth))
      skip()
      if (text[pos] === ']') {
        pos++
        return { t: 'arr', items }
      }
      if (text[pos] !== ',') throw syntax('a comma or a closing bracket was expected')
      const comma = pos
      pos++
      skip()
      if (text[pos] === ']') throw new Refused('trailing-comma', comma, 'it has a trailing comma')
    }
  }

  try {
    const root = readValue(0)
    skip()
    if (pos < text.length) throw syntax('something follows the end of the document')
    return { ok: true, root }
  } catch (e) {
    if (!(e instanceof Refused)) throw e
    let line = 1
    for (let i = text.indexOf('\n'); i !== -1 && i < e.at; i = text.indexOf('\n', i + 1)) line++
    return { ok: false, code: e.code, line, detail: e.message }
  }
}

/** Two spaces, `\n`, every lexeme as it was read and every key where it was. */
export function stringifyJson(root: JsonNode): string {
  return write(root, '')
}

function write(n: JsonNode, indent: string): string {
  switch (n.t) {
    case 'str':
    case 'num':
      return n.raw
    case 'bool':
      return n.value ? 'true' : 'false'
    case 'null':
      return 'null'
    case 'arr': {
      if (n.items.length === 0) return '[]'
      const inner = indent + '  '
      return `[\n${n.items.map((v) => inner + write(v, inner)).join(',\n')}\n${indent}]`
    }
    case 'obj': {
      if (n.entries.length === 0) return '{}'
      const inner = indent + '  '
      return `{\n${n.entries.map((e) => `${inner}${e.rawKey}: ${write(e.value, inner)}`).join(',\n')}\n${indent}}`
    }
  }
}
