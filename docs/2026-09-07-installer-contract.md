# The installer — contract

**Date:** 2026-09-07 · **Measured with:** `dev/installer-probe.sh` against
`technitium/dns-server:latest` (v15.4.0.0) · **Ratified 2026-09-07** after two
readings — F4, W3, A1, A7 and S2 rewritten in the first, two of them because
they contradicted other clauses, and A2 in the second, because it promised
something no installer can deliver — and **implemented the same day**.

> Read this before touching `install.sh`. The installer is not missing: it was
> written on 2026-09-01 (`b20842d`) and it already does most of what it should.
> What is missing is the contract it has to meet, and a way to say whether it
> meets it. This document is the first; `dev/installer-probe.sh` is the second.

**Where it stands: all twenty-one clauses are met, and all twenty-one probe
cases have been seen passing.** Nineteen of them against the official image, and
the two mode B cases against a server built from the fork branch that carries the
variable — because until that branch is merged, that is the only server there is
that honours it. Building one takes four commands and they are written down in
`dev/README.md`. Those numbers come out of the probe, not out of this paragraph.

The console goes in front of a DNS server that a whole house resolves through.
The installer is the only part of this project that writes to somebody else's
machine, so it is the part that has to be boring.

---

## 1 · What upstream does

Everything in this section is read from upstream's own sources in the fork
(`projects/technitium-ui/`) or measured against the official image. Nothing here
is inferred from documentation.

### 1.1 Where the web root comes from

`DnsWebService.cs:1832` (upstream `master`):

```csharp
builder.Environment.WebRootFileProvider = new PhysicalFileProvider(Path.Combine(_appFolder, "www"))
```

`_appFolder` is the directory of `DnsServerApp.dll` (`DnsWebService.cs:165`), so
the web root is **always a `www` folder next to the binary**. It is not
configurable, it is not in `dns.config`, and nothing in the console can change
it.

Two consequences that the installer lives with:

- The provider is created **once**, at start, from a path string, and resolves
  every request against it. Replacing the folder's contents — even deleting the
  folder and recreating it — is picked up **without restarting the service**
  (probe C11). Changing *which* folder is served is not: that needs a restart.
- Every static file is answered with `Cache-Control: no-cache`
  (`DnsWebService.cs:1977`), and this console's assets are content-hashed on top
  of that. There is no browser-cache problem to warn anybody about.

Dotfiles in the web root are **not served** — `/.technitium-console` answers 404,
a sibling without the dot answers 200. That is ASP.NET's default exclusion of
hidden files, and it matters twice: an in-root marker cannot be verified over
HTTP, and a non-hidden one would be readable by anyone who can reach the login
page.

### 1.2 Installing on bare metal

`DnsServerApp/install.sh`: installs the ASP.NET runtime under `/opt/dotnet`,
downloads `DnsServerPortable.tar.gz`, extracts it into `$dnsDir`, installs ICU,
creates the `dns-server` system user, writes `dns.service` (systemd) or
`/etc/init.d/dns` (OpenRC), and rewrites `/etc/resolv.conf` to `127.0.0.1`.

`$dnsDir` is `/etc/dns` when `/etc/dns/config` exists and `/opt/technitium/dns`
otherwise. That condition is about an **older layout that kept the application
under `/etc/dns`**, not about Alpine: the current image has no `/etc/dns/config`
and Alpine follows the same rule as Debian. The comment in our `install.sh`
saying otherwise is wrong; the folder list it produces is still right.

### 1.3 Updating on bare metal

The same script. An update is `tar -zxf` **over** the installation directory —
an extraction, not a replacement:

> files present in the archive are overwritten; files that are not in it stay
> where they are.

So after a server update a web root carrying this console holds **both**
consoles: upstream's `index.html`, `js/`, `css/` restored on top of our
`assets/`, `admin/`, `zones/`… and the server serves upstream's `index.html`.
The administrator gets the stock console back and a directory of orphans
underneath (measured; the probe rebuilds this state in C3).

### 1.4 Docker

The web root lives inside the image at `/opt/technitium/dns/www`
(`Dockerfile`). An update is a new image, so anything written into the
container's web root is gone. The only layout that survives is a bind mount from
the host over that path — which is what our README tells people to do, and what
`dev/compose.yaml` does.

### 1.5 Windows

`DnsServerWindowsSetup/appinstall.iss`, a different installer with a different
layout. **Out of scope.** The README should say so instead of leaving a POSIX
script to fail on its own.

### 1.6 The custom lists

`www/json/readme.txt` is upstream's own contract with the administrator: any
`<name>-builtin.json` can be overridden by a `<name>-custom.json` written by
hand, the custom file always wins, and the built-in ones are **expected to be
overwritten on update**. Three pairs exist today (`quick-block-lists`,
`quick-forwarders-list`, `dnsclient-server-list`), read at
`www/js/main.js:816`, `:855` and `www/js/dnsclient.js:53`, and by this console
at `src/lib/quick-lists.ts:38`.

It is an **open set by design**: the rule is the naming pattern, not the three
names. The installer must treat it as a glob, and does (probe C4).

These files live in the web root and in no release. Replacing the web root
deletes them, which is the whole reason this clause exists.

### 1.7 The environment variable that does not exist yet

`DNS_SERVER_WEB_SERVICE_WWW_FOLDER_PATH` is twelve lines on the fork's
`feat/configurable-www-folder` branch (`1f097ea1`): it overrides the web root and
falls back to the default when unset or when the folder does not exist, so the
server always starts. The maintainer has said in writing that he will merge it;
the PR is pushed but not opened.

Two facts the installer has to respect:

- **No released server honours it.** Setting it on the official image changes
  nothing: the stock console keeps being served (measured). An installer that
  trusted the variable would install into a folder nobody reads and report
  success.
- It **is** discoverable without credentials: it shows up in the environment of
  the running process (`/proc/1/environ` in the container, the `DnsServerApp`
  process on bare metal), which is where an installer should read it from rather
  than guessing at unit files or compose files.

The PR also had a hole: the variable was **not** in `DockerEnvironmentVariables.md`,
where upstream documents every other one — and that file opens with a NOTE
saying its variables are read only on first start, which is exactly what this
one does not do. Both are fixed before opening: the row is there and the
exception is named.

And the branch has now been **built and run**, which it never had been: a server
from it serves the folder the variable names, falls back with its log line when
the folder is missing, and a console installed into that folder is what answers
(C12, C13). Twelve lines that nobody had executed are not twelve lines that
work; now they are.

### 1.8 Version, without a token

`api/user/checkForUpdate` needs a session. The server prints its version at
startup into `/var/log/technitium/dns/<date>.log`:

```
[2026-09-07 06:03:29 UTC] DNS Server (v15.4.0.0) was started successfully.
```

That is the credential-free source for the version, and it is what the backup
needs in order to know whether it has gone stale.

---

## 2 · Two installation modes

The contract below is written for both, because which one applies is not our
choice — it depends on the server in front of us.

**Mode A — replacement.** The only mode possible today: install over
`<appFolder>/www`, keep a copy of the stock console, restore it on uninstall.
It cannot survive a server update (§1.3), so under this mode an update means the
administrator re-runs the installer.

**Mode B — side by side.** Once the variable lands: install into a folder of our
own, never touch `www`, and let the variable point the server at it. Server
updates stop mattering. This is the mode the project wants, and the reason the
PR exists.

Mode B costs one restart the first time the served path changes, and one when
that change is undone, because the variable is read once at start (S2). Every
reinstall after that costs none, and mode A never costs one at all.

Under systemd the folder must not be under `/home` or `/root`
(`ProtectHome=true` in upstream's unit), and the service reads it fine
everywhere else despite `ProtectSystem=strict`, which is read-only and not
invisible. `/opt/technitium-console` satisfies both.

---

## 3 · The contract

`✓` met and measured. Every clause carries the probe case that decides it; none
is left to a reading of the script. The three mode B clauses carry a `†`: they
are measured against a build of the fork's `feat/configurable-www-folder`
branch, not against a released server, and they stay that way until upstream
merges it.

### Where it installs

- **W1 ✓** (C14) The web root is resolved, in order: `--dir`; the value of the
  variable read from the running server's environment; `www` next to the running
  server's binary; the two known folders as a last resort. It is never assumed
  when the running server can be asked: the process is found by what it runs, in
  `/proc`, and its web root is derived from the path of the `DnsServerApp.dll` it
  was started with. The two known folders are still there, for the case of a
  host preparing a folder for a container, where there is no process to ask.
- **W2 ✓†** (C12) When the running server honours the variable, the console is
  installed where it points and `www` is not touched. Measured: the console
  answers from the folder the variable names, and the stock `www` still holds
  the console the server shipped.
- **W3 ✓** (C15) When the variable is set but the running server ignores it, the
  installer does not install into it. Support is established by **measurement,
  before anything is installed**: write a probe file with an unguessable name
  into the folder the variable names, ask the web service for it, delete it
  whatever the answer, and only then decide. Not by a version number, and not by
  installing first and looking afterwards — an installer that has to undo an
  install to find out where it belongs has already got it wrong. The probe file
  is not hidden, or the answer is a 404 for the wrong reason (§1.1).

  A 404 has two possible causes and they are told apart in the startup log,
  which the fork writes on purpose: *"Web Service is falling back to the default
  web root folder since the folder configured by the
  DNS_SERVER_WEB_SERVICE_WWW_FOLDER_PATH environment variable does not exist"*.
  With that line, the server honours the variable and fell back because the
  folder was missing when it started — create it, install, restart (S2).
  Without it, the server does not know the variable at all, and the console goes
  where it is actually read. The half of this clause that a released server can
  exercise is the refusal, and that is what C15 measures; the other half rides on
  C12.
- **W4 ✓** (C10) A target folder that does not exist is created. Nothing is
  backed up that was never there, which is what used to make the documented
  Docker flow fail before it had installed anything.
- **W5 ✓** (C9) A web root that is a mount point is installed into, in place.
  Nothing ever removes or renames the web root itself — see A1 — so the layout
  the README asks Docker users to create is no longer a special case.

### The administrator's files

- **F1 ✓** (C1, C4) Every `json/*-custom.json` in the web root survives an
  install. The glob is the rule, not the three names that exist today.
- **F2 ✓** (C5) …and survives an **uninstall**, including a list written long
  after the install, which no backup can contain. It is the one command an
  administrator runs expecting to lose nothing. It is kept by never being
  touched: a `*-custom.json` already in place is neither overwritten by a
  restore nor swept away as a leftover.
- **F3 ✓†** (C13) In mode B the lists travel **both ways**, because the web app
  fetches them relative to whatever folder is being served. On install they are
  copied from `www/json` into the console's own folder, and the administrator is
  told that the one to edit from now on is the new one. On uninstall everything
  matching the pattern in the console's folder — including lists written after
  the install, which is where F2 bites again — is copied back to `www/json`
  before the folder goes.
- **F4 ✓** (C16) The installer never modifies the server's data. It writes to exactly
  three places: the web root it is installing into, the backup it keeps, and its
  own state (A5). Everything else — `dns.config`, the zones, the users, the
  logs, `/etc/resolv.conf`, the service unit — is out of bounds, with the single
  exception of the service change in §4, which is offered and confirmed before
  it happens.

  **Reading is not writing.** The environment of the running process, the
  startup log and the unit files are read freely, and W1, W3 and A7 are built on
  exactly that: the way not to guess is to go and look. C16 measures the
  writing half the only way worth measuring it — a checksum of `/etc/dns`, the
  logs, the units and `/etc/resolv.conf` before and after an install and an
  uninstall, which has to come out identical.

### Replacing atomically

- **A1 ✓** (C17) The web root is never observably broken — mount point or not.
  It is also never renamed, moved or removed, and that is a change from how this
  clause was first written: **swapping two directories takes two renames, and
  between them there is no web root at all**, which is precisely what A2 forbids.
  A rename is not an option, it is a shortcut that loses the guarantee. So there
  is one path, in place, and the **order** is what makes it safe:

  1. hashed assets, fonts, images and `json/` first, under their own names;
  2. every `index.html` last, and the entry one last of all;
  3. leftovers of the previous console removed only after that.

  Step 2 is the **publication point**, and each file within it is replaced by a
  write-then-rename so no page is ever half written. What makes the step safe is
  not that it is a single instant — it is not, there is one `index.html` per
  route — but that during it *every* page a request can be handed finds the files
  it names: the new assets are already there and the old ones are not gone yet.
  Whichever version of a page a browser gets in that window, it works.

  C17 measures it at the worst possible moment: a `cp` that fails on every page,
  which stops the run exactly at the publication point. The assets of the new
  console are in, no page has been swapped, and what is being served is the
  previous console, whole.
- **A2 ✓** (C17, C7) **At every moment there is a complete console being served**:
  the previous one before the publication point, the new one after it. That is
  the guarantee, and it is the only one an installer can actually keep — a
  `SIGKILL` or a power cut mid-copy is not a failure it gets to handle, and on a
  mount point it cannot fall back on a rename either.

  So the promise splits in two. A failure the installer **sees** it undoes
  itself, and the previous console is back when it exits. A stop it never sees
  leaves the invariant standing anyway — because of A1's order — plus possible
  leftovers: a staging folder, an orphan of the console being replaced, a state
  file that says a run started. **Those are repaired by the next run**, which
  therefore has to recognise them instead of tripping over them.

  Both halves are measured: C17 stops a run at the publication point and finds a
  whole console still being served, and C7 hands the next run the wreckage of an
  interrupted one and expects it repaired.
- **A3 ✓** (C7) The uninstall keys off the **backup** and the state, never off a
  marker: there is no marker to key off any more (A6).
- **A4 ✓** (C2) Re-running is idempotent, and the backup is taken exactly once:
  a second run must never save this console as "the original".
- **A5 ✓** (C18) The install state — mode, version, web root, backup path, and the
  server version the backup was taken from — lives **outside** the served
  folder, in `/var/lib/technitium-console/`. Bookkeeping in the web root is
  either invisible to the installer (dotfiles 404, §1.1) or visible to the
  internet (non-dotfiles 200). Neither is a reason to put it there.
- **A6 ✓** (C8) The web root holds the console and nothing else — no marker, no
  staging folder, nothing hidden. The staging area lives with the state, so a
  half-finished download is never inside the folder being served.
- **A7 ✓** (C19) When the version recorded with the backup and the running one
  differ, the backup is the console of another server: `--uninstall` **stops**,
  names both versions, and does nothing. Restoring it anyway takes a flag of its
  own —`--restore-mismatched-backup`— and **`--yes` does not grant it**: `--yes`
  means "do not ask me the ordinary question", not "accept an incompatible
  restore". The message names the repair that does not need us at all: re-run
  upstream's own installer, which puts back the console the running version
  ships.

### Fresh install and update behave the same

- **U1 ✓** (C1, C2, C3) The end state is the same whether the target is the
  stock console, an older build of this one, or the hybrid a server update
  leaves behind (§1.3). No leftovers of the console being replaced.
- **U2 ✓** (C20) The hybrid is detected and named. An administrator whose
  console reverted after a server update is told what happened — and told in the
  same breath that the backup is older than the server now running, which is the
  fact A7 will stop them on later.

### The service and the browser

- **S1 ✓** (C11, C21) Installing does **not** restart the DNS service. C11
  measures the premise — with the service running and never restarted, a full
  replacement of the web root is served immediately — and C21 measures the
  clause, with a `systemctl` of its own that records being called and never is.
  A restart is a resolution outage for everything behind this server; it is not
  spent on copying files.
- **S2 ✓†** A restart happens **only when the path being served or the
  environment changes**, because the file provider is built once at start
  (§1.1). That is the first install into the variable's folder and the uninstall
  out of it — not a property of mode B: a later reinstall into the same folder,
  with the environment untouched, restarts nothing — which is what C12 and C13
  show by installing, reinstalling and uninstalling against a server that was
  never restarted once. When one is needed the installer names the change that
  requires it and asks first.
- **S3 ✓** (C21) No "press Ctrl+F5" advice: every static file is `no-cache` and the
  assets are hashed (§1.1). Advice that is not true trains people to ignore the
  rest.

---

## 4 · Not the installer's job

- **Windows.** Say so; do not fail at it (§1.5).
- **Installing or updating the DNS server itself.** If it is not there, stop.
- **Editing the service unit.** Mode B needs an environment variable set, and
  the clean way is a systemd drop-in
  (`/etc/systemd/system/<unit>.d/technitium-console.conf`) that upstream's own
  unit never sees and that the uninstall deletes. It is still a change to how
  the administrator's service starts, so it is **offered and confirmed**, never
  silent, and never on OpenRC or Docker, where the equivalent belongs to
  `/etc/conf.d/dns` and to the compose file — the installer prints those and
  stops.
- **SELinux relabelling, distro packages, and updating the console by itself.**
  Not now, and each would need its own contract.

---

## 5 · How it is checked

```sh
npm run build && sh dev/installer-probe.sh   # exit code = cases that failed
```

Twenty-one cases, one throwaway container each, off the official image, so every
case starts from the same stock console and nothing on the machine running it is
touched. Every clause that can be decided by a machine has one, which sometimes
means building the situation rather than waiting for it: C14 starts a server from
a folder neither known path points at, C16 lets one run once and stops it so
`/etc/dns` can be compared byte for byte, C17 installs a `cp` that fails on every
page so the run dies exactly at the publication point, and C21 installs a
`systemctl` whose only job is to record having been called.

C12, C13 and C15 depend on what the image can do, and the probe does not decide
that by decree: it **detects the capability** the same way W3 says the installer
must — it starts the image with the variable pointing at a folder holding a probe
file, asks the web service for it, and believes the answer. Against
`technitium/dns-server:latest` the answer is no, so C12 and C13 stand down and
C15 runs, which is the refusal case. Against a build of the fork branch the
answer is yes, and it is the other way round.

Both sides have been run. Nineteen cases pass against the official image, and
twenty against `technitium-dns-server:wwwvar`, built from the branch in four
commands (`dev/README.md`). Nothing here is a case that has never been seen
passing.

The gate for the installer round is the same as every other round in this
project: **the probe at zero on both images** — met on 2026-09-07, nineteen
cases against `technitium/dns-server:latest` and twenty against a server that
honours the variable. What is left is not a measurement: it is upstream merging
the branch, at which point the `†` comes off W2, F3 and S2 and the image stops
having to be built by hand.

---

## 6 · What contracting it found, and what the implementation did

Five of these were failures the probe caught the day the contract was written.
All five are fixed; the last two are notes, not code.

- The README documented a Docker flow that did not work — `--dir` on a folder
  that did not exist installed nothing (W4).
- `--uninstall` destroyed exactly the files the installer goes out of its way to
  preserve, when the administrator had written them after installing (F2).
- The installer restarted the DNS server for no reason (S1) and told the
  administrator to bypass a browser cache that is not there (S3).
- A run that died between the wipe and the copy left no console at all and
  locked the way back (A2).
- Bookkeeping lived in the folder the server serves (A5, A6).

And one thing the implementation found that the contract had got wrong: **A1's
rename shortcut is not available**. Swapping a staged tree for the old one takes
two renames, and between them there is no web root — the exact state A2 says can
never exist. So there is no rename path at all, on any filesystem: one order, in
place, everywhere. The clause was rewritten rather than the guarantee weakened.

None of the five were visible from the code alone; all came out of running the
installer against a real server. Which is the same lesson About left, in a
different costume: **a script that has never been run against the thing it
manages is a draft, not a tool.**
