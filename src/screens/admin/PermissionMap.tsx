import { useRef, type MouseEvent } from 'react'
import type { SectionPermission } from '../../api/admin'
import { DataFoot, DataTable } from '../../ui/DataTable'
import { RowAction, Th, useSort, type Keys } from '../../ui/Table'
import { useTooltip } from '../../ui/Tooltip'
import { useMedia } from '../../lib/use-media'
import tbl from '../../ui/Table.module.css'
import { VERBS, grantOf, grantText, subjectsOf, type Grant, type Population } from './permission-map'
import styles from './Permissions.module.css'

/*
THE PERMISSIONS AS ONE MATRIX (deviation 23). Upstream's list is one table row per
section holding two small tables, users and groups, each with a tick per verb
(auth.js:2031-2073); here the same answer is read across: the eleven sections are
the rows, and the columns are the groups and then the users that hold an entry
anywhere, under upstream's own two titles. A cell is that subject's entry in that
section: three marks, V, M and D, filled for each verb it grants, and its tooltip
names them. No entry is an empty cell, as it is a missing row upstream; an entry
granting nothing is three empty marks.

The section's name and the row's `Edit Permissions` open upstream's dialog for
that section, as the name link and the `⋮` menu's only entry did; a click anywhere
else on the row does too. `Section` sorts, as upstream's header does. Under 720 px
the matrix folds into one block per section listing its groups and then its users,
with upstream's `No group permissions` / `No user permissions` where it has none.

Words OURS: the letters `V`, `M`, `D` and their legend, and `None` in a tooltip for
an entry that grants nothing.
*/

const KEYS: Keys<SectionPermission> = { section: (s) => s.section }

const NARROW = '(max-width: 720px)'

export function PermissionMap({
  sections,
  onEdit,
}: {
  sections: SectionPermission[]
  onEdit: (section: string) => void
}) {
  const narrow = useMedia(NARROW)
  const { rows, sort, toggle } = useSort(KEYS, sections)
  const { groups, users } = subjectsOf(sections)

  return (
    <DataTable toolbar={<Legend />} foot={<DataFoot count={`Total Sections: ${sections.length}`} />}>
      {narrow ? (
        <ul className={styles.blocks} aria-label="Permissions">
          {rows.map((s) => (
            <li key={s.section} className={styles.block}>
              <div className={styles.blockHead}>
                <button type="button" className={styles.sectionName} onClick={() => onEdit(s.section)}>
                  {s.section}
                </button>
                <div className={tbl.actions}>
                  <RowAction icon="edit" name="Edit Permissions" onClick={() => onEdit(s.section)} />
                </div>
              </div>
              <Entries
                title="Group Permissions"
                empty="No group permissions"
                entries={s.groupPermissions.map((p) => ({ name: p.name, grant: p }))}
              />
              <Entries
                title="User Permissions"
                empty="No user permissions"
                entries={s.userPermissions.map((p) => ({ name: p.username, grant: p }))}
              />
            </li>
          ))}
        </ul>
      ) : (
        <div className={styles.scroll}>
          <table className={styles.map}>
            <caption className={styles.sr}>Permissions</caption>
            <thead>
              <tr>
                <Th field="section" sort={sort} onSort={toggle} rowSpan={2} scope="col" className={styles.sectionHead}>
                  Section
                </Th>
                <PopulationHead title="Group Permissions" count={groups.length} />
                <PopulationHead title="User Permissions" count={users.length} />
                <th rowSpan={2} className={tbl.actionsCell}>
                  <span className={styles.sr}>Edit Permissions</span>
                </th>
              </tr>
              <tr>
                {groups.map((g, i) => (
                  <th key={g} scope="col" className={i === 0 ? `${styles.subject} ${styles.first}` : styles.subject}>
                    {g}
                  </th>
                ))}
                {users.map((u, i) => (
                  <th key={u} scope="col" className={i === 0 ? `${styles.subject} ${styles.first}` : styles.subject}>
                    {u}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* With no section the body is empty, as upstream's; the foot says 0. */}
              {rows.map((s, i) => (
                  <tr
                    key={s.section}
                    className={styles.row}
                    onClick={(e: MouseEvent) => {
                      if ((e.target as HTMLElement).closest('button') == null) onEdit(s.section)
                    }}
                  >
                    <th scope="row" className={styles.sectionCell}>
                      <button type="button" className={styles.sectionName} onClick={() => onEdit(s.section)}>
                        {s.section}
                      </button>
                    </th>
                    <Cells section={s} population="group" subjects={groups} first={i === 0} span={rows.length} />
                    <Cells section={s} population="user" subjects={users} first={i === 0} span={rows.length} />
                    <td className={tbl.actionsCell}>
                      <div className={tbl.actions}>
                        <RowAction icon="edit" name="Edit Permissions" onClick={() => onEdit(s.section)} />
                      </div>
                    </td>
                  </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </DataTable>
  )
}

/* What the three letters mean, at the toolbar's start. */
function Legend() {
  return (
    <ul className={styles.legend} aria-label="Legend">
      {VERBS.map((v) => (
        <li key={v.key}>
          <span className={styles.mark} data-on aria-hidden="true">
            {v.letter}
          </span>
          {v.name}
        </li>
      ))}
    </ul>
  )
}

/*
A population's title over its columns. With nobody in it the title stands over one
column for both header rows, and that column says upstream's literal once for every
section (`Cells`).
*/
function PopulationHead({ title, count }: { title: string; count: number }) {
  return (
    <th
      scope="colgroup"
      colSpan={Math.max(1, count)}
      rowSpan={count === 0 ? 2 : 1}
      className={`${styles.population} ${styles.first}`}
    >
      {title}
    </th>
  )
}

function Cells({
  section,
  population,
  subjects,
  first,
  span,
}: {
  section: SectionPermission
  population: Population
  subjects: string[]
  /** The first row carries the population's "nothing here" cell, spanning all rows. */
  first: boolean
  span: number
}) {
  if (subjects.length === 0) {
    return first ? (
      <td rowSpan={span} className={`${styles.none} ${styles.first}`}>
        {population === 'group' ? 'No group permissions' : 'No user permissions'}
      </td>
    ) : null
  }
  return (
    <>
      {subjects.map((subject, i) => {
        const grant = grantOf(section, population, subject)
        return (
          <td key={subject} className={i === 0 ? `${styles.cell} ${styles.first}` : styles.cell}>
            {grant != null && <Marks grant={grant} />}
          </td>
        )
      })}
    </>
  )
}

/* One entry: its three marks, and the verbs it grants in the tooltip and for a reader. */
function Marks({ grant }: { grant: Grant }) {
  const ref = useRef<HTMLSpanElement>(null)
  const text = grantText(grant)
  const tip = useTooltip({ text, placement: 'top', anchor: ref, describe: false })
  return (
    <span ref={ref} className={styles.marks} {...tip.events}>
      <span className={styles.sr}>{text}</span>
      {VERBS.map((v) => (
        <span key={v.key} className={styles.mark} data-on={grant[v.key] || undefined} aria-hidden="true">
          {v.letter}
        </span>
      ))}
      {tip.bubble}
    </span>
  )
}

/* The folded section: one population's entries, one per line. */
function Entries({
  title,
  empty,
  entries,
}: {
  title: string
  empty: string
  entries: { name: string; grant: Grant }[]
}) {
  return (
    <div className={styles.entries}>
      <div className={styles.entriesTitle}>{title}</div>
      {entries.length === 0 ? (
        <div className={styles.quiet}>{empty}</div>
      ) : (
        <ul className={styles.entryList}>
          {entries.map((e) => (
            <li key={e.name}>
              <span className={styles.who}>{e.name}</span>
              <Marks grant={e.grant} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
