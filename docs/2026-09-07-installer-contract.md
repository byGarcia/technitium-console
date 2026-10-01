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

> **2026-09-30.** The security audit of that day (`docs/2026-09-30-audit-v15.5.md`)
> found three ways the installer could remove what is not a console. They are
> now clauses W6, W7 and A8, with a fourth, I1, for the download itself: twenty-five
> clauses and twenty-five cases. Measured against `technitium/dns-server:latest`
> (v15.5.1, which honours the variable): **24 met, 0 not met, 1 not applicable**
> (C15). C22 to C25 were first seen failing against the `install.sh` of `HEAD`.

> **2026-10-01.** Docker gets an install path of its own: an init image that
> copies the console into a volume the official server mounts
> (`docs/2026-10-01-docker-install-spec.md`). Four clauses for it, D1 to D4, an
> amendment each to W6 and I1, and five cases, C26 to C30, with C11 extended:
> thirty cases. And a correction the same day: the variable is upstream's since
> v15.5 (§1.7), so the official image honours it, the fork build the 2026-09-07
> status relies on is not needed any more, and the `†` has come off W2, F3 and
> S2.

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

*2026-10-01:* that was upstream before v15.5. Since v15.5 the provider is built
from the folder `DNS_SERVER_WEB_SERVICE_WWW_FOLDER_PATH` names when it is set
and the folder exists, and from `www` next to the binary otherwise
(`DnsWebService.cs:1805-1816` at the `v15.5.1` tag; §1.7). It is still not in
`dns.config`, and nothing in the console can change it. What follows holds for
whichever folder is served; at `v15.5.1` the `no-cache` line is `:1950`.

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
container's own files is gone with the next recreate — which is what
`docker exec <c> sh -c "curl … | sh"` installs into, and the installer now says
so when it does (C11).

*2026-10-01:* two layouts survive. Since v15.5 the variable can point at a
volume or a bind mount, and that is the one the README gives Docker users: an
init image, `ghcr.io/bygarcia/technitium-console`, copies the console into a
volume that the server mounts read-only (D1–D4). Before 15.5 the only one is a
bind mount from the host over `www`, which is what `dev/compose.yaml` does for
development. The previous wording — "the only layout that survives is a bind
mount over that path" — stopped being true with 15.5.

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

### 1.7 The environment variable

*2026-10-01:* it is upstream's since **v15.5 (2026-09-19)**: `CHANGELOG.md:10`
at the `v15.5.0` tag, "Added new `DNS_SERVER_WEB_SERVICE_WWW_FOLDER_PATH`
environment variable … PR #2138", and v15.5.1 carries it.
`DnsWebService.cs:1805-1814` at `v15.5.1` reads it, uses `www` when it is unset,
and when the folder does not exist writes the log line W3 quotes and falls back
to `www`. Upstream documents it in `EnvironmentVariables.md:11`, a file of its
own for variables read on every start, whose note says that changing one needs a
restart — not in `DockerEnvironmentVariables.md`, as the PR had it. **The
official image honours it since v15.5**: the probe measured it against
`technitium/dns-server:latest` (v15.5.1) on 2026-09-30, and C12 and C13 ran and
were met against it. What follows is this section as written on 2026-09-07, when
the variable did not exist in any release; its first bullet is true only of
servers before 15.5, and the installer still does not trust a version number for
it (W3).

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
administrator re-runs the installer. *2026-10-01:* no longer the only mode since
v15.5 (§1.7). It is what the installer does when the variable is not set, and
the only mode on a server before 15.5.

**Mode B — side by side.** Once the variable lands: install into a folder of our
own, never touch `www`, and let the variable point the server at it. Server
updates stop mattering. This is the mode the project wants, and the reason the
PR exists. *2026-10-01:* the variable landed in v15.5 (§1.7). Mode B is what any
server from 15.5 on gets once the variable is set (W2), and it is the layout of
the Docker image (D1–D4).

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
merges it. *2026-10-01:* upstream released it in v15.5 (§1.7), and C12 and C13
were met against the official v15.5.1 on 2026-09-30, so the `†` has come off
the three.

### Where it installs

- **W1 ✓** (C14) The web root is resolved, in order: `--dir`; the value of the
  variable read from the running server's environment; `www` next to the running
  server's binary; the two known folders as a last resort. It is never assumed
  when the running server can be asked: the process is found by what it runs, in
  `/proc`, and its web root is derived from the path of the `DnsServerApp.dll` it
  was started with. The two known folders are still there, for the case of a
  host preparing a folder for a container, where there is no process to ask.
- **W2 ✓** (C12) When the running server honours the variable, the console is
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
  C12. *2026-10-01:* since v15.5 it is the other way round. A released server
  honours the variable and rides on C12, and the refusal needs a server before
  15.5: C15 is not applicable against `technitium/dns-server:latest`, and runs
  against an older image given with `IMAGE=` (§5).
- **W4 ✓** (C10) A target folder that does not exist is created. Nothing is
  backed up that was never there, which is what used to make the documented
  Docker flow fail before it had installed anything.
- **W5 ✓** (C9) A web root that is a mount point is installed into, in place.
  Nothing ever removes or renames the web root itself — see A1 — so the layout
  the README asks Docker users to create is no longer a special case.
- **W6 ✓** (C22) *2026-09-30.* The installer writes only into a folder it can
  show is a console, because publishing sweeps, as root, everything the release
  does not ship. The folder has to be missing, empty, the one its own state says
  it installed into, the stock console (an `index.html` titled *Technitium DNS
  Server* next to `js/main.js` and `json/readme.txt`, true of every release since
  v11, and of the hybrid of §1.3), or this console (an `index.html` that mounts
  `#root` and names an `assets/*.js` that is there). Anything else stops the run
  before anything is written, with or without `--yes` and with or without a
  TTY. Before this, `--dir /opt/technitium/dns` by mistake removed the server's
  binaries and configuration, with no backup — there was no `index.html` to back
  up — and without asking, because `curl … | sudo sh` has no TTY to ask on.
  *2026-10-01* (C28): a folder holding nothing but `json/` and
  `json/*-custom.json` counts as empty. Publishing neither overwrites nor sweeps
  those files, so there is nothing in it to lose, and it is how a host folder
  for the Docker image is prepared with lists written by hand before the first
  run. One file of any other kind beside them and the folder is refused as
  before (C22; C29, lists and `notes.txt`). The amendment is not measured yet:
  the `✓` above is C22's, and W6 is re-measured with it in Task 6 of
  `docs/2026-10-01-docker-install-plan.md`.
  *2026-10-01* (C22, `--dir /`): `--dir /`, or any path that resolves to the
  root folder, is refused. It used to resolve to no folder at all, and no
  folder means "ask the server", so the console went into the server's web
  root, which nobody had asked for.
  *2026-10-01* (C22, a refused run): a run W6 stops leaves no trace outside
  the folder either. What the sweep may remove is listed in a temporary folder
  of the run's own, and the staging folder, with the state folder around it,
  is made only once W6 has let the run through; a run that made the state
  folder and stops before writing any state removes it on the way out.
- **W7 ✓** (C23) *2026-09-30.* The running server is **identified**, not
  matched. A command line ending in `DnsServerApp.dll` makes a process a
  candidate; it is believed only when every uid it runs as (read from
  `/proc/<pid>/status`, not from the owner of `/proc/<pid>`) and the owners of
  its `DnsServerApp.dll`, of the folder holding it and of that folder's `www` are
  root or the service's account — `dns-server`, which upstream's installer has
  used since v15.0, or the `User=` of the unit that runs the server. Candidates
  that fail are named and ignored; a process in another root filesystem (a
  container seen from its host) is not a candidate. Two believable servers with
  different web roots stop the run, listing both and asking for `--dir`. A web
  root the installer found by itself is refused if any folder on its path, its
  backup, or any folder inside it is a symbolic link; a path given with `--dir`
  is resolved once and every later step, the state included, uses the resolved
  one.

### The administrator's files

- **F1 ✓** (C1, C4) Every `json/*-custom.json` in the web root survives an
  install. The glob is the rule, not the three names that exist today.
- **F2 ✓** (C5) …and survives an **uninstall**, including a list written long
  after the install, which no backup can contain. It is the one command an
  administrator runs expecting to lose nothing. It is kept by never being
  touched: a `*-custom.json` already in place is neither overwritten by a
  restore nor swept away as a leftover.
- **F3 ✓** (C13) In mode B the lists travel **both ways**, because the web app
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
  *2026-10-01:* one exception, in the Docker image's volume only: the marker
  `.technitium-console` at its root (Docker, D1). It is a dotfile, so it is
  never served (§1.1), and the init reads it from the filesystem, not over
  HTTP. No uninstall keys off it (A3): `--into-volume` has no uninstall.
- **A7 ✓** (C19) When the version recorded with the backup and the running one
  differ, the backup is the console of another server: `--uninstall` **stops**,
  names both versions, and does nothing. Restoring it anyway takes a flag of its
  own —`--restore-mismatched-backup`— and **`--yes` does not grant it**: `--yes`
  means "do not ask me the ordinary question", not "accept an incompatible
  restore". The message names the repair that does not need us at all: re-run
  upstream's own installer, which puts back the console the running version
  ships.
- **A8 ✓** (C24) *2026-09-30.* `--uninstall` acts on the folder **on record**
  (`webroot` in the state), not on the one the server points at now. They differ
  when the variable was removed and the server restarted before uninstalling,
  and then the installer says so and leaves the current one alone. In mode B the
  recorded folder is removed only if it still holds this console, and never when
  it is the server's own `www`; before this, that `rm -rf` went to whatever
  folder was resolved at the time — the stock console, in the case above. In
  mode A the restore is held to W6.
  *Same night (1.1.1):* removing it has to finish when the folder is a mount
  point, as it is in the Docker layout. It is emptied and then removed if it can
  be; if it cannot, it stays empty and no restart is offered, because with the
  variable still set the server would serve an empty folder. Found installing
  1.1.0 from the published release; C13 now checks the uninstall's exit code on
  its bind-mounted folder, which it had not.

### Fresh install and update behave the same

- **U1 ✓** (C1, C2, C3) The end state is the same whether the target is the
  stock console, an older build of this one, or the hybrid a server update
  leaves behind (§1.3). No leftovers of the console being replaced.
- **U2 ✓** (C20) The hybrid is detected and named. An administrator whose
  console reverted after a server update is told what happened — and told in the
  same breath that the backup is older than the server now running, which is the
  fact A7 will stop them on later.

### What it installs

- **I1 ✓** (C25) *2026-09-30.* A release download is checked against the
  `technitium-console.tar.gz.sha256` the release publishes next to it
  (`.github/workflows/release.yml`). A mismatch, or no checksum at all, stops the
  run with nothing changed. `--from` is not checked, because there is nothing to
  check it against, and the output says so. It is an integrity check against a
  broken or altered download, not a signature: whoever can publish a release can
  publish its checksum. The archive is unpacked with `--no-same-owner`, so the
  staging copy belongs to root whatever the tarball says; the probe does not
  measure that half, because what reaches the web root is written by `cp` as
  root either way.
  *2026-10-01* (C26; C29, bad or missing checksum): with `--into-volume`, the
  Docker image's mode, `--from` is checked after all: the `.sha256` next to the
  tarball is required, and a mismatch or a missing one stops the run with
  nothing written, as above. The image carries the release's checksum, so D4
  holds when the image runs as well as in CI. The amendment is not measured
  yet: the `✓` above is C25's, and I1 is re-measured with it in Task 6 of
  `docs/2026-10-01-docker-install-plan.md`.

### Docker

The init image runs `install.sh --into-volume /target` on the tarball it
carries, into a volume the official server mounts read-only at the folder its
`DNS_SERVER_WEB_SERVICE_WWW_FOLDER_PATH` names. Inside that run the folder is
given, not looked for: there is no server to find, so W1, W3 and W7's
identification have nothing to do, and the folder is installed into side by
side, with nothing backed up. W4 gives way: `/target` has to be a mount point,
not a folder to create (C29). The rest of the clauses above still apply inside
that run, notably W5, W6, W7's links, F1, F4, A1, A2, A4, U1, S1 and I1 as
amended.

One thing is the init's own. Its state (A5) lives in its container's layer and
goes with it, so the record that the volume is the console's lives in the
volume: after every check has passed and before the first file is copied, the
init writes `.technitium-console` at the volume's root, and `--into-volume`
accepts a volume that holds it as its own (W6). That is what lets A2's repair
half hold in the init: a first copy interrupted halfway leaves assets and no
`index.html`, which W6 alone would refuse forever, and the next run of the init
— the next `up`, or the next update — finds the marker and finishes it (C29,
interrupted first copy, then re-run). The marker stays; it is the one exception
to A6.

These four are what the layout adds.

- **D1** (C29) **The init never keeps the DNS server from starting.** The
  compose block the README gives has no `depends_on` from the server on the
  init, and the init neither looks for the server nor waits for it. When the
  init fails a check — a folder W6 refuses, no volume mounted at `/target`, a
  bad or missing checksum (C29, bad or missing checksum) — it stops before
  publishing, exits non-zero having written nothing into the volume, not even
  the marker, and the server starts all the same and serves whatever the volume
  holds: a whole console on an update, nothing on a first install. A failure
  during the copy leaves A1's order in force, as D2 says: on an update, a whole
  console is served throughout; on a first install, nothing yet, and the next
  run finishes it (the marker, above). Nothing on a first install is also what
  is served for the second or two before the init's first publication point:
  A2 is about replacing a console, and on a first install there is none yet to
  keep serving. Not covered: a first `docker compose up` has to be able to pull
  both images, which is the registry's business, not the installer's.
- **D2** (C27) **Updating the console does not restart the DNS server.** The
  documented update, `docker compose pull technitium-console && docker compose
  up -d technitium-console`, recreates the init only: the server's `StartedAt`
  does not change and the new console is served at once (§1.1). Bringing the
  whole file up again, with nothing about the server changed, does not touch it
  either. An update that fails leaves the server alone too, and a whole console
  served: the init stops before writing (I1, W6), or mid-copy with A1's order
  in force. A plain `docker compose pull && docker compose up -d` also updates
  the server when upstream has a new image, and that restart is the server's,
  not the console's; the README says which command does which.
- **D3** (C28) **Custom lists in the volume survive.** Every
  `json/*-custom.json` in the volume survives an update of the console and a
  `--force-recreate` of the server, and so does one in a host folder bound in
  its place (C28, bind folder, update and `--force-recreate`). A host folder
  holding only such lists before the first run is accepted (W6); one holding
  them and any other file is refused (C29, lists and `notes.txt`), and D1 says
  what the server does then.
- **D4** (C26, and CI) **The image carries the release's tarball, byte for
  byte.** CI downloads it from the release it has just published, checks it
  against the release's `.sha256` before building, and after pushing checks it
  again inside each of the three platforms (`.github/workflows/release.yml`, job
  `image`). The init checks it once more when it runs (I1). C26 measures the
  local half: the image built from `dist/` carries the tarball it was built
  with. A check that fails before building stops the job with nothing pushed.
  One that fails after pushing turns the job red with the tags already out, and
  the init's own check is what stands between those bytes and a volume.
  Re-running the `image` job on its own downloads the same bytes again, so it
  only helps a failure that was transient — the network, the registry. A release
  asset that does not match its own `.sha256` fails the same way every time, and
  needs a new release. Never the whole workflow on a published tag: it would
  rebuild the tarball under it with other bytes and another checksum.

### The service and the browser

- **S1 ✓** (C11, C21) Installing does **not** restart the DNS service. C11
  measures the premise — with the service running and never restarted, a full
  replacement of the web root is served immediately — and C21 measures the
  clause, with a `systemctl` of its own that records being called and never is.
  A restart is a resolution outage for everything behind this server; it is not
  spent on copying files.
- **S2 ✓** A restart happens **only when the path being served or the
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
  stops. *2026-10-01* (C30): on a Docker host it reads `docker inspect` and the
  startup log through `docker exec`, and prints the exact change for each
  container — the way in, and with `--uninstall` the way out — with the
  container, service, file and volume names it found, and exits 0. It never
  prints `$0`, which under `curl … | sudo sh` is `sh`.
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

*2026-09-30:* twenty-five now. C22 aims `--dir` at the server's own folder, C23
starts look-alike processes (one as `nobody`, one whose `www` is a link, two at
once), C24 starts the server by hand so it can be restarted without the variable
before uninstalling, and C25 installs a `curl` that plays GitHub with whatever
checksum the case wants. `INSTALLER=<file>` measures another `install.sh`, which
is how the four were seen failing on the old one.

*2026-10-01:* thirty. C26 to C29 build the init image from `dist/` with this
checkout's `docker/Dockerfile` and `install.sh`, and bring up the README's
compose block against the official server: a fresh install, an update, the
custom lists, and an init that fails. C30 runs `install.sh` from stdin in
`docker:cli` with the Docker socket, which is how `curl … | sudo sh` runs it on
a Docker host. C11 now also expects the warning about installing into a
container's own files, and runs on any server, as it always has. The five new
ones need a server that honours the variable, and are not applicable otherwise.

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

*2026-10-01:* it happened. Upstream released the variable in v15.5 (§1.7), and
the two sides have swapped. Against `technitium/dns-server:latest` (v15.5.1) the
capability answer is yes, so C12 and C13 run and C15 stands down: 24 met and 1
not applicable on 2026-09-30. C15, the refusal, now needs an image before 15.5,
given with `IMAGE=`; it was measured against v15.4 on 2026-09-07. The `†` is
off W2, F3 and S2, and no server has to be built by hand. C26 to C30 are gated
by the same answer as C12 and C13.

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
installer against a real server.

**2026-09-30.** The audit of that day found three more, by reading this time,
and each has a probe case that fails on the script it was found in: a sweep with
no check on what it was sweeping (W6, C22), a server taken to be the first
process whose command line ended the right way, with a `www` that could be a
link (W7, C23), and an uninstall that removed the folder it resolved instead of
the one it had installed into (A8, C24). Left as they are, on purpose:
`confirm` still answers yes when there is no TTY, because the documented path is
`curl … | sudo sh` and W6 is what makes that safe, not a question nobody can
answer; and a web root owned by the service account can still race the
installer between a check and a write, because closing that needs writes that
do not follow links, which POSIX `sh`, `cp` and `mv` cannot promise. Which is the same lesson About left, in a
different costume: **a script that has never been run against the thing it
manages is a draft, not a tool.**
