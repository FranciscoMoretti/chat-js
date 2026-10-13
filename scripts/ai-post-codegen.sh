#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cd "$ROOT_DIR"

case "${1:-}" in
  edit)
    exec bun run ultracite fix --hook
    ;;
  check)
    if ! bun run lint >&2 || ! bun run test:types >&2; then
      exit 2
    fi
    printf '{}\n'
    ;;
  *)
    echo "Usage: $0 {edit|check}" >&2
    exit 64
    ;;
esac
