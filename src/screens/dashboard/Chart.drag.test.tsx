import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { Chart } from './Chart'

/*
Deviation 41: dragging across a line chart chooses a window. Chart.js is replaced by
a stub with the one scale the gesture reads (60 slots, 10 px apart, the first point
at x 45) and the click handler the chart is built with: jsdom has no canvas. The
pointer events are MouseEvents of the pointer types, which carry `clientX` and
`button` where jsdom has no PointerEvent.
*/
const built = vi.hoisted(() => [] as { options: { onClick: (e: unknown, el: unknown, c: unknown) => void; plugins: { tooltip: { enabled?: boolean } } } }[])

vi.mock('chart.js', () => {
  class Chart {
    static register() {}
    data: { labels: unknown[]; datasets: unknown[] }
    options: unknown
    chartArea = { left: 40, right: 640, top: 10, bottom: 210 }
    scales = {
      x: {
        getValueForPixel: (x: number) => Math.round((x - 45) / 10),
        getPixelForValue: (i: number) => 45 + i * 10,
      },
    }
    canvas = { style: {} }
    constructor(_canvas: unknown, config: { data: Chart['data']; options: Chart['options'] }) {
      this.data = config.data
      this.options = config.options
      built.push(this as never)
    }
    destroy() {}
    update() {}
    setDatasetVisibility() {}
    getDataVisibility() {
      return true
    }
    toggleDataVisibility() {}
    /* A click lands on the column under it, as the `index` mode does. */
    getElementsAtEventForMode(e: { clientX: number }) {
      return [{ index: Math.round((e.clientX - 45) / 10) }]
    }
  }
  const part = {}
  return {
    Chart,
    LineController: part, DoughnutController: part, BarController: part,
    LineElement: part, PointElement: part, ArcElement: part, BarElement: part,
    CategoryScale: part, LinearScale: part,
    Legend: part, Tooltip: part, Filler: part,
  }
})

afterEach(() => {
  vi.restoreAllMocks()
  built.length = 0
})

const DATA = { labels: Array.from({ length: 60 }, (_, i) => String(i)), datasets: [{ label: 'Total', data: Array(60).fill(1) }] }

function draw({ drags = true }: { drags?: boolean } = {}) {
  const onPick = vi.fn()
  const onPickRange = drags ? vi.fn() : undefined
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    createLinearGradient: () => ({ addColorStop() {} }),
  } as never)
  vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0 } as DOMRect)
  render(<Chart type="line" data={DATA} aria="Queries over time" onPick={onPick} onPickRange={onPickRange} />)
  const wrap = screen.getByRole('img').parentElement as HTMLElement
  return { wrap, onPick, onPickRange }
}

/* `buttons` is what the browser reports: the primary held during a press and its moves,
   none on the release and on a hover. */
const pointer = (el: HTMLElement, type: string, clientX: number, buttons = type === 'pointerup' ? 0 : 1) =>
  fireEvent(el, new MouseEvent(type, { bubbles: true, clientX, button: 0, buttons }))

/* What the browser fires after a release on the canvas: the click Chart.js handles. */
const click = (clientX: number) =>
  built[0].options.onClick({ native: { clientX } }, [], built[0])

describe('Chart: choosing a window by dragging', () => {
  it('a drag hands its first and last bucket, in order, and draws the selection while it moves', () => {
    const { wrap, onPick, onPickRange } = draw()
    pointer(wrap, 'pointerdown', 185)
    pointer(wrap, 'pointermove', 160)
    pointer(wrap, 'pointermove', 145)
    const box = screen.getByTestId('chart-selection')
    expect(box.style.left).toBe('140px')
    expect(box.style.width).toBe('50px')
    // The tooltip stands down while the window is drawn, and comes back after.
    expect(built[0].options.plugins.tooltip.enabled).toBe(false)
    pointer(wrap, 'pointerup', 145)
    expect(built[0].options.plugins.tooltip.enabled).toBe(true)
    act(() => click(145))
    expect(onPickRange).toHaveBeenCalledWith(10, 14)
    expect(onPick).not.toHaveBeenCalled()
    expect(screen.queryByTestId('chart-selection')).not.toBeInTheDocument()
  })

  it('a press released outside the chart is over: hovering back draws nothing and keeps the tooltip', () => {
    const { wrap, onPickRange } = draw()
    pointer(wrap, 'pointerdown', 145)
    // The release happened outside the chart; the next move carries no button.
    pointer(wrap, 'pointermove', 245, 0)
    expect(screen.queryByTestId('chart-selection')).not.toBeInTheDocument()
    expect(built[0].options.plugins.tooltip.enabled).not.toBe(false)
    pointer(wrap, 'pointerup', 245)
    expect(onPickRange).not.toHaveBeenCalled()
  })

  it('the click Chart.js handles a frame after the release is still the drag\'s', async () => {
    const { wrap, onPick, onPickRange } = draw()
    pointer(wrap, 'pointerdown', 185)
    pointer(wrap, 'pointermove', 145)
    pointer(wrap, 'pointerup', 145)
    await new Promise((r) => window.requestAnimationFrame(() => r(null)))
    act(() => click(145))
    expect(onPickRange).toHaveBeenCalledWith(10, 14)
    expect(onPick).not.toHaveBeenCalled()
  })

  it('a press that does not travel is a click: it opens one bucket', () => {
    const { wrap, onPick, onPickRange } = draw()
    pointer(wrap, 'pointerdown', 145)
    pointer(wrap, 'pointermove', 148)
    pointer(wrap, 'pointerup', 148)
    act(() => click(148))
    expect(onPick).toHaveBeenCalledWith(10)
    expect(onPickRange).not.toHaveBeenCalled()
  })

  it('a cancelled drag (the page took the touch) chooses nothing', () => {
    const { wrap, onPickRange } = draw()
    pointer(wrap, 'pointerdown', 145)
    pointer(wrap, 'pointermove', 245)
    expect(screen.getByTestId('chart-selection')).toBeInTheDocument()
    fireEvent(wrap, new MouseEvent('pointercancel', { bubbles: true }))
    expect(screen.queryByTestId('chart-selection')).not.toBeInTheDocument()
    pointer(wrap, 'pointerup', 245)
    expect(onPickRange).not.toHaveBeenCalled()
  })

  it('without a window to open the chart takes no drag, and lets the page have the touch', () => {
    const { wrap, onPick } = draw({ drags: false })
    expect(wrap).not.toHaveAttribute('data-drag')
    pointer(wrap, 'pointerdown', 145)
    pointer(wrap, 'pointermove', 245)
    expect(screen.queryByTestId('chart-selection')).not.toBeInTheDocument()
    pointer(wrap, 'pointerup', 245)
    act(() => click(245))
    expect(onPick).toHaveBeenCalledWith(20)
  })
})
