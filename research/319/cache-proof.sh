#!/usr/bin/env bash
# Run from the repository root, with Node 24 first on PATH and Bun installed.
set -euo pipefail
bun test:types
saved319=$(mktemp -d "${TMPDIR:-/tmp}/chatjs319-cache.XXXXXX")
restore319() {
  if [[ ! -d packages/thread/dist && -d "$saved319/dist" ]]; then
    mv "$saved319/dist" packages/thread/dist
  fi
  rm -rf "$saved319"
}
trap restore319 EXIT
mv packages/thread/dist "$saved319/dist"
bun test:types
test -s packages/thread/dist/index.d.ts
printf 'PASS: cached type check restored Thread declarations\n'
