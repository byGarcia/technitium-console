import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import * as api from '../../api/zonelists'
import { Lists } from './Lists'
import { primaryNodeName } from '../../ui/ClusterNodeSelect'

afterEach(() => vi.restoreAllMocks())

const NODES = [
  { name: 'node2.cluster.test', type: 'Secondary' },
  { name: 'dev.cluster.test', type: 'Primary' },
]

const RECORD = {
  name: 'ads.test', type: 'A', ttl: 60, ttlString: '1m', disabled: false,
  rData: { ipAddress: '0.0.0.0' }, dnssecStatus: 'Unknown',
  lastUsedOn: '0001-01-01T00:00:00', lastModified: '0001-01-01T00:00:00', expiryTtl: 0, expiryTtlString: '0s',
}

describe('primaryNodeName', () => {
  it('is the Primary node, and empty without a cluster', () => {
    expect(primaryNodeName(NODES, true)).toBe('dev.cluster.test')
    expect(primaryNodeName(NODES, false)).toBe('')
  })
})

describe('Lists embedded', () => {
  it('draws no header and no node selector', async () => {
    vi.spyOn(api, 'listNode').mockResolvedValue({ kind: 'ok', data: { domain: '', zones: [], records: [] } })
    render(<Lists list="blocked" token="T" nodes={NODES} clusterInitialised embedded />)
    await screen.findByText('0 zones')
    expect(screen.queryByRole('heading', { name: 'Blocked' })).toBeNull()
    expect(screen.queryByLabelText('Cluster Node')).toBeNull()
  })

  it('after deleting a node it reads its parent from the primary node', async () => {
    const list = vi.spyOn(api, 'listNode').mockResolvedValue({
      kind: 'ok', data: { domain: 'ads.test', zones: [], records: [RECORD] },
    })
    vi.spyOn(api, 'deleteDomain').mockResolvedValue({ kind: 'ok', data: {} })
    render(<Lists list="blocked" token="T" nodes={NODES} clusterInitialised embedded />)
    await userEvent.click(await screen.findByRole('button', { name: 'Delete' }))
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Delete' }))
    expect(list).toHaveBeenLastCalledWith('blocked', 'T', 'test', 'up', 'dev.cluster.test')
  })

  it('without the Delete permission, Delete is disabled with its padlock', async () => {
    vi.spyOn(api, 'listNode').mockResolvedValue({
      kind: 'ok', data: { domain: 'ads.test', zones: [], records: [RECORD] },
    })
    render(<Lists list="blocked" token="T" embedded canDelete={false} />)
    expect(await screen.findByRole('button', { name: /Delete/ })).toBeDisabled()
  })

  it('its first read comes from the root of the connected node by default', async () => {
    const list = vi.spyOn(api, 'listNode').mockResolvedValue({ kind: 'ok', data: { domain: '', zones: [], records: [] } })
    render(<Lists list="blocked" token="T" nodes={NODES} clusterInitialised embedded />)
    await screen.findByText('0 zones')
    expect(list).toHaveBeenCalledWith('blocked', 'T', '', undefined, '')
  })

  it('with initialFromPrimary its first read comes from the primary node', async () => {
    const list = vi.spyOn(api, 'listNode').mockResolvedValue({ kind: 'ok', data: { domain: '', zones: [], records: [] } })
    render(<Lists list="blocked" token="T" nodes={NODES} clusterInitialised embedded initialFromPrimary />)
    await screen.findByText('0 zones')
    expect(list).toHaveBeenCalledTimes(1)
    expect(list).toHaveBeenCalledWith('blocked', 'T', '', undefined, 'dev.cluster.test')
  })

  /* Under Rules' add bar, two fields both labelled "Domain" read as the same field:
     the tree's shows its own name, visibly and to assistive technology alike. */
  it('the tree field shows the name it is given as its visible label', async () => {
    vi.spyOn(api, 'listNode').mockResolvedValue({ kind: 'ok', data: { domain: '', zones: [], records: [] } })
    render(<Lists list="blocked" token="T" embedded fieldName="Browse domain" />)
    await screen.findByText('0 zones')
    expect(screen.getByRole('textbox', { name: 'Browse domain' })).toBeInTheDocument()
    expect(screen.getByText('Browse domain', { selector: 'label' })).toBeInTheDocument()
    expect(screen.queryByText('Domain', { selector: 'label' })).not.toBeInTheDocument()
  })

  it('without a name the field keeps "Domain", as Cache has it', async () => {
    vi.spyOn(api, 'listNode').mockResolvedValue({ kind: 'ok', data: { domain: '', zones: [], records: [] } })
    render(<Lists list="cache" token="T" />)
    await screen.findByText('0 zones')
    expect(screen.getByText('Domain', { selector: 'label' })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Domain' })).toBeInTheDocument()
  })
})
