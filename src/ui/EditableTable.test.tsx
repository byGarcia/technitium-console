import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { EditableTable } from './EditableTable'

/*
A column whose every cell holds one checkbox is a column of checkboxes: the table
marks it (`data-check`), header included, so it is drawn narrow and centred with the
checkbox at its own size, and not as a bar across the column (Edit Permissions).
*/
describe('EditableTable', () => {
  function draw(rows: { name: string; view: boolean }[]) {
    return render(
      <EditableTable header={<><th>Group</th><th>View</th><th /></>}>
        {rows.map((r) => (
          <tr key={r.name}>
            <td>{r.name}</td>
            <td><input type="checkbox" aria-label={`${r.name} View`} defaultChecked={r.view} /></td>
            <td><button type="button">Remove</button></td>
          </tr>
        ))}
      </EditableTable>,
    )
  }

  it('marks a column of checkboxes, header and cells, and nothing else', () => {
    draw([{ name: 'Everyone', view: true }, { name: 'Administrators', view: false }])
    expect(screen.getByRole('columnheader', { name: 'View' })).toHaveAttribute('data-check')
    expect(screen.getByRole('checkbox', { name: 'Everyone View' }).closest('td')).toHaveAttribute('data-check')
    expect(screen.getByRole('columnheader', { name: 'Group' })).not.toHaveAttribute('data-check')
    expect(screen.getByText('Everyone').closest('td')).not.toHaveAttribute('data-check')
    expect(screen.getAllByRole('button', { name: 'Remove' })[0].closest('td')).not.toHaveAttribute('data-check')
  })

  it('with no rows it marks nothing: there is nothing to tell the column by', () => {
    draw([])
    expect(screen.getByRole('columnheader', { name: 'View' })).not.toHaveAttribute('data-check')
  })

  it('a column with text beside the checkbox is not one', () => {
    render(
      <EditableTable header={<th>Enabled</th>}>
        <tr><td><label><input type="checkbox" /> Enabled</label></td></tr>
      </EditableTable>,
    )
    expect(screen.getByRole('columnheader', { name: 'Enabled' })).not.toHaveAttribute('data-check')
  })
})
