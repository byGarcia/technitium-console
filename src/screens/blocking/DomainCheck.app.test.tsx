import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { wholeText } from '../../test/whole-text'
import { DomainCheck } from './DomainCheck'

describe('DomainCheck, an Advanced Blocking report', () => {
  it('names the list, its group, and that the app reports only the first match', () => {
    render(
      <DomainCheck
        catalog={[]}
        verdict={{
          kind: 'lists',
          name: 'ads.example',
          domain: 'ads.example',
          lists: [{ url: 'https://lists.test/a.txt?api_token=redacted', domain: 'ads.example', group: 'ads' }],
        }}
      />,
    )
    expect(screen.getByText('Blocked by a block list')).toBeInTheDocument()
    expect(screen.getByText('https://lists.test/a.txt?api_token=redacted')).toBeInTheDocument()
    expect(screen.getByText('Group ads')).toBeInTheDocument()
    expect(screen.getByText('The Advanced Blocking app reports only the first matching list.')).toBeInTheDocument()
  })

  it('an app report with no list URL names the group and the parent entry', () => {
    render(
      <DomainCheck
        catalog={[]}
        verdict={{ kind: 'app', name: 'x.test', domain: 'parent.test', group: 'kids' }}
      />,
    )
    expect(screen.getByText('Blocked by Advanced Blocking')).toBeInTheDocument()
    expect(screen.getByText('kids')).toBeInTheDocument()
    expect(screen.getByText(wholeText('parent.test'))).toBeInTheDocument()
  })

  it('a regex list shows the pattern and not the pattern as a domain', () => {
    render(
      <DomainCheck
        catalog={[]}
        verdict={{
          kind: 'lists',
          name: 'ads.example',
          domain: '^ads\\.',
          lists: [{ url: 'https://lists.test/r.txt', domain: '^ads\\.', group: 'kids', regex: '^ads\\.' }],
        }}
      />,
    )
    expect(screen.getByText('Regex')).toBeInTheDocument()
    expect(screen.getByText('^ads\\.')).toBeInTheDocument()
    expect(screen.queryByText('Listed as')).toBeNull()
  })

  it('a clear verdict says when the TXT report could not be read', () => {
    render(
      <DomainCheck
        catalog={[]}
        verdict={{ kind: 'clear', name: 'example.com', unread: {}, reportUnread: true }}
      />,
    )
    expect(screen.getByText('Not blocked')).toBeInTheDocument()
    expect(screen.getByText('The block list report could not be read.')).toBeInTheDocument()
  })
})
