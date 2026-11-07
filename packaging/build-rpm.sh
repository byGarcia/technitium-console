#!/bin/sh
# Builds an RPM from dist/ into packaging/out/.
# Run from the repository root: sh packaging/build-rpm.sh
set -eu
cd "$(dirname "$0")/.."

VERSION="$(node -p "require('./package.json').version")"
[ -d dist ] && [ -f dist/index.html ] || { echo "dist/ missing: run 'npm ci && npm run build' first." >&2; exit 1; }
command -v rpmbuild >/dev/null 2>&1 || { echo "rpmbuild is needed and is not installed." >&2; exit 1; }

TOPDIR="$PWD/packaging/out/rpmbuild"
rm -rf "$TOPDIR"
mkdir -p "$TOPDIR/BUILD" "$TOPDIR/RPMS" "$TOPDIR/SOURCES" "$TOPDIR/SPECS" "$TOPDIR/SRPMS"
cp packaging/rpm/technitium-console.spec "$TOPDIR/SPECS/"
sed -i "s/^Version:.*/Version:        $VERSION/" "$TOPDIR/SPECS/technitium-console.spec"
cp -a dist "$TOPDIR/SOURCES/dist"
cp install.sh LICENSE "$TOPDIR/SOURCES/"

rpmbuild --define "_topdir $TOPDIR" -bb "$TOPDIR/SPECS/technitium-console.spec"
cp "$TOPDIR/RPMS/noarch/"*.rpm packaging/out/
echo "Built: packaging/out/$(ls "$TOPDIR/RPMS/noarch/" | tr '\n' ' ')"
