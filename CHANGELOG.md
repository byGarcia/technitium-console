# Changelog

What changed in each release, newest first. Every release is also on the
[Releases page](https://github.com/byGarcia/technitium-console/releases), with the files the
installer downloads.

## Which version for which server

A console release is built and checked against one Technitium DNS Server release: every action it
sends, every text it shows and every control it offers, compared with that server's own console.
**Update the console together with the server.**

| Console | Technitium DNS Server | Notes |
|---|---|---|
| **1.2.x** | **15.5.x, 15.6.x** (1.2.1 checked against 15.6.0) | Current. Allowed and Blocked become one Blocking section, a light theme, and the console comes as an image for Docker. Supports a console folder of its own (`DNS_SERVER_WEB_SERVICE_WWW_FOLDER_PATH`), so server updates leave it alone. |
| 1.1.x | 15.5.x | Superseded by 1.2.x on the same server. If you stay on it, use 1.1.3: earlier ones flood the server from Cache, Allowed and Blocked. |
| 1.0.0 | 15.4 | Cannot save Settings on a 15.5 server. Upgrade. |

To update, run the installer again (the same one-line command). It needs no restart of the DNS
service. On Docker, pull the image again: see [Docker](README.md#docker).

---

## v1.2.1 (unreleased)

**The Dashboard keeps itself current, and systemd setup is automatic.** While Last Hour is
selected, the Dashboard refreshes in the background once a minute, matching the stock console.
On Technitium 15.5 or later, the installer can now create and safely manage the dedicated console
folder and service drop-in itself. It also follows Technitium DNS Server 15.6.

### Technitium 15.6

- **Settings › Cache › Prefetch has the new Enable Cache Prefetch switch.** Since 15.6 a Prefetch
  Trigger of 0 no longer turns prefetching off, so its "set 0 to disable prefetching" hint is gone
  too. On a 15.5 server the switch shows unchecked and has no effect, as the server ignores it.
- **Administration › Cluster shows each node's version under its name**, once the server reports
  it. A remote node gets one after its first heartbeat.
- The 15.6 fixes in the stock console's DHCP screen did not apply here: this console never builds
  markup from those values.
- Console 1.2.0 keeps working on a 15.6 server. It just does not offer the new switch, and saving
  Settings leaves it as it was.

### Dashboard

- **Last Hour refreshes every 60 seconds.** The selected period and cluster node stay in place.
- Other periods do not poll: their data does not change as the current minute advances.
- Requests never overlap, and the current figures stay visible during a refresh.

### Installer

- On Technitium 15.5 or later with systemd, the installer now creates and owns
  the dedicated console folder and service drop-in itself. It publishes before
  the single restart, verifies the running service, and rolls back to the stock
  console if activation fails.
- Reinstalling or updating the console in that folder does not restart the DNS
  service. Uninstall switches back to the stock console before removing the
  folder, and refuses to remove a drop-in changed by the administrator.
- `--no-configure-service` keeps the previous replacement mode available.

---

## v1.2.0 (2026-10-02)

**Allowed and Blocked are now one Blocking section, and Docker gets an image.** Overview, Rules
and Lists: what blocking is doing, your own rules and your lists, each in one place. It is a deliberate exception
to "design only", written down with its limits: it calls only endpoints the server already has,
with the stock console's own actions and wording, and Settings › Blocking is left exactly as it
was. If Technitium runs in Docker, a small image now copies the console into a volume that the
official server serves, and updating it restarts nothing: see
[Docker](https://github.com/byGarcia/technitium-console#docker). There is a light theme now, and
it follows your system unless you pick one. On the way, the Dashboard's chart learned to tell the
time the way the stock console does.

### 🌗 Light theme

- **Change Theme is back** in the account menu, as in the stock console: Use System Theme
  (default), Light Theme and Dark Theme, applied the moment you click. Asked for by @scgf in
  [#1](https://github.com/byGarcia/technitium-console/issues/1), and by @armgenio in
  [#2](https://github.com/byGarcia/technitium-console/issues/2).
- **It remembers what the stock console remembers.** The choice is kept under the same browser
  key, so if you picked Light in the stock console you get Light here without doing anything, and
  the other way round. Follow the system and it changes when your system does, without a reload.
- **The light palette is measured, not inverted.** Every text colour reaches 4.5:1 on every
  surface it is drawn on, field borders and the focus ring reach 3:1, and the chart colours were
  checked against each other again on white, including for red-green colour blindness. Technitium's
  amber stays the fill; where amber is text on white it darkens so it can be read.
- **Amber is not offered.** The stock console's fourth theme is not drawn; a browser that has it
  stored gets Dark, and its choice is left as it was.
- The charts repaint when the theme changes, and series you switched off stay off.

### ✨ The Blocking section

- **Overview.** Total Queries and Blocked with a trend line under each and Blocked's share of the
  total, Block List Domains and Your Rules. Blocking's status, with Disable for the stock console's
  eight durations and, while paused, the time it comes back. Allowed against blocked over time as
  stacked bars, and a ring with the blocked share, for the Dashboard's five fixed periods and with
  its node selector and memory. Top Blocked Domains with **Allow Domain** and Top Domains with
  **Block Domain**, in a menu on each row, as on the stock Dashboard. And Recently Blocked: the last
  ten blocked queries, from the app that logs them.
- **Rules.** Every domain you blocked or allowed by hand in one table, filtered by All, Blocked or
  Allowed with their counts, searchable, and paged 50 at a time however many there are. Delete
  asks as the stock console asks. **Tree** switches to the domain tree you already know. Import,
  Export and Flush sit at the foot, each for Blocked or Allowed.
- **Block or allow a domain.** One field with Block and Allow, on Overview and on Rules. Enter
  blocks, as the stock console's form does.
- **Lists.** Each block list URL is a row: its readable name when it is in the Quick Add
  catalogue, an Enabled switch, its type and Remove. Add a block list or an allow list by URL or
  with Quick Add. Changes wait in a bar with Save and Discard, so even Quick Add › None can be
  undone, and Save sends only the list URLs, cleaned as Settings cleans them. Block List Domains,
  Allow List Domains and the next update come with **Update Now**, and the figures say they are
  updating until the server has finished.
- **More lists in Quick Add.** On Lists, Quick Add has a search field that filters by name or by
  the list's host, and after Technitium's catalogue it offers more lists chosen by this console,
  under More lists. Settings › Blocking offers Technitium's catalogue as before.
- **Old addresses still land.** `/allowed/` and `/blocked/` open Rules filtered to that list, and
  the filter stays in the address, so it survives a reload.
- **Nothing hides for want of a permission.** A panel you cannot view shows a padlock and the
  permission it needs; a control you cannot use is disabled and says why. The section appears for
  anyone who can view Blocked or Allowed.

### 🧰 Installer

- **`ghcr.io/bygarcia/technitium-console`**, for amd64, arm64 and arm/v7, on Technitium 15.5 or
  later. It carries this release's tarball, byte for byte, checks it against its checksum again
  every time it runs, copies the console into the volume and exits. Pin `:1.2.0`, follow `:1.2`,
  or take `:latest`.
- **On a Docker host the one-line installer prints the exact steps** for your containers, with
  their own container, service, file and volume names: in, and with `--uninstall`, out. It used to
  print a command that did not work (`sudo sh --dir …`) and a layout that 15.5 no longer needs.
- **Installing into a container's own files is called out**: they are gone the next time the
  container is recreated.
- **A folder holding only your `json/*-custom.json` lists counts as empty**, so they can be in
  place before the first install.
- **`--dir /` is refused.** It used to fall back to the server's own web root and install there.
  A folder holding a DNS server's configuration (`dns.config`, `zones/*.zone`…) is refused too,
  whatever else is in it.
- **Stopping the installer stops it.** A Ctrl-C or a `TERM` in the middle of a run used to clean
  up its working files and carry on without them; now the run ends there, and the next one picks
  up from a clean slate. A run it refuses leaves nothing behind, not even an empty
  `/var/lib/technitium-console`.

### 🛠 Fixes

- **The Dashboard's chart tells the time as the stock console does.** The console never asked the
  server for UTC (`utc=true`), so the hours on the axis were the server's clock and not yours, and
  shifted whenever the two sit in different time zones. It now asks for UTC and labels the hours in
  your local time, as the stock console does.
- **The Allowed and Blocked tree, now Rules › Tree, has no cluster node selector**, which the stock
  console only has on Cache, and after a change it reads the tree back from the primary node, as
  the stock console does.
- **No stray scrollbar beside the section tabs.** Chromium on Linux drew one next to the tabs of
  Settings, Logs, Administration and DHCP.
- **Drop-down lists show their options whole.** A list is now as wide as its longest option,
  within the window, and scrolling it no longer closes it.
- **Big figures stay inside their cards on the Dashboard.** A Block List of millions of domains
  ran out of its card in Server. Server now has two columns while it sits beside Queries, so nine
  characters fit at full size, and any figure that is still too long for its card is drawn
  smaller instead of spilling out. Reported by @armgenio in
  [#2](https://github.com/byGarcia/technitium-console/issues/2).

### 🧪 Under the hood

- Overview, Rules and Lists are also tested against responses recorded from a real server, and
  the rules table against 10,000 rules.
- `CONVENTIONS.md` writes the Blocking section down as a deliberate deviation, with its four
  limits and the two behaviours a maintainer would not guess.
- Every image is checked on each of its three platforms to carry exactly the release's tarball
  before `latest` and `1.2` move to it.
- Every push to `develop` builds `ghcr.io/bygarcia/technitium-console:develop`, the same way a
  release is built, for trying changes before they are released. It is not for production, and it
  never moves `latest` or a version.
- New issues start from a Bug report or Feature request form, which asks for the console and
  server versions and labels the issue.
- Everything in the repository is in English, and `npm run lint:language` now reads every file,
  not only `src/`. The notes from the design process, which were in Spanish, are no longer part
  of the repository.

---

## v1.1.3 (2026-09-30)

**Cache, Allowed and Blocked stop hammering the server.** Please update: these three screens had a
bug since 1.0.0 that kept asking the server for the root of the tree, hundreds of times a second,
for as long as the screen was open.

### 🛠 Fixes

- **Cache, Allowed and Blocked load once.** The screen re-ran its own first load after every
  answer, so it flooded the server's API while open and jumped back to the root whenever you
  opened a node in the tree. Opening a node now stays on it.

### 🧪 Under the hood

- The tests for those screens now answer by domain, as the server does. The old ones answered the
  same thing to every request, which is why the loop was invisible to them.
- Every section was opened against a server with real data and its requests counted: none asks
  for anything more than twice.
- A new check, `dev/check-endpoints.mjs`, confirms that every API endpoint the stock console of
  15.5.1 uses is covered here too: 132 of 132.

---

## v1.1.2 (2026-09-30)

**Sign in with SSO works from any page.** A one-line fix found on the first real install, the
evening 1.1.1 came out.

### 🔑 Single Sign-On

- **"Sign in with SSO" no longer gives a 404.** If your session expired while you were on, say, the
  Dashboard, the login appeared right there and its SSO link pointed at `/dashboard/sso/login`,
  which does not exist. It now always goes to the server's `/sso/login`.

### 🧪 Under the hood

- A test now fails on any link or image in the interface that would resolve against the page you
  happen to be on. This is the second path of that kind found in one day, so it gets a guard.

---

## v1.1.1 (2026-09-30)

**A clean uninstall on Docker, and the header keeps up with the server.** Found by installing 1.1.0
from its own release, exactly as the README says to.

### 🧰 Installer

- **`--uninstall` finishes when the console's folder is a mount point**, which it is in the
  Docker layout. It used to empty the folder and then stop with `Device or resource busy`. Now it
  empties it, removes it if it can, and if it cannot, tells you to unset the variable before
  restarting instead of offering a restart that would serve an empty folder.

### 🖥 Interface

- **The tab title, the header and About follow the server.** Rename the server or update it, and
  they change the next time Settings loads, as the stock console does. They used to stay as they
  were when you logged in.
- **The highlighted option of a dropdown stays in view** while you move through it with the
  keyboard.

### 🧪 Under the hood

- The last Spanish names left in the code are gone, and the check that keeps the code in English
  now knows them.

---

## v1.1.0 (2026-09-30)

**Ready for Technitium DNS Server 15.5.** Version 1.0.0 was built for 15.4 and, on a 15.5 server,
could not save Settings at all: 15.5 removed Auto Prefetch, and 1.0.0 still required its two
fields. Everything 15.5 and 15.5.1 changed in the stock console is here, and the installer can now
keep the console in a folder of its own, so a server update no longer puts the stock one back.

### ✨ New in Technitium 15.5, now in the console

- **Administration › LDAP Authentication**: every field, the group map, Test Connection, and the
  bind password kept masked.
- **Edit Zone File** for Primary and Forwarder zones, from the zone's Options menu and from the
  zone list. Other zone types show **View Zone** instead.
- **LDAP users**: Local, Remote/SSO and Remote/LDAP accounts each get the right menu entries,
  profile fields and 2FA options.
- Blocking's new rules, the Docker note under Web Service, and the refreshed block list catalogue.

### 🧰 Installer

- **A folder of its own.** On 15.5 or later, point the server at a folder with
  `DNS_SERVER_WEB_SERVICE_WWW_FOLDER_PATH`, a variable contributed to Technitium for this very
  purpose ([#2138](https://github.com/TechnitiumSoftware/DnsServer/pull/2138)), and the console
  lives there, untouched by server updates. See *Installing* in the README.
- **It only ever writes into a console.** It refuses a folder that is neither Technitium's console
  nor its own, trusts only the real server process, does not follow symbolic links, uninstalls
  only what it installed, and checks every download against the release's published checksum.

### 🛠 Fixes

- **Settings saves again** on 15.5.
- **Settings follows the node you pick**, on a cluster and on a single server alike, and after you
  move the web service to another port or protocol the console follows it there.
- **Single Sign-On**: the Redirect URI shown in Administration › SSO is the right one again.
- **Your account**: Configure 2FA asks before turning 2FA off, Change Password shows your username
  and the code's help, success messages close the dialog and appear on the page, and Create API
  Token shows the new token on its own with its warning. Logging in with the factory password
  opens Change Password straight away, as it should.
- **Nineteen explanations and notes** that had gone missing are back, most of them under the Zone
  Options choices.

### 🔒 Security

- Opening the console at an address with a doubled slash (`https://host//`) could have sent the
  session token to another host; the server's security headers blocked it, and now the console
  never gets that far.
- A saved session that fails when the console starts is cleared.
- None of the cross-site scripting issues fixed in Technitium's own console in 15.5 and 15.5.1
  applied here.

---

## v1.0.0 (2026-09-07)

**First public release.** The whole Technitium DNS Server 15.4 console, rebuilt: twelve sections,
real addresses you can bookmark and reload, a layout that works on a phone, and a one-line
installer that puts it in place and takes it out again.

### ✨ Highlights

- **Same console, new interface.** Every screen, dialog, text and step of the stock console, against
  the same API. Nothing changes on the server.
- **Works on a phone.** No section overflows at 390 px; tables reflow and the navigation collapses.
- **Cache, Allowed and Blocked as a real tree**, full height beside the records, with the path you
  are on written out.
- **An installer you can trust with your DNS server.** It keeps your custom lists, survives being
  interrupted, never restarts the DNS service, and uninstalls back to the original.

### 🛠 Fixes on the way to 1.0

- Sortable columns restored in the App Store and the installed apps list.
- Loading no longer looks like an empty list.
- The App Store is far shorter to scroll: descriptions show two lines, with the rest one click away.
