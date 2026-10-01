#!/bin/sh
#
# Measures install.sh against the installer contract
# (docs/2026-09-07-installer-contract.md), one case per clause it can decide.
#
#   sh dev/installer-probe.sh          # DEBUG=1 to see what a failing case printed
#   IMAGE=<other> sh dev/installer-probe.sh   # to measure against another build
#   INSTALLER=<file> sh dev/installer-probe.sh # to measure another install.sh,
#                                              # e.g. the last release's, and see
#                                              # a new case fail on it
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
INSTALLER="${INSTALLER:-$ROOT/install.sh}"
WWW=/opt/technitium/dns/www

[ -f "$ROOT/dist/index.html" ] || { echo "build first: npm run build"; exit 2; }
command -v docker >/dev/null 2>&1 || { echo "docker is needed"; exit 2; }

WORK="$(mktemp -d)"
# Some cases leave containers, a compose project and an image behind if they are
# interrupted, and write as root into folders of $WORK that the user running
# this cannot remove. All of it goes on the way out.
cleanup() {
  docker compose -p "installer-probe-$$" -f "$WORK/compose.yaml" down -v >/dev/null 2>&1 || true
  docker rm -f "installer-probe-$$" "installer-probe-$$-rw" "installer-probe-$$-root" \
    "installer-probe-$$-pipe" "installer-probe-$$-other" "installer-probe-$$-vol" >/dev/null 2>&1 || true
  docker volume rm "installer-probe-$$-www" >/dev/null 2>&1 || true
  docker rmi "technitium-console-init:probe-$$" "technitium-console-init:probe-$$-badsum" \
    "technitium-console-init:probe-$$-nosum" >/dev/null 2>&1 || true
  docker run --rm -v "$WORK":/w busybox:stable sh -c 'rm -rf /w/* /w/.[!.]*' >/dev/null 2>&1 || true
  rm -rf "$WORK"
}
# A signal stops the run: cleaning up and carrying on would run the remaining
# cases against a $WORK that is gone. The exit is what runs cleanup.
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
tar -czf "$WORK/console.tar.gz" -C "$ROOT/dist" .
cp "$INSTALLER" "$WORK/install.sh"

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
verdict "C10" $? "--dir creates a folder that does not exist yet"

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
docker exec "$NAME" sh /w/install.sh --from /w/console.tar.gz --yes > "$WORK/out" 2>&1
c11=0
curl -sf -o /dev/null "http://127.0.0.1:$PORT/$ASSET" || c11=1
grep -q 'goes the next time the container is recreated' "$WORK/out" || c11=1   # its own layer: said so
verdict "C11" $c11 "served with no restart, and an install into a container's own files is called out"
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
  # The capability file goes first: a folder holding a file that is not a
  # console is exactly what the installer must refuse to sweep (W6), and an
  # administrator's empty folder is what this case is about.
  rm -f "$WORK/side/capability-probe.txt"
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
  # The folder is a bind mount here, as in the README's Docker layout: the
  # uninstall has to finish on it, not stop at the mount point (2026-09-30 —
  # it did, and this case did not look at the exit code).
  in_server "sh /w/install.sh --uninstall --yes" || c13=1
  in_server '[ -z "$(ls -A /side)" ]' || c13=1
  in_server "[ -f $WWW/json/quick-forwarders-list-custom.json ]" || c13=1
  in_server "[ -f $WWW/json/quick-block-lists-custom.json ]" || c13=1
  verdict "C13" $c13 "the custom lists travel into the console's folder and back, and the uninstall finishes on a mount point"

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

echo "step: a TERM in the middle of the sweep, as docker stop sends one"
sh /w/install.sh --uninstall --yes >/dev/null 2>&1   # the stock console back, so there is something to sweep
[ -f "$WWW/js/main.js" ]
# The first removal of a file of the console being replaced sends the run a TERM.
cat > /usr/local/bin/rm <<'FAKE'
#!/bin/sh
for a in "$@"; do
  case "$a" in
    "$WWW"/*.tc-new) ;;
    "$WWW"/*) [ -e /termed ] || { : > /termed; kill -TERM "$PPID"; } ;;
  esac
done
exec /bin/rm "$@"
FAKE
chmod +x /usr/local/bin/rm
sh /w/install.sh --from /w/console.tar.gz --yes && exit 1          # it stops,
[ -e /termed ]                                                     # in the sweep,
[ -f "$WWW/$ASSET" ]                                               # with nothing of the new console swept
grep -q '<div id="root"></div>' "$WWW/index.html"
grep -qx 'phase=done' /var/lib/technitium-console/install.state && exit 1   # and not recorded as finished
/bin/rm -f /usr/local/bin/rm
sh /w/install.sh --from /w/console.tar.gz --yes >/dev/null 2>&1   # the next run repairs it (A2)
[ -f "$WWW/$ASSET" ]
[ ! -f "$WWW/js/main.js" ]
grep -qx 'phase=done' /var/lib/technitium-console/install.state
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

# ---------------------------- C22 · W6, a folder that is not a console is refused
#
# Publishing sweeps whatever the release does not ship, as root. Pointed at the
# server's own folder by mistake, that is the binaries and nothing left to run.
# The "step:" lines are what DEBUG=1 shows, to say which half failed.
case_run <<'EOF'
set -e
fingerprint() { find "$1" -type f -exec md5sum {} + | sort; }
fingerprint /opt/technitium/dns > /before

echo "step: --dir at the server's own folder, no TTY and no --yes"
sh /w/install.sh --dir /opt/technitium/dns --from /w/console.tar.gz </dev/null && exit 1
echo "step: the same with --yes"
sh /w/install.sh --dir /opt/technitium/dns --from /w/console.tar.gz --yes && exit 1
fingerprint /opt/technitium/dns > /after
diff /before /after
[ ! -e /opt/technitium/dns.original ]

echo "step: a folder of somebody else's files"
mkdir -p /srv/data; printf 'keep\n' > /srv/data/notes.txt
sh /w/install.sh --dir /srv/data --from /w/console.tar.gz --yes && exit 1
[ -f /srv/data/notes.txt ]
[ ! -f "/srv/data/$ASSET" ]

echo "step: an empty folder is still what --dir is for"
mkdir -p /srv/empty
sh /w/install.sh --dir /srv/empty --from /w/console.tar.gz --yes
[ -f "/srv/empty/$ASSET" ]
EOF
verdict "C22" $? "refuses a folder that is neither empty nor a console, and changes nothing"

# ------------------------- C23 · W7, the server is identified, not the first match
case_run <<'EOF'
set -e
mkdir -p /victim; printf 'precious\n' > /victim/data.txt
# Something that looks like the server to /proc: its last argument ends in
# DnsServerApp.dll. Nothing else about it is real, which is the point.
look_alike() { sh -c 'sleep 300; :' "$1" & sleep 1; }

echo "step: an unprivileged account's look-alike, www pointing elsewhere"
mkdir -p /tmp/evil; touch /tmp/evil/DnsServerApp.dll; ln -s /victim /tmp/evil/www
chown -hR nobody /tmp/evil
setpriv --reuid=65534 --regid=65534 --clear-groups sh -c 'sleep 300; :' /tmp/evil/DnsServerApp.dll &
evil=$!; sleep 1
sh /w/install.sh --from /w/console.tar.gz --yes > /out 2>&1   # so the known folder
grep -q 'Not trusting process' /out                 # ignored, and said so
[ -f /victim/data.txt ]
[ -f "$WWW/$ASSET" ]
kill "$evil"
sh /w/install.sh --uninstall --yes

echo "step: a root process whose www is a symbolic link"
mkdir -p /opt/linked; touch /opt/linked/DnsServerApp.dll; ln -s /victim /opt/linked/www
look_alike /opt/linked/DnsServerApp.dll; linked=$!
sh /w/install.sh --from /w/console.tar.gz --yes && exit 1
[ -f /victim/data.txt ]
[ ! -f "/victim/$ASSET" ]
kill "$linked"

echo "step: two servers, and no silent choice between them"
mkdir -p /opt/second; cp -a "$WWW" /opt/second/www; touch /opt/second/DnsServerApp.dll
look_alike /opt/technitium/dns/DnsServerApp.dll; one=$!
look_alike /opt/second/DnsServerApp.dll; two=$!
sh /w/install.sh --from /w/console.tar.gz --yes > /out 2>&1 && exit 1
grep -q -- '--dir' /out
[ ! -f "$WWW/$ASSET" ]
[ ! -f "/opt/second/www/$ASSET" ]
kill "$one" "$two"

echo "step: --dir through a link is resolved once, and used resolved"
ln -s "$WWW" /opt/console-link
sh /w/install.sh --dir /opt/console-link --from /w/console.tar.gz --yes
[ -f "$WWW/$ASSET" ]
grep -qx "webroot=$WWW" /var/lib/technitium-console/install.state
[ -d "$WWW.original" ]
[ ! -e /opt/console-link.original ]
[ -L /opt/console-link ]
EOF
verdict "C23" $? "a look-alike process, a linked www or two servers are not taken on trust"

# -------------------------------- C24 · A8, uninstall acts on what it recorded
#
# Mode B, with a server started by hand so it can be restarted without the
# variable in the same container — the audit's case: the variable is removed,
# the server restarted, and only then is --uninstall run.
case_run <<'EOF'
set -e
up() { i=0; while [ $i -lt 60 ] && ! curl -s -o /dev/null http://127.0.0.1:5380/; do i=$((i+1)); sleep 1; done; }
mkdir -p /side
DNS_SERVER_WEB_SERVICE_WWW_FOLDER_PATH=/side /usr/bin/dotnet /opt/technitium/dns/DnsServerApp.dll /etc/dns >/dev/null 2>&1 &
srv=$!; up
echo "step: install into the variable's folder"
sh /w/install.sh --from /w/console.tar.gz --yes
[ -f "/side/$ASSET" ]
grep -qx 'mode=side-by-side' /var/lib/technitium-console/install.state
kill "$srv"; wait "$srv" || true

/usr/bin/dotnet /opt/technitium/dns/DnsServerApp.dll /etc/dns >/dev/null 2>&1 &
srv=$!; up
echo "step: uninstall after the variable is gone"
sh /w/install.sh --uninstall --yes
[ ! -e /side ]                              # the folder it installed into went
[ -f "$WWW/js/main.js" ]                    # and the server's own did not
[ -f "$WWW/index.html" ]

echo "step: a recorded folder that no longer looks like this console is left alone"
mkdir -p /srv/precious /var/lib/technitium-console
printf 'keep\n' > /srv/precious/data.txt
printf 'mode=side-by-side\nwebroot=/srv/precious\n' > /var/lib/technitium-console/install.state
sh /w/install.sh --uninstall --yes && exit 1
[ -f /srv/precious/data.txt ]
[ -f "$WWW/js/main.js" ]
EOF
verdict "C24" $? "--uninstall removes the folder it recorded, and only if it is still this console"

# ------------------------------------- C25 · I1, the download is the release
#
# A curl of our own plays GitHub: the tarball, and whatever checksum /hash says.
case_run <<'EOF'
set -e
mkdir -p /usr/local/bin
cat > /usr/local/bin/curl <<'FAKE'
#!/bin/sh
out=""; url=""
while [ $# -gt 0 ]; do
  case "$1" in -o) out="$2"; shift ;; -*) ;; *) url="$1" ;; esac
  shift
done
case "$url" in
  */technitium-console.tar.gz)        cp /w/console.tar.gz "$out" ;;
  */technitium-console.tar.gz.sha256) [ -f /hash ] || exit 22; cp /hash "$out" ;;
esac
FAKE
chmod +x /usr/local/bin/curl

echo "step: a checksum that does not match"
printf '%064d  technitium-console.tar.gz\n' 0 > /hash
sh /w/install.sh --yes && exit 1
[ -f "$WWW/js/main.js" ]
[ ! -f "$WWW/$ASSET" ]

echo "step: no checksum at all"
rm -f /hash
sh /w/install.sh --yes && exit 1
[ ! -f "$WWW/$ASSET" ]

echo "step: the checksum the release publishes"
printf '%s  technitium-console.tar.gz\n' "$(sha256sum /w/console.tar.gz | cut -d' ' -f1)" > /hash
sh /w/install.sh --yes
[ -f "$WWW/$ASSET" ]

echo "step: --from says it did not verify"
sh /w/install.sh --from /w/console.tar.gz --yes 2>&1 | grep -q 'not verified'
EOF
verdict "C25" $? "a download that does not match the release's .sha256 is refused"

# ------------------------------------------------- Docker: the init image (D1–D4)
#
# The layout README.md gives Docker users (docs/2026-10-01-docker-install-spec.md):
# an init container off our image copies the console into a volume, and the
# official server mounts it read-only with the variable pointing at it. The
# image is built here from dist/ with the same three files CI puts in it from a
# release, so what is measured is this checkout's Dockerfile and install.sh.
#
# Every case needs a server that honours the variable, which was measured above
# (CAPABLE). C30 also needs docker:cli and the Docker socket.
INIT_IMAGE="technitium-console-init:probe-$$"
PROJECT="installer-probe-$$"
dc() { docker compose -p "$PROJECT" -f "$WORK/compose.yaml" "$@"; }

build_init() { # [marker] — the image, with probe-marker.txt in its tarball if given
  rm -rf "$WORK/img"; mkdir -p "$WORK/img/dist"
  cp -a "$ROOT/dist/." "$WORK/img/dist/"
  [ -z "${1:-}" ] || printf '%s\n' "$1" > "$WORK/img/dist/probe-marker.txt"
  tar -czf "$WORK/img/technitium-console.tar.gz" -C "$WORK/img/dist" .
  rm -rf "$WORK/img/dist"
  (cd "$WORK/img" && sha256sum technitium-console.tar.gz > technitium-console.tar.gz.sha256)
  cp "$INSTALLER" "$WORK/img/install.sh"
  cp "$ROOT/docker/Dockerfile" "$WORK/img/Dockerfile"
  docker build -q -t "$INIT_IMAGE" "$WORK/img" >/dev/null 2>&1
}

compose_file() { # where the console lives: the volume, or a folder on this host
  # [the init's /target, when it is not the same — a mistake C29 makes on purpose]
  cat > "$WORK/compose.yaml" <<EOF
# The block in README.md, «Docker» — they change together. Only the two image
# names, a published port and the admin password are the probe's own.
services:
  dns-server:
    image: $IMAGE
    ports:
      - "127.0.0.1::5380"
    environment:
      - DNS_SERVER_ADMIN_PASSWORD=probe
      - DNS_SERVER_WEB_SERVICE_WWW_FOLDER_PATH=/opt/technitium-console
    volumes:
      - config:/etc/dns
      - $1:/opt/technitium-console:ro

  technitium-console:
    image: $INIT_IMAGE
    volumes:
      - ${2:-$1}:/target
    restart: "no"

volumes:
  config:
  technitium-console:
EOF
}

base() { printf 'http://127.0.0.1:%s' "$(dc port dns-server 5380 2>/dev/null | sed 's/.*://')"; }
served() { # path — the init and the server start side by side, so it waits
  i=0
  while [ "$i" -lt 60 ]; do
    curl -sf -o /dev/null "$(base)/$1" && return 0
    i=$((i+1)); sleep 1
  done
  return 1
}
init_exit() { docker wait "$(dc ps -a -q technitium-console)" 2>/dev/null; }
started_at() { docker inspect -f '{{.State.StartedAt}}' "$(dc ps -q dns-server)" 2>/dev/null; }
in_volume() { docker run --rm -v "${PROJECT}_technitium-console:/v" busybox:stable sh -c "$1"; }
in_config() { docker run --rm -v "${PROJECT}_config:/v" busybox:stable sh -c "$1"; }
section() { # container — its part of what the Docker branch printed
  awk -v n="$1" '/^  container /{ on = ($2 == n) } on' "$WORK/out"
}
host() { # install.sh as `curl … | sudo sh` runs it on a Docker host: from stdin, $0 is "sh"
  docker run --rm -i -v /var/run/docker.sock:/var/run/docker.sock docker:cli sh -s -- "$@" < "$INSTALLER"
}
if [ "$CAPABLE" != "yes" ]; then
  for c in C26 C27 C28 C29 C30; do
    verdict "$c" 3 "the Docker layout ($VERSION does not honour the variable)"
  done
else

# ----------------------------------------- C26 · D4, the image fills the volume
build_init
compose_file technitium-console
c26=0
dc up -d >"$WORK/out" 2>&1 || c26=1
[ "$(init_exit)" = "0" ] || c26=1
served "$ASSET" || c26=1
[ "$(curl -s -o /dev/null -w '%{http_code}' "$(base)/js/main.js")" = "404" ] || c26=1   # not the stock one behind it
want="$(cut -d' ' -f1 < "$WORK/img/technitium-console.tar.gz.sha256")"
got="$(docker run --rm --entrypoint sha256sum "$INIT_IMAGE" /usr/share/technitium-console/technitium-console.tar.gz | cut -d' ' -f1)"
[ -n "$got" ] && [ "$got" = "$want" ] || c26=1                                         # the bytes it was built with
tar -tzf "$WORK/img/technitium-console.tar.gz" | sed -e 's|^\./||' -e 's|/.*||' | grep . | sort -u > "$WORK/expected"
in_volume 'ls -A /v' | grep -vx '\.technitium-console' | sort -u > "$WORK/actual"
[ -z "$(comm -13 "$WORK/expected" "$WORK/actual")" ] || c26=1                           # A6: nothing but the console…
in_volume '[ -f /v/.technitium-console ] && [ ! -L /v/.technitium-console ]' || c26=1     # …and the marker (A6's one exception)
[ "$(curl -s -o /dev/null -w '%{http_code}' "$(base)/.technitium-console")" != "200" ] || c26=1   # which is never served
dc logs technitium-console > "$WORK/out" 2>&1
grep -q 'Checksum matches' "$WORK/out" || c26=1
! grep -q 'sudo' "$WORK/out" || c26=1                                                    # no host advice from inside the image
verdict "C26" $c26 "the init image fills the volume from the release's own bytes, and the server serves it"

# ------------------------------------------ C27 · D2, an update restarts nothing
c27=0
before="$(started_at)"
build_init "c27"                                       # a new release, as far as the volume can tell
dc up -d technitium-console >"$WORK/out" 2>&1 || c27=1 # what the README says updating is
[ "$(init_exit)" = "0" ] || c27=1
served probe-marker.txt || c27=1
[ "$(curl -s "$(base)/probe-marker.txt")" = "c27" ] || c27=1
[ "$(started_at)" = "$before" ] || c27=1               # the server was never restarted
dc up -d >>"$WORK/out" 2>&1 || c27=1                   # nor by bringing the whole file up again
[ "$(started_at)" = "$before" ] || c27=1
! dc logs technitium-console 2>&1 | grep -qi 'backed up' || c27=1   # a second pass is not a first install
verdict "C27" $c27 "updating the console restarts nothing and is served at once"

# --------------------------------------------- C28 · D3, the lists stay, and W6
c28=0
in_volume 'printf "[{\"name\":\"mine\"}]\n" > /v/json/quick-block-lists-custom.json' || c28=1
build_init "c28"
dc up -d technitium-console >"$WORK/out" 2>&1 || c28=1
[ "$(init_exit)" = "0" ] || c28=1
served probe-marker.txt || c28=1
[ "$(curl -s "$(base)/probe-marker.txt")" = "c28" ] || c28=1
[ "$(curl -s "$(base)/json/quick-block-lists-custom.json")" = '[{"name":"mine"}]' ] || c28=1
dc up -d --force-recreate dns-server >>"$WORK/out" 2>&1 || c28=1
served "$ASSET" || c28=1
[ "$(curl -s "$(base)/json/quick-block-lists-custom.json")" = '[{"name":"mine"}]' ] || c28=1
dc down -v >/dev/null 2>&1
# A folder on the host, holding only a list written by hand before the first run.
mkdir -p "$WORK/bind/json"
printf '[{"name":"by hand"}]\n' > "$WORK/bind/json/quick-forwarders-list-custom.json"
compose_file "$WORK/bind"
dc up -d >>"$WORK/out" 2>&1 || c28=1
[ "$(init_exit)" = "0" ] || c28=1
served "$ASSET" || c28=1
[ "$(cat "$WORK/bind/json/quick-forwarders-list-custom.json")" = '[{"name":"by hand"}]' ] || c28=1
[ "$(curl -s "$(base)/json/quick-forwarders-list-custom.json")" = '[{"name":"by hand"}]' ] || c28=1
# The bind folder, through an update and a new server container.
build_init "c28b"
dc up -d technitium-console >>"$WORK/out" 2>&1 || c28=1
[ "$(init_exit)" = "0" ] || c28=1
[ "$(curl -s "$(base)/probe-marker.txt")" = "c28b" ] || c28=1
[ "$(cat "$WORK/bind/json/quick-forwarders-list-custom.json")" = '[{"name":"by hand"}]' ] || c28=1
dc up -d --force-recreate dns-server >>"$WORK/out" 2>&1 || c28=1
served "$ASSET" || c28=1
[ "$(curl -s "$(base)/probe-marker.txt")" = "c28b" ] || c28=1
[ "$(curl -s "$(base)/json/quick-forwarders-list-custom.json")" = '[{"name":"by hand"}]' ] || c28=1
dc down -v >/dev/null 2>&1
verdict "C28" $c28 "custom lists, in the volume or in a host folder, survive updates and a new server container"

# --------------------------------- C29 · D1, a failing init does not stop the DNS
c29=0
echo "step: a volume holding somebody else's files" > "$WORK/log29"
compose_file technitium-console
dc create >"$WORK/out" 2>&1 || c29=1                   # the volume exists; nothing runs yet
in_volume 'printf "keep\n" > /v/notes.txt' || c29=1    # somebody else's files: W6 has to stop the init
dc up -d >>"$WORK/out" 2>&1 || c29=1
[ "$(init_exit)" = "1" ] || c29=1
dc logs technitium-console 2>&1 | grep -q 'not a Technitium console' || c29=1   # …and stopped it for that reason
[ "$(docker inspect -f '{{.State.Running}}' "$(dc ps -q dns-server)")" = "true" ] || c29=1
i=0; while [ "$i" -lt 60 ] && ! curl -s -o /dev/null "$(base)/"; do i=$((i+1)); sleep 1; done
curl -s -o /dev/null "$(base)/" || c29=1               # and it answers
[ "$(in_volume 'cat /v/notes.txt')" = "keep" ] || c29=1
in_volume "[ ! -e /v/$ASSET ] && [ ! -e /v/.technitium-console ]" || c29=1   # nothing written, not even the marker
dc down -v >/dev/null 2>&1

echo "step: no volume at /target: c29=$c29" >> "$WORK/log29"
docker run --rm "$INIT_IMAGE" >"$WORK/novol" 2>&1 && c29=1   # no volume at /target: refused,
grep -q 'not a mounted volume' "$WORK/novol" || c29=1           # and not copied into nothing

echo "step: a bad or a missing checksum: c29=$c29" >> "$WORK/log29"
# The same image with its .sha256 altered, and with it gone: entrypoint and all.
printf '%064d  technitium-console.tar.gz\n' 0 > "$WORK/img/bad.sha256"
printf 'FROM %s\nCOPY bad.sha256 /usr/share/technitium-console/technitium-console.tar.gz.sha256\n' "$INIT_IMAGE" > "$WORK/img/Dockerfile.badsum"
printf 'FROM %s\nRUN rm /usr/share/technitium-console/technitium-console.tar.gz.sha256\n' "$INIT_IMAGE" > "$WORK/img/Dockerfile.nosum"
for v in badsum nosum; do
  docker build -q -f "$WORK/img/Dockerfile.$v" -t "$INIT_IMAGE-$v" "$WORK/img" >/dev/null 2>&1 || c29=1
done
dc create >>"$WORK/out" 2>&1 || c29=1                  # a fresh, empty volume
for v in badsum nosum; do
  docker run --rm -v "${PROJECT}_technitium-console:/target" "$INIT_IMAGE-$v" >>"$WORK/out" 2>&1 && c29=1
  [ -z "$(in_volume 'ls -A /v')" ] || c29=1             # nothing written, not even the marker
done
grep -q 'does not match the release' "$WORK/out" || c29=1
grep -q 'no checksum next to' "$WORK/out" || c29=1
dc down -v >/dev/null 2>&1

echo "step: an interrupted first copy, then the next run: c29=$c29" >> "$WORK/log29"
dc create >>"$WORK/out" 2>&1 || c29=1
# What a first copy stopped halfway leaves: the marker, some assets, no page.
docker run --rm --entrypoint sh -v "${PROJECT}_technitium-console:/target" "$INIT_IMAGE" -c \
  'mkdir /tmp/x && tar -xzf /usr/share/technitium-console/technitium-console.tar.gz -C /tmp/x &&
   cp -a /tmp/x/assets /target/ && printf "technitium-console\n" > /target/.technitium-console' >>"$WORK/out" 2>&1 || c29=1
in_volume "[ -f /v/$ASSET ] && [ ! -e /v/index.html ]" || c29=1
dc up -d >>"$WORK/out" 2>&1 || c29=1                   # the next up finishes it
[ "$(init_exit)" = "0" ] || c29=1
served "$ASSET" || c29=1
served index.html || c29=1
in_volume '[ -f /v/.technitium-console ]' || c29=1
dc down -v >/dev/null 2>&1

echo "step: a host folder with custom lists and another file: c29=$c29" >> "$WORK/log29"
mkdir -p "$WORK/mixed/json"
printf '[{"name":"mine"}]\n' > "$WORK/mixed/json/quick-block-lists-custom.json"
printf 'keep\n' > "$WORK/mixed/notes.txt"
compose_file "$WORK/mixed"
dc up -d >>"$WORK/out" 2>&1 || c29=1
[ "$(init_exit)" = "1" ] || c29=1
dc logs technitium-console 2>&1 | grep -q 'not a Technitium console' || c29=1
[ "$(docker inspect -f '{{.State.Running}}' "$(dc ps -q dns-server)")" = "true" ] || c29=1
[ "$(cat "$WORK/mixed/notes.txt")" = "keep" ] || c29=1
[ "$(cat "$WORK/mixed/json/quick-block-lists-custom.json")" = '[{"name":"mine"}]' ] || c29=1
[ ! -e "$WORK/mixed/$ASSET" ] && [ ! -e "$WORK/mixed/.technitium-console" ] || c29=1
dc down -v >/dev/null 2>&1
echo "step: the volumes swapped, the init's /target on the server's config: c29=$c29" >> "$WORK/log29"
compose_file technitium-console config
dc up -d dns-server >>"$WORK/out" 2>&1 || c29=1        # the server's data first, as on a live host
i=0; while [ "$i" -lt 60 ] && ! in_config '[ -f /v/dns.config ]'; do i=$((i+1)); sleep 1; done
dc stop dns-server >>"$WORK/out" 2>&1 || c29=1         # so nothing moves under the comparison
in_config 'find /v -type f -exec md5sum {} + | sort' > "$WORK/conf.before"
grep -q '/v/dns.config$' "$WORK/conf.before" || c29=1   # or the comparison proves nothing
dc up -d technitium-console >>"$WORK/out" 2>&1 || c29=1
[ "$(init_exit)" = "1" ] || c29=1
dc logs technitium-console 2>&1 | grep -q "DNS server's configuration" || c29=1
in_config 'find /v -type f -exec md5sum {} + | sort' > "$WORK/conf.after"
cmp -s "$WORK/conf.before" "$WORK/conf.after" || c29=1
in_config "[ ! -e /v/.technitium-console ] && [ ! -e /v/$ASSET ]" || c29=1
dc down -v >/dev/null 2>&1

echo "step: the volumes swapped on a first up, init and server at once, three times: c29=$c29" >> "$WORK/log29"
# The init may get there before the server has written anything, and then the
# folder is empty and it installs. What must hold is that it never removes what
# the server writes meanwhile: its sweep only touches what was there before.
n=0
while [ "$n" -lt 3 ]; do
  n=$((n+1))
  compose_file technitium-console config
  dc up -d >>"$WORK/out" 2>&1 || c29=1
  init_exit >/dev/null                                 # whichever way it went
  first_boot='[ -f /v/dns.config ] && [ -f /v/auth.config ] && [ -f /v/webservice.config ] && [ -f /v/scopes/Default.scope ] && [ -d /v/blocklists ]'
  i=0
  while [ "$i" -lt 60 ] && ! in_config "$first_boot"; do i=$((i+1)); sleep 1; done
  in_config "$first_boot" || {
    c29=1; echo "  run $n: a first-boot file of the server is missing: $(in_config 'ls -A /v /v/scopes' | tr '\n' ' ')" >> "$WORK/log29"
  }
  [ "$(docker inspect -f '{{.State.Running}}' "$(dc ps -q dns-server)")" = "true" ] || c29=1
  dc down -v >/dev/null 2>&1
done

echo "step: a folder holding the marker and a dns.config: c29=$c29" >> "$WORK/log29"
mkdir -p "$WORK/confmark"
printf 'technitium-console\n' > "$WORK/confmark/.technitium-console"
printf '{}\n' > "$WORK/confmark/dns.config"
compose_file "$WORK/confmark"
dc up -d >>"$WORK/out" 2>&1 || c29=1
[ "$(init_exit)" = "1" ] || c29=1
dc logs technitium-console 2>&1 | grep -q "DNS server's configuration" || c29=1
[ "$(cat "$WORK/confmark/dns.config")" = '{}' ] || c29=1
[ ! -e "$WORK/confmark/$ASSET" ] || c29=1
dc down -v >/dev/null 2>&1
echo "step: done: c29=$c29" >> "$WORK/log29"
cat "$WORK/log29" >> "$WORK/out"
verdict "C29" $c29 "an init that fails never keeps the DNS server from starting"

# ------------------------------- C30 · the Docker host gets a way in and a way out
c30=0
echo "step: a server with nothing set up, started with docker run" > "$WORK/log30"
start_server
host > "$WORK/out" 2>&1 || c30=1
section "$NAME" | grep -q 'ghcr.io/bygarcia/technitium-console' || c30=1
section "$NAME" | grep -q -- '-e DNS_SERVER_WEB_SERVICE_WWW_FOLDER_PATH=/opt/technitium-console' || c30=1
! grep -q 'sudo sh --dir' "$WORK/out" || c30=1
! section "$NAME" | grep -q '/opt/technitium/dns/www:ro' || c30=1
host --uninstall > "$WORK/out" 2>&1 || c30=1
section "$NAME" | grep -q 'Nothing to remove' || c30=1
stop_server
echo "step: the README's compose layout, set up: c30=$c30" >> "$WORK/log30"
build_init
compose_file technitium-console
dc up -d >/dev/null 2>&1; init_exit >/dev/null
dns="$(docker inspect -f '{{.Name}}' "$(dc ps -q dns-server)" | sed 's|^/||')"
host > "$WORK/out" 2>&1 || c30=1
section "$dns" | grep -q 'already set up' || c30=1
dcp="docker compose -p $PROJECT -f $WORK/compose.yaml"   # the project, named: runnable from anywhere
section "$dns" | grep -qF "$dcp pull technitium-console && $dcp up -d technitium-console" || c30=1
upd="$(section "$dns" | sed -n 's/.*&& \(docker compose .* up -d technitium-console\)$/\1/p')"
before="$(started_at)"
(cd / && sh -c "$upd") >/dev/null 2>&1 || c30=1        # run as printed, from another folder
[ "$(init_exit)" = "0" ] || c30=1
[ "$(started_at)" = "$before" ] || c30=1
host --uninstall > "$WORK/out" 2>&1 || c30=1
section "$dns" | grep -qF "$dcp up -d --remove-orphans" || c30=1
section "$dns" | grep -q "docker volume rm ${PROJECT}_technitium-console" || c30=1
dc down -v >/dev/null 2>&1
echo "step: a host folder over www, installed with --dir (the README before this): c30=$c30" >> "$WORK/log30"
mkdir -p "$WORK/legacy"
start_server -v "$WORK/legacy:$WWW:ro"
# A second server on the same folder, read-write: its own line, and one removal.
docker rm -f "$NAME-rw" >/dev/null 2>&1
docker run -d --name "$NAME-rw" -v "$WORK/legacy:$WWW" "$IMAGE" >/dev/null 2>&1 || c30=1
docker run --rm -v /var/run/docker.sock:/var/run/docker.sock -v "$WORK/legacy:$WORK/legacy" \
  -v "$WORK/console.tar.gz:/console.tar.gz:ro" -v "$INSTALLER:/install.sh:ro" docker:cli \
  sh -c "sh /install.sh --dir $WORK/legacy --from /console.tar.gz --yes && sh /install.sh --uninstall --dir $WORK/legacy" \
  > "$WORK/out" 2>&1 || c30=1
section "$NAME" | grep -q "$WORK/legacy:$WWW:ro" || c30=1      # the mount to take out, named
section "$NAME-rw" | grep -qF -- "-v $WORK/legacy:$WWW (" || c30=1   # as it is mounted, read-write
! section "$NAME-rw" | grep -q "$WWW:ro" || c30=1
[ "$(grep -c "sudo rm -rf $WORK/legacy" "$WORK/out")" = "1" ] || c30=1   # removed once, after both
[ -f "$WORK/legacy/$ASSET" ] || c30=1                             # and the folder left whole until then
docker rm -f "$NAME-rw" >/dev/null 2>&1
stop_server
echo "step: a bind of /, a source with a |, a folder that is not the console: c30=$c30" >> "$WORK/log30"
mkdir -p "$WORK/odd|dir" "$WORK/other"
printf 'keep\n' > "$WORK/other/notes.txt"
# Stand-ins, not servers: a command that names DnsServerApp.dll is what makes a
# container a Technitium one to the installer, and a sleep cannot crash. Nothing
# serves this machine's / over a web port.
stand_in() { # name, docker run arguments
  sn="$1"; shift
  docker run -d --name "$sn" "$@" busybox:stable sh -c 'exec sleep 600' /opt/technitium/dns/DnsServerApp.dll >/dev/null 2>&1
}
stand_in "$NAME-root" -v "/:$WWW:ro" || c30=1
stand_in "$NAME-pipe" -v "$WORK/odd|dir:$WWW:ro" || c30=1
stand_in "$NAME-other" -v "$WORK/other:$WWW:ro" || c30=1
stand_in "$NAME-vol" -v "$NAME-www:$WWW" || c30=1        # a named volume over www
# The folders where the script can see them, as on the host itself.
docker run --rm -i -v /var/run/docker.sock:/var/run/docker.sock -v "$WORK:$WORK" docker:cli \
  sh -s -- --uninstall < "$INSTALLER" > "$WORK/out" 2>&1 || c30=1
for c in root pipe other; do
  section "$NAME-$c" > "$WORK/sec"
  ! grep -q 'rm -rf' "$WORK/sec" || c30=1                 # nothing to paste that could remove the wrong thing
  grep -q 'remove it yourself' "$WORK/sec" || c30=1
done
section "$NAME-pipe" | grep -qF "$WORK/odd|dir" || c30=1  # named whole, not cut at the |
section "$NAME-root" | grep -q 'the folder mounted there' || c30=1
! section "$NAME-root" | grep -q '//json' || c30=1
section "$NAME-vol" | grep -qF "docker volume rm $NAME-www" || c30=1   # a volume is removed as one
! section "$NAME-vol" | grep -q 'rm -rf' || c30=1
host > "$WORK/out" 2>&1 || c30=1
section "$NAME-root" | grep -q 'cannot be named safely' || c30=1   # said, not merely left out:
! section "$NAME-root" | grep -q -- '--dir' || c30=1      # no update aimed at /
docker rm -f "$NAME-root" "$NAME-pipe" "$NAME-other" "$NAME-vol" >/dev/null 2>&1
docker volume rm "$NAME-www" >/dev/null 2>&1
echo "step: done: c30=$c30" >> "$WORK/log30"
cat "$WORK/log30" >> "$WORK/out"
verdict "C30" $c30 "on a Docker host it prints the steps in and out, with real names and no \$0"

fi

printf '\n  %d met · %d not met · %d not applicable to this image\n\n' "$PASS" "$FAIL" "$SKIP"
exit "$FAIL"
