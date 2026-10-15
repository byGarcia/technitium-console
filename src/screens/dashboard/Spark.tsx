import styles from './Spark.module.css'

/*
A figure's trend, beside it: the series the main Queries chart already loads, drawn
small. Decorative, so hidden from assistive technology: the figure says the number.

It is the drawing Blocking › Overview's trend already makes (`Overview.tsx`, which
still carries its own copy and should import this one: one object, one drawing). The
caller gives it its place (`className`) and its colour, the series colour, through
`colour`.

A reading that is not a number (the live Last Hour leaves Clients as a gap in the
minutes the server has not counted, `live.ts`) breaks the line instead of dropping
it to zero: a zero there would be a figure nobody measured.

A series that never comes down near its floor is drawn as a line, with no area
under it. Measured from zero, a figure that barely moves (Clients: 9, 10, 11 in
every minute) fills almost the whole box, and the light theme drew that as a solid
beige block that read as a bar and hid the line. Below half its own peak the area
still has a shape to show, so it keeps it.
*/
function flat(values: number[]): boolean {
  const finite = values.filter((v) => Number.isFinite(v))
  if (finite.length === 0) return true
  return Math.min(...finite) > Math.max(...finite) / 2
}

export function Spark({ data, className, colour }: { data: number[]; className?: string; colour?: string }) {
  if (data.length < 2) return null
  const finite = data.filter((v) => Number.isFinite(v))
  if (finite.length === 0) return null
  const max = Math.max(...finite, 1)
  const area = !flat(finite)
  const step = 100 / (data.length - 1)
  const runs: string[][] = []
  let run: string[] = []
  data.forEach((v, i) => {
    if (!Number.isFinite(v)) {
      if (run.length > 0) runs.push(run)
      run = []
      return
    }
    run.push(`${(i * step).toFixed(2)},${(30 - (v / max) * 28).toFixed(2)}`)
  })
  if (run.length > 0) runs.push(run)
  return (
    <svg
      className={`${styles.spark}${className != null ? ` ${className}` : ''}`}
      style={colour != null ? { color: colour } : undefined}
      viewBox="0 0 100 32"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      {runs.map((points, i) => {
        const first = points[0].split(',')[0]
        const last = points[points.length - 1].split(',')[0]
        return (
          <g key={i}>
            {area && <polyline points={`${first},32 ${points.join(' ')} ${last},32`} fill="currentColor" fillOpacity="0.18" stroke="none" />}
            <polyline points={points.join(' ')} fill="none" stroke="currentColor" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
          </g>
        )
      })}
    </svg>
  )
}
