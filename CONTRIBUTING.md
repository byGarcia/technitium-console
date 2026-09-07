# Contributing

Thanks for being here. Before proposing anything, read [PRODUCT.md](PRODUCT.md) and then the first
section of [CONVENTIONS.md](CONVENTIONS.md), because this project has one rule that decides most
questions before they are asked:

> **Design only. Zero functionality.** Any behavioural difference from the stock Technitium console
> is a bug, **even when it looks like an improvement.**

If your idea makes the console *do* something new, it is a change to
[Technitium DNS Server](https://github.com/TechnitiumSoftware/DnsServer) and not to this. If it
makes the console *look* or *behave as an interface* better — clearer, faster to read, reachable
from a keyboard, correct at 390 px — it belongs here and it is welcome.

Bug fixes, documentation and accessibility fixes need no permission. Open the pull request.

---

## Running it

**You need Node 22 or newer and Docker with the Compose plugin.** The package manager is **npm**, on
purpose: building this must need nothing installed beyond Node.

```bash
npm install
npm run dev          # Vite, on http://localhost:5173
```

The development server needs a real DNS server to talk to. The harness brings up two:

```bash
cd dev && docker compose up -d
```

- `http://127.0.0.1:5380` — the official image, serving **this** console out of `dist/`
- `http://127.0.0.1:5381` — the official image, untouched, serving the **stock** console

Log into either with `admin` / `technitium-ui-dev`. Having both side by side is the whole method:
when you are not sure what the console should do, you go and look at the one next door.

A fresh harness has no traffic, so the Dashboard is empty until you make some. `dig` from inside the
containers, wait about twenty seconds for the stats to settle, and it fills up.

## Before you open the pull request

```bash
npm run typecheck    # tsc -b — NOT `npx tsc --noEmit`, which checks nothing here
npm run lint
npm test
npm run build
node dev/check-language.mjs      # src/ is English: names, comments, tests
node dev/css-dead.mjs            # dead classes, unresolved composes, classes that do not exist
node dev/check-parity-sort.mjs   # upstream's sortable columns against ours
node dev/check-sort-fields.mjs   # every <Th field> names a key that exists
node dev/check-parity-controls.mjs
```

`npm run typecheck` and not `npx tsc --noEmit`: the root `tsconfig.json` is references-only, so the
bare command type-checks zero files and passes happily. That cost a real bug once.

## What a good change looks like

**It cites upstream.** The `www/js/*.js` and `index.html` of the DNS server are the specification.
A comment saying `apps.js:130-131` is worth more than a paragraph of reasoning, and it is how the
next person checks you.

**It measures instead of asserting.** This repository has a habit: when a defect is found by hand,
the next commit is the tool that finds the rest of them. If you fix one dead sort field, the
interesting question is how many others there are.

**It says what it did not do.** A drawing, a plan or an upstream behaviour you decided *not* to
follow is worth writing down with the reason. Half the useful documentation in `docs/` is that.

**Its comments explain why.** Not what the code does — what was tried, what broke, what the numbers
were. If a value was chosen by measurement, the measurement goes in the comment.

## Tests

Vitest and Testing Library. Query by what a person sees — the label, the role, the text — and not by
a class name, because a class name is exactly what a redesign changes.

Test descriptions are English, like everything else in `src/`, and there is a gate that enforces it.

## Style

- Comments, identifiers, file names and test descriptions in **English**.
- No new dependency without a reason in the pull request. The kit is deliberately small: React,
  Chart.js and Radix's dialog and select.
- CSS Modules with the tokens in `src/theme/tokens.css`. A raw colour or a raw pixel value in a
  component is a defect the tools will find.
- Before adding a primitive to `src/ui/`, check whether one already does it. Most of them exist
  because the same thing had been written four times with four looks.

## Reporting a bug

Say which version — the About screen has both the console's and the server's — what you did, what
happened, and what the stock console does instead. That last one is usually the whole report: if the
two differ, this one is wrong by definition.

Security problems do **not** go in an issue. See [SECURITY.md](SECURITY.md).
