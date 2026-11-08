import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ClientsTable } from './ClientsTable'
import type { ClientRow, GroupModel } from './config-model'
import type { Problem } from './validate'

function group(id: string, name: string, over: Partial<GroupModel> = {}): GroupModel {
  return {
    id,
    loadedIndex: 0,
    name,
    enabled: true,
    txtReport: true,
    nxDomain: true,
    addresses: '',
    text: { allowed: '', blocked: '', allowedRegex: '', blockedRegex: '' },
    lists: [],
    unknownKeys: [],
    ...over,
  }
}

function row(id: string, address: string, over: Partial<ClientRow> = {}): ClientRow {
  return { id, map: 'networkGroupMap', address, groupId: 'g1', missingGroup: null, loaded: true, ...over }
}

function problem(target: string, field: string, message: string, severity: Problem['severity'] = 'error'): Problem {
  return { target, field, message, severity, section: 'Clients' }
}

const GROUPS = [group('g1', 'kids'), group('g2', 'family', { enabled: false })]

function draw(over: Partial<Parameters<typeof ClientsTable>[0]> = {}) {
  const props = {
    rows: [row('r1', '192.168.10.0/24')],
    groups: GROUPS,
    problems: [] as Problem[],
    showProblems: false,
    onAdd: vi.fn(),
    onChange: vi.fn(),
    onRemove: vi.fn(),
    onOpenGroup: vi.fn(),
    ...over,
  }
  return { props, ...render(<ClientsTable {...props} />) }
}

describe('ClientsTable', () => {
  it('has the panel, its help sentence and its columns', () => {
    draw()
    expect(screen.getByRole('heading', { name: 'Clients' })).toBeInTheDocument()
    expect(screen.getByText('Server endpoints are checked first, then the most specific client network. A client that matches no row is not blocked.')).toBeInTheDocument()
    for (const name of ['Client or endpoint', 'Group', 'What it gets']) {
      expect(screen.getByRole('columnheader', { name })).toBeInTheDocument()
    }
  })

  it('adds to the map each button names', async () => {
    const { props } = draw()
    await userEvent.click(screen.getByRole('button', { name: 'Add client' }))
    expect(props.onAdd).toHaveBeenLastCalledWith('networkGroupMap')
    await userEvent.click(screen.getByRole('button', { name: 'Add server endpoint' }))
    expect(props.onAdd).toHaveBeenLastCalledWith('localEndPointGroupMap')
  })

  it('draws no table when there are no rows, and can still add one', () => {
    draw({ rows: [] })
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add client' })).toBeInTheDocument()
  })

  it('keeps the order of the rows it is given', () => {
    draw({ rows: [row('r1', '10.0.0.0/8'), row('r2', 'kids.dot.example.net', { map: 'localEndPointGroupMap' }), row('r3', '172.16.0.0/12')] })
    const shown = screen.getAllByRole('textbox').map((i) => (i as HTMLInputElement).value)
    expect(shown).toEqual(['10.0.0.0/8', 'kids.dot.example.net', '172.16.0.0/12'])
  })

  it('tags endpoint rows and no other', () => {
    draw({ rows: [row('r1', '10.0.0.0/8'), row('r2', 'kids.dot.example.net', { map: 'localEndPointGroupMap' })] })
    const lines = screen.getAllByRole('row')
    expect(within(lines[1]).queryByText('Endpoint')).not.toBeInTheDocument()
    expect(within(lines[2]).getByText('Endpoint')).toBeInTheDocument()
  })

  it('reports an edited address by the id of its row', () => {
    const { props } = draw()
    fireEvent.change(screen.getByLabelText('192.168.10.0/24 address'), { target: { value: '192.168.20.0/24' } })
    expect(props.onChange).toHaveBeenCalledWith('r1', { address: '192.168.20.0/24' })
  })

  it('shows the group of the row in its select', () => {
    draw()
    expect(screen.getByLabelText('192.168.10.0/24 group')).toHaveTextContent('kids')
  })

  it('reports the chosen group by id, even when two groups share a name', async () => {
    const { props } = draw({ groups: [group('g1', 'kids'), group('g2', 'same'), group('g3', 'same')] })
    await userEvent.click(screen.getByLabelText('192.168.10.0/24 group'))
    await userEvent.click(screen.getAllByRole('option', { name: 'same' })[1])
    expect(props.onChange).toHaveBeenCalledWith('r1', { groupId: 'g3' })
  })

  it('offers a group with an empty name as Unnamed', () => {
    draw({ groups: [group('g1', '')] })
    expect(screen.getByLabelText('192.168.10.0/24 group')).toHaveTextContent('Unnamed')
  })

  it('keeps showing a reference to a group that does not exist', () => {
    draw({ rows: [row('r1', '10.0.0.0/8', { groupId: null, missingGroup: 'gone' })] })
    expect(screen.getByLabelText('10.0.0.0/8 group')).toHaveTextContent('gone (missing)')
  })

  it('asks a new row to choose a group', () => {
    draw({ rows: [row('r1', '', { groupId: null, loaded: false })] })
    expect(screen.getByLabelText('New row 1 group')).toHaveTextContent('Choose a group')
  })

  it('opens the group from What it gets, and says what the group does', async () => {
    const { props } = draw({ rows: [row('r1', '10.0.0.0/8', { groupId: 'g2' })] })
    const open = screen.getByRole('button', { name: /What 10\.0\.0\.0\/8 gets/ })
    expect(open).toHaveTextContent('Blocking off: everything is answered')
    await userEvent.click(open)
    expect(props.onOpenGroup).toHaveBeenCalledWith('g2')
  })

  it('has nothing to open for a row without a group', () => {
    draw({ rows: [row('r1', '10.0.0.0/8', { groupId: null, missingGroup: 'gone' })] })
    expect(screen.queryByRole('button', { name: /gets/ })).not.toBeInTheDocument()
  })

  it('removes by the id of the row', async () => {
    const { props } = draw()
    await userEvent.click(screen.getByRole('button', { name: 'Remove 192.168.10.0/24' }))
    expect(props.onRemove).toHaveBeenCalledWith('r1')
  })

  it('names two empty rows apart', () => {
    draw({ rows: [row('r1', '', { groupId: null }), row('r2', '', { groupId: null })] })
    for (const n of [1, 2]) {
      expect(screen.getByLabelText(`New row ${n} address`)).toBeInTheDocument()
      expect(screen.getByLabelText(`New row ${n} group`)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: `Remove New row ${n}` })).toBeInTheDocument()
    }
  })

  it('counts a blank address as empty', () => {
    draw({ rows: [row('r1', '   ', { groupId: null })] })
    expect(screen.getByLabelText('New row 1 address')).toBeInTheDocument()
  })

  it('names two rows with the same address apart, and keeps both', () => {
    draw({ rows: [row('r1', '10.0.0.1'), row('r2', '10.0.0.1')] })
    expect(screen.getByLabelText('10.0.0.1 address')).toHaveAttribute('id', 'ab-r1-address')
    expect(screen.getByLabelText('10.0.0.1 (2) address')).toHaveAttribute('id', 'ab-r2-address')
    expect(screen.getByRole('button', { name: 'Remove 10.0.0.1 (2)' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /What 10\.0\.0\.1 \(2\) gets/ })).toBeInTheDocument()
  })

  it('keeps the name it gave unique even against an address that looks like one', () => {
    draw({ rows: [row('r1', 'x'), row('r2', 'x (2)'), row('r3', 'x')] })
    expect(screen.getByLabelText('x address')).toHaveAttribute('id', 'ab-r1-address')
    expect(screen.getByLabelText('x (2) address')).toHaveAttribute('id', 'ab-r2-address')
    expect(screen.getByLabelText('x (3) address')).toHaveAttribute('id', 'ab-r3-address')
  })

  it('keeps the same input while the address changes, so typing does not lose the focus', () => {
    const { props, rerender } = draw()
    const input = screen.getByLabelText('192.168.10.0/24 address')
    input.focus()
    rerender(<ClientsTable {...props} rows={[row('r1', '192.168.10.0/2')]} />)
    expect(screen.getByLabelText('192.168.10.0/2 address')).toBe(input)
    expect(input).toHaveFocus()
  })

  it('gives each control its id, and no message or invalid state with no problems', () => {
    draw()
    const address = screen.getByLabelText('192.168.10.0/24 address')
    const select = screen.getByLabelText('192.168.10.0/24 group')
    expect(address).toHaveAttribute('id', 'ab-r1-address')
    expect(select).toHaveAttribute('id', 'ab-r1-group')
    for (const c of [address, select]) {
      expect(c).not.toHaveAttribute('aria-invalid')
      expect(c).not.toHaveAttribute('aria-describedby')
    }
  })

  it('holds errors back until showProblems', () => {
    draw({ problems: [problem('r1', 'address', 'Not a network.'), problem('r1', 'group', 'Choose a group for this row.')] })
    expect(screen.queryByText('Not a network.')).not.toBeInTheDocument()
    expect(screen.queryByText('Choose a group for this row.')).not.toBeInTheDocument()
    expect(screen.getByLabelText('192.168.10.0/24 address')).not.toHaveAttribute('aria-invalid')
  })

  it('draws an error under its address input and ties them together', () => {
    draw({ showProblems: true, problems: [problem('r1', 'address', 'Not a network.')] })
    const input = screen.getByLabelText('192.168.10.0/24 address')
    const message = document.getElementById('ab-r1-address-error')
    expect(message).toHaveTextContent('Not a network.')
    expect(input.nextElementSibling).toBe(message)
    expect(input).toHaveAttribute('aria-describedby', 'ab-r1-address-error')
    expect(input).toHaveAttribute('aria-invalid', 'true')
  })

  it('draws an error under its group select and ties them together', () => {
    draw({ showProblems: true, problems: [problem('r1', 'group', 'Choose a group for this row.')] })
    const select = screen.getByLabelText('192.168.10.0/24 group')
    const message = document.getElementById('ab-r1-group-error')
    expect(message).toHaveTextContent('Choose a group for this row.')
    expect(select.nextElementSibling).toBe(message)
    expect(select).toHaveAttribute('aria-describedby', 'ab-r1-group-error')
    expect(select).toHaveAttribute('aria-invalid', 'true')
  })

  it('always shows a warning, describing the control without marking it invalid', () => {
    draw({ problems: [problem('r1', 'group', 'This group does not exist.', 'warning')] })
    const select = screen.getByLabelText('192.168.10.0/24 group')
    expect(document.getElementById('ab-r1-group-error')).toHaveTextContent('This group does not exist.')
    expect(select).toHaveAttribute('aria-describedby', 'ab-r1-group-error')
    expect(select).not.toHaveAttribute('aria-invalid')
  })

  it('marks a control invalid when an error shows beside a warning', () => {
    draw({ showProblems: true, problems: [problem('r1', 'address', 'Odd.', 'warning'), problem('r1', 'address', 'Listed twice.')] })
    const message = document.getElementById('ab-r1-address-error')
    expect(message).toHaveTextContent('Odd.')
    expect(message).toHaveTextContent('Listed twice.')
    expect(screen.getByLabelText('192.168.10.0/24 address')).toHaveAttribute('aria-invalid', 'true')
  })

  it('leaves the message of another row or field alone', () => {
    draw({ showProblems: true, problems: [problem('r9', 'address', 'Not here.'), problem('r1', 'ttl', 'Nor here.')] })
    expect(screen.queryByText('Not here.')).not.toBeInTheDocument()
    expect(screen.queryByText('Nor here.')).not.toBeInTheDocument()
  })
})
