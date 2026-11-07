#!/bin/sh
# Builds packaging/out/technitium-console_1.4.0_all.deb from dist/.
# Run from the repository root: sh packaging/build-deb.sh
set -eu
cd "$(dirname "$0")/.."

VERSION="$(node -p "require('./package.json').version")"
[ -d dist ] && [ -f dist/index.html ] || { echo "dist/ missing: run 'npm ci && npm run build' first." >&2; exit 1; }

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT INT TERM
ROOT="$WORK/technitium-console_${VERSION}_all"
mkdir -p "$ROOT/DEBIAN" "$ROOT/usr/share/technitium-console" "$ROOT/usr/share/doc/technitium-console"

cp -a dist/. "$ROOT/usr/share/technitium-console/"
find "$ROOT/usr/share/technitium-console" -type f -exec chmod 0644 {} +
find "$ROOT/usr/share/technitium-console" -type d -exec chmod 0755 {} +
cp install.sh "$ROOT/usr/share/doc/technitium-console/install.sh"
cp LICENSE "$ROOT/usr/share/doc/technitium-console/copyright"
cp packaging/deb/README.Debian "$ROOT/usr/share/doc/technitium-console/README.Debian"
chmod 0644 "$ROOT/usr/share/doc/technitium-console/install.sh" \
  "$ROOT/usr/share/doc/technitium-console/copyright" \
  "$ROOT/usr/share/doc/technitium-console/README.Debian"
cp packaging/deb/postinst "$ROOT/DEBIAN/postinst"
chmod 0755 "$ROOT/DEBIAN/postinst"
sed "s/^Version: .*/Version: $VERSION/" packaging/deb/control > "$ROOT/DEBIAN/control"

mkdir -p packaging/out
dpkg-deb --build --root-owner-group "$ROOT" "packaging/out/technitium-console_${VERSION}_all.deb"
echo "Built: packaging/out/technitium-console_${VERSION}_all.deb"
