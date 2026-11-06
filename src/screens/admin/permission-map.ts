import type { SectionPermission } from '../../api/admin'

/*
What the permissions matrix reads from `admin/permissions/list` (deviation 23): who
has an entry anywhere, and what a subject holds in one section. Nothing is asked
of the server that the list did not already bring.
*/

export interface Grant {
  canView: boolean
  canModify: boolean
  canDelete: boolean
}

export type Population = 'group' | 'user'

/** The three verbs, in upstream's column order, with the letter the matrix draws. */
export const VERBS = [
  { key: 'canView', name: 'View', letter: 'V' },
  { key: 'canModify', name: 'Modify', letter: 'M' },
  { key: 'canDelete', name: 'Delete', letter: 'D' },
] as const

/*
The columns: every group, then every user, that holds an entry in at least one
section, each in the order the server first lists it. A subject with no entry
anywhere is in no section's table upstream either, so it has no column here.
*/
export function subjectsOf(sections: readonly SectionPermission[]): { groups: string[]; users: string[] } {
  const groups: string[] = []
  const users: string[] = []
  for (const s of sections) {
    for (const p of s.groupPermissions) if (!groups.includes(p.name)) groups.push(p.name)
    for (const p of s.userPermissions) if (!users.includes(p.username)) users.push(p.username)
  }
  return { groups, users }
}

/*
A subject's entry in a section, or `null` when it has none. The two are not the
same thing and are not drawn the same: no entry is an empty cell, as it is a
missing row in upstream's section table; an entry that grants nothing is three
empty marks, as it is a row with no tick.

The server calls a user's subject `username` and a group's `name`.
*/
export function grantOf(section: SectionPermission, population: Population, subject: string): Grant | null {
  const entry =
    population === 'group'
      ? section.groupPermissions.find((p) => p.name === subject)
      : section.userPermissions.find((p) => p.username === subject)
  return entry == null ? null : { canView: entry.canView, canModify: entry.canModify, canDelete: entry.canDelete }
}

/** The verbs a grant holds, by name, or `None` when it holds none. */
export function grantText(grant: Grant): string {
  const granted = VERBS.filter((v) => grant[v.key]).map((v) => v.name)
  return granted.length === 0 ? 'None' : granted.join(', ')
}
