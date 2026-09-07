> **Superseded on 2026-09-01** by `2026-09-01-visual-redesign-plan.md`, which
> widens the scope from reorganising information to redesigning the console's
> appearance in full. This file is kept as the record of the audit that led
> there: its findings F1–F9 are what the new scope is built on, and F9 is why its
> own measurements cannot be trusted.

# Information structure: plan

> Companion to `2026-09-01-information-structure-spec.md`. Read the spec first:
> it holds the evidence and the constraint.

**Goal:** restructure the console's screens, one at a time, by sending each to
Claude Design as a self-contained prompt and building what comes back — without
losing a single control on the way.

**Architecture:** a loop per screen. The console dumps its own contract, the
contract becomes the prompt, the returned design is reconciled against that same
contract before a line is written, and the build is verified with the harness
that already exists.

**Tech stack:** the console's own component library (`src/ui/`, 24 modules),
`dev/screen-contract.mjs`, `dev/uniformity.js`, `dev/dialog-census.js`, the two
Docker instances in `dev/`.

## Global constraints

- **Design only, zero functionality.** No control, field, option or piece of
  information may disappear. Labels, helper texts and alert wording are contract
  and travel verbatim.
- **No new navigation.** A sub-pane may not become two, and a screen may not gain
  a step upstream does not have.
- **Reuse, do not invent.** The design comes back expressed in the components
  listed below; a new primitive has to be justified against `dev/uniformity.js`,
  which exists because this console already paid for seven variants of one container.
- **One screen per pass.** Each is independently shippable and independently
  reviewable.

## The loop, per screen

### 1. Capture the contract

With the harness up and the screen open:

```js
// dev/screen-contract.mjs, pasted into the console or browser_evaluate
contract()
```

Output is the exhaustive inventory: every field with its label, kind and helper
text; every button; every table's columns and row actions; every note.

### 2. Build the prompt

Fill the template below. Everything in it is fact from step 1 — nothing is
summarised, because what is summarised is what goes missing.

### 3. Send it to Claude Design

The project and its components are already there.

### 4. Reconcile before building — the gate that matters

Take the returned design and walk the contract from step 1, item by item:

- every field present, with its label unchanged?
- every helper text present, word for word?
- every button present, with the same verb?
- every table column present, in a table?
- has anything been *added* that upstream does not have?

Any miss is resolved with Claude Design, not patched in code. **A design that
lost a control is not "close enough to start from".** This is the step the
FinanceApp work learned the hard way: the export decides the interface, so the
export is what has to be right.

### 5. Build

Against the reconciled design, using `src/ui/`.

### 6. Verify

```bash
npm run typecheck && npm run lint && npm test
npm run build && (cd dev && docker compose up -d)
# then, in the browser on the rebuilt screen:
#   contract()          -> diff against the contract from step 1: must match
#   uniformity.js       -> no new variant of an existing object
#   at 1440 and 390 px  -> no overflow
```

`contract()` before and after must produce the same inventory. That is the whole
safety net: same controls, same words, different arrangement.

### 7. Commit, one screen per commit

---

## The prompt template

````markdown
# Redesign: <SECTION> › <SUB-PANE>

## What this is

A screen of an alternative administration console for Technitium DNS Server. It
replaces the console the server ships with, and it is governed by one rule:

> **Design only, zero functionality.** Any behavioural difference from the stock
> console is a bug, even when it looks like an improvement.

So: rearrange, regroup, rename a *group heading*, change which component carries
something, change density. Do **not** remove a field, drop a helper text, reword
a label, or add a step. If a field looks redundant, it stays.

## The problem with the screen as it is

<the finding from the spec, with its measurement — e.g. "11 fields in a single
undifferentiated block over 1692 px; every other sub-pane in this section groups
its fields and this one does not">

## Everything on it, which must all still be there

<paste the `contract()` output verbatim>

## The components to build it from

Panel/Body · Block · Row/GroupRow · Field/Input/LabeledInput/Textarea/
LabeledTextarea/LabeledSelect · Select · Check · Radios · Segmented · Button ·
Table/Th/RowAction · EditableTable · EditableList · Pagination · Tag/Chip ·
Alert · Note/Warning/Notices · HelpText/Help · Details · Dialog · Confirm ·
Empty/Loading/Failure · SectionHeader · Menu · Icon · Pre · Trailer

Prefer these over anything new. If the arrangement genuinely needs a primitive
that is not here, say so explicitly and say why.

## The world it lives in

Dark console, amber accent (`#f5a524`), monospace for figures and identifiers,
tight typography. Red means destructive and nothing else. The reader is an
administrator looking at their own DNS server, often on a phone because something
has stopped resolving.

## What to return

A layout for this screen, with every item above placed, and a short note per
grouping decision saying what holds that group together.
````

---

> **The field counts below are wrong and are kept only as a record.** They were
> taken by asking the DOM for `input, select, textarea`, and `ui/Select.tsx` is a
> `<button role="combobox">`. Measured after the fix, `Logs › Query Logs` goes
> from 7 to 15: eight comboboxes were invisible. Every count on a screen that
> uses a Select is low by an unknown amount, so **the order of work derived from
> them does not stand** and is re-measured with `contract()` v2 before any screen
> goes out.

## The screens

Twenty-seven, from `src/app/sections.ts`. Eight sections have no sub-sections;
four have between two and nine. Measured at 1440 px against the harness, whose
data is thin — six zones, two clients, no DHCP leases, no cluster — so a table's
height here is a floor, not a figure.

| Section | Screen | fields | buttons | table | height |
|---|---|---|---|---|---|
| Dashboard | – | – | 10 | – | 1595 |
| Zones | – | 9 | **38** | 10 col | 823 |
| Cache | – | 1 | 14 | 5 col | **3293** |
| Allowed | – | 1 | 10 | 4 col | 823 |
| Blocked | – | 1 | 7 | – | 823 |
| Apps | – | – | 5 | – | 823 |
| DNS Client | – | 4 | 4 | – | 823 |
| Settings | General | 54 | 11 | 4+4 col | **5784** |
| Settings | Web Service | 16 | 4 | – | 2316 |
| Settings | Optional Protocols | 23 | 4 | – | 2980 |
| Settings | TSIG | – | 5 | 4 col | 823 |
| Settings | Recursion | 12 | 4 | – | 1683 |
| Settings | Cache | 15 | 4 | – | 1968 |
| Settings | Blocking | 11 | 6 | – | 1692 |
| Settings | Proxy & Forwarders | 18 | 4 | – | 1949 |
| Settings | Logging | 12 | 4 | – | 1185 |
| DHCP | Leases | – | 8 | 8 col | 823 |
| DHCP | Scopes | – | 8 | 6 col | 823 |
| Administration | Sessions | – | 18 | 6 col | 823 |
| Administration | Users | – | 20 | 8 col | 823 |
| Administration | Groups | – | 15 | 3 col | 823 |
| Administration | **Permissions** | **84** | 11 | – | 2491 |
| Administration | SSO | 10 | 6 | 2+3 col | 1987 |
| Administration | Cluster | – | 2 | – | 823 |
| Logs | View Logs | – | 3 | – | 823 |
| Logs | Query Logs | 7 | 11 | – | 823 |
| About | – | – | 1 | – | 875 |

**Administration › Permissions carries 84 fields**, half again as many as
Settings › General and the most in the console. It was missed on the first pass
because that pass clicked the twelve top-level sections and measured whichever
sub-screen each opened on. The inventory comes from `sections.ts`; only the
measurements need a browser.

`Settings › TSIG` measures zero fields but has a four-column table: it is a table
screen with no rows in this harness, not a broken one. **PENDIENTE F6 in the spec
is answered** — empty by data. The same reading applies to `Administration ›
Cluster`, which is 823 px and two buttons because no cluster is configured here.

## Order of work

**Task 0, before any screen goes out: restore the three controls in spec F7.**
Blocking's Quick Add, Proxy & Forwarders' Quick Add and the DNS Client server
dropdown are missing, and each has its data file already shipping in
`public/json/`. A screen redesigned while a control is missing comes back with
the gap built in, and the contract check cannot catch it: the dump taken after
matches the one taken before.

Then, ordered by what is measurable and structural rather than by where it sits
in the menu:

| # | Screen | Why here |
|---|---|---|
| 1 | Settings › Blocking | 11 fields, one block, four evident subjects. Smallest complete case: proves the loop cheaply |
| 2 | Administration › Permissions | 84 fields, the most in the console |
| 3 | Settings › General | 54 fields in 10 unrelated blocks, seven screen-heights |
| 4 | Cache | 3293 px with its controls scrolled off the top |
| 5 | Settings › Optional Protocols | 23 fields, 2980 px |
| 6 | Administration › SSO | 10 fields plus two tables in 1987 px |
| 7 | Settings › Web Service | 16 fields, 2316 px |
| 8 | Settings › Proxy & Forwarders | 18 fields, 1949 px |
| 9 | Settings › Cache | 15 fields, 1968 px |
| 10 | Settings › Recursion | 12 fields, untitled opening block |
| 11 | Settings › Logging | 12 fields, untitled opening block |
| 12 | Zones | 38 controls in one viewport |
| 13 | Administration › Users | 20 buttons over an 8-column table |
| 14 | Logs › Query Logs | 7 filter fields, 11 buttons |

Not scheduled, and why: **Sessions, Groups, Leases, Scopes, Allowed, Blocked,
Apps, DNS Client, View Logs, TSIG, Cluster, About**. Each fits a viewport here,
but the harness holds six zones, two clients, no leases and no cluster. Their
shape is decided by data this instance does not have, and planning them now would
be inventing defects. They are revisited against a real server.

## What is already answered, so nobody re-asks

- **Dashboard:** restructured 2026-09-01. Out of scope.
- **Dialogs:** audited; the width defect is fixed. Out of scope.
- **Colour:** one palette, in `tokens.css`, keyed by label. A screen may not
  introduce a colour.
