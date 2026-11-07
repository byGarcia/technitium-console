# Distro packaging

The console is static files a Technitium DNS Server serves from a folder.
These packages only lay those files down and tell you how to point the
server at them. They never guess the service name, restart anything, or
touch the server's configuration.

The recommended path on a live server is still the one-line installer
([README](../README.md#installing)): it finds the running service,
verifies what it serves, and can roll back. Use these packages for
managed fleets, offline installs, and Arch systems.

All of them install the same bundle (`npm run build` output) into
`/usr/share/technitium-console`. On Technitium 15.5 or later, serve it with:

```sh
DNS_SERVER_WEB_SERVICE_WWW_FOLDER_PATH=/usr/share/technitium-console
```

then restart the DNS service once. Removing the package never touches
the server's configuration: take the variable out (or unmount) and
restart once to go back to the stock console.

## Build everything

```sh
npm ci && npm run build
sh packaging/build-deb.sh       # packaging/out/technitium-console_<ver>_all.deb
sh packaging/build-rpm.sh       # packaging/out/technitium-console-<ver>-1.*.noarch.rpm
sh packaging/build-appimage.sh  # packaging/out/technitium-console-<ver>-x86_64.AppImage
```

`packaging/out/` is git-ignored. Releases build the same files in CI with
[`.github/actions/distro-packages`](../.github/actions/distro-packages/action.yml)
(each payload diffed against `dist/`, each checksum re-verified before
publishing) and attach them to the GitHub release.

## .deb (Debian/Ubuntu)

`sh packaging/build-deb.sh` packs `dist/` plus `install.sh`, the license
and `packaging/deb/README.Debian` into an `all`-arch package. Its
`postinst` only prints the activation step above. Verify with
`dpkg-deb -c` and `lintian` if you have it.

## .rpm (Fedora/openSUSE/RHEL)

`sh packaging/build-rpm.sh` builds `packaging/rpm/technitium-console.spec`
with `rpmbuild -bb` under `packaging/out/rpmbuild`. Same layout and same
post-install note as the `.deb`.

## AppImage (portable preview)

`sh packaging/build-appimage.sh` bundles `dist/` with an `AppRun` that
serves it on `http://127.0.0.1:8080/` (`TECHNITIUM_CONSOLE_PORT` changes
the port) for local inspection:

```sh
./packaging/out/technitium-console-1.4.0-x86_64.AppImage
```

It is a preview of the bundle, not the DNS server: screens that need
`/api` will show the server as unreachable until pointed at one. To put
the console in front of a real server, use the one-line installer.

## Arch Linux (AUR)

Maintainer: 9M2PJU <9m2pju@gmail.com>

- `technitium-console-bin`: the release tarball, verified against its
  published checksum. `packaging/arch/technitium-console-bin/PKGBUILD`.
- `technitium-console-git`: built from git (`npm ci && npm run build`,
  with typecheck, lint and tests in `check()`).
  `packaging/arch/technitium-console-git/PKGBUILD`.

Both provide/conflict `technitium-console`, install to
`/usr/share/technitium-console`, and print the activation step on
install/upgrade via `technitium-console.install`.

### Submitting a new version to the AUR

Every pull request already builds both packages on GitHub
([`packaging.yml`](../.github/workflows/packaging.yml): makepkg plus
namcap in Arch containers, and the full test suite in the `distro` job),
so this is only the push itself. Bump `pkgver` in both PKGBUILDs (and the
-bin `sha256sums` from the release's `technitium-console.tar.gz.sha256`),
then refresh metadata:

```sh
cd packaging/arch/technitium-console-bin && makepkg --printsrcinfo > .SRCINFO
cd ../technitium-console-git && makepkg --printsrcinfo > .SRCINFO
```

Push each package base to the AUR (needs an AUR account with this key):

```sh
git clone ssh://aur@aur.archlinux.org/technitium-console-bin.git /tmp/aur-bin
cp packaging/arch/technitium-console-bin/{PKGBUILD,.SRCINFO,technitium-console.install} /tmp/aur-bin/
cd /tmp/aur-bin && git add PKGBUILD .SRCINFO technitium-console.install \
  && git commit -m "Update to <ver>" && git push
# ... same for technitium-console-git
```

## The one-line installer

`install.sh` at the repository root is the installer and uninstaller:

```sh
# Install (Technitium 15.5+ on systemd gets its own folder + drop-in, one restart):
curl -sSL https://raw.githubusercontent.com/byGarcia/technitium-console/main/install.sh | sudo sh
# Update: run the same command again (no restart).
# Uninstall (back to the stock console):
curl -sSL https://raw.githubusercontent.com/byGarcia/technitium-console/main/install.sh | sudo sh -s -- --uninstall
```

It is POSIX `sh`, verifies the running server process instead of
guessing paths, checks every download against the release checksum, and
is covered by `docs/2026-09-07-installer-contract.md` and
`dev/installer-probe.sh`. Distro packages intentionally do less than
it; when in doubt, use it.
