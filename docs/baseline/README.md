# Phase 0.5 — the baseline

The "before". Every surface as it stands at the end of phase 0, so that a
redesign can be compared against what it replaced rather than against a memory
of it.

## What is captured, and what is not

A full matrix would be 27 destinations × 4 states × 4 widths, plus 40 dialogs and
their states: over six hundred captures, most of them of a screen nobody is about
to redesign. That is inventory, not evidence.

So the baseline is captured **per surface, at the moment that surface is taken
up**, and it is part of its own turn in the loop:

| When | What |
|---|---|
| Now, for the three phase 1 pilots | Blocking, Zones and Dashboard, in every state they can reach in this harness, at 1440 / 1024 / 768 / 390 |
| At each surface's turn | That surface, same rule |

The harness cannot reach every state on every screen — it holds six zones, two
clients, no DHCP leases and no cluster — so a state that cannot be produced is
recorded as unreachable rather than left blank. `dev/defects.js` already exists
to force the error state, and the empty state is what most screens show here.

## Why not capture everything now

Because a capture is only evidence while the screen it shows is current. Twenty
surfaces captured today and redesigned in three weeks are twenty pictures of
something that changed underneath them, and the temptation is then to compare the
new screen against a stale baseline and call the difference progress.


## The retrospective captures (2026-09-07)

Eight surfaces never got their baseline at the moment they were taken up: the five
collections that inherited the archetype in one commit —`Cache`, `Allowed`,
`Blocked`, `Apps`, `DHCP`— plus `DNS Client`, `Settings` and `Logs`. Four of twelve
surfaces had one; the rule this file states was followed for four.

They are reconstructed here, and **they are marked as what they are**:
`retrospectiva-<width>.png`, taken on 2026-09-07 from a build of `3d47e8a` —the
commit before phase 1 landed, which is what "the end of phase 0" means— served by a
throwaway container with a copy of the harness configuration, so the data is the
harness's own.

What a retrospective capture is worth, and what it is not: it is the same code the
"before" would have shown, so it answers "what did this replace". It is **not**
evidence of the moment the surface was taken up —nobody looked at these screens
then— and it cannot show a state the harness could not reach that day. Where a
capture is retrospective the file name says so, which is the only honest way to
keep it next to the ones that are not.
