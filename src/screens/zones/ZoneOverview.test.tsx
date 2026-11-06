import { describe, expect, it } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ResourceRecord } from '../../api/records'
import { ZoneOverview, type ZoneOverviewProps } from './ZoneOverview'
import type { ZoneHeader } from './zone-view'

const NEVER = '0001-01-01T00:00:00'

function record(type: string, lastUsedOn = NEVER): ResourceRecord {
  return { name: 'casa.test', type, ttl: 3600, ttlString: '1h', disabled: false, rData: {}, lastUsedOn } as unknown as ResourceRecord
}

const HEAD = { dnssec: false } as ZoneHeader

function draw(extra: Partial<ZoneOverviewProps> = {}) {
  const records = [record('A'), record('A', '2026-11-05T10:00:00Z'), record('NS')]
  return render(
    <ZoneOverview
      zone="casa.test"
      info={{ name: 'casa.test', type: 'Primary', disabled: false }}
      records={records}
      head={HEAD}
      hideDnssecRecords={false}
      canModify
      busy={false}
      onSign={() => {}}
      onUnsign={() => {}}
      onViewDs={() => {}}
      onProperties={() => {}}
      onToggleDnssecRecords={() => {}}
      byType={[['A', 2], ['NS', 1]]}
      activeType=""
      onType={() => {}}
      {...extra}
    />,
  )
}

describe('ZoneOverview, the tooltips and the highlight', () => {
  it('a segment of the bar shows the words its chip already writes', async () => {
    const user = userEvent.setup()
    draw()
    const bar = screen.getByRole('img', { name: 'A 2, NS 1' })
    const [a] = Array.from(bar.children)

    await user.hover(a)
    expect(screen.getByRole('tooltip', { hidden: true })).toHaveTextContent('A 2')
    /* The others dim: the bar says one is lit, and which. */
    expect(bar).toHaveAttribute('data-hot')
    expect(a).toHaveAttribute('data-hot')
    expect(bar.children[1]).not.toHaveAttribute('data-hot')
  })

  it('hovering or focusing a chip lights its segment', async () => {
    const user = userEvent.setup()
    draw()
    const bar = screen.getByRole('img', { name: 'A 2, NS 1' })
    const ns = screen.getByRole('button', { name: /^NS\s*1$/ })

    await user.hover(ns)
    expect(bar.children[1]).toHaveAttribute('data-hot')
    expect(ns).toHaveAttribute('data-hot')
    await user.unhover(ns)
    expect(bar).not.toHaveAttribute('data-hot')

    act(() => ns.focus())
    expect(screen.getByRole('img', { name: 'A 2, NS 1' }).children[1]).toHaveAttribute('data-hot')
  })

  it('Not used since restart says why, by description, with the keyboard', () => {
    draw()
    const label = screen.getByText('Not used since restart')
    const fact = label.parentElement!
    expect(fact).not.toHaveAttribute('aria-describedby')

    act(() => fact.focus())
    const bubble = screen.getByRole('tooltip')
    expect(bubble).toHaveTextContent("The server keeps a record's last use in memory only, so a restart clears it.")
    expect(fact).toHaveAttribute('aria-describedby', bubble.id)
    /* The figure is still the figure: two of three records never answered. */
    expect(fact.querySelector('dd')).toHaveTextContent(/^2/)
  })
})
