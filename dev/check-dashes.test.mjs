import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DASH, check, checkedFiles, findDashes, withoutPlaceholders } from './check-dashes.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

describe('em dashes', () => {
  it('none in any tracked text file, apart from the "no value" placeholder', () => {
    expect(check()).toEqual([])
  })

  it('looks at every tracked text file, code included, but not the lock file or upstream data', () => {
    const files = checkedFiles()
    for (const f of [
      'README.md',
      'install.sh',
      '.github/workflows/release.yml',
      'package.json',
      'vite.config.ts',
      'dev/check-dashes.mjs',
      'src/main.tsx',
    ])
      expect(files).toContain(f)
    expect(files).not.toContain('package-lock.json')
    expect(files.some((f) => f.startsWith('public/json/'))).toBe(false)
  })

  it('reads only tracked files, so it needs no file that is not in the repository', () => {
    const files = checkedFiles()
    expect(files.length).toBeGreaterThan(0)
    for (const f of files) expect(existsSync(join(ROOT, f))).toBe(true)
  })

  it('lets the placeholder through as a whole literal or a whole JSX text, and nothing between words', () => {
    const ok = [`'${DASH}'`, `"${DASH}"`, `\`${DASH}\``, `>${DASH}<`]
    for (const p of ok) expect(withoutPlaceholders(`x ${p} y`)).not.toContain(DASH)
    expect(withoutPlaceholders(`    ${DASH}`)).not.toContain(DASH)
    expect(withoutPlaceholders(`one ${DASH} two`)).toContain(DASH)
    expect(withoutPlaceholders(`a${DASH}b`)).toContain(DASH)
    expect(withoutPlaceholders(`'Version ${DASH}'`)).toContain(DASH)
    expect(withoutPlaceholders(`'${DASH}"`)).toContain(DASH)
  })

  it('in code, catches a dash in a comment and lets the placeholder literal through', () => {
    const ts = [
      `// one ${DASH} two`,
      `const v = x ?? '${DASH}'`,
      `/* the '${DASH}' placeholder */`,
      `return <span>${DASH}</span>`,
      `expect(screen.getByText('${DASH}')).toBeInTheDocument()`,
      `const s = 'a ${DASH} b'`,
      `const t = '${DASH}' // and ${DASH} here`,
    ].join('\n')
    expect(findDashes(ts, { kind: 'ts' }).map((f) => f.line)).toEqual([1, 3, 6, 7])
    expect(findDashes(`.a { content: '${DASH}'; } /* x ${DASH} y */`, { kind: 'css' }).map((f) => f.line)).toEqual([1])
    expect(findDashes(`.a { content: '${DASH}'; }`, { kind: 'css' })).toEqual([])
  })

  it('outside code there is no placeholder: every dash is a finding', () => {
    expect(findDashes(`'${DASH}'`)).toEqual([{ line: 1, text: `'${DASH}'` }])
  })

  it('finds the line of each one, and not an en dash or a hyphen', () => {
    expect(findDashes(`one\ntwo ${DASH} three\n9\u201310 and a-b`)).toEqual([{ line: 2, text: `two ${DASH} three` }])
  })

  describe('in a repository of its own', () => {
    let root
    const write = (rel, text) => {
      mkdirSync(dirname(join(root, rel)), { recursive: true })
      writeFileSync(join(root, rel), text)
    }

    beforeAll(() => {
      root = mkdtempSync(join(tmpdir(), 'check-dashes-'))
      execFileSync('git', ['init', '-q'], { cwd: root })
      write('src/a.ts', `// a comment ${DASH} with a dash\nexport const none = '${DASH}'\n`)
      write('src/b.tsx', `export const B = () => <td>${DASH}</td>\n`)
      write('dev/tool.mjs', `const placeholder = '${DASH}'\n`)
      write('README.md', `| a | ${DASH} |\n`)
      write('package-lock.json', `{ "x": "${DASH}" }\n`)
      write('public/json/list.json', `{ "x": "${DASH}" }\n`)
      write('public/img.bin', Buffer.from([0, 1, 2, 0xe2, 0x80, 0x94]))
      execFileSync('git', ['add', '.'], { cwd: root })
      write('AGENTS.md', `untracked ${DASH} never read\n`)
    })
    afterAll(() => rmSync(root, { recursive: true, force: true }))

    it('reports the comment in src, the literal outside src and the Markdown, and nothing else', () => {
      expect(check({ root })).toEqual([
        `README.md:1  | a | ${DASH} |`,
        `dev/tool.mjs:1  const placeholder = '${DASH}'`,
        `src/a.ts:1  // a comment ${DASH} with a dash`,
      ])
    })

    it('never reads an untracked file', () => {
      expect(checkedFiles({ root })).not.toContain('AGENTS.md')
      expect(check({ root }).some((f) => f.startsWith('AGENTS.md'))).toBe(false)
    })

    it('can be narrowed to some paths', () => {
      expect(check({ root, paths: ['src'] })).toEqual([`src/a.ts:1  // a comment ${DASH} with a dash`])
    })
  })
})
