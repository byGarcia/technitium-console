import { describe, expect, it } from 'vitest'
import { parseJson, stringifyJson, type JsonNode } from './json-tree'

function tree(text: string): JsonNode {
  const r = parseJson(text)
  if (!r.ok) throw new Error(`expected ${text} to parse: ${r.code} on line ${r.line}: ${r.detail}`)
  return r.root
}

/* The whole point of the file: what comes out is what went in, as the server's
   parser and a human reading a diff would see it. */
function roundTrip(text: string): string {
  return stringifyJson(tree(text))
}

describe('json-tree: what JSON.parse would lose', () => {
  it('keeps numeric-looking keys in file order', () => {
    expect(JSON.stringify(JSON.parse('{"2":1,"1":2}'))).toBe('{"1":2,"2":1}')
    const out = roundTrip('{"2":1,"1":2}')
    expect(out.indexOf('"2"')).toBeLessThan(out.indexOf('"1"'))
  })

  it('keeps the lexeme of numbers', () => {
    for (const n of ['12345678901234567890', '1e3', '30.0', '-0', '1E+2', '0.10']) {
      expect(roundTrip(`{"a":${n}}`)).toBe(`{\n  "a": ${n}\n}`)
    }
  })

  it('keeps string escapes', () => {
    const root = tree('{"k":"\\u0041\\/"}')
    if (root.t !== 'obj') throw new Error('object expected')
    const v = root.entries[0].value
    if (v.t !== 'str') throw new Error('string expected')
    expect(v.raw).toBe('"\\u0041\\/"')
    expect(v.value).toBe('A/')
    expect(roundTrip('{"k":"\\u0041\\/"}')).toBe('{\n  "k": "\\u0041\\/"\n}')
  })

  it('keeps the escapes of a key and decodes it for comparison', () => {
    const root = tree('{"\\u0061b":1}')
    if (root.t !== 'obj') throw new Error('object expected')
    expect(root.entries[0].key).toBe('ab')
    expect(root.entries[0].rawKey).toBe('"\\u0061b"')
  })

  it('takes __proto__ as any other key', () => {
    const root = tree('{"__proto__":1,"constructor":2}')
    if (root.t !== 'obj') throw new Error('object expected')
    expect(root.entries.map((e) => e.key)).toEqual(['__proto__', 'constructor'])
  })

  it('writes two spaces, newlines and empty containers on one line', () => {
    expect(roundTrip('{"a":[1,{"b":[]}],"c":{}}')).toBe(
      '{\n  "a": [\n    1,\n    {\n      "b": []\n    }\n  ],\n  "c": {}\n}',
    )
  })
})

describe('json-tree: what it refuses', () => {
  function failure(text: string) {
    const r = parseJson(text)
    if (r.ok) throw new Error(`expected ${text} to be refused`)
    return r
  }

  it('reports comments with their line', () => {
    expect(failure('{\n// x\n"a":1}')).toMatchObject({ code: 'comment', line: 2 })
    expect(failure('{"a":1\n\n/* x */}')).toMatchObject({ code: 'comment', line: 3 })
    expect(failure('{"a":1}\n// after')).toMatchObject({ code: 'comment', line: 2 })
    expect(failure('/* unterminated')).toMatchObject({ code: 'comment', line: 1 })
  })

  it('does not take a slash inside a string for a comment', () => {
    expect(parseJson('{"a":"// not a comment /* either */"}').ok).toBe(true)
  })

  it('reports a trailing comma', () => {
    expect(failure('{"a":1,\n}')).toMatchObject({ code: 'trailing-comma', line: 1 })
    expect(failure('[1,\n2,\n]')).toMatchObject({ code: 'trailing-comma', line: 2 })
  })

  it('reports a repeated key at any depth', () => {
    expect(failure('{"a":{"b":1,"b":2}}').code).toBe('duplicate-key')
    expect(failure('{"a":1,\n"a":2}')).toMatchObject({ code: 'duplicate-key', line: 2 })
    expect(failure('{"g":[{"x":1},{"y":{"z":1,\n\n"z":1}}]}')).toMatchObject({ code: 'duplicate-key', line: 3 })
  })

  it('takes two spellings of one key for a repeated key', () => {
    expect(failure('{"a":1,"\\u0061":2}').code).toBe('duplicate-key')
  })

  it('reports syntax errors', () => {
    for (const bad of [
      '', ' ', '{', '[', '{"a"', '{"a":', '{"a":1', '[1 2]', '{a:1}', "{'a':1}", '[,1]', '{,}',
      '01', '1.', '.5', '+1', '1e', '-', 'NaN', 'Infinity', 'tru', 'nul', 'truex',
      '"a', '"\\x"', '"\\u12"', '"\t"', '"\n"', '1 2', '{} {}', '/x',
    ]) {
      expect(failure(bad).code, bad).toBe('syntax')
    }
  })

  it('counts the line of a syntax error', () => {
    expect(failure('{\n"a":1,\n\n"b" 2}')).toMatchObject({ code: 'syntax', line: 4 })
  })

  /* JsonDocument.Parse is strict about what starts a document (App.cs:355), and
     JSON.parse is too. CHECK AGAINST A REAL SERVER: the .NET reader refusing U+FEFF
     comes from the documentation of Utf8JsonReader, not from code read here. */
  it('parses a BOM-prefixed file as the server does', () => {
    expect(failure('﻿{"a":1}').code).toBe('syntax')
  })

  /* CHECK AGAINST A REAL SERVER: 64 is the documented default of
     JsonDocumentOptions.MaxDepth (App.cs:47 leaves it unset). The limit also keeps a
     hostile document from overflowing the stack of a recursive reader. */
  it('refuses what is nested deeper than the server reads, without overflowing', () => {
    expect(parseJson('['.repeat(64) + ']'.repeat(64)).ok).toBe(true)
    expect(failure('['.repeat(65) + ']'.repeat(65)).code).toBe('syntax')
    expect(failure('['.repeat(200000)).code).toBe('syntax')
  })
})

const WELL_FORMED = [
  '{}',
  '[]',
  '0',
  'null',
  'true',
  '"s"',
  ' \t\r\n{ "a" : [ 1 , 2 ] } \r\n',
  '{"2":1,"1":2,"10":"x","a":[]}',
  '{"big":12345678901234567890,"neg":-1.5e-7,"zero":-0}',
  '{"esc":"\\"\\\\\\/\\b\\f\\n\\r\\t\\u00e9\\ud83d\\ude00 \\ud800"}',
  '{"unicode":"ñ   😀","ñ":1}',
  '{"":{"":[{"":null}]}}',
  '{"__proto__":{"x":1},"constructor":[]}',
  '{"nested":[[[[[{"a":[{}]}]]]]]}',
]

describe('json-tree: agrees with JSON.parse', () => {
  it('on every well-formed fixture', () => {
    for (const t of WELL_FORMED) {
      expect(JSON.parse(stringifyJson(tree(t))), t).toEqual(JSON.parse(t))
    }
  })

  /* A small deterministic mangler: every text it makes is either refused, or read
     the way JSON.parse reads it. Anything JSON.parse refuses must be refused here. */
  it('on thousands of mangled documents', () => {
    const base = '{"a":[1,-2.5e3,true,false,null,"x\\u0041\\n"],"b":{"c":{},"d":[]},"2":"ñ"}'
    const alphabet = '{}[]:,"\\ 0123456789.-+eEtfn/\t\nu'
    let seed = 20261108
    const next = (n: number) => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff
      return seed % n
    }
    let accepted = 0
    for (let i = 0; i < 20000; i++) {
      let t = base
      for (let m = 1 + next(3); m > 0; m--) {
        const at = next(t.length + 1)
        const c = alphabet[next(alphabet.length)]
        const kind = next(3)
        t = kind === 0 ? t.slice(0, at) + c + t.slice(at) : kind === 1 ? t.slice(0, at) + t.slice(at + 1) : t.slice(0, at) + c + t.slice(at + 1)
      }
      let parsed: { ok: boolean; v?: unknown } = { ok: false }
      try {
        parsed = { ok: true, v: JSON.parse(t) }
      } catch {
        /* refused below */
      }
      const r = parseJson(t)
      if (!parsed.ok) {
        expect(r.ok, t).toBe(false)
      } else if (r.ok) {
        accepted++
        expect(JSON.parse(stringifyJson(r.root)), t).toEqual(parsed.v)
      } else {
        /* JSON.parse takes a repeated key; nothing else may be refused here. */
        expect(r.code, t).toBe('duplicate-key')
      }
    }
    expect(accepted).toBeGreaterThan(1000)
  })
})
