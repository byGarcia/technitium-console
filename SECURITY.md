# Security policy

This console is installed **in front of a DNS server**, which is usually the piece of
infrastructure everything else on a network depends on. It holds an administrator session, it can
change resolution for every client behind it, and `install.sh` runs as root on the machine the
server runs on. Reports are welcome and taken seriously.

## What this project is, and what it is not

The console is a **static front end**. It has no server of its own, no database and no account: it
talks to Technitium DNS Server through its documented `/api` endpoints, with the token the server
issues at login, and it stores nothing but that token in the browser.

That means a whole class of report belongs upstream and not here:

- anything about how the DNS server authenticates, authorises or resolves;
- anything about the `/api` endpoints themselves;
- anything reachable without this console installed.

Those go to
[TechnitiumSoftware/DnsServer](https://github.com/TechnitiumSoftware/DnsServer/security). What
belongs here is anything this console does that the stock console does not.

## Supported versions

There are releases, and `install.sh` fetches the latest by default. **The supported version is the
latest release, plus `main`.** There is no back-porting: a fix lands on `main` and goes out in the
next release.

## Reporting a vulnerability

**Do not open a public issue, a pull request or a discussion.**

Use GitHub's private vulnerability reporting, which is enabled on this repository:

> **[Report a vulnerability](https://github.com/byGarcia/technitium-console/security/advisories/new)**
> — or the *Security* tab → *Advisories* → *Report a vulnerability*.

The thread is private between you and the maintainer, and it becomes the advisory if the report is
confirmed. If you would rather not use GitHub, say so in a public issue **without any detail** and a
private channel will be arranged.

### What helps

- The version — a release tag, or the commit SHA from the About screen.
- The Technitium DNS Server version, which the same screen shows.
- Whether the console was installed with `install.sh` or by hand, and to which path.
- Steps, and what an attacker gets out of it.

### What to expect

- **Acknowledgement within a week.** This is a single-maintainer project, not a company.
- An assessment, and a fix or a reasoned refusal.
- Credit in the advisory if you want it.

There is no bounty.

## Things worth knowing before you report

- **The token lives in `localStorage`.** So does the stock console's. That is a deliberate parity
  decision, not an oversight: this console is not allowed to change how sessions behave.
- **`install.sh` runs as root and writes to three places**: the server's web root, its own backup,
  and `/var/lib/technitium-console`. It never restarts the DNS service. If you find it writing
  anywhere else, that is a bug and a serious one.
- **Piping a script from the internet into `sudo sh`** is the documented install path and it is a
  real trade-off. Download it, read it, run it — the file is 470 lines of POSIX shell and it is
  meant to be read.
- **The console is served by the DNS server's own web service**, so its TLS, its bind address and
  its authentication are the server's. Nothing here changes them.
