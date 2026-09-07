import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Matrix, MatrixCell, MatrixEmpty, MatrixGroup, MatrixMarks, MatrixRow } from './Matrix'
import { ForceBlock } from './Confirm'

/*
What these check is the ONE thing this round had to resolve rather than merely
draw: that a cell of the permissions matrix has a name written in the DOM, and
that the grid is a table with both axes declared.

The negative test matters as much as the positive one: before this primitive the
same 84 cells rendered inside a CSS grid, so `getByRole('table')` found nothing
and every cell's name was whatever the reader synthesised by position.
*/

const COLUMNS = [
  { label: 'Username', wide: true },
  { label: 'View' },
  { label: 'Modify' },
  { label: 'Delete' },
]

describe('Matrix', () => {
  it('is a table, and names it with a literal that already exists', () => {
    render(
      <Matrix caption="User Permissions" columns={COLUMNS}>
        <MatrixRow subject="admin">
          <MatrixCell name="Zones · admin · View" granted />
          <MatrixCell name="Zones · admin · Modify" granted={false} />
          <MatrixCell name="Zones · admin · Delete" granted={false} />
        </MatrixRow>
      </Matrix>,
    )
    expect(screen.getByRole('table', { name: 'User Permissions' })).toBeInTheDocument()
  })

  it('declares both axes: the verbs as columns and the subject as its row', () => {
    render(
      <Matrix caption="User Permissions" columns={COLUMNS}>
        <MatrixRow subject="admin">
          <MatrixCell name="Zones · admin · View" granted />
          <MatrixCell name="Zones · admin · Modify" granted={false} />
          <MatrixCell name="Zones · admin · Delete" granted={false} />
        </MatrixRow>
      </Matrix>,
    )
    for (const verb of ['View', 'Modify', 'Delete']) {
      expect(screen.getByRole('columnheader', { name: verb })).toHaveAttribute('scope', 'col')
    }
    expect(screen.getByRole('rowheader', { name: 'admin' })).toHaveAttribute('scope', 'row')
  })

  it('every cell carries {Section} · {Subject} · {Verb}, and its state', () => {
    render(
      <Matrix caption="User Permissions" columns={COLUMNS}>
        <MatrixRow subject="admin">
          <MatrixCell name="Zones · admin · View" granted />
          <MatrixCell name="Zones · admin · Modify" granted={false} />
          <MatrixCell name="Zones · admin · Delete" granted={false} />
        </MatrixRow>
      </Matrix>,
    )
    expect(screen.getByRole('checkbox', { name: 'Zones · admin · View' })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'Zones · admin · Modify' })).not.toBeChecked()
  })

  it('the cell is read only: it is a state, and it is not editable from here', () => {
    render(
      <Matrix caption="Group Permissions" columns={COLUMNS}>
        <MatrixRow subject="Everyone">
          <MatrixCell name="Cache · Everyone · View" granted />
        </MatrixRow>
      </Matrix>,
    )
    expect(screen.getByRole('checkbox', { name: 'Cache · Everyone · View' })).toBeDisabled()
  })

  it('says which population a run of rows belongs to', () => {
    render(
      <Matrix caption="Permissions" columns={COLUMNS} dense>
        <MatrixGroup label="Group Permissions" span={4} />
        <MatrixRow subject="Administrators" stick>
          <MatrixMarks
            verbs={[
              { verb: 'View', granted: true },
              { verb: 'Modify', granted: true },
              { verb: 'Delete', granted: false },
            ]}
          />
        </MatrixRow>
      </Matrix>,
    )
    expect(screen.getByRole('rowheader', { name: 'Group Permissions' })).toHaveAttribute(
      'scope',
      'rowgroup',
    )
  })

  it('a map cell says the verbs it grants, and says nothing when it grants none', () => {
    render(
      <Matrix caption="Permissions" columns={COLUMNS} dense>
        <MatrixRow subject="ops">
          <MatrixMarks
            verbs={[
              { verb: 'View', granted: true },
              { verb: 'Modify', granted: false },
              { verb: 'Delete', granted: false },
            ]}
          />
          <MatrixMarks
            verbs={[
              { verb: 'View', granted: false },
              { verb: 'Modify', granted: false },
              { verb: 'Delete', granted: false },
            ]}
          />
        </MatrixRow>
      </Matrix>,
    )
    const cells = screen.getAllByRole('cell')
    expect(cells[0]).toHaveTextContent('View')
    expect(cells[1]).toHaveTextContent('')
  })

  it('keeps upstream literal when there is nothing to show', () => {
    render(
      <Matrix caption="User Permissions" columns={COLUMNS}>
        <MatrixEmpty text="No user permissions" span={4} />
      </Matrix>,
    )
    expect(screen.getByText('No user permissions')).toBeInTheDocument()
  })
})

describe('ForceBlock', () => {
  it('carries upstream label and help, and arms only when ticked', () => {
    const help =
      'Enabling this option will cause this Primary node to delete the Cluster for itself even when other Secondary nodes still exist, orphaning them.'
    const { rerender, container } = render(
      <ForceBlock label="Force Delete Cluster" help={help} checked={false} onChange={() => {}} />,
    )
    expect(screen.getByRole('checkbox', { name: 'Force Delete Cluster' })).not.toBeChecked()
    expect(screen.getByText(help)).toBeInTheDocument()
    expect(container.querySelector('[data-armed="true"]')).toBeNull()

    rerender(<ForceBlock label="Force Delete Cluster" help={help} checked onChange={() => {}} />)
    expect(container.querySelector('[data-armed="true"]')).not.toBeNull()
  })
})
