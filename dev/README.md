# Development harness

Two Technitium instances in Docker, to develop and verify the console redesign
without touching any real DNS server.

| Instance | Port | What it serves |
|---|---|---|
| `dev` | http://127.0.0.1:5380 | `dist/` mounted from the repo |
| `ref` | http://127.0.0.1:5381 | the `www` from the official image, untouched |
| `nodo2` | http://127.0.0.1:5382 | `dist/` too — the second node of the cluster |

User `admin`, password `technitium-ui-dev` on all three.

`nodo2` mounts the same build as `dev` on purpose: it is the only way to see a
screen **from the other side of a cluster**, and that is where half of `Cluster`'s
contract lives.

## The installer has its own bench

`sh dev/installer-probe.sh` measures `install.sh` against
`docs/2026-09-07-installer-contract.md`: twenty-one cases, one throwaway
container each off the same official image, exit code = cases failed. It does not
use the three containers below and does not touch them.

Two of its cases need a server that honours
`DNS_SERVER_WEB_SERVICE_WWW_FOLDER_PATH`, which no released one does yet. They
are not skipped by decree: the bench asks the image and believes the answer, so
pointing `IMAGE` at a build that honours it turns them on with no edit.

### Building an image that does honour it

The variable is twelve lines on the fork's `feat/configurable-www-folder`
branch. Building a server from it takes a `TechnitiumLibrary` beside it — the
server does not build alone — and nothing else:

```sh
mkdir -p /tmp/tw && cd /tmp/tw
git -C ~/code/ORBITLAB/projects/technitium-ui archive feat/configurable-www-folder \
  --prefix=DnsServer/ | tar -x                       # tracked files only: no node_modules
git clone --depth 1 -b develop https://github.com/TechnitiumSoftware/TechnitiumLibrary.git

SDK="docker run --rm --user $(id -u):$(id -g) -e HOME=/tmp -e NUGET_PACKAGES=/nuget \
  -v /tmp/tw:/src -v /tmp/tw/nuget:/nuget mcr.microsoft.com/dotnet/sdk:10.0"
for p in TechnitiumLibrary TechnitiumLibrary.ByteTree TechnitiumLibrary.IO \
         TechnitiumLibrary.Net TechnitiumLibrary.Security.OTP; do
  $SDK -w /src/TechnitiumLibrary dotnet build $p/$p.csproj -c Release
done                                                  # .Net.Firewall is Windows-only and not needed
$SDK -w /src/DnsServer dotnet publish DnsServerApp/DnsServerApp.csproj -c Release \
  -o DnsServerApp/bin/Release/publish                 # which is what the Dockerfile copies
docker build -t technitium-dns-server:wwwvar /tmp/tw/DnsServer

IMAGE=technitium-dns-server:wwwvar sh dev/installer-probe.sh   # 20 met, 1 not applicable
```

The library has to come from its **`develop`** branch: `master` is behind what
the server's `develop` expects and the build fails on `DnsClient.ResolverContext`.

## The cluster is DOWN — it was up on purpose, and it did its job

`dev` and `nodo2` formed a real two-node cluster —domain `cluster.test`, `dev`
primary and `nodo2` secondary— from 2026-09-04 until Administration was built.

**It was not incidental.** `screens/admin/Cluster.tsx` is 1.629 lines, the largest
screen in the console, and without a cluster the harness only ever shows «Cluster
Not Initialized» and two buttons. Contracting that would have been contracting its
empty state. With it, the screen was read **from both sides** — and that is how the
`Edit Node` rule turned out to depend on *who is looking*, not on the row:

```
esPrimario ? state === 'Self' : state === 'Self' || type === 'Primary'
```

### Taken down on 2026-09-04, and how

The condition it was kept for —**Administration built, recaptured and the gate
green**— was met: the section was built from both sides, `Edit Node` was checked on
the primary (one row) and on a secondary (two, its own and the primary's), and the
four `Force` dialogs were opened against a real cluster.

It came down **through the product's own path and without forcing**, which is also
the last check those two endpoints get:

```bash
# 1 · the secondary leaves, coordinating with the primary
T2=$(curl -s 'http://127.0.0.1:5382/api/user/login?user=admin&pass=technitium-ui-dev' | jq -r .token)
curl -s "http://127.0.0.1:5382/api/admin/cluster/secondary/leave?token=$T2&forceLeave=false&node="

# 2 · with no secondaries left, the primary deletes the cluster
TOK=$(curl -s 'http://127.0.0.1:5380/api/user/login?user=admin&pass=technitium-ui-dev' | jq -r .token)
curl -s "http://127.0.0.1:5380/api/admin/cluster/primary/delete?token=$TOK&forceDelete=false&node="

# 3 · and the zone the initialisation created, which upstream leaves behind
#     ("no data loss except for the Cluster configuration")
curl -s "http://127.0.0.1:5380/api/zones/delete?token=$TOK&zone=cluster.test"
```

**Order matters and `force` is not needed**: unforced, `primary/delete` only works
once there are no secondaries, which is exactly why step 1 goes first. Doing it
this way is the only end-to-end exercise those two endpoints have had against a
real cluster.

The harness is back to what `docs/baseline/README.md` describes: **six zones on
`dev`, no cluster**, the three containers up and the server domains back to `dev`
and `nodo2`.

```bash
# how it was created, if it ever has to be rebuilt
TOK=$(curl -s 'http://127.0.0.1:5380/api/user/login?user=admin&pass=technitium-ui-dev' | jq -r .token)
curl -s -G http://127.0.0.1:5380/api/admin/cluster/init \
  --data-urlencode "token=$TOK" \
  --data-urlencode 'clusterDomain=cluster.test' \
  --data-urlencode 'primaryNodeIpAddresses=172.23.0.4'   # the docker IP of `dev`

T2=$(curl -s 'http://127.0.0.1:5382/api/user/login?user=admin&pass=technitium-ui-dev' | jq -r .token)
curl -s -X POST http://127.0.0.1:5382/api/admin/cluster/initJoin \
  --data-urlencode "token=$T2" \
  --data-urlencode 'secondaryNodeIpAddresses=172.23.0.3' \
  --data-urlencode 'primaryNodeUrl=https://dev.cluster.test:53443/' \
  --data-urlencode 'primaryNodeIpAddress=172.23.0.4' \
  --data-urlencode 'ignoreCertificateErrors=true' \
  --data-urlencode 'primaryNodeUsername=admin' \
  --data-urlencode 'primaryNodePassword=technitium-ui-dev' \
  --data-urlencode 'primaryNodeTotp='
```

Two things that cost a try each: the domain cannot be one that already exists as a
non-primary zone —`lab.test` was rejected— and **the join needs the primary's
DOMAIN NAME, not its IP**, even though it takes the IP as a separate parameter.

The IPs are the container ones and change if the network is recreated:
`docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' technitium-ui-dev`.

```bash
docker compose up -d      # start
./check-parity.sh        # compare dev's front page against ref
./check-parity.sh /api/  # compare another path
docker compose down -v    # tear everything down, config included
```

`ref` is the reference truth: the project's constraint is that behaviour must not
change, so any non-visual divergence between the two is a bug.

Port 53 is not mapped (`systemd-resolved` holds it on WSL) and DHCP is not
enabled: only the web console is exercised here.

## Why the comparison normalises line endings

`check-parity.sh` strips `\r` before hashing, so it compares content and not
bytes. This is necessary, not cosmetic:

Upstream's `.gitattributes` declares `* text=auto`. Git stores **LF** in the
repository blobs and converts on checkout according to the platform. Our tree on
Linux has LF —and `git status` sees it clean, it is byte-correct with respect to
the repository— while **the official Docker image ships CRLF**, because it was
built on Windows.

Without normalising, two files with identical content come out different by one
byte per line: in `index.html` that is 7,426 bytes of difference out of 619,718.
Found when running the first parity check of phase 0.
