# Integral visual redesign — plan

> Read `2026-09-01-visual-redesign-spec.md` first: it holds the invariants, the
> surface inventory and the archetypes. Supersedes
> `2026-09-01-information-structure-plan.md`.

**Goal:** redesign every surface of the console, in phases, without losing a
control, a word or a behaviour.

**Architecture:** three phases before any surface is touched — instrumentation,
visual direction, primitives — then surface work archetype by archetype. Each
surface goes to Claude Design as a self-contained prompt and comes back to a
reconciliation gate.

## Global constraints

The spec's invariants, restated because every task inherits them:

- Zero functional change: no route, no flow, no step.
- Same controls, texts, validations and permissions. Wording is verbatim.
- Tooltips present existing names only.
- One surface per delivery.
- The contract is checked against **upstream**, not only against this console.
- Order comes from archetype and impact.
- Four references, kept apart: design and starting point is the **Claude Design
  project**; implementation is the current React code; functional parity is
  upstream, read only to answer *is anything missing*; the result is an evolution
  of the Claude project and never a copy of upstream.
- The inventory travels **without visual order and with every relation**.

---

## Phase 0 — Instrumentation, and its own no-loss contract

Nothing is designed in this phase. It exists because the previous attempt's
safety net had a hole in it, and a redesign is only as safe as the net.

- [x] **0.1 — `contract()` v2 against upstream.** The tool dumps our surface
      today. It has to dump upstream's too, from the `ref` instance in `dev/`
      (the untouched official console on `:5381`), and diff them. Output: for each
      surface, what upstream has that we do not.
- [x] **0.2 — Close PENDIENTE: are the 21 `<Confirm>` usages one surface or 21?**
      Read the call sites. The answer decides whether confirmations are designed
      once in phase 2 or 21 times later.
- [x] **0.3 — Close PENDIENTE: the permission variants.** Which surfaces draw
      differently by permission, and how many variants that is. Until this is
      known the validation matrix cannot be closed.
- [x] **0.4 — Re-measure every surface with v2.** The counts in the previous spec
      are low by an unknown amount. This produces the real figures.
- [x] **0.5 — Baseline captures**, scoped: per surface, at that surface's turn.
      Capturing all 27 destinations plus 40 dialogs across four states and four
      widths is six hundred pictures, most of a screen nobody is about to touch,
      and a capture is only evidence while the screen it shows is current. See
      [`baseline/README.md`](baseline/README.md). The three pilots are captured
      when phase 1 starts.

- [x] **0.6 — Restore every parity loss the diff found**, Quick Add included.

**Gate — the whole of it, before any prompt is executed.** 0.1 through 0.6
complete, the upstream diff empty or every entry decided, and the losses restored.

The gate is not skipped because one surface happens to be nearly ready. Blocking
has its contract, its dependency map and its upstream diff, and that is not a
reason to start: this project has twice paid for planning on top of measurements
that were not finished, and the second time the safety net itself had a hole in
it.

The one thing that may be written before the gate opens is the phase 1.1 audit
prompt, because it asks Claude Design to read its own project and nothing else.

---

## Phase 1 — Visual direction

The direction is not invented here. **It already exists in the Claude Design
project**, and this phase takes it as the starting point and evolves it into
something that covers a console of this size.

- [ ] **1.1 — Audit the direction the project already has.** The prompt is written
      and ready: [`prompts/phase1-1-direction-audit.md`](prompts/phase1-1-direction-audit.md).
      It asks Claude Design to read its own project and return two lists — what it
      already decides, and what it does not yet answer for a console of this size
      — and forbids inventing anything in the pass, because an invented answer
      would quietly become the direction.

      Nothing has to be exported or described first: the project is already there
      and can be analysed from inside. Its exports are needed later, to reconcile
      and to implement.
- [ ] **1.2 — The use scene, as the test the evolution has to pass**: an
      administrator looking at their own DNS server, often on a phone, often
      because something has stopped resolving.
- [ ] **1.3 — Three pilots, in the order the walk will take**: the Dashboard
      inside its shell (overview + chrome), Zones (collection) and one Settings
      pane (dense form). They are pilots, not deliveries: they exist to prove the
      evolved direction survives the three shapes that fight each other, and they
      are taken in menu order so the walk and the pilots do not disagree.

      - [x] **Pilot 1 — Dashboard inside its shell.** Closed 2026-09-02. Two
            rounds: the contract walk found a lost series the first pass had
            passed, and the colour divergence was settled by measuring rather
            than arguing. See [`direction/piloto-1-reconciliacion.md`](direction/piloto-1-reconciliacion.md),
            its baseline in [`baseline/dashboard/`](baseline/dashboard/README.md)
            and the prompts in [`prompts/`](prompts/).
      - [x] **Pilot 2 — Zones** (collection, and the eleven dialogs that settle
            the modal system for everything after it). Closed 2026-09-02. Three
            rounds and seven findings, and **not one of them was a design
            problem**: every single one was a fact of the code drawn differently
            —tab order, the option order of a `<select>`, one word on a button, a
            control that vanished at one width— and none of them was visible in a
            screenshot. No control was ever lost. It settles the whole modal
            system: the four widths and what shape each carries, where the
            validation message is painted, what happens when a dialog opens
            another, the anatomy of `Confirm` and the repeating-row pattern —
            which `AddEditRecord`, `ZoneOptions` and `ZonePermissions` share with
            Settings, DHCP and Administration. See
            [`direction/piloto-2-reconciliacion-recorrido.md`](direction/piloto-2-reconciliacion-recorrido.md)
            and its contract in [`direction/piloto-2-contrato-zones.md`](direction/piloto-2-contrato-zones.md).
      - [x] **Pilot 3 — `Settings › General`** (dense form). Closed 2026-09-02,
            in one round. Its census was counted name by name on the rendered
            file, not taken on trust: 39 controls, 41 help paragraphs, 19
            suffixes, 12 notices, 10 sections, 2 lists, 9 sub-tabs and the bar —
            and 390 returns the same list as 1440. It settles where the text
            lives on a dense form (help in a third column, never folded, never
            summarised), `Warning!` before the controls and `Note!` after, and
            the two greys —«amber = you can; padlock = you cannot»—. **The only
            defect the walk found was in the CONTRACT, and the pilot found it**:
            it claimed six `GroupRow` and named two. See
            [`direction/piloto-3-reconciliacion.md`](direction/piloto-3-reconciliacion.md).
- [x] **1.4 — Write the result into `tokens.css` and a short `DESIGN.md`**, as an
      evolution of the Claude project and never as a copy of upstream. **Done
      2026-09-02.**

      Twelve tokens, and the filter for adding one was deliberately harsh: **only
      what the pilots REPEATED**. A value that appeared on one surface stayed in
      its pilot; a value three surfaces reached for on their own is a token,
      because that is what a token is. `--dim: 0.42` is the clearest case — pilot
      1 used it for data being refreshed, pilot 2 for the dialog underneath and
      for rows whose refresh failed, pilot 3 for a control switched off by its
      master. One number, one meaning: *here, readable, and not current or not
      yours*.

      The breakpoints are declared **with their caveat written down**: `@media`
      cannot read a custom property, so the list is a register and not a
      mechanism. What is enforceable by review is the rule beside it — **no fifth
      breakpoint**.

      [`DESIGN.md`](DESIGN.md) holds what is not a number: the two-word vocabulary
      (**amber = you can, padlock = you cannot**), five non-negotiable rules, the
      modal system, the dense form, and — the part most likely to earn its keep —
      **how the arguments were settled**: measure instead of debate, read the
      contract from the source and never from the drawing being judged, a count
      without its inventory is not a contract, and a tool may only claim what it
      actually re-runs.

      `tsc` clean, lint 0 errors, build green.

      **Partly done early, on purpose, 2026-09-02: the eleven series colours and
      the eight-colour cycle.** They were taken out of turn because pilots 2 and 3
      cannot inform them — Zones is a collection and Settings a dense form, and
      neither has a chart — so waiting would have added no evidence, only delay.
      They are also the one part of the direction that was settled by measurement
      (`dev/palette-distance.mjs`) rather than by drawing, and they fixed a defect
      that was live: Recursive against Blocked at ΔE00 5.5 in the same doughnut.
      Nothing else has been written: scales, primitives and layout still wait for
      the three pilots.

**No-loss contract for this phase:** the pilots are drawn against the phase-0
contract of those three surfaces. A direction that cannot hold every control of
Blocking, Zones and the Dashboard is not a direction, it is a mood board.

---

## Phase 2 — Primitives

The previous plan handed Claude Design a closed catalogue and told it to reuse.
That is why it kept returning the same panels: the components themselves were
never in scope. Here they are, first.

- [x] **2.1 — Audit `src/ui/` against the phase-1 direction.** For each: keep,
      restyle, or replace. See
      [`direction/fase2-1-auditoria-primitivas.md`](direction/fase2-1-auditoria-primitivas.md).

      **«24 modules» was wrong: there are 25 components, plus 8 shared CSS
      modules with no component of their own** —`count`, `interaccion`, `kv`,
      `list`, `record`, `rotulo`, `text`, `tones`— which are primitive surface
      too. **33 units, not 24.**

      Measured before touching anything: **37 loose px across 12 of the 29
      modules**. Dialog's four widths are not drift: phase 1 confirmed them, they
      were just never declared.

      **Corrected 2026-09-03: `Form`'s 210/180 is NOT drift either, and this
      paragraph called it «the only real drift».** `Form` tells the two apart on
      purpose, keyed on the `modal` prop, and says so in `Form.module.css:23` —
      «inside a modal there is less room and fewer rows: no separator, no 210 px».
      The error was of method, and it repeated: **classified from a grep of loose
      px without opening the file**. The same mistake was made again with
      `Details`'s 12 px chevron, which turned out to have nine call sites across
      five modules, all of them chevrons. Both are written up in
      `docs/direction/fase2-reconciliacion-de-las-15.md`.

      So of the 37 loose px, **the audit found no real drift at all** — which is a
      different and more useful result than «one».

      **Closed: 15 restyle · 18 keep · 0 replace**, each restyle tied to the
      decision that touches it.

      **Reconciled 2026-09-03**, because the phase touched five of the fifteen and
      the other ten cannot just vanish from the inventory:
      `docs/direction/fase2-reconciliacion-de-las-15.md`. It counts by DECISION and
      not by primitive —this audit gave `PanelForm` five of them— so the total is
      **26 decisions: 6 implemented · 7 already complied · 11 deferred · 2 void**.
      Every deferral names a concrete surface of the walk below, never «later». `PanelForm` carries most of the dense form;
      `Panel` and `SectionHeader` take pilot 3's section box and the sub-tab
      strip. That the direction forces **no** primitive to be thrown away is not
      luck: it is what comes of drawing the pilots against these screens'
      contract instead of against a moodboard.

      Four looked like they were touched and are not, and it took reading them to
      know: `Confirm` and `Pagination` already comply with pilot 2, `Menu` had
      *destructive things live inside the menu* written in its own header before
      pilot 2 confirmed it, and `ClusterNodeSelect` already gates itself on
      `clusterInitialized`. `Segmented` is flagged for 2.2, not restyle.

      **Sequencing warning for 2.3:** `dev/uniformity.js` needs its BEFORE
      picture, and it is not taken. It runs in the browser and needs a session on
      the harness. That baseline is taken before the first primitive is touched,
      or 2.3 has nothing to compare against.
- [x] **2.2 — The primitives the audit says are missing.** Decided, each one with
      its reason: [`direction/fase2-2-primitivas-que-faltan.md`](direction/fase2-2-primitivas-que-faltan.md).
      **Two justified, five dropped, one deferred.**

      Justified: **`Tooltip`**, because two phase-1 rules depend on something that
      does not exist —pilot 1's 60 px rail needs the icon's label on hover, and
      pilot 3's padlock has to say WHICH permission is missing— and
      **`SectionIndex`**, which `Segmented` looks like and is not: one picks a
      value, the other moves the scroll.

      Dropped with evidence, not by taste: **skeletons** contradict a phase-1
      decision outright (loading shows the previous data dimmed, *«la tabla no se
      vacía ni se sustituye por esqueletos»*); the **state set** already exists as
      `Empty`/`Loading`/`Failure` in 24 places; **`DataTable`** is `Table` in 18;
      **`Toolbar`** is `.bar`, already shared by Admin and DHCP through
      `composes:`; and **`Stat`** comes from a single pilot, so it is decided in
      phase 3 with the Dashboard in front. **`FilterBar`** waits for phase 4: its
      two real call sites are both Zones.

      **And reading `PanelForm` found two contract defects**, both from the same
      cause — the contract was taken from the DOM with the lists POPULATED, so
      neither the empty branch nor the row button ever travelled. The QPM lists
      already say `No entries.`, so pilot 3's proposed `No limits configured.`
      would REPLACE a literal rather than add one, and it is not adopted. And the
      button that removes a row is `Remove` in Zones' three dialogs and `Delete`
      in `PanelForm`'s `EditableList` — same pattern, two words.

      **Closed 2026-09-02 against upstream** (`ref` instance, :5381), and the
      answer is that **the split is upstream's and we replicate it**: `main.js`
      says `Delete` on the three editable lists —`tableQpmPrefixLimitsIPv4Row`,
      `…IPv6Row`, `tableTsigKeyRow`, exactly `EditableList`'s— and `zone.js` says
      `Remove` on the dialogs' repeatable rows. **Unifying them would have traded
      parity for coherence.** Written up in
      `evidencia/general-dom.json → _paridad_remove_delete`, with the one thing
      not located: `ZonePermissions`'s row upstream — ours says `Remove`,
      consistent with the other two dialogs.
- [x] **2.3 — `dev/uniformity.js` must not regress.** It exists because this
      console once had seven variants of one container. A phase that adds
      primitives is exactly when that happens again.

      **Closed 2026-09-03, and it did its job three times.** The baseline is in
      `evidencia/uniformity-base-fase2.json`, taken BEFORE touching any primitive
      and anchored by the SHA-256 of the tree's diff. **Five** measurements of the
      same 27 routes at 1440 are recorded there, one per change, each attributed
      in isolation.

      Final reading against the baseline: **no unexplained regression**, and
      `settings-checkbox` went **3 → 1**, which the baseline set as the work and
      not as an extra. `campo-num-ancho` stays at 4 signatures, `campo-area-alto`
      at 3, and the other eleven are byte-identical.

      **The claim is «no unexplained regression» and NOT «no family rose», because
      one did.** `aviso` was a single undifferentiated family of 1 signature; split
      by type and taught to measure fill, icon and rendered width, `aviso-info`
      came out at **3** — panel 880, dialog 526, and `/about/` at 270. The third
      was investigated before being accepted and is not drift: that alert lives in
      the 300 px column of an `860px 300px` grid and its literal title is `Note:`
      with a colon, and **it already measured 270 before the change**. One
      signature per type and per CONTEXT is the criterion.

      Saying «no family rose» would have been the easy sentence and it was false.
      A tool whose reading is rounded up to a slogan stops being a tool.

      What it caught, which is the point of having it: a `100px` `<Input>` in
      `Blocking.tsx` that was a **copy of the old default** and invisible while the
      default was 100; a `.info { background: transparent }` that was a **no-op**
      because `composes` adds a class and the tone won on emission order; and a
      sweep that measured the **old bundle** and would have reported a false green.

      The tool was extended BEFORE each change and corrected twice during them —
      it measured a declared `max-width` instead of the rendered width, and its
      `reticula-panel` family caught **any** module's `.row`. Both fixes carry a
      regression and a negative test.

**No-loss contract for this phase:** every existing call site of a changed
primitive keeps its props, its behaviour and its accessible name. A primitive is
migrated with its call sites, not left with two versions in the tree.

---

## Phase 3 onwards — Surfaces, in menu order

**Decided 2026-09-01: the walk follows the navigation menu, top to bottom.** The
reason is operational and it beats the theory: that is how the console is
actually tested. A reviewer opens it and goes down the list; an order that jumps
between sections makes every verification a hunt.

The chrome is not a menu entry and cannot wait its turn — the first screen is
drawn inside it — so it is decided with the first one and revisited when the
narrow case forces it.

**Las doce construidas** a 2026-09-04, más el cromo y Login. **La fase 3 está
cerrada.**

| # | Destination | Archetype |
|---|---|---|
| — | **Shell + Login** | Chrome — decided with #1, since #1 sits inside it · **built 2026-09-03** |
| 1 | Dashboard | Overview · **built 2026-09-03** |
| 2 | Zones *(+ its records view)* | Collection *(+ Detail)* · **built 2026-09-03** |
| 3 | Cache | Collection · **built 2026-09-03** |
| 4 | Allowed | Collection · **built 2026-09-03** |
| 5 | Blocked | Collection · **built 2026-09-03** |
| 6 | Apps *(+ its four dialogs)* | Collection · **built 2026-09-03** |
| 7 | DNS Client | Tool · **built 2026-09-04** |
| 8 | Settings — the nine panes | Dense form · **built 2026-09-03** |
| 9 | DHCP — Leases, Scopes *(+ ScopeForm)* | Collection *(+ Detail)* · **built 2026-09-03** |
| 10 | Administration — Sessions, Users, Groups, Permissions, SSO, Cluster | Collection ×3, **Matrix**, Dense form, Reference · **built 2026-09-04** — [`direction/fase3-construccion-administracion.md`](direction/fase3-construccion-administracion.md) |
| 11 | Logs — View Logs, Query Logs | Tool · **built 2026-09-04** |
| 12 | About | Reference · **built 2026-09-04** — [`direction/fase3-construccion-about.md`](direction/fase3-construccion-about.md). Fue «directa salvo delta», y hubo delta: el flujo de actualización nunca se había contratado |

## Claude Design is not a stop on every surface — decided 2026-09-03

The loop below stays, with one change: **the contract and the validation are
mandatory on all eleven; Claude Design is only involved when a NEW PATTERN turns
up.** Phase 3 is what earned this — the direction is settled, the primitives are
built, and three pilots already drew the three archetypes. Sending a fourth
collection to be designed would be asking for a drawing of something already
decided.

| Surfaces | How they get their design |
|---|---|
| **Zones** and **Settings** | Built straight from **their own accepted pilots**. Nothing new to decide |
| **Cache · Allowed · Blocked · Apps · DHCP** | They **inherit the collection pattern** from pilot 2 |
| **DNS Client** and **Logs** | **One round** between the two: they are the same archetype — tool — and it has no pilot yet |
| **Administration** | **Its own round.** Five archetypes in six sub-screens, and the console's only Matrix |
| **About** | Straight, unless the contract turns up a real delta |

Eleven rounds become roughly **two new ones**.

**When to go back to Design anyway**, and any one is enough: the contract turns up
a **pattern that no pilot drew**, a **contradiction** with the direction or with
upstream, or a **primitive that does not exist**. That is a judgement made with
the contract in hand, not before reading it.

Two cautions, written down because they are what this shortcut can cost:

- **Inheriting a pattern does not waive the contract.** Pilot 2 lost controls
  precisely on screens that "looked the same"; the contract is what caught it.
- **Administration holds the only Matrix**, and this plan already says it will not
  inherit. The round it gets is for that.

**The menu groups the archetypes almost by itself**, which is why the cost of this
order is smaller than it looks: 2–6 are five consecutive collections, and the
nine panes of 8 are all one dense form. The pattern is still solved once and
reused; it just gets solved where the walk happens to reach it.

Two places where it does not, and they are the ones to watch:

- **Administration (#10) holds five archetypes in six sub-screens**, including the
  only Matrix in the console. It will need its own pass rather than inheriting.
- **Dialogs are not a stop on the walk.** Each surface's dialogs come with it —
  Apps brings four, Zones eleven — so the modal system is settled early, on #2,
  and everything after inherits it.

## The loop, per surface

1. **Contract.** `contract()` on ours, every state — and the upstream half with
   `dev/check-parity-controls.mjs`, **not** with `contract()`. Corrected
   2026-09-02: `contract()` looks for a `<main>` and upstream's console is
   Bootstrap 3 and has none, so on `ref` it returns `{error: 'no main element'}`.
   The upstream comparison is list-based and needs no browser: it reads
   upstream's `index.html` against our source.
2. **Prompt.** Template below. The contract goes in whole — what is summarised is
   what goes missing — but **alphabetised, not in screen order**. Upstream is the
   authority on *what* must exist and has no say in *how* it is arranged; passing
   its order along smuggles the old design in through the inventory.
3. **Claude Design.**
4. **Reconcile.** Walk the contract item by item: every control, option, helper
   text, link and state present; nothing added. A miss is resolved with Claude
   Design, not patched in code. **A design that lost a control is not a starting
   point.**
5. **Build**, against the reconciled design and the phase-2 primitives.
6. **Validate** — the matrix, not a glance:

   | | populated | empty | loading | error |
   |---|---|---|---|---|
   | 1440 | | | | |
   | 1024 | | | | |
   | 768 | | | | |
   | 390 | | | | |

   Plus each permission variant from phase 0.3. Plus `contract()` before and after
   producing the same inventory. Plus `npm run typecheck && npm run lint && npm test`.
7. **Commit**, one surface per commit.

---

## The prompt template

````markdown
# Redesign: <SURFACE> — archetype: <ARCHETYPE>

## The rule that governs this console

It replaces the console Technitium DNS Server ships with, and behaviour may not
change. Rearrange, regroup, restyle, change which component carries something,
change density and hierarchy. Do **not** remove a field, drop a helper text,
reword a label, add a step or invent a route.

Tooltips may present a name that already exists — an icon-only button's label, a
truncated value in full. They may not explain anything new or replace a visible
label.

## The direction

<phase 1 output: hierarchy, elevation, state scale, iconography, motion, data
typography>

## The primitives

<phase 2 output: the components, with what each is for>

## This surface

Archetype: <archetype>. What the reader came here to do: <one sentence>.

### What is wrong with it now

<the phase-0 finding, with its measurement and its baseline capture>

### Everything on it, which must all still be there

**An inventory without visual order, and with every relation.** Order and
grouping are what this redesign is being asked to decide, so they are not handed
over as inputs: `contract()` dumps in DOM order, which is the current layout,
which descends from upstream's.

But stripping the order must not strip the meaning. Each entry keeps, attached to
it and not merely nearby:

- its **helper text**, verbatim;
- its **options**, for anything that offers a choice;
- what it **depends on** — the control that enables, disables or reveals it;
- the **actions that operate on it**, bound to the object and not floating.

<contract() v3 output: entries sorted by label, each carrying its help, options,
dependencies, states and actions>

### The states it has to answer for

populated / empty / loading / error, and: <permission variants from 0.3>

### Where upstream differs

<the 0.1 diff for this surface, or "none">

## What to return

A layout for each state, at 1440 and 390, with every item above placed, and one
line per grouping decision saying what holds that group together.
````

---

## What this plan does not do

- It does not schedule the three lost controls of spec F8. They are phase 0.1
  work: the diff against upstream is what finds them and their siblings, and
  restoring them is a parity fix, not a redesign.
- It does not promise a surface count for dialogs until 0.2 is answered.
- It does not plan phases 3–11 in bite-sized steps yet. Each is planned from its
  own phase-0 measurements, because the last time this project planned from
  estimates it planned from counts that were wrong.
