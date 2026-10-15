import { describe, expect, it } from 'vitest'
import {
  addHeading, addList, addListTo, applyQuick, applyQuickTo, canMove, canToggle, changesOf, changesText, fromUrls, groupOf,
  HEADING_MAX, headingEdits, headingIndexes, headingName, headingProblem, listName, moveLine, parseLine,
  removeHeading, renameHeading, saveBody, sameLines, toggleLine,
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

describe('groups', () => {
  const raws = (lines: { raw: string }[]) => lines.map((l) => l.raw)
  const A = 'https://a.test/a'
  const B = 'https://b.test/b'
  const C = 'https://c.test/c'
  // One list with no group, then "Ads" with two, then "Allow" with one.
  const lines = fromUrls([A, '# Ads', B, `#${C}`, '#Allow', '!https://d.test/d'])

  it('a comment is a heading, and its lists run to the next heading', () => {
    expect(headingIndexes(lines)).toEqual([1, 4])
    expect([0, 1, 2, 3, 4, 5].map((i) => groupOf(lines, i))).toEqual([-1, 0, 0, 0, 1, 1])
    expect(headingName(lines[1])).toBe('Ads')
    expect(headingName(lines[4])).toBe('Allow')
  })

  it('a switched-off list is not a heading: it stays in its group', () => {
    expect(lines[3]).toMatchObject({ kind: 'block', enabled: false })
  })

  it('refuses a name the server would not keep as one comment line', () => {
    expect(headingProblem('  ')).toBe('Enter a group name.')
    expect(headingProblem('Ads\nTrackers')).toBe('A group name is one line.')
    expect(headingProblem('Ads, trackers')).toBe('A group name cannot contain a comma: the server splits the list at commas.')
    expect(headingProblem('x'.repeat(HEADING_MAX + 1))).toBe(`A group name can be up to ${HEADING_MAX} characters.`)
    expect(headingProblem('x'.repeat(HEADING_MAX))).toBeNull()
    expect(headingProblem(HOSTS)).toBe('A group name cannot be a list URL.')
    expect(headingProblem(`!${HOSTS}`)).toBe('A group name cannot be a list URL.')
    expect(headingProblem('file:///etc/list.txt')).toBe('A group name cannot be a list URL.')
    expect(headingProblem('Ads and trackers')).toBeNull()
  })

  it('a heading is saved as "# Name", and reads back as the same heading', () => {
    const out = addHeading(lines, '  Family devices ')
    expect(out.at(-1)).toEqual({ raw: '# Family devices', kind: 'comment', url: null, enabled: false })
    expect(fromUrls(saveBody(out, '').blockListUrls.split(','))).toEqual(out)
  })

  it('an invalid name changes nothing', () => {
    expect(addHeading(lines, 'a, b')).toBe(lines)
    expect(renameHeading(lines, 1, HOSTS)).toBe(lines)
  })

  it('renames only a heading', () => {
    expect(raws(renameHeading(lines, 1, 'Adverts'))).toEqual([A, '# Adverts', B, `#${C}`, '#Allow', '!https://d.test/d'])
    expect(renameHeading(lines, 0, 'Adverts')).toBe(lines)
  })

  it('removing a heading keeps its lists, which join the group above', () => {
    const out = removeHeading(lines, 4)
    expect(raws(out)).toEqual([A, '# Ads', B, `#${C}`, '!https://d.test/d'])
    expect(groupOf(out, 4)).toBe(0)
    // The first heading's lists join the block with no group.
    expect([1, 2].map((i) => groupOf(removeHeading(lines, 1), i))).toEqual([-1, -1])
    expect(removeHeading(lines, 0)).toBe(lines)
  })

  it('adds a list last in the chosen group', () => {
    expect(raws(addListTo(lines, 'https://e.test/e', 'block', -1))[1]).toBe('https://e.test/e')
    expect(raws(addListTo(lines, 'https://e.test/e', 'allow', 0))[4]).toBe('!https://e.test/e')
    expect(raws(addListTo(lines, 'https://e.test/e', 'block', 1)).at(-1)).toBe('https://e.test/e')
    expect(addListTo(lines, A, 'block', 1)).toBe(lines)
  })

  it('Quick Add puts what it appends into the chosen group, and skips what is there', () => {
    const out = applyQuickTo(lines, { name: 'Two', urls: [A, 'https://e.test/e'] }, 0)
    expect(raws(out)).toEqual([A, '# Ads', B, `#${C}`, 'https://e.test/e', '#Allow', '!https://d.test/d'])
    const same = applyQuickTo(lines, { name: 'One', urls: [A] }, 0)
    expect(same).toBe(lines)
  })

  it('Quick Add None and Default keep their meaning: every line, headings included', () => {
    expect(applyQuickTo(lines, 'none', 1)).toEqual([])
    expect(raws(applyQuickTo(lines, { name: 'Default', urls: [HOSTS] }, 1))).toEqual([HOSTS])
  })

  it('moves a list one line, across a heading into the next group', () => {
    // B moves up over "# Ads": it becomes the last of the block with no group.
    const up = moveLine(lines, 2, -1)
    expect(raws(up)).toEqual([A, B, '# Ads', `#${C}`, '#Allow', '!https://d.test/d'])
    expect(groupOf(up, 1)).toBe(-1)
    // The switched-off C moves down over "#Allow": it becomes the first of that group.
    const down = moveLine(lines, 3, 1)
    expect(raws(down)).toEqual([A, '# Ads', B, '#Allow', `#${C}`, '!https://d.test/d'])
    expect(groupOf(down, 4)).toBe(1)
    // Within a group it only swaps.
    expect(raws(moveLine(lines, 3, -1)).slice(2, 4)).toEqual([`#${C}`, B])
  })

  it('a heading does not move, and the ends are the ends', () => {
    expect(canMove(lines, 1, 1)).toBe(false)
    expect(moveLine(lines, 1, 1)).toBe(lines)
    expect(canMove(lines, 0, -1)).toBe(false)
    expect(canMove(lines, 5, 1)).toBe(false)
    expect(canMove(lines, 5, -1)).toBe(true)
  })

  it('counts heading edits: a rename is one, an addition or a removal is one', () => {
    expect(headingEdits(['# A', '# B'], ['# A', '# B'])).toBe(0)
    expect(headingEdits(['# A', '# B'], ['# A', '# C'])).toBe(1)
    expect(headingEdits(['# A', '# B'], ['# B'])).toBe(1)
    expect(headingEdits([], ['# A', '# B'])).toBe(2)
  })
})

describe('changesOf, the save bar in words', () => {
  const A = 'https://a.test/a.txt'
  const B = 'https://b.test/b.txt'
  const C = 'file:///etc/dns/c.txt'
  const text = (before: string[], after: ReturnType<typeof fromUrls>) => changesText(changesOf(fromUrls(before), after))

  it('says nothing when nothing changed', () => {
    expect(text([A, '# G', B], fromUrls([A, '# G', B]))).toBe('')
  })

  it('names an addition, a removal, a switch off and a move, once each', () => {
    // The screen's own sequence: add C, remove the allow list, switch A off, move B up.
    let lines = fromUrls([A, '# G', B, `!${C}`])
    lines = addListTo(lines, 'https://d.test/d.txt', 'block', -1)
    lines = lines.filter((l) => l.raw !== `!${C}`)
    lines = lines.map((l) => (l.url === A ? toggleLine(l) : l))
    lines = moveLine(lines, lines.findIndex((l) => l.url === B), -1)
    expect(text([A, '# G', B, `!${C}`], lines)).toBe('1 added, 1 removed, 1 switched off, 1 moved')
  })

  it('a switch back on, and a list that became the other kind', () => {
    expect(text([`#${A}`, B], fromUrls([A, `!${B}`]))).toBe('1 switched on, 1 changed')
  })

  it('a list moved across a heading is moved; one moved three places is one move', () => {
    expect(text(['# G', A], fromUrls([A, '# G']))).toBe('1 moved')
    expect(text([A, B, C, 'https://d.test/'], fromUrls([B, C, 'https://d.test/', A]))).toBe('1 moved')
  })

  it('adding or removing a list moves nothing', () => {
    expect(text([A, B, C], fromUrls([A, C]))).toBe('1 removed')
    expect(text([A, C], addListTo(fromUrls([A, '# G', C]), B, 'block', -1).filter((l) => l.kind !== 'comment'))).toBe('1 added')
  })

  it('groups: a rename is a rename; ungrouping one and adding another is not', () => {
    expect(text(['# Ads', A], fromUrls(['# Adverts', A]))).toBe('1 group renamed')
    expect(text(['# One', A, '# Two', B], fromUrls([A, '# Two', B, '# Three']))).toBe('1 group added, 1 group removed')
    expect(text(['# One', A], fromUrls([A]))).toBe('1 group removed')
    expect(text([A, B], fromUrls([A, B, '# X', '# Y']))).toBe('2 groups added')
  })

  it('reports something exactly when the lines differ, over random edits', () => {
    let seed = 7
    const rand = (n: number) => {
      seed = (seed * 1103515245 + 12345) % 2147483648
      return seed % n
    }
    const urls = [A, B, C, 'https://d.test/', 'https://e.test/']
    for (let round = 0; round < 400; round++) {
      const saved = fromUrls(['# G1', A, B, '# G2', C, `#${'https://d.test/'}`])
      let lines = saved
      for (let step = 0; step < 1 + rand(5); step++) {
        // Every other round only moves: an order change alone must be reported too.
        const op = round % 2 === 0 ? 3 : rand(6)
        const lists = lines.map((l, i) => [l, i] as const).filter(([l]) => l.kind !== 'comment')
        if (op === 0) lines = addListTo(lines, urls[rand(urls.length)], rand(2) === 0 ? 'block' : 'allow', rand(3) - 1)
        else if (op === 1 && lists.length > 0) {
          const [, i] = lists[rand(lists.length)]
          lines = lines.filter((_, j) => j !== i)
        } else if (op === 2 && lists.length > 0) {
          const [, i] = lists[rand(lists.length)]
          lines = lines.map((l, j) => (j === i ? toggleLine(l) : l))
        } else if (op === 3 && lists.length > 0) {
          const [, i] = lists[rand(lists.length)]
          lines = moveLine(lines, i, rand(2) === 0 ? -1 : 1)
        } else if (op === 4) lines = addHeading(lines, `H${rand(3)}`)
        else {
          const heads = headingIndexes(lines)
          if (heads.length > 0) lines = rand(2) === 0
            ? removeHeading(lines, heads[rand(heads.length)])
            : renameHeading(lines, heads[rand(heads.length)], `R${rand(3)}`)
        }
      }
      expect(changesText(changesOf(saved, lines)) !== '').toBe(!sameLines(saved, lines))
    }
  })
})
