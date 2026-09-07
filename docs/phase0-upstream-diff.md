# Phase 0.1 — the upstream diff

Living output of plan step 0.1. Updated as surfaces are compared.

## The method works, with one condition

Upstream ships its entire console in one `index.html`: **531 controls, 21 panes
and 40 modals, all present in the markup before anyone logs in.** So the
reference can be inventoried from the `ref` instance in `dev/` without a session,
which makes the diff cheap to run and cheap to repeat.

**The condition, found on the first comparison:** upstream generates part of its
own screen at runtime. Counting its markup is not the same as counting its
screen. Comparing our live console against upstream's static template reports
differences that are not differences.

The diff therefore separates two categories, and only the first is a parity
question:

1. **Declared controls** — present in the markup. Comparable directly.
2. **Generated rows** — built by JS from server data (repeating rows of an
   editable table). Comparable only against an instance holding the same data,
   or by comparing the row *template* rather than the rows.

## Settings — nine panes

Ours measured with `contract()` v2, upstream from its markup.

| Pane | upstream | ours | Δ | reading |
|---|---|---|---|---|
| General | 39 | 54 | +15 | **not a difference** — see below |
| Web Service | 16 | 16 | 0 | match |
| Optional Protocols | 23 | 23 | 0 | match |
| TSIG | 0 | 0 | 0 | match; both are a table with no rows here |
| Recursion | 12 | 12 | 0 | match |
| Cache | 15 | 15 | 0 | match |
| **Blocking** | **12** | **11** | **−1** | the `Quick Add` select of spec F8 |
| **Proxy & Forwarders** | **19** | **18** | **−1** | the `Quick Add` select of spec F8 |
| Logging | 12 | 12 | 0 | match |

Six of nine match exactly. The two shortfalls are the two controls spec F8
already names, now confirmed by a second and independent route: the first was
found by reading a help text that described a control that was not there, this
one by counting.

### General is not carrying anything extra

Diffed by label rather than by count:

- **Missing from ours: none.** All 39 of upstream's controls are present.
- **Extra in ours: 15**, and all fifteen are rows of the QPM limits table — two
  IPv4 rows and three IPv6 rows, three fields each. They are category 2: upstream
  builds them from the server's configuration, our instance holds five, and its
  static markup holds none.

So `Settings › General` is at parity. The "54 fields" that made it the largest
screen in the console is 39 settings plus five rows of one table, and the ranking
that number produced was misleading twice over.

## Still to compare

The remaining panes, the 27 destinations, the 9 detail views and the 40 modals.
Upstream's `.modal` count of 40 against our 42 `<Dialog>` plus 21 `<Confirm>` is
the next one worth doing, since it decides plan step 0.2.


## The contract keeps relations, not order (v3)

Order is what the redesign decides, so it does not travel. Meaning does: each
entry carries its helper text, its options, the actions that operate on it, and
what governs it.

Dependencies are the one relation the DOM does not state at rest — a field greyed
out because a master switch is off looks identical to one greyed out always — so
`dependencies()` finds them by experiment: it toggles each switch and records
which controls changed. Verified on `Settings › Blocking`:

> `Enable Blocking` governs **Allow TXT Blocking Report**, **Blocking Temporarily
> Disabled Till**, **Blocking Bypass List**, the three response radios (**ANY
> Address**, **NX Domain (recommended)**, **Custom Address**), **Allow / Block
> List URLs** and **Block List Update Interval**.

The same run shows the technique's limit: it toggles checkboxes and switches, not
radios, so it misses that **Custom Blocking Addresses** is governed by *Custom
Address* being the chosen option. Radio-driven dependencies, dependencies that
only appear after a save, and dependencies that change visibility rather than
enablement are read from the code until the experiment covers them.

## Phase 0.2 — dialogs and confirmations

### The unit is not the component

The question "are 21 `<Confirm>` usages one surface or twenty-one?" is two
questions wearing one coat, and they have different answers.

| Axis | Unit | Answer |
|---|---|---|
| **Visual** | A surface to design | `Confirm` is **one**. It is `Dialog` + `size="compact"` + one action + Cancel (`ui/Confirm.tsx`), and it exists precisely because the same shape had been written bare four times over. It is designed once, in phase 2, as a primitive |
| **Functional** | A contract to validate | **One per trigger**, and there are more of them than there are `<Confirm>` tags, because several call sites are parameterised and dispatch to different confirmations from the same tag |

So the count of JSX elements answers neither question. The unit is:

> **trigger → purpose → fields → actions → result**

A confirmation reached from "Delete User" and one reached from "Disable User" are
one surface and two contracts. Both must be validated; only one has to be
designed.

### Measured so far

- `Confirm` is one surface. Read from `ui/Confirm.tsx`: confirmed.
- Triggers found by pattern, **not authoritative**: 19 across 8 files
  (`lists/Lists` 4, `settings/Settings` 3, `logs/ViewLogs` 3, `admin/Users` 3,
  `admin/Sso` 2, `dhcp/Scopes` 2, `dhcp/Leases` 1, `modals/ChangePassword` 1),
  against 21 `<Confirm>` tags across a wider set of files.
- The two counts disagree because the state that opens a confirmation is named
  differently in each screen, and because parameterised sites hide several
  contracts behind one tag — `logs/ViewLogs` alone dispatches four
  (`Delete Log`, `Delete All Logs`, `Delete All Stats`, and one more).

**Three regex passes gave 19, 21 and 24. None of them is the answer**, and the
difference is not noise: it is the parameterised sites. The count is settled by
reading the call sites in those files, which is bounded work on a known list, not
by another pattern.

### What each contract has to record

For every trigger, and this is what goes into the prompt and the validation:

| | |
|---|---|
| **Trigger** | The control that opens it, and from which surface |
| **Purpose** | Its title, verbatim |
| **Fields** | What it asks for, if anything. Most confirmations ask for nothing |
| **Actions** | Its verb —`Delete`, `Disable`, `Uninstall`, `Flush`— and its variant, verbatim. `Cancel` is the primitive's, not the contract's |
| **Result** | What happens on confirm, and what the surface behind it shows afterwards |

The same table applies to the 42 `<Dialog>` usages, where the fields column is
where the work is: those are the console's densest surfaces.

## The eleven top-level panes

Upstream's markup, read from `ref`, against our screens.

### A candidate loss on five screens: the cluster node selector

Upstream carries a per-screen cluster node select — `optDashboardClusterNode`,
`optZonesClusterNode`, `optCachedZonesClusterNode`, `optDnsClientClusterNode`,
`optLogsClusterNode`, plus DHCP's and Administration's. Seven in all.

We have it in **DHCP and Administration only**. Dashboard, Zones, Cache, DNS
Client and Logs have none: `grep -c cluster` returns 0 in `DnsClient.tsx`.

`CONVENTIONS.md` names **three** deliberate deviations from upstream — the single
dark theme, the settings jump to an invalid field's sub-tab, and not replicating
the dead DoH/3 checkbox — and instructs that a fourth is reported rather than
introduced. This is not among the three.

**Answered, from the code.** `js/cluster.js`, `updateClusterNodeDropDown`: the
select is shown only when `sessionData.info.clusterInitialized` is true, and
hidden otherwise. So its presence in upstream's markup proves nothing on a
harness with no cluster — upstream would hide it here too.

What settles it is our side. `grep -in cluster` over `Dashboard.tsx`, `Zones.tsx`,
`Lists.tsx`, `ViewLogs.tsx`, `QueryLogs.tsx` and `DnsClient.tsx` returns **nothing
at all**. The control is not hidden, not conditional, not deferred: it was never
built.

**This is a loss, and a larger one than the three in F8.** Those are three
controls; this is a capability. On a server that is part of a cluster, upstream
lets you point the Dashboard, Zones, Cache, Allowed, Blocked, DNS Client and both
Logs screens at another node and read its data. This console can only ever show
the node it is served from. It is invisible here, and on any single-server
install, which is why it survived a screen-by-screen review: **the harness has no
cluster, so the missing control has nothing to be missing from.**

It also explains the shape of what was found before. Administration and DHCP do
have their node selectors, so whoever built those knew about clusters; the six
screens that lost it are the ones where the selector is a filter over data rather
than the subject of the screen.

### A false alarm, recorded so it is not raised again

DNS Client looked short by one: upstream has `Enable DNSSEC Validation` and our
label scan did not find it. It **is** there —`DnsClient.tsx:124`— written as a raw
`<input type="checkbox">` with its label as sibling text rather than through the
`label=` prop the rest of the console uses.

Two things follow. The gap on DNS Client is only the server dropdown, already
named in spec F8. And a scan that looks for one spelling of a label will invent
losses: `contract()` hunts labels four ways for exactly this reason, and any
comparison done outside it has to do the same.

## Dialogs — counted, not yet mapped

### What the code says, read rather than clicked

| | |
|---|---|
| Upstream modals, by stable id | **40** |
| Our `<Dialog>` elements | **43**, of which one is the `Confirm` primitive itself → 42 usages |
| Our `<Confirm>` elements | **21** |
| Of those 64, with a **parameterised** title | **41** |

Two thirds of our dialog elements take their title from state, so the JSX count
cannot answer what surfaces exist. `admin/Cluster` alone holds nine, all
parameterised, against upstream's eight cluster modals.

Upstream's 40 ids, on the other hand, are stable and enumerable. They are the
authoritative list of dialog surfaces, and the parity question is: does each of
the 40 have a home here?

### The mapping is not done, and one attempt is discarded

A first pass matched each upstream modal id against our source by looking for its
significant words. It reported 40 of 40 present. **It is wrong**, and it was
caught by testing it against an answer already known:

`modalChangeTheme` does not exist here, deliberately — it is deviation 1 in
`CONVENTIONS.md`, the single dark theme. The matcher found "change" and "theme"
scattered across unrelated files and declared it implemented. Its only real hit
was a *comment* in `ThemeProvider.tsx` noting the modal would have to come back if
the deviation were ever reversed.

So the mapping is done by reading, one modal at a time, against the screen that
would own it. Forty is a bounded list.

**The lesson repeats and is worth stating once: a heuristic that has not been run
against a known answer is not a measurement.** Three times in this phase a quick
pattern gave a confident wrong number — the screen count, the confirmation
count, and now this — and each time the check that caught it was cheap.

### The mapping, done by reading

All forty, each against the file that owns it.

| Upstream modal | Here |
|---|---|
| `modalMyProfile`, `modalCreateApiToken`, `modalChangePassword`, `modalConfigure2FA`, `modalForgotPassword` | `screens/modals/` — one file each |
| `modalChangeTheme` | **absent, deliberately** — deviation 1 in `CONVENTIONS.md`, the single dark theme |
| `modalUpdateAvailable` | `app/Versions.tsx` |
| `modalAddZone`, `modalAddEditRecord`, `modalImportZone`, `modalCloneZone`, `modalConvertZone`, `modalZoneOptions`, `modalDnssecSignZone`, `modalDnssecUnsignZone`, `modalDnssecViewDs`, `modalDnssecProperties` | `zones/modals/` — one file each |
| `modalImportAllowedZones`, `modalImportBlockedZones` | `lists/Lists.tsx` |
| `modalStoreApps`, `modalInstallApp`, `modalUpdateApp`, `modalAppConfig` | `apps/` — one file each |
| `modalBackupSettings`, `modalRestoreSettings` | `settings/dialogs.tsx` |
| `modalTopStats` | `dashboard/TopStats.tsx` |
| `modalDhcpRemoveLease` | `dhcp/Leases.tsx` |
| `modalAddUser`, `modalUserDetails` | `admin/Users.tsx`, `admin/UserDetails.tsx` |
| `modalAddGroup`, `modalGroupDetails` | `admin/Groups.tsx` |
| `modalEditPermissions` | **two files here**: `admin/Permissions.tsx` and `zones/modals/ZonePermissions.tsx` |
| the eight cluster modals | `admin/Cluster.tsx`, which holds nine dialogs |

**Dialogs are at parity.** Thirty-nine of forty have a home; the fortieth is
absent on purpose and recorded as such.

Two shapes worth noting, because neither is a defect and both would look like one
to a counter:

- **One upstream surface, two of ours.** `modalEditPermissions` serves both
  section permissions and zone permissions — `showZonePermissionsModal(zone)`
  opens it with a different title (`main.js:2544`). We split it in two.
  `ZonePermissions.tsx` is not an extra; it is half of that split.
- **One of ours, many contracts.** `admin/Cluster.tsx` holds nine dialogs against
  upstream's eight cluster modals, all with parameterised titles.

This is why 0.2 counts triggers and not components, in both directions.

## Phase 0.3 — which surfaces vary by permission

Read from `app/Shell.tsx`, `app/sections.ts` and each screen's own prop
documentation.

### Two mechanisms, not one

1. **A section is hidden entirely.** `sections.ts` gives each destination a
   permission key, and `visibleSections()` drops the ones the user cannot view.
   `About` has none and is always visible. This changes the **shell**, not the
   screen: the sidebar is shorter.
2. **A screen is drawn with controls withheld.** `Shell` passes explicit
   capability props down. These are the variants the validation matrix has to
   cover.

### The variants to validate

| Screen | Prop | Server permission | What it withholds |
|---|---|---|---|
| Zones | `canModify` | `Zones.canModify` | editing a zone and its records |
| Zones | `canDelete` | `Zones.canDelete` | deleting zones |
| DHCP | `canModify` | `DhcpServer.canModify` | saving a scope, enabling and disabling it |
| DHCP | `canDelete` | `DhcpServer.canDelete` | deleting a scope, removing a lease. **Not** `canModify` |
| Logs | `canDeleteLogs` | `Logs.canDelete` | deleting a log file, and all of them |
| Logs | `canDeleteStats` | **`Dashboard.canDelete`** | deleting all statistics — the control lives in Logs and asks Dashboard's permission (`WebServiceLogsApi.cs:135`) |
| Settings | `canModify` | `Settings.canModify` | saving |
| Settings | `canFlushCache` | **`Cache.canDelete`** | flushing the cache |
| Settings | `canBackup` | `Settings.canDelete` | backup and restore |

**Nine variants across four screens**, and three of them do not ask the
permission their screen is named after. Those three are the ones a redesign is
most likely to get wrong, because the obvious assumption is wrong: the Settings
save bar carries three different permissions, and a "delete stats" button on the
Logs screen answers to the Dashboard.

### Administration is the exception, and deliberately

It receives no permission props. Upstream hides and disables nothing inside the
section: it uses `Administration.canView` to show or hide the whole thing, and
lets the API reject what it should (`admin/Admin.tsx:20-24`). Reproducing that is
parity; adding per-control gating there would be inventing behaviour.

### What this closes

The matrix per surface is **populated / empty / loading / error × 1440 / 1024 /
768 / 390**, plus, for Zones, DHCP, Logs and Settings only, the withheld-control
variant of each prop above. Everything else has no permission variant.

## Phase 0.2 — closed: 25 confirmation contracts

Enumerated by reading the call sites, not by counting elements. **21 `<Confirm>`
elements produce 25 contracts**, because parameterised sites dispatch to several.

| Screen | Contracts | |
|---|---|---|
| `settings/Settings` | 3 | Flush Cache · Temporary Disable Blocking · Update Block Lists |
| `admin/Users` | 3 | Disable User · Disable 2FA · Delete User |
| `admin/Sso` | 2 | Save Config (authority) · Save Config (metadata) — same words, two triggers |
| `admin/Sessions` | 1 | Delete Session |
| `admin/Groups` | 1 | Delete Group |
| `admin/Cluster` | 1 | Resync Cluster |
| `apps/Apps` | 1 | Uninstall App |
| `dhcp/Leases` | 1 | Remove Lease? |
| `dhcp/Scopes` | 2 | Delete Scope · Disable Scope — one element, a ternary |
| `logs/ViewLogs` | 3 | Delete Log · Delete All Logs · Delete All Stats — one element, a lookup table |
| `lists/Lists` | 2 | Flush Cache · Delete Cached Zone |
| `dashboard/BlockingMenu` | 1 | Temporarily Disable Blocking |
| `zones/Zones` | 6 | Delete Zone · Delete Zones · Disable Zone · Resync Zone · Delete Record · Disable Record — one element, fed by `ZoneList` and `ZoneRecords` through `onConfirm` |
| | **25** | |

Three shapes make the element count useless, and all three appear above:

- **A ternary**: `dhcp/Scopes` picks its title from `confirm?.action`.
- **A lookup table**: `logs/ViewLogs` indexes `TEXTO_CONFIRM`.
- **A hoisted state**: `zones/Zones` renders one `<Confirm>` whose entire content
  is pushed up from two child components. Six contracts, one element, and the
  titles are not even in the same file.

`admin/Sso` shows why the trigger is the unit: two contracts with **identical**
title, text and label, distinguished only by which field was edited. A count of
distinct wordings would merge them; the validation must not.

### Answer to the phase 0.2 question

- **One visual surface.** `ui/Confirm.tsx`, designed once in phase 2. Its own
  contract, verified in the code: `Dialog` at `size="compact"`, one action button
  carrying the verb and its variant, `Cancel` as the close, disabled while the
  action runs, `pre-wrap` for multi-line text, and Escape, focus trap and ARIA
  inherited from Radix through `Dialog`.
- **Twenty-five functional contracts**, each validated on its own: trigger,
  purpose, fields, actions, result.

## Detail views — four, not nine, and all four match upstream's structure

Five of the nine the spec listed are `<Dialog>`s, not screens: `UserDetails`,
`AppConfig`, `InstallApp`, `StoreApps` and `UpdateApp`. All five are already among
upstream's forty modals, so counting them again as detail views inflated the
surface count.

The four that are screens are each a sub-view of their destination, which is how
upstream builds them too:

| Ours | Upstream |
|---|---|
| `zones/ZoneRecords` | inside `mainPanelTabPaneZones` — it carries its own `Records Per Page` and cluster-node select |
| `dhcp/ScopeForm` | inside `mainPanelTabPaneDhcp` — all 31 scope fields are in that pane |
| `lists/Records`, `lists/Tree` | inside the `CachedZones` / `AllowedZones` / `BlockedZones` panes |

No structural divergence, and no surface missing.

## Phase 0.6 — the three F8 controls, restored

| Screen | Control | Upstream | Now |
|---|---|---|---|
| Settings › Blocking | `Quick Add` | 12 controls | **12** |
| Settings › Proxy & Forwarders | `Quick Select` | 19 controls | **19** |
| DNS Client | the server list | text field **with a dropdown** | text field with a `datalist` |

All three load the same way upstream does — `<name>-custom.json` first,
`<name>-builtin.json` as the fallback — through one shared loader in
`lib/quick-lists.ts`. Those are the files `install.sh` preserves on every
upgrade: until now it protected customisation of lists the console never read.

Three behaviours were reproduced rather than approximated, and each has tests
because each looks like a bug until you know it is not:

- **Blocking**: `None` empties the field, `Default` **replaces** it, anything else
  **appends**, skipping URLs already present.
- **Forwarders**: the entry replaces the addresses, sets the protocol radio
  (falling back to UDP) and follows the entry's proxy — but an entry that says
  nothing about proxying **leaves the proxy alone**. Upstream's switch has no
  default branch, and 52 of its 53 built-in entries take that path: selecting
  Cloudflare must not silently undo a configured proxy.
- **DNS Client**: one option **per address**, not per entry, formatted
  `Name {address}`, with this server always first. A `datalist` and not a select,
  because upstream's control is a text field with a dropdown attached: an address
  that is not on the list can still be typed.

16 tests over the three. 852 in total, `tsc` clean, 0 lint errors.

### What is left of 0.6

**F10, the cluster node selector on six screens.** Bigger than these three: not a
control but a filter that Dashboard, Zones, Cache, Allowed, Blocked, DNS Client
and both Logs screens each have to honour.

### F10 — the full contract, and the shape of the work

Read from `cluster.js`, `updateAllClusterNodeDropDowns`. **Ten selectors**, not
the seven the panes suggested, and they do not all behave alike:

| Selector | Aggregate option | Remembers the choice |
|---|---|---|
| Dashboard | **yes** — `Cluster`, and it is the default | `dashboardClusterNode` |
| Settings | **yes** — `Cluster`, and it is the default | `settingsClusterNode` |
| Zones · Edit Zone · Cached Zones · DNS Client · DHCP · Admin Sessions · Admin · Logs | no — they start on this server | no |

Three rules, all upstream's: the control exists only when the server reports
`clusterInitialized`; a node is listed as `name (type)` with the type lowercased;
and the two that offer the aggregate default to it while the other eight default
to this server.

Note `optEditZoneClusterNode`: the zone records view has its own, separate from
the Zones list. That is one of the four embedded detail screens, and it is a
reminder that the ten are not one per destination.

**Foundation done.** The API client takes a `node` and the server does the rest —
it proxies the whole request centrally, so no endpoint had to change.
`ui/ClusterNodeSelect.tsx` holds the three rules, with ten tests over the client
and the component.

**What remains** is wiring: each of the ten screens holding its node in state,
passing it to its calls, and the two that persist doing so. It is mechanical, but
it is ten screens and it changes which server answers — so each one is verified
on its own.


### F10, corrected: a deferral with the groundwork laid

Wiring the screens turned up what the first pass missed. The `node` parameter is
already threaded through the API layer and the component props of every affected
screen — `getSettings`, `listZones`, `listLeases`, `listScopes`, `listLogFiles`,
`queryLogs`, the records and apps calls — defaulting to empty, which is what
upstream sends on a single server. `dhcp/Leases`, `dhcp/Scopes` and
`logs/ViewLogs` already take a `node` prop and pass it on.

And it is documented at the site: *"Upstream's cluster node selector
(`optDhcpClusterNode`) is not mounted: this console has no cluster mode yet"*.

So F10 is real but smaller and better prepared than reported: **mount the
selectors and feed the parameter that is already travelling.** The finding was
published on a grep for "cluster" in files that call it "node".

### F10 wired: eight mount points for upstream's ten selectors

| Screen | Upstream's selector(s) | Aggregate | Remembers |
|---|---|---|---|
| Dashboard | `optDashboardClusterNode` | yes | `dashboardClusterNode` |
| Settings | `optSettingsClusterNode` | yes | `settingsClusterNode` |
| Zones | `optZonesClusterNode` **+** `optEditZoneClusterNode` | no | no |
| Cache / Allowed / Blocked | `optCachedZonesClusterNode` | no | no |
| DNS Client | `optDnsClientClusterNode` | no | no |
| DHCP | `optDhcpClusterNode` | no | no |
| Administration | `optAdminSessionsClusterNode` **+** `optAdminClusterNode` | no | no |
| Logs | `optLogsClusterNode` | no | no |

**One difference from upstream, recorded rather than hidden.** Two of its pairs
are collapsed into one control each: Zones and its records view share a state,
and so do Administration's sub-tabs. Upstream keeps them separate, which means it
can hold the zone list on one node while the records of a zone are read from
another.

That is a behaviour difference, small and deliberate: asking the same question
twice on one screen is a worse interface than asking it once, and nothing is
withheld — every screen upstream lets you point at a node still does. It is
listed here so the decision is somebody's rather than an accident, and it is a
candidate for the fourth entry in `CONVENTIONS.md`'s deviations list, which is
where it belongs if it stands.

## Phase 0.4 — re-measured with the contract that sees everything

Against the harness at 1440 px, after F8 and F10.

| Screen | fields | buttons | height | vs the first pass |
|---|---|---|---|---|
| Dashboard | – | 10 | 1545 | its period control is a `group`, see below |
| Zones | **11** | 38 | 678 | was 9: two comboboxes |
| Cache | 1 | 14 | **3583** | |
| Allowed / Blocked / Apps | 1 / 1 / – | 10 / 7 / 5 | 566 | |
| DNS Client | **6** | 4 | 566 | was 4: the restored list and a combobox |
| Settings › General | 54 | 11 | **5824** | |
| Settings › Web Service | 16 | 4 | 2336 | |
| Settings › Optional Protocols | 23 | 4 | 3060 | |
| Settings › TSIG | – | 5 | 566 | a table with no rows |
| Settings › Recursion | 12 | 4 | 1703 | |
| Settings › Cache | 15 | 4 | 1968 | |
| Settings › Blocking | **12** | 7 | 1754 | was 11: **Quick Add restored** |
| Settings › Proxy & Forwarders | **19** | 5 | 2010 | was 18: **Quick Select restored** |
| Settings › Logging | 12 | 4 | 1185 | |
| DHCP › Leases / Scopes | – | 8 / 8 | 566 | |
| Administration › Sessions / Users / Groups | – | 9 / 20 / 15 | 566 | |
| Administration › **Permissions** | **84** | 11 | 2491 | a matrix, edited in a dialog |
| Administration › SSO | 10 | 6 | 2047 | |
| Administration › Cluster | – | 2 | 566 | no cluster here |
| Logs › View Logs | – | 3 | 566 | |
| Logs › **Query Logs** | **15** | 11 | 578 | was 7 |
| About | – | 1 | 875 | |

Blocking and Proxy & Forwarders now match upstream's counts exactly, which is F8
closing from the other end.

### A third hole in the contract, found by the numbers not fitting

The walk reported Dashboard with **no controls at all**, and Query Logs with
none either. The second was a bad navigation in the walk — measured directly it
is 15. The first was the tool.

`ui/Segmented` is a row of buttons inside a `group` or a `tablist`: the
dashboard's period control, the settings sub-tabs. It takes input and offers
options, and v3 did not look for it. Fixed.

That is the same mistake v1 made with the combobox, one release later, and it is
worth saying why it keeps happening: **a contract that enumerates by asking for
known shapes will miss every shape nobody thought of.** It is caught here only
because a number looked wrong — a dashboard with zero controls — and the habit of
checking a number that looks wrong is what the last three of these have in
common.
