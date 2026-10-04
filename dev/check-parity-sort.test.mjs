// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const SCRIPT = fileURLToPath(new URL('./check-parity-sort.mjs', import.meta.url))

// Independent stock table census. Zones and records each include their declared
// row-number gap; an added stock column must make the executable gate fail.
const COLUMNS = [
  ['tableZonesBody', 8], ['tableEditZoneBody', 5],
  ['tableDnssecPropertiesPrivateKeysBody', 6], ['tbodyAdminUsers', 7],
  ['tbodyAdminGroups', 2], ['tbodyAdminSessions', 5], ['tbodyAdminCluster', 8],
  ['tbodyAdminPermissions', 1], ['tbodyUserDetailsActiveSessions', 4],
  ['tbodyMyProfileActiveSessions', 4], ['tbodyMyProfileMemberOf', 1],
  ['tableDhcpScopesBody', 4], ['tableDhcpLeasesBody', 7],
  ['tableStoreAppsBody', 1], ['tableAppsBody', 1],
  ['tbodyEditPermissionsUser', 1], ['tbodyEditPermissionsGroup', 1],
]

describe('sort parity gate', () => {
  let root
  let valid
  beforeAll(() => {
    root = mkdtempSync(join(tmpdir(), 'sort-parity-'))
    valid = join(root, 'index.html')
    writeFileSync(valid, COLUMNS.flatMap(([id, count]) =>
      Array.from({ length: count }, (_, column) => `<a onclick="sortTable('${id}', ${column})">Sort</a>`),
    ).join('\n'))
  })
  afterAll(() => rmSync(root, { recursive: true, force: true }))

  const run = (snapshot) => spawnSync(process.execPath, [SCRIPT], {
    env: { ...process.env, UPSTREAM_HTML: snapshot }, encoding: 'utf8', timeout: 10_000,
  })

  it('fails instead of reporting success when the requested snapshot is missing', () => {
    const outcome = run(join(root, 'missing.html'))
    expect(outcome.status).toBe(1)
    expect(outcome.stderr).toContain('SORT PARITY FAILED: upstream not found')
    expect(outcome.stderr).toContain('UPSTREAM_HTML')
    expect(outcome.stdout).not.toContain('SORT PARITY:')
  })

  it('accepts a valid explicitly supplied stock snapshot', () => {
    const outcome = run(valid)
    expect(outcome.status).toBe(0)
    expect(outcome.stdout).toContain('SORT PARITY: 64 of upstream\'s 66 sortable columns')
  })

  it('fails for a stock sortable column without a declared counterpart', () => {
    const snapshot = join(root, 'extra.html')
    writeFileSync(snapshot, COLUMNS.flatMap(([id, count]) =>
      Array.from({ length: count + (id === 'tableAppsBody' ? 1 : 0) }, (_, column) =>
        `sortTable('${id}', ${column})`),
    ).join('\n'))
    const outcome = run(snapshot)
    expect(outcome.status).toBe(1)
    expect(outcome.stdout).toContain('tableAppsBody')
    expect(outcome.stdout).toContain('1 undeclared')
  })
})
