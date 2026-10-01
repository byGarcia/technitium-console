#!/bin/sh
# Which of Docker's floating tags the release TAG moves, printed on one line
# (`X.Y latest`, `X.Y`, or nothing). The repo's tags come on stdin, as
# `git ls-remote --tags --refs origin 'v*'` prints them or one name a line.
#
# Floating tags only ever move forward: latest goes to the highest release in
# the repo and X.Y to the highest of its own line, so re-running an old tag or
# tagging a backport points neither back in time. Prereleases are not releases
# here: they move neither. Called right before the tags move, never from an
# earlier job's outputs, which "Re-run failed jobs" would hand back unchanged.
set -eu

[ $# -eq 1 ] || { echo "usage: git ls-remote --tags --refs origin 'v*' | $0 vX.Y.Z" >&2; exit 2; }
tag="$1"

releases="$(sed 's|.*refs/tags/||' | { grep -Ex 'v[0-9]+\.[0-9]+\.[0-9]+' || true; } | sort -V)"

if ! printf '%s\n' "$tag" | grep -Eqx 'v[0-9]+\.[0-9]+\.[0-9]+'; then
  echo "$tag is not a release (vX.Y.Z): no floating tags" >&2
  exit 0
fi
# A release that cannot find itself among the tags has not read them.
if ! printf '%s\n' "$releases" | grep -Fqx "$tag"; then
  echo "::error::$tag is not among the tags read from origin" >&2
  exit 1
fi

line="$(printf '%s\n' "$tag" | cut -d. -f1-2)."
top="$(printf '%s\n' "$releases" | tail -n1)"
top_of_line="$(printf '%s\n' "$releases" | awk -v p="$line" 'index($0, p) == 1' | tail -n1)"

floating=""
if [ "$tag" = "$top_of_line" ]; then floating="$(printf '%s\n' "${tag#v}" | cut -d. -f1-2)"; fi
if [ "$tag" = "$top" ]; then floating="${floating:+$floating }latest"; fi
echo "$tag: highest release $top, highest of its line $top_of_line -> floating tags: ${floating:-none}" >&2
printf '%s\n' "$floating"
