<div align="center">

# technitium-console

**An alternative administration console for [Technitium DNS Server](https://github.com/TechnitiumSoftware/DnsServer).**
Same API, same behaviour, same texts — the interface rebuilt from scratch.

[![License](https://img.shields.io/github/license/byGarcia/technitium-console)](LICENSE)
[![Release](https://img.shields.io/github/v/release/byGarcia/technitium-console?include_prereleases)](https://github.com/byGarcia/technitium-console/releases)
[![Stars](https://img.shields.io/github/stars/byGarcia/technitium-console)](https://github.com/byGarcia/technitium-console/stargazers)
[![Issues](https://img.shields.io/github/issues/byGarcia/technitium-console)](https://github.com/byGarcia/technitium-console/issues)
[![Last commit](https://img.shields.io/github/last-commit/byGarcia/technitium-console)](https://github.com/byGarcia/technitium-console/commits)

</div>

![The dashboard](docs/screenshots/dashboard.png)

**Latest: [v1.1.3](https://github.com/byGarcia/technitium-console/releases/latest) for Technitium DNS
Server 15.5.x** — LDAP, the zone file editor and everything else 15.5 brought.
[What's new](CHANGELOG.md) · [Which console for which server](CHANGELOG.md#which-version-for-which-server) · [Installing](#installing) · [Technitium in Docker](#docker)

It replaces the console the server ships with. Install it and the DNS service
behaves exactly as before; remove it and you are back to the original. Nothing on
the server side changes: this console talks to it only through its documented
`/api` endpoints.

## Design only. Zero functionality.

That is the rule the whole project is built on, and it is worth stating plainly
because it is unusual:

> Any behavioural difference from the upstream console is a bug, **even when it
> looks like an improvement**.

Same controls, same steps, same wording, same validation order. If a feature was
missing before, it is still missing. If a confirmation asked twice, it still asks
twice. You are changing how the console looks, not what your DNS server does —
and that is the only reason it is safe to put a third-party interface in front of
infrastructure.

## What it looks like

| Zones | Settings |
|---|---|
| ![Zones](docs/screenshots/zones.png) | ![Settings](docs/screenshots/settings.png) |

| Cache, Allowed and Blocked | Apps |
|---|---|
| ![The domain tree](docs/screenshots/cache.png) | ![Apps](docs/screenshots/apps.png) |

The three list screens share one component and used to be indistinguishable. The tree is the object
you came to look at, so it is a column and not a box; the path says where you are; and the colour on
the records panel is the one that already means *cached* and *blocked* in the Dashboard chart and in
the Logs rows.

<img src="docs/screenshots/mobile.png" alt="The console at 390 px" width="320" align="right">

**It works on a phone.** The stock console overflows horizontally on a 390 px
screen in twelve of its sections. This one does not overflow in any: the tables
reflow, the navigation collapses, and the actions stay reachable. That was not a
side effect — it was a defect found by measuring every section at 390 px and
fixed one by one.

<br clear="right">

## How thoroughly

| | |
|---|---|
| Checked against | Technitium DNS Server 15.5.1 |
| Sections | 12 |
| Routes, each a real URL | 33 |
| API endpoints the stock console calls, and this one calls too | 132 of 132 |
| Sortable columns kept | 64 of 66, and the two missing are declared |
| Dialogs, checked one by one | 44 |
| Tests | 1,262 |

Every figure in that table comes from a script in `dev/` —`check-endpoints.mjs`,
`check-parity-sort.mjs`, `dialog-inventory.sh`— and not from this paragraph.

Parity is not asserted, it is measured. `dev/` brings up **two instances of the
official Technitium image side by side** — one serving this console, one
untouched — and the scripts in there compare them: the controls present on each
screen, the state the server is left in after fourteen real actions, the widths
at which something overflows, the CSS classes nobody uses.

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

It asks the running server where its web root is, saves the console you have
now, and puts this one in its place. **Your DNS service is not restarted** — the
server picks the new files up by itself, and a restart would be an outage for
everything that resolves through it. To go back at any point:

```sh
curl -sSL https://raw.githubusercontent.com/byGarcia/technitium-console/main/install.sh | sudo sh -s -- --uninstall
```

The original console is restored from the copy the installer kept. Nothing is
downloaded to undo it.

**It works with whichever install you have**, because it does not guess: the
running server is found by what it executes, and its web root is read off the
command line that started it. Wherever you put it, that is where the console
goes.

**Your custom lists are kept**, on the way in and on the way out. Any
`json/*-custom.json` you wrote by hand is left exactly where it is — including
one you write months after installing, which no backup could contain.

**Nothing else on the server is touched.** Configuration, zones, users, logs and
`/etc/resolv.conf` come out of an install and an uninstall byte for byte the
same. The installer writes to three places and no others: the web root, its
backup, and its own state in `/var/lib/technitium-console`.

**An interrupted run cannot leave you without a console.** Files go in before
any are taken out, and every page is published after the assets it names, so at
every moment the server has a whole console to serve — the old one or the new
one. Anything a killed run left behind is cleaned up by the next one.

<details>
<summary>Options</summary>

`--version <tag>` to pin a release, `--from <path>` to install
from a tarball you already downloaded, `--dir <path>` to say where the web root
is, `--url <base>` if your web console does not answer on
`http://127.0.0.1:5380`, `--yes` to skip the confirmation.

If the backup was taken from a different version of the DNS server than the one
now running — which happens when the server was updated in between — the
uninstall stops and says so rather than putting an old console in front of a new
server. `--restore-mismatched-backup` overrides that, and `--yes` deliberately
does not.

**Linux only.** Windows installs are laid out differently and have their own
installer; this script does not try to handle them.

</details>

### On Technitium v15.5 or later: give the console a folder of its own

Since v15.5 the server can be told to serve its web console from another folder,
with `DNS_SERVER_WEB_SERVICE_WWW_FOLDER_PATH`. Do that, and a server update no
longer puts the stock console back: its own `www/` is left untouched and this one
lives somewhere the update does not write.

For a systemd install, create the folder, point the server at it and restart it
once — the folder is read when the server starts, and it has to exist by then or
the server falls back to its own `www/`:

```sh
sudo mkdir -p /opt/technitium-console
sudo systemctl edit technitium.service     # dns.service on older installs
```

```ini
[Service]
Environment=DNS_SERVER_WEB_SERVICE_WWW_FOLDER_PATH=/opt/technitium-console
```

```sh
sudo systemctl restart technitium.service
```

That restart is the only one, and like any restart of the service it stops
resolution for the few seconds it takes. Until the next step the web console
answers with an empty page. Then run the installer as above: it sees the variable on the running
server, checks that the folder is really the one being served, and installs into
it with no second restart. `--uninstall` removes the folder again; unset the
variable and restart, and the server is back on its own console.

If the folder did not exist when the server restarted, the server logs it and
keeps serving its own console; the installer reads that log, installs anyway and
asks for one more restart.

**On Proxmox VE with the community script** (`technitiumdns` from
[community-scripts](https://github.com/community-scripts/ProxmoxVE)): run the steps
above inside the container (`pct enter <id>`). Its unit is `technitium.service`, and
the script's own *Update* no longer touches the console, since it lives in its own
folder.

For Docker, see [Docker](#docker): the image does all of this with a volume.

> **Without the variable** — before v15.5, or if you prefer not to set it — the
> console replaces the files in the server's own `www/`. Technitium restores its
> console when it updates, so run the installer again afterwards.

### Keeping it up to date

Each console release is checked against one Technitium release — every action it sends, every text
and every control, compared with that server's own console. When you update the server, update the
console with it: run the installer again (on Docker,
`docker compose pull technitium-console && docker compose up -d technitium-console`). It needs no restart, and
[the changelog](CHANGELOG.md#which-version-for-which-server) says which console goes with which
server.

## Docker

If Technitium runs in Docker, the console comes as a small image that copies it into a volume and
exits. Your DNS server keeps running the official image: it mounts that volume and is told to
serve it. **It needs Technitium DNS Server 15.5 or later**, the first version that can serve a
folder of its own.

Add the variable and the `technitium-console` volume to your server, and the `technitium-console`
service:

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
the server starts anyway — nothing waits on it.

**Updating restarts nothing:**

```sh
docker compose pull technitium-console && docker compose up -d technitium-console
```

Only the copier runs again, and the server picks the new files up by itself. A plain
`docker compose pull && docker compose up -d` also updates the DNS server when there is a new image
of it — and that does restart it.

**Pinning a version:** use a release number instead of `latest` — `X.Y.Z` for exactly that
release (`ghcr.io/bygarcia/technitium-console:1.2.0`), `X.Y` to follow its fixes (`:1.2`). To go
back, pin the older one and update. Images start at 1.2.0.

**Removing it:**

1. Keep any `json/*-custom.json` you edited: they are in the volume.
2. Take the variable and the `technitium-console` volume line out of your server, and remove the
   `technitium-console` service.
3. `docker compose up -d --remove-orphans` — the server restarts once, back on the console its
   image ships, which was never touched.
4. `docker volume rm <project>_technitium-console` (`docker volume ls` shows the exact name).

**Custom lists** (`json/*-custom.json`, the files upstream's `www/json/readme.txt` describes) are
kept in the volume across updates. To edit them by hand, use a folder on the host instead of the
volume — `./technitium-console:/opt/technitium-console:ro` on the server and
`./technitium-console:/target` on the copier — and write them in `./technitium-console/json/`.
The folder can hold your lists before the first run. The copied files belong to root, so editing
them takes `sudo`. To remove the console, delete that folder instead of the volume.

**Without Compose:**

```sh
docker volume create technitium-console
docker run --rm -v technitium-console:/target ghcr.io/bygarcia/technitium-console:latest
```

then add `-e DNS_SERVER_WEB_SERVICE_WWW_FOLDER_PATH=/opt/technitium-console` and
`-v technitium-console:/opt/technitium-console:ro` to your server's `docker run`, and re-create it
once. To update, `docker pull` the image and run the second command again.

**The one-line installer on a Docker host** does not install anything. It reads your containers
and prints these steps with your own container, service, file and volume names — and with
`--uninstall`, the way out. It does not write into a container because a container's own files are
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
mount out and re-create the container first, and only then delete the folder — emptied while still
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
npm test             # 1,262 tests
npm run typecheck
npm run lint
```

React 19.2, TypeScript 6.0, Vite 8.2. **npm**, not pnpm or yarn, so building this
needs nothing installed beyond Node.

Before changing anything, read [CONVENTIONS.md](CONVENTIONS.md). It holds the rule
above, the upstream behaviours discovered along the way, and four constraints the
server imposes that will let you break production while development looks fine.

[PRODUCT.md](PRODUCT.md) says what this owns and what it refuses to become,
[CONTRIBUTING.md](CONTRIBUTING.md) how to run the two-instance harness, and
[AGENTS.md](AGENTS.md) is the short version for whoever arrives next.

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
already answer. If it made the machine your whole network resolves through nicer to look at, there
is [GitHub Sponsors](https://github.com/sponsors/byGarcia),
[Ko-fi](https://ko-fi.com/bygarcia),
[Liberapay](https://liberapay.com/bygarcia) and
[PayPal](https://www.paypal.com/paypalme/adriangmolina). A star or a good bug report is worth just
as much.

And if you have not already: **[Technitium DNS Server](https://github.com/TechnitiumSoftware/DnsServer)
is the thing doing the actual work here**, written and maintained by one person. It takes donations
too, and that is the more useful place to start.

---

## Licence

GPL-3.0-or-later, the same licence as Technitium DNS Server, whose console this
replaces. See [LICENSE](LICENSE).

This is an independent project, not affiliated with or endorsed by Technitium.
The Technitium name and logo belong to Technitium and are used here only to
identify the software this console is built for.
