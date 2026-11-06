import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { BACKUP_ITEMS, initialBackupSelection } from '../../api/settings'
import { BackupDialog, RestoreDialog } from './dialogs'

/*
Backup and Restore Settings draw their thirteen items as a two-column checklist,
each item's files under its name. The box is still named by upstream's whole
label, in upstream's order, and nothing is added: no "select all".
*/

const base = { open: true, onOpenChange: () => {}, notice: null }

describe('Backup and Restore Settings', () => {
  it('Backup: the thirteen items keep upstream labels and order, the logs unticked', () => {
    render(<BackupDialog {...base} selection={initialBackupSelection()} onSelection={() => {}} onBackup={() => {}} />)
    const dialog = screen.getByRole('dialog', { name: 'Backup Settings' })
    const boxes = within(dialog).getAllByRole('checkbox')
    expect(boxes.map((b) => b.closest('label')?.textContent)).toEqual(BACKUP_ITEMS.map((e) => e.label))
    expect(within(dialog).getByRole('checkbox', { name: 'Log Files (*.log)' })).not.toBeChecked()
    expect(within(dialog).getByRole('checkbox', { name: 'Authentication Config File (auth.config)' })).toBeChecked()
    expect(within(dialog).queryByRole('button', { name: /select/i })).not.toBeInTheDocument()
  })

  it('Restore: ticking an item reports the new selection; the warning closes the dialog', async () => {
    const onSelection = vi.fn()
    render(<RestoreDialog {...base} selection={initialBackupSelection()} onSelection={onSelection} onRestore={() => {}} />)
    await userEvent.click(screen.getByRole('checkbox', { name: 'Log Files (*.log)' }))
    expect(onSelection).toHaveBeenCalledWith(expect.objectContaining({ logs: true }))
    // Its words point at "above selected items", so it stays after them.
    const warning = screen.getByText(/The restore process will overwrite existing config files/)
    const last = screen.getByRole('checkbox', { name: 'Delete Existing Files For Selected Items' })
    expect(last.compareDocumentPosition(warning) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })
})
