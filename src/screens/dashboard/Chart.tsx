import { useEffect, useRef } from 'react'
import {
  Chart as ChartJS,
  LineController, DoughnutController, BarController,
  LineElement, PointElement, ArcElement, BarElement,
  CategoryScale, LinearScale,
  Legend, Tooltip, Filler,
  type ChartData as ChartJsData, type ChartType, type ChartDataset, type ChartEvent, type TooltipItem,
} from 'chart.js'
import type { ChartData } from '../../api/dashboard'
import { readPalette, type Palette } from './palette'
import { byLegendOrder } from './legend-order'
import { useTheme } from '../../theme/useTheme'

ChartJS.register(LineController, DoughnutController, BarController, LineElement, PointElement, ArcElement, BarElement, CategoryScale, LinearScale, Legend, Tooltip, Filler)

/*
Chart.js is used, not hand-written SVG, for two behavioural reasons:
  · the server returns the data ALREADY in Chart.js format (labels + datasets);
  · clicking a series in the legend hides it, and that is an interaction that
    exists today. With SVG it would be lost.

What this file does beyond drawing is repaint. The server ships its own colours
inside the data and they are this console's business to replace; see `palette.ts`.
Everything else it sends (values, labels, series) is passed through untouched.
*/

/** A fill that fades out downwards. Needs the canvas, so it is built at draw time. */
function fade(ctx: CanvasRenderingContext2D, height: number, colour: string, alpha: string): CanvasGradient {
  const g = ctx.createLinearGradient(0, 0, 0, height)
  g.addColorStop(0, `${colour}${alpha}`)
  g.addColorStop(1, `${colour}00`)
  return g
}

function repaint(
  data: ChartData,
  type: ChartType,
  p: Palette,
  ctx: CanvasRenderingContext2D,
  height: number,
): ChartJsData {
  const datasets = (data.datasets as unknown as ChartDataset[]).map((d, i) => {
    if (type === 'line') {
      const colour = p.forLabel(String(d.label ?? ''), i)
      /*
      Only `Total` is filled. Eleven fills laid over each other in transparency
      added up to one tinted mass under the top line, worst in the light theme, and
      hid the lines they were under. `Total` encloses every other series, so its
      fill alone says "volume" and the others stay lines.
      */
      const filled = d.label === 'Total'
      return {
        ...d,
        borderColor: colour,
        backgroundColor: filled ? fade(ctx, height, colour, p.fade) : colour,
        borderWidth: 1.75,
        fill: filled,
        /*
        No dot on every reading: at sixty points an hour they merge into a dotted
        rule and hide the line they are meant to describe. They come back under
        the cursor, which is when a single reading is what you are asking for.
        */
        pointRadius: 0,
        pointHoverRadius: 4,
        pointHoverBorderWidth: 2,
        pointHoverBorderColor: p.panel,
        pointHoverBackgroundColor: colour,
        /*
        Monotone and not the default cubic: plain smoothing invents peaks between
        two readings, and a query count that never happened is a lie the eye
        believes. Monotone interpolation cannot overshoot the data.
        */
        cubicInterpolationMode: 'monotone' as const,
        tension: 0.4,
      }
    }
    if (type === 'bar') {
      /* Stacked bars: a solid fill per series, the gap between bars is the panel. */
      const colour = p.forLabel(String(d.label ?? ''), i)
      return { ...d, backgroundColor: colour, borderColor: colour, borderWidth: 0, borderRadius: 2, stack: 'all' }
    }
    /* Doughnut: one colour per slice, and the gap is the panel showing through. */
    const labels = (data.labels ?? []) as string[]
    return {
      ...d,
      backgroundColor: labels.map((l, j) => p.forLabel(l, j)),
      borderColor: p.panel,
      borderWidth: 2,
      hoverOffset: 4,
    }
  })
  return { ...data, datasets } as unknown as ChartJsData
}

const figure = (v: unknown) => (Number.isFinite(Number(v)) && v != null ? Number(v).toLocaleString() : '')

/*
A tooltip row with its figure in a column of its own: the label padded to the
longest one shown and the figure to the widest, which in the tooltip's monospace
lines the digits up under each other. It was "Total: 666", one string per series,
each figure ending wherever its label did. Same labels and figures, no new words.
*/
export function tooltipLine(item: TooltipItem<ChartType>): string {
  const c = item.chart
  if ((c.config as { type?: string }).type === 'doughnut') return `${item.label}  ${figure(item.raw)}`
  const shown = c.data.datasets
    .map((d, i) => ({ label: String(d.label ?? ''), value: figure(d.data[item.dataIndex]), visible: c.isDatasetVisible(i) }))
    .filter((r) => r.visible)
  const lw = Math.max(0, ...shown.map((r) => r.label.length))
  const vw = Math.max(0, ...shown.map((r) => r.value.length))
  return `${String(item.dataset.label ?? '').padEnd(lw)}  ${figure(item.raw).padStart(vw)}`
}

/** The series' solid colour: a line's stroke, a bar's or a slice's fill. */
function swatchOf(item: TooltipItem<ChartType>): string {
  const d = item.dataset as { borderColor?: unknown; backgroundColor?: unknown }
  const type = (item.chart.config as { type?: string }).type
  const own = type === 'line' ? d.borderColor : d.backgroundColor
  const colour = Array.isArray(own) ? own[item.dataIndex] : own
  return typeof colour === 'string' ? colour : String(d.borderColor ?? '')
}

export function Chart({
  type,
  data,
  height = 230,
  aria,
  separateLegend = false,
  hidden,
  legendOrder,
  onPick,
  pickable,
}: {
  type: ChartType
  data: ChartData
  height?: number
  aria: string
  /*
  The legend is drawn by the caller, not by Chart.js.

  Only WHO draws it changes. **The interaction is not lost**: `hidden` says which
  series are switched off and the caller moves it, which is exactly what the
  `onClick` Chart.js ships with did. Its own is switched off so there are not two
  legends saying the same thing, one of them inside the canvas and therefore
  unreadable by any tool.
  */
  separateLegend?: boolean
  /** The labels of the switched-off series. Without it, they are all drawn. */
  hidden?: ReadonlySet<string>
  /*
  The order the legend and the tooltip READ the series in, when it is not the order
  they are stacked in (see `legend-order.ts`). Without it, dataset order, as every
  Dashboard chart has it.
  */
  legendOrder?: readonly string[]
  /*
  A click on a point (the line chart) or on a slice (a doughnut), by its index, and
  which ones take a click. This console's own (deviation 7): the Dashboard opens
  Query Logs there. Without it the canvas takes no click, as upstream's.
  */
  onPick?: (index: number) => void
  pickable?: (index: number) => boolean
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  /* Read at click time, so a new function from the caller needs no rebuild. */
  const pick = useRef({ onPick, pickable })
  pick.current = { onPick, pickable }
  const chart = useRef<ChartJS | null>(null)
  /*
  The palette is read from the tokens, and the tokens change with the theme. A
  change of theme rebuilds the chart so it reads them again, which is what
  upstream's `changeTheme` does by calling `update()` on its four charts
  (main.js:3260-3265).
  */
  const { resolved: theme } = useTheme()
  /* The `data` the chart on screen holds, so a new reference with the chart
     already built is swapped in place instead of rebuilding (see below). */
  const holds = useRef<ChartData | null>(null)

  /*
  Built when something that shapes the canvas changes: the type, the height, the
  legend, the theme. NOT when only the data does: the live Last Hour hands a new
  `data` every 2 seconds, and rebuilding destroyed the canvas and replayed the
  entry animation each time. New data goes in through the next effect.
  */
  useEffect(() => {
    if (!ref.current) return
    const ctx = ref.current.getContext('2d')
    if (!ctx) return
    const p = readPalette(getComputedStyle(document.documentElement))

    chart.current = new ChartJS(ref.current, {
      type: type,
      data: repaint(data, type, p, ctx, height),
      options: {
        responsive: true,
        maintainAspectRatio: false,
        /* A thin ring and not a pie: the hole is what stops five slices from
           reading as a single blob of colour. */
        ...(type === 'doughnut' ? { cutout: '70%' } : {}),
        interaction: { intersect: false, mode: 'index' },
        onClick: (event, _elements, c) => {
          const index = pickAt(c, event)
          if (index != null) pick.current.onPick?.(index)
        },
        onHover: (event, _elements, c) => {
          c.canvas.style.cursor = pickAt(c, event) != null ? 'pointer' : ''
        },
        plugins: {
          legend: {
            display: !separateLegend,
            position: type === 'doughnut' ? ('bottom' as const) : ('top' as const),
            labels: {
              ...(legendOrder != null ? { sort: byLegendOrder(legendOrder) } : {}),
              color: p.ink,
              usePointStyle: true,
              pointStyle: 'circle' as const,
              boxWidth: 7,
              boxHeight: 7,
              padding: 14,
              font: { size: 11 },
            },
          },
          tooltip: {
            backgroundColor: p.surface,
            borderColor: p.border,
            borderWidth: 1,
            titleColor: p.ink,
            bodyColor: p.text,
            /* Figures in the console's own monospace: these are measurements and
               they are read against each other, digit under digit. */
            bodyFont: { family: p.mono, size: 11 },
            titleFont: { size: 11, weight: 'normal' as const },
            padding: 10,
            cornerRadius: 6,
            displayColors: true,
            /*
            A solid square, as the HTML legend's swatch, and the series' own colour:
            Chart.js took the swatch from the dataset's fill, which on a line is
            translucent, so in the light theme half of them came out nearly white
            and matched nothing in the legend above.
            */
            usePointStyle: false,
            boxWidth: 8,
            boxHeight: 8,
            boxPadding: 6,
            callbacks: {
              label: tooltipLine,
              labelColor: (item) => {
                const solid = swatchOf(item)
                return { borderColor: solid, backgroundColor: solid, borderWidth: 0, borderRadius: 2 }
              },
            },
            ...(legendOrder != null ? { itemSort: byLegendOrder(legendOrder) } : {}),
          },
        },
        scales:
          type === 'line' || type === 'bar'
            ? {
                x: {
                  stacked: type === 'bar',
                  /* Vertical rules add nothing here: time is read along the axis,
                     not compared column against column. */
                  grid: { display: false },
                  border: { color: p.grid },
                  ticks: { color: p.faint, maxTicksLimit: 8, font: { size: 10, family: p.mono } },
                },
                y: {
                  stacked: type === 'bar',
                  grid: { color: p.grid },
                  border: { display: false },
                  beginAtZero: true,
                  ticks: { color: p.faint, font: { size: 10, family: p.mono }, maxTicksLimit: 6, padding: 8 },
                },
              }
            : undefined,
      },
    })
    holds.current = data
    return () => {
      chart.current?.destroy()
      chart.current = null
      holds.current = null
    }
    // `data` is read for the first drawing only; a later one is swapped in below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, height, separateLegend, legendOrder, theme])

  /*
  New data on a chart that is already drawn: swapped in place and redrawn without
  animation, so a figure that moves does not make the whole chart replay its
  entry. The series switched off stay off: they are applied again before the
  redraw, by the same rule as the effect below.
  */
  useEffect(() => {
    const c = chart.current
    if (c == null || holds.current === data || !ref.current) return
    const ctx = ref.current.getContext('2d')
    if (!ctx) return
    const p = readPalette(getComputedStyle(document.documentElement))
    const next = repaint(data, type, p, ctx, height)
    /* The same series: their figures are copied INTO the datasets the chart already
       has. Chart.js keeps a series' state (switched off from its own in-canvas
       legend, say) on the dataset object, and a new object would drop it. */
    const current = c.data.datasets
    const same =
      current.length === next.datasets.length &&
      next.datasets.every((d, i) => current[i]?.label === d.label)
    if (same) {
      c.data.labels = next.labels
      next.datasets.forEach((d, i) => Object.assign(current[i], d))
    } else {
      c.data = next
    }
    holds.current = data
    if (hidden != null) applyVisibility(c)
    c.update('none')
    // Only new data swaps; the rest rebuilds through the effect above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data])

  /*
  Switching off and on, in its own effect, and **what is switched off is not the
  same thing in the two charts**.

  In the line chart each series is a DATASET with its name, so it is switched off
  with `setDatasetVisibility(i)`. In the doughnuts there is **a single dataset**
  and each slice is a POINT of `labels`, so `toggleDataVisibility(i)` is needed,
  which is what Chart.js's stock legend does for a `doughnut`. Treating them alike
  would have switched off the whole chart on pressing one slice.

  It is kept apart from the effect that builds, on purpose: put in there, every
  click would have destroyed and rebuilt the canvas (`data` is in its
  dependencies), and you would see a flicker instead of a line disappearing.

  **And it runs again after every rebuild** (theme, type, size, legend), and new
  data applies it before its own redraw. Without that the visibility is lost and
  the button goes on saying `aria-pressed="false"` while the series has come back:
  the control and the thing controlled, disagreeing.
  */
  useEffect(() => {
    const c = chart.current
    if (c == null) return
    applyVisibility(c)
    c.update()
    // Runs after every build (theme, type, size, legend) and on every switch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hidden, type, theme, height, separateLegend, legendOrder])

  function applyVisibility(c: ChartJS) {
    const isHidden = (label: unknown) => hidden?.has(String(label)) ?? false

    if (type === 'doughnut') {
      const labels = (c.data.labels ?? []) as unknown[]
      labels.forEach((l, i) => {
        const visible = c.getDataVisibility(i)
        if (visible === isHidden(l)) c.toggleDataVisibility(i)
      })
    } else {
      c.data.datasets.forEach((d, i) => c.setDatasetVisibility(i, !isHidden(d.label)))
    }
  }

  /* Which index a click lands on: the line chart's column under the pointer (its
     tooltip's own rule), a doughnut's slice only when the pointer is on it. */
  function pickAt(c: ChartJS, event: ChartEvent): number | null {
    if (pick.current.onPick == null || event.native == null) return null
    const found = c.getElementsAtEventForMode(
      event.native,
      type === 'doughnut' ? 'nearest' : 'index',
      { intersect: type === 'doughnut' },
      true,
    )
    const index = found[0]?.index
    if (index == null) return null
    return pick.current.pickable == null || pick.current.pickable(index) ? index : null
  }

  return (
    <div style={{ height: height }}>
      <canvas ref={ref} role="img" aria-label={aria} />
    </div>
  )
}
