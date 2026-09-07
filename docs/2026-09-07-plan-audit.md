# The redesign plan, audited against the code

**Date:** 2026-09-07 · **Question asked:** is the initial redesign and screen
restructuring plan actually finished?

> The short answer is yes for the building and no for the loop. Every surface is
> built, on the direction and on the primitives, and the console's own gates are
> green. What was not uniform is the **evidence**: the seven-step loop was applied
> in full to four surfaces out of twelve, and the other eight went through it with
> steps missing. This document says which, and what was done about it.

Nothing here is read off a document. Every line is a measurement against the code
or against the console running in the harness.

---

## 1 · There is only one plan, and it absorbed the other

`2026-09-01-information-structure-plan.md` —"restructure the console's screens, one
at a time, without losing a control"— was **superseded on 2026-09-01** by
`2026-09-01-visual-redesign-plan.md`, which kept the same per-surface loop and
widened the scope from reorganising information to redoing the appearance in full.
There is no second body of pending work: what phase 3 built **is** that
restructuring, done with the wider scope.

## 2 · What was measured, and what it says

| Check | Result |
|---|---|
| Screens and chrome using the phase-2 primitives | **70 of 70**. Not one file left in the old markup. |
| CSS modules with no token | **0 of 49**. Every off-palette colour left is in a primitive or in a comment. |
| Upstream parity (`check-parity-controls.mjs`) | 28 destinations · 112 helps · 94 examples, all present |
| Dead CSS (`css-dead.mjs`) | 0 of 430 classes, and every `composes` resolves |
| Uniformity, 31 routes at 1440 | the fifteen families **identical string by string** to the last recorded sweep |
| Suite / typecheck / lint / language / build | 1,103 · 0 · 0 · 0 · 0 |

## 3 · Where the loop was not applied, and what was done

The plan's loop is seven steps; the two that were skipped are 6 (validate: the
4×4 matrix) and 7 (one commit per surface), plus the baseline the phase-0 file
asks for "at each surface's turn".

| Surface | Design round | Step 6 recorded | Baseline | State now |
|---|---|---|---|---|
| Dashboard + chrome + Login | yes | yes | yes | complete |
| Zones (+ records) | yes | yes | yes | complete |
| Settings — nine panes | yes (pilot 3) | yes | **was missing** | retrospective baseline added |
| DNS Client · Logs | yes (tool) | partial (390 + sweep) | **was missing** | retrospective baseline added |
| Administration — six sub-screens | yes | yes | yes | complete |
| About | contract only | said, not filled | yes | complete |
| **Cache · Allowed · Blocked · Apps · DHCP** | **no** | **no** | **no** | matrix run and baselines added |

**The five collections are the hole.** They went in on 2026-09-03 in a single
commit —`92e8f94`, "inherit the pattern"— whose only validation line is "1019
tests": no widths, no states, no sweep, no captures. It is a legitimate decision
not to send them to Claude Design (the plan says Design only intervenes for a new
pattern) and **not** a legitimate one to skip the validation.

That commit is **not** rewritten. It is recorded here as a historical deviation:
rewriting history to simulate one commit per surface would be inventing a record
that did not happen, which is worse than the deviation.

## 4 · What running the missing validation found

96 cells —six surfaces × four states × four widths— against the harness, with the
list endpoint intercepted to force empty, loading and failure. **No overflow in any
of the 96**, and all 24 failure cells say so with a `role=alert`.

And two defects nobody had seen, both of the family this project hunts — **a screen
answering falsely about the one thing it exists to show**:

- **Cache, Allowed and Blocked had no loading state.** With the request in flight
  they drew "0 zones" and an empty tree, which is what a genuinely empty list
  draws. **And neither did Zones**, which is where the archetype was defined and
  which had its own design round.
- **`Loading` was not announced.** Twenty-nine call sites and no `role="status"`.

Both fixed, with five tests. The evidence, and the failed first sweep, are in
`docs/direction/evidencia/`.

## 5 · What this round leaves behind

Three things that will keep it from happening again, and each exists because
something got through:

- **`dev/check-language.mjs`** — `src/` in English. It was written after finding
  1,098 pieces of Spanish across 67 files while every other gate was green.
- **`dev/css-dead.mjs` now checks `composes`** — a target that does not resolve is
  ignored in silence by the bundler. Four of them were, and the small caps of
  `Matrix` and `Panel` were gone for two commits under four green gates.
- **`ui/Menu` keeps the promise of its role** — the ARIA pattern, implemented in
  the primitive so the twelve call sites get it without knowing.

## 6 · What is still open, and is not this plan's

- The installer's mode B clauses (W2, F3, S2) are measured against a build of the
  fork branch, not a released server. They lose the dagger when upstream merges.
- Publishing the repository is blocked on the identity rewrite, which is reserved
  for the session that publishes.
- Deploying against the house DNS (LXC 101) is Adrián's decision and always was.
