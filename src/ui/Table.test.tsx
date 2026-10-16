import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { useState } from 'react'
import { Table as DataTable, Th, useSort, type Keys } from './Table'

/*
Upstream's rule (`sortTable`, common.js:228-280) is not a toggle: a click sorts
ascending UNLESS the column is already ascending, in which case it goes down. The
difference shows precisely on the first click.
*/

interface Row {
  name: string
}

const KEYS: Keys<Row> = { name: (f) => f.name }

function Table({ data }: { data: Row[] }) {
  const { rows, sort, toggle } = useSort(KEYS, data)
  return (
    <table>
      <thead>
        <tr>
          <Th field="name" sort={sort} onSort={toggle}>
            Name
          </Th>
        </tr>
      </thead>
      <tbody>
        {rows.map((f) => (
          <tr key={f.name}>
            <td>{f.name}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function texts() {
  return screen.getAllByRole('cell').map((c) => c.textContent)
}

describe('table sorting', () => {
  it('unsorted: the first click sorts ascending', async () => {
    render(<Table data={[{ name: 'c' }, { name: 'a' }, { name: 'b' }]} />)
    await userEvent.click(screen.getByRole('button', { name: /Name/ }))
    expect(texts()).toEqual(['a', 'b', 'c'])
  })

  it('already ascending: the first click turns it around, like upstream', async () => {
    render(<Table data={[{ name: 'a' }, { name: 'b' }, { name: 'c' }]} />)
    await userEvent.click(screen.getByRole('button', { name: /Name/ }))
    expect(texts()).toEqual(['c', 'b', 'a'])
  })

  it('clicking twice goes back up, and announces it with aria-sort', async () => {
    render(<Table data={[{ name: 'c' }, { name: 'a' }]} />)
    const th = screen.getByRole('columnheader')
    const button = screen.getByRole('button', { name: /Name/ })

    expect(th).toHaveAttribute('aria-sort', 'none')
    await userEvent.click(button)
    expect(th).toHaveAttribute('aria-sort', 'ascending')
    await userEvent.click(button)
    expect(th).toHaveAttribute('aria-sort', 'descending')
  })

  it('it sorts by the text you see, case-insensitively', async () => {
    render(<Table data={[{ name: 'Zeta' }, { name: 'alpha' }]} />)
    await userEvent.click(screen.getByRole('button', { name: /Name/ }))
    expect(texts()).toEqual(['alpha', 'Zeta'])
  })
})

/*
The stacking table. jsdom does not lay out, so what is checked is the DOM the
stylesheet reads: each body cell carries its column's header text, a column with
a blank header carries none, and every part of the table keeps its role.
*/
describe('a stacking table', () => {
  function Users({ rows }: { rows: { name: string; type: string }[] }) {
    const { rows: sorted, sort, toggle } = useSort<{ name: string; type: string }>(
      { name: (r) => r.name },
      rows,
    )
    return (
      <DataTable
        stack
        header={
          <>
            <Th field="name" sort={sort} onSort={toggle}>Username</Th>
            <th>Type</th>
            <Th field="type" sort={sort} onSort={toggle} name="Kind" />
            <th />
          </>
        }
        isEmpty={rows.length === 0}
        emptyText="No User Found"
        columns={4}
      >
        {sorted.map((r) => (
          <tr key={r.name}>
            <td>{r.name}</td>
            <td>{r.type}</td>
            <td>icon</td>
            <td>actions</td>
          </tr>
        ))}
      </DataTable>
    )
  }

  it('labels each body cell with the text of its column header', () => {
    render(<Users rows={[{ name: 'admin', type: 'Local' }]} />)
    const cells = screen.getAllByRole('cell')
    expect(cells.map((c) => c.getAttribute('data-label'))).toEqual(['Username', 'Type', 'Kind', null])
  })

  it('keeps the table, its rows, cells and headers in their roles', () => {
    render(<Users rows={[{ name: 'admin', type: 'Local' }]} />)
    expect(screen.getByRole('table')).toBeInTheDocument()
    expect(screen.getAllByRole('row')).toHaveLength(2)
    expect(screen.getAllByRole('columnheader')).toHaveLength(4)
    expect(screen.getByRole('cell', { name: 'admin' })).toBeInTheDocument()
  })

  it('labels the rows a sort brings, and none on the row that spans every column', async () => {
    function Swap() {
      const [rows, setRows] = useState([{ name: 'b', type: 'Local' }])
      return (
        <>
          <button type="button" onClick={() => setRows([{ name: 'a', type: 'Remote' }, ...rows])}>add</button>
          <button type="button" onClick={() => setRows([])}>clear</button>
          <Users rows={rows} />
        </>
      )
    }
    render(<Swap />)
    await userEvent.click(screen.getByRole('button', { name: 'add' }))
    // Already ascending, so the click turns it around (upstream's rule, above).
    await userEvent.click(screen.getByRole('button', { name: /Username/ }))
    expect(screen.getAllByRole('cell').filter((c) => c.getAttribute('data-label') === 'Username').map((c) => c.textContent))
      .toEqual(['b', 'a'])
    await userEvent.click(screen.getByRole('button', { name: 'clear' }))
    const empty = screen.getByRole('cell', { name: 'No User Found' })
    expect(empty).not.toHaveAttribute('data-label')
  })

  it('marks a blank cell, and not a placeholder, an icon or a control', () => {
    render(
      <DataTable
        stack
        header={
          <>
            <th>Expiry</th>
            <th>Serial</th>
            <th>Answer</th>
            <th>Placeholder</th>
            <th>Icon</th>
            <th>Pick</th>
            <th>Name</th>
          </>
        }
      >
        <tr>
          <td></td>
          <td>{' '}</td>
          <td>
            <span className="clip" />
          </td>
          <td>—</td>
          <td>
            <svg aria-label="Reserved" />
          </td>
          <td>
            <input type="checkbox" aria-label="Select" />
          </td>
          <td>example.net</td>
        </tr>
      </DataTable>,
    )
    const blank = screen.getAllByRole('cell').map((c) => c.hasAttribute('data-empty'))
    expect(blank).toEqual([true, true, true, false, false, false, false])
    // Still in the row: the cells after a blank one keep their columns.
    expect(screen.getAllByRole('cell')).toHaveLength(7)
  })

  it('touches nothing on a table that does not stack', () => {
    render(
      <DataTable header={<th>Name</th>}>
        <tr>
          <td>admin</td>
        </tr>
      </DataTable>,
    )
    expect(screen.getByRole('cell')).not.toHaveAttribute('data-label')
    expect(screen.getByRole('cell')).not.toHaveAttribute('data-empty')
    expect(screen.getByRole('cell')).not.toHaveAttribute('role')
  })
})
