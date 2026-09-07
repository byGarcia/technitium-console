import type { ReactNode } from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '../../ui/Button'
import { Dialog } from '../../ui/Dialog'
import { SectionHeader } from '../../ui/SectionHeader'
import { SectionIndex } from '../../ui/SectionIndex'
import { Loading } from '../../ui/Empty'
import { Panel } from '../../ui/Panel'
import { Matrix, MatrixCell, MatrixEmpty, MatrixGroup, MatrixMarks, MatrixRow } from '../../ui/Matrix'
import {
  getPermission,
  listPermissions,
  setPermissions,
  type SectionPermission,
} from '../../api/admin'
import { primaryNodeName, type ClusterState } from '../../api/admin-cluster'
import { addToTable, BLANK_OPTION, NONE_OPTION, serializeTable, type Cell } from './table'
import { noticeFromFailure, MRow, adminStyles as styles, type Notice } from './parts'
import { Th, useSort, type Keys } from '../../ui/Table'
import { Select } from '../../ui/Select'
import { EditableTable } from '../../ui/EditableTable'
import { Notifier } from '../../ui/Notifier'

/*
`refreshAdminPermissions`, `showEditSectionPermissionsModal` and
`saveSectionPermissions` (auth.js:1938-2150).

Three things that govern this screen:

  · The list's table is READ-ONLY: permissions are edited in the modal. Here the
    checkboxes are drawn disabled, which is the equivalent of upstream's
    `glyphicon-ok` while still resembling the modal's table.
  · The group list the modal offers INCLUDES `Everyone`, and `groups/list`'s does
    not. They are two different lists from the server and cannot be swapped
    (checked live against a v15.4).
  · `permissions/set` travels with `node` = the name of the cluster's PRIMARY
    node, not the node being looked at; an empty string when there is no cluster.
    And it asks for `Administration.canDelete`, not `canModify`
    (WebServiceAuthApi.cs:1533).
*/

interface Props {
  /** The section sub-navigation, drawn under the header. */
  tabs?: ReactNode
  token: string | null
  cluster: ClusterState | null
  onNotice: (a: Notice) => void
}

const VERBS = ['View', 'Modify', 'Delete'] as const

/** The id a section's panel and its index entry share. */
function anchor(section: string): string {
  return `perm-${section.toLowerCase()}`
}

export function Permissions({ tabs, token, cluster, onNotice }: Props) {
  const [sections, setSecciones] = useState<SectionPermission[]>([])
  const [loading, setLoading] = useState(true)
  const [edit, setEdit] = useState<string | null>(null)
  const [here, setHere] = useState<string | undefined>(undefined)

  const load = useCallback(async () => {
    setLoading(true)
    const outcome = await listPermissions(token)
    setLoading(false)

    if (outcome.kind !== 'ok') {
      setSecciones([])
      onNotice(noticeFromFailure(outcome))
      return
    }
    setSecciones(outcome.data.response.permissions)
  }, [token, onNotice])

  useEffect(() => {
    void load()
  }, [load])

  /*
  Which of the eleven you are looking at, for the index.

  `ui/SectionIndex` deliberately does not observe the scroll —"who works out the
  active one is screen wiring, and it belongs to phase 3"— so here it is, and this
  is the first screen to wire it. An index with no current entry is half a
  primitive: it can take you somewhere but not tell you where you are.
  */
  const boxes = useRef<Map<string, HTMLElement>>(new Map())
  useEffect(() => {
    if (loading || sections.length === 0) return
    const visto = new Set<string>()
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) visto.add(e.target.id)
          else visto.delete(e.target.id)
        }
        // The topmost one that is on screen: with eleven panels several are, and
        // marking the last would say you are further down than you are.
        const order = sections.map((x) => anchor(x.section))
        setHere(order.find((id) => visto.has(id)))
      },
      { rootMargin: '-72px 0px -60% 0px' },
    )
    for (const el of boxes.current.values()) observer.observe(el)
    return () => observer.disconnect()
  }, [loading, sections])

  /*
  The concession map: the subjects down the side, the eleven sections across.

  It exists because eleven stacked panels compare nothing, and comparing is what
  this screen is for — "can DNS Administrators delete in Zones and not in Cache"
  has no answer without scrolling two and a half thousand pixels and remembering.
  The eleven sections stay below, whole and never folded; what changes is that the
  wall stops being the only way through.

  Subjects come from the sections themselves and in the server's own order, so no
  list is invented and none is asked for twice.
  */
  const sujetos = (() => {
    const users: string[] = []
    const groups: string[] = []
    for (const s of sections) {
      for (const p of s.userPermissions) if (!users.includes(p.username)) users.push(p.username)
      for (const p of s.groupPermissions) if (!groups.includes(p.name)) groups.push(p.name)
    }
    return { users, groups }
  })()

  const hasMap = sujetos.users.length + sujetos.groups.length > 0

  function row(who: string, population: 'user' | 'group') {
    return sections.map((s) => {
      const entrada =
        population === 'user'
          ? s.userPermissions.find((p) => p.username === who)
          : s.groupPermissions.find((p) => p.name === who)
      /*
      No entry at all is NOT the same as an entry that grants nothing, and the
      two are drawn differently: an empty cell against three empty boxes. The
      distinction is free to draw and needs no word; where it is told in full is
      the eleven sections below, which are unchanged — a subject with no entry
      simply has no row there.
      */
      if (entrada == null) return <td key={s.section} />
      return (
        <MatrixMarks
          key={s.section}
          verbs={[
            { verb: 'View', granted: entrada.canView },
            { verb: 'Modify', granted: entrada.canModify },
            { verb: 'Delete', granted: entrada.canDelete },
          ]}
        />
      )
    })
  }

  return (
    <>
      <SectionHeader
        title="Administration"
        tabs={tabs}
      />

      {loading ? (
        <Loading />
      ) : (
        <>
          {/*
          The index sits beside the WHOLE screen and not beside the map: it is
          pilot 3's column, and what it indexes is the eleven sections below.
          Beside the map alone it left a hole as tall as its eleven entries.
          */}
          <div className={styles.withIndex}>
            <div className={styles.column}>
              {/*
              The concession map. No title: `Panel` groups without one, and a name
              for this box would be product copy that upstream does not have. Its
              own column and row headers already say what it is.
              */}
              {hasMap && (
                <Panel className={styles.map}>
                  <Matrix
                    dense
                    captionHidden
                    caption="Permissions"
                    columns={[
                      { label: '', wide: true },
                      ...sections.map((s) => ({ label: s.section })),
                    ]}
                  >
                    {sujetos.users.length > 0 && (
                      <MatrixGroup label="User Permissions" span={sections.length + 1} />
                    )}
                    {sujetos.users.map((u) => (
                      <MatrixRow key={u} subject={u} stick>
                        {row(u, 'user')}
                      </MatrixRow>
                    ))}
                    {sujetos.groups.length > 0 && (
                      <MatrixGroup label="Group Permissions" span={sections.length + 1} />
                    )}
                    {sujetos.groups.map((g) => (
                      <MatrixRow key={g} subject={g} stick>
                        {row(g, 'group')}
                      </MatrixRow>
                    ))}
                  </Matrix>
                </Panel>
              )}

              {/* The section's name is the panel's title, not a link: it was an
                  orange button and did the same thing as the "Edit Permissions"
                  next to it. Upstream does not link it either (`auth.js:1975`). */}
              {sections.map((s) => (
                <div
                  key={s.section}
                  id={anchor(s.section)}
                  ref={(el) => {
                    if (el) boxes.current.set(anchor(s.section), el)
                    else boxes.current.delete(anchor(s.section))
                  }}
                >
                  <Panel
                    className={styles.perm}
                    title={s.section}
                    actions={
                      <Button size="sm" onClick={() => setEdit(s.section)}>
                        Edit Permissions
                      </Button>
                    }
                  >
                    <div className={styles.permCols}>
                      <div className={styles.permCol}>
                        <Matrix
                          caption="User Permissions"
                          columns={[
                            { label: 'Username', wide: true },
                            ...VERBS.map((v) => ({ label: v })),
                          ]}
                        >
                          {s.userPermissions.length === 0 ? (
                            <MatrixEmpty text="No user permissions" span={4} />
                          ) : (
                            s.userPermissions.map((p) => (
                              <MatrixRow key={p.username} subject={p.username}>
                                <MatrixCell
                                  name={`${s.section} · ${p.username} · View`}
                                  granted={p.canView}
                                />
                                <MatrixCell
                                  name={`${s.section} · ${p.username} · Modify`}
                                  granted={p.canModify}
                                />
                                <MatrixCell
                                  name={`${s.section} · ${p.username} · Delete`}
                                  granted={p.canDelete}
                                />
                              </MatrixRow>
                            ))
                          )}
                        </Matrix>
                      </div>

                      <div className={styles.permCol}>
                        <Matrix
                          caption="Group Permissions"
                          columns={[
                            { label: 'Group', wide: true },
                            ...VERBS.map((v) => ({ label: v })),
                          ]}
                        >
                          {s.groupPermissions.length === 0 ? (
                            <MatrixEmpty text="No group permissions" span={4} />
                          ) : (
                            s.groupPermissions.map((p) => (
                              <MatrixRow key={p.name} subject={p.name}>
                                <MatrixCell
                                  name={`${s.section} · ${p.name} · View`}
                                  granted={p.canView}
                                />
                                <MatrixCell
                                  name={`${s.section} · ${p.name} · Modify`}
                                  granted={p.canModify}
                                />
                                <MatrixCell
                                  name={`${s.section} · ${p.name} · Delete`}
                                  granted={p.canDelete}
                                />
                              </MatrixRow>
                            ))
                          )}
                        </Matrix>
                      </div>
                    </div>
                  </Panel>
                </div>
              ))}

              <div className={styles.count}>
                <span>{`Total Sections: ${sections.length}`}</span>
              </div>
            </div>

            {sections.length > 0 && (
              <SectionIndex
                sections={sections.map((s) => ({ id: anchor(s.section), label: s.section }))}
                active={here}
              />
            )}
          </div>
        </>
      )}

      {edit != null && (
        <EditPermissions
          section={edit}
          token={token}
          primaryNode={primaryNodeName(cluster)}
          onClose={() => setEdit(null)}
          onSaved={(p) => {
            setSecciones((list) => list.map((x) => (x.section === p.section ? p : x)))
            onNotice({
              type: 'success',
              title: 'Permissions Saved!',
              text: 'Section permissions were saved successfully.',
            })
          }}
        />
      )}
    </>
  )
}


interface Row {
  name: string
  canView: boolean
  canModify: boolean
  canDelete: boolean
}

/** `showEditSectionPermissionsModal` / `saveSectionPermissions`. */
function EditPermissions({
  section,
  token,
  primaryNode,
  onClose,
  onSaved,
}: {
  section: string
  token: string | null
  primaryNode: string
  onClose: () => void
  onSaved: (p: SectionPermission) => void
}) {
  const [loading, setLoading] = useState(true)
  const [users, setUsers] = useState<readonly Row[]>([])
  const [groups, setGroups] = useState<readonly Row[]>([])
  const [userList, setUserList] = useState<string[]>([])
  const [groupList, setGroupList] = useState<string[]>([])
  const [addUser, setAddUser] = useState(BLANK_OPTION)
  const [addGroup, setAddGroup] = useState(BLANK_OPTION)
  const [notice, setNotice] = useState<Notice | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const outcome = await getPermission(token, section)
    setLoading(false)

    if (outcome.kind !== 'ok') {
      setNotice(noticeFromFailure(outcome))
      return
    }
    const d = outcome.data.response
    setUsers(
      d.userPermissions.map((p) => ({
        name: p.username,
        canView: p.canView,
        canModify: p.canModify,
        canDelete: p.canDelete,
      })),
    )
    setGroups(
      d.groupPermissions.map((p) => ({
        name: p.name,
        canView: p.canView,
        canModify: p.canModify,
        canDelete: p.canDelete,
      })),
    )
    setUserList(d.users ?? [])
    setGroupList(d.groups ?? [])
    setAddUser(BLANK_OPTION)
    setAddGroup(BLANK_OPTION)
  }, [token, section])

  useEffect(() => {
    void load()
  }, [load])

  async function save() {
    const serie = (rows: readonly Row[]): Cell[][] =>
      rows.map((f) => [
        { type: 'text', value: f.name },
        { type: 'casilla', value: f.canView },
        { type: 'casilla', value: f.canModify },
        { type: 'casilla', value: f.canDelete },
      ])

    const u = serializeTable(serie(users))
    if (!u.ok) {
      setNotice({ type: 'warning', title: u.failure.title, text: u.failure.text })
      return
    }
    const g = serializeTable(serie(groups))
    if (!g.ok) {
      setNotice({ type: 'warning', title: g.failure.title, text: g.failure.text })
      return
    }

    setBusy(true)
    const outcome = await setPermissions(token, section, u.value, g.value, primaryNode)
    setBusy(false)

    if (outcome.kind !== 'ok') {
      setNotice(noticeFromFailure(outcome))
      return
    }
    onSaved(outcome.data.response)
    onClose()
  }

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={`Edit Permissions - ${section}`}
      /*
      The SAME dialog opened from a zone already went wide, and from here it went
      to 560: two widths for the same thing. It is not that it was cramped —the
      table shrinks and fits in all three sizes, measured— it is that its two
      entrances had to look the same. It goes with the title fix, which had also
      drifted between the two.

      880 and not 720: it is the console's "the one that shows a table" width, and
      this modal shows two of them, each with its own add row. It matches the read
      only list it edits.
      */
      size="wide"
      actions={
        <>
          <Button variant="primary" disabled={busy || loading} onClick={() => void save()}>
            Save
          </Button>
        </>
      }
    >
      <Notifier notice={notice} onClose={() => setNotice(null)} />
      {loading ? (
        <Loading />
      ) : (
        <>
          <PermissionsTable
            section={section}
            title="User Permissions"
            header="Username"
            rows={users}
            onChange={setUsers}
          />
          <MRow label="Add User">
            {(id) => (
              <Select
                id={id}
                className={styles.select}
                value={addUser}
                onChange={(e) => {
                  setAddUser(e.target.value)
                  setUsers((f) => addToTable(f, e.target.value, blankRow))
                }}
              >
                <option value={BLANK_OPTION} />
                <option value={NONE_OPTION}>None</option>
                {userList.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </Select>
            )}
          </MRow>

          <PermissionsTable
            section={section}
            title="Group Permissions"
            header="Group"
            rows={groups}
            onChange={setGroups}
          />
          <MRow label="Add Group">
            {(id) => (
              <Select
                id={id}
                className={styles.select}
                value={addGroup}
                onChange={(e) => {
                  setAddGroup(e.target.value)
                  setGroups((f) => addToTable(f, e.target.value, blankRow))
                }}
              >
                <option value={BLANK_OPTION} />
                <option value={NONE_OPTION}>None</option>
                {groupList.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </Select>
            )}
          </MRow>
        </>
      )}
    </Dialog>
  )
}

const blankRow = (name: string): Row => ({
  name,
  canView: false,
  canModify: false,
  canDelete: false,
})

/* `sortTable('tbodyEditPermissionsUser'|'Group', 0)`. */
const PERMISSION_KEYS: Keys<Row> = { name: (f) => f.name }

function PermissionsTable({
  section,
  title,
  header,
  rows,
  onChange,
}: {
  /* Here the cells ARE controls, so they are amber and they are in the tab
     order. What does not change is their NAME: the same
     `{Section} · {Subject} · {Verb}` the read-only list uses, so the thing you
     tick here is called what it was called there. */
  section: string
  title: string
  header: string
  rows: readonly Row[]
  onChange: (f: readonly Row[]) => void
}) {
  const { rows: visible, sort, toggle } = useSort(PERMISSION_KEYS, rows as Row[])

  // The checkbox writes over the ORIGINAL list: the sorting only changes the
  // order things are drawn in, not the data's.
  function set(row: Row, partial: Partial<Row>) {
    onChange(rows.map((f) => (f.name === row.name ? { ...f, ...partial } : f)))
  }

  return (
    <>
      <p className={styles.sub}>{title}</p>
      {/* The editable one does not carry the data table's panel wrapper: it is
          another piece (`ui/EditableTable.module.css`) and lives INSIDE a panel. */}
      <div>
        <EditableTable
      className={styles.edit}
          header={
            <>
              <Th field="name" sort={sort} onSort={toggle}>{header}</Th>
              <th>View</th>
              <th>Modify</th>
              <th>Delete</th>
              <th className={styles.tdel} />
            </>
          }
        >
          {visible.map((f) => (
            <tr key={f.name}>
              <td className={styles.who}>{f.name}</td>
              <td>
                <input
                  type="checkbox"
                  className={styles.chkPerm}
                  aria-label={`${section} · ${f.name} · View`}
                  checked={f.canView}
                  onChange={(e) => set(f, { canView: e.target.checked })}
                />
              </td>
              <td>
                <input
                  type="checkbox"
                  className={styles.chkPerm}
                  aria-label={`${section} · ${f.name} · Modify`}
                  checked={f.canModify}
                  onChange={(e) => set(f, { canModify: e.target.checked })}
                />
              </td>
              <td>
                <input
                  type="checkbox"
                  className={styles.chkPerm}
                  aria-label={`${section} · ${f.name} · Delete`}
                  checked={f.canDelete}
                  onChange={(e) => set(f, { canDelete: e.target.checked })}
                />
              </td>
              <td className={styles.tdel}>
                <Button onClick={() => onChange(rows.filter((x) => x.name !== f.name))}>Remove</Button>
              </td>
            </tr>
          ))}
        </EditableTable>
        {/* Upstream puts no text when the modal's table is empty; nor does it
            here, so as not to invent a literal that does not exist. */}
      </div>
    </>
  )
}
