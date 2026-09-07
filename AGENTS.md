# Working on this repository

Notes for whoever comes next, human or agent. The long version is in
[CONVENTIONS.md](CONVENTIONS.md); this is what saves you the first day.

## The rule

**Design only. Zero functionality.** Any behavioural difference from the stock Technitium console is
a bug, even when it looks like an improvement. Before writing anything, find what upstream does:
`../technitium-ui/DnsServerCore/www/` if you have the fork checked out, or the DNS server
repository. Cite the file and line in a comment.

## Read these before touching code

| | |
|---|---|
| [PRODUCT.md](PRODUCT.md) | What this owns and what it refuses to become |
| [CONVENTIONS.md](CONVENTIONS.md) | The rule, the upstream behaviours found along the way, and four server constraints that break production while development looks fine |
| [DESIGN.md](DESIGN.md) | The visual direction on one page |
| `src/theme/tokens.css` | Every colour and spacing decision, each with the measurement behind it |

## Commands that actually check something

```bash
npm run typecheck    # tsc -b.  `npx tsc --noEmit` type-checks ZERO files here
npm test
npm run build
node dev/check-language.mjs
node dev/css-dead.mjs
node dev/check-parity-sort.mjs
node dev/check-sort-fields.mjs
node dev/check-parity-controls.mjs
```

The root `tsconfig.json` is references-only. `npx tsc --noEmit` passes on code that does not compile.

## The harness

`cd dev && docker compose up -d` gives you the official Technitium image twice: this console on
`:5380` and the stock one on `:5381`, both `admin` / `technitium-ui-dev`. When you do not know what
the console should do, open the other one.

It starts empty. Zones, cache entries, apps and DHCP leases have to be seeded through the API, and
the Dashboard needs real queries on port 53 — `dig` from inside the containers, then wait about
twenty seconds.

## Habits this repository has, and they are load-bearing

**A defect found by hand is a sample, not a case.** When something turns up by reading, the next
commit is the tool that finds the rest. That is where most of `dev/` came from, and it has paid:
a sort column dead for a week, a CSS variable silently replacing a token, forty-one Spanish test
descriptions after two sweeps that were declared finished.

**A green tool is not a contract.** Prove a new gate by breaking something on purpose and watching
it fail with a non-zero exit code. If you have not seen it fail, you do not know what it looks at.

**Numbers come from a script, not from the document.** If a figure appears in a commit message or a
document, something produced it and can produce it again.

**Say what you did not do.** A drawing you decided not to follow, an upstream behaviour you chose to
replicate even though it is wrong, a gap you are leaving — write it down with the reason. Half of
`docs/` is that, and it is the half people thank you for.

**English everywhere in `src/`**: comments, identifiers, file names and test descriptions. There is
a gate. It has had three holes so far; if you find a fourth, close it and sweep.
