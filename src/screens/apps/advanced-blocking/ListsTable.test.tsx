import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import type { ListKind, ListRow } from './config-model'
import type { Problem } from './validate'
import { ListsTable } from './ListsTable'

let next = 0
function row(kind: ListKind, url: string, over: Partial<ListRow> = {}): ListRow {
  next += 1
  return { id: `l${next}`, kind, url, answer: 'group', addresses: '', node: null, ...over }
}

function problem(target: string, field: string, severity: Problem['severity'], message = `${field} is wrong`): Problem {
  return { target, field, message, severity, section: 'kids' }
}

function draw(lists: ListRow[], over: { problems?: Problem[]; showProblems?: boolean } = {}) {
  const props = {
    lists,
    problems: over.problems ?? [],
    showProblems: over.showProblems ?? false,
    onAddList: vi.fn(),
    onChangeList: vi.fn(),
    onRemoveList: vi.fn(),
  }
  return { ...props, ...render(<ListsTable {...props} />) }
}

const URL_A = 'https://example.com/a.txt'
const URL_B = 'https://example.com/b.txt'

describe('the add row', () => {
  it('offers the five kinds, in the words of the screen', async () => {
    const u = userEvent.setup()
    draw([])
    await u.click(screen.getByRole('combobox', { name: 'Kind of list' }))
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual([
      'Block: domain list',
      'Block: regex list',
      'Block and allow: AdBlock list',
      'Allow: domain list',
      'Allow: regex list',
    ])
  })

  it('adds on Enter with the chosen kind, then empties the field and keeps the kind', async () => {
    const u = userEvent.setup()
    const { onAddList } = draw([])
    await u.click(screen.getByRole('combobox', { name: 'Kind of list' }))
    await u.click(screen.getByRole('option', { name: 'Allow: regex list' }))
    await u.type(screen.getByLabelText('List URL'), `${URL_A}{Enter}`)
    expect(onAddList).toHaveBeenCalledTimes(1)
    expect(onAddList).toHaveBeenCalledWith('regexAllowListUrls', URL_A)
    expect(screen.getByLabelText('List URL')).toHaveValue('')
    expect(screen.getByRole('combobox', { name: 'Kind of list' })).toHaveTextContent('Allow: regex list')
  })

  it('adds with the button too, as a block domain list by default', async () => {
    const u = userEvent.setup()
    const { onAddList } = draw([])
    await u.type(screen.getByLabelText('List URL'), URL_B)
    await u.click(screen.getByRole('button', { name: 'Add' }))
    expect(onAddList).toHaveBeenCalledWith('blockListUrls', URL_B)
  })

  it('adds nothing for an empty field, by Enter or by the button', async () => {
    const u = userEvent.setup()
    const { onAddList } = draw([])
    await u.type(screen.getByLabelText('List URL'), '   {Enter}')
    expect(onAddList).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Add' })).toBeDisabled()
  })
})

describe('the rows', () => {
  it('come block domains, regex, AdBlock, then allow domains, regex, each in file order', () => {
    draw([
      row('regexAllowListUrls', 'https://x/allow-regex'),
      row('allowListUrls', 'https://x/allow-2'),
      row('adblockListUrls', 'https://x/adblock'),
      row('regexBlockListUrls', 'https://x/block-regex'),
      row('blockListUrls', 'https://x/block-2'),
      row('blockListUrls', 'https://x/block-1'),
      row('allowListUrls', 'https://x/allow-1'),
    ])
    expect(screen.getAllByRole('button', { name: /^Remove / }).map((b) => b.getAttribute('aria-label'))).toEqual([
      'Remove https://x/block-2',
      'Remove https://x/block-1',
      'Remove https://x/block-regex',
      'Remove https://x/adblock',
      'Remove https://x/allow-2',
      'Remove https://x/allow-1',
      'Remove https://x/allow-regex',
    ])
  })

  it('reads Block or Allow, the kind word and the URL', () => {
    draw([row('adblockListUrls', URL_A), row('regexAllowListUrls', URL_B)])
    expect(screen.getByText('Block')).toBeInTheDocument()
    expect(screen.getByText('AdBlock')).toBeInTheDocument()
    expect(screen.getByText(URL_A)).toBeInTheDocument()
    expect(screen.getByText('Allow')).toBeInTheDocument()
    expect(screen.getByText('Regex')).toBeInTheDocument()
    expect(screen.getByText(URL_B)).toBeInTheDocument()
  })

  it('marks a list with an answer of its own, and only that one', () => {
    draw([row('blockListUrls', URL_A, { answer: 'nx' }), row('blockListUrls', URL_B, { answer: 'addresses' }), row('blockListUrls', 'https://x/c')])
    expect(screen.getAllByText('Own answer')).toHaveLength(2)
  })

  it('removes through the page', async () => {
    const u = userEvent.setup()
    const r = row('blockListUrls', URL_A)
    const { onRemoveList } = draw([r])
    await u.click(screen.getByRole('button', { name: `Remove ${URL_A}` }))
    expect(onRemoveList).toHaveBeenCalledWith(r.id)
  })

  it('says so when the group has no lists', () => {
    draw([])
    expect(screen.getByText('This group has no lists. Its domains and patterns above still apply.')).toBeInTheDocument()
  })

  it('gives two rows with the same URL different names', () => {
    draw([row('blockListUrls', URL_A), row('allowListUrls', URL_A)])
    expect(screen.getByRole('button', { name: `Remove ${URL_A}` })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: `Remove ${URL_A} (2)` })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: `Details for ${URL_A} (2)` })).toBeInTheDocument()
  })

  it('gives a row with no URL a name that says so', () => {
    draw([row('blockListUrls', ''), row('blockListUrls', '')])
    expect(screen.getByRole('button', { name: 'Remove empty URL' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Remove empty URL (2)' })).toBeInTheDocument()
  })
})

describe('Details', () => {
  it('opens and closes, and says which it is', async () => {
    const u = userEvent.setup()
    draw([row('blockListUrls', URL_A)])
    const button = screen.getByRole('button', { name: `Details for ${URL_A}` })
    expect(button).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByLabelText(`URL of ${URL_A}`)).not.toBeInTheDocument()
    await u.click(button)
    expect(button).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByLabelText(`URL of ${URL_A}`)).toHaveValue(URL_A)
    await u.click(button)
    expect(button).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByLabelText(`URL of ${URL_A}`)).not.toBeInTheDocument()
  })

  it('edits the URL through a patch', async () => {
    const u = userEvent.setup()
    const r = row('blockListUrls', URL_A)
    const { onChangeList } = draw([r])
    await u.click(screen.getByRole('button', { name: `Details for ${URL_A}` }))
    fireEvent.change(screen.getByLabelText(`URL of ${URL_A}`), { target: { value: URL_B } })
    expect(onChangeList).toHaveBeenCalledWith(r.id, { url: URL_B })
  })

  for (const kind of ['blockListUrls', 'regexBlockListUrls', 'adblockListUrls'] as const) {
    it(`gives a ${kind} row the answer radios, sharing a name`, async () => {
      const u = userEvent.setup()
      const r = row(kind, URL_A, { answer: 'group' })
      const { onChangeList } = draw([r])
      await u.click(screen.getByRole('button', { name: `Details for ${URL_A}` }))
      const answer = within(screen.getByRole('radiogroup', { name: `Answer for ${URL_A}` }))
      const own = answer.getByLabelText('Use the group\'s answer') as HTMLInputElement
      const nx = answer.getByLabelText('NXDOMAIN') as HTMLInputElement
      const addresses = answer.getByLabelText('These addresses') as HTMLInputElement
      expect(own).toBeChecked()
      expect(nx.name).toBe(own.name)
      expect(addresses.name).toBe(own.name)
      await u.click(nx)
      expect(onChangeList).toHaveBeenCalledWith(r.id, { answer: 'nx' })
    })
  }

  for (const kind of ['allowListUrls', 'regexAllowListUrls'] as const) {
    it(`gives a ${kind} row its URL and nothing else`, async () => {
      const u = userEvent.setup()
      draw([row(kind, URL_A)])
      await u.click(screen.getByRole('button', { name: `Details for ${URL_A}` }))
      expect(screen.getByText('An allow list only has its URL.')).toBeInTheDocument()
      expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument()
      expect(screen.queryByRole('radio')).not.toBeInTheDocument()
    })
  }

  it('asks for the addresses only when the answer is These addresses, raw and counted', async () => {
    const u = userEvent.setup()
    const r = row('blockListUrls', URL_A, { answer: 'addresses', addresses: '10.0.0.1\n ::1\n' })
    const { onChangeList } = draw([r])
    await u.click(screen.getByRole('button', { name: `Details for ${URL_A}` }))
    const field = screen.getByLabelText(`Addresses for ${URL_A}`)
    expect(field).toHaveValue('10.0.0.1\n ::1\n')
    expect(screen.getByText('2 addresses')).toBeInTheDocument()
    fireEvent.change(field, { target: { value: '10.0.0.2\n' } })
    expect(onChangeList).toHaveBeenCalledWith(r.id, { addresses: '10.0.0.2\n' })
  })

  it('has no addresses field while the answer is not These addresses', async () => {
    const u = userEvent.setup()
    draw([row('blockListUrls', URL_A, { answer: 'nx' })])
    await u.click(screen.getByRole('button', { name: `Details for ${URL_A}` }))
    expect(screen.queryByLabelText(`Addresses for ${URL_A}`)).not.toBeInTheDocument()
  })
})

describe('the problems of a row', () => {
  it('opens the row and ties the message to the URL field', () => {
    const r = row('blockListUrls', 'nope')
    draw([r], { problems: [problem(r.id, 'url', 'error', 'Not an absolute URL.')], showProblems: true })
    const field = screen.getByLabelText('URL of nope')
    expect(field).toHaveAttribute('id', `ab-${r.id}-url`)
    expect(field).toHaveAttribute('aria-invalid', 'true')
    expect(field).toHaveAttribute('aria-describedby', `ab-${r.id}-url-error`)
    expect(document.getElementById(`ab-${r.id}-url-error`)).toHaveTextContent('Not an absolute URL.')
    expect(screen.getByRole('button', { name: 'Details for nope' })).toHaveAttribute('aria-expanded', 'true')
  })

  it('keeps an error back, and the row closed, until the first Save', () => {
    const r = row('blockListUrls', 'nope')
    draw([r], { problems: [problem(r.id, 'url', 'error')], showProblems: false })
    expect(screen.queryByLabelText('URL of nope')).not.toBeInTheDocument()
    expect(document.getElementById(`ab-${r.id}-url-error`)).toBeNull()
  })

  it('opens the row for a warning at once, without calling the field invalid', () => {
    const r = row('blockListUrls', 'nope')
    draw([r], { problems: [problem(r.id, 'url', 'warning', 'Odd URL.')], showProblems: false })
    const field = screen.getByLabelText('URL of nope')
    expect(field).not.toHaveAttribute('aria-invalid', 'true')
    expect(field).toHaveAttribute('aria-describedby', `ab-${r.id}-url-error`)
    expect(document.getElementById(`ab-${r.id}-url-error`)).toHaveTextContent('Odd URL.')
  })

  it('draws a problem on the addresses at their field', () => {
    const r = row('blockListUrls', URL_A, { answer: 'addresses', addresses: 'nope' })
    draw([r], { problems: [problem(r.id, 'addresses', 'error', 'Not an IP address.')], showProblems: true })
    const field = screen.getByLabelText(`Addresses for ${URL_A}`)
    expect(field).toHaveAttribute('id', `ab-${r.id}-addresses`)
    expect(field).toHaveAttribute('aria-invalid', 'true')
    expect(field).toHaveAttribute('aria-describedby', `ab-${r.id}-addresses-error`)
    expect(document.getElementById(`ab-${r.id}-addresses-error`)).toHaveTextContent('Not an IP address.')
  })

  for (const [what, make] of [
    ['a block row answering with the group', () => row('blockListUrls', URL_A, { answer: 'group', addresses: 'nope' })],
    ['a block row answering NXDOMAIN', () => row('blockListUrls', URL_A, { answer: 'nx', addresses: 'nope' })],
    ['an allow row', () => row('allowListUrls', URL_A, { addresses: 'nope' })],
  ] as const) {
    it(`draws a problem on the addresses of ${what}, whose field is normally not there`, () => {
      const r = make()
      draw([r], { problems: [problem(r.id, 'addresses', 'warning', 'Not an IP address.')] })
      expect(document.getElementById(`ab-${r.id}-addresses-error`)).toHaveTextContent('Not an IP address.')
      expect(screen.getByLabelText(`Addresses for ${URL_A}`)).toHaveAttribute('aria-describedby', `ab-${r.id}-addresses-error`)
    })
  }

  it('ignores the problems of rows it does not have', () => {
    draw([row('blockListUrls', URL_A)], { problems: [problem('other', 'url', 'warning', 'Elsewhere.')] })
    expect(screen.queryByText('Elsewhere.')).not.toBeInTheDocument()
  })

  it('leaves the row open once the problem being fixed goes away', async () => {
    const r = row('blockListUrls', 'nope')
    function Page() {
      const [url, setUrl] = useState(r.url)
      const problems = url === 'nope' ? [problem(r.id, 'url', 'warning', 'Odd URL.')] : []
      return (
        <ListsTable
          lists={[{ ...r, url }]}
          problems={problems}
          showProblems
          onAddList={() => {}}
          onRemoveList={() => {}}
          onChangeList={(_, patch) => setUrl(patch.url ?? url)}
        />
      )
    }
    render(<Page />)
    fireEvent.change(screen.getByLabelText('URL of nope'), { target: { value: URL_A } })
    expect(screen.getByLabelText(`URL of ${URL_A}`)).toHaveValue(URL_A)
    expect(screen.queryByText('Odd URL.')).not.toBeInTheDocument()
  })
})
