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
> (or the *Security* tab → *Advisories* → *Report a vulnerability*).

The thread is private between you and the maintainer, and it becomes the advisory if the report is
confirmed. If you would rather not use GitHub, say so in a public issue **without any detail** and a
private channel will be arranged.

### What helps

- The version: a release tag, or the commit SHA from the About screen.
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
- **`install.sh` runs as root.** It writes only to the selected console folder, a replacement-mode
  backup, `/var/lib/technitium-console`, and, on a managed systemd install, its own
  `/etc/systemd/system/<unit>.d/technitium-console.conf`. The first managed install and its
  uninstall restart the detected unit once to change folders; updates do not. It will only write
  into a folder that is empty, holds a Technitium console, or is the one it recorded installing
  into. It only believes a running server started by root or by the service's own account, does not
  write through symbolic links it found by itself, and removes only an unchanged drop-in it owns.
  `--uninstall` only removes the recorded folder while it still holds this console. A release
  download is checked against the `.sha256` the release publishes; `--from` is not, and says so. If
  you find it writing anywhere else, that is a bug and a serious one.
- **Piping a script from the internet into `sudo sh`** is the documented install path and it is a
  real trade-off. Download it, read it, run it. The file is POSIX shell and is meant to be read.
- **The console is served by the DNS server's own web service**, so its TLS, its bind address and
  its authentication are the server's. Nothing here changes them.

## Installer filesystem boundary

The installer accepts only root-owned console, backup and state trees, with no
group or other write bits on files or directories, including every ancestor.
It rejects links, special files and newline-containing names before root copies
or cleanup. It refuses unsafe ownership instead of trying to repair it while
another account may still hold writable files open. Use a dedicated root-owned
folder created afresh or a console volume mounted read-only in the DNS server. Custom-list
migration has the same source and destination requirements.

These checks assume local filesystem ownership and mode enforcement. A remote
filesystem whose server can change those objects is a separate trust boundary.
DNSSEC private-key submissions use POST form bodies, keeping PEM values out of
request URLs. Logout and expiry cleanup use the affected session's token, even
when another tab has replaced the token in shared browser storage.
