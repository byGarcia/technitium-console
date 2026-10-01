/*
The order a chart's series are READ in, apart from the order they are drawn in.

Chart.js stacks bars in dataset order from the axis up, and its legend and tooltip
follow that same order. Blocking's bars put Blocked first so it sits on the baseline,
and still want the legend to read "Allowed, Blocked" as the drawing writes it: this
is the comparator for `legend.labels.sort` and `tooltip.itemSort`. A legend item
carries its series in `text`; a tooltip item in `dataset.label`. Series the list does
not name keep their own order, after the named ones.
*/
type Item = { text?: string; dataset?: { label?: string } }

export function byLegendOrder(order: readonly string[]): (a: Item, b: Item) => number {
  const rank = (i: Item) => {
    const at = order.indexOf(i.text ?? i.dataset?.label ?? '')
    return at < 0 ? order.length : at
  }
  return (a, b) => rank(a) - rank(b)
}
