#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cd "$ROOT_DIR"

case "${1:-}" in
  edit)
    exec bun run ultracite fix --hook
    ;;
  check)
    status=0
    bun run lint >&2 || status=2
    bun run test:types >&2 || status=2
    [ "$status" -eq 0 ] || exit "$status"
    printf '{}\n'
    ;;
  *)
    echo "Usage: $0 {edit|check}" >&2
    exit 64
    ;;
esac
