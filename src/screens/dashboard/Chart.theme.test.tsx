import { afterEach, describe, expect, it, vi } from 'vitest'
import { render } from '@testing-library/react'
import { Chart } from './Chart'
import { ThemeProvider } from '../../theme/ThemeProvider'
import { mockSystemTheme, resetTheme } from '../../test/system-theme'

/*
The palette is read when the chart is built, from the tokens on `<html>`, and the
tokens change with `data-theme`. What has to hold is that a change of theme reads
it AGAIN, and only after the attribute already says the new theme.

Chart.js is replaced by a stub that records each build: jsdom has no canvas to
draw on, and what is under test is when the palette is read, not the drawing.
*/
const built = vi.hoisted(() => [] as unknown[])
const readAt = vi.hoisted(() => [] as (string | undefined)[])
const hiddenOn = vi.hoisted(() => [] as { build: number; index: number }[])

vi.mock('chart.js', () => {
  class Chart {
    static register() {}
    data: unknown
    constructor(_canvas: unknown, config: { data: unknown }) {
      this.data = config.data
      built.push(config)
    }
    destroy() {}
    update() {}
    setDatasetVisibility(index: number, visible: boolean) {
      if (!visible) hiddenOn.push({ build: built.length, index })
    }
    getDataVisibility() {
      return true
    }
    toggleDataVisibility() {}
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

vi.mock('./palette', async (importOriginal) => {
  const original = await importOriginal<typeof import('./palette')>()
  return {
    ...original,
    readPalette: (css: CSSStyleDeclaration) => {
      readAt.push(document.documentElement.dataset.theme)
      return original.readPalette(css)
    },
  }
})

afterEach(() => {
  vi.restoreAllMocks()
  resetTheme()
  built.length = 0
  readAt.length = 0
  hiddenOn.length = 0
})

const DATA = { labels: ['a', 'b'], datasets: [{ label: 'Total', data: [1, 2] }] }

describe('Chart and the theme', () => {
  it('reads the palette again, in the new theme, when the theme changes', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      createLinearGradient: () => ({ addColorStop() {} }),
    } as never)
    const system = mockSystemTheme(false)
    render(
      <ThemeProvider>
        <Chart type="line" data={DATA} aria="Queries" />
      </ThemeProvider>,
    )
    expect(readAt).toEqual(['light'])

    system.change(true)
    expect(readAt).toEqual(['light', 'dark'])
    expect(built).toHaveLength(2)
  })

  it('does not rebuild while the theme stays the same', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      createLinearGradient: () => ({ addColorStop() {} }),
    } as never)
    localStorage.setItem('theme', 'dark')
    const system = mockSystemTheme(false)
    render(
      <ThemeProvider>
        <Chart type="line" data={DATA} aria="Queries" />
      </ThemeProvider>,
    )
    system.change(true)
    expect(readAt).toEqual(['dark'])
    expect(built).toHaveLength(1)
  })

  it('keeps a switched-off series off across the rebuild', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      createLinearGradient: () => ({ addColorStop() {} }),
    } as never)
    const system = mockSystemTheme(false)
    render(
      <ThemeProvider>
        <Chart type="line" data={DATA} aria="Queries" hidden={new Set(['Total'])} />
      </ThemeProvider>,
    )
    system.change(true)
    expect(hiddenOn).toContainEqual({ build: 2, index: 0 })
  })
})
