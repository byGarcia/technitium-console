<div align="center">

# technitium-console

**A modern administration console for [Technitium DNS Server](https://github.com/TechnitiumSoftware/DnsServer).**
Everything the stock console does, plus the screens it never had: who uses your DNS and what gets
blocked for each device, every cluster node side by side, a search that jumps anywhere, and a layout
that works on your phone.

[![License](https://img.shields.io/github/license/byGarcia/technitium-console)](LICENSE)
[![Release](https://img.shields.io/github/v/release/byGarcia/technitium-console?include_prereleases)](https://github.com/byGarcia/technitium-console/releases)
[![Stars](https://img.shields.io/github/stars/byGarcia/technitium-console)](https://github.com/byGarcia/technitium-console/stargazers)
[![Issues](https://img.shields.io/github/issues/byGarcia/technitium-console)](https://github.com/byGarcia/technitium-console/issues)
[![Last commit](https://img.shields.io/github/last-commit/byGarcia/technitium-console)](https://github.com/byGarcia/technitium-console/commits)

</div>

| Dashboard | Clients |
|---|---|
| ![The dashboard](docs/screenshots/dashboard.png) | ![Clients, with one client open](docs/screenshots/clients.png) |

**Latest release: [v1.4.0](https://github.com/byGarcia/technitium-console/releases/latest) for
Technitium DNS Server 15.5.x and 15.6.x**, with the Clients page, the cluster views, the command
palette and every screen redrawn.
[What's new](CHANGELOG.md) · [Which console for which server](CHANGELOG.md#which-version-for-which-server) · [Installing](#installing) · [Technitium in Docker](#docker)

It replaces the console the server ships with. Install it and the DNS service behaves exactly as
before; remove it and you are back to the original. Nothing on the server side changes: this console
talks to it only through the `/api` endpoints the stock console already uses.

- **Every feature of the stock console**: zones, settings, DHCP, apps, logs and administration,
  through the same 132 API endpoints, with Technitium's own users and permissions.
- **Know who uses your DNS**: a Clients page with every device, how much it asks and how much of it
  is blocked, and a card per client with its domains, its latest queries and one-click actions.
- **A Dashboard that answers at a glance**: trends against the previous period, response times,
  how each query was answered, and charts that open Query Logs on what you click or drag across.
- **Blocking in one place**: what it is doing, your own rules, your lists and their settings, and a
  check that tells you why a domain is blocked.
- **Built for clusters**: zones, cache, query logs, DHCP and block lists from every node side by
  side, with what disagrees between them marked.
- **Ctrl K to anywhere**: any page, settings pane, zone or account action, or a domain to check,
  resolve or look up in the logs.
- **Light, dark or your system's theme**, measured for contrast in both, and **it works on a phone**:
  no section scrolls sideways at 390 px.
- **Nothing extra to run**: no backend, no database, no second login. It installs into the server's
  web folder or a Docker volume, and removing it brings the stock console back.

## Know who uses your DNS

The stock console lists your top clients as names and counts on the Dashboard. Here they are a
page of their own, under **Monitoring › Clients**:

- **Every client of the period**, with its queries, the share of them that was blocked and a tag
  when a fifth or more is blocked or the server is rate limiting it. Filter, sort and search them,
  or see the twenty busiest as one bar of who sends your traffic.
- **A card for each client**: its address and, when your DHCP server hands it out, its MAC address
  and host name; its queries, blocked share, cache hit rate and median response time; its activity
  over time; the domains it asks for most and the ones blocked most, each with Block and Allow; the
  protocols and record types it uses; and its ten latest queries.
- **Act on it from there**: let it bypass blocking, exempt it from rate limiting, or turn its DHCP
  lease into a reserved one. Each action is the server's own setting, asks before it saves and
  needs the same permission it needs in Settings or DHCP.

![A client's card: its actions, figures, activity and domains](docs/screenshots/client-detail.png)

## A Dashboard that answers

- **Every figure with its trend** and its change against the previous period, and a week by hour.
- **Response Time**: the median and the 95th percentile of the answers the server had to fetch,
  the share over 100 ms and a histogram, from the newest thousand queries.
- **From query to answer**: one diagram from all the queries, through how the server answered them
  (cache, recursion, its own zones, blocking) to what it answered (No Error, NX Domain, Server
  Failure, Refused). Click a band to open those queries.
- **Click a point, or drag across the chart**, and Query Logs opens on exactly that window.
- **Last Hour moves in real time**, and Query Logs' Live Update shows what arrived since you turned
  it on.

![Response Time and From query to answer on the Dashboard](docs/screenshots/dashboard-response.png)

## Blocking, in one place

The stock console spreads blocking over three places: Allowed and Blocked are two separate domain
trees, and the block lists sit in Settings › Blocking. This console brings them together in one
**Blocking** section:

- **Overview** shows what blocking is doing: Total Queries and Blocked with their trend, the blocked
  share, allowed against blocked over time, the top blocked domains and the last ten blocked
  queries. Disable blocking for one of the stock console's eight durations and see when it comes back.
- **Rules** puts every domain you blocked or allowed by hand in one table, filtered, searchable and
  paged however many there are. The domain tree you already know is one switch away.
- **Lists** turns your block and allow lists into rows, each with its readable name, an Enabled
  switch and Remove, when each was last updated, and how the number of blocked domains has grown.
  Add one by URL or with Quick Add, and Save and Update Now in one step.
- **Settings** holds the blocking settings that used to live in Settings › Blocking.
- **Check a domain** and see whether this server blocks it and why: which block lists, which of your
  rules, or which allow rule lets it through. As you type, it tells you whether one of your rules
  already covers it.
- **Group your lists** under named headings, saved as plain comment lines, so the stock console still
  reads them, and **undo** a rule you deleted.

| Overview | Lists |
|---|---|
| ![Blocking › Overview](docs/screenshots/blocking-overview.png) | ![Blocking › Lists](docs/screenshots/blocking-lists.png) |

| Rules | Settings |
|---|---|
| ![Blocking › Rules](docs/screenshots/blocking-rules.png) | ![Blocking › Settings](docs/screenshots/blocking-settings.png) |

## Built for clusters

Each node of a Technitium cluster keeps its own cache, query log, DHCP leases and copy of the block
lists, and the stock console shows one node at a time. Here, on a cluster, **All nodes** lays them
side by side:

- **Zones**: every zone with its type and serial on each node, and a health cell for a zone missing
  on a node or serials that disagree.
- **Cache**: the records each node holds for a domain, with each node's time to live.
- **Query Logs**: the newest queries of every node in one table, with a Node column, live.
- **DHCP**: every node's leases and scopes together, each row acting on its own node.
- **Block lists**: each node's blocked domains and when it last updated its copy.
- **Administration › Cluster** compares the nodes' settings and marks the ones that differ, and
  splits the queries by node. The Dashboard can draw a line per node.

A node that does not answer is named once with the server's message and left out of the
comparison. The cluster views are new: if you run a cluster, a report of how they behave on yours is
very welcome.

## Ctrl K to anywhere

Press **Ctrl K** (⌘K on a Mac), or the search field under the logo, and type. Pages, sections,
Settings panes, your zones and the account menu are one keystroke away. Type a domain and it offers
to check it in Blocking, resolve it in DNS Client, find it in Cache or search Query Logs for it; type
an address and it searches the logs for that client.

![The command palette](docs/screenshots/command-palette.png)

## Every screen, reorganised

The sidebar is grouped by what you came to do: **Monitoring** (Clients, Query Logs, View Logs),
**DNS** (Zones, Cache, Blocking), **Network** (DHCP), **Tools** (DNS Client) and **System**
(Settings, Apps, Administration, About). Every screen was redrawn in the same language, and many say
more than they used to:

- **Zones** says what each zone holds and adds a host record (with its reverse record) from the list
  in one line; the open zone is in the address bar.
- **Cache** reads like a zone, with the path to where you are.
- **DHCP** shows how full each scope is.
- **DNS Client** lays the answer out by section, record by record.
- **Settings** is one form with a search; **Apps** says what each app is for; **My Profile** is a
  page.

| Zones | A zone |
|---|---|
| ![Zones](docs/screenshots/zones.png) | ![A zone's records](docs/screenshots/zone-records.png) |

| Query Logs | Cache |
|---|---|
| ![Query Logs with Live Update on](docs/screenshots/query-logs.png) | ![Cache](docs/screenshots/cache.png) |

| DNS Client | Settings |
|---|---|
| ![DNS Client](docs/screenshots/dns-client.png) | ![Settings](docs/screenshots/settings.png) |

| Apps | Administration |
|---|---|
| ![Apps](docs/screenshots/apps.png) | ![Administration › Permissions](docs/screenshots/administration.png) |

| View Logs | My Profile |
|---|---|
| ![View Logs](docs/screenshots/logs.png) | ![My Profile](docs/screenshots/profile.png) |

| About | Login |
|---|---|
| ![About](docs/screenshots/about.png) | ![The login screen](docs/screenshots/login.png) |

![The Dashboard in the light theme](docs/screenshots/dashboard-light.png)

**Light or dark, or whatever your system uses**, from Change Theme in the account menu or from
Ctrl K. Both themes are measured: every text colour reaches 4.5:1 on every surface it is drawn on.

**It works on a phone.** The stock console overflows horizontally on a 390 px
screen in twelve of its sections. This one does not overflow in any: the tables
reflow, the navigation collapses, and the actions stay reachable. That was not a
side effect. It was a defect found by measuring every section at 390 px and
fixed one by one.

![The Dashboard, Clients and the menu at 390 px](docs/screenshots/mobile.png)

## Safe to put in front of your DNS

**What the stock console does, this one does the same way.** That is the rule the whole project is
built on:

> Any difference from the stock console in something it already does is a bug, **even when it
> looks like an improvement**.

Same controls, same steps, same wording, same validation order. If a confirmation asked twice, it
still asks twice. What this console adds sits beside that, under four limits:

- **Only endpoints the stock console already calls.** Nothing new is asked of your server, and the
  same permissions guard every call.
- **Read first.** Almost everything added only reads. The additions that write (a client's
  Bypass Blocking and rate limit exemption, its lease conversion, the quick host record, Save and
  Update Now, undoing a deleted rule, the headings in your lists) send exactly what the stock
  console sends for the same change and need the permission it asks for; the client's actions
  ask before they save.
- **Every addition is written down**, with its limits, in
  [CONVENTIONS.md](CONVENTIONS.md#deliberate-deviations-from-upstream-behaviour), and the words that
  are this console's own are declared in each file.
- **Old addresses still land**: `/allowed/`, `/blocked/` and `/settings/blocking/` take you to their
  new place.

## How thoroughly

| | |
|---|---|
| Checked against | Technitium DNS Server 15.6.2 |
| Sections | 12 |
| Routes, each a real URL | 36 |
| API endpoints the stock console calls, and this one calls too | 132 of 132 |
| Sortable columns kept | 64 of 66, and the two missing are declared |
| Dialogs and confirmations | 111 and 34 |
| Tests | 2,651 |

Every figure in that table comes from a script in `dev/` (`check-endpoints.mjs`,
`check-parity-sort.mjs`, `dialog-inventory.sh`) and not from this paragraph.

Parity is not asserted, it is measured. `dev/` brings up **two instances of the
official Technitium image side by side** (one serving this console, one
untouched), and the scripts in there compare them: the controls present on each
screen, the state the server is left in after fourteen real actions, the sortable
columns, the dialogs, the CSS classes nobody uses.

```bash
cd dev && docker compose up -d     # this console on :5380, the stock one on :5381
```

## Installing

One command, on the machine where the DNS server runs:

```sh
curl -sSL https://raw.githubusercontent.com/byGarcia/technitium-console/main/install.sh | sudo sh
```

**Technitium in Docker?** See [Docker](#docker): a small image puts the console in a volume, and
this command, run on a Docker host, prints the exact steps for your containers.

On Technitium 15.5 or later with systemd, it gives the console its own folder
and configures the detected service automatically. **The first install restarts
the DNS service once** to switch folders; updates do not restart it. On older
versions or with `--no-configure-service`, it asks the running server for its
web root, saves the console you have now, and replaces it without a restart.
To go back at any point:

```sh
curl -sSL https://raw.githubusercontent.com/byGarcia/technitium-console/main/install.sh | sudo sh -s -- --uninstall
```

The managed systemd install switches back to the server's stock console before
removing its folder. Replacement installs restore the copy the installer kept.
Nothing is downloaded to undo either one.

**It works with whichever install you have**, because it does not guess: the
running server is found by what it executes, and a systemd unit is accepted only
when it names that same `DnsServerApp.dll`. If it cannot identify one exact
unit, it leaves service configuration alone and uses the web root it discovered.

**Your custom lists are kept**, on the way in and on the way out. Any
`json/*-custom.json` you wrote by hand is left exactly where it is, including
one you write months after installing, which no backup could contain.

**Nothing else on the server is touched.** Configuration, zones, users, logs and
`/etc/resolv.conf` come out of an install and an uninstall byte for byte the
same. On systemd with Technitium 15.5 or later, it also owns one clearly named
drop-in under `/etc/systemd/system`; uninstall removes it again.

**The installer requires root-owned files and folders.** The console, backup,
installer state and every parent folder must be writable only by root (the root
group counts as root, so a stock web root left 0664 by Technitium's own archive
is accepted, unless an access control list lets another account in; on BusyBox
systems that needs the acl or coreutils package to be checked). Symbolic
links, hard links, special files and newline-containing names are refused before
publication. A service-owned stock console can still be used with a dedicated
`/opt/technitium-console` folder when no custom lists need copying. If custom
lists need migrating from an unsafe tree, copy them yourself after inspecting
them into a fresh root-owned tree. Changing ownership on an existing tree cannot
revoke files another account already has open. For Docker, mount the console
volume read-only in the DNS server.

**An interrupted run cannot leave you without a console.** Files go in before
any are taken out, and every page is published after the assets it names, so at
every moment the server has a whole console to serve: the old one or the new
one. Anything a killed run left behind is cleaned up by the next one.

<details>
<summary>Options</summary>

`--version <tag>` to pin a release, `--from <path>` to install
from a tarball you already downloaded, `--dir <path>` to say where the web root
is, `--url <base>` if your web console does not answer on
`http://127.0.0.1:5380`, `--yes` to skip the confirmation, and
`--no-configure-service` to leave systemd untouched and use the server's own
web root unless you selected another folder yourself.

If the backup was taken from a different version of the DNS server than the one
now running (which happens when the server was updated in between), the
uninstall stops and says so rather than putting an old console in front of a new
server. `--restore-mismatched-backup` overrides that, and `--yes` deliberately
does not.

**Linux only.** Windows installs are laid out differently and have their own
installer; this script does not try to handle them.

</details>

### Distro packages

The one-liner above is the recommended path on a live server: it finds the
running service, verifies what it serves, and can roll back. For managed
fleets, offline installs and Arch systems there are also distro packages,
all installing the same bundle into `/usr/share/technitium-console`.
Serve it on Technitium 15.5 or later with
`DNS_SERVER_WEB_SERVICE_WWW_FOLDER_PATH=/usr/share/technitium-console`
and one restart; removing the package never touches the server's
configuration. How each one is built is written down in
[`packaging/`](packaging/README-packaging.md).

- **Arch Linux (AUR)**, maintained by
  [9M2PJU](https://aur.archlinux.org/account/9M2PJU):
  `technitium-console-bin` (the release tarball, checksum-verified) or
  `technitium-console-git` (built from source), e.g. with an AUR helper:
  `yay -S technitium-console-bin`.
- **Debian/Ubuntu and Fedora/RHEL**: the `.deb` and `.rpm` attached to
  each [release](https://github.com/byGarcia/technitium-console/releases).
  They only lay the files down and print the step above; they guess no
  service name and restart nothing.
- **AppImage**: the `technitium-console-<version>-x86_64.AppImage` attached
  to each release serves the bundle on `http://127.0.0.1:8080/` for local
  inspection. It is a preview of the files, not the DNS server: to put the
  console in front of a real server, use the one-liner.

### On Technitium v15.5 or later: give the console a folder of its own

Since v15.5 the server can be told to serve its web console from another folder,
with `DNS_SERVER_WEB_SERVICE_WWW_FOLDER_PATH`. Do that, and a server update no
longer puts the stock console back: its own `www/` is left untouched and this one
lives somewhere the update does not write.

On a systemd install, the one-line installer does this itself. It identifies the
unit from the running `DnsServerApp.dll`, publishes the complete console into
`/opt/technitium-console`, adds
`/etc/systemd/system/<unit>.d/technitium-console.conf`, and then restarts the
unit once. It verifies that the restarted process has the expected environment
and serves the new assets. If that fails, it removes the drop-in and restarts
back onto the stock console.

Updates publish into the same folder without restarting the DNS service.
`--uninstall` carries custom lists back, removes only an unchanged drop-in,
restarts onto the stock console, verifies it, and only then removes the folder.
If you edited the drop-in after installation, uninstall leaves it and the
console untouched rather than deleting administrator-owned configuration.

**On Proxmox VE with the community script** (`technitiumdns` from
[community-scripts](https://github.com/community-scripts/ProxmoxVE)): run the
one-line installer inside the container (`pct enter <id>`). It detects
`technitium.service`; the script's own *Update* no longer touches the console,
since it lives in its own folder.

For Docker, see [Docker](#docker): the image does all of this with a volume.

> **Without the variable** (before v15.5, or if you prefer not to set it), the
> console replaces the files in the server's own `www/`. Technitium restores its
> console when it updates, so run the installer again afterwards.

### Keeping it up to date

Each console release is checked against one Technitium release: every action it sends, every text
and every control, compared with that server's own console. When you update the server, update the
console with it: run the installer again (on Docker,
`docker compose pull technitium-console && docker compose up -d technitium-console`). It needs no restart, and
[the changelog](CHANGELOG.md#which-version-for-which-server) says which console goes with which
server.

**The console tells you when there is a new one.** An *Update* mark appears next to its version,
at the foot of the side panel, with the commands to run. Only releases made for the server you run
are announced. Your browser cannot ask GitHub (the server does not allow it), so the console asks
your DNS server to look it up: at most once a day per browser, your server sends one HTTPS request
to `technitium-console.pages.dev`, a small endpoint whose code is in
[`update-check/`](update-check/). It sees your server's IP address and nothing else, and the request
does not show in Query Logs. To turn it off, turn off *Check for update* in *Settings › General*,
which also silences the server's own notice, or block `technitium-console.pages.dev`.

## Docker

If Technitium runs in Docker, the console comes as a small image that copies it into a volume and
exits. Your DNS server keeps running the official image: it mounts that volume and is told to
serve it. **It needs Technitium DNS Server 15.5 or later**, the first version that can serve a
folder of its own.

Only the `technitium-console` lines below are new. Add them to your compose file: the variable
and the volume mount on your server, the `technitium-console` service, and the `technitium-console`
volume at the end. The rest stands for what you already have: the `config` lines are your own
`/etc/dns` mount, so keep it exactly as you have it.

```yaml
services:
  dns-server:
    image: technitium/dns-server:latest
    # ports, hostname, restart… as you have them
    environment:
      - DNS_SERVER_WEB_SERVICE_WWW_FOLDER_PATH=/opt/technitium-console
    volumes:
      - config:/etc/dns
      - technitium-console:/opt/technitium-console:ro

  technitium-console:          # copies the console into the volume, then exits
    image: ghcr.io/bygarcia/technitium-console:latest
    volumes:
      - technitium-console:/target
    restart: "no"

volumes:
  config:
  technitium-console:
```

```sh
docker compose up -d
```

That restarts the DNS server once, because its environment changed. The console shows up a
second or two later, when the copy is done; until then the page is empty. If the copy ever fails,
the server starts anyway: nothing waits on it.

**Updating restarts nothing:**

```sh
docker compose pull technitium-console && docker compose up -d technitium-console
```

Only the copier runs again, and the server picks the new files up by itself. A plain
`docker compose pull && docker compose up -d` also updates the DNS server when there is a new image
of it, and that does restart it.

**Pinning a version:** use a release number instead of `latest`: `X.Y.Z` for exactly that
release (`ghcr.io/bygarcia/technitium-console:1.2.0`), `X.Y` to follow its fixes (`:1.2`). To go
back, pin the older one and update. Images start at 1.2.0.

`ghcr.io/bygarcia/technitium-console:develop` is built from every push to the `develop` branch,
for trying changes before they are released; it is not for production. Pin a release instead.
If publishing an image fails or is cancelled halfway, `X.Y.Z` (or `develop-<sha7>`) can be left
published before the check that every platform carries exactly the console it was built from.
`latest`, `X.Y` and `develop` move only after that check, so they never point at such an image.

**Custom lists** (`json/*-custom.json`, the files upstream's `www/json/readme.txt` describes) are
kept in the volume across updates. To edit them by hand, use a folder on the host instead of the
volume (`./technitium-console:/opt/technitium-console:ro` on the server and
`./technitium-console:/target` on the copier) and write them in `./technitium-console/json/`.
The folder can hold your lists before the first run. The copied files belong to root, so editing
them takes `sudo`. Removing it is the last of the steps below.

**Without Compose:**

```sh
docker volume create technitium-console
docker run --rm -v technitium-console:/target ghcr.io/bygarcia/technitium-console:latest
```

then add `-e DNS_SERVER_WEB_SERVICE_WWW_FOLDER_PATH=/opt/technitium-console` and
`-v technitium-console:/opt/technitium-console:ro` to your server's `docker run`, and re-create it
once. To update, run `docker pull ghcr.io/bygarcia/technitium-console:latest` and then the second
command again.

**Removing it:**

1. Keep any `json/*-custom.json` you edited: they are in the volume, or in the folder if you use
   one.
2. Take the variable and the `technitium-console` volume line out of your server, remove the
   `technitium-console` service, and remove the `technitium-console:` entry under the top-level
   `volumes:`.
3. `docker compose up -d --remove-orphans`. The server restarts once, back on the console its
   image ships, which was never touched.
4. `docker volume rm <project>_technitium-console` (`docker volume ls` shows the exact name).
   With a folder on the host instead, delete it now, once the server no longer mounts it; its
   files belong to root: `sudo rm -rf ./technitium-console`.

Without Compose: re-create your server without the
`-e DNS_SERVER_WEB_SERVICE_WWW_FOLDER_PATH=/opt/technitium-console` and
`-v technitium-console:/opt/technitium-console:ro` you added (it restarts once, back on its own
console), and then `docker volume rm technitium-console`.

**The one-line installer on a Docker host, without `--dir`,** does not install anything. It reads
your containers and prints these steps with your own container, service, file and volume names,
and with `--uninstall`, the way out. It does not write into a container because a container's own files are
replaced every time it is recreated: a console copied into one with `docker exec` is gone after
the next image update, and the installer says so if you try.

<details>
<summary>Servers before 15.5, and why not an image mount</summary>

**Before 15.5** the server cannot serve another folder, so the console goes into a folder on the
host mounted over the container's own web root:

```sh
curl -sSL https://raw.githubusercontent.com/byGarcia/technitium-console/main/install.sh | sudo sh -s -- --dir /opt/technitium-console
```

```yaml
    volumes:
      - /opt/technitium-console:/opt/technitium/dns/www:ro
```

then re-create the container once. To update, run the same command again. To remove it, take the
mount out and re-create the container first, and only then delete the folder. Emptied while still
mounted, it would leave the server serving nothing. The same command with `--uninstall` prints
these steps for your container. Moving to 15.5 or later and the image is the better way.

**An image mount** (`type: image`, Docker Engine 28 and Compose 2.35 or later) is not offered: it
is read-only, so no custom lists; every update would recreate the DNS container; older engines,
like those on many NAS boxes, do not have it; and this image carries the release's tarball, not an
unpacked folder.

</details>

## Building

```bash
npm install
npm run build        # emits into dist/
npm run dev          # Vite development server
npm test             # 1,647 tests
npm run typecheck
npm run lint
```

React 19.2, TypeScript 6.0, Vite 8.2. **npm**, not pnpm or yarn, so building this
needs nothing installed beyond Node.

Before changing anything, read [CONVENTIONS.md](CONVENTIONS.md). It holds the rule
above, the upstream behaviours discovered along the way, and four constraints the
server imposes that will let you break production while development looks fine.

[PRODUCT.md](PRODUCT.md) says what this owns and what it refuses to become, and
[CONTRIBUTING.md](CONTRIBUTING.md) how to run the two-instance harness.

## Status

Feature-complete against Technitium DNS Server v15.5.1 and verified against it:
the LDAP Authentication tab, the zone file editor and the removal of Auto Prefetch
that v15.5 brought are all here. Version 1.0.0 was built against v15.4 and cannot
save Settings on a v15.5 server; use 1.1.0 or later there. Not
merged upstream: the maintainer
[closed the pull request](https://github.com/TechnitiumSoftware/DnsServer/pull/2128)
because he is not a frontend developer and could not maintain the stack through
future releases, and suggested shipping it as an installable alternative console
instead. This repository is that.

## Contributing

[CONTRIBUTING.md](CONTRIBUTING.md) has how to run the two-instance harness and what a good change
looks like here. A vulnerability is not a bug report: [SECURITY.md](SECURITY.md) has its own private
route, and it also says which parts belong upstream instead. Everybody taking part is held to the
[Code of Conduct](CODE_OF_CONDUCT.md). Releases are listed in [CHANGELOG.md](CHANGELOG.md).

---

## ❤️ Support

This console is free and stays free, and it will never ask your DNS server for anything it does not
already answer. If it made the machine your whole network resolves through easier to run, there
is [GitHub Sponsors](https://github.com/sponsors/byGarcia),
[Ko-fi](https://ko-fi.com/bygarcia),
[Liberapay](https://liberapay.com/bygarcia) and
[PayPal](https://www.paypal.com/paypalme/adriangmolina). A star or a good bug report is worth just
as much.

And if you have not already: **[Technitium DNS Server](https://github.com/TechnitiumSoftware/DnsServer)
is the thing doing the actual work here**, written and maintained by one person. It takes donations
too.

---

## Licence

GPL-3.0-or-later, the same licence as Technitium DNS Server, whose console this
replaces. See [LICENSE](LICENSE).

This is an independent project, not affiliated with or endorsed by Technitium.
The Technitium name and logo belong to Technitium and are used here only to
identify the software this console is built for.
