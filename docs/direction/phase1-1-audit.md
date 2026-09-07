# Phase 1.1 — the direction this project already has

Audit run in the Claude Design project **«technitium-ui — consola DNS»**
(`13cce168-812c-4195-a74b-617702e6e3cd`), file `10-auditoria.html`, read on
2026-09-01. Summarised here so the plan does not depend on the tool being
reachable; the original is the authority.

The project holds 17 files: ten screen pages, `consola.css`, `shell.js`, an index,
a dark-theme study and a CSS test.

## A — what it already decides

Rated by how far each rule holds: **firm** everywhere it applies · **partial**
decided with exceptions · **one site** a single instance, an example not yet a
rule · **contradicted** asserted both ways with no canonical source.

### Firm

- **Hierarchy is size and colour, never border or shadow.** Four levels: screen
  title 22/700, panel header 12.5/650 in ink, form group title 12/700 grey small
  caps, table header 11/700 grey small caps.
- **Space separates blocks; a 1 px line separates rows.** Two line weights.
- **Four-step surface scale and only four.** The form field sinks *below* the
  background: a hole sinks, it does not rise.
- **What sits carries no shadow; what floats carries shadow and scrim** — and
  only the modal floats.
- **The form breathes and the table tightens**, deliberately: 73 px per airy row
  against 59 px dense, measured.
- **All data in monospace** — IPs, TTLs, domains, serials, counters, timestamps,
  MACs — and every label and prose in the UI face, in grey. The index calls this
  the main presentational change. Figures are tabular.
- **Everything left-aligned, numbers included.**
- **One accent, the amber Technitium already shipped**, and it is interface, not
  state. **Red is destructive and nothing else**, and never filled.
- **Ten series colours, fixed per metric and stable across screens.**
- **Chrome is 52 px, sidebar 216 px**, decided by measuring.
- Complete systems for modals (6 patterns, 39 distributed), long forms, editable
  lists, tables, and the variable-height Data cell.
- **Empty is solved well**: dashed box, a sentence explaining why it is empty and
  the action that fills it. Three instances, all three name the way out.

### Partial or absent — the gaps that matter

| | |
|---|---|
| **No named spacing scale** | 15 values in use (5…26 px). Each screen is consistent with itself; the whole answers to no grid |
| **No radius scale** | 9 values, though a stable per-object assignment works as a de facto rule |
| **Type is a ramp, not a scale** | 13 sizes. Weight 650 is the most frequent and only a variable font honours it |
| **Disabled is improvised** | `style="opacity:.35"` inline. No class, no token, no cursor change, no accessible mark |
| **Focus-visible does not exist** | Not one `:focus` rule in 15 files. Keyboard navigation relies on the browser default, near-invisible on `#0a0d12` |
| **Loading does not exist** | No skeleton, no spinner, no ghost row — on screens whose latency is the point |
| **Error does not exist** | And would be indistinguishable from empty: the dashed box is the only container for "nothing to show" |
| **No icon family** | Twelve Unicode glyphs from different blocks, drawn by whatever font the OS has |
| **Nothing moves** | Not one transition, animation or keyframe. Decided by omission, never in writing |
| **One width: 1320 px** | No media query anywhere. 1440 / 1024 / 768 / 390 are not decided in any file |

Of seven interactive states: **two decided** (hover, selected), **one improvised**
(disabled), **four absent** (focus, active, loading, error).

### Contradicted inside the project

1. **The chrome measurement**: 143 px in `09-navegacion`, 163 px in the index.
2. **The theme decision**: `oscuro.html` still argues the three themes are
   contract and that removing the modal would be removing functionality; the
   index, which is later, decides the opposite and is not retracted.
3. **The amber clash**: the written rule says amber is interface and not state,
   and the dashboard and Query Logs use it for the data value "Blocked".

## B — what it does not yet answer

Per archetype, the questions the project cannot answer today. The full text is in
the original; the shape of it:

- **Chrome** — what the sidebar does when 12 sections and 9 sub-items do not fit
  in height; whether a collapsed rail exists; navigation below 768 px; **and the
  cluster node selector, which is permanent chrome that changes the meaning of
  every screen and is not drawn**.
- **Overview** — how eleven cards reflow into six columns at 1024/768/390; a
  ten-series legend at 390; whether the chart answers the pointer at all, with no
  tooltip language in the project; a freshly-installed dashboard at all zeros.
- **Dense form** — **how you reach group nine without walking through eight**: the
  wall is chopped up but not indexed. Whether the Save bar is sticky (today it
  scrolls away). A modified-unsaved field. An invalid field and where its message
  goes.
- **Collection** — ten columns that do not fit; sticky header; **what selecting
  rows looks like** (there are checkboxes and a Delete Zones, and no selection
  bar); column sorting, which has neither gesture nor mark; a row at 390 px.
- **Matrix** — hundreds of repeated controls; whether those checkboxes are
  editable or read-only, "which is exactly the confusion to resolve".
- **Tool** — before the first query; while resolving; **how a legitimate NXDOMAIN
  is told apart from a timeout**, one being a correct answer and the other not.
- **Detail** — page, drawer or modal: the project uses all three for the same
  object with no rule saying when.
- **Dialog** — a dialog taller than the window (no max height, no scrolling body,
  no sticky footer); a dialog opening another; 560 px fixed at 390 px; focus on
  open; **and validation errors, absent from all 18 form dialogs**.

Thirteen transversal gaps, the same list from the other side: focus, loading,
error-versus-empty, disabled, confirmation of actions without a dialog, the
missing floating surfaces, motion, icons, named scales, the amber clash, widths,
language, and **which file wins when two contradict**.

## Where this meets phase 0

Three of its findings are the same as ours, reached from the other side:

- **The cluster node selector.** The audit calls it permanent chrome that is not
  drawn; phase 0 found it missing from the code and restored it (spec F10). The
  design project still owes the drawing.
- **Error must not look like empty.** `dev/defects.js` was written for exactly
  that rule, and the audit finds the design has no container that honours it.
- **The amber clash.** The code has already decided it, in the other direction
  from the project: the chart palette of 2026-09-01 moved `Blocked` to purple and
  left amber as `Clients`, so the accent stays interface-only. **The design
  project has not been told.**

---

# Reconciliation — the design project against the code

Read on 2026-09-01 from `consola.css` in the design project against
`src/theme/tokens.css`.

## Colour: the meaning agrees, the neutrals do not

**Eight of eight semantic colours are identical.** `--acc` `#f5a524`, `--on-acc`,
`--ok`, `--warn`, `--dan`, `--info`, `--viol`, `--cyan`. The direction and the
implementation say exactly the same thing about what colour *means*.

**Nine of nine neutrals differ**, and not as drift — as a systematic re-toning:

| | design | code |
|---|---|---|
| `--bg` | `#0e1116` | `#111315` |
| `--pan` | `#141923` | `#191c1f` |
| `--pan2` | `#11151d` | `#212529` |
| `--line` | `#232a36` | `#333a41` |
| `--line2` | `#1a202b` | `#24282d` |
| `--ink` | `#e6e9ef` | `#e8eaec` |
| `--mute` | `#8b95a7` | `#9aa1a8` |
| `--faint` | `#5d6779` | `#868e96` |
| `--field` | `#0a0d12` | `#0d0f11` |

The design's neutrals carry a blue channel; the code's are near-neutral grey. And
the code's `--line` is markedly lighter — `#333a41` against `#232a36` — so its
borders carry more contrast.

`--hover` exists in the design and not in the code.

**This is the first decision phase 1 has to make, and it is not a small one:** the
surface scale is what the whole console sits on. The four references say the
design project decides design, so nominally its neutrals win — but the code's
were chosen by somebody, and a lighter `--line` reads like a contrast fix rather
than a preference. Whichever way it goes, one of the two is corrected, not both
left standing.

## What the design project does not know about the code

Three changes made on 2026-09-01, after the audit was written:

1. **The amber clash is already resolved in code, the other way.** The chart
   palette moved `Blocked` to purple and kept amber for `Clients`, so the accent
   stays interface-only — which is what the design's own written rule says and
   what its dashboard contradicted.
2. **Ten cluster node selectors now exist** (spec F10), the "permanent chrome
   that changes the meaning of every screen" the audit lists as undrawn. The code
   has them; the design still owes the drawing.
3. **Three controls were restored** (spec F8): the Quick Add lists on Blocking
   and on Proxy & Forwarders, and the DNS Client server list.

The design project has not been told any of this, and under the four references
it is the one that decides design. Feeding it back is phase 1 work, not a
courtesy.

## Fed back to the design project

`11-codigo.html` written into «technitium-ui — consola DNS» on 2026-09-01, in the
project's own format and stylesheet, carrying the four items above: the amber
resolved and why, the cluster node selector with its three rules and the note
that it still owes a drawing, the three restored controls, and the neutral scale
side by side with the recommendation.

A copy is kept here. The project is the authority; this copy exists so the record
survives without it.
