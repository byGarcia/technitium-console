# Changelog

Notable changes, newest first. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow
[Semantic Versioning](https://semver.org/spec/v2.0.0.html) once there is more than one.

## [1.1.1](https://github.com/byGarcia/technitium-console/releases/tag/v1.1.1) — 2026-09-30

### Fixed

- **`--uninstall` finishes on a mount point.** In mode B the console's folder is removed, and in
  the Docker layout that folder is a bind mount, which cannot be removed from inside: the uninstall
  emptied it and then stopped with `Device or resource busy`. It now empties the folder, removes it
  when it can, and when it cannot says to unset the variable before restarting instead of
  offering a restart that would serve an empty folder. Found installing 1.1.0 from the release
  into the official image; the probe case that should have caught it now checks the exit code.
- **The tab title, the header and About follow the server.** Upstream refreshes the server's
  domain, version and start time every time this server's settings are loaded, saved or restored;
  here they were fixed at login, so renaming the server or updating it left them stale.
- **The active option of a dropdown stays in view** while moving through it with the keyboard.
  The lookup named a data attribute that had been renamed, and found nothing.

### Changed

- The language gate's fifth hole is closed: about 140 Spanish identifiers that its word list had
  never met are renamed, the list learns them, and it now also reads test ids and `data-*`
  attribute names.

## [1.1.0](https://github.com/byGarcia/technitium-console/releases/tag/v1.1.0) — 2026-09-30

Brought in line with **Technitium DNS Server v15.5.1**. Version 1.0.0 was built against v15.4 and,
on a v15.5 server, **cannot save Settings at all**: v15.5 removed Auto Prefetch, and 1.0.0 still
required its two fields before sending anything. Upgrade before (or together with) the server.

### Added

- **Administration › LDAP Authentication**, the tab v15.5 added: every field, the group map, the
  Test Connection button and its own validation, the masked bind password sent back as it came.
- **Edit Zone File** for Primary and Forwarder zones, from the zone's Options menu and from the
  zone list's row menu. Every other zone type's row entry becomes **View Zone**, as upstream's.
- **User types.** Local, Remote/SSO and Remote/LDAP decide the account menu, My Profile, the users
  table and User Details exactly as v15.5 does, including which groups are managed remotely.
- **Install into a folder of its own** on v15.5 or later, with
  `DNS_SERVER_WEB_SERVICE_WWW_FOLDER_PATH`: a server update no longer brings the stock console
  back. See *Installing*.

### Fixed

- **Settings saves again against v15.5**, and the two Auto Prefetch fields are gone.
- **Blocking follows v15.5's rules**: Blocking Answer TTL switches off with blocking, the update
  interval does not, and Update Now depends only on the block lists that were loaded.
- **The account dialogs behave as upstream's.** Configure 2FA and Change Password had drifted
  since 1.0.0 in behaviour, not only in text: disabling 2FA now asks first and goes as upstream's
  request, a rejected code is cleared, success closes the dialog and is announced on the page, and
  both dialogs show the username, the status and the help they had lost. My Profile's success is
  announced on the page too.
- **Logging in with the factory credentials opens Change Password** with the current password
  filled in, as upstream does. 1.0.0 worked out that it had to and then did nothing with it.
- **Nineteen upstream texts that were missing**, most of them the explanations under the Zone
  Options choices, one reworded paragraph in Sign Zone, the 2FA dialog's and Create API Token's two
  warnings.
- **Create API Token** swaps the form for its output once the token exists, as upstream does.
- **The SSO Redirect URI** read `…/admin/sso/sso/callback` since the routes became real; it hangs
  from the console root again.
- **Settings follows the selected node.** It loaded with `node=cluster` on a standalone server and
  saved with no node at all; it now sends what upstream sends and scopes its twelve blocks of
  parameters to the node or the cluster. After a save or a restore that moves the web service to
  another port or protocol, the console follows it, and the DoH/DoT/DoQ note shows the loaded
  addresses.
- Import Zone no longer refreshes the zone list, and a request that never gets an answer says
  upstream's sentence.
- Smaller v15.5 changes: the Docker note under Web Service, the Prefetch Trigger and Forgot
  Password texts, the Import Zone title, the SSO sign-up checkbox rule, the refreshed block list
  catalogue.

### Security

- **The installer can no longer remove what is not a console.** It refuses a non-empty folder
  that is neither a Technitium console nor its own, trusts only a server process run by root or by
  the service's account, does not write through symbolic links it found by itself, uninstalls only
  the folder it recorded, and checks a downloaded release against its published `.sha256`.
  Four new clauses and four new cases on the bench, seen failing on the 1.0.0 script first.
- **A doubled slash at the front page** (`https://host//`) made the console address its API as
  `//api/…` — another host — with the session token attached. The server's CSP blocked it; the
  root is now normalised so it never gets that far.
- A stored session token that fails at start-up is removed, as upstream does.

None of the XSS issues fixed in upstream's console by v15.5 and v15.5.1 applied here: this console
builds no HTML from strings.

### Changed

- `dev/check-parity-controls.mjs` also reads upstream's `<p>` notes and field explanations and its
  JavaScript, and now checks the other direction too: a label of ours that upstream no longer has.
  That is the check that would have caught Auto Prefetch.

## [1.0.0](https://github.com/byGarcia/technitium-console/releases/tag/v1.0.0) — 2026-09-07

First public release. Feature-complete against Technitium DNS Server v15.4 and verified against it:
twelve sections, thirty-two real URLs, forty-three dialogs checked one by one, every endpoint the
stock console calls, and 1,121 tests. `install.sh` puts it in place and takes it out again against
a twenty-one-clause contract.

What follows is what changed in the run-up to it, for whoever wants to know what was still moving.

### Added

- **The domain-tree round.** `Cache`, `Allowed` and `Blocked` are one component with three wrappers
  and had inherited the wrong archetype — a paginated collection, for something that is a tree. The
  tree becomes a full-height column beside the records instead of a small panel with an empty half
  screen next to it, the open node's path is written out, and the three screens are told apart
  without reading the title: an icon, a second line, and a colour that already meant that word in
  the Dashboard chart and the Logs rows.
- **The installer meets a written contract.** Twenty-one clauses and a bench of twenty-one cases
  against the official image: custom lists kept on the way in and out, an interrupted run repaired
  by the next one, the web root read off the running server instead of guessed, and no restart of
  the DNS service.
- **Sort parity is measured.** `dev/check-parity-sort.mjs` reads upstream's `sortTable(...)` calls
  and compares them column by column, and every gap has to carry a reason.

### Fixed

- **Two sortable columns that had been lost**, in the App Store list and in the installed apps list,
  and **one that was dead**: the Edit Permissions modal named a sort key that did not exist, so its
  two headers had done nothing for a week with every check green.
- **Loading no longer looks like emptiness** on the records side of the three list screens, which
  said `0 records at <ROOT>` while the request was still in flight.
- **`Uninstall` moved into the app card's menu.** A filled red button repeated once per card is what
  the button primitive explicitly says not to do.
- **The App Store is readable.** Twenty-seven apps were 5,868 px of scrolling at 1440 and 9,337 at
  390; the description now shows two lines with the rest behind the disclosure the card next door
  already used. It is 3,450 and 3,575.
- Elements that rendered with no class at all because they named a CSS class that did not exist.

### Changed

- **`src/` is entirely English** — comments, identifiers, file names and test descriptions — with a
  gate that enforces it.
