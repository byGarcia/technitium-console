import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ClusterNodeSelect, nodeOptions, defaultNode, AGGREGATE } from './ClusterNodeSelect'

const NODES = [
  { name: 'dns1.casa', type: 'Primary' },
  { name: 'dns2.casa', type: 'Secondary' },
]

describe('nodeOptions', () => {
  it('lists each node as name and lowercased type', () => {
    expect(nodeOptions(NODES)).toEqual([
      { value: 'dns1.casa', label: 'dns1.casa (primary)' },
      { value: 'dns2.casa', label: 'dns2.casa (secondary)' },
    ])
  })

  /* Only two of upstream's ten selectors offer the aggregate: Dashboard and
     Settings (cluster.js, updateAllClusterNodeDropDowns). */
  it('offers the aggregate first, and only when asked', () => {
    expect(nodeOptions(NODES, { aggregate: true })[0]).toEqual({ value: AGGREGATE, label: 'Cluster' })
    expect(nodeOptions(NODES).some((o) => o.value === AGGREGATE)).toBe(false)
  })
})

describe('defaultNode', () => {
  it('starts on the aggregate where there is one, and on this server elsewhere', () => {
    expect(defaultNode(true, 'dns1.casa')).toBe(AGGREGATE)
    expect(defaultNode(false, 'dns1.casa')).toBe('dns1.casa')
  })
})

describe('ClusterNodeSelect', () => {
  /* The rule that keeps it invisible on every single-server install, which is
     every install this project has been developed against. */
  it('draws nothing when no cluster is initialised', () => {
    const { container } = render(
      <ClusterNodeSelect nodes={NODES} initialised={false} value="x" onChange={() => {}} />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  /* `ui/Select` is a combobox and keeps its listbox closed, so what is asserted
     here is the control and the node it shows; the option list itself is covered
     by `nodeOptions` above, which is a pure function. */
  it('draws the control and shows the node in use', () => {
    render(<ClusterNodeSelect nodes={NODES} initialised value="dns1.casa" onChange={() => {}} />)
    expect(screen.getByRole('combobox')).toBeInTheDocument()
    expect(screen.getByText('dns1.casa (primary)')).toBeInTheDocument()
  })

  it('shows the aggregate when the screen is one of the two that has it', () => {
    render(
      <ClusterNodeSelect nodes={NODES} initialised aggregate value={AGGREGATE} onChange={() => {}} />,
    )
    expect(screen.getByText('Cluster')).toBeInTheDocument()
  })

  it('is labelled, and the label can be named by the screen', () => {
    const onChange = vi.fn()
    render(
      <ClusterNodeSelect
        nodes={NODES}
        initialised
        value="dns1.casa"
        onChange={onChange}
        label="Cluster Node"
      />,
    )
    expect(screen.getByText('Cluster Node')).toBeInTheDocument()
    expect(onChange).not.toHaveBeenCalled()
  })
})
