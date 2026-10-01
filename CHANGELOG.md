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
| **1.1.x** | **15.5.x** (checked against 15.5.1) | Current. Supports a console folder of its own (`DNS_SERVER_WEB_SERVICE_WWW_FOLDER_PATH`), so server updates leave it alone. |
| 1.0.0 | 15.4 | Cannot save Settings on a 15.5 server. Upgrade. |

To update, run the installer again — the same one-line command. It needs no restart of the DNS
service. On Docker, pull the image again: see [Docker](README.md#docker).

---

## v1.1.3 — 2026-09-30

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

## v1.1.2 — 2026-09-30

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

## v1.1.1 — 2026-09-30

**A clean uninstall on Docker, and the header keeps up with the server.** Found by installing 1.1.0
from its own release, exactly as the README says to.

### 🧰 Installer

- **`--uninstall` finishes when the console's folder is a mount point** — which it is in the
  Docker layout. It used to empty the folder and then stop with `Device or resource busy`. Now it
  empties it, removes it if it can, and if it cannot, tells you to unset the variable before
  restarting instead of offering a restart that would serve an empty folder.

### 🖥 Interface

- **The tab title, the header and About follow the server.** Rename the server or update it, and
  they change the next time Settings loads — as the stock console does. They used to stay as they
  were when you logged in.
- **The highlighted option of a dropdown stays in view** while you move through it with the
  keyboard.

### 🧪 Under the hood

- The last Spanish names left in the code are gone, and the check that keeps the code in English
  now knows them.

---

## v1.1.0 — 2026-09-30

**Ready for Technitium DNS Server 15.5.** Version 1.0.0 was built for 15.4 and, on a 15.5 server,
could not save Settings at all: 15.5 removed Auto Prefetch, and 1.0.0 still required its two
fields. Everything 15.5 and 15.5.1 changed in the stock console is here, and the installer can now
keep the console in a folder of its own, so a server update no longer puts the stock one back.

### ✨ New in Technitium 15.5, now in the console

- **Administration › LDAP Authentication** — every field, the group map, Test Connection, and the
  bind password kept masked.
- **Edit Zone File** for Primary and Forwarder zones, from the zone's Options menu and from the
  zone list. Other zone types show **View Zone** instead.
- **LDAP users** — Local, Remote/SSO and Remote/LDAP accounts each get the right menu entries,
  profile fields and 2FA options.
- Blocking's new rules, the Docker note under Web Service, and the refreshed block list catalogue.

### 🧰 Installer

- **A folder of its own.** On 15.5 or later, point the server at a folder with
  `DNS_SERVER_WEB_SERVICE_WWW_FOLDER_PATH` — a variable contributed to Technitium for this very
  purpose ([#2138](https://github.com/TechnitiumSoftware/DnsServer/pull/2138)) — and the console
  lives there, untouched by server updates. See *Installing* in the README.
- **It only ever writes into a console.** It refuses a folder that is neither Technitium's console
  nor its own, trusts only the real server process, does not follow symbolic links, uninstalls
  only what it installed, and checks every download against the release's published checksum.

### 🛠 Fixes

- **Settings saves again** on 15.5.
- **Settings follows the node you pick**, on a cluster and on a single server alike, and after you
  move the web service to another port or protocol the console follows it there.
- **Single Sign-On** — the Redirect URI shown in Administration › SSO is the right one again.
- **Your account** — Configure 2FA asks before turning 2FA off, Change Password shows your username
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

## v1.0.0 — 2026-09-07

**First public release.** The whole Technitium DNS Server 15.4 console, rebuilt: twelve sections,
real addresses you can bookmark and reload, a layout that works on a phone, and a one-line
installer that puts it in place and takes it out again.

### ✨ Highlights

- **Same console, new interface.** Every screen, dialog, text and step of the stock console, against
  the same API — nothing changes on the server.
- **Works on a phone.** No section overflows at 390 px; tables reflow and the navigation collapses.
- **Cache, Allowed and Blocked as a real tree**, full height beside the records, with the path you
  are on written out.
- **An installer you can trust with your DNS server** — it keeps your custom lists, survives being
  interrupted, never restarts the DNS service, and uninstalls back to the original.

### 🛠 Fixes on the way to 1.0

- Sortable columns restored in the App Store and the installed apps list.
- Loading no longer looks like an empty list.
- The App Store is far shorter to scroll: descriptions show two lines, with the rest one click away.
