# Dashboard — the baseline

Captured **2026-09-02** against the `dev` instance of the harness (`127.0.0.1:5380`),
serving a `dist/` built from `main` at `4960710`. This is the "before" the phase 1
redesign is measured against.

| | 1440 | 1024 | 768 | 390 |
|---|---|---|---|---|
| **populated** | ✔ | ✔ | ✔ | ✔ |
| **empty** | ✔ | ✔ | ✔ | ✔ |
| **error** | ✔ | ✔ | ✔ | ✔ |
| **loading** | ✔ | — | — | ✔ |

`loading` is captured at the two ends only. It is not a state the server produces
— it answers in milliseconds — so it has to be forced by delaying `fetch` by hand,
and the two ends bracket the only layout change there is.

## How each state was reached

- **populated.** The harness starts with a dashboard at all zeros, which is
  useless as a baseline for an overview screen. Traffic was generated through
  `api/dnsClient/resolve` with `server=this-server`, which is a real DNS query to
  the instance and therefore counts in its statistics: local zones for
  Authoritative/NoError, names that do not exist for NXDOMAIN, external names for
  Server Failure —this container has no upstream resolver— and three domains added
  to the block list for Blocked. **301 queries.**

  Two things this cost that are worth knowing next time: the statistics land in
  **minute-wide buckets**, so nothing shows up until roughly a minute after the
  queries; and `fetch('api/…')` from a page at `/dashboard/` resolves to
  `/dashboard/api/…` and 404s — it has to be `/api/…`.

- **empty.** A `Custom` range in the past (2026-07-01 → 2026-07-02), before this
  instance ever answered anything. Cleaner than tearing the data down.
- **error.** `fetch` replaced so that anything matching `dashboard` answers
  `200 {status:'error'}`, which is how this API really fails. Same idea as
  `dev/defects.js`.
- **loading.** The same replacement, delaying the dashboard calls by 25 s.

## Three states this harness cannot produce

Recorded rather than left blank, as `../README.md` asks:

- **Cached** stays at 0. Caching needs recursion to succeed, and this container has
  no upstream resolver: every external query ends in Server Failure.
- **Refused** and **Dropped** stay at 0. Both need an access or rate-limit policy
  that this instance does not have.
- **More than one client.** Every query comes from `127.0.0.1`, so `Clients` is 1
  and `Top Clients` has a single row.

## What the baseline already shows

Two things, both of which the phase 1 pilot happens to answer:

- **The error state is painted as an empty state.** The alert appears and the
  eleven tiles go to `—`, but the chart and the three Top lists fall back to
  *"No queries for this period."* and *"No data for this period."* — the same
  picture as a server with nothing to report, meaning the opposite. This is the
  exact defect `dev/defects.js` was written to catch, and it is in the shipping
  console today.
- **The palette collision is visible, not theoretical.** In the Query Response
  Types doughnut, Recursive `#a78bfa` and Blocked `#c084fc` read as one continuous
  arc. That is the ΔE00 **5,5** that `dev/palette-distance.mjs` measures.

And the layout problem the pilot exists to fix reads at a glance: at 1440 the
eleven tiles wrap **7 + 4**, leaving a hole, and the left column ends two thirds
up the page while the right one runs to the bottom.

## The capture trap

**`fullPage: true` and Chart.js do not mix.** A full-page screenshot resizes the
viewport, Chart.js's `responsive: true` catches the resize and redraws the canvas
asynchronously, and the picture is taken before the redraw lands: the three
doughnuts come out as legends floating over empty panels. It looks exactly like a
rendering bug, and it is not — sampling the canvas shows it painted.

Captures here are taken with the **viewport set as tall as the document** and
`fullPage` off, so nothing resizes at capture time. Anything that captures a
canvas has to do the same.

## The harness was left dirty, on purpose

The 301 queries and the three block-list entries (`ads.example.com`,
`tracker.example.net`, `doubleclick.net`) are still in the `dev` instance. That is
a disposable container and a populated dashboard is more useful than a clean one;
`docker compose down -v` resets it.
