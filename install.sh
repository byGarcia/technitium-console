#!/bin/sh
#
# technitium-console installer.
#
# Installs an alternative administration console for Technitium DNS Server, and
# can put the original back.
#
#   curl -sSL https://raw.githubusercontent.com/byGarcia/technitium-console/main/install.sh | sudo sh
#
# What it has to guarantee is written down in docs/2026-09-07-installer-contract.md
# and measured by dev/installer-probe.sh. Two of those clauses shape everything
# below:
#
#   · At every moment there is a complete console being served — the previous one
#     before the publication point, the new one after it. So files are never
#     removed before their replacements are in place, and every page is published
#     after the assets it names.
#   · The server's own data is never modified. Three places are written: the web
#     root, the backup, and this installer's state. Reading is another matter:
#     /proc, the logs and the unit files are read on purpose, because the way not
#     to guess where the console lives is to go and look.
#
# And one that came out of the 2026-09-30 audit: publishing sweeps, as root,
# whatever the release does not ship. So nothing is ever swept, or removed on
# the way out, that the installer cannot show is a console: an empty folder, the
# stock console, this one, or the folder its own state says it installed into.
#
# It is POSIX sh: the official image is Debian, but people run this on Alpine too.

set -eu

REPO="byGarcia/technitium-console"
STATE_DIR="/var/lib/technitium-console"
STATE="$STATE_DIR/install.state"
BACKUP_SUFFIX=".original"
VAR_NAME="DNS_SERVER_WEB_SERVICE_WWW_FOLDER_PATH"
DOCKER_DOCS="https://github.com/$REPO#docker"
IMAGE_REF="ghcr.io/bygarcia/technitium-console"
# What the administrator typed, never $0: under `curl … | sudo sh` that is "sh".
ONE_LINER="curl -sSL https://raw.githubusercontent.com/$REPO/main/install.sh | sudo sh -s --"
CONSOLE_DIR="/opt/technitium-console"
# The init's record, at the root of its volume, that the volume is the console's
# (contract, «Docker»). Its own state lives in its container's layer and goes
# with it; this does not.
MARKER=".technitium-console"

VERSION="latest"
SOURCE=""                    # local file or URL, for air-gapped installs
WWW_DIR=""
DIR_GIVEN="no"
WEB_URL=""
ACTION="install"
ASSUME_YES="no"
ALLOW_MISMATCH="no"
INTO_VOLUME=""               # what the Docker image runs: see --into-volume

say()  { printf '  %s\n' "$*"; }
ok()   { printf '  \033[32m✓\033[0m %-34s %s\n' "$1" "${2:-}"; }
warn() { printf '  \033[33m!\033[0m %s\n' "$*"; }
die()  { printf '\n  \033[31m✗\033[0m %s\n\n' "$*" >&2; exit 1; }

usage() {
  cat <<EOF

  technitium-console installer

    --uninstall        put the original console back
    --version <tag>    install a specific release (default: latest)
    --from <path|url>  install from a tarball you already have
    --dir <path>       web root to install into (default: ask the running server)
    --url <base>       where its web console answers (default: http://127.0.0.1:5380)
    --yes              do not ask for confirmation
    --into-volume <path>
                       copy the console into the volume mounted at <path> and
                       stop. It is what the Docker image runs; needs --from.
    --restore-mismatched-backup
                       uninstall even though the backup is from another server
                       version. --yes does not grant this one.
    --help             this text

EOF
  exit 0
}

while [ $# -gt 0 ]; do
  case "$1" in
    --uninstall) ACTION="uninstall" ;;
    --version)   VERSION="${2:?--version needs a tag}"; shift ;;
    --from)      SOURCE="${2:?--from needs a path or URL}"; shift ;;
    --dir)       WWW_DIR="${2:?--dir needs a path}"; DIR_GIVEN="yes"; shift ;;
    --url)       WEB_URL="${2:?--url needs a base URL}"; shift ;;
    --yes|-y)    ASSUME_YES="yes" ;;
    --restore-mismatched-backup) ALLOW_MISMATCH="yes" ;;
    --into-volume) INTO_VOLUME="${2:?--into-volume needs a path}"; shift ;;
    --help|-h)   usage ;;
    *)           die "unknown option: $1  (try --help)" ;;
  esac
  shift
done

if [ "$(id -u)" != "0" ]; then
  if [ -n "$INTO_VOLUME" ]; then
    die "the init has to run as root to write the console into its volume. Take user: off
    the technitium-console service (or run it with --user 0): $DOCKER_DOCS"
  fi
  die "this has to run as root: prefix it with sudo."
fi

printf '\n  \033[1mtechnitium-console\033[0m\n\n'

# ------------------------------------------------------------ links and folders
#
# Everything below writes as root. A symbolic link anywhere on the way turns
# "the web root" into wherever the link points, and a web root is often owned by
# the account the server runs as, not by root. So a path the installer found by
# itself is refused if it goes through a link, and a path given with --dir is
# resolved once, here, and used resolved from then on: the one the administrator
# typed is not the one written to, the one it leads to is.
resolve_path() { # absolute, every link resolved, even where its tail does not exist yet
  rp="$(printf '%s' "$1" | sed 's|/*$||')"
  case "$rp" in /*) ;; '') rp="/" ;; *) rp="$(pwd -P)/$rp" ;; esac
  rp_tail=""
  while [ ! -d "$rp" ]; do
    [ ! -L "$rp" ] || die "--dir $1 goes through a link to nothing ($rp)."
    rp_tail="/${rp##*/}$rp_tail"; rp="${rp%/*}"; [ -n "$rp" ] || rp="/"
  done
  case "$rp_tail" in
    */..|*/../*) die "--dir $1 climbs out of a folder that does not exist yet. Give it without '..'." ;;
  esac
  rp="$(cd "$rp" && pwd -P)"
  printf '%s%s' "${rp%/}" "$rp_tail"
}
# --into-volume is the Docker image's mode (README, «Docker»): a volume shared
# with the DNS server's container, the release tarball the image carries, and
# nothing to look for — the server may not even be up yet, and it must not have
# to be (contract D1). The version is the image's tag and the way out is taking
# the volume away, so the options that mean something else are refused here.
if [ -n "$INTO_VOLUME" ]; then
  [ "$ACTION" = "install" ] || die "--into-volume only installs. On Docker the console is removed by taking
    its volume out of the DNS server: $DOCKER_DOCS"
  [ "$DIR_GIVEN" = "no" ] || die "--into-volume and --dir both say where. Give one."
  if [ "$VERSION" != "latest" ] || [ -n "$WEB_URL" ]; then
    die "--version and --url do not apply to --into-volume: the version is the image's
    tag, ghcr.io/bygarcia/technitium-console:<version>."
  fi
  if [ -z "$SOURCE" ] || [ ! -f "$SOURCE" ]; then
    die "--into-volume installs the tarball the image carries: give it with --from <file>."
  fi
  WWW_DIR="$INTO_VOLUME"; DIR_GIVEN="yes"
fi

if [ "$DIR_GIVEN" = "yes" ]; then
  DIR_ASKED="--dir $WWW_DIR"
  [ -z "$INTO_VOLUME" ] || DIR_ASKED="--into-volume $INTO_VOLUME"
  WWW_DIR="$(resolve_path "$WWW_DIR")" || exit 1
  # resolve_path writes the root folder as nothing, and no folder at all would
  # mean "ask the server": the run would install somewhere it was not told to.
  [ -n "$WWW_DIR" ] || die "$DIR_ASKED is the root folder. Installing removes whatever the console does
    not ship, so it goes into a folder of its own. Nothing was changed."
fi

# A folder is a mount point when this process's mount table lists it as one.
# The table writes a space, a tab, a newline and a backslash in a path as \040,
# \011, \012 and \134; the folder is passed through the environment, because
# awk -v would read its backslashes as escapes.
is_mount_point() { # folder
  IMP_DIR="$1" awk '
    function plain(s,   r, i) {
      gsub(/\\040/, " ", s); gsub(/\\011/, "\t", s); gsub(/\\012/, "\n", s)
      # The backslash last, and not by gsub: awks disagree about "\\" there.
      r = ""
      while ((i = index(s, "\\134")) > 0) { r = r substr(s, 1, i - 1) "\\"; s = substr(s, i + 4) }
      return r s
    }
    plain($5) == ENVIRON["IMP_DIR"] { found = 1 } END { exit !found }' /proc/self/mountinfo 2>/dev/null
}

if [ -n "$INTO_VOLUME" ] && ! is_mount_point "$WWW_DIR"; then
  die "$WWW_DIR is not a mounted volume, so whatever is copied there goes with this
    container. Mount the console's volume at $WWW_DIR: $DOCKER_DOCS"
fi

refuse_links() { # folder about to be written into
  rl_walked=""
  rl_ifs="$IFS"; IFS=/; set -f
  # shellcheck disable=SC2086
  set -- "$1" ${1#/}
  IFS="$rl_ifs"; set +f
  rl_dir="$1"; shift
  for rl_part in "$@"; do
    [ -n "$rl_part" ] || continue
    rl_walked="$rl_walked/$rl_part"
    [ ! -L "$rl_walked" ] || die "$rl_walked is a symbolic link. Not writing through it: point at the real folder with --dir."
  done
  [ ! -L "$rl_dir$BACKUP_SUFFIX" ] || die "$rl_dir$BACKUP_SUFFIX is a symbolic link. Not writing through it."
  [ -d "$rl_dir" ] || return 0
  rl_inside="$(find "$rl_dir" -type l -exec test -d {} \; -print 2>/dev/null | head -1)"
  [ -z "$rl_inside" ] || die "$rl_inside is a link to a folder, inside the web root. Not writing through it."
}

# What a console looks like, from the files alone. The stock one has carried the
# same title, js/main.js and json/readme.txt since v11 (DnsServerCore/www); this
# one is an index.html that mounts #root and names a hashed script under
# assets/ that is there. A hybrid left by a server update reads as the stock one.
is_stock_console() {
  [ -f "$1/index.html" ] && [ -f "$1/js/main.js" ] && [ -f "$1/json/readme.txt" ] \
    && grep -q '<title>Technitium DNS Server</title>' "$1/index.html"
}
is_this_console() {
  [ -f "$1/index.html" ] && grep -q '<div id="root"></div>' "$1/index.html" || return 1
  entry="$(sed -n 's|.*src="\./\(assets/[^"]*\.js\)".*|\1|p' "$1/index.html" | head -1)"
  [ -n "$entry" ] && [ -f "$1/$entry" ]
}

# A folder holding nothing but the administrator's lists is as good as empty:
# publishing neither overwrites nor sweeps json/*-custom.json (copy_one,
# publish), so there is nothing in it to lose. It is how a host folder for the
# Docker image is prepared, with lists written by hand before the first run.
only_custom_lists() { # folder
  [ -z "$(find "$1" -mindepth 1 ! -path "$1/json" ! -path "$1/json/*-custom.json" -print 2>/dev/null | head -1)" ]
}

# The server's configuration folder (/etc/dns in the image) is never a console,
# whatever else is in it: a mount swapped by mistake, or a marker beside it,
# must not make it one. These are the files the server keeps there
# (DnsServer.cs, DnsWebService.cs: dns.config, auth.config, webservice.config,
# zones/*.zone). A bare zones/ is not one of them: this console ships a zones/.
server_config_in() { # folder — prints what gives it away, or fails
  for sc_f in dns.config auth.config webservice.config; do
    if [ -e "$1/$sc_f" ]; then printf '%s' "$sc_f"; return 0; fi
  done
  for sc_f in "$1"/zones/*.zone; do
    if [ -e "$sc_f" ]; then printf 'zones/%s' "${sc_f##*/}"; return 0; fi
  done
  return 1
}

# Publishing replaces what the release ships and sweeps everything else. That is
# right for a console and a disaster for anything else — --dir /opt/technitium/dns
# by mistake is the server's binaries and configuration gone, with no backup,
# because there was no index.html to back up. So the folder must be one of these,
# and otherwise nothing is changed at all.
may_write_into() { # folder
  [ -e "$1" ] || return 0
  [ -d "$1" ] || die "$1 is not a folder."
  if hc_found="$(server_config_in "$1")"; then
    if [ -n "$INTO_VOLUME" ]; then
      die "$1 holds a DNS server's configuration ($hc_found), not a console.
    Installing removes whatever the console does not ship. Mount the console's own
    volume at $1, not the server's /etc/dns one: $DOCKER_DOCS
    Nothing was changed."
    fi
    die "$1 holds a DNS server's configuration ($hc_found), not a console.
    Installing removes whatever the console does not ship. Nothing was changed."
  fi
  [ -n "$(ls -A "$1" 2>/dev/null)" ] || return 0
  only_custom_lists "$1" && return 0
  # The init's volume, marked as its own before its first copy: a copy stopped
  # halfway is no console yet, and the next run has to be able to finish it.
  if [ -n "$INTO_VOLUME" ] && [ -f "$1/$MARKER" ] && [ ! -L "$1/$MARKER" ]; then return 0; fi
  [ "$(state_get webroot)" = "$1" ] && return 0
  is_stock_console "$1" && return 0
  is_this_console "$1" && return 0
  die "$1 is not empty and it is not a Technitium console.
    Installing removes whatever the console does not ship, so it only goes into
    an empty folder, the server's web root, or a folder it is already in.
    Nothing was changed."
}

# ----------------------------------------------------------------------- state
#
# Outside the web root, always. Bookkeeping left in the served folder is either
# invisible to us (the web service does not serve dotfiles) or visible to anyone
# who can reach the login page.
state_get() { [ -f "$STATE" ] && sed -n "s/^$1=//p" "$STATE" | tail -1 || true; }
state_set() {
  mkdir -p "$STATE_DIR"
  tmp="$STATE.tmp"
  { [ -f "$STATE" ] && grep -v "^$1=" "$STATE" || true; } > "$tmp"
  printf '%s=%s\n' "$1" "$2" >> "$tmp"
  mv -f "$tmp" "$STATE"
}
state_clear() { rm -f "$STATE"; }

# ------------------------------------------------------- asking the real server
#
# No `ps`: /proc is there on every system this runs on, and busybox and procps
# disagree about everything else.
find_systemd_unit_file() {
  # Upstream's installer writes dns.service; the Proxmox community script writes
  # technitium.service. Match on what the unit runs, not on what it is called.
  for unit in /etc/systemd/system/*.service /lib/systemd/system/*.service; do
    [ -f "$unit" ] || continue
    if grep -q 'DnsServerApp\.dll' "$unit" 2>/dev/null; then printf '%s\n' "$unit"; return 0; fi
  done
  return 1
}
find_systemd_unit() { unit="$(find_systemd_unit_file)" && basename "$unit"; }

# Root runs it in Docker and under the community script. Upstream's installer
# has run it as dns-server since v15.0, and hands it the application folder
# (DnsServerApp/install.sh: serviceUser, chown -R; User= in systemd.service,
# command_user in openrc.service). A unit that says otherwise is believed too.
service_uids() {
  printf '0\n'
  id -u dns-server 2>/dev/null || true
  if unit="$(find_systemd_unit_file)"; then
    user="$(sed -n 's/^User=//p' "$unit" | tail -1)"
    if [ -n "$user" ]; then id -u "$user" 2>/dev/null || true; fi
  fi
}

# A command line is something anybody can write, so matching one is how a
# candidate is found, not how it is believed. A candidate is believed when
# nobody but root or the service's own account could have started it: every uid
# the process runs as, its DnsServerApp.dll, the folder that holds it and that
# folder's www all belong to one of them. Anything else is named and ignored.
untrusted_uid() { # pid, trusted uids — prints why not
  # /proc/<pid> itself is owned by root for any process that made itself
  # non-dumpable, so the uids are read from status, all four of them.
  ut_uids="$(sed -n 's/^Uid:[[:space:]]*//p' "/proc/$1/status" 2>/dev/null)"
  [ -n "$ut_uids" ] || { echo "whose it is cannot be read"; return 0; }
  for ut_u in $ut_uids; do
    printf '%s\n' "$2" | grep -qx "$ut_u" || { echo "it runs as uid $ut_u"; return 0; }
  done
  return 0
}
untrusted_files() { # the DnsServerApp.dll it names, trusted uids — prints why not
  case "$1" in /*) ;; *) echo "it names DnsServerApp.dll by a relative path"; return 0 ;; esac
  [ -f "$1" ] || { echo "$1 is not there"; return 0; }
  for ut_f in "$1" "${1%/DnsServerApp.dll}" "${1%/DnsServerApp.dll}/www"; do
    [ -e "$ut_f" ] || [ -L "$ut_f" ] || continue
    ut_u="$(stat -c %u "$ut_f")"
    printf '%s\n' "$2" | grep -qx "$ut_u" || { echo "$ut_f belongs to uid $ut_u"; return 0; }
  done
  return 0
}

# Sets SERVER_PID and SERVER_APP, or leaves them empty. SERVERS_FOUND says how
# many different servers were believed: two that disagree about the web root
# are not settled by picking one, and resolve_target stops on it.
SERVER_PID=""; SERVER_APP=""; SERVERS_FOUND=0; SERVERS=""
find_server() {
  fs_trusted="$(service_uids)"
  fs_here="$(stat -L -c %d:%i / 2>/dev/null || true)"
  SERVERS=""
  for d in /proc/[0-9]*; do
    [ -r "$d/cmdline" ] || continue
    fs_dll="$(tr '\0' '\n' < "$d/cmdline" 2>/dev/null | grep 'DnsServerApp\.dll$' | head -1 || true)"
    [ -n "$fs_dll" ] || continue
    fs_pid="${d#/proc/}"
    fs_why="$(untrusted_uid "$fs_pid" "$fs_trusted")"
    if [ -z "$fs_why" ]; then
      # Another root filesystem is a container seen from its host: its paths
      # are not paths on this machine, and it is not a candidate at all.
      fs_root="$(stat -L -c %d:%i "$d/root" 2>/dev/null || true)"
      [ -z "$fs_root" ] || [ "$fs_root" = "$fs_here" ] || continue
      [ -n "$fs_root" ] || fs_why="its root folder cannot be read"
    fi
    [ -n "$fs_why" ] || fs_why="$(untrusted_files "$fs_dll" "$fs_trusted")"
    if [ -n "$fs_why" ]; then
      warn "Not trusting process $fs_pid ($fs_dll): $fs_why."
      continue
    fi
    SERVERS="$SERVERS$fs_pid	${fs_dll%/DnsServerApp.dll}	$(server_env "$fs_pid" "$VAR_NAME")
"
  done
  [ -n "$SERVERS" ] || return 0
  SERVERS_FOUND="$(printf '%s' "$SERVERS" | cut -f2- | sort -u | wc -l | tr -d ' ')"
  if [ "$SERVERS_FOUND" = "1" ]; then
    SERVER_PID="$(printf '%s' "$SERVERS" | head -1 | cut -f1)"
    SERVER_APP="$(printf '%s' "$SERVERS" | head -1 | cut -f2)"
  fi
}
server_env() {
  tr '\0' '\n' < "/proc/$1/environ" 2>/dev/null | sed -n "s/^$2=//p" | head -1 || true
}
LOG_GLOBS="/var/log/technitium/dns /etc/dns/logs /opt/technitium/dns/logs"
server_logs() {
  for d in $LOG_GLOBS; do
    [ -d "$d" ] || continue
    ls -1t "$d"/*.log 2>/dev/null | head -3
  done
}
server_version() {
  # The version is printed at startup and nowhere an unauthenticated caller can
  # reach: api/user/checkForUpdate needs a session, and the console carries no
  # version string.
  logs="$(server_logs)"
  [ -n "$logs" ] || return 0
  # shellcheck disable=SC2086
  grep -ho 'DNS Server (v[0-9.]*)' $logs 2>/dev/null | tail -1 | tr -d '()' | sed 's/DNS Server //' || true
}
logged_variable_fallback() {
  logs="$(server_logs)"
  [ -n "$logs" ] || return 1
  # shellcheck disable=SC2086
  grep -q "$VAR_NAME environment variable does not exist" $logs 2>/dev/null
}

web_base() { [ -n "$WEB_URL" ] && printf '%s' "${WEB_URL%/}" || printf 'http://127.0.0.1:5380'; }
web_answers() { command -v curl >/dev/null 2>&1 && curl -s -o /dev/null --max-time 5 "$(web_base)/"; }
web_serves() { curl -sf -o /dev/null --max-time 5 "$(web_base)/$1"; }

random_name() {
  { od -An -N8 -tx1 /dev/urandom 2>/dev/null || printf '%s %s' "$$" "$(date +%s)"; } | tr -d ' \n'
}

# Does the running server serve the folder the variable names? Asked before
# anything is installed, and answered by the server rather than by a version
# number: a probe file goes in, the web service is asked for it, and it comes
# straight back out.
serves_folder() {
  folder="$1"
  created="no"
  [ -d "$folder" ] || { mkdir -p "$folder"; created="yes"; }
  probe="technitium-console-probe-$(random_name).txt"
  printf 'probe\n' > "$folder/$probe"
  answer=1
  web_serves "$probe" && answer=0
  rm -f "$folder/$probe"
  if [ "$created" = "yes" ] && [ "$answer" != "0" ]; then rmdir "$folder" 2>/dev/null || true; fi
  return "$answer"
}

# --------------------------------------------------- Docker, seen from the host
#
# On a host whose server runs in a container there is nothing here to install
# into: a container's own files are replaced every time it is recreated, and
# its environment and compose file are not this script's to edit (contract §4).
# So it reads what is there — `docker inspect`, and the startup log through
# `docker exec`, both read-only (F4) — and prints the exact change, for the way
# in and for the way out. Printing it is what this path is for: it exits 0.
docker_servers() {
  docker ps --no-trunc --format '{{.Names}}|{{.Command}}' 2>/dev/null \
    | awk -F'|' '$2 ~ /DnsServerApp\.dll/ { print $1 }'
}
dk() { docker inspect -f "$2" "$1" 2>/dev/null || true; }
dk_label() { dk "$1" "{{index .Config.Labels \"$2\"}}"; }
dk_env() { dk "$1" '{{range .Config.Env}}{{println .}}{{end}}' | sed -n "s/^$2=//p" | head -1; }
# The source goes last and is everything after the fifth |, because a folder
# can have a | in its name. One with a newline or another control character
# would split the line, so docker says first whether %q leaves it as it is:
# "plain" when it does, and only a plain source is ever put in a command.
dk_mount() { # container, destination — "type|rw or ro|plain or odd|volume name|source"
  dk "$1" '{{range .Mounts}}{{.Destination}}|{{.Type}}|{{.RW}}|{{if eq (printf "%q" .Source) (printf "\"%s\"" .Source)}}plain{{else}}odd{{end}}|{{.Name}}|{{.Source}}{{println}}{{end}}' \
    | DM_DEST="$2" awk -F'|' '$1 == ENVIRON["DM_DEST"] {
        s = $0; for (i = 0; i < 5; i++) s = substr(s, index(s, "|") + 1)
        print $2 "|" ($3 == "true" ? "rw" : "ro") "|" $4 "|" $5 "|" s; exit
      }'
}
# Sets DM_TYPE, DM_RO (":ro", or nothing when it is mounted read-write), DM_PLAIN,
# DM_WHERE (the volume's name, or the folder on the host) and DM_SOURCE.
dk_mount_read() {
  IFS='|' read -r DM_TYPE dm_rw DM_PLAIN dm_name DM_SOURCE <<EOF
$1
EOF
  DM_RO=":ro"
  if [ "$dm_rw" = "rw" ]; then DM_RO=""; fi
  DM_WHERE="$DM_SOURCE"
  if [ "$DM_TYPE" = "volume" ]; then DM_WHERE="$dm_name"; fi
}
# A host folder a command may be printed for: read whole, absolute, not / and
# with nothing in it that a terminal or a shell would read differently.
nameable() { # folder
  [ "$DM_PLAIN" = "plain" ] || return 1
  case "$1" in
    ''|/|[!/]*|*[[:cntrl:]]*|*/.|*/./*|*/..|*/../*|*//*) return 1 ;;
  esac
  return 0
}
# The command that removes a host folder. It is printed only for a folder this
# script can see and that is_this_console recognises — an index.html that mounts
# #root and names an entry script that is there, the same test W6 trusts before
# publishing sweeps a folder. That does not show nothing else is in it, which is
# why the lists are named first. Anything else gets no command, and ds_remove
# says to look at it.
folder_removal() { # folder
  nameable "$1" || return 0
  [ -d "$1" ] && is_this_console "$1" || return 0
  printf 'sudo rm -rf %s' "$(shq "$1")"
}
dk_has_source() {
  dk "$1" '{{range .Mounts}}{{.Source}}{{println}}{{end}}' | grep -qxF "$2"
}
dk_version() {
  docker exec "$1" sh -c 'grep -ho "DNS Server (v[0-9.]*)" /var/log/technitium/dns/*.log 2>/dev/null | tail -1' 2>/dev/null \
    | sed -n 's/.*(v\([0-9.]*\)).*/\1/p'
}
before_15_5() {
  [ -n "$1" ] || return 1
  bv_major="${1%%.*}"; bv_rest="${1#*.}"; bv_minor="${bv_rest%%.*}"
  [ "$bv_major" -lt 15 ] || { [ "$bv_major" -eq 15 ] && [ "$bv_minor" -lt 5 ]; }
}
dk_init_service() {
  docker ps -a --filter "label=com.docker.compose.project=$1" \
    --format '{{.Image}}|{{.Label "com.docker.compose.service"}}' 2>/dev/null \
    | awk -F'|' '$1 ~ /technitium-console/ { print $2; exit }'
}
shq() { # a word as a shell reads it back, quoted only when it has to be
  case "$1" in
    ''|*[!A-Za-z0-9_./:@%+=,-]*) printf "'%s'" "$(printf '%s' "$1" | sed "s/'/'\\\\''/g")" ;;
    *) printf '%s' "$1" ;;
  esac
}
# The `docker compose` that reaches a container's project from any folder: its
# name, its files and, when it is not theirs, its folder, all from the labels
# Compose put on the container.
dk_compose() { # container
  dc_cmd="docker compose -p $(shq "$(dk_label "$1" com.docker.compose.project)")"
  dc_files="$(dk_label "$1" com.docker.compose.project.config_files)"
  dc_dir="$(dk_label "$1" com.docker.compose.project.working_dir)"
  dc_first=""
  dc_ifs="$IFS"; IFS=','; set -f
  for dc_f in $dc_files; do
    if [ -z "$dc_first" ]; then dc_first="$dc_f"; fi
    dc_cmd="$dc_cmd -f $(shq "$dc_f")"
  done
  IFS="$dc_ifs"; set +f
  if [ -n "$dc_dir" ] && [ "$dc_dir" != "${dc_first%/*}" ]; then
    dc_cmd="$dc_cmd --project-directory $(shq "$dc_dir")"
  fi
  printf '%s' "$dc_cmd"
}
# A volume or a folder goes once, after every container that mounts it has let
# go of it — so when two of them share one, the command is given in the steps of
# the last, and the others say where it is. Returns 1 when it is not given here.
ds_remove() { # container, source of its mount, the command or nothing, the words before it, [this installer's state]
  dr_how="$3"
  if [ -z "$dr_how" ]; then
    dr_what="the folder mounted there"
    if nameable "$DM_WHERE"; then dr_what="$(shq "$DM_WHERE")"; fi
    dr_how="look at what $dr_what holds and remove it yourself: this script cannot vouch that it is only the console."
    if [ -n "${5:-}" ]; then dr_how="$dr_how Its record here goes with it: sudo rm -rf $5"; fi
  fi
  dr_with=""
  for dr_c in $DS_ALL; do
    if dk_has_source "$dr_c" "$2"; then dr_with="$dr_with $dr_c"; fi
  done
  dr_with="${dr_with# }"; dr_last="${dr_with##* }"
  case "$dr_with" in
    *" "*) ;;
    *) say "  - $4$dr_how"; return 0 ;;
  esac
  if [ "$1" = "$dr_last" ]; then
    say "  - Once $(printf '%s' "$dr_with" | sed 's/ /, /g') no longer mount it: $dr_how"
    return 0
  fi
  say "  - Not removed here: other containers mount it too. It goes once, in the steps for $dr_last."
  return 1
}
docker_steps() {
  ds_c="$1"
  ds_project="$(dk_label "$ds_c" com.docker.compose.project)"
  ds_service="$(dk_label "$ds_c" com.docker.compose.service)"
  ds_files="$(dk_label "$ds_c" com.docker.compose.project.config_files)"
  ds_dc=""
  if [ -n "$ds_project" ]; then ds_dc="$(dk_compose "$ds_c")"; fi
  ds_version="$(dk_version "$ds_c")"
  ds_folder="$(dk_env "$ds_c" "$VAR_NAME")"
  ds_console=""
  if [ -n "$ds_folder" ]; then ds_console="$(dk_mount "$ds_c" "$ds_folder")"; fi
  ds_legacy="$(dk_mount "$ds_c" /opt/technitium/dns/www)"
  ds_state=""
  printf '\n  container %s%s%s\n\n' "$ds_c" "${ds_version:+  v$ds_version}" \
    "${ds_service:+  · service \"$ds_service\" in ${ds_files:-its compose file}}"

  if [ -n "$ds_console" ]; then
    dk_mount_read "$ds_console"
    ds_short="$DM_WHERE"
    if [ "$DM_TYPE" = "volume" ] && [ -n "$ds_project" ]; then ds_short="${DM_WHERE#"${ds_project}"_}"; fi
    if [ "$(state_get webroot)" = "$DM_WHERE" ]; then ds_state=" $STATE_DIR"; fi
    if [ "$ACTION" = "uninstall" ]; then
      say "To remove the console (the server goes back to the one its image ships):"
      say ""
      say "  - Keep any json/*-custom.json you edited: they are in $DM_TYPE $(shq "$DM_WHERE")."
      if [ -n "$ds_project" ]; then
        say "  - In ${ds_files:-the compose file}, take these two lines out of \"$ds_service\":"
        say "        - $VAR_NAME=$ds_folder"
        say "        - $ds_short:$ds_folder$DM_RO"
        if [ "$DM_TYPE" = "bind" ]; then say "    (docker reports the path resolved; your file may write it relative to itself)"; fi
        if [ "$DM_TYPE" = "volume" ]; then
          say "    and remove the service that runs $IMAGE_REF, and \"$ds_short:\" under"
          say "    the top-level volumes:."
        else
          say "    and remove the service that runs $IMAGE_REF."
        fi
        say "  - $ds_dc up -d --remove-orphans"
        say "    It restarts \"$ds_service\" once, because its environment changes."
      else
        say "  - Re-create $ds_c without -e $(shq "$VAR_NAME=$ds_folder")"
        say "    and without -v $(shq "$DM_WHERE:$ds_folder$DM_RO"). That is its only restart."
      fi
      if [ "$DM_TYPE" = "volume" ]; then
        ds_remove "$ds_c" "$DM_SOURCE" "docker volume rm $(shq "$DM_WHERE")" "" || true
      else
        ds_rm="$(folder_removal "$DM_WHERE")"
        ds_remove "$ds_c" "$DM_SOURCE" "$ds_rm${ds_rm:+$ds_state}" "" "${ds_state# }" || true
      fi
    else
      say "The console is already set up: $ds_folder is served from $DM_TYPE $DM_WHERE."
      say "To update it, without restarting the DNS server:"
      say ""
      if [ -n "$ds_project" ]; then
        ds_init="$(dk_init_service "$ds_project")"
        say "  $ds_dc pull ${ds_init:-technitium-console} && $ds_dc up -d ${ds_init:-technitium-console}"
      else
        say "  docker pull $IMAGE_REF:latest"
        if [ "$DM_TYPE" = "volume" ] || nameable "$DM_WHERE"; then
          say "  docker run --rm -v $(shq "$DM_WHERE:/target") $IMAGE_REF:latest"
        else
          say "  and the image run with the folder mounted there at /target. It cannot be"
          say "  named safely in a command: look at it first."
        fi
      fi
    fi
  elif [ -n "$ds_legacy" ]; then
    dk_mount_read "$ds_legacy"
    if [ "$DM_TYPE" = "volume" ]; then
      ds_short="$DM_WHERE"
      if [ -n "$ds_project" ]; then ds_short="${DM_WHERE#"${ds_project}"_}"; fi
      say "It serves the docker volume $(shq "$DM_WHERE") mounted over its own web root, the layout used before 15.5."
    else
      ds_short="$DM_WHERE"
      if [ "$(state_get webroot)" = "$DM_WHERE" ]; then ds_state=" $STATE_DIR"; fi
      if nameable "$DM_WHERE"; then
        say "It serves $(shq "$DM_WHERE") mounted over its own web root, the layout used before 15.5."
      else
        say "It serves a host folder that cannot be named safely in a command, mounted over"
        say "its own web root: the layout used before 15.5."
      fi
    fi
    if [ "$ACTION" = "uninstall" ]; then
      say "To remove the console:"
      say ""
      if [ "$DM_TYPE" = "volume" ]; then
        say "  - Keep any json/*-custom.json you edited: they are in that volume, under json/."
      elif nameable "$DM_WHERE"; then
        say "  - Keep any json/*-custom.json you edited, from $(shq "${DM_WHERE%/}/json")."
      else
        say "  - Keep any json/*-custom.json you edited, from the json/ of the folder mounted there."
      fi
      if [ -n "$ds_project" ]; then
        say "  - In ${ds_files:-the compose file}, take this line out of \"$ds_service\":"
        say "        - $ds_short:/opt/technitium/dns/www$DM_RO"
        if [ "$DM_TYPE" = "volume" ]; then
          say "    and \"$ds_short:\" under the top-level volumes:."
        else
          say "    (docker reports the path resolved; your file may write it relative to itself)"
        fi
        say "  - $ds_dc up -d $ds_service"
        say "    Its only restart: it comes back on the console its image ships."
      else
        say "  - Re-create $ds_c without -v $(shq "$DM_WHERE:/opt/technitium/dns/www$DM_RO") (its only restart)."
      fi
      if [ "$DM_TYPE" = "volume" ]; then
        ds_remove "$ds_c" "$DM_SOURCE" "docker volume rm $(shq "$DM_WHERE")" "Then: " || true
      else
        ds_rm="$(folder_removal "$DM_WHERE")"
        if ds_remove "$ds_c" "$DM_SOURCE" "$ds_rm${ds_rm:+$ds_state}" "Then, and not before: " "${ds_state# }"; then
          say "    Emptied while still mounted, it would leave the server nothing to serve."
        fi
      fi
    else
      if [ "$DM_TYPE" = "volume" ]; then
        say "Updating it from this host would mean writing into Docker's own storage,"
        say "which this script does not do."
      elif nameable "$DM_WHERE"; then
        say "To update the console in it:"
        say ""
        say "  $ONE_LINER --dir $(shq "$DM_WHERE")"
      else
        say "That folder cannot be named safely in a command: look at what it holds"
        say "before running the installer on it."
      fi
      if ! before_15_5 "$ds_version"; then
        say ""
        say "On 15.5 or later, the image is simpler and survives server updates: $DOCKER_DOCS"
      elif [ "$DM_TYPE" = "volume" ]; then
        say "Mount a folder of this host there instead, and install into it:"
        say ""
        say "  $ONE_LINER --dir $CONSOLE_DIR"
        say "  - $CONSOLE_DIR:/opt/technitium/dns/www:ro"
      fi
    fi
  elif [ "$ACTION" = "uninstall" ]; then
    say "It serves the console its image ships. Nothing to remove."
  elif before_15_5 "$ds_version"; then
    say "v$ds_version cannot serve a folder of its own: that came with 15.5. Update the"
    say "server and run this again, or install into a folder on this host and mount it"
    say "over the container's web root:"
    say ""
    say "  $ONE_LINER --dir $CONSOLE_DIR"
    say "  - $CONSOLE_DIR:/opt/technitium/dns/www:ro"
  elif [ -n "$ds_project" ]; then
    say "In ${ds_files:-your compose file}, add to \"$ds_service\":"
    say ""
    say "    environment:"
    say "      - $VAR_NAME=$CONSOLE_DIR"
    say "    volumes:"
    say "      - technitium-console:$CONSOLE_DIR:ro"
    say ""
    say "and this service and volume, which copy the console in and stop:"
    say ""
    say "  services:"
    say "    technitium-console:"
    say "      image: $IMAGE_REF:latest"
    say "      volumes:"
    say "        - technitium-console:/target"
    say "      restart: \"no\""
    say "  volumes:"
    say "    technitium-console:"
    say ""
    say "Then: $ds_dc up -d"
    say "It restarts \"$ds_service\" once, because its environment changes. Updates do not."
    if [ -z "$ds_version" ]; then say "It needs Technitium 15.5 or later."; fi
  else
    say "Fill a volume with the console, on this host:"
    say ""
    say "  docker volume create technitium-console"
    say "  docker run --rm -v technitium-console:/target $IMAGE_REF:latest"
    say ""
    say "and re-create $ds_c with these two added to its docker run (its only restart):"
    say ""
    say "  -e $VAR_NAME=$CONSOLE_DIR"
    say "  -v technitium-console:$CONSOLE_DIR:ro"
    if [ -z "$ds_version" ]; then say "It needs Technitium 15.5 or later."; fi
  fi
}
DS_ALL=""            # the containers whose steps are being printed: see ds_remove
docker_guidance() {
  dg_servers="$(docker_servers)"
  [ -n "$dg_servers" ] || return 0
  DS_ALL="$dg_servers"
  say "Technitium runs in Docker here. Nothing is written into a container: it would"
  say "be lost the next time the container is recreated. These are the steps instead."
  say "More: $DOCKER_DOCS"
  for dg_c in $dg_servers; do docker_steps "$dg_c"; done
  printf '\n'
  exit 0
}
docker_guidance_for() {
  command -v docker >/dev/null 2>&1 || return 0
  dgf_found=""
  for dgf_c in $(docker_servers); do
    if dk_has_source "$dgf_c" "$1"; then dgf_found="$dgf_found $dgf_c"; fi
  done
  [ -n "$dgf_found" ] || return 0
  DS_ALL="$dgf_found"
  say "$1 is mounted into a container, so undoing it is a change to that container."
  for dgf_c in $dgf_found; do docker_steps "$dgf_c"; done
  printf '\n'
  exit 0
}

# Inside a container, a folder that is neither a mount point nor under one is
# part of the container's own files, and goes with the next recreate. That is
# what `docker exec <c> sh -c "curl … | sh"` installs into.
in_container_layer() { # folder
  [ -f /.dockerenv ] || [ -f /run/.containerenv ] || return 1
  icl_d="$1"
  while [ -n "$icl_d" ] && [ "$icl_d" != "/" ]; do
    is_mount_point "$icl_d" && return 1
    icl_d="${icl_d%/*}"
  done
  return 0
}

# ---------------------------------------------------------------- where it goes
MODE=""              # replacement | side-by-side
RESTART_NEEDED="no"
SERVER_VERSION=""

resolve_target() {
  if [ -n "$INTO_VOLUME" ]; then
    MODE="side-by-side"            # a folder of its own: nothing to back up, ever
    refuse_links "$WWW_DIR"
    ok "Installing into the volume" "$WWW_DIR"
    return 0
  fi

  SERVER_VERSION="$(server_version)"
  find_server

  if [ -n "$WWW_DIR" ]; then
    MODE="${1:-replacement}"
    refuse_links "$WWW_DIR"
    return 0
  fi

  if [ "$SERVERS_FOUND" -gt 1 ]; then
    printf '\n  \033[31m✗\033[0m more than one Technitium DNS Server is running here:\n\n' >&2
    printf '%s' "$SERVERS" | while IFS='	' read -r p a c; do
      printf '      pid %-8s %s\n' "$p" "${c:-$a/www}" >&2
    done
    printf '\n      Not choosing between them. Say which web root with --dir <path>.\n\n' >&2
    exit 1
  fi

  if [ -n "$SERVER_PID" ]; then
    configured="$(server_env "$SERVER_PID" "$VAR_NAME")"
    app="$SERVER_APP"

    if [ -n "$configured" ]; then
      refuse_links "$configured"          # the probe below already writes into it
      if ! web_answers; then
        warn "$VAR_NAME is set, but the web console does not answer at $(web_base)."
        warn "Not installing where nothing can be checked. Pass --url, or --dir to decide yourself."
      elif serves_folder "$configured"; then
        WWW_DIR="$configured"; MODE="side-by-side"
        ok "Serving from its own folder" "$WWW_DIR"
        return 0
      elif logged_variable_fallback; then
        WWW_DIR="$configured"; MODE="side-by-side"; RESTART_NEEDED="yes"
        ok "Its own folder, not yet in use" "$WWW_DIR"
        say "The server logged that this folder did not exist when it started, so it"
        say "is serving the default one until it is restarted."
        return 0
      else
        warn "$VAR_NAME is set to $configured, but this server does not honour it."
        warn "Installing there would put the console where nobody reads it."
      fi
    fi

    if [ -n "$app" ] && [ -d "$app" ]; then
      WWW_DIR="$app/www"; MODE="replacement"
      refuse_links "$WWW_DIR"
      ok "Technitium DNS Server found" "$WWW_DIR"
      return 0
    fi
  fi

  # Nothing running here. Either the server is in a container, or this is a host
  # preparing a folder to mount into one.
  for d in /opt/technitium/dns/www /etc/dns/www; do
    if [ -d "$d" ]; then
      WWW_DIR="$d"; MODE="replacement"
      refuse_links "$WWW_DIR"
      ok "Technitium DNS Server found" "$WWW_DIR"
      return 0
    fi
  done

  if command -v docker >/dev/null 2>&1; then docker_guidance; fi
  die "no Technitium DNS Server found. Point at its web root with --dir <path>."
}

# ------------------------------------------------------------------- publishing
#
# The order is the whole point, and it is the same one whether the web root can
# be renamed or not — because it cannot, when it is a mount point, and because
# swapping two directories by rename has a moment in between with no web root at
# all, which is exactly what must never happen.
#
#   1 · assets, fonts, images and lists first, each replaced atomically
#   2 · the pages after them, deepest first, the entry page last
#   3 · what the previous console left, and only then
#
# During step 2 every page a request can be handed finds the files it names: the
# new ones are already there and the old ones are not gone yet.
CUSTOM_GLOB='json/*-custom.json'

copy_one() { # src root, dst root, relative path
  case "$3" in
    $CUSTOM_GLOB) if [ -e "$2/$3" ]; then return 0; fi ;;   # the administrator's file wins
  esac
  mkdir -p "$2/$(dirname "$3")"
  # cp writes through a link that is already there, and the web root can belong
  # to the service account: whatever sits at the temporary name goes first.
  rm -f "$2/$3.tc-new"
  cp -f "$1/$3" "$2/$3.tc-new"
  mv -f "$2/$3.tc-new" "$2/$3"
}

# What step 3 may sweep is decided before W6 looks at the folder, and nothing
# is ever added to it: only what was there then. Whatever appears afterwards is
# not this run's to remove — the server writing its first files, if the folder
# turns out to be its own (a volume swapped onto the init's /target, both
# started together). Taken before W6 and not after it, so that anything already
# there was there when W6 judged the folder.
snapshot() { # folder, a folder of its own for the lists
  ( cd "$1" 2>/dev/null && find . -type f -print ) | sed 's|^\./||' > "$2/before"
  ( cd "$1" 2>/dev/null && find . -mindepth 1 -type d -print ) | sed 's|^\./||' | sort -r > "$2/dirs"
}

publish() { # src, dst, the folder snapshot wrote its lists in
  src="$1"; dst="$2"; list="$3/list"
  mkdir -p "$dst"

  ( cd "$src" && find . -type f ! -name index.html -print ) | sed 's|^\./||' > "$list"
  while IFS= read -r f; do [ -n "$f" ] && copy_one "$src" "$dst" "$f"; done < "$list"

  ( cd "$src" && find . -type f -name index.html -print ) | sed 's|^\./||' \
    | awk '{ n = gsub(/\//, "/"); print n " " $0 }' | sort -rn | cut -d' ' -f2- > "$list"
  while IFS= read -r f; do [ -n "$f" ] && copy_one "$src" "$dst" "$f"; done < "$list"

  while IFS= read -r f; do
    [ -n "$f" ] || continue
    case "$f" in $CUSTOM_GLOB) continue ;; esac
    if [ -n "$INTO_VOLUME" ] && [ "$f" = "$MARKER" ]; then continue; fi
    [ -e "$src/$f" ] || rm -f "$dst/$f"
  done < "$3/before"
  # Deepest first (sort -r puts a/b before a), and only folders that were there
  # before and are empty now.
  while IFS= read -r d; do
    if [ -n "$d" ]; then rmdir "$dst/$d" 2>/dev/null || true; fi
  done < "$3/dirs"
}

carry_custom_lists() { # from, to — used when the served folder changes
  [ -d "$1/json" ] || return 0
  for f in "$1"/json/*-custom.json; do
    [ -f "$f" ] || continue
    mkdir -p "$2/json"
    [ -e "$2/json/$(basename "$f")" ] || cp -f "$f" "$2/json/$(basename "$f")"
  done
}

verify_checksum() { # tarball, its .sha256 as sha256sum writes it
  command -v sha256sum >/dev/null 2>&1 || die "sha256sum is needed to check the console, and is not installed."
  vc_expected="$(cut -d' ' -f1 < "$2")"
  vc_actual="$(sha256sum "$1" | cut -d' ' -f1)"
  [ -n "$vc_expected" ] && [ "$vc_expected" = "$vc_actual" ]
}

confirm() { # question
  [ "$ASSUME_YES" = "yes" ] && return 0
  [ -t 0 ] || return 0
  printf '\n  %s [y/N] ' "$1"
  read -r answer
  printf '\n'
  case "$answer" in [yY]*) return 0 ;; *) die "nothing was changed." ;; esac
}

restart_server() {
  if command -v systemctl >/dev/null 2>&1 && unit="$(find_systemd_unit)"; then
    systemctl restart "$unit" && ok "Service restarted" "$unit" || warn "Could not restart $unit. Restart it yourself."
  elif [ -x /sbin/rc-service ] && [ -f /etc/init.d/dns ]; then
    rc-service dns restart >/dev/null && ok "Service restarted" "dns"
  else
    warn "Restart your DNS server so it starts serving the new folder."
  fi
}

# ------------------------------------------------------------------- uninstall
if [ "$ACTION" = "uninstall" ]; then
  resolve_target

  # The folder to undo is the one the install wrote to, which is on record. The
  # one the server points at now can be another: take the variable away and
  # restart, and "now" is the server's own www.
  RECORDED="$(state_get webroot)"
  if [ -n "$RECORDED" ] && [ "$RECORDED" != "$WWW_DIR" ]; then
    warn "The console was installed in $RECORDED; the server now points at $WWW_DIR."
    warn "Undoing it in $RECORDED, the folder on record. $WWW_DIR is left as it is."
    WWW_DIR="$RECORDED"
    refuse_links "$WWW_DIR"
  fi

  BACKUP="$(state_get backup)"
  [ -n "$BACKUP" ] || BACKUP="$WWW_DIR$BACKUP_SUFFIX"
  RECORDED_MODE="$(state_get mode)"
  [ -n "$RECORDED_MODE" ] || RECORDED_MODE="$MODE"

  if [ "$RECORDED_MODE" = "side-by-side" ]; then
    # The whole folder goes, so it has to still be this console. A record is not
    # enough on its own: the folder could have been emptied and reused since.
    is_this_console "$WWW_DIR" || die "$WWW_DIR does not hold this console any more. Not removing it:
    look at what is in it, and remove it yourself if it should go."
    stock="${SERVER_APP:+$SERVER_APP/www}"
    [ -n "$stock" ] && [ -d "$stock" ] || die "cannot find the console the server ships to hand back to."
    [ "$stock" != "$WWW_DIR" ] || die "$WWW_DIR is the server's own web root. Not removing it."
    refuse_links "$stock"
    carry_custom_lists "$WWW_DIR" "$stock"
    # The contents first and the folder after, because the folder may be a
    # mount point — the Docker layout the README describes — and a mount point
    # cannot be removed from inside: `rm -rf` on it empties it and then fails,
    # which used to stop the uninstall halfway.
    find "$WWW_DIR" -mindepth 1 -maxdepth 1 -exec rm -rf {} +
    if rmdir "$WWW_DIR" 2>/dev/null; then
      state_clear
      ok "Console removed" "$WWW_DIR"
      say "Unset $VAR_NAME and the server goes back to its own console."
      confirm "Restart the DNS server now so it stops looking at a folder that is gone?"
      restart_server
    else
      # The folder stays, empty. A restart with the variable still set would
      # serve that empty folder, so no restart is offered: the variable (or the
      # mount) has to go first, and that is the administrator's to change.
      state_clear
      ok "Console removed" "$WWW_DIR (the folder itself stays: it is a mount point)"
      warn "Unset $VAR_NAME, or remove the mount, BEFORE restarting the DNS server:"
      warn "with the variable still set it would serve this empty folder."
    fi
    printf '\n'
    exit 0
  fi

  # Replacement mode: the backup is the authority, not a marker in the web root.
  if [ ! -d "$BACKUP" ]; then
    # Installed with --dir into an empty folder, there never was an original.
    # On a Docker host that folder is mounted into a container, and the way out
    # is a change to the container, which docker_guidance_for prints.
    docker_guidance_for "$WWW_DIR"
    die "the original console is not at $BACKUP: there is nothing to restore."
  fi

  taken="$(state_get server_version)"
  if [ -n "$taken" ] && [ -n "$SERVER_VERSION" ] && [ "$taken" != "$SERVER_VERSION" ]; then
    if [ "$ALLOW_MISMATCH" != "yes" ]; then
      printf '\n  \033[31m✗\033[0m the backup is the console of another server version.\n\n' >&2
      printf '      backed up from: %s\n      running now:    %s\n\n' "$taken" "$SERVER_VERSION" >&2
      printf '      Restoring it would put an old console in front of a newer server. The\n' >&2
      printf '      repair that does not need this installer is to run the DNS server'"'"'s own\n' >&2
      printf '      installer again, which puts back the console your version ships.\n\n' >&2
      printf '      To restore it anyway: --restore-mismatched-backup\n\n' >&2
      exit 1
    fi
    warn "Restoring a $taken console onto a $SERVER_VERSION server, because you asked."
  fi

  PUBLISH_WORK="$(mktemp -d)"
  # A signal ends the run; it does not clean up and carry on (see the install).
  trap 'rm -rf "$PUBLISH_WORK"' EXIT
  trap 'exit 130' INT
  trap 'exit 143' TERM
  snapshot "$WWW_DIR" "$PUBLISH_WORK"
  may_write_into "$WWW_DIR"
  publish "$BACKUP" "$WWW_DIR" "$PUBLISH_WORK"   # custom lists in place are kept: see copy_one
  rm -rf "$BACKUP"
  state_clear
  ok "Original console restored" "$WWW_DIR"
  printf '\n'
  exit 0
fi

# ---------------------------------------------------------------------- install
resolve_target

command -v tar >/dev/null 2>&1 || die "tar is needed and is not installed."

# A run that was interrupted leaves its staging folder behind. Nothing else is
# needed to repair it: publishing is idempotent and the sweep below removes
# whatever the interrupted run had already written.
if [ -d "$STATE_DIR/staging" ]; then
  warn "A previous run did not finish. Picking up from a clean slate."
  rm -rf "$STATE_DIR/staging"
fi

TMP="$STATE_DIR/staging"
mkdir -p "$TMP/dist"
# A signal ends the run, and the exit removes the staging folder. It must not
# remove it and carry on: the sweep compares the web root against that folder,
# and with it gone it would remove the console it has just published. docker
# stop and docker compose down send the init a TERM.
# shellcheck disable=SC2064
trap "rm -rf '$TMP'" EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

snapshot "$WWW_DIR" "$TMP"
may_write_into "$WWW_DIR"

if [ -n "$SOURCE" ] && [ -f "$SOURCE" ]; then
  cp "$SOURCE" "$TMP/console.tar.gz"
  ok "Console read from file" "$SOURCE"
  if [ -n "$INTO_VOLUME" ]; then
    # The image carries the release's checksum next to its tarball (contract
    # D4). CI checked it before building; it is checked again where it counts.
    [ -f "$SOURCE.sha256" ] || die "there is no checksum next to $SOURCE. Not installing what cannot be checked."
    verify_checksum "$TMP/console.tar.gz" "$SOURCE.sha256" \
      || die "$SOURCE does not match the release's checksum. Nothing was changed."
    ok "Checksum matches the release" "sha256"
  else
    warn "It is not verified: a tarball given with --from is installed as it is."
  fi
else
  if [ -n "$SOURCE" ]; then
    URL="$SOURCE"
  elif [ "$VERSION" = "latest" ]; then
    URL="https://github.com/$REPO/releases/latest/download/technitium-console.tar.gz"
  else
    URL="https://github.com/$REPO/releases/download/$VERSION/technitium-console.tar.gz"
  fi
  command -v curl >/dev/null 2>&1 || die "curl is needed to download, or pass a local tarball with --from."
  curl -fsSL "$URL" -o "$TMP/console.tar.gz" || die "could not download the console from $URL"
  ok "Console downloaded" "$(du -h "$TMP/console.tar.gz" | cut -f1)"
  if [ -n "$SOURCE" ]; then
    warn "It is not verified: a URL given with --from has no checksum to hold it to."
  else
    # Every release publishes the tarball's SHA-256 next to it, as sha256sum
    # writes it (.github/workflows/release.yml, "Pack"). No checksum, no install.
    curl -fsSL "$URL.sha256" -o "$TMP/console.tar.gz.sha256" \
      || die "the release publishes no checksum at $URL.sha256. Not installing what cannot be checked."
    verify_checksum "$TMP/console.tar.gz" "$TMP/console.tar.gz.sha256" \
      || die "the download does not match the checksum the release publishes. Nothing was changed."
    ok "Checksum matches the release" "sha256"
  fi
fi

# Owners come from this machine, not from whoever packed the archive.
tar --no-same-owner -xzf "$TMP/console.tar.gz" -C "$TMP/dist" || die "that file is not a valid archive."
[ -f "$TMP/dist/index.html" ] || die "the archive does not look like a built console."

INSTALLED_AT="$(state_get webroot)"
if [ "$INSTALLED_AT" = "$WWW_DIR" ] && [ -f "$WWW_DIR/js/main.js" ]; then
  # Upstream's installer updates by extracting over its folder, so a server
  # update puts its own console back on top of ours without removing ours.
  warn "The DNS server was updated since this console was installed: it put its"
  warn "own console back on top of this one. Replacing it again."
  warn "The backup still holds the console of $(state_get server_version), not of the version running now."
fi

if [ "$MODE" = "replacement" ]; then
  BACKUP="$WWW_DIR$BACKUP_SUFFIX"
  if [ -d "$BACKUP" ]; then
    ok "Original console already saved" "$BACKUP"
  elif [ -d "$WWW_DIR" ] && [ -f "$WWW_DIR/index.html" ]; then
    cp -a "$WWW_DIR" "$BACKUP"
    ok "Original console backed up" "$BACKUP"
    state_set server_version "${SERVER_VERSION:-unknown}"
  fi
else
  BACKUP=""
fi

CUSTOM_COUNT=0
for f in "$WWW_DIR"/json/*-custom.json; do
  if [ -f "$f" ]; then CUSTOM_COUNT=$((CUSTOM_COUNT + 1)); fi
done
if [ "$CUSTOM_COUNT" -gt 0 ]; then
  ok "Your custom lists stay where they are" "$CUSTOM_COUNT file(s)"
fi

if [ "$MODE" = "side-by-side" ] && [ -n "$SERVER_APP" ]; then
  carry_custom_lists "$SERVER_APP/www" "$WWW_DIR"
fi

confirm "Install the console in $WWW_DIR?"

state_set phase publishing
state_set webroot "$WWW_DIR"
state_set mode "$MODE"
if [ -n "$BACKUP" ]; then state_set backup "$BACKUP"; fi
if [ -n "$INTO_VOLUME" ]; then
  # Every check has passed (the mount point, W6, the checksum, the archive), and
  # nothing is copied yet: from here on the volume is the console's, finished or
  # not. Written by rename, like every file publish writes.
  rm -f "$WWW_DIR/$MARKER.tc-new"
  printf 'technitium-console sha256:%s\n' "$(sha256sum "$TMP/console.tar.gz" | cut -d' ' -f1)" > "$WWW_DIR/$MARKER.tc-new"
  mv -f "$WWW_DIR/$MARKER.tc-new" "$WWW_DIR/$MARKER"
fi
publish "$TMP/dist" "$WWW_DIR" "$TMP"
state_set version "$VERSION"
state_set phase done
ok "Console installed" "$WWW_DIR"

if [ -n "$INTO_VOLUME" ]; then
  say ""
  say "A DNS server that mounts this volume and names it in $VAR_NAME"
  say "is serving it already: it needs no restart. To update, run a newer image of"
  say "this one. To remove it: $DOCKER_DOCS"
  printf '\n'
  exit 0
fi

if [ "$RESTART_NEEDED" = "yes" ]; then
  say ""
  say "The server is still serving its old folder: the path it serves is read once,"
  say "when it starts. This is the only change that needs a restart."
  confirm "Restart the DNS server now?"
  restart_server
else
  # It does not need one. The file provider resolves every request against the
  # folder, so a console replaced underneath a running server is served at once.
  asset="$(cd "$TMP/dist" && find assets -name '*.js' -type f 2>/dev/null | head -1 || true)"
  if [ -n "$asset" ] && web_answers; then
    if web_serves "$asset"; then
      ok "Serving the new console" "$(web_base)"
    else
      warn "The console is in place but $(web_base) is not serving it."
      warn "If your web console answers somewhere else, pass --url and run this again."
    fi
  fi
fi

if in_container_layer "$WWW_DIR"; then
  say ""
  warn "This ran inside a container, and $WWW_DIR is part of the container's own"
  warn "files: the console goes the next time the container is recreated (an image"
  warn "update, docker compose pull and up). Our Docker image installs it where it stays:"
  warn "$DOCKER_DOCS"
fi

printf '\n  To go back:  %s --uninstall\n\n' "$ONE_LINER"
