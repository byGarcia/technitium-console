# Prompt — Phase 1.1: audit the direction this project already has

> Paste into Claude Design, in the technitium-console project. It is an **audit**,
> not a design task: nothing is to be invented here. Its output is the input to
> the pilots.

---

## What I am asking for

This project already contains a visual direction. I want it **stated explicitly**,
as rules I can hold you to later — not as adjectives.

Read the project as it stands and answer from what is in it. Where it has not
decided something, say so plainly instead of filling the gap. **Do not design
anything in this pass.** An invented answer here would quietly become the
direction, and the point of the exercise is to find out what the direction
already is.

## What this has to cover

The console it dresses is larger than what the project currently shows, so the
audit is against that whole. For each of the following: what does the project
already decide, where is it decided, and how consistently is it applied?

**Structure**
- Hierarchy: what makes the reader look at one thing before another — size,
  weight, space, or border? Are there two levels of the same object that look
  alike?
- Surface and elevation: what floats (dialog, menu, tooltip) versus what sits
  (panel, row)? Is there one language for that, or several?
- Density: what is the spacing scale, and does it change between a form and a
  table?

**Behaviour made visible**
- Interactive states: hover, focus-visible, active, disabled, loading, error,
  selected. Is there one scale, applied to every control?
- The four data states: populated, empty, loading, error. Does the project say
  what each looks like, and are empty and error distinguishable? (They must be:
  "no data" and "the request failed" are the same picture and opposite meanings.)

**Language**
- Typography: the scale, the weights, and specifically **data typography** —
  figures and identifiers, whether they are monospaced, tabular, aligned where
  compared.
- Colour: the palette, and which colours carry meaning rather than decoration.
  In this console red already means destructive and nothing else.
- Iconography: one family, one stroke, one weight, one size scale — or not?
- Motion: what moves, when, and does it respect reduced motion?

**Reach**
- Responsive: which widths does the project actually decide for? This console is
  verified at **1440, 1024, 768 and 390 px**, and the mobile case matters because
  an administrator often opens it on a phone, when something has stopped
  resolving.

## What to return

Two lists, and nothing else.

**1. What this project already decides.** One line per rule, each with where it is
decided and how consistently it holds. Concrete: "panels sit on a 1 px border, no
shadow" rather than "clean and modern".

**2. What it does not yet answer**, for a console of this size. This is the more
useful list. The shapes it will have to dress, which fight each other:

| Archetype | Example | What it has to solve |
|---|---|---|
| Chrome | sidebar, page footer, drawer | Always in sight, never in the way |
| Overview | a dashboard of 11 figures and 4 charts | Many numbers read at once, nothing edited |
| Dense form | a settings pane of 54 controls across 10 groups | Reaching one group without paging through nine |
| Collection | a 10-column table with per-row actions | Scale set by data, not by layout |
| Matrix | a permissions grid, edited elsewhere | The same control repeated hundreds of times |
| Tool | ask a question, read an answer | Input and output on one screen |
| Detail | one record opened from a collection | Depth without losing the way back |
| Dialog | 42 of them, the densest surfaces here | A task interrupted by another |

For each gap, say what the project would need to decide. **Do not decide it yet.**

## What not to do

- Do not propose a new direction, a new palette or new components.
- Do not redesign any screen.
- Do not treat the current React implementation as the direction: it is one
  reading of this project, and where they disagree the project is the reference.
- Do not look to the console being replaced for anything visual. It is a
  functional specification only.
