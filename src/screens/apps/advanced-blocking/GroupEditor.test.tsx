import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { GroupModel, TextList } from './config-model'
import type { Problem } from './validate'
import { GroupEditor } from './GroupEditor'

/*
What is under test is the screen's half of a contract with the validator: a problem
handed in is a problem drawn, at its control, under that control's id. The fixtures
are written by hand, on purpose: the data layer is not this component's business.
*/

function group(over: Partial<GroupModel> = {}): GroupModel {
  return {
    id: 'g1',
    loadedIndex: 0,
    name: 'kids',
    enabled: true,
    txtReport: false,
    nxDomain: false,
    addresses: '0.0.0.0\n::',
    text: { allowed: '', blocked: '', allowedRegex: '', blockedRegex: '' },
    lists: [],
    unknownKeys: [],
    ...over,
  }
}

function problem(field: string, severity: Problem['severity'], message = `${field} is wrong`, target = 'g1'): Problem {
  return { target, field, message, severity, section: 'kids' }
}

function draw(g: GroupModel, over: { clients?: string[]; problems?: Problem[]; showProblems?: boolean } = {}) {
  const props = {
    group: g,
    clients: over.clients ?? [],
    problems: over.problems ?? [],
    showProblems: over.showProblems ?? false,
    onChange: vi.fn(),
    onDelete: vi.fn(),
    onShowClients: vi.fn(),
    onAddList: vi.fn(),
    onChangeList: vi.fn(),
    onRemoveList: vi.fn(),
  }
  return { ...props, ...render(<GroupEditor {...props} />) }
}

const text = (t: Partial<Record<TextList, string>>) => ({ allowed: '', blocked: '', allowedRegex: '', blockedRegex: '', ...t })

describe('the panels', () => {
  it('come in the order of the screen, the group first and under its own name', () => {
    draw(group())
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual([
      'kids',
      'Blocked answer',
      'Domains and patterns',
      'Lists',
    ])
  })

  it('says Unnamed for a group with no name, and keeps the field empty', () => {
    draw(group({ name: '' }))
    expect(screen.getByRole('heading', { name: 'Unnamed' })).toBeInTheDocument()
    expect(screen.getByLabelText('Group Name')).toHaveValue('')
  })
})

describe('the group panel', () => {
  it('edits the name and the switch through patches', async () => {
    const u = userEvent.setup()
    const { onChange } = draw(group({ enabled: true }))
    fireEvent.change(screen.getByLabelText('Group Name'), { target: { value: 'teens' } })
    expect(onChange).toHaveBeenCalledWith({ name: 'teens' })
    await u.click(screen.getByLabelText('Enable Blocking'))
    expect(onChange).toHaveBeenCalledWith({ enabled: false })
  })

  it('only asks the page to delete: Delete group confirms nothing itself', async () => {
    const u = userEvent.setup()
    const { onDelete, onChange } = draw(group(), { clients: ['10.0.0.1'] })
    await u.click(screen.getByRole('button', { name: 'Delete group' }))
    expect(onDelete).toHaveBeenCalledTimes(1)
    expect(onChange).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('shows the clients as chips that lead to the Clients table', async () => {
    const u = userEvent.setup()
    const { onShowClients } = draw(group(), { clients: ['10.0.0.0/24', 'kids.dot.example.net'] })
    await u.click(screen.getByRole('button', { name: 'kids.dot.example.net' }))
    expect(onShowClients).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: '10.0.0.0/24' })).toBeInTheDocument()
    expect(screen.queryByText('No client uses this group yet.')).not.toBeInTheDocument()
  })

  it('says so when no client uses the group', () => {
    draw(group())
    expect(screen.getByText('No client uses this group yet.')).toBeInTheDocument()
  })
})

describe('the blocked answer', () => {
  it('chooses between the two answers with radios that share a name', async () => {
    const u = userEvent.setup()
    const { onChange } = draw(group({ nxDomain: false }))
    const answer = within(screen.getByRole('radiogroup', { name: 'Answer With' }))
    const nx = answer.getByLabelText('NXDOMAIN') as HTMLInputElement
    const addresses = answer.getByLabelText('These addresses') as HTMLInputElement
    expect(addresses).toBeChecked()
    expect(nx.name).toBe(addresses.name)
    expect(nx.name).not.toBe('')
    await u.click(nx)
    expect(onChange).toHaveBeenCalledWith({ nxDomain: true })
  })

  it('names These addresses as the master of Blocking Addresses when NXDOMAIN is chosen', () => {
    draw(group({ nxDomain: true }))
    expect(screen.getByLabelText('Blocking Addresses')).toBeDisabled()
    expect(screen.getByText('Needs These addresses')).toBeInTheDocument()
  })

  it('leaves Blocking Addresses free when the group answers with addresses', () => {
    draw(group({ nxDomain: false }))
    expect(screen.getByLabelText('Blocking Addresses')).toBeEnabled()
    expect(screen.queryByText('Needs These addresses')).not.toBeInTheDocument()
  })

  it('counts the addresses and hands back the raw text', () => {
    const { onChange } = draw(group({ addresses: '0.0.0.0\n::' }))
    expect(screen.getByText('2 addresses')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Blocking Addresses'), { target: { value: ' 1.1.1.1 \n' } })
    expect(onChange).toHaveBeenCalledWith({ addresses: ' 1.1.1.1 \n' })
  })

  it('switches the TXT report', async () => {
    const u = userEvent.setup()
    const { onChange } = draw(group({ txtReport: false }))
    await u.click(screen.getByLabelText('Allow TXT Blocking Report'))
    expect(onChange).toHaveBeenCalledWith({ txtReport: true })
  })
})

describe('domains and patterns', () => {
  it('shows the raw text untrimmed, blank lines included', () => {
    draw(group({ text: text({ allowed: ' a.example\n\nb.example\n' }) }))
    expect(screen.getByLabelText('Allowed domains')).toHaveValue(' a.example\n\nb.example\n')
  })

  it('patches the whole text record, and leaves the other lists as they were', () => {
    const { onChange } = draw(group({ text: text({ allowed: 'a', blocked: 'b' }) }))
    fireEvent.change(screen.getByLabelText('Blocked domains'), { target: { value: 'b\n' } })
    expect(onChange).toHaveBeenCalledWith({ text: text({ allowed: 'a', blocked: 'b\n' }) })
  })

  it('counts lines that hold something, in the singular too', () => {
    draw(group({ text: text({ allowed: 'a\nb\n\nc', blocked: 'one', blockedRegex: '^x$' }) }))
    expect(screen.getByText('3 domains')).toBeInTheDocument()
    expect(screen.getByText('1 domain')).toBeInTheDocument()
    expect(screen.getByText('1 pattern')).toBeInTheDocument()
  })

  it('hides the regex while both are empty, and Add regex patterns shows them', async () => {
    const u = userEvent.setup()
    draw(group())
    expect(screen.queryByLabelText('Allowed regex')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Blocked regex')).not.toBeInTheDocument()
    await u.click(screen.getByRole('button', { name: 'Add regex patterns' }))
    expect(screen.getByLabelText('Allowed regex')).toBeInTheDocument()
    expect(screen.getByLabelText('Blocked regex')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Add regex patterns' })).not.toBeInTheDocument()
  })

  it('shows both regex fields as soon as one holds something', () => {
    draw(group({ text: text({ blockedRegex: '^ads' }) }))
    expect(screen.getByLabelText('Allowed regex')).toBeInTheDocument()
    expect(screen.getByLabelText('Blocked regex')).toHaveValue('^ads')
    expect(screen.queryByRole('button', { name: 'Add regex patterns' })).not.toBeInTheDocument()
  })

  it('does not take away a regex field that is emptied while being typed in', () => {
    const g = group({ text: text({ blockedRegex: 'x' }) })
    const { rerender, ...props } = draw(g)
    fireEvent.change(screen.getByLabelText('Blocked regex'), { target: { value: '' } })
    rerender(
      <GroupEditor
        group={{ ...g, text: text({}) }}
        clients={[]}
        problems={[]}
        showProblems={false}
        onChange={props.onChange}
        onDelete={props.onDelete}
        onShowClients={props.onShowClients}
        onAddList={props.onAddList}
        onChangeList={props.onChangeList}
        onRemoveList={props.onRemoveList}
      />,
    )
    expect(screen.getByLabelText('Blocked regex')).toHaveValue('')
  })
})

describe('the problems of a group', () => {
  const FIELDS: { field: string; label: string; start?: Partial<GroupModel> }[] = [
    { field: 'name', label: 'Group Name' },
    { field: 'addresses', label: 'Blocking Addresses' },
    { field: 'allowed', label: 'Allowed domains' },
    { field: 'blocked', label: 'Blocked domains' },
    { field: 'allowedRegex', label: 'Allowed regex', start: { text: text({ allowedRegex: 'x' }) } },
    { field: 'blockedRegex', label: 'Blocked regex', start: { text: text({ blockedRegex: 'x' }) } },
  ]

  for (const { field, label, start } of FIELDS) {
    it(`draws an error on ${field} under its control, tied to it`, () => {
      draw(group(start), { problems: [problem(field, 'error')], showProblems: true })
      const control = screen.getByLabelText(label)
      expect(control).toHaveAttribute('id', `ab-g1-${field}`)
      expect(control).toHaveAttribute('aria-invalid', 'true')
      expect(control).toHaveAttribute('aria-describedby', `ab-g1-${field}-error`)
      expect(document.getElementById(`ab-g1-${field}-error`)).toHaveTextContent(`${field} is wrong`)
    })

    it(`keeps an error on ${field} back until the first Save`, () => {
      draw(group(start), { problems: [problem(field, 'error')], showProblems: false })
      const control = screen.getByLabelText(label)
      expect(control).not.toHaveAttribute('aria-invalid', 'true')
      expect(control).not.toHaveAttribute('aria-describedby')
      expect(document.getElementById(`ab-g1-${field}-error`)).toBeNull()
    })

    it(`draws a warning on ${field} at once, and does not call the field invalid`, () => {
      draw(group(start), { problems: [problem(field, 'warning')], showProblems: false })
      const control = screen.getByLabelText(label)
      expect(control).not.toHaveAttribute('aria-invalid', 'true')
      expect(control).toHaveAttribute('aria-describedby', `ab-g1-${field}-error`)
      expect(document.getElementById(`ab-g1-${field}-error`)).toHaveTextContent(`${field} is wrong`)
    })
  }

  it('draws every message of one control under it, inside the one element it points to', () => {
    draw(group(), { problems: [problem('name', 'error', 'Needs a name.'), problem('name', 'warning', 'Odd name.')], showProblems: true })
    const box = document.getElementById('ab-g1-name-error') as HTMLElement
    expect(box).toHaveTextContent('Needs a name.')
    expect(box).toHaveTextContent('Odd name.')
    expect(document.querySelectorAll('[id="ab-g1-name-error"]')).toHaveLength(1)
  })

  it('draws a problem on Blocking Addresses even with the field off', () => {
    draw(group({ nxDomain: true }), { problems: [problem('addresses', 'warning', 'Not an address.')] })
    expect(document.getElementById('ab-g1-addresses-error')).toHaveTextContent('Not an address.')
  })

  it('brings the regex fields back when a problem it may draw is on them', () => {
    draw(group(), { problems: [problem('blockedRegex', 'warning', 'Odd pattern.')] })
    expect(document.getElementById('ab-g1-blockedRegex-error')).toHaveTextContent('Odd pattern.')
    expect(screen.getByLabelText('Blocked regex')).toBeInTheDocument()
  })

  it('leaves the regex hidden for an error it may not draw yet', () => {
    draw(group(), { problems: [problem('blockedRegex', 'error')], showProblems: false })
    expect(screen.queryByLabelText('Blocked regex')).not.toBeInTheDocument()
  })

  it('ignores the problems of another group', () => {
    draw(group(), { problems: [problem('name', 'warning', 'Elsewhere.', 'g2')] })
    expect(screen.queryByText('Elsewhere.')).not.toBeInTheDocument()
  })

  it('hands the problems of its list rows to the Lists panel', () => {
    const lists = [{ id: 'l1', kind: 'blockListUrls' as const, url: 'nope', answer: 'group' as const, addresses: '', node: null }]
    draw(group({ lists }), { problems: [problem('url', 'error', 'Not an absolute URL.', 'l1')], showProblems: true })
    expect(document.getElementById('ab-l1-url-error')).toHaveTextContent('Not an absolute URL.')
  })
})

describe('what is kept', () => {
  it('names the properties the editor does not show', () => {
    draw(group({ unknownKeys: ['notes', 'owner'] }))
    expect(screen.getByText('Also in this group, not shown here and kept as it is: notes, owner.')).toBeInTheDocument()
  })

  it('says nothing when there are none', () => {
    draw(group())
    expect(screen.queryByText(/not shown here/)).not.toBeInTheDocument()
  })
})
