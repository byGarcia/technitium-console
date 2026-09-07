#!/bin/sh
#
# Measures install.sh against the installer contract
# (docs/2026-09-07-installer-contract.md), one case per clause it can decide.
#
#   sh dev/installer-probe.sh          # DEBUG=1 to see what a failing case printed
#   IMAGE=<other> sh dev/installer-probe.sh   # to measure against another build
#
# Every case runs in a throwaway container off the official Technitium image, so
# nothing on this machine is touched and every run starts from the same stock
# console.
#
# The two mode B cases are not skipped by decree. The probe asks the image
# whether it honours DNS_SERVER_WEB_SERVICE_WWW_FOLDER_PATH — the same
# measurement the installer itself has to make — and runs them when it does.
# Point IMAGE at such a build and they run with no edit here.
#
# Exit code is the number of cases that failed, which is what makes this a gate
# and not a report.

set -u

IMAGE="${IMAGE:-technitium/dns-server:latest}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WWW=/opt/technitium/dns/www

[ -f "$ROOT/dist/index.html" ] || { echo "build first: npm run build"; exit 2; }
command -v docker >/dev/null 2>&1 || { echo "docker is needed"; exit 2; }

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT INT TERM
tar -czf "$WORK/console.tar.gz" -C "$ROOT/dist" .
cp "$ROOT/install.sh" "$WORK/install.sh"

# A file only this console ships. Proving it is *served* is the only honest way
# to say "the console is installed": a marker the installer wrote itself only
# proves the installer ran.
ASSET="$(cd "$ROOT/dist" && ls assets/*.js | head -1)"

PASS=0; FAIL=0; SKIP=0
say() { printf '  %-6s %-4s %s\n' "$1" "$2" "$3"; }
verdict() { # id, exit code of the case, text
  case "$2" in
    0) PASS=$((PASS+1)); say "PASS" "$1" "$3" ;;
    3) SKIP=$((SKIP+1)); say "SKIP" "$1" "$3" ;;
    *) FAIL=$((FAIL+1)); say "FAIL" "$1" "$3"
       [ "${DEBUG:-}" = "1" ] && sed 's/^/         | /' "$WORK/out" ;;
  esac
}

# Runs a case body as root inside a fresh container. The body gets $ASSET and
# the web root, and says "met" or "not met" with its exit code.
case_run() {
  cat > "$WORK/case.sh"
  docker run --rm --entrypoint sh -e "ASSET=$ASSET" -e "WWW=$WWW" \
    -v "$WORK":/w:ro "$IMAGE" /w/case.sh >"$WORK/out" 2>&1
}

printf '\n  installer contract — measured against %s\n\n' "$IMAGE"

# --------------------------------------------------------------- C1 · fresh
case_run <<'EOF'
set -e
printf '[{"name":"mine"}]\n' > "$WWW/json/quick-block-lists-custom.json"
sh /w/install.sh --from /w/console.tar.gz --yes >/dev/null 2>&1
[ -f "$WWW/$ASSET" ]
[ -f "$WWW/json/quick-block-lists-custom.json" ]
EOF
verdict "C1" $? "fresh install over the stock console, custom list kept"

# ------------------------------------------------------- C2 · re-run is a no-op
case_run <<'EOF'
set -e
sh /w/install.sh --from /w/console.tar.gz --yes >/dev/null 2>&1
sh /w/install.sh --from /w/console.tar.gz --yes >/dev/null 2>&1
[ -f "$WWW/$ASSET" ]
# the backup must still be the stock console and not a copy of ours
[ ! -f "$WWW.original/$ASSET" ]
[ -f "$WWW.original/js/main.js" ]
EOF
verdict "C2" $? "installing twice leaves the same state and keeps the real backup"

# ------------------------------------------------ C3 · after a server update
case_run <<'EOF'
set -e
tar -czf /stock.tar.gz -C "$WWW" .
sh /w/install.sh --from /w/console.tar.gz --yes >/dev/null 2>&1
tar -xzf /stock.tar.gz -C "$WWW"          # what upstream's own installer does on update
sh /w/install.sh --from /w/console.tar.gz --yes >/dev/null 2>&1
[ -f "$WWW/$ASSET" ]
[ ! -f "$WWW/js/main.js" ]                 # no leftovers of the console it replaced
EOF
verdict "C3" $? "reinstalling after a server update leaves only this console"

# ------------------------------------------- C4 · open set of custom lists
case_run <<'EOF'
set -e
printf '[]\n' > "$WWW/json/some-future-list-custom.json"
sh /w/install.sh --from /w/console.tar.gz --yes >/dev/null 2>&1
[ -f "$WWW/json/some-future-list-custom.json" ]
EOF
verdict "C4" $? "any *-custom.json is kept, not just the three known names"

# ------------------------------- C5 · a list written while ours is installed
case_run <<'EOF'
set -e
sh /w/install.sh --from /w/console.tar.gz --yes >/dev/null 2>&1
# The console has been in place for months and the administrator writes a list
# now. It lives in the served folder, which is the one the uninstall replaces.
printf '[{"name":"written later"}]\n' > "$WWW/json/quick-forwarders-list-custom.json"
sh /w/install.sh --uninstall --yes >/dev/null 2>&1
[ -f "$WWW/json/quick-forwarders-list-custom.json" ]
EOF
verdict "C5" $? "a custom list written after the install survives the uninstall"

# ------------------------------------------------------------ C6 · uninstall
case_run <<'EOF'
set -e
printf '[{"name":"mine"}]\n' > "$WWW/json/quick-block-lists-custom.json"
sh /w/install.sh --from /w/console.tar.gz --yes >/dev/null 2>&1
sh /w/install.sh --uninstall --yes >/dev/null 2>&1
[ -f "$WWW/js/main.js" ]
[ ! -f "$WWW/$ASSET" ]
[ -f "$WWW/json/quick-block-lists-custom.json" ]
EOF
verdict "C6" $? "uninstall puts the stock console back and keeps the custom lists"

# ------------------------------------------------- C7 · interrupted install
case_run <<'EOF'
# The shape of a run that was killed between wiping the web root and writing the
# new files: the backup is there, the web root is not. Nobody can promise this
# never happens (A2); what has to hold is that the next run repairs it.
set -e
cp -a "$WWW" "$WWW.original"
rm -rf "$WWW"; mkdir -p "$WWW"
sh /w/install.sh --uninstall --yes >/dev/null 2>&1 || true
[ -f "$WWW/js/main.js" ]
EOF
verdict "C7" $? "the next run repairs what an interrupted one left behind"

# --------------------------------------------------- C8 · nothing but console
case_run <<'EOF'
set -e
sh /w/install.sh --from /w/console.tar.gz --yes >/dev/null 2>&1
# Bookkeeping does not belong in a folder the web service hands to anyone who
# can reach the login page.
tar -tzf /w/console.tar.gz | sed -e 's|^\./||' -e 's|/.*||' | grep . | sort -u > /expected
ls -A "$WWW" | sort -u > /actual
comm -13 /expected /actual > /extra
[ ! -s /extra ]
EOF
verdict "C8" $? "the web root holds the console and nothing else"

# ------------------------------------------------------ C9 · bind-mounted root
mkdir -p "$WORK/mnt"; cp -a "$ROOT/dist/." "$WORK/mnt/"
cat > "$WORK/case9.sh" <<'EOF'
sh /w/install.sh --from /w/console.tar.gz --yes >/dev/null 2>&1
EOF
docker run --rm --entrypoint sh -v "$WORK":/w -v "$WORK/mnt":$WWW "$IMAGE" /w/case9.sh >/dev/null 2>&1
verdict "C9" $? "a web root that is a mount point can be installed into"

# ------------------------------------------------------ C10 · --dir, new folder
case_run <<'EOF'
sh /w/install.sh --dir /opt/technitium-console --from /w/console.tar.gz --yes >/dev/null 2>&1 || exit 1
[ -f "/opt/technitium-console/$ASSET" ]
EOF
verdict "C10" $? "--dir creates the folder the README tells Docker users to create"

# ------------------------------------------------------------ the server, live
#
# Some clauses can only be decided with the server running: whether it needs a
# restart, and whether it honours the variable.
NAME="installer-probe-$$"
PORT=""
start_server() { # extra docker arguments, e.g. the variable and its folder
  docker rm -f "$NAME" >/dev/null 2>&1
  docker run -d --name "$NAME" -P -e DNS_SERVER_ADMIN_PASSWORD=probe \
    -v "$WORK":/w:ro "$@" "$IMAGE" >/dev/null 2>&1
  PORT="$(docker port "$NAME" 5380/tcp 2>/dev/null | head -1 | sed 's/.*://')"
  # Any answer will do, including a 404: with the variable honoured the served
  # folder is not a console and "/" has nothing to give.
  i=0
  while [ "$i" -lt 40 ] && ! curl -s -o /dev/null "http://127.0.0.1:$PORT/" ; do
    i=$((i+1)); sleep 1
  done
}
stop_server() { docker rm -f "$NAME" >/dev/null 2>&1; }
in_server() { docker exec "$NAME" sh -c "$1" >/dev/null 2>&1; }

# ------------------------------------------------- C11 · no restart required
start_server
in_server "sh /w/install.sh --from /w/console.tar.gz --yes"
curl -sf -o /dev/null "http://127.0.0.1:$PORT/$ASSET"
verdict "C11" $? "the new console is served with no restart of the DNS service"
stop_server

# ------------------------------------------ C12/C13 · the environment variable
#
# Whether these two run is not a decision, it is a measurement — the same one W3
# asks the installer to make. Start the image with the variable pointing at a
# folder that already holds a file of ours, and ask the web service for it. The
# folder has to exist *before* the server starts, or a server that does honour
# the variable falls back to the default and says so in its log.
mkdir -p "$WORK/side"
printf 'capability probe\n' > "$WORK/side/capability-probe.txt"

start_server -e DNS_SERVER_WEB_SERVICE_WWW_FOLDER_PATH=/side -v "$WORK/side":/side
CAPABLE=no
curl -sf -o /dev/null "http://127.0.0.1:$PORT/capability-probe.txt" && CAPABLE=yes
VERSION="$(docker exec "$NAME" sh -c 'grep -ho "DNS Server (v[0-9.]*)" /var/log/technitium/dns/*.log | tail -1' 2>/dev/null | tr -d '()' | sed 's/DNS Server //')"
[ -n "$VERSION" ] || VERSION="this image"

if [ "$CAPABLE" = "yes" ]; then
  # Mode B, against a server that serves the folder the variable names.
  #
  # The list has to exist in the stock web root BEFORE the install, because half
  # of F3 is that the install carries it across. The other half is the way back.
  in_server "printf '[{\"name\":\"before\"}]\n' > $WWW/json/quick-block-lists-custom.json"
  in_server "sh /w/install.sh --from /w/console.tar.gz --yes"

  c12=0
  curl -sf -o /dev/null "http://127.0.0.1:$PORT/$ASSET" || c12=1
  in_server "[ -f $WWW/js/main.js ] && [ ! -f $WWW/$ASSET ]" || c12=1
  verdict "C12" $c12 "installs where the variable points and leaves www alone ($VERSION)"

  c13=0
  in_server "[ -f /side/json/quick-block-lists-custom.json ]" || c13=1   # carried across
  # And a list written afterwards, in the folder that is actually being served:
  # it exists nowhere else, so only the uninstall can bring it home.
  in_server "printf '[{\"name\":\"after\"}]\n' > /side/json/quick-forwarders-list-custom.json"
  in_server "sh /w/install.sh --uninstall --yes"
  in_server "[ -f $WWW/json/quick-forwarders-list-custom.json ]" || c13=1
  in_server "[ -f $WWW/json/quick-block-lists-custom.json ]" || c13=1
  verdict "C13" $c13 "the custom lists travel into the console's folder and back"

else
  verdict "C12" 3 "installs where the variable points and leaves www alone ($VERSION does not honour it)"
  verdict "C13" 3 "the custom lists travel into the console's folder and back ($VERSION does not honour it)"
fi
stop_server

# ---------------------------------------------- C14 · W1, asked not assumed
case_run <<'EOF'
set -e
# A server that is NOT where the two known paths say. The only way to find its
# web root is to ask the process that is running.
cp -a /opt/technitium/dns /opt/elsewhere
mv /opt/technitium/dns /opt/technitium/dns.moved
/usr/bin/dotnet /opt/elsewhere/DnsServerApp.dll /etc/dns >/dev/null 2>&1 &
i=0; while [ $i -lt 20 ] && ! grep -qa DnsServerApp /proc/[0-9]*/cmdline 2>/dev/null; do i=$((i+1)); sleep 1; done
sh /w/install.sh --from /w/console.tar.gz --yes >/dev/null 2>&1
[ -f "/opt/elsewhere/www/$ASSET" ]
[ ! -f "/opt/technitium/dns.moved/www/$ASSET" ]
EOF
verdict "C14" $? "the web root comes from the running server, not from a guess"

# ------------------------------------- C15 · W3, a variable nobody honours
if [ "$CAPABLE" = "yes" ]; then
  verdict "C15" 3 "does not install where the variable points when the server ignores it (this one does not ignore it)"
else
  start_server -e "DNS_SERVER_WEB_SERVICE_WWW_FOLDER_PATH=/side" -v "$WORK/side":/side
  in_server "sh /w/install.sh --from /w/console.tar.gz --yes"
  c15=0
  in_server "[ -f $WWW/$ASSET ]" || c15=1                      # went to the folder actually served
  in_server "[ ! -f /side/$ASSET ]" || c15=1                   # not to the one nobody reads
  in_server "! ls /side/technitium-console-probe-* >/dev/null 2>&1" || c15=1   # and took its probe with it
  verdict "C15" $c15 "refuses the folder the variable names when the server ignores it"
  stop_server
fi

# ------------------------------------------ C16 · F4, the server's own data
case_run <<'EOF'
set -e
# Let the server run once so /etc/dns is a real configuration and not an empty
# folder, then stop it so nothing moves under the comparison.
/usr/bin/dotnet /opt/technitium/dns/DnsServerApp.dll /etc/dns >/dev/null 2>&1 &
srv=$!
i=0; while [ $i -lt 30 ] && [ ! -f /etc/dns/dns.config ]; do i=$((i+1)); sleep 1; done
sleep 2; kill "$srv" 2>/dev/null || true; sleep 2
[ -f /etc/dns/dns.config ]                       # or the comparison below proves nothing

snapshot() { find /etc/dns /var/log/technitium /etc/systemd -type f -exec md5sum {} + 2>/dev/null | sort; md5sum /etc/resolv.conf 2>/dev/null || true; }
snapshot > /before
sh /w/install.sh --from /w/console.tar.gz --yes >/dev/null 2>&1
sh /w/install.sh --uninstall --yes >/dev/null 2>&1
snapshot > /after
diff /before /after
EOF
verdict "C16" $? "config, zones and resolv.conf come out byte for byte the same"

# -------------------------- C17 · A1 and A2, a failure at the publication point
case_run <<'EOF'
set -e
# Make every copy of a page fail, which is the worst moment there is: the assets
# of the new console are already in, the pages are not.
mkdir -p /usr/local/bin
cat > /usr/local/bin/cp <<'FAKE'
#!/bin/sh
for a in "$@"; do case "$a" in */index.html) exit 1 ;; esac; done
exec /bin/cp "$@"
FAKE
chmod +x /usr/local/bin/cp
sh /w/install.sh --from /w/console.tar.gz --yes >/dev/null 2>&1 && exit 1   # it must fail

# It failed where it had to fail: the new assets are already in, which is what
# makes the window safe, and no page has been swapped yet.
[ -f "$WWW/$ASSET" ]
[ -f "$WWW/index.html" ]
grep -q 'js/main.js' "$WWW/index.html"
[ -f "$WWW/js/main.js" ]
[ -d "$WWW/css" ]

rm -f /usr/local/bin/cp
sh /w/install.sh --from /w/console.tar.gz --yes >/dev/null 2>&1   # and the next run finishes the job
[ -f "$WWW/$ASSET" ]
[ ! -f "$WWW/js/main.js" ]
EOF
verdict "C17" $? "a failure mid-publication leaves a whole console, and the next run finishes"

# ------------------------------------------- C18 · A5, state out of the way
case_run <<'EOF'
set -e
sh /w/install.sh --from /w/console.tar.gz --yes >/dev/null 2>&1
[ -f /var/lib/technitium-console/install.state ]
grep -q '^webroot=' /var/lib/technitium-console/install.state
grep -q '^backup='  /var/lib/technitium-console/install.state
grep -q '^mode='    /var/lib/technitium-console/install.state
! ls -A "$WWW" | grep -q '^\.'
EOF
verdict "C18" $? "the bookkeeping lives outside the folder the server serves"

# ------------------------------ C19 · A7, a backup from another server version
#
# Needs the server running, because the version comes from its startup log.
start_server
in_server "sh /w/install.sh --from /w/console.tar.gz --yes"
c19=0
in_server "sed -i 's/^server_version=.*/server_version=v0.0.0.0/' /var/lib/technitium-console/install.state" || c19=1
in_server "sh /w/install.sh --uninstall --yes" && c19=1      # --yes must NOT be enough
in_server "[ -f $WWW/$ASSET ]" || c19=1                      # and nothing may have moved
in_server "sh /w/install.sh --uninstall --yes --restore-mismatched-backup" || c19=1
in_server "[ -f $WWW/js/main.js ]" || c19=1
verdict "C19" $c19 "a backup from another version needs its own flag, and --yes is not it"
stop_server

# ------------------------------------------ C20 · U2, the hybrid gets named
case_run <<'EOF'
set -e
tar -czf /stock.tar.gz -C "$WWW" .
sh /w/install.sh --from /w/console.tar.gz --yes >/dev/null 2>&1
tar -xzf /stock.tar.gz -C "$WWW"
sh /w/install.sh --from /w/console.tar.gz --yes 2>&1 | grep -q 'server was updated'
EOF
verdict "C20" $? "an update that put the stock console back is named, not silently undone"

# --------------------------------- C21 · S1 and S3, the service and the browser
case_run <<'EOF'
set -e
mkdir -p /usr/local/bin
printf '#!/bin/sh\ntouch /restarted\n' > /usr/local/bin/systemctl
printf '#!/bin/sh\ntouch /restarted\n' > /usr/local/bin/rc-service
chmod +x /usr/local/bin/systemctl /usr/local/bin/rc-service
sh /w/install.sh --from /w/console.tar.gz --yes > /out 2>&1
[ ! -f /restarted ]
! grep -qi 'F5' /out
EOF
verdict "C21" $? "no restart of the DNS service, and no cache advice that is not true"

printf '\n  %d met · %d not met · %d not applicable to this image\n\n' "$PASS" "$FAIL" "$SKIP"
exit "$FAIL"
