import { describe, expect, it } from 'vitest'
import {
  addList, applyQuick, canToggle, fromUrls, listName, parseLine, saveBody, sameLines, toggleLine,
} from './list-lines'

const HOSTS = 'https://raw.githubusercontent.com/StevenBlack/hosts/master/hosts'

describe('parseLine', () => {
  it('drops an empty line', () => {
    expect(parseLine('')).toBeNull()
    expect(parseLine('   ')).toBeNull()
  })

  it('reads a block list', () => {
    expect(parseLine(HOSTS)).toEqual({ raw: HOSTS, kind: 'block', url: HOSTS, enabled: true })
  })

  it('reads an allow list', () => {
    expect(parseLine('!https://a.test/allow.txt')).toEqual({
      raw: '!https://a.test/allow.txt', kind: 'allow', url: 'https://a.test/allow.txt', enabled: true,
    })
  })

  it('trims before reading, as the server does', () => {
    expect(parseLine(`   ${HOSTS}  `)?.raw).toBe(HOSTS)
  })

  it('reads a disabled block list and a disabled allow list', () => {
    expect(parseLine(`#${HOSTS}`)).toMatchObject({ kind: 'block', url: HOSTS, enabled: false })
    expect(parseLine('# !https://a.test/x')).toMatchObject({ kind: 'allow', url: 'https://a.test/x', enabled: false })
  })

  it('reads a file:// list', () => {
    expect(parseLine('file:///home/folder/myblocklist.txt')).toMatchObject({ kind: 'block', enabled: true })
    expect(parseLine('#file:///c:/folder/list.txt')).toMatchObject({ kind: 'block', enabled: false })
  })

  it('a # line that is not a list is a comment', () => {
    expect(parseLine('# my lists')).toEqual({ raw: '# my lists', kind: 'comment', url: null, enabled: false })
    expect(parseLine('#ftp://x.test/list')).toMatchObject({ kind: 'comment' })
  })

  it('a line without # is a list even when it is not a valid URL: the server treats it as one', () => {
    expect(parseLine('not a url')).toMatchObject({ kind: 'block', url: 'not a url', enabled: true })
  })
})

describe('toggleLine', () => {
  it('disabling prefixes #, enabling removes only that # and the spaces after it', () => {
    const on = parseLine('!https://a.test/x')!
    const off = toggleLine(on)
    expect(off).toMatchObject({ raw: '#!https://a.test/x', enabled: false, kind: 'allow' })
    expect(toggleLine(off)).toEqual(on)
    expect(toggleLine(parseLine(`#   ${HOSTS}`)!).raw).toBe(HOSTS)
  })

  it('a comment does not toggle', () => {
    const c = parseLine('# note')!
    expect(toggleLine(c)).toBe(c)
  })

  it('an enabled line that is not a list URL does not toggle: it would become a comment', () => {
    const l = parseLine('not a url')!
    expect(toggleLine(l)).toBe(l)
  })
})

describe('canToggle', () => {
  it('a block URL and a disabled URL toggle, a comment and a line that is not a list URL do not', () => {
    expect(canToggle(parseLine(HOSTS)!)).toBe(true)
    expect(canToggle(parseLine(`#${HOSTS}`)!)).toBe(true)
    expect(canToggle(parseLine('# note')!)).toBe(false)
    expect(canToggle(parseLine('not a url')!)).toBe(false)
  })
})

describe('addList', () => {
  it('appends a block or an allow list, trimmed', () => {
    const lines = addList(addList([], `  ${HOSTS} `, 'block'), 'https://a.test/x', 'allow')
    expect(lines.map((l) => l.raw)).toEqual([HOSTS, '!https://a.test/x'])
  })

  it('ignores an empty field and a list already there', () => {
    const one = addList([], HOSTS, 'block')
    expect(addList(one, '   ', 'block')).toBe(one)
    expect(addList(one, HOSTS, 'block')).toBe(one)
  })
})

describe('applyQuick', () => {
  const lines = fromUrls([HOSTS, '# note'])

  it('None empties the list', () => {
    expect(applyQuick(lines, 'none')).toEqual([])
  })

  it('Default replaces', () => {
    const out = applyQuick(lines, { name: 'Default', urls: ['https://d.test/a'] })
    expect(out.map((l) => l.raw)).toEqual(['https://d.test/a'])
  })

  it('any other entry appends without repeating a URL', () => {
    const out = applyQuick(lines, { name: 'Two', urls: [HOSTS, 'https://b.test/b'] })
    expect(out.map((l) => l.raw)).toEqual([HOSTS, '# note', 'https://b.test/b'])
  })
})

describe('listName', () => {
  const catalog = [
    { name: 'Default', urls: [HOSTS] },
    { name: 'Steven Black [adware + malware]', urls: [HOSTS] },
    { name: 'Bundle', urls: ['https://x.test/1', 'https://x.test/2'] },
  ]

  it('names a URL by its single-URL catalog entry, never by Default or None', () => {
    expect(listName(HOSTS, catalog)).toBe('Steven Black [adware + malware]')
  })

  it('has no name for an unknown URL or one that only appears in a bundle', () => {
    expect(listName('https://x.test/1', catalog)).toBeNull()
    expect(listName('https://nowhere.test', catalog)).toBeNull()
  })
})

describe('saveBody', () => {
  it('sends only blockListUrls, cleaned as Settings cleans it, with the node first', () => {
    expect(saveBody(fromUrls([HOSTS, '#!https://a.test/x']), 'cluster')).toEqual({
      node: 'cluster',
      blockListUrls: `${HOSTS},#!https://a.test/x`,
    })
  })

  it('an empty list travels as the string false', () => {
    expect(saveBody([], '')).toEqual({ node: '', blockListUrls: 'false' })
  })
})

describe('sameLines', () => {
  it('compares the saved text, line by line', () => {
    expect(sameLines(fromUrls([HOSTS]), fromUrls([` ${HOSTS} `]))).toBe(true)
    expect(sameLines(fromUrls([HOSTS]), fromUrls([`#${HOSTS}`]))).toBe(false)
  })
})
