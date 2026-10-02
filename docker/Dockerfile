# The init image of technitium-console (README, "Docker"). It copies the console
# into the volume mounted at /target and exits; the official DNS server mounts
# the same volume read-only and serves it.
#
# No RUN: nothing executes at build time, so the three platforms build anywhere
# without emulation, and the image holds exactly what the context holds: the
# release's tarball and checksum, and the install.sh of the same tag (contract D4).
#
# No VOLUME either: without a volume at /target the installer refuses, instead of
# copying the console into an anonymous volume nobody mounts.
FROM busybox:stable
COPY install.sh technitium-console.tar.gz technitium-console.tar.gz.sha256 /usr/share/technitium-console/
ENTRYPOINT ["/bin/sh", "/usr/share/technitium-console/install.sh", "--into-volume", "/target", "--from", "/usr/share/technitium-console/technitium-console.tar.gz", "--yes"]
