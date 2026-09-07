# Product

## Purpose

An alternative administration console for [Technitium DNS Server](https://github.com/TechnitiumSoftware/DnsServer):
the same API, the same behaviour and the same texts, with the interface rebuilt.

It exists because the server is excellent and its console is the part people meet first. Rebuilding
it is a contained problem — the API is documented and stable, and the console is a static bundle the
server serves from a folder — so it can be replaced without touching anything that resolves.

## The rule the whole thing is built on

> **Design only. Zero functionality.** Any behavioural difference from the stock console is a bug,
> **even when it looks like an improvement.**

Same controls, same steps, same wording, same validation order. A feature that was missing is still
missing. A confirmation that asked twice still asks twice. A literal upstream writes in lower case
stays in lower case.

This is not modesty, it is the only reason it is safe to put a third-party interface in front of
infrastructure: you are changing how the console looks, not what your DNS server does. It is also
what makes the project reviewable — every question of the form "should it do X?" has an answer that
is not an opinion.

## What this project owns

- The **interface**: layout, typography, colour, states, keyboard and screen-reader behaviour, and
  how the same object is drawn on every screen.
- **Real URLs.** Thirty-two of them, one per destination, so a section can be bookmarked and the
  back button walks the console instead of leaving it.
- **Responsiveness.** The console works at 390 px. The stock one overflows horizontally in twelve of
  its sections; this one does not overflow in any.
- **The installer.** `install.sh` puts the console in the server's web root and takes it out again,
  keeping your custom lists and never restarting the DNS service.

## What it refuses to become

- **A second way to configure DNS.** No setting, endpoint, step or validation that the stock console
  does not have. If you want the server to do something new, that is a change to the server.
- **A server.** There is no backend here, no database, no account, and nothing is stored beyond the
  session token the DNS server issues.
- **A telemetry surface.** Nothing is reported anywhere. The only host this console talks to is the
  DNS server it is installed on.
- **A fork of the server.** The
  [pull request](https://github.com/TechnitiumSoftware/DnsServer/pull/2128) that proposed merging it
  was closed, and that was the right call: the maintainer is not a frontend developer and could not
  carry the stack. It ships as an alternative console instead, which is what he suggested.

## Left for later, on purpose

- **Windows.** The installer is Linux only. Windows installs are laid out differently and have their
  own installer.
- **A themed console.** There is one theme, dark, and the tokens that would make a second one
  possible exist, but a light theme has not been drawn and would need its own contrast measurements.
- **Translations.** Every literal is upstream's, in English, and translating them would be the first
  behavioural difference.

## How "the same" is checked

Parity is measured, not asserted. `dev/` brings up **two instances of the official Technitium image
side by side** — one serving this console, one untouched — and compares them: the controls on each
screen, the state the server is left in after real actions, the widths at which something overflows,
the sortable columns, the help texts, the dialogs one by one.

The tools live in the repository and fail with a non-zero exit code, which is the only reason to
trust them. Each one was proved by breaking something on purpose and watching it complain.
