#!/bin/sh
# Starts the standalone image: checks TECHNITIUM_URL, writes the one generated
# piece of the nginx configuration, and becomes nginx. A wrong variable ends here
# with a single line, before nginx prints anything.
set -eu

fail() {
  echo "technitium-console: $1" >&2
  exit 1
}

form='http://host:port or https://host:port (for example http://192.168.1.10:5380)'
url="${TECHNITIUM_URL:-}"
[ -n "$url" ] || fail "TECHNITIUM_URL is required: set it to the address of your Technitium server, as $form."

# What passes here is written into the nginx configuration, so only the shape of
# a URL gets through. The value itself is never printed: it may hold a password.
case "$url" in
  *[!!-~]*) fail "TECHNITIUM_URL holds spaces or characters a URL cannot have. It must look like $form." ;;
esac
parsed="$(printf '%s\n' "$url" | sed -nE 's#^(https?)://(\[[0-9A-Fa-f:.]+\]|[A-Za-z0-9]([A-Za-z0-9._-]*[A-Za-z0-9])?)(:([1-9][0-9]{0,4}))?/?$#\1 \2 \5#p')"
[ -n "$parsed" ] || fail "TECHNITIUM_URL is not valid. It must look like $form, with nothing after the port."
# shellcheck disable=SC2086 # the three words above, on purpose
set -- $parsed
scheme="$1"
host="$2"
port="${3:-}"
[ "${port:-1}" -le 65535 ] || fail "TECHNITIUM_URL has a port above 65535."

# Address literals need no lookup. A dotted number that is not an address is a typo.
literal=false
case "$host" in
  \[*:*:*\]) literal=true ;;
  \[*) fail "TECHNITIUM_URL is not valid: the IPv6 address between the brackets is malformed." ;;
  *[!0-9.]*) ;;
  *)
    printf '%s\n' "$host" | awk -F. 'NF != 4 { exit 1 } { for (i = 1; i <= 4; i++) if ($i == "" || $i > 255) exit 1 }' \
      || fail "TECHNITIUM_URL is not valid: the IPv4 address is malformed."
    literal=true
    ;;
esac

# What the request is sent to, and how it names the server. They differ only for
# a name found in /etc/hosts.
authority="$host${port:+:$port}"
target="$authority"
resolver=''
if [ "$literal" = false ]; then
  # /etc/hosts first, as the system's own lookups do. nginx's resolver only speaks
  # DNS, and extra_hosts, --add-host and host.docker.internal live in this file.
  address="$(awk -v name="$host" 'BEGIN { name = tolower(name) } !/^[[:space:]]*#/ { for (i = 2; i <= NF; i++) if (tolower($i) == name) { print $1; exit } }' /etc/hosts 2>/dev/null || true)"
  if [ -n "$address" ]; then
    case "$address" in *:*) address="[$address]" ;; esac
    target="$address${port:+:$port}"
  else
    # The nameserver this container was given: Docker's own on a user network,
    # and the host's on the default bridge or the host network. Only the first
    # one, the one the system would ask: nginx would rotate through them all.
    nameserver="$(awk '$1 == "nameserver" && $2 !~ /%/ { print $2; exit }' /etc/resolv.conf 2>/dev/null || true)"
    [ -n "$nameserver" ] || fail "cannot look up $host: /etc/resolv.conf names no nameserver. Use an IP address in TECHNITIUM_URL."
    case "$nameserver" in *:*) nameserver="[$nameserver]" ;; esac
    resolver="resolver $nameserver valid=10s;
resolver_timeout 5s;"
  fi
fi

generated=/tmp/technitium-console/upstream.conf
{
  mkdir -p "${generated%/*}" && {
    echo 'listen 8080;'
    if [ -e /proc/net/if_inet6 ]; then echo 'listen [::]:8080;'; fi
    if [ -n "$resolver" ]; then printf '%s\n' "$resolver"; fi
    echo "set \$technitium_url \"$scheme://$target\";"
    echo "set \$technitium_host \"$authority\";"
    echo "set \$technitium_sni \"$host\";"
  } > "$generated"
} 2>/dev/null || fail "cannot write to /tmp. With a read-only root filesystem, add --tmpfs /tmp."

echo "technitium-console: on port 8080, forwarding the API to $scheme://$authority"
exec nginx -g 'daemon off;'
