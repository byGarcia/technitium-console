> **Superseded on 2026-09-01** by `2026-09-01-visual-redesign-spec.md`, which
> widens the scope from reorganising information to redesigning the console's
> appearance in full. This file is kept as the record of the audit that led
> there: its findings F1–F9 are what the new scope is built on, and F9 is why its
> own measurements cannot be trusted.

# Information structure: what each screen asks of the reader

**Date:** 2026-09-01 · **Status:** spec, not yet planned in full

## The question

The console reproduces upstream's behaviour screen by screen and has been
verified doing so. This spec asks a different question, which no test covers and
no measurement in `dev/` answers: **is the information on each screen arranged so
that someone can find what they came for?**

## The constraint that shapes every answer

`CONVENTIONS.md`: *design only, zero functionality. Any behavioural difference
from the upstream console is a bug, even when it looks like an improvement.*

So this spec may move, group, rename a heading, change a component or change
density. It may **not**:

- remove a control, a field or a piece of information;
- change the order in which validation happens, or what a control does;
- change the wording of a label, a helper text or an alert — those are contract;
- introduce a screen, a route or a step that upstream does not have.

A restructuring that "simplifies" by hiding something is out of scope. The test
is: could a user of the stock console do everything they did before, in the same
order, with the same words in front of them?

## Evidence

Measured on 2026-09-01 against the `dev` harness, v15.4, at 1440 px.

### Whole sections

| Section | tables | charts | fields | buttons | page height |
|---|---|---|---|---|---|
| Dashboard | – | 4 | – | 10 | 1595 |
| Zones | 1 (10 col) | – | 9 | **38** | 823 |
| Cache | 1 (5 col) | – | 1 | 14 | **3293** |
| Allowed | 1 (4 col) | – | 1 | 10 | 823 |
| Blocked | – | – | 1 | 7 | 823 |
| Apps | – | – | – | 5 | 823 |
| DNS Client | – | – | 4 | 4 | 823 |
| **Settings** | 2 | – | **54** | 11 | **5784** |
| DHCP | 1 (8 col) | – | – | 8 | 823 |
| Administration | 1 (6 col) | – | 6 | 18 | 823 |
| Logs | – | – | – | 3 | 823 |
| About | – | – | – | 1 | 875 |

823 px is the viewport: those sections fit without scrolling, though several are
near-empty in the harness and would grow with real data.

### Settings, sub-pane by sub-pane

| Sub-pane | fields | blocks | height |
|---|---|---|---|
| **General** | **54** | 10 | **5784** |
| Optional Protocols | 23 | 4 | 2980 |
| Proxy & Forwarders | 18 | 3 | 1949 |
| Web Service | 16 | 5 | 2316 |
| Cache | 15 | 4 | 1968 |
| Recursion | 12 | 3 | 1683 |
| Logging | 12 | 2 | 1185 |
| **Blocking** | 11 | **1** | 1692 |
| TSIG | 0 | 0 | 823 |

## Findings

### F1 — Settings › General is a dumping ground

54 fields in 10 blocks over 5784 px: seven screen-heights, and more fields than
the next two sub-panes together. Its blocks —Local Parameters, Default
Parameters, Software Update, IPv6, UDP Socket Pool, EDNS and four more— are not
one subject. "Default Parameters" alone holds 9 fields that have nothing to do
with the 4 in "Local Parameters".

This is upstream's own grouping, so **the fields cannot move to another sub-pane**:
that would be a navigational change. What can change is how ten unrelated blocks
are presented inside one page so the reader can reach the one they want.

**PENDIENTE: is a sub-pane's block list navigational (upstream's tab) or
presentational (our page)?** The answer decides whether an in-page index is a
restructuring or a new navigation step.

### F2 — Settings › Blocking is 11 fields with no grouping at all

One block, 11 fields, 1692 px. Every other sub-pane groups; this one does not.
Whatever internal structure Blocking has, the screen does not show it.

### F3 — Three blocks carry no heading

`Recursion`, `Blocking` and `Logging` each open with an untitled block (5, 11 and
10 fields). A block with a border and no name asks the reader to infer what
holds it together.

### F4 — Cache is 3293 px of a five-column table

Four screen-heights with 64 entries in the harness. On a real resolver that table
is the whole point of the screen, and its height is data, not layout — but the
controls that operate it sit above it and leave the viewport as soon as you
scroll.

### F5 — Zones carries 38 buttons in one viewport

Six rows × three row-actions, plus the header and the filter bar. It is a dense
table doing its job, but it is the highest control count in the console and worth
checking against the row-action patterns used elsewhere.

### F6 — Settings › TSIG measures zero fields — answered

It has a four-column table with no rows: a table screen, empty by data in this
harness, not a broken one. The same reading applies to `Administration › Cluster`
(823 px, two buttons) — no cluster is configured here. Neither is a defect;
both are decided by data this instance does not hold.

### F7 — The first survey undercounted the console by seven screens

The section table above was built by clicking the twelve top-level entries and
measuring whichever sub-screen each happened to open on. `src/app/sections.ts`
declares **twenty-seven** screens: eight sections with no sub-sections, and four
with between two and nine.

The seven never measured were DHCP › Scopes, Logs › Query Logs and the five
Administration sub-screens beyond Sessions. Among them, **Administration ›
Permissions carries 84 fields** — half again as many as Settings › General and
the most in the console — which changes the order of work.

The lesson is cheap and worth writing down: **the inventory of screens comes from
the code, which declares it; the browser is only needed for what the code cannot
say, which is how much room each one takes.**

### F8 — Three controls upstream has are missing, and their data files ship unread

Found by running the contract dump on the first screen, before any prompt was
written. All three are the same shape: a list of known values, loaded from a JSON
file in `www/json/`, offered next to a free-text field.

| Screen | Upstream | This console | File, shipped and never read |
|---|---|---|---|
| Settings › Blocking | `Quick Add` select of known block lists (`index.html:2156`) | the help text that describes it survived; the control did not | `quick-block-lists-{custom,builtin}.json` |
| Settings › Proxy & Forwarders | `Quick Add` select of known forwarders (`index.html:2264`) | nothing, not even the mention | `quick-forwarders-list-{custom,builtin}.json` |
| DNS Client | `Server` is a text field **with a dropdown** of known servers (`index.html:840-846`) | the text field alone | `dnsclient-server-list-{custom,builtin}.json` |

Upstream loads each by trying `-custom.json` first and falling back to
`-builtin.json`. Those are the same `*-custom.json` files the installer goes out
of its way to preserve: the console asks its installer to protect an
administrator's customisation of lists it never reads.

The Quick Add pattern is not missing from the codebase — `ZoneOptions.tsx` and
Cluster both implement one, fed from the API. These three, fed from files, were
missed.

**This blocks the loop.** These are lost controls, not layout: restoring them is
required by the project's own rule, and it has to happen before a screen goes out
for redesign. Otherwise the prompt enshrines an incomplete screen, and the
contract taken after the rebuild matches the one taken before while both are
wrong.

### F9 — The contract tool could not see half the controls

`contract()` v1 asked for `input, select, textarea`. `ui/Select.tsx` is a
`<button role="combobox">` with its own listbox, so **every select in the console
was invisible to the tool built to stop controls going missing**. Eight screens
use it. Measured after the fix: `Logs › Query Logs` goes from 7 controls to 15.

Two consequences, and the second is the expensive one:

1. Fixed. v2 asks by role as well as by tag, and also captures the options behind
   a closed listbox, `disabled`/`required`/`readonly`, links, and which of
   empty / loading / error the screen is in.
2. **Every field count in this spec is low by an unknown amount**, and with them
   the order of work. They are re-measured before any screen is sent out. In
   particular, ranking `Administration › Permissions` second on "84 fields" does
   not survive: that screen is an `EditableTable` permissions matrix whose editing
   happens in a dialog, so its controls are not 84 independent form fields at all.

The lesson is the same one F7 taught in a different costume: **a tool that
inventories an interface has to ask the interface how it is built, not how the
platform used to build it.**

## What "cleaner" means here

Ranked, because these conflict:

1. **Reachable.** The reader gets to the block they want without paging through
   nine they do not. Applies to F1 above all.
2. **Grouped by subject, and the group is named.** F2, F3.
3. **Controls stay with what they control.** F4.
4. **The same object looks the same everywhere.** `dev/uniformity.js` already
   enforces this; anything new here must not reintroduce a variant.

## Out of scope

- The Dashboard. It was restructured on 2026-09-01 (palette, chart drawing,
  tile/chart colour agreement) and is not revisited here.
- The 43 dialogs. `dev/dialog-census.js` covers them and they were audited screen
  by screen; the width defect found on 2026-09-01 is already fixed.
- Anything requiring a change to the server.

## How this gets done

Not by redesigning here. Each screen goes to **Claude Design**, where this
project and its components already live, as a self-contained prompt; what comes
back is reconciled against the screen's own contract before anything is built.

The loop, the prompt template and the order of screens are in
[the plan](2026-09-01-information-structure-plan.md).

The one risk that shapes that whole loop is worth stating here: the failure mode
of handing a screen to a design tool is not ugliness, it is **attrition** — a
control that was on the screen, was not in the prompt, and quietly does not come
back. Under this project's rule that is the one thing that may never happen, so
`dev/screen-contract.mjs` dumps the exhaustive inventory of a screen, the prompt
carries it whole, and the same dump is the checklist the returned design is
walked against.
