import { describe, expect, it } from 'vitest'
import { DASH, check, checkedFiles, findDashes, withoutPlaceholders } from './check-dashes.mjs'

describe('em dashes', () => {
  it('none in the Markdown, the installer or the workflows', () => {
    expect(check()).toEqual([])
  })

  it('looks at the front page, the installer, the release workflow and the Markdown in docs', () => {
    const files = checkedFiles()
    for (const f of [
      'README.md',
      'CHANGELOG.md',
      'install.sh',
      '.github/workflows/release.yml',
      'docs/2026-10-01-blocking-section-spec.md',
    ])
      expect(files).toContain(f)
    expect(files.some((f) => /^(src|dev|docs)\/.*\.(tsx?|m?js|css|json|html)$/.test(f))).toBe(false)
  })

  it('lets the "no value" placeholder through, and nothing between words', () => {
    const ok = [`'${DASH}'`, `"${DASH}"`, `\`${DASH}\``, `«${DASH}»`, `**${DASH}**`, `>${DASH}<`, `| ${DASH} |`, `td ${DASH}`, `(a: ${DASH})`, `a, ${DASH}, b`]
    for (const p of ok) expect(withoutPlaceholders(`x ${p} y`)).not.toContain(DASH)
    expect(withoutPlaceholders(`one ${DASH} two`)).toContain(DASH)
    expect(withoutPlaceholders(`a${DASH}b`)).toContain(DASH)
    expect(findDashes(`a ${DASH} b\n'${DASH}'`, { placeholders: true })).toEqual([{ line: 1, text: `a ${DASH} b` }])
    expect(findDashes(`'${DASH}'`)).toEqual([{ line: 1, text: `'${DASH}'` }])
  })

  it('finds the line of each one, and not an en dash or a hyphen', () => {
    expect(findDashes(`one\ntwo ${DASH} three\n9\u201310 and a-b`)).toEqual([{ line: 2, text: `two ${DASH} three` }])
  })
})
