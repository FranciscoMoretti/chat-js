#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cd "$ROOT_DIR"

case "${1:-}" in
  edit)
    exec bun run ultracite fix --hook
    ;;
  start|check)
    exec bun "$ROOT_DIR/scripts/ai-handoff.ts" "$@"
    ;;
  *)
    echo "Usage: $0 {edit|start|check} [cursor]" >&2
    exit 64
    ;;
esac
