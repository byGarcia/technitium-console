import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import { useSectionInView } from './useSectionInView'

afterEach(() => vi.unstubAllGlobals())

/** An IntersectionObserver the test drives by hand. */
function fakeObserver() {
  const made: { fire: (ids: [string, boolean][]) => void; observed: string[] }[] = []
  class Fake {
    observed: string[] = []
    constructor(cb: IntersectionObserverCallback) {
      const fire = (ids: [string, boolean][]) =>
        cb(
          ids.map(([id, on]) => ({ target: document.getElementById(id)!, isIntersecting: on }) as unknown as IntersectionObserverEntry),
          this as unknown as IntersectionObserver,
        )
      made.push({ observed: this.observed, fire })
    }
    observe(el: Element) { this.observed.push(el.id) }
    disconnect() {}
  }
  vi.stubGlobal('IntersectionObserver', Fake)
  return made
}

function Page({ ids }: { ids: string[] }) {
  const here = useSectionInView(ids)
  return (
    <>
      {ids.map((id) => <div key={id} id={id} />)}
      <output>{here ?? 'none'}</output>
    </>
  )
}

describe('useSectionInView', () => {
  it('observes the sections by id and answers the topmost one on screen', () => {
    const made = fakeObserver()
    render(<Page ids={['a', 'b', 'c']} />)
    expect(made[0].observed).toEqual(['a', 'b', 'c'])
    act(() => made[0].fire([['b', true], ['c', true]]))
    expect(screen.getByRole('status')).toHaveTextContent('b')
    act(() => made[0].fire([['b', false]]))
    expect(screen.getByRole('status')).toHaveTextContent('c')
  })

  it('a section that left the list is nowhere, and a new array of the same ids observes nothing new', () => {
    const made = fakeObserver()
    const { rerender } = render(<Page ids={['a', 'b']} />)
    act(() => made[0].fire([['a', true]]))
    rerender(<Page ids={['a', 'b']} />)
    expect(made).toHaveLength(1)
    rerender(<Page ids={['x', 'y']} />)
    expect(screen.getByRole('status')).toHaveTextContent('none')
  })
})
