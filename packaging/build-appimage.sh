#!/bin/sh
# Builds packaging/out/technitium-console-<version>-x86_64.AppImage from dist/.
# Run from the repository root: sh packaging/build-appimage.sh
set -eu
cd "$(dirname "$0")/.."

VERSION="$(node -p "require('./package.json').version")"
[ -d dist ] && [ -f dist/index.html ] || { echo "dist/ missing: run 'npm ci && npm run build' first." >&2; exit 1; }
command -v appimagetool >/dev/null 2>&1 || { echo "appimagetool is needed and is not installed." >&2; exit 1; }

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT INT TERM
APPDIR="$WORK/technitium-console.AppDir"
mkdir -p "$APPDIR/usr/share/technitium-console" "$APPDIR/usr/share/doc/technitium-console"

cp -a dist/. "$APPDIR/usr/share/technitium-console/"
find "$APPDIR/usr/share/technitium-console" -type f -exec chmod 0644 {} +
cp install.sh LICENSE "$APPDIR/usr/share/doc/technitium-console/"
cp packaging/appimage/AppRun "$APPDIR/AppRun"
chmod 0755 "$APPDIR/AppRun"
cp packaging/appimage/technitium-console.desktop "$APPDIR/"
cp public/favicon.svg "$APPDIR/technitium-console.svg"

mkdir -p packaging/out
ARCH=x86_64 appimagetool "$APPDIR" "packaging/out/technitium-console-${VERSION}-x86_64.AppImage"
chmod +x "packaging/out/technitium-console-${VERSION}-x86_64.AppImage"
echo "Built: packaging/out/technitium-console-${VERSION}-x86_64.AppImage"
