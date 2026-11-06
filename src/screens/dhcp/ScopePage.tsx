import type { DhcpLease, DhcpScope, DhcpScopeRow } from '../../api/dhcp'
import { Button } from '../../ui/Button'
import { SectionHeader } from '../../ui/SectionHeader'
import { Tag } from '../../ui/Tag'
import type { ScopeError, ScopeForm as Form } from './model'
import { ScopeForm } from './ScopeForm'
import { ScopeOverview } from './ScopeOverview'
import styles from './Dhcp.module.css'

/*
A SCOPE'S PAGE (deviation 19, 2026-11-06), laid out as a zone's: the header is the
scope, then what it holds, then its form.

  · The header: `Scopes ›` back to the list, the scope's name as the title, its
    state and interface beside it, and the row's verbs at the right, `Disable
    Scope` (or `Enable Scope`) and `Delete Scope`, with the same confirmations and
    calls as the list's.
  · Four cards (`ScopeOverview.tsx`).
  · The form, under upstream's own title, "Edit Scope" (`ScopeForm.tsx`).

Adding a scope is the same page with "Add Scope" as its title and no cards: there
is nothing on the server to describe yet.
*/

export function ScopePage({
  mode,
  row,
  scope,
  leases,
  initial,
  busy,
  canModify,
  canDelete,
  onBack,
  onSave,
  onCancel,
  onNotice,
  onToggle,
  onDelete,
  onOpenLeases,
}: {
  mode: 'add' | 'edit'
  /** The scope's row of `scopes/list`: its state, interface, network, broadcast. */
  row?: DhcpScopeRow
  /** The `scopes/get` that filled the form. */
  scope?: DhcpScope
  leases: DhcpLease[] | null
  initial: Form
  busy: boolean
  canModify: boolean
  canDelete: boolean
  onBack: () => void
  onSave: (body: Record<string, string>) => void
  onCancel: () => void
  onNotice: (e: ScopeError) => void
  onToggle: () => void
  onDelete: () => void
  onOpenLeases: () => void
}) {
  const editing = mode === 'edit' && scope != null
  return (
    <>
      <SectionHeader
        section="Scopes"
        onBack={onBack}
        title={editing ? scope.name : 'Add Scope'}
        labels={
          editing && row != null ? (
            <>
              <Tag tone={row.enabled ? 'ok' : 'neutral'}>{row.enabled ? 'Enabled' : 'Disabled'}</Tag>
              {row.interfaceAddress != null && (
                <span className={styles.fact}>
                  Interface <b>{row.interfaceAddress}</b>
                </span>
              )}
            </>
          ) : undefined
        }
        actions={
          editing && row != null && (canModify || canDelete) ? (
            <>
              {canModify && (
                <Button lead="power" disabled={busy} onClick={onToggle}>
                  {row.enabled ? 'Disable Scope' : 'Enable Scope'}
                </Button>
              )}
              {canDelete && (
                <Button lead="trash" variant="danger" disabled={busy} onClick={onDelete}>
                  Delete Scope
                </Button>
              )}
            </>
          ) : undefined
        }
      />

      {editing && <ScopeOverview row={row} scope={scope} leases={leases} onOpenLeases={onOpenLeases} />}

      <ScopeForm
        heading={editing ? 'Edit Scope' : undefined}
        initial={initial}
        busy={busy}
        onSave={onSave}
        onCancel={onCancel}
        onNotice={onNotice}
      />
    </>
  )
}
