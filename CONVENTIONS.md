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
The largest is the Blocking section, which replaces Allowed and Blocked. Those that
add something carry written limits of their own.

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
  store catalog and there is a compatible version there. They go by the app's
  NAME, not by where it came from: a store app's zip uploaded under another name
  brings none of them, and the same zip uploaded under the store's name brings all
  three (checked against v15.6.1 on 2026-11-06). If the catalog query exhausts its 5 s
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
- **Quick Select forgets the Bypass List.** Picking a forwarder that carries a
  SOCKS5 or HTTP proxy (Tor) ticks the proxy type and enables its address, port,
  username and password, but not the Bypass List (main.js:594-603): it stays
  disabled until the proxy radio is clicked again. That is an omission, not a
  rule, and it is not replicated: here the five fields follow the proxy type.
- **Picking the line already chosen does nothing.** A native `select` fires
  `change` only when the value changes, and several stock lists rely on it
  (Group Details' "None" empties Members; Quick Add would add a deleted key
  back). `ui/Select` does the same, and the Quick Add and Quick Select lists
  keep the line chosen, as the stock ones do, until their form loads again.
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
- **The Dashboard's count cards are links to Query Logs since v15.6.2**
  (index.html:205-257, logs.js:21-24). Nine of the eleven: Total Queries with no
  filter, the four response codes filling `RCODE` and the four response types
  filling `Response Type`; Clients and Dropped are not links. The jump passes no
  node and no period, so Query Logs keeps its node and its empty `From`/`To`, even
  with the Dashboard on another node or period. Here each card carries the jump
  in `dashboard/metrics.ts` (`open`).
- **The Top Stats modal follows the Dashboard's node and keeps its own alerts.**
  It reads `optDashboardClusterNode` for `getTop` (main.js:2932), and allowing or
  blocking from it reports in `divTopStatsAlert`, inside the modal, while the same
  action from the Dashboard's panels reports on the page (main.js:2986 vs 2825).
- **The same action can be worded differently per table.** Opening a user is
  "View User Details" in the Sessions row menu (auth.js:938) and "View Details" in
  the Users one (auth.js:1191).
- **A blocked answer says why, but only in one setting and never for "allowed".**
  With `allowTxtBlockingReport` on (the default), a blocked query carries an
  Extended DNS Error with `InfoCode: "Blocked"` and `ExtraText`
  `source=blocked-zone; domain=<rule>` (DnsServer.cs:4672) or
  `source=block-list-zone; blockListUrl=<url>; domain=<entry>`
  (BlockListZoneManager.cs:893), one option per list that carries the name, the
  same for every blocking type; `dnsClient/resolve` returns it in
  `result.EDNS.Options` and again in the OPT record of `Additional`. `domain` is
  the entry that matched, a PARENT of the name asked when a rule or a list covers a
  whole zone. With the setting off the answer carries nothing. Nothing marks an
  answer as allowed by an allow rule, and an unrelated `Synthesized` option ("Result
  from negative cache") can sit in the same list. The client library adds its own
  `DnsClientExtendedErrors` (`BlockedByUpstreamDnsServer`), which names no reason.
  A name the server refuses (`not a domain`) is an `error` envelope with no
  `response` at all. Checked live against v15.6.1 on 2026-10-15
  (`screens/blocking/check-domain.real.json`).
- **A cached negative answer is a record of the type asked**, not a marker of its
  own: its `rData` is `{ dataType: "DnsSpecialCacheRecordData", data:
  "NegativeCache: NxDomain; …" }` (or `NoError; …` for "no record of that type")
  and its `dnssecStatus` is `Unknown`. With Serve Stale on (the default), expired
  records stay in `cache/list` and the server writes their TTL as `"0 (0s)"`
  (WebServiceZonesApi.cs:120-125). With a forwarder, `responseMetadata.nameServer`
  is the bare address (`1.1.1.1`). Checked live against v15.6.1 on 2026-11-06
  (`screens/lists/cache-node.real.json`).
- **`logs/download?limit=2` sends the first 2 MB from offset 0** (LogManager.cs:657-676),
  not the tail, so the viewer of a large file shows its oldest lines. `logs/list` sorts by
  path descending, so newest first only holds because files are named by date. Sizes come
  written (`6 KB`, `24.44 KB`, `2.39 MB`).
- **The permission sections are named as the server names them**: `DnsClient` and
  `DhcpServer`, not "DNS Client" and "DHCP"; upstream draws them as they come. Upstream's
  Users row menu says plain `Enable` / `Disable`.
- **`recordDataTemplate` is left out, not `null`,** on an app class that serves no
  APP records (`apps/list`, v15.6.1).
- **A lease's `hostName` comes back with the scope's domain appended** (`build-01.lab.lan`
  for a client that sent `build-01`), and is `null` when the client sent none (v15.6.1,
  2026-11-06).
- **A reserved lease is not in `dhcp/leases/list` until a client takes it.**
  `ListDhcpLeases` walks the leases clients hold, never the reservations; upstream
  marks a held lease `Reserved` when its client has a reservation. An enabled scope
  with no matching interface reports `interfaceAddress: "0.0.0.0"`. A reservation
  inside an exclusion range is still handed out. Checked live against v15.6.1 on
  2026-11-06 with real DHCP clients.
- **`dnsClient/resolve` with validation on can answer a failed validation with
  the DNSKEY/RRSIG datagram** carried by the exception, plus `warningMessage`: an A
  query for `dnssec-failed.org` gets DNSKEY records back. `rawResponses` are whole
  datagrams, not strings. Upstream calls it with `showInnerError: true`, so its
  error reads `errorMessage` and then `innerErrorMessage` (common.js:165).

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
- **A name is never cut letter by letter.** `word-break: break-all`,
  `word-break: break-word` and `overflow-wrap: anywhere` are refused by
  `npm run lint:breaks` (`dev/check-word-breaks.mjs`, also run by `npm test`) outside a short list
  of things with no words (keys, signatures, raw output), each with its reason. A
  DNS name goes through `ui/DomainName`, a URL through `ui/UrlText`, other text
  through `overflow-wrap: break-word`.
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

The rule is "zero functionality", with the exceptions below **decided and
written down**. Additional exceptions need the maintainer's authorization.

Security fixes authorized on 2026-10-04 add one transport exception: DNSSEC
signing and private-key import use POST form bodies instead of GET query
parameters. Upstream accepts both methods and reads these fields with
`GetQueryOrForm`. The endpoint, fields and user actions remain the same. Session
revocation and expiry cleanup are bound to the affected token rather than
mutable shared storage. Installer filesystem requirements are recorded in its
contract and SECURITY.md.

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
   in the CHANGELOG, v1.2.0). It replaces Allowed and Blocked with Overview, Rules
   and Lists, laid out since 2026-11-06 the way Cache and Administration are.
   **Overview** (restructured with more on 2026-11-06, Adrián's decision) carries the
   blocking status in its header, beside the period: one pill, `Blocking is enabled`
   in green, `Blocking is paused` with `Until <time>` in amber, `Blocking is disabled`
   in red (neutral without `Settings.canModify`: the padlock wins), its sentence as its
   title, and beside it the same `Disable` / `Enable` menu, calls, confirmations and
   texts the status block had (`BlockingStatus.tsx`). Under the header, the check,
   block or allow panel is one command bar across the page (its title, the field, still
   named `Domain`, Block, Allow and Check, the answer under the line). Then a strip of
   four cells (`ui/StatCard`) read from `dashboard/stats/get`: `Total Queries`,
   `Blocked` with its `N% of total` and a bar of Blocked against what got through,
   `Block List Domains`, and `Your Rules` with their total (the server's two counts
   added), `Blocked`, `Allowed` and the same kind of bar; Total Queries and Blocked
   carry their change against the previous period, the Dashboard's object, arithmetic
   and limits (deviation 7), `vs previous hour` said once in Total Queries. Then
   Queries over time with **Blocked by client** beside it (`BlockedBy.tsx`,
   `blocked-sample.ts`): the newest 1,000 blocked queries of `logs/query`, read
   through the query logs app with the three blocked classes merged exactly as
   Recently Blocked reads them (`recentBlocked`, with a larger page), counted by client
   (the five most blocked, each address with the name the period's Top Clients give it
   when there is one, its count and a bar) and by query type (a stacked bar with its
   legend, the Dashboard's Query Types colours). It is a sample, not the period, and
   says so: `In the last N blocked queries` beside its title, `on <node>` with the
   cluster aggregate (logs are one node's). A row's menu has upstream's `Show Query
   Logs`, for that client, and for its response type when all its counted queries share
   one (Query Logs filters by one). It reads again with each answer of `stats/get`,
   never with the live figures. Without a query logs app it is not drawn and the chart
   takes the row: Recently Blocked says why, once; without `Logs.canView` it keeps its
   place, locked. The "Blocked share" ring is gone: it said the strip's share twice.
   Then Top Blocked Domains and Top Domains as cards (title and `More` in the toolbar,
   one line per domain), and Recently Blocked as a card whose rows fold the rest of the
   `logs/query` entry (`Response Type` with its time, `RCODE`, `Protocol`, `Class`,
   `Answer`) under `Details`, with `N blocked queries` in its foot. The Overview's new
   words, all OURS and declared in the header comment of the file that writes them:
   `Blocked by client`, `Blocked by type`, `In the last N blocked queries` (and `In the
   last blocked query`), `<client>: N blocked` (each bar's name), `Actions for
   <client>`, the status pill's three titles and three sentences (the status block's),
   and `Could not read the blocking state.` (the status block's). **Rules** is one card in both
   views: the filter, the search and `List`/`Tree` in the toolbar; Import, Export and
   Flush at the end of the foot with the count and the pages; a row's Delete is a
   trash icon named `Delete <domain>`. The tree is Allowed's and Blocked's
   `lists/Lists.tsx`, drawn as Cache's node: a trail `<ROOT> › … › node` whose steps go
   up with `direction=up` (upstream's `[up]`), Refresh and Delete at its end, the zones
   under the node as chips, the records one line each with the rest under `Details`
   (no DNSSEC column). Rules keeps its view in the address bar beside `?rule=`:
   `?q=`, `?page=`, `?view=tree` and `?list=` (`lib/url-state.ts`). **Lists** opens
   with a strip of three cells (the two counts, and the next update with Update Now in
   its cell) and draws the lists in one card: `Add group` and the Settings link in the
   toolbar, one line per list (switch, name, URL cut to the line, type, Move up, Move
   down, Remove and `Details`, which opens the name and the whole URL), the count in
   the foot. Every call, confirmation, alert text and validation is the one it was.
   Its Quick Add also offers the console's own catalogue (`extra-lists.json`) after
   Technitium's, and a search field.
   Its Overview's "Check, block or allow a domain" panel also has **Check**
   (`check-domain.ts`, `DomainCheck.tsx`): it tells whether this server blocks a
   name and why (which block lists, with the name the Lists tab gives each; which
   of your blocked rules; which of your allow rules lets it through; or not
   blocked). It asks what DNS Client asks, `dnsClient/resolve` against
   `this-server` (type A, UDP, no DNSSEC validation, no import), and reads the
   server's own blocking report from the answer; beside it, `settings/get` and
   `allowed/export`, each skipped when its permission is missing. It sends no
   `node`, as the Block and Allow beside it. Its query is a real one, counted and
   logged by the server like any DNS Client query. When the answer cannot prove
   the verdict it says so instead of guessing: "Cannot tell" when `Allow TXT
   Blocking Report` is off or when the `Blocking Bypass List` covers the server's
   own address, and a "Not blocked" lists the reads it did not have. Its words,
   all OURS: `Check`, the `Check, ` of the panel title, `Please enter a domain name
   to check.`, the verdict titles (`Blocked by a block list`, `Blocked by N block
   lists`, `Blocked by your rule`, `Blocked`, `Allowed by your rule`, `Not
   blocked`, `Not blocked: blocking is disabled`, `Not blocked: blocking is
   paused`, `Cannot tell`), `Listed as`, `Rule`, `Open Lists`, `Open Rules`, the
   two "Cannot tell" sentences and the four "not checked" / "Could not read"
   lines. Its next step is the panel's own `Block` and `Allow` and the tab that
   holds the rule or the list: it adds no action.

   The section is the only one that *adds* a screen. It stays inside four limits, and a
   change that crosses one is a bug:
   - **only endpoints the server already has**, and only ones upstream's console
     already calls, save `dashboard/metrics/json` for its live Last Hour
     (exception 5). `dev/check-endpoints.mjs` measures the other direction
     (upstream's endpoints this console covers), so a new path is checked by
     hand against upstream's `www/js`;
   - **upstream's actions, sentences and call sequences**: `Allow Domain` is
     still `blocked/delete` then `allowed/add` (`api/blocking.ts`);
   - **what is ours is in English and says so** in the header comment of its
     file;
   - **the blocking options are Settings' own** (shown since 2026-11-06 as
     Blocking › Settings, deviation 24): the Lists tab edits the same
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

   Three additions approved on 2026-10-15, inside the same four limits:
   - **Groups in Lists.** A comment line of `blockListUrls` is a group heading:
     the lists after it belong to it until the next heading, and the lists before
     the first one have no group. Headings can be added, renamed and removed (their
     lists stay, joining the group above), a new list can be put into a group, and
     a list moves up or down, across headings too. All of it is a change to the
     same lines, kept until Save. A heading is saved as `# Name` and refused when
     the server would not keep it as one comment line: a comma (the field travels
     comma-separated), a newline, more than 253 characters, or a name that reads as
     a list URL. Settings › Blocking still shows the headings as the comments they
     are. Order changes nothing that is blocked (`list-lines.ts`, GROUPS, with the
     server lines that say so).
   - **Rules' table deletes without asking, and offers Undo.** Its Delete sends
     `blocked/delete` or `allowed/delete` at once and leaves a notice (`ui/Toast`)
     whose Undo sends `blocked/add` or `allowed/add` for exactly the domains
     deleted, each to its list. Further deletes while it is up join it. Without
     `Modify` on the rule's list Undo could not work, so that Delete still asks.
     Upstream's confirmation stays everywhere else: the Tree view, Flush and every
     other section. This is the only place in the console where a confirmation was
     replaced.
   - **The sidebar marks Blocking when blocking is off or paused**, with the time
     it comes back in the entry's accessible name and title. It reads what the
     Overview's header status reads (`settings/get`, on the connected node), never
     without `Settings.canView`, and again after any settings write made from this
     console, when the browser tab is shown again and a second after a pause ends.
     No other sidebar entry carries a mark or a count.

   And words of its own in three places, approved on 2026-10-15, all OURS and
   declared in the header comment of the file that writes them:
   - **a subtitle under each tab's title**, one plain sentence saying what the tab
     is for (`OVERVIEW_SUBTITLE`, `RULES_SUBTITLE`, `LISTS_SUBTITLE`, drawn by
     `ui/SectionHeader`'s `subtitle`). No other section has one: they keep upstream's
     texts only. A sentence that stops being true of its tab changes in the same
     commit;
   - **Lists' save bar says what changed**: `Unsaved changes to the block list URLs:`
     followed by the counts `changesOf` computes (`list-lines.ts`, WHAT CHANGED):
     added, removed, switched on, switched off, changed, moved, and groups added,
     renamed and removed. Only the non-zero ones are written;
   - **the Lists tab carries a dot while there are unsaved changes**, read as
     `Lists, unsaved changes` (`app/nav-marks.ts`, on Lists' entry in the sidebar since 2026-11-06). The edits still live only
     while the tab is open, as before: leaving it leaves them, and the dot with them.
3. **Settings jumps to the sub-tab of the invalid field.** Upstream focuses a
   hidden input and the user sees nothing; with one panel mounted at a time,
   without that jump the alert would be impossible to resolve.

   And for the same reason (one save sends the fields of all nine panes, wherever
   you are), **Settings says what the save would change** (approved on
   2026-10-16, `screens/settings/pending.ts`). The save bar, always at the foot of
   the window (deviation 22), reads `Unsaved changes:` followed by the panes that
   hold one and how many fields each, `General (2), Cache (1)`, in tab order, or
   `No unsaved changes`; each of those panes carries the dot Lists carries in the
   Settings menu, read as `<Tab>, unsaved changes`. The pane names are upstream's
   tab labels. It compares what the save would send, with the save's own cleaning, so
   a field put back as it was, a blank line in a list and an untouched field never
   count; nor does a field the save would not send (outside the chosen node's
   scope, or a proxy detail with no proxy type), nor the minutes of `Temporary
   Disable Now`, which is not a setting. It only displays: saving, Backup,
   Restore, Flush Cache and the blocking buttons behave exactly as before.
4. **The "Enable DNS-over-HTTP/3" checkbox re-enables itself.** In upstream it
   stays dead until the page is reloaded because nothing re-evaluates its state:
   that is a bug of theirs, and replicating it would mean introducing the fault
   on purpose.
5. **Last Hour moves in real time** (Adrián's decision, 2026-10-03), on the
   Dashboard and on Blocking › Overview, which read the same `stats/get`.
   Between the 60-second reloads the count tiles, the Queries chart and the
   Query Response Types doughnut (and on Overview its figures and bars) follow the server's lifetime counters (`dashboard/metrics/json`),
   read every 2 seconds (`dashboard/live.ts`, `dashboard/useLive.ts`). Overview
   gained the minute reload with it. Live readings keep their timestamps across
   reloads: only readings after the last server UTC label are added. Labels name
   the end of each closed minute (StatsManager.cs:675-704), so a response that has
   not consolidated a pending reading cannot erase it. The history is bounded
   to the displayed hour; gaps between measured minutes occupy chart slots.
   A polling interval that straddles the server boundary is assigned to its end
   until a later consolidated response replaces that approximation.
   A chart takes new figures in place and
   without animation (`Chart.tsx`), and a legend's switched-off series only come
   back with a new response, as upstream's rebuilt chart does. Its limits, and
   crossing one is a bug:
   - **only that endpoint**, which upstream documents in APIDOCS.md and its
     console does not call; `check-endpoints.mjs` counts upstream's endpoints, so
     it does not object;
   - **Clients, Query Types, Protocol Types, the tops and the Server panel never
     move**: the counters do not carry them, and distinct clients do not add up;
   - **if the endpoint fails three times in a row, live mode stops** until the
     next reload, and the screen is exactly what it was without it;
   - **Recently Blocked follows the displayed Blocked count** through its existing
     `logs/query` reads. Background refreshes keep the previous rows, serialize
     requests and invalidate queued work when token, node or permissions change;
   - **a hidden tab reads nothing**, the minute refresh included, and coming
     back reloads at once. That pause is the only change to an upstream request.
6. **The login screen has a cover** (Adrián's decision, 2026-10-15): a brand
   panel beside the stock form above 960 px, and a header above it below,
   compact under 560 px (`screens/LoginCover.tsx`). It changes the layout and
   nothing else. Its limits, and crossing one is a bug:
   - **the form is upstream's, whole**: every field, text, step (the OTP one
     included), validation, alert and behaviour of `Login.tsx` is untouched, and
     it stays alone inside `<main>`; the cover is an `<aside>` outside it, and
     upstream's `Technitium DNS Server` is still the only `<h1>`;
   - **its words are ours and say so** in the header comment of its file: the
     name, the headline and the four TXT records. They must not age (no "new")
     and each must be true of the console as it ships; a line that stops being
     true changes in the same commit. It shows the console's version from the
     build and nothing else: no screenshot and no figure, since nobody has
     logged in yet and anything that looks like data would be invented;
   - **it calls nothing**: no endpoint, no asset beyond the fonts the console
     already ships, and its colours are theme tokens measured on `--field` by
     `dev/theme-contrast.mjs`. Its motion is the screen's one entrance (name,
     headline with the form's card, the answer rows one beat apart) and a
     decorative backdrop behind it, a faint grid drifting and an amber glow
     breathing, hidden from screen readers and clear of the text (2026-11-05);
     `prefers-reduced-motion` removes all of it.

7. **The Dashboard compares and jumps** (Adrián's decision, 2026-10-15). It adds
   two things to the stock Dashboard (`screens/dashboard/compare.ts`, `jump.ts`):
   - **each figure's change against the previous period of the same length**, as
     an arrow and a percentage on its card, with what it is measured against
     written once, in the `Total Queries` card ("vs previous hour"). Blocking ›
     Overview's strip draws the same change on its Total Queries and Blocked
     (2026-11-06, deviation 2), under these same limits. The
     previous period is a second `dashboard/stats/get` with `type=Custom`, whose
     instants are worked out from the labels of the answer on screen, so they follow
     the server's clock, its node and its grouping. Measured against v15.6.1 and
     v15.5.1 on 2026-10-15: Custom over a fixed period's own window gives the same
     ten counters, bucket by bucket, for all five fixed periods, and the same
     Clients wherever the request is exactly the window. Clients gets no change for
     Last Week (seven days by day cannot be asked; eight are, and the counters are
     summed over seven), for Last Year (asked by day; the server reaches a distinct
     count of months and of days through different merges) and for a minute that
     kept only part of its clients (more than 1,000). The other ten compare in
     every period;
   - **a jump from a chart to Query Logs**: a point of `Queries` opens its minute,
     hour, day or month as `From`/`To`; a segment of the `Query Response Types`,
     `Query Types` or `Protocol Types` bar opens that value over the period, where
     Query Logs has a field for it (`Dropped` and `Others` do not). It is the jump
     of the Top lists' "Show Query Logs" (`app/handoff.ts`), with the same node
     rule, the same arrival and the same alert when no logging app is installed.
     The three breakdowns are stacked bars in one card (the cockpit layout,
     Adrián's choice of 2026-10-15, `Breakdown.tsx`). Query Response Types keeps
     the stock legend's click-to-hide; on Query Types and Protocol Types there is
     no slice to hide, so their legend entries are the jump instead;
   - **a week by hour** (`Heatmap.tsx`, `heatmap.ts`): seven days of the browser's
     calendar by its 24 hours, each cell the queries of that hour, opening Query
     Logs for that hour on click. Custom groups by hour only up to 157 hours, so
     the week is asked in two back-to-back pieces and stitched; an hour that comes
     twice or not at all leaves the panel saying it could not load, never a double
     count or a quiet hole. Checked on 2026-10-15 against v15.6.1: the stitched
     hours equal Last Day's 24 and a single 157-hour request, hour by hour. The hour
     in progress is left out, as Last Day leaves it. It is asked once per node and
     per hour, not on each minute reload.

   Its limits, and crossing one is a bug:
   - **only `dashboard/stats/get`**, which the stock Dashboard already calls, and
     Query Logs' existing fields. A Last Hour reload waits for both reads so the
     changes do not blink; other periods ask once more per load; the week asks one
     or two more per hour;
   - **no change is drawn unless it is exact and current**: never while another
     period or node is loading, never after a failed read (of either period),
     never for a figure whose previous value is zero, never when the previous
     period has no queries at all (a server keeping statistics in memory only, or
     one that was not running yet). A previous period the server only partly
     recorded (it started inside it, or its stats files were deleted) is compared
     as recorded: the API cannot tell a quiet hour from a missing one;
   - **upstream's texts are untouched.** What is ours is in English, declared in the
     header comment of each file that writes it: "vs", "previous hour",
     "previous 24 hours", "previous 7 days", "previous 31 days", "previous 12
     months", "previous N minutes/hours/days" (`compare.ts`, `Figures.tsx`,
     `Dashboard.tsx`), the Queries hint "Click a point to open Query Logs for that
     minute/hour/day/month" (`Dashboard.tsx`), the week's title "Queries per Hour,
     Last 7 Days", its weekday names, each cell's "HH:00 to HH:00: N queries", its
     hint "Click a cell for that hour's Query Logs" and its scale's "Quiet" and
     "Busy" (`Heatmap.tsx`, `heatmap.ts`), and the legend entries' "Show Query Logs"
     title, which is upstream's own menu text. The two hints show only when the
     click can land;
   - **pointer only on the canvas and the bars.** A point of `Queries` and a
     segment of a breakdown bar take a click but no keyboard focus; the Query Types
     and Protocol Types legend entries are buttons, and the week is one keyboard
     stop whose arrows move between its cells.

   - **The Top 1000 list can be searched** (2026-11-06, `TopStats.tsx`). Upstream's
     `modalTopStats` has no search, and a thousand entries cannot be scanned by eye. The
     list is one card: a `Search` field in its toolbar narrows the entries already
     loaded, by name and, for a client, its domain, asking the server nothing.
     Upstream's `Total Clients: N` / `Total Domains: N` moves to the card's foot, with
     `, K shown` while the search narrows it; with no match the table says upstream's
     `No Data`. A client's domain is written beside its name.
8. **Query Logs folds its filters below 960 px** (approved on 2026-10-16; `FOLD_QUERY`
   in `screens/logs/QueryLogs.tsx`). Since 2026-11-06 (deviation 20) the filters are a
   band inside the results card under a toolbar holding `Domain` and the verbs. Below
   960 the band closes and a `Filters` toggle joins the toolbar; `Query` closes it again.
   The legend keeps its seven pills and puts their conditions behind its title. Above
   960 nothing of this exists: no toggle, and the band is always open. Its limits, and
   crossing one is a bug:
   - **a folded band says what is set**: every field it holds that differs from what
     `Reset` gives, by its own label and with the value the field shows
     (`activeFilters`). Domain, Page Number and Logs Per Page stay on screen and are not
     repeated;
   - **nothing it sends changes**: the fields stay mounted while folded, and Query,
     Export, Reset, Live Update and the pager send exactly what they sent;
   - **a validation still lands on its field**: a folded band opens before upstream's
     focus (logs.js:389-424 and 612-625) moves to the field that failed.

   Its words: none new. The toggles are `Filters` and the legend's `Row colours`; the
   list is the fields' own labels, each followed by a colon and its value.
9. **About reads like the other screens, and has a column for this console**
   (Adrián's decisions, 2026-10-16 and 2026-11-06; `screens/about/About.tsx`).
   Upstream's About is one centred column (index.html:3641-3680): the logo, the
   name, `Version X`, `Server up since …` and its prose, heading after heading.
   Here every one of its sentences and destinations stays, word for word, laid out
   the way Zones and Cache are; nothing is asked of the server (everything comes
   from the session's `info`), so there is no loading or failure state:
   - **The header is the server**: the path `About ›`, Technitium's logo (the file
     in `public/img/`, untouched), `Technitium DNS Server` and the server's domain.
   - **What is running is the header's line**, after the domain: `DNS Server` and its
     version, `Uptime` (the span since `uptimestamp` in its two largest units, `2d
     3h`, `4h 5m`, `12m`) with `since` and the date, and `Web Console` with
     `__CONSOLE_VERSION__`; without `info` they show the "no value" placeholder.
     Whether there is an update stays in the chrome (`app/Versions`, deviation 10).
   - **Upstream's sections are blocks**: `Documentation` holds What's New?, API
     Documentation and Help Topics as rows, the heading as the row's link and its
     sentence, with its own link, under it; `Support` (upstream's heading) holds its
     four sentences as one row each; `License` holds the copyright, the warranty and
     the source-code sentence; `Donate` keeps its heading as a link (the panel's
     title), its sentence and `Donate Now!`. A row is one target, the link inside a
     sentence is still its own.
   - **This console's column**: `On GitHub`, with the console's licence and the
     sentence saying it is not Technitium's, then four destinations as rows, `Source code`, `Release notes`, `Report a problem` (so a
     console fault does not go to Technitium's support) and `Ideas and questions`;
     and `Support the Console`, one sentence, `Star on GitHub` and the four
     destinations of `.github/FUNDING.yml` as buttons.
   Its words, all OURS: `Uptime`, the span's format, `Documentation`, `License`,
   `On GitHub`, `Web Console`, `DNS Server`, `Version` as a card label and the
   console's sentences, which follow the README's `Support` and `Licence`.
10. **The console tells you when a newer console is out** (Adrián's decision,
    2026-10-18; `app/console-update.ts`, `app/Versions.tsx`, `update-check/`). The
    browser cannot ask GitHub (the CSP below has no `connect-src`), so the console
    asks its own server, with `dnsClient/resolve`, for the TXT of
    `latest.technitium-console.pages.dev` against
    `https://technitium-console.pages.dev/dns-query` (`protocol=HTTPS`, no DNSSEC,
    no import). That endpoint is this repo's `update-check/`, a Cloudflare Pages
    Function that answers `v=1 latest=X.Y.Z server=A.B`. When a newer release is
    made for the running server, the *Web Console* row gets the same `Update`
    mark as the server's, and a dialog with the two commands from the README,
    each with a Copy button (the console cannot run them: no call of the server's
    API replaces its files). Its limits, and a change that crosses one is a bug:
    - **only that call**, and **at most once a day per browser**: the result,
      failures included, is kept in `localStorage` under `consoleUpdateCheck`. A
      failed call writes a line in the server's log (`DnsWebService.cs:2556`), so
      one a day is the ceiling;
    - **only when `user/checkForUpdate` answers `dnsServerEnableCheckForUpdate:
      true`** and the session has *DNS Client: View*. The server's *Check for
      update* and a silenced notice turn both notices off; there is no setting of
      its own;
    - **never with `node`**: every node of a cluster serves its own console;
    - **silent on any failure**, and nothing from the answer is shown but the
      version numbers, each checked against `^\d+\.\d+(\.\d+)?$`;
    - **the record's format is frozen**: consoles already installed read `v=1`,
      `latest` and `server`, and ignore keys they do not know. Grow it, never
      change it;
    - **`server` is the oldest Technitium a release is made for**: it is
      `technitiumServerMinimum` in `package.json`, read by the endpoint at the
      release's tag, and it is bumped together with the CHANGELOG's table. A
      console never announces a release made for a newer server than the one
      running;
    - the endpoint announces a release only once `latest` on GHCR is that
      release's image, so that Docker users who pull get it; and a GitHub rate
      limit is a failure, not "nothing to announce": the last good record stands.
    Its words, all OURS: `Web Console update available` and `DNS Server update
    available` (the two marks' accessible names), `New Web Console Version
    Available!`, `To update, run the installer again:`, `On Docker:`, `Release
    Notes` and the dialog's `Note!`.
11. **A client with no domain shows no "."** (Adrián's decision, 2026-10-21;
    issue #22). Upstream writes `.` under a top client whose `domain` comes
    empty (`main.js:2799`, `main.js:2955`), the root, which is what every client
    with no PTR gets: most IPv6 clients. Users read it as a stray trailing dot on
    the address. The Dashboard's Top Clients card and the Top 1000 modal draw no
    domain line for it instead; a client with a domain still shows it. Nothing
    else changes: the same call, the same rows, the same name and menu.
12. **Zones says what a zone holds** (Adrián's decision, 2026-11-05). Four
    differences, all reading data the same calls already bring:
    - **A summary of the zone by type** above the records (`A 14 · NS 1 · SOA 1`),
      counted from `zones/records/get` after Hide DNSSEC Records and before the
      Name and Type filters. Pressing a type writes it in the Type field and runs
      Go, exactly as typing it would; pressing the applied one empties the field
      and runs Go. `ZoneRecords.tsx`, WHAT THE ZONE HOLDS.
    - **The serial and the last change in the zone's header** (`Serial 16`,
      `Last Modified: …`), from the `zone` object of the same answer. Upstream
      shows them only in the zone list.
    - **`Last Used: never`** for a record never used, where upstream writes
      `0001-01-01 00:00:00 (never)`, .NET's empty date (`record-view.ts`).
    - **The DNSSEC column says `Unsigned`, `Signed` or `Signed, no keys`.**
      Upstream leaves the cell empty for an unsigned zone and writes `DNSSEC`,
      blue or grey by `hasDnssecPrivateKeys` (zone.js:721-731). This one predates
      2026-11-05 and is registered here because it was never written down.
    - **The zone list opens with four cards** (`ZoneSummary.tsx`): all zones by
      type (pressing a type sets the Type filter and runs Go), Health (Enabled,
      the zones with a problem in upstream's states, Disabled), DNSSEC (signed
      of signable) and the last zone changed. They read ONE `zones/list` with no
      page, the only call this deviation adds: every zone the user may see,
      about 230 bytes each, under the Zones: View the list already needs.
    - **A zone's page opens with four cards** (`ZoneOverview.tsx`) drawn from the
      `records/get` already loaded: Records (by type, Disabled, and Not used
      since restart, because the server keeps `lastUsedOn` in memory only), the
      apex SOA, the apex Name Servers, and DNSSEC. The DNSSEC menu's actions are
      that card's buttons, with upstream's literals and the same dialogs.
    - **Disable Zone and Delete Zone sit at the foot of a zone's page**, not in
      its header: the same buttons and confirmations, one click as before.
    - **Each record type and zone type has a series colour** (`zone-colours.ts`),
      taken from the Dashboard's `--ch-*`; the type is always written beside it.
    - **One sentence explains "Not used since restart"** in its tooltip: "The
      server keeps a record's last use in memory only, so a restart clears it."
13. **The open zone is in the address bar** (Adrián's request, 2026-11-05).
    Upstream's `showEditZone` swaps two `div`s and never touches the URL, so a
    reload always lands on the zone list. Opening a zone here pushes
    `/zones/?zone=<name>` (the root is `.`), and Back, Forward, a reload or a copied
    link return to it. It is a query string on the existing `/zones/` folder and not
    `/zones/<name>/` on purpose: the server answers every path that is not a real
    file, `/api/` or `/sso/` with an empty 404 (`DnsWebService.cs`, the `default:`
    branch of its route handler), and zones are created at run time, so no build
    can ship their folders. Measured on 2026-11-05: `/zones/example.net/` 404,
    `/zones/?zone=example.net` 200. Loading such an address opens the zone without
    a history entry; a zone that cannot be read shows the list again, as upstream
    does on its `error` (zone.js:3583-3585). Leaving the section takes `?zone=` out
    of the next route. `screens/zones/zone-url.ts`.
    The zone list keeps its view there too (Adrián's request, 2026-11-06), the way
    Blocking keeps `?rule=`: the page (`?page=`, left out on 1) and the applied
    filters (`?name=`, `?type=`), written by replacing the entry once a list lands,
    so a reload or a copied link asks for that page with those filters, and Back
    still walks between the list and the zones. `lib/url-state.ts`. A zone keeps its
    records page and filters the same way (`?rpage=`, `?rname=`, `?rtype=`); they
    belong to that zone, so opening another one or going back to the list takes them
    out (`zone-url.ts`). Because a link can now carry a records filter, the name
    filter takes only `*` and `?` as wildcards and every other regular expression
    character literally (`filter.ts`); upstream escapes only the dot, which let a
    crafted `?rname=` hang the tab. No DNS name holds those characters.
14. **"Delete Zones" waits for a selection** (Adrián's decision, 2026-11-05).
    Upstream keeps the bulk delete button enabled and answers a click with nothing
    ticked with an `alert()`, "Please select one or more zones to delete."
    (zone.js:1139). Here it is disabled until at least one zone is ticked, so the
    empty case shows without a click. Disabled, never hidden. With a selection it
    asks the same confirmation, sends the same `zones/delete` and reports the same
    success and partial-failure alerts.
15. **A screen's result floats in the bottom right corner** (Adrián's decision,
    2026-11-05). Upstream writes an action's result at the top of the section; here
    a page's result (`ui/Notifier`) floats over the page at the bottom right, where
    several stack, so nothing under it moves. A result inside a dialog stays in the
    dialog, and the login form's stays in the form. The texts, the five seconds of
    a success and the close button are the same.
16. **Cache says what a node holds, and reads like a zone** (Adrián's decision,
    2026-11-06). Upstream dumps a node's records as JSON (other-zones.js:157) under a flat
    list of `[refresh]`, `[up]` and the children. Here the screen is laid out as a zone's:
    - **The node is the header.** Its path (`Cache › com › google.com`, every step but
      the last opening that ancestor with `direction=up`, as upstream's `[up]` does) and
      its name as the title, with Refresh beside it; Delete (the node) and Flush Cache at
      the right. At the root the title is the section's, `Cache`, with no path; the root
      is still called `<ROOT>` in the table's foot.
    - **The Domain field and Browse sit in the records card's toolbar**, the zones under
      the node in a band of chips under it (the first 40, then `Show all N` / `Show
      fewer`: the root holds every top-level domain asked for), and the records under
      that, ONE line each: type, TTL, data and DNSSEC, with the rest (where it came
      from, when it was used, a name server's health, its glue and RRSIG) under the
      row's `Details`. The two `Glue` and `RRSIG` buttons are gone into it.
    - Up to four cards between the header and that card
      (`screens/lists/CacheSummary.tsx`, `cache-facts.ts`) read only the records of the
      `cache/list` answer already on screen: no call is added, and they follow the node
      exactly as the table does.
    - **Records**: how many, by type in each type's series colour (`zones/zone-colours`).
      Pressing a type narrows the table to it, pressing it again clears it; the foot
      says `N of M records at <node>, TYPE only`. It is drawn from the answer on screen
      and asks the server nothing; a new node starts unfiltered. And `Negative`: the
      records whose `rData` is the server's special cache
      record (`dataType: DnsSpecialCacheRecordData`) with a `data` starting
      `NegativeCache:`. Always drawn; an empty node says 0.
    - **Time Left**: the record that leaves the cache first and how soon, the longest
      time left, and `Stale`: the records written `ttl: "0 (0s)"`, which the server
      writes for a record kept past its TTL (`record.IsStale`,
      WebServiceZonesApi.cs:120-125). Like the TTL column, it is the time left when the
      node was read.
    - **DNSSEC**: the records by `dnssecStatus`. Secure is `--ok`, Bogus `--dan`,
      Indeterminate `--warn`, Unknown `--ch-3`, any other `--ch-drop`; the table's
      DNSSEC tag takes the same tones.
    - **Answered By**: each `responseMetadata.nameServer` and how many of the node's
      records it gave, most first, four shown and the rest as "N more".
    - A card whose data the node lacks is not drawn.
    - In the records table, shared with Allowed and Blocked, a record type is drawn in
      its series colour, and a cache record with `ttl: "0 (0s)"` carries a `Stale` tag.
      Allowed and Blocked draw the same one-line rows, without the DNSSEC column
      (deviation 2).
    - Flush Cache, Delete, Refresh, the path and the chips send exactly what they sent.
    - **The open node and the type are in the address bar** (`?domain=`, `?type=`),
      as Blocking keeps `?rule=`: written by replacing the entry, read on arrival (the
      first `cache/list` asks for that node instead of the root), dropped when the
      screen goes. `lib/url-state.ts`.
    Its words, all OURS: `Records`, `Time Left`, `Next to expire`, `Longest`, `Stale`,
    `Negative`, `Answered By`, `N more`, `Details`, `Show all N`, `Show fewer`, `N of M
    records at <node>, TYPE only`, `Cache` as the path's first step, and the two tooltips "Its TTL has run out.
    The server keeps it for Serve Stale and shows its TTL as 0 (0s)." and "A cached
    answer that the name, or a record of that type, does not exist."
17. **Apps says what the apps are** (Adrián's decision, 2026-11-06). Everything
    reads the `apps/list` the screen already makes (the store, its own
    `apps/listStoreApps`); every call, confirmation, alert text, validation and
    alert placement is the one it was.
    - **Four cards over the installed list** (`AppsSummary.tsx`). Installed Apps:
      how many, split in a bar into `Up to date`, `Update available` and `No store
      version` (the server wrote none of the three update fields), the last with a
      tooltip: "The server gives a store version only for an app whose name the DNS
      App Store lists with a version for this server, and for none when the store
      could not be reached." Classes: every class of every app by upstream's labels
      (`APP Record` … `Generic`); pressing a kind sets the table's Kind filter,
      exactly as choosing it there, and pressing the applied one clears it. Query
      Logs: the apps whose classes have `isQueryLogs`, "Read by Query Logs in the
      Logs section.", and how many classes are a `Query Logger`. APP Records: the
      classes with `isAppRecordRequestHandler`, four by class path and the rest as
      "N more", "Classes an APP record can use.". A zero is drawn as 0, `None
      installed` when no app serves Query Logs; no card is drawn when the list
      failed to load.
    - **The installed apps are a table** in `ui/DataTable`: upstream's `Installed
      Apps` header sorts it, its foot is upstream's `Total Apps: N` (apps.js:41),
      which this console had dropped, and `No Apps Found` when the filter leaves
      nothing. The tags are upstream's `Version X` and `Update Y` again.
    - **A `Kind` column, and the kinds as a filter.** Each row writes the kinds of
      its classes once each, in upstream's order. Pressing a kind on the Classes
      card narrows the table to it; the toolbar's end then shows that kind with
      `Clear`. A `Search` field in the toolbar narrows by name or description. Both
      only narrow what is drawn and ask the server nothing; the foot reads `Total
      Apps: N, M shown` while they hide rows. Both travel in the address bar
      (`?kind=`, `?q=`, `lib/url-state.ts`), replacing the entry.
    - **One line per app** (2026-11-06): the name with its tags, the kinds and the
      actions. Upstream's More Details (the description, each class with its
      labels, description and Record Data Template) opens under the row, from a
      chevron named `More Details`; the store's rows do the same with the
      description and `App Zip File`.
    - **Each kind has a series colour** (`app-kinds.ts`), from the Dashboard's open
      cycle `--ch-1` to `--ch-8`, `Generic` neutral; the kind is always written
      beside it.
    - **Row actions**: Config and Update as icons with their names in the tooltip,
      `Store Update` labelled when the store has one, and the `⋮` menu carrying all
      of them by name, Uninstall only there.
    - **The store** is a wide dialog with a DataTable: a `Search` field narrowing by
      name or description in the browser (`Total Apps` still counts the whole
      catalogue; `No Apps Found` when nothing matches), the size in a `Size` column,
      `App Zip File` in More Details, an `Installed` mark beside the version, and
      Uninstall (with Update) in the row's `⋮` menu. Install and Update stay
      buttons of the row.
    - **The header's "N update(s) available" pill is gone**: the Installed Apps
      card says it.
    - **App Config's editor numbers its lines and says whether the text is JSON**
      (`Valid JSON`, or `Not valid JSON:` and the browser's reason). It only
      informs: Save sends the text as typed, valid or not.
    - Two that predate 2026-11-06 and are registered here because they were never
      written down: the header button says `Install from file` where upstream says
      `Install`, and with no app installed the table's place holds a region empty
      state (`No apps installed`, one sentence and `Open App Store`) where upstream's
      footer says `No Apps Found`.
18. **DNS Client lays the response out** (Adrián's decision, 2026-11-06). Upstream
    prints `response.result` as JSON and the raw responses as a stack of JSON
    blocks (dnsclient.js:174-194). Here the same response, and nothing else, is
    drawn as a DNS message; no call is added and nothing is kept between queries
    (`screens/dnsclient/response.ts`, which reads the serialised `DnsDatagram`
    with every key optional):
    - **Four cards** (`ResponseSummary.tsx`): Response (the RCODE in the
      Dashboard's colour for it, Opcode, ID, the Extended DNS Error codes once
      each), Answer (the count, the types in their Zones colours as a bar and
      chips, Authority and Additional), Server (`Metadata`: Name Server, Protocol,
      Round Trip Time, Datagram Size; not drawn without it) and Flags (AA, TC, RD,
      RA, AD, CD, lit when set, each named in its tooltip; UDP Payload Size, EDNS
      Flags; the answer records' DNSSEC statuses). A count is drawn as 0. The
      chips count; they do not filter: the screen has no filter to drive.
    - **The sections as tables** (`ResponseSections.tsx`): tabs `Question`,
      `Answer`, `Authority`, `Additional`, each with its count, and `Extended DNS
      Errors` when the answer carries any (the EDNS options of that code and the
      client library's `DnsClientExtendedErrors`, with their source). Answer opens
      first. RDATA is written as the server keys it; a TXT's `CharacterStrings`
      is left out only when it repeats `Text` as one string. A `DnssecStatus` of
      `Disabled` (validation not asked for) is a quiet word, not a pill.
    - **The JSON stays, whole**: the last tab is upstream's
      `JSON.stringify(result, null, 2)`, and it is the only tab when the result
      is not a datagram.
    - **Raw Responses (N)** keeps upstream's collapsed panel, but lists one row per
      response (Name Server, Question, RCODE, the three counts, Round Trip Time),
      each opening its own JSON (`RawResponses.tsx`).
    - **The query is the toolbar of the answer's card** (2026-11-06): its first line
      is what is asked (Domain, Type, Resolve and Import), the band under it how
      (Server and its list, DNS-over-, EDNS Client Subnet, Enable DNSSEC Validation,
      the node). Same fields, labels, options and verbs. The tabs and the tables
      follow in the same card; the four cards stand above it once there is an
      answer.
    - **The question is the title once answered** (`DNS Client › github.com A`);
      `DNS Client` in the trail goes back to the empty card.
    - **The query is in the address bar** (`?domain=`, `?type=`, `?server=`,
      `?protocol=`, `?dnssec=off`, `?ecs=`, `lib/url-state.ts`), written by
      replacing the entry once an answer lands, only what differs from the form's
      defaults. A bar naming a domain runs that query once on arrival, as a jump
      from another screen does; a jump wins over the bar. They leave with the screen.
    - **Recent queries** (`recent.ts`): the last eight that came back, newest first,
      in this browser's storage only; the empty card lists them, and pressing one
      fills the form and resolves it. With none, the card says `Run a query to see
      the response.` as before.
    - **The header flags are words, not boxes**: a set flag on a tint, an unset one
      struck through and faint, each with its name in the tooltip.
    Its words, all ours: the card titles `Response`, `Answer`, `Server`, `Flags`;
    `Opcode`, `ID`, `Extended DNS Errors`, `Authority`, `Additional`, `Name
    Server`, `Protocol`, `Round Trip Time`, `Datagram Size`, `UDP Payload Size`,
    `EDNS Flags`, `DNSSEC`; the flags' abbreviations and their tooltip names (the
    datagram's keys split into words); the tabs' `Question`, `Answer`,
    `Authority`, `Additional`, `JSON`; the headers `Name`, `Type`, `Class`,
    `TTL`, `Data`, `Source`, `Info Code`, `Extra Text`, `RCODE`; the sources
    `EDNS` and `DNS Client`; `No Record Found` (the zone table's words); `Show
    raw response N` / `Hide raw response N`; the Import confirmation's title
    and verb, `Import`; and `Recent queries`.
19. **DHCP reads like Cache and Zones** (Adrián's decision, 2026-11-06). Its two tabs
    open with stat cards over ONE card that both finds and shows (`ui/DataTable`), a
    row is one line with the rest under its `Details`, a scope opens as a page, and
    the view is in the address bar. They read only DHCP's own two lists and the
    `scopes/get` upstream's Edit already makes:
    - **Scopes opens with three cards** (`ScopeSummary.tsx`): All Scopes (Enabled and
      Disabled; pressing a state sets the State filter, pressing it again clears it),
      Address Pool (the leases held in the enabled scopes, of the addresses in their
      ranges) and Leases (Dynamic and Reserved). They read `dhcp/leases/list` beside
      `dhcp/scopes/list`, the one call this deviation adds: the list the Leases tab
      already loads, under the same DHCP: View, on the same node. When it fails the
      scope table and All Scopes are untouched, no notice is raised, and the cards say
      "The leases could not be read." instead of drawing a false zero. A range is
      `endingAddress - startingAddress + 1`; the exclusions are not in `scopes/list`,
      so nothing calls the remainder "free" (`pool.ts`).
    - **The scope table** has a toolbar upstream does not: `Search` (a name, or an
      IPv4 address its range holds, or part of its starting, ending, network or
      interface address) and a `State` filter, both narrowing the list on screen.
      One line per scope: Name, `Scope Range`, `Subnet Mask` (upstream's "Scope
      Range/Subnet Mask" split in two columns), Interface, a `Leases` column (each
      scope's leases of the addresses in its range, sortable by count) and Status.
      Network and Broadcast are under the row's `Details`, so the table no longer
      sorts by them. The name opens the scope; Edit Scope and Delete Scope are in the
      row's menu, Enable or Disable Scope beside it. Same calls and confirmations.
    - **A scope opens as a page** (`ScopePage.tsx`), not a bare form: the header is
      the scope (`Scopes ›` back to the list, which reads it again as Cancel does; its
      name as the title; its state and `Interface`), with `Disable Scope` (or `Enable
      Scope`) and `Delete Scope` at the right: the row's verbs, permissions,
      confirmations and alerts. Disabling or enabling there reads the list again and
      stays on the page, the form as typed; deleting returns to the list, removing the
      row without reading it again. Four cards (`ScopeOverview.tsx`) read the scope's
      row, its `scopes/get` and the leases: Address Pool (its leases of its range; the
      range, mask, network and broadcast), Leases (Dynamic and Reserved, and `Open in
      Leases`, which opens the Leases tab narrowed to the scope), Reserved Leases (how
      many, and for each whether a lease of the scope carries its MAC: `Leased` or
      `Not leased`, "N of M leased", with the tooltip "A reservation is in the Leases
      list only once its client has taken it.") and Options (Lease Time written `1d
      4h 30m`, Router Address, DNS Servers or `This DNS Server`, Domain Name; `None`
      when empty). Then the form under upstream's title, "Edit Scope". Add Scope is
      the same page titled "Add Scope", without cards.
    - **The scope form reads in one glance** (`ScopeForm.tsx`, `form-summary.ts`):
      Scope stands open; the other twelve blocks are one card of lines, each its
      title and what it holds, following what is typed, and a line opens its block
      under it. A closed block's fields stay in the form, hidden, and Save sends them
      all; when a save stops at a cell of a closed block, the block opens before the
      cell takes the focus. The Ping Check `Warning!` is above its controls (DESIGN:
      Warning before, Note after); the Ending Address says how many addresses the
      range holds while typing, only for a valid IPv4 range; the Vendor Specific
      Information hex samples may wrap between octets. Same fields, order, defaults,
      texts, validation and save. The section index is gone.
    - **Leases opens with four cards** (`LeaseSummary.tsx`), counted from the list on
      screen: All Leases (pressing a type sets the Type filter, pressing it again
      clears it), Leases per Scope (pressing one sets the Scope filter), Expiring Soon
      (within the next hour, and the first to go) and Newest Lease. Refresh sits beside
      the title, as Cache's does.
    - **The lease table can be searched and filtered**: `Search` (IP address, MAC
      address or host name, a MAC typed with colons finding the server's dashes),
      Scope and Type filter the list already loaded and ask the server nothing. The
      foot still reads `Total Leases: N`; while a filter hides rows the toolbar says
      `N of M shown`; an empty result shows `No Lease Found`. One line per lease: IP
      Address, Host Name, MAC Address, Type, Scope and Lease Expires with how far off
      it is (upstream's order was Scope, MAC, IP, Type, Host, Obtained, Expires). The
      `Client Identifier`, which upstream only sends, and both dates with their
      distance are under `Details`; Lease Obtained left the line, so the table no
      longer sorts by it.
    - **The view is in the address bar** (`dhcp-url.ts`, `lib/url-state.ts`): Leases
      keeps `?q=`, `?scope=`, `?type=`; Scopes keeps `?q=`, `?state=`, written by
      replacing the entry, and the open scope `?scope=`, PUSHED as `?zone=` is, so
      Back and Forward walk between the list and a scope and a reload or a link opens
      it (a scope that cannot be read leaves the list, and the bar with it). Each tab
      reads them only when the bar is on its own folder, since a tab is drawn before
      the screen it replaces has dropped its search, and drops them when it goes.
      `Open in Leases` leaves Scopes, so Back from it lands on the scope list.
    - **A lease type has a series colour** (`lease-colours.ts`): Dynamic the blue
      upstream gives it, Reserved the violet, always with the word beside it.
    - **"Remove Lease?" draws its two `Warning!` paragraphs as warning blocks**, same
      words, same order.
    Its words, all OURS, declared in the header comment of the file that writes them:
    the card titles `All Scopes`, `Address Pool`, `Leases`, `All Leases`, `Leases per
    Scope`, `Expiring Soon`, `Newest Lease`, `Reserved Leases`, `Options`; `of N`,
    `addresses in range`, `addresses in range leased`, `leased in the enabled
    scopes`, `in the enabled scopes`, `The leases could not be read.`, `within the
    next hour`, `next:`, `obtained`, `None`, `Open in Leases`, `N of M leased`,
    `Leased`, `Not leased`, `N more`, `This DNS Server`, the `1d 4h 30m` lease time
    and the reservation tooltip; the headers `Leases`, `Scope Range`, `Subnet Mask`;
    `Search` and its placeholders `IP address, MAC address or host name` and `Scope
    name or IP address`; `State`, `All`, `N of M shown`, `Details`, `Client
    Identifier`, `Network`, `Broadcast`, `Interface`, `Disable Scope`, `Enable
    Scope`, `Delete Scope` as header buttons, `N addresses`/`1 address`; and the
    block summaries (`On`, `Off`, `ms`, `retry`/`retries`, `No domain name`, `DNS
    Updates`, `TTL`, `search domain(s)`, `Router`, `DNS`, `WINS`, `NTP`, `via`,
    `Option`, `entry`/`entries`, `route(s)`, `range(s)`, `Server`, `Host`, `File`,
    `match any`, `and N more`).
20. **Logs reads like Cache and the zone list** (Adrián's decision, 2026-11-06). Every
    call, confirmation, alert text, validation and its order, the export and the row menu
    are the ones they were; what changes is the layout and what is drawn from data the
    screen already has.
    - **View Logs is the folder, and an open file is its own page.** The folder's header
      is the section's, with Refresh beside the title (the same `logs/list`) and Delete
      All Logs / Delete All Stats at the right. Under it, up to four cards
      (`LogFilesSummary.tsx`, `log-files.ts`) read from the list: Log Files (the count
      and the span of days), Total Size (the sum of the sizes the server writes, and the
      largest file), Newest and Oldest (only for files named by their day, which is how
      the server names them; each opens its file). Then one table, one line per file:
      the name opens it, and its size carries a bar of its share of the folder. The foot
      reads `N log files`. An empty folder says 0 and 0 B; a list that failed draws no
      cards and the table says `Unable to load the log files.` Opening a file makes its
      name the header (the trail's `View Logs` goes back), with Refresh (the same 2 MB
      read), Download and Delete. Over the reader, one line says what the text holds:
      the size the list wrote, how many lines carry the server's timestamp, the first
      and the last of them, and, when the text reaches the viewer's 2 MB (`limit=2`
      reads from offset 0, LogManager.cs:657-676), that only the start is shown.
      Upstream draws the list as links with the size in brackets beside a `<pre>`, with
      all four verbs on one screen (logs.js:119-131, index.html:3272).
    - **The open file is in the address bar** (`?file=`, `lib/url-state.ts`): written by
      replacing the entry, read on arrival (it opens once the list says the file exists;
      otherwise the list stays and the parameter goes), and dropped when the screen goes.
    - **Query Logs opens with four cards** (`QuerySummary.tsx`, `query-facts.ts`) counted
      from the entries of the page on screen, never from the whole log, and saying so:
      Response Types (the page's entries, `of N logs`, a bar and chips in the
      Dashboard's colours by the same names, and `Blocked` as a count and a share of the
      three blocked types), RCODE (by the RCODE field's labels), Top Clients and Top
      Domains (four each, then `N more, on this page`). Pressing a type, a code, a client
      or a name writes it in its field and runs Query from page 1, exactly as choosing it
      there would; pressing the applied one empties the field and queries again. With
      Live Update on, Query is off, so pressing only sets the field and the loop's next
      turn sends it. A value the form has no option for, and the root name, are drawn but
      cannot be pressed. They follow the page every 2 s with Live Update.
    - **The filters are inside the results card.** Its toolbar holds `Domain` and
      upstream's four verbs in upstream's order, with the status at its end; a band under
      it holds the other ten filters, From/To/Order together under the Live Update edge
      and pill; then the legend, the rows and the foot. Upstream draws a form panel over
      the table.
    - **One line per row.** Timestamp, Client IP Address, Domain, Type (in its series
      colour, `zones/zone-colours`), Response Type on its row colour, RCODE and Answer
      cut where its column ends. `Details` (chevron, `aria-expanded`) opens a line under
      the row with `#`, `Protocol`, `Class`, the response time upstream writes under the
      type, and the whole answer, one record per line with the same text.
    - **The query is in the address bar** (`query-url.ts`): once a query lands, the
      filters it sent and the page the server answered are written by replacing the
      entry, each named as `logs/query` names it, only when it differs from what Reset
      gives, the page past the first, and From/To as the instants the call sends. On
      arrival they are read once, checked (an app or class that is not there, an option
      the dropdown lacks, or a page that is not a number is dropped) and queried as Query
      would, with Live Update off. A jump from another screen wins over the bar. The
      parameters leave with the screen.
    Its words, all OURS: `Log Files`, `Total Size`, `Largest`, `Newest`, `Oldest`, the
    span's `to`, the column headers `Log File` and `Size`, `N log files`, `Size`,
    `Entries`, `First`, `Last`, `Showing the first 2 MB. Download gives the whole file.`,
    `Response Types`, `of N logs`, `Blocked` as a share, `Top Clients`, `Top Domains`,
    `on this page`, `N more`, `Details` and `Refresh` (Cache's word).
21. **My Profile is a page** (Adrián's decision, 2026-11-06). Upstream's `modalMyProfile`
    (index.html:3691-3786, auth.js:660-866) is a dialog; here it is `/profile/`, reached
    from the account menu's `My Profile` (`screens/profile/`). It is a route like the
    sections (`profile` in `SECTIONS`, its own folder, Back and F5, no sub-sections) but
    in no sidebar group, and needs no permission. It calls what the dialog called and
    nothing more: `user/profile/get` on arrival, on Refresh and after a dialog opened from
    it changes the account (2FA, a new token); `user/profile/set` on Save;
    `user/session/delete`. It is ONE page with everything in view (2026-11-06, Adrián:
    four tabs were too many for so little): the header, then two columns, the sessions in
    the main one (about two thirds) and four compact panels in the side one. Under
    1180 px they stack as Profile, Security, Sessions, Account, Theme.
    - **The user is the header**: the account menu's initial, `My Profile ›`, the display
      name as the title with Refresh, and on its line the username, the Type and the 2FA
      Status (`2FA Enabled`, `2FA Disabled`, `2FA SSO Managed`). Username and Type are the
      dialog's two read-only fields, so they leave the form; each value keeps upstream's
      label for a screen reader (a visually hidden `dt`).
    - **Sessions in `ui/DataTable`**: upstream's four sortable columns and `Total
      Sessions: N`, one row per session (the type and token name over the partial token,
      the date over its age), the user agent whole under `Details`, a type filter in the
      toolbar (`?type=` in the address bar, `lib/url-state.ts`; the foot says `N of M
      sessions, TYPE only`), `Create API Token` at the toolbar's end (an API token is a
      session of that type; the menu's same dialog, and the page reads the profile again
      after it), and `Delete Session` as the row's button instead of a one-entry menu,
      with upstream's confirmation. A deleted session leaves the list without a reload, as
      `deleteMySession` removes the row, and an API token is deleted with `node` set to
      the primary's name, empty on a standalone server (auth.js:835-838).
    - **Profile**: the dialog's editable fields, labels over them: Display Name (locked
      and not sent for a remote user), Session Timeout with `seconds (valid range
      0-604800; default 1800; set 0 to disable)`, an empty timeout sent as 1800, `Profile
      Saved!` on the page. The load writes the name into the menu and the 2FA state into
      the session (auth.js:675-679). It no longer takes the focus a second after loading.
    - **Security**: Password with Change Password and the 2FA Status with Configure 2FA,
      one line each, opening the account menu's same dialogs under its same rules.
    - **Account** (`AccountPanel.tsx`): Member Of (upstream's table of groups, as tags, or
      `No Group Found`), and Recent Login and Previous Login, which `user/profile/get`
      carries and the stock dialog does not draw, each on one line as how long ago, then
      the date `from` the address as Users writes it, or `Never`.
    - **Theme** offers Change Theme's three options as one compact strip, each with a
      small swatch drawn in that theme's tokens, applying on click as the dialog does; the
      menu's Change Theme stays.
    Its words, all OURS: `Profile`, `Security`, `Account`, `Password` as block titles,
    `2FA` before the header's status, `from`, `All`, `Details`, `Session type`, `N of M
    sessions, TYPE only`.
22. **Settings reads as one form** (Adrián's decision, 2026-11-06). Upstream draws nine
    tabs over one long form whose help sits under each field. Here:
    - **One menu at the left of the form** (`screens/settings/SettingsMenu.tsx`) holds the
      nine sub-sections (real links to their routes, `aria-current="page"`, the dot of
      deviation 3) and, under the current one, its titled blocks as in-page anchors
      (`#settings-<title>`, the one in view `aria-current="location"`, only when the pane
      has two or more). It replaces the row of sub-tabs and the second row of block links
      (`ui/SectionIndex`) that looked like tabs and only scrolled. Under 960 px of screen it
      folds into a bar at the top: the current sub-section and block as a button that opens
      the same list, and the search.
    - **Search settings** at the top of the menu (`search.ts`) narrows the current pane to
      the rows and notices whose label, help or options' text hold every word typed, hides
      the blocks left empty and paints the matches (CSS Custom Highlight API). It searches
      what the form says, not field values. The other eight panes are drawn out of sight
      (`hidden`, `inert`, reading no Quick list) only so each sub-section in the menu can
      say how many matches it has. It asks the server nothing, changes no field, and a
      hidden field is still saved. The words are in the address bar as `?q=`
      (`lib/url-state.ts`): written by replacing the entry, read on arrival, kept when
      moving between sub-sections, dropped when the screen goes.
    - **Each row reads label, help, control**: the help under the label as one muted line,
      a longer one cut at its end with `more` (and `less`), the whole text always in the
      document (`ui/FoldHelp`); an editable table drops under its label and help. It is the
      panel-form kit's row (`ui/Form`), so every page form built on it (Administration's
      SSO, LDAP and Cluster, DHCP's scope) reads the same.
    - **The header is the pane** (`Settings ›` and the sub-section as the title), with
      **Backup Settings, Restore Settings and Flush Cache** at its right; **Save Settings**
      stays in a bar on screen for the whole screen, a card floating a step above the
      window's edge with the same air under it at the page's end, as every form's save bar
      (`ui/PanelForm`'s `.bar`). Same calls,
      permissions, confirmations and texts.
    - The block headers carry no count of their rows. Quick Add and Quick Select are rows
      like their neighbours.
    - **The form takes the width the menu leaves** (2026-11-06, Adrián): one column,
      never two, so the blocks are read in upstream's order.
    - **`Warning!` and `Note!` are compact lines** in every form built on the kit
      (`ui/PanelForm`'s `Warning`, `Note`), Settings, DHCP's scope, Administration and
      the dialogs that use them: the sign and the bold word in their colour, the text in
      the help's size, a warning whole and a note folded to its first line with `more`.
      A switch's help folds the same way (`ui/Check`'s `toggle`). Settings › General went
      from 5,461 px to 4,777 at 1440. The whole text is always in the document.
    Its words, all OURS: `Search settings`, `more`, `less`, `No unsaved changes`, `No
    settings in <Section> match "<q>".`, `match` / `matches` (read after a sub-section's
    name), `Save` (the bar's region name).
23. **Administration reads like the rest** (Adrián's decision, 2026-11-06). Every call,
    confirmation, alert text, validation and its order, and every dialog are the ones
    they were; what changes is the layout and what is drawn from data the screen already
    has. Each sub-section has Refresh beside the title (the same list call it makes on
    arrival).
    - **Permissions is one matrix** (`PermissionMap.tsx`, `permission-map.ts`). Upstream
      draws a row per section holding a user table and a group table with a tick per verb
      (auth.js:2031-2073). Here the sections are the rows, under upstream's sortable
      `Section`, and the columns are every group and then every user holding an entry in
      any section, in the order the server first lists them, under upstream's `Group
      Permissions` and `User Permissions`. A cell is three marks, `V`, `M`, `D`, filled for
      each verb granted; its tooltip and its text for a reader name them, or say `None` for
      an entry granting nothing; no entry is an empty cell, as it is a missing row upstream.
      A population nobody holds says upstream's `No group permissions` / `No user
      permissions` once, down its one column. The section's name (upstream's link), the
      row's `Edit Permissions` (the `⋮` menu's only entry) and a click on the row open
      upstream's dialog for that section. Under 720 px it folds into one block per section,
      its groups and then its users, with upstream's two literals where it has none. The
      eleven panels, their index and the map above them are gone: 3,252 px at 1440 became
      979.
    - **Users, Groups and Sessions are data tables** (`ui/DataTable`): the search in the
      toolbar, then upstream's primary action (`Add User`, `Add Group`, and on Sessions the
      node picker and `Create Token`) at its end, where upstream floats them over the table;
      upstream's `Total Users: N` / `Total Groups: N` / `Total Sessions: N` in the foot, with
      `, K shown` while a search or a filter narrows it. One line per row; the rest under the
      row's `Details` (chevron, `aria-expanded`): a user's two logins whole (`date from
      address` and how long ago; the row keeps each date), a group's description line by line
      (the row cuts it to one), a session's type and whole user agent (the row cuts it). The
      row's other control is upstream's `⋮` menu with its own entries in its own order
      (auth.js:1190-1209, 1797-1799, 938-939): the separate View Details and Enable/Disable
      buttons are back inside it, under upstream's words `Enable` and `Disable`. The name
      opens the details, as upstream's link does.
    - **Users opens with four cells** (`UsersSummary.tsx`, `user-facts.ts`) counted from
      `admin/users/list`: Users (Enabled against Disabled), Type (by upstream's labels), 2FA
      (enabled of the users whose 2FA this server keeps, an SSO user's being the provider's,
      and `SSO Managed N`), Recent Login (who, how long ago, from where). Pressing a state or a
      type narrows the table and pressing it again clears it; the applied one also sits in
      the toolbar as a chip that clears it. **Sessions opens with three**
      (`SessionsSummary.tsx`, `session-facts.ts`) counted from `admin/sessions/list`: Sessions
      by type (My Profile's colours; pressing filters), Users and Remote Addresses (how many,
      the four with most; pressing one writes it in the Search). Nothing is asked of the
      server.
    - **The view is in the address bar** (`bar-param.ts` over `lib/url-state.ts`): `?q=` on
      the three lists, `?status=` and `?type=` on Users, `?type=` on Sessions; read on
      arrival, written by replacing the entry, dropped when the sub-section goes.
    - **SSO and LDAP say their state on the header line**: `Enabled` or `Disabled` as last
      read or saved (not the unsaved checkbox), and `Not configured` while the authority
      and client ID (SSO) or the server (LDAP) are empty, warn-toned only when enabled.
      Their forms take Settings' rows (deviation 22) in two columns on a wide screen: the
      connection at the left, what follows from it (sign-up, scopes, the group map) at the
      right; one column under 1180 px (`ConfigParts.tsx`). A switch stands on its own line
      with its label and help; the fields go two across, label over control over help.
      Upstream's `Warning!` and `Note!` (shown at the end of the page in its order) sit
      in the block they speak about as compact lines, the warnings whole before the
      controls, each note folded to its first line with `more`: SSO's connection notes
      (the callback path, when SSO is enabled, internal resolution, the reverse proxy,
      the Web Service restart), sign-up's (names synced), Scopes' (the email username),
      Group Map's; LDAP's likewise. SSO shows its Redirect URI, the value the first note
      gives, as a line with Copy. SSO drops its section index: a row of links that only
      scroll looked like a second row of tabs. Their words, OURS: `Redirect URI`, `Copy`,
      `Copied`.
    - **Cluster's nodes are a data table**: the node picker in its toolbar, `Total Nodes: N`
      in its foot.
    - **Every dialog body reads like Add Zone** (`ui/DialogForm`): labels over their
      fields, short fields in pairs, related fields in a light block, choices as
      tiles, tables one line per row with icon actions. A `Warning!` comes before the
      controls it is about (Create API Token, Initialize and Join Cluster, Import
      Zone, Edit Zone File, Zone Options), except where its words point up ("above":
      Restore Settings, a created token, DNSSEC's TTL). User Details' sessions keep
      Session, Last Seen and Remote Address on the line, the user agent under
      `Details`; DNSSEC Properties' Rollover (days) goes under the key's `Details`, so
      neither column sorts any more.
    Its words, all OURS: `V`, `M`, `D` and the legend, `None`, `Search` and its three
    placeholders, `Details`, `Clear`, `N shown`, `Users`, `Type`, `2FA`, `of`, `Recent
    Login` as a cell title, `Nobody yet`, `Sessions`, `Remote Addresses`, `N more`,
    `Enabled`, `Disabled` and `Not configured` on the SSO and LDAP headers, `Refresh`
    (Cache's word).
24. **The sidebar is grouped by task and holds the sub-sections** (Adrián's decision,
    2026-11-06). Upstream draws one flat row of tabs. Here (`app/Shell.tsx`, `NAV`):
    - **Five headed groups** under Dashboard: `Monitoring` (Clients since 2026-11-06,
      deviation 25, then Query Logs, View Logs),
      `DNS` (Zones, Cache, Blocking), `Network` (DHCP), `Tools` (DNS Client) and
      `System` (Settings, Apps, Administration, About). Logs is two entries, one per
      screen.
    - **Blocking, DHCP and Administration unfold their sub-sections** under their
      entry while open (`visibleSubs` in `app/sections.ts`); the sub-tabs under their
      titles are gone, and each sub-screen's title is its own name under the section
      (`Administration › Users`). Exactly one link is `aria-current="page"`: the
      sub-section, or the entry itself when it has none. Lists' unsaved-changes dot
      rides on its sidebar entry (`app/nav-marks.ts`). Settings keeps its own menu.
    - **Blocking › Settings** is the Settings form with only its Blocking pane
      (`Settings`' `only`): the same load, fields and one save, so saving there sends
      what Settings' Save sends; no Backup, Restore or Flush Cache. Settings' menu no
      longer lists Blocking, and `/settings/blocking/` still works: its folder is
      emitted and `route.ts` rewrites it to `/blocking/settings/` (`MOVED_ROUTES`). The
      page needs `Settings.canView`, as the pane did.
    - **The brand and the versions.** At the top, Technitium's maze redrawn in its
      blue tile (`app/BrandMark.tsx`, the same geometry as `public/img/logo.png`; Login
      and About keep the original file), `Technitium` with this console's version
      beside it and `Console` under it, the console's `Update` chip beside that word
      when there is one. At the foot, above the account, a quiet card with the DNS
      server's domain and `DNS Server <version>`, its `Update` chip at the line's end
      (`app/Versions.tsx`: same checks, same dialogs).
    Its words, all OURS: the five group headings, `Console` under the name, `Settings` as a Blocking
    sub-section, `Blocking › Settings` in the two links that pointed to Settings ›
    Blocking.

25. **The Clients page** (Adrián's decisions, 2026-11-06; `src/screens/clients/`). Upstream
    has no such screen: it is Blocking › Overview's Blocked by client card grown into a page,
    built from that card's and the Dashboard's pieces (`useLoggingApp`, `countByClient`,
    `BLOCKED_TYPES`, `TopRowMenu`, the top lists' rows, `Line`, Query Logs' `rowClass` pill,
    `ui/StatCard`, `ui/DataTable`). It is a section of its own, `clients`, first under
    `Monitoring` in the sidebar, and needs `Dashboard: View`, the permission of its main calls.
    What it shows:
    - **the header**: `Clients`, a subtitle (`CLIENTS_SUBTITLE`) and the Dashboard's five fixed
      periods (no Custom) with Last Hour's live dot, read again a minute after each answer,
      never with a hidden tab (the clients do not move with the live counters, deviation 5);
      the cluster node selector with the Dashboard's node memory (`dashboardClusterNode`);
    - **a strip** of four cells: `Clients` (`totalClients` of `stats/get`), `Most Active` (the
      first of the period's Top Clients, its queries and share of `totalQueries`), `Most
      Blocked` and `Blocked Share`, both from the log sample;
    - **Who uses your DNS** (`WhoUses.tsx`): the period's 20 busiest clients as one bar, each
      segment its share of `totalQueries`, its name inside when it has 6 % of the bar (not on a
      phone), a click opening that client, and the caption with the total and how much of the
      traffic they cover;
    - **the list** (`ClientList.tsx`): `dashboard/stats/getTop` with `statsType=TopClients`
      and `limit=1000`, exactly what upstream's More sends (main.js:2939), one line per
      client: its initial (as the account row draws it), name and address, its tags, its
      queries in the period, `N% blocked` of its queries in the sample and a thin bar of that
      split. Two tags, each a rule the code states (`clients-model.ts`, THE TWO TAGS): `Heavy
      blocking`, a fifth or more of its queries in the sample blocked over at least ten of
      them, and upstream's own `rateLimited` as `Rate limited`; nothing the data cannot prove
      (the server does not say when it first saw a client, so there is no "New"). Filter
      chips with their counts, `All`, `Heavy blocking` (only with a sample) and `Quiet` (under
      1 % of the period's queries), and a `Sort by` of `Most queries`, `Most blocked` and
      `Name`. The search (`?q=`), the filter (`?filter=`), the order (`?sort=`), the page
      (`?page=`) and the open client (`?client=`) are in the address bar, written by replacing
      the entry, each default left out, all dropped when the page goes;
    - **master and detail**: above `--bp-wide` (1180 px) the list is a 380 px column and the
      open client's card sits beside it, the list's first client open when `?client=` names
      none (and the bar stays clean); at 1180 and under the list takes the width and opening a
      client shows its card instead, under a `Clients ›` trail that comes back, as a zone's
      page does;
    - **the card** (`ClientCard.tsx`): its name (or address) and tags; its address and, when a
      DHCP lease hands it out (`dhcp/leases/list`, read only with `DhcpServer: View`, matched
      by address), the lease's MAC address, host name and scope; its last query's age;
      `Open in Query Logs` (the Top Clients jump) and `Copy IP`. Then, from `logs/query`
      filtered by `clientIpAddress`, its newest 500 entries of every type: `Queries`,
      `Blocked` (the three classes), `Cache hit rate` (`Cached` over all) and `Median response
      time` (the median `responseRtt` of the entries that carry one, the cell left out when
      none does); its activity over the sample's own span in 24 slices, Total and Blocked, on
      the Dashboard's line; its five most asked and five most blocked domains, each with Top
      Domains' or Top Blocked Domains' menu; its protocols as a stacked bar and its record
      types as bars; and its ten latest queries (age with the time in its title, domain,
      type, Query Logs' coloured response pill, and `responseRtt` in ms or the "no value"
      placeholder). The log entries carry no node (checked against v15.6.1 on 2026-11-06), so
      there is no "answered by" in a cluster: the aggregate reads the connected node's log.

    - **the card's Actions** (`ClientActions.tsx`, `client-actions.ts`, approved on
      2026-11-06), a band under its head, one line per action with its state:
      - `Blocking Bypass List` and `QPM Limit Bypass List` (Settings' own fields): whether
        the address is in the list, by itself or through a network entry that holds it
        (`Through <network>`, which offers no removal: taking the address out would change
        nothing), and `Bypass Blocking` / `Apply Blocking`, `Exempt from Rate Limiting` /
        `Apply Rate Limiting`. The lists are read with `settings/get` (only with `Settings:
        View`) and saved with `settings/set` carrying `node` and the one list, through
        Settings' cleaning (`cleanList`, `false` when empty), as Blocking › Lists saves
        `blockListUrls`. Both are cluster-wide parameters (`nodeScope`), so both calls go
        where Lists sends its own: `cluster` on a cluster, the empty node on a standalone
        server. A save needs `Settings: Modify` (the padlock otherwise), asks first, naming
        the list and the address, and redraws from the server's answer with Settings'
        `Settings Saved!`. The QPM line is drawn only when the server sends
        `qpmLimitBypassList`;
      - `DHCP Lease`, when a lease hands out the address: its type and DHCP › Leases'
        conversion for it, `Convert To Reserved Lease` (`dhcp/leases/convertToReserved`) or
        `Convert To Dynamic Lease` (`dhcp/leases/convertToDynamic`), with the lease's scope,
        client identifier and the node the leases were read on, upstream's confirmations
        and `Reserved!` / `Unreserved!` notices, `DhcpServer: Modify`, and the leases read
        again after it.
      A failure says the server's message (`Error!`). Logs and leases are read on the chosen
      node, or on the connected one with the aggregate or without a cluster.

    **The log sample** is the newest 1,000 queries of every response type (`logs/query` through
    the query logs app, Query Logs' own call), read again with each answer of `stats/get`. It is
    not the period, and every figure drawn from it says what it is based on (`In the last N
    queries`, `In the latest N queries` on the card, `on <node>` with the cluster aggregate:
    logs are one node's). Without a query logs app the two sample cells become one that says
    why, once, with upstream's sentence and a link to Apps; the list keeps its queries, loses
    `Heavy blocking` and the blocked share, and the card says `No query logging app` under its
    head. Without `Logs: View` each sample cell and the card's body keep their place, locked,
    and nothing reads the log.

    Its limits, and crossing one is a bug: only endpoints upstream's console already calls
    (`dashboard/stats/get`, `dashboard/stats/getTop`, `apps/list`, `logs/query`,
    `dhcp/leases/list`, `settings/get`), and written only through the three Actions above
    (`settings/set` with one list, `dhcp/leases/convertToReserved` and
    `dhcp/leases/convertToDynamic`), upstream's actions and jumps otherwise. Its
    words, all OURS and declared in the header comments of `Clients.tsx`, `ClientList.tsx`,
    `ClientCard.tsx`, `ClientActions.tsx` and `WhoUses.tsx`, among them the subtitle, the strip's cells, `Who uses
    your DNS` and its sentences, the two tags, the filters and orders with `Sort by` (listed
    in `dev/check-parity-controls.mjs`), `N% blocked`, `Open in Query Logs`, `Copy IP`, the
    card's four figures and its section titles, and the Actions' `Actions`, `DHCP Lease`,
    `Applies`, `Bypassed`, `Exempt`, `Through <network>`, the four button names, `Add`,
    `Remove`, the four confirmations (`ASK` in `ClientActions.tsx`) and `Could not read the
    settings.` The page's folder is generated from `SECTIONS`.

26. **A command palette** (Adrián's decision, 2026-11-06; `app/palette/`). Ctrl+K (⌘K
    on a Mac), the `Search or jump to…` field under the brand, or the search button
    in the narrow top bar opens one field over the screen. Empty, it lists the last
    five entries run (kept in this browser, `paletteRecent`) and the first pages;
    typing narrows every section and sub-section the user can see, Settings' panes,
    the zones (`zones/list`, read when it opens, at most once a minute, only with
    `Zones` visible) and the account menu's entries, plus the three themes and
    Logout. Text that reads as a name adds the steps that take it: `Check <name> in
    Blocking` (Blocking › Overview's check, through `?check=`, which the bar reads
    once and drops), `Resolve <name> in DNS Client` and `Search Query Logs for
    <name>` (the row menus' own hand-offs), `Find <name> in Cache` (`?domain=`),
    `Search your rules for <name>` (`?q=`); an address adds `Search Query Logs for
    client <address>`; any text adds `Search settings for <text>`. A zone or page
    that answers comes before those steps. It calls nothing itself and changes
    nothing: every entry lands on a screen that does what it always did. A jump
    with parameters remounts the screen so it reads them even when it was already
    open, and writes the address back a task later because a screen may take its
    own parameters out as it goes (`app/Shell.tsx`, `paletteJump`). A combobox over
    a listbox: the focus stays in the field, the arrows move `aria-activedescendant`,
    Enter runs, Escape closes.
    Its words, all OURS: `Search or jump to…`, `Search`, `Results`, the group names
    (`Recent`, `Zones`, `Pages`, `Actions`, `Account`), `Page`, every action
    sentence above, `Use the light theme`, `Use the dark theme`, `Use the system
    theme`, `No matches for "<text>".`, `to move`, `to open`, `to close`.
27. **Live Update is seen live** (Adrián's decision, 2026-11-06; `screens/logs/QueryLogs.tsx`).
    Upstream's Live Update is kept as it is: page 1 every 2 s, the same request, the same
    fields it pins and turns off. While it is on, a dot beats beside the switch with how
    many logs arrived since it was turned on (`N new`, from the growth of
    `totalEntries` between turns, so it counts more than a page can show; a total that
    shrinks counts nothing), and each row that was not on the previous turn's page
    flashes once in a light accent tint, quiet on purpose because on a busy server every
    row of page 1 is new on every turn. No motion with reduced motion. Its words, OURS:
    `N new` and the switch's title `Live Update reads page 1 every 2 seconds`.

28. **The Dashboard shows response times** (Adrián's decision, 2026-11-06;
    `screens/dashboard/ResponseTime.tsx`, `response-time.ts`). A card under the Queries
    row reads the newest 1,000 entries of the first query logs app (`logs/query`, the read
    Blocking's Blocked by client makes, again each time the statistics answer) and works
    out, from the entries that carry a `responseRtt` (answers the server had to ask for
    upstream), the median and the 95th percentile (nearest rank), the share over 100 ms
    and a histogram in nine buckets, the slow tail in the warning colour. On the cluster
    aggregate it reads the connected node's log and says so. It reads nothing without
    `Logs.canView` (locked) and says once when there is no query logs app. Its words,
    OURS, are declared in its header comment.
    And **the row's round trip is back in Query Logs**: upstream draws `(N.NN ms)` under
    the response type (logs.js:517); it had gone under `Details` only.

29. **The Dashboard shows how a query is resolved** (Adrián's decision, 2026-11-06;
    `screens/dashboard/Resolution.tsx`, `resolution.ts`). Beside Response Time (deviation
    28), over the same one read of the log (`dashboard-sample.tsx`: the newest 1,000
    entries, read once for both cards), a flow from all the queries, through how the
    server answered them (`Cached`, `Recursive`, `Authoritative`, `Blocked` for the three
    blocked kinds, `Other`) to what it answered (`No Error`, `NX Domain`, `Server
    Failure`, `Refused`, `Other`), each band as thick as its queries. A kind or a code
    with a name opens Query Logs filtered by it, with no period (the sample is the
    newest queries, not the period). On a narrow card the codes move to a legend under
    the bands. Its words, OURS, are declared in its header comment.
30. **DHCP shows each scope's usage** (Adrián's decision, 2026-11-06; `screens/dhcp/Scopes.tsx`,
    `scopeUsage` and `percent` in `pool.ts`). The scope table's Leases column (deviation 19) becomes
    each ENABLED scope's usage: the leases of `dhcp/leases/list` that carry its name, Dynamic and
    Reserved together, against the addresses in its range (`endingAddress - startingAddress + 1`
    from `scopes/list`), as `N of M`, the share in whole percents (`<1%` for a few leases in a wide
    range, never `0%`), a bar, and `Dynamic N, Reserved N` under it. Above 80%, as the share is
    written (`81%` is over, `80%` is not), the share and the bar take the warning colour. The
    exclusions are not in `scopes/list` and reading them is one `scopes/get` per scope, so the size
    is the range's and the bar's name says so. A disabled scope shows no bar; a range that is not
    IPv4 none either. The column sorts by the share. No call is added: the two lists deviation 19
    already reads, on the same node, under the same `DhcpServer: View`. Its words, OURS: `N of M`,
    `X%`, `<1%`, `Dynamic N, Reserved N`, and the bar's name `<scope>: N of the M addresses in its
    range leased, X%`.

31. **Cluster compares the nodes' settings** (Adrián's decision, 2026-11-06;
    `screens/admin/NodeSettings.tsx`, `node-settings.ts`). With the cluster initialised, a
    `Settings Across Nodes` card under the node table reads `settings/get` once per node, with the
    node's name in `node` as Settings sends it (the server proxies the read to that node), again
    each time the sub-tab reads the cluster's state (arrival and Refresh). Read only: nothing is
    written. One column per node, one row per setting of a curated set, each with its group label:
    Identity (DNS Server Domain, Version, Up Since), Resolution (Local End Points, Recursion, DNSSEC
    Validation, IPv6 Support, EDNS Client Subnet, EDNS UDP Payload Size), Rate Limiting (QPM Sample
    Size, the IPv4 and IPv6 QPM limits), Zone Defaults (the three default TTLs), Blocking (Enable
    Blocking, Blocking Type), Forwarders (Forwarders, Forwarder Protocol), Logging (Enable Logging
    To). Labels and option labels are the Settings panes', without `(default)` and
    `(recommended)`. The domain and the start are each node's own and are never counted; any other
    row whose answering nodes disagree is marked `Differs`, with a warning rule down it, and listed
    first. The line over the table says `Every setting matches`, `N settings differ`, `Only one node
    answered` or `No node answered`; `Show only differences` hides the rest. A node that does not
    answer keeps its column, empty, marked `Unavailable`, and a line names it with the server's
    message (`<node> did not answer: <message>`); it takes no part in the comparison. Without
    `Settings: View` nothing is read and the card is locked (`Requires Settings: View`); that is the
    one permission Administration is told (`Admin`'s `canViewSettings`, from the Shell). Its words,
    OURS, are declared in the header comments of both files.
32. **Blocking remembers the lists and the rules you already have** (Adrián's request, 2026-11-06;
    `screens/blocking/list-history.ts`, `rule-match.ts`, `BlockLists.tsx`,
    `AddDomainBar.tsx`). Three additions, the first in two parts, inside deviation 2's four
    limits: no new endpoint, and each call sequence is one the section already makes.
    - **When the lists were last updated.** The Lists tab's Next update cell adds `Last
      updated <time>, <ago>`. The server does not send it, but `blockListNextUpdatedOn` is
      its last successful update plus the interval it sends beside it
      (WebServiceSettingsApi.cs:386), so the difference is the server's own value, not an
      estimate. Nothing is said without a schedule (the key omitted, or an interval of 0),
      for `default(DateTime)`, or while Update Now has just left `Updating Now`.
    - **Domains over time.** A fourth cell on Lists: every `Block List Domains` figure
      the Lists tab or Overview reads (`dashboard/stats/get`, the read each already makes;
      Overview only on the aggregate, which is what Lists reads) that differs from the last
      one kept is stored as `{ at, count }` in this browser's `localStorage`
      (`blocking-list-domains:<dnsServerDomain>`, at most 30, every access in try/catch).
      The newest three are drawn with their change (`+1,904`), the figure's own cell
      carries the last one (`+1,904 since <time>`), and the cell says the readings are kept
      in this browser. Without `Dashboard.canView` the cell is locked.
    - **Save and Update Now** in Lists' save bar, beside Save: Save exactly as it is, then,
      only if it succeeded and left lists to download (Update Now's own `hasSaved`
      condition), Update Now exactly as it is, from its confirmation on. Same permission
      as both, `Settings.canModify`.
    - **Already one of your rules?** Under the Block / Allow / Check bar's field, as the name
      is typed: whether one of your rules, the name or a parent rule covering it, already
      blocks or allows it, with the allow rule first when both cover it (it wins). On Rules
      it uses the table's rules; on Overview the bar reads `blocked/export` and
      `allowed/export` (each only with its View permission) once, on the first name typed,
      and again only after a Block or Allow made there. A list it could not read is named;
      with neither readable it says nothing. It never runs Check's DNS query: the block
      lists stay Check's answer.
    Their words, all OURS: `Last updated <time>, <ago>`, `Domains over time`, `No readings
    yet.`, `Kept in this browser when the count changes.`, `<change> since <time>`, the
    readings' label `Block List Domains, newest first`, `Save and Update Now`, `Already
    blocked: it is one of your rules.`, `Already blocked by your rule <rule>, which covers
    its subdomains.` and the same two for allowed, `It wins over your blocked rule
    <rule>.`, `Not one of your rules.` (and `Not one of your blocked rules.`, `Not one of
    your allowed rules.`), `Your blocked rules were not checked: Requires …` (and allowed),
    `Check asks the block lists.` and `Could not read your rules.`

33. **Zones across cluster nodes** (Adrián's decision, 2026-11-06; `screens/zones/AcrossNodes.tsx`,
    `across-nodes.ts`). With an initialised cluster the zone list's toolbar starts with `This
    node` / `All nodes`. `All nodes` reads `zones/list` with no page once per cluster node
    (`clusterNodes` of the session), with that node's `node` and the applied Name filter as
    upstream's `filterName` (the server filters before any page), and lays the answers side by
    side, one line per zone name: a column per node with that node's zone type, its serial and a
    `Disabled` pill, or `not on this node`, and a `Health` cell, the first that applies of `Only
    on N nodes` (an answering node does not hold it), `Serial differs` (two holders give
    different `soaSerial`; a node that gives none is not compared), `Disabled on a node` and
    `Healthy`. Chips with their counts filter it, each on its own rule: `All`, `On every node`,
    `Only on some nodes`, `Serial differs`. A node that fails to answer is said once above the
    table (`<node> did not answer: <the server's message>`), its column head says `(No answer)`,
    its cells `No answer`, and it is left out of every comparison. The type filter and the summary
    cards stand down in this view (they are one node's); the zone's name opens it as the list does,
    on the node the screen reads. The view (`?view=all`), the chip (`?across=`) and its page
    (`?apage=`, client side over the merged lines, at Zones Per Page) are in the address bar,
    written by replacing the entry, defaults left out, dropped with the section. Without a cluster
    nothing is drawn and `?view=` means nothing. Read only: its only call is `zones/list`, which
    upstream already sends with `node`. Its words, OURS, are declared in the header comment of
    `AcrossNodes.tsx`; `Zones view` is the toggle's accessible name (`ACCESSIBLE_NAMES` in
    `dev/check-parity-controls.mjs`).

34. **Quick add of a host record** (Adrián's decision, 2026-11-06; `screens/zones/QuickAdd.tsx`,
    `quick-add.ts`). A band of the zone list's toolbar, in both views: `Domain`, `IP Address`,
    upstream's `Add reverse (PTR) record` and `Create reverse zone if it does not exists` (the
    second enabled only while the first is ticked, as in the Add Record dialog), and `Add`, which
    needs `Zones: Modify` (the padlock otherwise). It refuses before sending, in this order: an
    empty name and an empty address (upstream's `Missing!` texts of Add Record), an address that
    is neither IPv4 nor IPv6 (`Invalid!`), a name no zone of this node holds (`Missing!`, with
    `Add Zone` on the notice), and a zone that takes no records from here (only `Primary` and
    `Forwarder`, the types whose row offers Edit Zone, and never an internal zone). The zone is the
    longest of the zones the list knows (the summary's unpaged read of this node) that the name
    ends in, whole labels only; the type is `A` or `AAAA` by the address's family. It sends what
    the dialog sends for that record (`buildRecordBody`): `zones/records/add` with `node` in the
    query, `ttl` the server's default record TTL (the dialog's placeholder), `overwrite=false`,
    `ptr` and `createPtrZone` as ticked, and `updateSvcbHints=true`, upstream's answer when the
    zone's records are not loaded (`zoneHasSvcbAutoHint`). Success is the dialog's `Record Added!`
    with `Open <zone>` on the notice (a notice may now carry one action, `lib/notice.ts`); failure
    is the server's `Error!`. After an add the list and its cards are read again. Its words, OURS:
    `Invalid!` and the texts of the last three refusals (in `quick-add.ts`), `Open <zone>` and the
    two placeholders.

35. **Cache is compared across the cluster's nodes** (Adrián's decision, 2026-11-06;
    `screens/lists/CacheAcross.tsx`, `cache-across.ts`). Each node keeps its own cache and
    upstream shows one at a time (`optCachedZonesClusterNode`, other-zones.js:106). On an
    initialised cluster, `All nodes` beside Cache's node selector reads the domain on screen
    with `cache/list` once per node, with that node's `node`, as the screen sends it, again
    with every answer the screen gets for the chosen node (a move, Refresh, the read after
    Flush Cache or Delete). It draws a cell per node with how many records it holds at the
    domain (the count Cache's foot already writes, from that node's answer; nothing new is
    asked for it) and, once, that each node keeps its own cache; one table of the records,
    merged by name, type and value, with a TTL column per node (the time left as Cache
    writes it, `Stale` included, or `not cached here`); and three filters with their counts,
    `All`, `On every node` and `On some nodes only`, measured over the nodes that answered.
    The zone chips under the domain are those of any node. Its limits, and crossing one is a
    bug:
    - **only `cache/list`**, with the domain the chosen node's answer names. A node whose
      server walked down to another domain (it holds no records at the domain and one child,
      WebServiceOtherZonesApi.cs:88-120) counts as holding nothing there;
    - **Flush Cache and Delete are untouched**: they still go to the node chosen in the
      selector, and the header, the path and the stale strip are still that node's read;
    - **a node that fails says so**: its cell says `Could not read this node.` with the
      server's message, its column's header `Not read` and its cells `not read`, never
      `not cached here`; with no node read the table says it could not read any;
    - **without a cluster nothing changes**: no switch, no read, and `?nodes=all` in the bar
      is not acted on. The view is kept in the address bar as `?nodes=all` while it is drawn
      (`lib/url-state.ts`), and leaves with the screen;
    - each node wears the series colour of its place in the session's list of nodes
      (`dashboard/palette.ts`, `nodeToken`), the colour deviation 36 gives its line.
    Its words, OURS, are declared in the header comment of `CacheAcross.tsx`.

36. **The Dashboard's Queries are compared by node** (Adrián's decision, 2026-11-06;
    `screens/dashboard/compare-nodes.ts`, `Dashboard.tsx`). On an initialised cluster with
    the aggregate (`Cluster`) chosen, `Compare nodes` in the Queries card's header draws one
    line per node: that node's own `Total` for the period, read with the request the
    Dashboard already makes (`dashboard/stats/get`, the same `type`, `utc` and, for Custom,
    `start` and `end`) once per node with that node's `node`. The aggregate's line is
    hidden while comparing; the eleven figures and everything else stay the aggregate's.
    Each node's line is laid on the aggregate's buckets by the instants the server wrote,
    so a bucket a node has no reading for is a gap, not a zero. Off by default and kept per
    browser in `localStorage` (`dashboardCompareNodes`), as the node choice is kept in
    `dashboardClusterNode`. Its limits, and crossing one is a bug:
    - **only `dashboard/stats/get`**, read again with each answer of the period on screen:
      a period or a reload asks every node once more, nothing else does;
    - **Last Hour stays live for the aggregate only** (deviation 5): the figures move every
      2 seconds as before, and the compared lines move with the minute reload, never with
      the live counters;
    - **a node that fails is left out of the chart** and named under it (`Left out: could
      not read N.`); with none read the card says it could not load, as for any failure;
    - **without a cluster, or on one node, nothing changes**: no switch and no read, even
      with the choice left on;
    - each node keeps the series colour of its place in the session's list of nodes, the
      one deviation 35 gives it in Cache, whichever other node failed. A point of a line
      opens Query Logs for its bucket, as the aggregate's does (deviation 7).
    Its words, OURS: `Compare nodes` and `Left out: could not read N.` (`Dashboard.tsx`).

## Four constraints the server imposes

These are not preferences: break them and the console works in development and
fails in production.

- **`base: './'`.** The server honours `X-Forwarded-Prefix` and mounts a
  `PathBase`. With absolute paths the console works locally and 404s behind a
  reverse proxy with a prefix. `dev/check-prefix.sh` checks it.
- **Real routes, one folder per route.** The server's only `MapFallback` is
  `/api/{*path}`, so a deep route with no file on disk would 404. The build emits
  one folder with its own `index.html` for each of the console's 36 routes (12
  sections, 23 sub-sections and `profile`, from `SECTIONS`), plus the two legacy
  folders `/allowed/` and `/blocked/` and the moved `/settings/blocking/`: 39 in all. The URL is real (no `#/`) and F5 brings
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
