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
# It is POSIX sh: the official image is Debian, but people run this on Alpine too.

set -eu

REPO="byGarcia/technitium-console"
STATE_DIR="/var/lib/technitium-console"
STATE="$STATE_DIR/install.state"
BACKUP_SUFFIX=".original"
VAR_NAME="DNS_SERVER_WEB_SERVICE_WWW_FOLDER_PATH"

VERSION="latest"
SOURCE=""                    # local file or URL, for air-gapped installs
WWW_DIR=""
WEB_URL=""
ACTION="install"
ASSUME_YES="no"
ALLOW_MISMATCH="no"

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
    --dir)       WWW_DIR="${2:?--dir needs a path}"; shift ;;
    --url)       WEB_URL="${2:?--url needs a base URL}"; shift ;;
    --yes|-y)    ASSUME_YES="yes" ;;
    --restore-mismatched-backup) ALLOW_MISMATCH="yes" ;;
    --help|-h)   usage ;;
    *)           die "unknown option: $1  (try --help)" ;;
  esac
  shift
done

[ "$(id -u)" = "0" ] || die "this has to run as root: prefix it with sudo."

printf '\n  \033[1mtechnitium-console\033[0m\n\n'

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
server_pid() {
  for d in /proc/[0-9]*; do
    [ -r "$d/cmdline" ] || continue
    if tr '\0' '\n' < "$d/cmdline" 2>/dev/null | grep -q 'DnsServerApp\.dll$'; then
      basename "$d"
      return 0
    fi
  done
  return 1
}
server_app_folder() {
  tr '\0' '\n' < "/proc/$1/cmdline" | grep 'DnsServerApp\.dll$' | head -1 | sed 's|/DnsServerApp\.dll$||'
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

# ---------------------------------------------------------------- where it goes
MODE=""              # replacement | side-by-side
RESTART_NEEDED="no"
SERVER_VERSION=""

resolve_target() {
  SERVER_VERSION="$(server_version)"
  pid="$(server_pid || true)"

  if [ -n "$WWW_DIR" ]; then
    MODE="${1:-replacement}"
    return 0
  fi

  if [ -n "$pid" ]; then
    configured="$(server_env "$pid" "$VAR_NAME")"
    app="$(server_app_folder "$pid")"

    if [ -n "$configured" ]; then
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
      ok "Technitium DNS Server found" "$WWW_DIR"
      return 0
    fi
  fi

  # Nothing running here. Either the server is in a container, or this is a host
  # preparing a folder to mount into one.
  for d in /opt/technitium/dns/www /etc/dns/www; do
    if [ -d "$d" ]; then
      WWW_DIR="$d"; MODE="replacement"
      ok "Technitium DNS Server found" "$WWW_DIR"
      return 0
    fi
  done

  if command -v docker >/dev/null 2>&1 && docker ps --format '{{.Image}}' 2>/dev/null | grep -q 'technitium/dns-server'; then
    say "Technitium is running in Docker, so its web root is inside the container."
    say "Install to a folder on the host and mount it over the container's:"
    say ""
    say "  sudo $0 --dir /opt/technitium-console"
    say ""
    say "then add this to the service in your compose file and bring it up again:"
    say ""
    say "    volumes:"
    say "      - /opt/technitium-console:/opt/technitium/dns/www:ro"
    say ""
    exit 0
  fi
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
  cp -f "$1/$3" "$2/$3.tc-new"
  mv -f "$2/$3.tc-new" "$2/$3"
}

publish() {
  src="$1"; dst="$2"; list="$3"
  mkdir -p "$dst"

  ( cd "$src" && find . -type f ! -name index.html -print ) | sed 's|^\./||' > "$list"
  while IFS= read -r f; do [ -n "$f" ] && copy_one "$src" "$dst" "$f"; done < "$list"

  ( cd "$src" && find . -type f -name index.html -print ) | sed 's|^\./||' \
    | awk '{ n = gsub(/\//, "/"); print n " " $0 }' | sort -rn | cut -d' ' -f2- > "$list"
  while IFS= read -r f; do [ -n "$f" ] && copy_one "$src" "$dst" "$f"; done < "$list"

  ( cd "$dst" && find . -type f -print ) | sed 's|^\./||' > "$list"
  while IFS= read -r f; do
    [ -n "$f" ] || continue
    case "$f" in $CUSTOM_GLOB) continue ;; esac
    [ -e "$src/$f" ] || rm -f "$dst/$f"
  done < "$list"
  find "$dst" -depth -type d -empty -exec rmdir {} + 2>/dev/null || true
}

carry_custom_lists() { # from, to — used when the served folder changes
  [ -d "$1/json" ] || return 0
  for f in "$1"/json/*-custom.json; do
    [ -f "$f" ] || continue
    mkdir -p "$2/json"
    [ -e "$2/json/$(basename "$f")" ] || cp -f "$f" "$2/json/$(basename "$f")"
  done
}

confirm() { # question
  [ "$ASSUME_YES" = "yes" ] && return 0
  [ -t 0 ] || return 0
  printf '\n  %s [y/N] ' "$1"
  read -r answer
  printf '\n'
  case "$answer" in [yY]*) return 0 ;; *) die "nothing was changed." ;; esac
}

find_systemd_unit() {
  # Upstream's installer writes dns.service; the Proxmox community script writes
  # technitium.service. Match on what the unit runs, not on what it is called.
  for unit in /etc/systemd/system/*.service /lib/systemd/system/*.service; do
    [ -f "$unit" ] || continue
    if grep -q 'DnsServerApp\.dll' "$unit" 2>/dev/null; then basename "$unit"; return 0; fi
  done
  return 1
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
  BACKUP="$(state_get backup)"
  [ -n "$BACKUP" ] || BACKUP="$WWW_DIR$BACKUP_SUFFIX"
  RECORDED_MODE="$(state_get mode)"
  [ -n "$RECORDED_MODE" ] || RECORDED_MODE="$MODE"

  if [ "$RECORDED_MODE" = "side-by-side" ]; then
    pid="$(server_pid || true)"
    stock=""
    [ -n "$pid" ] && stock="$(server_app_folder "$pid")/www"
    [ -n "$stock" ] && [ -d "$stock" ] || die "cannot find the console the server ships to hand back to."
    carry_custom_lists "$WWW_DIR" "$stock"
    rm -rf "$WWW_DIR"
    state_clear
    ok "Console removed" "$WWW_DIR"
    say "Unset $VAR_NAME and the server goes back to its own console."
    confirm "Restart the DNS server now so it stops looking at a folder that is gone?"
    restart_server
    printf '\n'
    exit 0
  fi

  # Replacement mode: the backup is the authority, not a marker in the web root.
  [ -d "$BACKUP" ] || die "the original console is not at $BACKUP: there is nothing to restore."

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

  LIST="$(mktemp)"; trap 'rm -f "$LIST"' EXIT INT TERM
  publish "$BACKUP" "$WWW_DIR" "$LIST"       # custom lists in place are kept: see copy_one
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
# shellcheck disable=SC2064
trap "rm -rf '$TMP'" EXIT INT TERM

if [ -n "$SOURCE" ] && [ -f "$SOURCE" ]; then
  cp "$SOURCE" "$TMP/console.tar.gz"
  ok "Console read from file" "$SOURCE"
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
fi

tar -xzf "$TMP/console.tar.gz" -C "$TMP/dist" || die "that file is not a valid archive."
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

if [ "$MODE" = "side-by-side" ]; then
  pid="$(server_pid || true)"
  if [ -n "$pid" ]; then carry_custom_lists "$(server_app_folder "$pid")/www" "$WWW_DIR"; fi
fi

confirm "Install the console in $WWW_DIR?"

state_set phase publishing
state_set webroot "$WWW_DIR"
state_set mode "$MODE"
if [ -n "$BACKUP" ]; then state_set backup "$BACKUP"; fi
LIST="$TMP/list"
publish "$TMP/dist" "$WWW_DIR" "$LIST"
state_set version "$VERSION"
state_set phase done
ok "Console installed" "$WWW_DIR"

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

printf '\n  To go back:  sudo sh install.sh --uninstall\n\n'
