import { useEffect, useRef } from 'react'
import {
  Chart as ChartJS,
  LineController, DoughnutController, BarController,
  LineElement, PointElement, ArcElement, BarElement,
  CategoryScale, LinearScale,
  Legend, Tooltip, Filler,
  type ChartData as ChartJsData, type ChartType, type ChartDataset,
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
Everything else it sends —values, labels, series— is passed through untouched.
*/

/** A fill that fades out downwards. Needs the canvas, so it is built at draw time. */
function fade(ctx: CanvasRenderingContext2D, height: number, colour: string): CanvasGradient {
  const g = ctx.createLinearGradient(0, 0, 0, height)
  g.addColorStop(0, `${colour}2e`)
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
      return {
        ...d,
        borderColor: colour,
        backgroundColor: fade(ctx, height, colour),
        borderWidth: 1.75,
        fill: true,
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

export function Chart({
  type,
  data,
  height = 230,
  aria,
  separateLegend = false,
  hidden,
  legendOrder,
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
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  const chart = useRef<ChartJS | null>(null)
  /*
  The palette is read from the tokens, and the tokens change with the theme. A
  change of theme rebuilds the chart so it reads them again, which is what
  upstream's `changeTheme` does by calling `update()` on its four charts
  (main.js:3260-3265).
  */
  const { resolved: theme } = useTheme()

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
            usePointStyle: true,
            boxPadding: 4,
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
    return () => {
      chart.current?.destroy()
      chart.current = null
    }
  }, [type, data, height, separateLegend, legendOrder, theme])

  /*
  Switching off and on, in its own effect — and **what is switched off is not the
  same thing in the two charts**.

  In the line chart each series is a DATASET with its name, so it is switched off
  with `setDatasetVisibility(i)`. In the doughnuts there is **a single dataset**
  and each slice is a POINT of `labels`, so `toggleDataVisibility(i)` is needed,
  which is what Chart.js's stock legend does for a `doughnut`. Treating them alike
  would have switched off the whole chart on pressing one slice.

  It is kept apart from the effect that builds, on purpose: put in there, every
  click would have destroyed and rebuilt the canvas —`data` is in its
  dependencies— and you would see a flicker instead of a line disappearing.

  **And it depends on `data`.** Without that, when new data arrives Chart.js
  rebuilds the chart from scratch, the visibility is lost and the button goes on
  saying `aria-pressed="false"` while the series has come back: the control and the
  thing controlled, disagreeing. A change of theme rebuilds it too, so it depends
  on the theme for the same reason.
  */
  useEffect(() => {
    const c = chart.current
    if (c == null) return
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
    c.update()
  }, [hidden, data, type, theme])

  return (
    <div style={{ height: height }}>
      <canvas ref={ref} role="img" aria-label={aria} />
    </div>
  )
}
