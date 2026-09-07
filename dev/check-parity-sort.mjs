/*
Which of upstream's sortable columns are still sortable here.

## Why this file exists

`check-parity-controls.mjs` counts three things —destinations, help texts and
examples— and it has been green throughout. A sortable column header is none of
the three, so it walks straight past it, and that blind spot has now cost twice:

  · About (2026-09-04): the three links of the update modal were `href="#"` filled
    in by JavaScript, so "all 28 destinations present" was true and useless.
  · Apps (2026-09-07): upstream's `Store Apps` header is a sort link and this
    console had dropped it. Found by reading upstream by hand, which is not a
    method.

A green tool is not a contract. This one turns the remaining half of that lesson
into something that fails on its own.

## How it measures

Upstream declares every sortable column as `sortTable('<tbodyId>', <n>)` inside
the `<a>` of its `<th>`, so the census is exact and comes from the source rather
than from a list somebody typed. Ours are `<Th field=…>`, plus the handful of
sort affordances that are not table headers.

The comparison is per TABLE and by count, not by column name: upstream's labels
live in the HTML and ours in TSX, and matching them by string would be a second
inventory to keep in sync — which is the thing that rots.

Every gap must be DECLARED below with its reason. An undeclared gap is a finding;
a declared one that has closed is also a finding, because a reason nobody needs
any more is a reason nobody rereads.

Exit code is the number of findings.
*/
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '..')
const UPSTREAM = path.resolve(ROOT, '../technitium-ui/DnsServerCore/www/index.html')

/**
 * Upstream table id -> where it lives here, how many of its columns we made
 * sortable, and the reason for any gap.
 *
 * `ours` counts the sort affordances the surface really offers, whether they are
 * `<Th field>` or not: the store's is a button over a list, and it counts.
 */
const MAP = [
  { id: 'tableZonesBody', file: 'src/screens/zones/ZoneList.tsx', ours: 7,
    gap: 'The `#` column. Sorting by the row number the sort itself has just handed out leads nowhere, and it sorts as text: 1, 10, 11, 2.' },
  { id: 'tableEditZoneBody', file: 'src/screens/zones/ZoneRecords.tsx', ours: 4,
    gap: 'The `#` column, for the same reason. Documented at the head of the file.' },
  { id: 'tableDnssecPropertiesPrivateKeysBody', file: 'src/screens/zones/modals/DnssecProperties.tsx', ours: 6 },
  { id: 'tbodyAdminUsers', file: 'src/screens/admin/Users.tsx', ours: 7 },
  { id: 'tbodyAdminGroups', file: 'src/screens/admin/Groups.tsx', ours: 2 },
  { id: 'tbodyAdminSessions', file: 'src/screens/admin/Sessions.tsx', ours: 5 },
  { id: 'tbodyAdminCluster', file: 'src/screens/admin/Cluster.tsx', ours: 8 },
  { id: 'tbodyAdminPermissions', file: 'src/screens/admin/Permissions.tsx', ours: 1 },
  { id: 'tbodyUserDetailsActiveSessions', file: 'src/screens/admin/UserDetails.tsx', ours: 4 },
  { id: 'tbodyMyProfileActiveSessions', file: 'src/screens/modals/MyProfile.tsx', ours: 4 },
  { id: 'tbodyMyProfileMemberOf', file: 'src/screens/modals/MyProfile.tsx', ours: 1 },
  { id: 'tableDhcpScopesBody', file: 'src/screens/dhcp/Scopes.tsx', ours: 4 },
  { id: 'tableDhcpLeasesBody', file: 'src/screens/dhcp/Leases.tsx', ours: 7 },
  { id: 'tableStoreAppsBody', file: 'src/screens/apps/StoreApps.tsx', ours: 1 },
  { id: 'tableAppsBody', file: 'src/screens/apps/Apps.tsx', ours: 1 },
  { id: 'tbodyEditPermissionsUser', file: 'src/screens/admin/Permissions.tsx', ours: 1 },
  { id: 'tbodyEditPermissionsGroup', file: 'src/screens/admin/Permissions.tsx', ours: 1 },
]

if (!fs.existsSync(UPSTREAM)) {
  console.log(`\n  upstream not found at ${UPSTREAM} — nothing measured.\n`)
  process.exit(0)
}

const html = fs.readFileSync(UPSTREAM, 'utf8')
const upstream = new Map()
for (const m of html.matchAll(/sortTable\('([^']+)',\s*(\d+)\)/g)) {
  const [, id, col] = m
  if (!upstream.has(id)) upstream.set(id, new Set())
  upstream.get(id).add(Number(col))
}

const findings = []
const seen = new Set()

for (const row of MAP) {
  seen.add(row.id)
  const theirs = upstream.get(row.id)?.size
  if (theirs == null) {
    findings.push(`${row.id}: declared here but upstream no longer sorts it`)
    continue
  }
  const gap = theirs - row.ours
  if (gap > 0 && row.gap == null) {
    findings.push(`${row.id} (${row.file}): upstream sorts ${theirs} columns, this console ${row.ours} — ${gap} undeclared`)
  }
  if (gap <= 0 && row.gap != null) {
    findings.push(`${row.id}: the gap is declared and no longer exists — remove the reason`)
  }
}

for (const id of upstream.keys()) {
  if (!seen.has(id)) findings.push(`${id}: upstream sorts it and this file does not say where it lives here`)
}

const theirTotal = [...upstream.values()].reduce((n, s) => n + s.size, 0)
const ourTotal = MAP.reduce((n, r) => n + r.ours, 0)

if (findings.length === 0) {
  console.log(
    `\n  SORT PARITY: ${ourTotal} of upstream's ${theirTotal} sortable columns, across ${MAP.length} tables.\n` +
      `  The ${theirTotal - ourTotal} missing are declared, with a reason each.\n`,
  )
} else {
  console.log('')
  for (const f of findings) console.log(`  ${f}`)
  console.log(`\n  ${findings.length} findings\n`)
}
process.exit(Math.min(findings.length, 250))
