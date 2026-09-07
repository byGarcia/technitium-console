# Zones — the baseline

Captured **2026-09-02** against the `dev` instance, `dist/` built from `main` at
`bb4ef5f`, with six real zones covering Primary, Secondary, Forwarder and Catalog.

| | 1440 | 1024 | 768 | 390 |
|---|---|---|---|---|
| **populated** | ✔ | ✔ | ✔ | ✔ |
| **empty** | ✔ | — | — | ✔ |
| **error** | ✔ | — | — | ✔ |
| **loading** | ✔ | — | — | ✔ |

The three non-populated states are captured at the two ends: they change nothing
between 1024 and 768 that the ends do not already show, and two of them barely
change anything at all — which is the finding, not an economy.

## How each state was reached

- **populated** — the harness's six zones, as they are.
- **empty** — a name filter of `zzzznada*`, which matches nothing.
- **error** — `zones/list` answering `200 {status:'error'}`, which is how this API
  really fails.
- **loading** — the same call delayed by 30 s.

## What the baseline shows: this archetype has no state language

Three findings, and they are one finding seen three times. The Dashboard's
problem was that **error looked like empty**. Here it is worse and it goes the
other way.

- **Loading does not exist.** `busy` disables `Add Zone`, `Delete Zones`, `Go` and
  the row actions, and that is all. The table keeps the previous rows with no
  mark on them. A slow list and a fast one are the same picture, so a reader
  cannot tell that anything is in flight.

- **Error looks like success.** The alert appears at the top — and **the table
  underneath keeps showing six zones as if they were current**. Nothing marks
  them as stale. Someone who scrolls past the banner, or who dismisses it, reads
  a table that the server refused to refresh. On the Dashboard a failure was
  painted as "nothing to report"; here it is painted as "here is your data".

- **Empty is a bare line.** `No Zone Found`, centred in a table cell
  (`ZoneList.tsx:423`), and **it does not use `ui/Empty`** — the primitive the
  phase 1.1 audit rated as the one thing the design project solved well, with its
  dashed box, its sentence explaining why it is empty and the action that fills
  it. Worse, the same line appears whether the filter matched nothing or the
  server genuinely has no zones, and there is no control to clear the filter. The
  way out of an empty screen is not offered anywhere on it.

## And what the layout shows

- **`Name` is half the screen** and the other three filters are crushed into the
  right quarter. The widest control is the one that needs it least.
- **The count line is printed twice**, above and below the table, identically.
- The row actions are three small icons at the far right of a 1440 px row, as far
  from the zone name as the layout allows.
- Below the table, at 1440, more than half the page is empty.

## Reproducing

The captures are taken with the viewport as tall as the document and `fullPage`
off — see [`../dashboard/README.md`](../dashboard/README.md) for why that matters
wherever a canvas is involved. The scripts live in `.playwright-mcp/` and are
throwaway; the contract they were taken alongside is in
[`../../direction/piloto-2-contrato-zones.md`](../../direction/piloto-2-contrato-zones.md).
