# How this console is built

Read this through before touching anything. It is short and it saves you the
mistakes that have already been made.

## The rule that rules them all: design only, zero functionality

This console **replaces the Technitium DNS Server interface without changing what
it does**. Same controls, same steps, **same texts**, same validation order. Any
behavioural difference from the upstream console is a bug, even when it looks
like an improvement.

If you catch yourself thinking "while I am here, this could be better": no. That
is a different job.

The exceptions are few, decided and written down: see
[Deliberate deviations from upstream behaviour](#deliberate-deviations-from-upstream-behaviour).
The largest is the Blocking section, which replaces Allowed and Blocked, and it is
the only one with written limits of its own.

## Where the reference is

The console this one replaces is not in this repository. You read it from the
server's own repository, which has to be added as a remote once:

```bash
git remote add upstream https://github.com/TechnitiumSoftware/DnsServer.git
git fetch upstream master

git show upstream/master:DnsServerCore/www/js/zone.js
git show upstream/master:DnsServerCore/www/index.html
```

**The alert texts are contract.** Pull them out of there with
`grep -o 'showAlert("[^"]*", "[^"]*", "[^"]*"'` and copy them literally, without
rewording.

## Do not assume the shape of the responses: check it

There are two disposable instances in `dev/`:

- `dev` at <http://127.0.0.1:5380>: serves our build
- `ref` at <http://127.0.0.1:5381>: the upstream console, untouched

User `admin`, password `technitium-ui-dev`. Bring them up with
`docker compose up -d` from `dev/`.

```bash
T=$(curl -s "http://127.0.0.1:5381/api/user/login?user=admin&pass=technitium-ui-dev&includeInfo=false" | python3 -c "import sys,json;print(json.load(sys.stdin)['token'])")
curl -s "http://127.0.0.1:5381/api/zones/list?token=$T" | python3 -m json.tool | head -40
```

Three assumptions that have already turned out false, so you do not repeat them:

1. **Not everything comes wrapped in `response`.** `user/login`,
   `user/session/get` and `status` return the payload **flat**. Everything else
   does wrap it. That is why `apiRequest` **unwraps nothing**: it hands over the
   JSON as it came.
2. The second-factor literal is **`2fa-required`**, not `two-factor-auth-required`.
3. The statistics are flushed **by the minute**. A `dig` you just ran does not
   show on the Dashboard until the next flush; do not conclude something is broken.

## Upstream behaviours discovered along the way

Write down here whatever you find. What is already known:

- **Optional fields that look required.** In `apps/list`, the `updateVersion`,
  `updateUrl` and `updateAvailable` fields **only exist** if the app is in the
  store catalog and there is a compatible version there; an app installed from
  your own zip never brings them, and if the catalog query exhausts its 5 s
  timeout the list arrives whole but without them on any app. Typing them as
  required is a guaranteed bug. Be suspicious of every field you have only seen
  once.
- **A text field can come back as `null`.** `apps/config/get` returns
  `config: null` as soon as someone saves an empty configuration.
- **The upload endpoints are POST-only**: by GET the server answers **404**, not
  a JSON error.
- **On uploads, the file field name does not matter**: the server takes
  `Form.Files[0]`. But **do not set `Content-Type` by hand** or the `boundary`
  is lost and the server says the file is missing.
- **Deleting something that does not exist usually answers `ok`**, not an error.
- **There are two different paginations.** `zones/list` paginates on the server
  (`pageNumber`, `zonesPerPage`) and its paging fields **only appear if you send
  `pageNumber`**. `zones/records/get`, on the other hand, **does not paginate**:
  it is asked for with `listZone=true` and paginated on the client.
- **Where an alert comes out is not cosmetic**: in upstream, a modal's alerts
  come out inside the modal and a screen's come out on the screen. Honour it.
- **The server can return a domain different from the one you asked for.** When
  navigating the cache/allowed/blocked tree, `WebServiceOtherZonesApi.cs`
  **walks down on its own** while the node has no records and has exactly one
  child. Always draw `response.domain`, **never** the domain you asked for, or
  the tree and the table fall out of sync.
- **The same field can have two types depending on the endpoint.** In
  `cache/list` the `ttl` is an already-composed string (`"218 (3m38s)"`); in
  `allowed/list` and `blocked/list` it is a number with `ttlString` apart. Same
  with a SOA's `refresh`, `retry`, `expire` and `minimum`. Typing the records
  with a single shape is a guaranteed bug.
- **`0001-01-01T00:00:00` is .NET's `default(DateTime)`**: it means "never", not
  year 1.
- **Visibility rules that look the same and are not**: deleting a node is
  offered in cache if the node is not the root, and in allowed/blocked if the
  node has records. Do not make them uniform without looking.
- **A count may not be where you draw it.** `blocked/list` only reads the
  manually blocked zones; the downloaded block lists are counted **only** in
  `dashboard/stats/get` (`blockListZones`).
- **Careful with replicating the intent instead of the behaviour.** In
  `other-zones.js` there are three `domain.toLowerCase();` **without assigning
  the result**: they do nothing. What the code does is replicated, not what it
  looks like it wants to do.
- **`settings/get` OMITS the null keys**, it does not send them as `null`:
  fields like `temporaryDisableBlockingTill` or `blockListNextUpdatedOn` simply
  do not appear on a freshly installed server. Others do arrive as an explicit
  `null`. Declaring them required fails against a new install. And
  `blockListNextUpdatedOn` is not only a fresh-install gap: it is written only
  while a block list update is scheduled (WebServiceSettingsApi.cs:382-386), so
  saving an empty list makes it vanish from the answer. Settings › Blocking and
  the Lists tab of Blocking both read its absence as "Not Scheduled".
- **`logs/query` filters by ONE `responseType`** (WebServiceLogsApi.cs:182-185),
  but the Dashboard's `totalBlocked` adds up three: `Blocked`, `UpstreamBlocked`
  and `UpstreamBlockedCached` (StatsManager.cs:329-341). "The latest blocked
  queries" is therefore three queries, merged by time: that is what Recently
  Blocked does (`api/blocking.ts`).
- **Careful with `\r\n` when replicating a list textarea.** Upstream builds its
  textareas with `\r\n`, but the browser normalises to `\n` when reading the
  value of a `<textarea>` from the DOM, and its cleanup only substitutes `\n`.
  In React there is no intermediate DOM to normalise: copying the literal
  `\r\n` sends `forwarders=1.1.1.1%0D,8.8.8.8%0D` to the server. **It bites any
  screen with lists in a textarea.**
- **An empty list travels as the string `"false"`**, it is not omitted: it comes
  out of concatenating a boolean into the query. With three exceptions that fall
  to their default value.
- **A screen with sub-tabs can be ONE SINGLE form.** In Settings, "Save" sends
  the fields of all nine sub-tabs wherever you are. Chopping it up per tab would
  change what gets saved.
- **An action bar can mix different permissions**: in Settings, saving requires
  `Settings.canModify`, flushing the cache `Cache.canDelete` and the backup
  `Settings.canDelete`.
- **Asymmetric permissions**: some actions ask for `Delete` where you would
  expect `Modify`, and `apps/list` is allowed with read permission on Apps,
  Zones **or** Logs. Do not deduce the permission: look at it.
- **Not every endpoint returns JSON.** `logs/download` answers `text/plain` with
  the file when it goes well and `application/json` with the usual envelope when
  it fails. It cannot go through `apiRequest`: that would do `res.json()` and
  turn any log into a network failure. Upstream asks for it with
  `isTextResponse` and, if what arrives carries `status`, draws it **formatted
  inside the viewer itself**, as if it were the file's content
  (logs.js:170-172). The error does not come out as an alert.
- **Two endpoints of the same family can call the same datum differently**: the
  log file is asked for with `fileName` in `logs/download` and with `log` in
  `logs/delete`. And `logs/list` returns the name **without extension**, which
  is the one to send in both.
- **Confirming or not confirming is not symmetric.** In DHCP, disabling a scope
  and deleting it both ask; **enabling it asks nothing** (dhcp.js:583 vs 615).
  Only the path that cuts the service asks.
- **`dhcp/scopes/set` is a PARTIAL update**: each field is applied only if it
  comes in the request (`WebServiceDhcpApi.cs:390-650`), so a body with only
  `name` and `newName` renames without touching anything else (checked against a
  v15.4 instance). Upstream always sends all 36. And **a scope created with this
  endpoint is born enabled**, even though nothing says so.
- **`dhcp/scopes/get` OMITS fifteen optional keys** instead of sending them
  `null`: `domainName`, `domainSearchList`, `serverAddress`, `serverHostName`,
  `bootFileName`, `routerAddress`, `dnsServers`, `winsServers`, `ntpServers`,
  `ntpServerDomainNames`, `staticRoutes`, `vendorInfo`, `capwapAcIpAddresses`,
  `tftpServerAddresses`, `genericOptions` and `exclusions`. `reservedLeases` is
  the exception: it is always written, even as `[]`. Same for `interfaceAddress`
  in `scopes/list`.
- **A field can be omitted on purpose when saving**: with "Use This DNS Server"
  checked, upstream **does not send `dnsServers`** (dhcp.js:565). The server
  keeps the stored ones and `scopes/get` still returns them, so the list you see
  on screen is not the one that was just sent.
- **"Deleting something that does not exist answers `ok`" has exceptions.**
  `dhcp/scopes/delete` on a non-existent scope answers `ok`, but
  `dhcp/leases/remove` on a non-existent lease answers **error**
  (`No lease was found for client identifier: …`).
- **Two alerts that look like the same one and are not.** In Query Logs, the
  "the app is missing" one ends in "…from the Apps section." when "Query" fires
  it and **does not** when "Export" does (logs.js:391 vs 614). Copying one into
  both places changes a text.
- **The last page is asked for with `pageNumber=-1`**: the server resolves it.
  That is what the "Last" link of Query Logs does (logs.js:589), verified
  against the reference instance.
- **The `ts` cache-buster goes on only two of the six downloads**: the settings
  backup (main.js:3100) and `logs/download` (logs.js:196). `logs/export`,
  `zones/export`, `allowed/export` and `blocked/export` **do not carry it**. The
  server ignores it, but the URL that gets opened is not the same.
- **A form filter can live in `localStorage`**: "Logs Per Page" is stored under
  the key `optQueryLogsEntriesPerPage` and re-read on every reset (logs.js:23-26
  and 63-65). Careful: the form's default value is **10** and the server's is
  **25** (`WebServiceLogsApi.cs:162`); the form's wins because upstream always
  sends the parameter.
- **`serializeTableData` decodes TWICE.** It applies `htmlDecode` to a value the
  browser had already decoded when parsing the HTML, so typing `&amp;` in a cell
  sends `&`. In React there is no intermediate HTML: replicating it would mean
  introducing the bug by hand, and that is not done.
- **A `set` can return less than its `get`, and what is missing has to be kept.**
  `admin/sso/set` does NOT bring `localGroups`: `WriteSsoConfig` only writes them
  with `includeGroups` and the `set` calls it with `false`
  (WebServiceAuthApi.cs:1790). Upstream survives because it stored them in a
  global variable when doing the `get`. Reloading the form with the save
  response without keeping them leaves the group-map dropdowns empty.
- **A secret can come back MASKED and has to be sent back that way.**
  `admin/sso/get` returns `ssoClientSecret: "************"` as soon as one is
  stored, and `SetSsoConfig` ignores that exact value
  (WebServiceAuthApi.cs:1738). It is what allows saving the form without typing
  the secret again: clearing the field "because it looks like filler" would
  delete the real secret.
- **The same action can send different parameters depending on where it is
  fired from.** `admin/sessions/delete` ALWAYS travels with `node` from the
  Sessions tab (the primary node if the session is an API token, the chosen node
  in any other case) and **with no `node` at all** from the user details modal
  unless it is an API token (auth.js:1050 vs 1382).
- **A checkbox can change the ENDPOINT, not a parameter.** The cluster's "Force
  Remove Node" picks between `primary/deleteSecondary` and
  `primary/removeSecondary`; "Force Leave" and "Force Delete" in the same block
  really are parameters. They cannot be made uniform.
- **Deleting something that does not exist does NOT always answer `ok`.**
  `admin/sessions/delete` with an invented partial token answers `error` with
  "No such active session was found for partial token: …". Checked live against
  a v15.4; it is the exception to the rule noted above.
- **The group list depends on the endpoint that serves it.**
  `admin/permissions/get?includeUsersAndGroups=true` includes `Everyone` and
  `admin/groups/list` does not; `admin/sso/get?includeGroups=true` excludes it on
  purpose (WebServiceAuthApi.cs:383). Three group lists, three contents.
- **Two sibling endpoints can return different shapes of the same object.**
  `admin/groups/create` answers `{name, description}` and `admin/groups/set`
  also answers `members`. Same with the user: `users/get` brings `groups` (all
  the server's), `users/set` does not bring it even though it does bring
  `memberOfGroups` and `sessions`, and `users/list` and `users/create` bring
  none of the three. Checked live.
- **Half the response disappears when the cluster is not initialised.**
  `admin/cluster/state` on a standalone server is THREE fields: `version`,
  `dnsServerDomain` and `clusterInitialized`. `clusterDomain`, the four
  intervals and `clusterNodes` only exist with a cluster
  (WebServiceClusterApi.cs:60-75). And within a node, `upSince`, `lastSeen` and
  `configLastSynced` are **omitted** when they hold `default`, they do not
  arrive as `null`.
- **The cluster's "Quick Add" compares by SUBSTRING.** `cluster.js:30` uses
  `existingList.indexOf(ip) < 0`, so with `10.0.0.10` already in the list the IP
  `10.0.0.1` is never added. It is a bug of theirs and it is replicated: what
  the code does is copied, not what it looks like it wants to do.
- **A success alert dismisses itself after 5 seconds.** `showAlert`
  (common.js:212) schedules a `hideAlert` for `success` alerts and only for
  those. It is replicated here.
- **A whole section may filter NOTHING by permission.** Inside Administration,
  upstream checks `Administration.canView` to show or hide the section
  (main.js:165 and 240) and from there shows every button, letting the server
  reject. Adding client-side gating there would be adding behaviour, not
  protecting it.
- **Asymmetric permissions, the concrete Administration case**:
  `permissions/set` and `sso/set` ask for `Administration.canDelete`, not
  `canModify` (WebServiceAuthApi.cs:1533 and 1692). In the cluster, nearly
  everything asks for `canDelete` (including `init`, `initJoin` and `promote`),
  but `setOptions`, `resync`, `updatePrimary` and `updateIpAddress` ask for
  `canModify`.
- **`zones/list` OMITS `dnssecStatus` and `hasDnssecPrivateKeys` on Catalog and
  Forwarder zones**, and the Catalog also omits `catalog`. They are types that
  cannot be signed, so the server does not even write the fields. Declaring them
  required lies about half the list and in TypeScript it shows late.
- **The same table calls the same column differently.** In
  `zones/permissions/get`, a user permission brings `username` and a group one
  brings `name`. Treating them as the same shape leaves half the table blank.
- **`records/delete` has no branch for CNAME, DNAME, SOA or APP**: all four fall
  to the `default`, which only sends `rdata` if it exists, and it exists for
  none of them. The server receives zone+domain+type and nothing else. And
  **deleting an NS does not send `glue`, but disabling it does**: same pair of
  actions, different set of parameters.
- **Disabling a record reads the expiry TTL FROM THE MODAL, not from the row**
  (`updateRecordState`, zone.js:6236). If the modal has never been opened, it
  sends the empty string; if it was opened, it sends whatever was left inside.
  It is an upstream bug: it is replicated, and that is why the records screen
  drags that value along.
- **A record filter starting with `*` looks for the literal wildcard**, it does
  not list everything: after converting the glob to a regex, `showEditZonePage`
  rewrites a leading `.*\.` to `\*\.`. It serves to find the `*.zone` record,
  which in DNS really is called that. It looks like a bug and it is not.
- **The name filter without a wildcard is EXACT**, not "contains": typing `www`
  does not find `www.sub`. And it lowercases what you typed but **not** the zone
  name.
- **`zones/create` is a POST with the parameters in the QUERY**: the body is
  reserved for the optional zone file (`fileImportZone`). Without a file,
  upstream sends a POST with no body at all.
- **`zones/import` has TWO ways of sending the file**: uploading it goes as
  multipart and pasting it into the textarea goes as **raw plain text** with
  `Content-Type: text/plain`. The server tells them apart by that type.
- **The bulk zone delete uses the SAME endpoint** with the parameter in plural
  (`zones=`, comma-separated) and returns `deleted` and `failed`. When some
  fail, the alert is NOT an error: it is a `warning` counting how many.
- **The pagination window slides backwards on reaching the end**: on the last
  page the last ten are visible, not just one. And the last is asked for with
  `pageNumber=-1`: the server resolves it.
- **In the zone options, six empty lists travel as the string `"false"` and two
  do NOT**: `primaryNameServerAddresses` and `queryAccessNetworkACL` travel
  empty as they are. It is not symmetry; it is what `saveZoneOptions` does.
- **A zone that is a member of a catalog inherits its options**, and that
  governs the whole interface of `modalZoneOptions`: if the catalog does not let
  it override a section, that tab DISAPPEARS; if it does, it appears editable;
  and if a secondary catalog administers it as well, it appears read-only.
- **The tab that comes up open in the zone options is not the first**: on a
  Catalog it is "Query Access", and on a Primary it depends on whether there are
  catalogs available.
- **`convertZone` offers only three destinations** (Primary, Forwarder and
  Catalog), and which of them are enabled depends on the source through a table
  that follows from nothing: a Primary can only go to Forwarder.
- **The year has to be padded to four digits.** `0001-01-01T00:00:00` is .NET's
  `default(DateTime)` and turns up on every unused record; without padding,
  `getFullYear()` gives "1-01-01", which is not what moment writes.
- **In "Add Zone", the Catalog type shows NOTHING**: it has no branch in the
  visibility `switch`, so only the name and the type remain.
- **"Secondary ROOT Zone" is not a type**: it is a Secondary with the root
  server addresses preloaded, `zoneTransferProtocol=Tcp` and `validateZone=true`.
  The type that travels is `Secondary`.
- **The labels and the values of the DNSSEC dropdowns do not match**: you see
  "SHA256 (default)" and `SHA256` travels; you see "Ed25519 (default)" and
  `ED25519` travels in UPPERCASE.
- **In the DNSSEC properties, `isRetiring` switches off every action** of a key,
  and the automatic rollover only exists for ZSKs.
- **Since v15.5 a user has a `type`, and a remote user LOSES a field.** `user/login`,
  `user/session/get`, `user/profile/get` and every `admin/users/*` bring `type`
  (`Local`, `RemoteSSO`, `RemoteLDAP`) next to the obsolete `isSsoUser`, and
  **`totpEnabled` is omitted for a `RemoteSSO` user**, not sent as `false`
  (WebServiceAuthApi.cs:77-82 and 140-146). In the details, `ssoManagedGroups` is
  now written ONLY for SSO users and `remotelyManagedGroups` for every type
  (`false` for `Local`, lines 158-172). A screen still reading `ssoManagedGroups`
  unlocks the groups of every LDAP user. Checked live against v15.5.1.
- **`admin/ldap/get` on a fresh install is half `null`**: `ldapServer`,
  `ldapBindUsername`, `ldapBindPassword`, `ldapSearchBase`, `ldapUserSearchFilter`
  and `ldapGroupAttribute` arrive as `null`, `ldapPort` as `389`, and
  `ldapAllowSignupOnlyForMappedUsers` is **`true` while `ldapAllowSignup` is
  `false`**: the box comes up checked and disabled. `ldap/set` repeats SSO's
  lesson and drops `localGroups` (line 2136). Checked live against v15.5.1.
- **"Test Connection" is not a dry run of "Save".** It validates server and port
  even with LDAP disabled, ignores the group map and never asks the "Ignore SSL"
  confirmation (auth.js:2526-2541). The server fills any missing parameter from
  the STORED config and swaps the masked password for the stored one
  (WebServiceAuthApi.cs:2146-2160). Its error answers with no `response` key at
  all: `{"server", "status": "error", "errorMessage"}`.
- **`zones/export` answers an error with HTTP 200 and JSON**, the file with
  `text/plain`: a missing zone gives `{"status":"error","errorMessage":"No such
  zone was found: …"}` and a bad token `invalid-token`, both 200. The v15.5 "Edit
  Zone File" dialog reads it as text and, like `logs/download`, puts any answer
  carrying `status` FORMATTED into its textarea (zone.js:1262-1263 in v15.5.1): no
  alert, not even for `invalid-token`. Checked against v15.5.1.
- **`zones/import?overwriteZone=true` replaces the WHOLE zone, NS included.** A
  file with only SOA+NS+one A leaves exactly that; an EMPTY `text/plain` body
  answers `ok` and leaves the SOA alone. An unparsable file fails before
  touching anything, with `errorMessage` ("The zone file parser failed to parse
  'rdata' field on line # 1.") AND `innerErrorMessage` ("An invalid IP address was
  specified."); upstream shows only the first. With `overwriteSoaSerial=false`
  the serial is not kept either: the server bumps it. Checked against v15.5.1.
- **"Edit Zone File" never sends `overwrite`** (zone.js:1293): the server
  defaults it to `true` (WebServiceZonesApi.cs:1930). And its textarea is never
  cleared on opening, only overwritten when the read succeeds. After a read that
  never arrives, "Save" (always enabled) would send what the previous opening
  left, possibly another zone's file. Replicated; clearing it instead would send
  an empty file, which with `overwriteZone=true` empties the zone.
- **Saving a zone file reloads the zone, never the list** (zone.js:1302-1303):
  from the list's row menu nothing is refreshed afterwards.
- **What "Save Settings" sends depends on the node selector** (main.js:1639-1644).
  `node=""` sends every block, `node=cluster` only the cluster-wide ones (default
  values, EDNS/QPM/advanced, TSIG, Recursion, Blocking, Proxy & Forwarders) and a
  node name only that node's own (local parameters, IPv6/socket pool, Web Service,
  Optional Protocols, Cache, Logging). A skipped block skips its VALIDATIONS too.
  On a standalone server the selector is hidden and holds an empty `<option>`
  (cluster.js:1047-1049), so the stock console loads `settings/get?node=` and
  saves `node=&…`, never `cluster`, which there would drop every node
  parameter. Checked on the stock v15.5.1 of the harness. Flush, backup and
  restore take the same selector's node.
- **The envelope's `server` is the domain of the server that ANSWERED**, written
  after the handler runs (DnsWebService.cs:2478): after a rename it already
  carries the new name, and on a proxied request it is the chosen node's. Upstream
  follows the web console to its new address only when it equals the session's
  domain, which `updateDnsSettingsDataAndGui` has just rewritten for `node=""` or
  the own node (main.js:2208-2217, 3177-3188).
- **After a save or a restore the console may navigate on its own**: 2.5 s later
  it opens the new HTTP/HTTPS address in the same tab (`checkForWebConsoleRedirection`,
  main.js:2293), unless the LAST LOAD decided a reverse proxy is in front
  because the page's port is not the web service's (`checkForReverseProxy`,
  main.js:2275). In the harness `ref` is published on 5381 while its web service
  listens on 5380, so there the proxy is always "detected" and nothing redirects;
  `dev` is 5380 on both sides and does follow a port change.
- **Some notes quote the LOADED settings, not the fields.** The DoH/DoT/DoQ/DoH(S)
  addresses and both real-IP header notes are written by `loadDnsSettings`
  (main.js:1303-1304, 1356-1357, 1369-1372): typing a new port or header does not
  change them until the next load or save. Their initial HTML text
  (`localhost:8053`, `tls-certificate-domain:853`) is a placeholder, not contract.
- **Since v15.6 prefetching has its own switch, `enableCachePrefetch`**, true on a
  fresh install. A Prefetch Trigger of 0 no longer turns it off; instead, a config
  saved by an older server with the trigger below 1 loads with the switch off
  (DnsServer.cs, config version 7). A v15.5 server neither sends nor reads the key,
  so this console shows it unchecked there and the save is harmless. Checked live
  against v15.6.0 and v15.5.1.
- **A cluster node's `version` (v15.6) is not always there.** The node itself
  always carries it; another node only once a heartbeat has brought it. Right
  after a join the secondary appears without it and in state `Unknown`, and about
  30 s later as `Connected` with `15.6`. Checked live on a two-node v15.6.0 cluster.
- **The row menus' jumps carry their arguments as TEXT.** Query Logs writes
  `queryDnsServer(…, '<qtype>', '<node>')` into the `onclick` (logs.js:525), so a
  row without a type sends the string `"null"` and DNS Client does NOT default it
  to "A"; the Dashboard passes a real `null` and does get "A" (main.js:2824,
  dnsclient.js:232). Both jumps pick the target's node only when given one that is
  not `cluster` (dnsclient.js:243, logs.js:634); from the Dashboard's aggregate
  the target keeps the node it had. `allowDomain`/`blockDomain` send no `node` at
  all: they always act on the server the console is on.
- **The Top Stats modal follows the Dashboard's node and keeps its own alerts.**
  It reads `optDashboardClusterNode` for `getTop` (main.js:2932), and allowing or
  blocking from it reports in `divTopStatsAlert`, inside the modal, while the same
  action from the Dashboard's panels reports on the page (main.js:2986 vs 2825).
- **The same action can be worded differently per table.** Opening a user is
  "View User Details" in the Sessions row menu (auth.js:938) and "View Details" in
  the Users one (auth.js:1191).

## How the code is written

- **Client**: always `apiRequest` from `src/api/client.ts`. Paths **relative and
  without a leading slash** (`'zones/list'`), because the server honours
  `X-Forwarded-Prefix`.
- **One `src/api/<family>.ts` file per endpoint family**, with its types. It
  should return data that is already usable, and `null` or an empty list on
  failure, but only where an empty result and a failure cannot be confused. If
  the screen would draw them the same, return the whole `ApiOutcome`: saying
  "no queries for this period" when the call never arrived is worse than an
  error.
- **Primitives** in `src/ui/`: `Button`, `Alert`, `Field`/`LabeledInput`,
  `Dialog`. Do not invent loose buttons or fields.
- **Colours always by token** (`var(--acc)`, `var(--ink)`…). Not one `#hex`,
  `rgb()`, named colour or colour inside an inline SVG outside
  `src/theme/tokens.css`, and inside it only in a theme block
  (`:root, [data-theme='dark']`, `[data-theme='light']`), so every colour is one a
  theme can redeclare. `color-scheme` too: only a theme block declares it, and
  every element inherits it. **`npm run lint:colours` (`dev/check-colour-tokens.mjs`)
  enforces it**, and `npm test` runs it too. What genuinely cannot be a token (the
  white behind the 2FA QR code) is allowed by file and literal in that script, with
  its reason.
- **One CSS module per component** (`X.module.css`).
- **Spacing, type and radii by token too.** In a `*.module.css` you do not write
  a px that is not one of the tokens in `theme/tokens.css`. A loose value is
  future drift: that is how the console reached 13 text sizes and 25 paddings.
- **Upstream's themes, without Amber.** System (the default), Light and Dark,
  picked in `Change Theme` (deviation 1 below). Each theme declares its colours in
  its own block of `src/theme/tokens.css`, and `npm run lint:colours` fails if the
  light block leaves out a colour the dark one declares. A theme is measured before
  it ships: contrast and chart distance against each one, not only against dark,
  with `node dev/theme-contrast.mjs` (every text and control token on every
  surface it is drawn on) and `node dev/palette-distance.mjs` (the chart series).
- **Everything is in ENGLISH**: the interface, the code, the comments and the
  tests. The console is `lang="en"` and the destination is a pull request
  upstream. **`npm run lint:language` is what enforces it**, and it exists because
  the rule was broken for three weeks without anybody noticing: the visual
  redesign left 1,098 pieces of Spanish across 67 files (comments, identifiers and
  nineteen file names) while the interface stayed English and every other gate
  stayed green. A rule nothing measures is a preference.
- **No `BrowserRouter`**: the server's only `MapFallback` is `/api/{*path}`.
- **No CDN and no fonts in `data:`**: the server's CSP does not declare
  `font-src`. Images in `data:` are fine (`img-src 'self' data:`).

## Tests

- `npm test`: vitest. **Do not run `npm run build`** if someone else is
  working in the same checkout: it writes into `dist/` and you would step on each other.
- Every screen needs tests for: **the literal alert texts**, the **validation
  order**, which endpoint is called and with what body, and the behaviour with
  empty data.
- Query by label (`getByLabelText`), not by class.
- **Do not assume a call is the first one**: find it.
  `spy.mock.calls.find(c => c[0] === 'zones/list')`.
- With fake clocks, `findBy*` does not work: use
  `vi.useFakeTimers({ shouldAdvanceTime: true })` and
  `userEvent.setup({ delay: null })`.
- **No apostrophes in a test description written with single quotes.** "the
  server's failure" inside `it('…')` does not parse, and it takes the whole file
  with it. Reword it: "the failure from the server".

## Deliberate deviations from upstream behaviour

The rule is "zero functionality", but there are five exceptions, **decided and
written down**. If you find a sixth, do not introduce it on your own: report it.

1. **Amber is not offered** (Adrián's decision). `Change Theme` is back as
   upstream has it: in the account menu, under the same `localStorage` key,
   `theme`, as the stock console (same origin, so a choice made in one holds in
   the other), with `system`, `light` or `dark`. System is the default and follows
   `prefers-color-scheme` live; a radio applies on click; nothing is written on
   load. Only the Amber radio is missing: a stored `amber` draws dark, is not
   overwritten, and the dialog shows no radio checked until the user picks. It is
   still the only one that *removes* something. The rules are in
   `src/theme/theme.ts`.
2. **The Blocking section** (`src/screens/blocking/`; what it offers is listed
   in the CHANGELOG, v1.2.0). It replaces Allowed and Blocked
   with Overview, Rules and Lists. Its Quick Add also offers the console's own
   catalogue (`extra-lists.json`) after Technitium's, and a search field.
   It is the only one that *adds* a screen. It stays inside four limits, and a
   change that crosses one is a bug:
   - **only endpoints the server already has**, and only ones upstream's console
     already calls. `dev/check-endpoints.mjs` measures the other direction
     (upstream's endpoints this console covers), so a new path is checked by
     hand against upstream's `www/js`;
   - **upstream's actions, sentences and call sequences**: `Allow Domain` is
     still `blocked/delete` then `allowed/add` (`api/blocking.ts`);
   - **what is ours is in English and says so** in the header comment of its
     file;
   - **Settings › Blocking is untouched**: the Lists tab edits the same
     `blockListUrls`, through the same cleaning (`list-lines.ts` calls
     Settings' `cleanList`).

   Two behaviours a maintainer would not guess:
   - **`/allowed/` and `/blocked/` still exist as folders.** They are legacy
     routes (`LEGACY_ROUTES` in `app/static-routes.ts`): `translateLegacyRoute()`
     in `app/route.ts` rewrites them, with `replaceState`, to
     `blocking/rules/?rule=allowed|blocked` before the route is read, so old
     bookmarks land on the filtered Rules tab.
   - **`?rule=` belongs to Rules alone.** `Blocking.tsx` strips it on switching to
     Overview or Lists and on leaving the section, by replacing the current
     history entry, which is the Rules one. So Back after leaving Rules returns
     to Rules showing All, not the filter the user had. That is deliberate:
     keeping it would mean teaching `writeRoute` about one section's query.
3. **Settings jumps to the sub-tab of the invalid field.** Upstream focuses a
   hidden input and the user sees nothing; with one panel mounted at a time,
   without that jump the alert would be impossible to resolve.
4. **The "Enable DNS-over-HTTP/3" checkbox re-enables itself.** In upstream it
   stays dead until the page is reloaded because nothing re-evaluates its state:
   that is a bug of theirs, and replicating it would mean introducing the fault
   on purpose.
5. **Last Hour moves in real time** (Adrián's decision, 2026-10-03). Between the
   60-second reloads the ten count tiles, the Queries chart and the Query
   Response Types doughnut follow the server's lifetime counters
   (`dashboard/metrics/json`), read every 2 seconds (`dashboard/live.ts`,
   `dashboard/useLive.ts`). Its limits, and crossing one is a bug:
   - **only that endpoint**, which upstream documents in APIDOCS.md and its
     console does not call; `check-endpoints.mjs` counts upstream's endpoints, so
     it does not object;
   - **Clients, Query Types, Protocol Types, the tops and the Server panel never
     move**: the counters do not carry them, and distinct clients do not add up;
   - **if the endpoint fails three times in a row, live mode stops** until the
     next reload, and the Dashboard is exactly the stock console's;
   - **a hidden tab reads nothing**, the minute refresh included, and coming
     back reloads at once. That pause is the only change to an upstream request.

## Four constraints the server imposes

These are not preferences: break them and the console works in development and
fails in production.

- **`base: './'`.** The server honours `X-Forwarded-Prefix` and mounts a
  `PathBase`. With absolute paths the console works locally and 404s behind a
  reverse proxy with a prefix. `dev/check-prefix.sh` checks it.
- **Real routes, one folder per route.** The server's only `MapFallback` is
  `/api/{*path}`, so a deep route with no file on disk would 404. The build emits
  one folder with its own `index.html` for each of the console's 34 routes (11
  sections and 23 sub-sections, from `SECTIONS`), plus the two legacy folders
  `/allowed/` and `/blocked/`: 36 in all. The URL is real (no `#/`) and F5 brings
  you back where you were, without touching a line of C#. See `vite.config.ts` and
  `app/static-routes.ts`.
- **Content-Security-Policy**: `default-src 'self'; script-src 'self'
  'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self'
  data:`. There is no `font-src`, so **the fonts have to be files served from the
  same origin**: a font embedded as a `data:` URI inherits `default-src 'self'`
  and does not load. No CDN is possible either.
- **`public/` holds the assets the server or the console still need**:
  `favicon.ico`, `robots.txt`, `img/` (including `oidc.png`, which the login uses)
  and `json/*-builtin.json`. The build emits them again.

## Closing

When you finish, write down which endpoints you covered and **any upstream
behaviour you discovered that was not already noted**. That last part is the
most valuable thing you can contribute.
