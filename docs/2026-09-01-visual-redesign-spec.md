# Integral visual redesign of the console — spec

**Date:** 2026-09-01 · **Supersedes:** `2026-09-01-information-structure-spec.md`,
which is kept as the record of the audit that led here.

## Objective

Redesign the console's appearance in full: shell, login, dashboard, every
destination, every detail view, every state and every dialog. Not a
reorganisation of forms.

## The four references, and what each one is for

Kept apart on purpose. Every past mistake in this project came from letting one
answer a question that belonged to another.

| Reference | Authority over | No say in |
|---|---|---|
| **The Claude Design project** | Design, and the starting point. The visual result is an **evolution of it** | What must exist |
| **The current React code** | The implementation: what is built and how it behaves today | What it should look like |
| **The official upstream console** | **Functional parity only** — that nothing is missing | Anything visual. It is a specification, not a reference design |
| **The result** | An evolution of the Claude project | Never a copy of Bootstrap or of upstream |

Upstream is read to answer one question: *is anything missing?* It is never
opened for how something looks. Its arrangement, its components and its palette
belong to a console being replaced.

## The invariants

These hold on every surface, in every phase. A change that breaks one is not a
redesign, it is a regression.

1. **Zero functional change.** No route, no flow, no step.
2. **Same controls, same texts, same validations, same permissions.** Labels,
   helper texts and alert wording are contract and travel verbatim.
3. **Tooltips present names that already exist** — an icon-only button's label, a
   truncated value in full. Never a new explanation, never a replacement for a
   visible label or helper text.
4. **Each surface is validated and delivered on its own.**
5. **The contract is checked against upstream, not only against this console.**
   Our version is a witness, not the truth: it has already been caught missing
   three controls upstream has.

   Upstream is the authority on **what** must exist — controls, options, labels,
   helper texts, validations — and has **no say in how any of it looks or is
   arranged**.

7. **The inventory carries no visual order, and every relation.** Order and
   grouping are outputs of this work, so they are not handed over as inputs. But
   stripping order must not strip meaning: a field keeps its helper text, a
   select keeps its options, a conditional keeps what it depends on, and an
   action keeps the object it acts on. **An inventory without visual order, not a
   list without relations.**
6. **Order comes from archetype and impact**, not from control counts. The counts
   this project produced were wrong, and even correct ones rank a permissions
   matrix above a screen people use daily.

## Why the previous plan was not enough

Recorded because each gap is a rule above.

| | Gap | Now |
|---|---|---|
| 1 | Scheduled 14 of 27 destinations; excluded dashboard, login, detail views and every dialog | Full surface inventory below |
| 2 | `contract()` asked for `input, select, textarea`; our Select is a `<button role="combobox">`, so every select was invisible. Query Logs: 7 measured, 15 real | v2 asks by role, and captures options, `disabled`/`required`/`readonly`, links and state. Invariant 5 adds upstream as the reference |
| 3 | Compared this console against itself, so known defects survived | Invariant 5 |
| 4 | "Reuse, do not invent" + a closed component list forced the same panels back | Phase 2 evolves the primitives before any surface is redesigned |
| 5 | "Cleaner" covered only scope, grouping and proximity | Criteria below |
| 6 | F1 wanted fast access to blocks; the plan banned all new navigation | Presentational navigation — in-page anchors, no route, no step — is allowed |
| 7 | Ranked by field count | Invariant 6 |

## The surfaces

From the code, not from the menu. `sections.ts` declares destinations; it does
not declare everything a user can be looking at.

| Kind | Count | Where |
|---|---|---|
| Shell | 1 | `app/Shell.tsx` — sidebar, drawer, versions block, page footer |
| Login | 1 | `screens/Login.tsx` |
| Menu destinations | 27 | `app/sections.ts`: 8 sections without sub-sections, plus Settings (9), Administration (6), DHCP (2), Logs (2) |
| Embedded detail screens | 4 | `zones/ZoneRecords`, `dhcp/ScopeForm`, `lists/Records`, `lists/Tree`. Each is a sub-view of its destination, as it is upstream |
| Dialog surfaces | 40 | Upstream's stable ids, mapped one by one. 39 have a home here; `modalChangeTheme` is absent by deviation 1 |
| Confirmation contracts | 25 | Through **one** visual surface, `ui/Confirm.tsx`. 21 elements, 25 contracts: see the phase 0 diff |

Corrected on 2026-09-01. This table first said "9 detail views", which
double-counted: `UserDetails`, `AppConfig`, `InstallApp`, `StoreApps` and
`UpdateApp` are `<Dialog>`s, and all five are already among upstream's 40 modals.
Only four detail views are screens.

It also said "42 Dialog + 21 Confirm", which counts JSX and not surfaces. The
dialog surfaces are upstream's 40, because those are enumerable and stable; ours
group differently — one of theirs is two of ours for permissions, and nine of
ours cover their eight cluster modals.

Every one of those, in each state it can be in: **populated, empty, loading,
error**, and where permissions change what is drawn, in each variant.

## Archetypes

The ordering axis. A surface's archetype decides what it needs and what it can
inherit from the one before it, which is why the work goes archetype by archetype
and not menu-order by menu-order.

| Archetype | Examples | What it has to solve |
|---|---|---|
| **Chrome** | Shell, login | Identity, orientation, what is always in sight |
| **Overview** | Dashboard | Reading many numbers at once; nothing is edited |
| **Collection** | Zones, Cache, Allowed, Blocked, Sessions, Users, Groups, Leases, Scopes, Apps | A table plus the controls that operate it; scale is decided by data we do not have here |
| **Dense form** | The nine Settings panes, SSO | Many fields, grouped, saved together |
| **Matrix** | Permissions | A grid of the same control repeated, edited elsewhere |
| **Tool** | DNS Client, Query Logs, View Logs | Ask a question, read an answer |
| **Detail** | ZoneRecords, UserDetails, ScopeForm, the four Apps views | One record opened from a collection |
| **Dialog** | 42 + 21 confirmations | A task interrupted by another; the console's densest surfaces |
| **Reference** | About, TSIG | Read, rarely act |

Solving an archetype once carries most of the way to the rest of its group. Doing
one screen from each first is what makes that true instead of hoped for.

## What "professional" means here, in checkable terms

The previous spec said "cleaner" and covered only scope, grouping and proximity.
The full list, each one a check on the built result:

- **Hierarchy.** On every surface, what to read first is decided by size, weight
  and space — not by border. No two levels of the same object may look alike.
- **Surface and depth.** One elevation language for what floats (dialog, menu,
  tooltip) versus what sits (panel, row). `tokens.css` already declares one; the
  problem measured is composition and repeated equivalent containers, not missing
  shadows.
- **Interactive states.** Hover, focus-visible, active, disabled, loading, error,
  selected — on every control, from the same scale.
- **Responsive.** Verified at **1440, 1024, 768 and 390 px**. "No horizontal
  overflow" is not the bar: the current mobile capture wraps domain names mid-word
  and pushes row actions out of reach, with no overflow at all.
- **Iconography.** One family, one stroke, one weight, one size scale. No glyph
  standing in for an icon.
- **Motion.** One authored moment per surface, from existing tokens, respecting
  `prefers-reduced-motion`. Not an entrance on everything.
- **Tooltips.** Only under invariant 3, reachable by keyboard and on touch.
- **Data typography.** Figures and identifiers in the monospace, tabular, aligned
  where they are compared.

## F10 — Six screens cannot see another cluster node

Upstream carries a cluster node select on Dashboard, Zones, Cache, Allowed,
Blocked, DNS Client and both Logs screens, shown when
`sessionData.info.clusterInitialized` is true (`js/cluster.js`). This console has
it in Administration and DHCP only; in the other six, `grep -in cluster` returns
nothing.

On a clustered server, upstream lets you read another node's data from those
screens and this console cannot. **That part stands.** The rest of what was first
written here did not, and the correction matters more than the finding.

**Corrected 2026-09-01.** This section first said the control was "not hidden, not
conditional, not deferred: never built", on the evidence that `grep -in cluster`
returned nothing in those files. The grep was the wrong word. The code calls it
`node`, and reading it shows the opposite of an oversight:

- The work knew the controls existed and named them by upstream's own ids —
  `optDhcpClusterNode` in `screens/dhcp/Dhcp.tsx:14`, `optZonesClusterNode` in
  `api/zones.ts:18` and `api/dnssec.ts:14`.
- It threaded `node` through the API layer and the component props, empty by
  default, on every affected call.
- It deliberately did not mount the selectors, and wrote down why: *"this console
  has no cluster mode yet. The `node` parameter travels all the same, empty, on
  all ten calls, which is what upstream sends with a single server."*

So this is a **deferral with the groundwork laid**, recorded at each site, not an
unrecorded deviation. Phase 0.6 finishes it rather than building it: the plumbing
is there and what is missing is the control that feeds it.

Two lessons, and the second is the expensive one. A grep for the word a document
uses will miss code that uses another word for the same thing. And a finding that
reads as negligence should be checked twice as hard as one that does not —
this one was three commands away from being read correctly, and it was published
first.

## Open questions

- **PENDIENTE: are the 21 `<Confirm>` usages 21 surfaces or one surface used 21
  times?** Decides whether confirmations are a phase-2 primitive or phase-N work.
- **PENDIENTE: which surfaces change with permissions, and how many variants does
  that produce?** Needed before the validation matrix can be closed.
- **PENDIENTE: does upstream have surfaces this console never built?** Invariant 5
  makes this answerable and F8 proves it is not hypothetical.
