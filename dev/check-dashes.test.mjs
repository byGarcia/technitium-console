import { describe, expect, it } from 'vitest'
import { DASH, check, checkedFiles, findDashes } from './check-dashes.mjs'

describe('em dashes', () => {
  it('none in the files people read on the front page, the installer or the workflows', () => {
    expect(check()).toEqual([])
  })

  it('looks at the README, the CHANGELOG, the installer and the release workflow', () => {
    const files = checkedFiles()
    for (const f of ['README.md', 'CHANGELOG.md', 'install.sh', '.github/workflows/release.yml'])
      expect(files).toContain(f)
    expect(files.some((f) => f.startsWith('src/') || f.startsWith('docs/'))).toBe(false)
  })

  it('finds the line of each one, and not an en dash or a hyphen', () => {
    expect(findDashes(`one\ntwo ${DASH} three\n9\u201310 and a-b`)).toEqual([{ line: 2, text: `two ${DASH} three` }])
  })
})
