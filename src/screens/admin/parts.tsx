import type { ClusterState } from '../../api/admin-cluster'
import styles from './Admin.module.css'
import { Select } from '../../ui/Select'
import { DialogField, DialogValue } from '../../ui/DialogForm'
export { Check } from '../../ui/Check'

/* The pieces Administration's six sub-tabs share. */

export type { Notice } from '../../lib/notice'
export { noticeFromFailure } from '../../lib/notice'



/*
`MRow` is a dialog field: its label above its control and its help under it
(`ui/DialogForm`, since 2026-11-06). It was `ui/Form`'s modal row, the label in
a 180 px column at the left, which left Administration's dialogs reading as a
different product from Add Zone. The props are the same, so every dialog that
used it moved with it.
*/
export function MRow(props: Parameters<typeof DialogField>[0]) {
  return <DialogField {...props} />
}

/** Read-only value: the "Type" and "2FA Status" of the details dialog. */
export function MValue({ label, value }: { label: string; value: string }) {
  return <DialogValue label={label}>{value}</DialogValue>
}


/*
`updateClusterNodeDropDown` (cluster.js:1026): the node dropdown ONLY exists if
the cluster is initialised; if not, it hides and its value is the empty string.
Each option is labelled "name (type lowercased)".
*/
export function NodePicker({
  cluster,
  value,
  onChange,
  label,
}: {
  cluster: ClusterState | null
  value: string
  onChange: (v: string) => void
  label: string
}) {
  if (!cluster?.clusterInitialized) return null
  const nodes = cluster.clusterNodes ?? []
  return (
    <Select
      className={styles.node}
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {nodes.map((n) => (
        <option key={n.name} value={n.name}>
          {`${n.name} (${n.type.toLowerCase()})`}
        </option>
      ))}
    </Select>
  )
}


export { LastSeenCell, SessionCell } from '../../ui/SessionCells'
export { Confirm, ForceBlock } from '../../ui/Confirm'
export { Notifier } from '../../ui/Notifier'
export { styles as adminStyles }
