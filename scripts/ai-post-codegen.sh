#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cd "$ROOT_DIR"

# Cursor imports Claude hooks too; only its native hooks should do the work.
if [[ "${2:-}" == "claude" && -n "${CURSOR_VERSION:-}" ]]; then
  if [[ "${1:-}" == "start" ]]; then
    printf '%s\n' '{"continue":true}'
  else
    printf '%s\n' '{}'
  fi
  exit 0
fi

case "${1:-}" in
  edit)
    exec bun run ultracite fix --hook
    ;;
  start|check)
    exec bun "$ROOT_DIR/scripts/ai-handoff.ts" "$@"
    ;;
  *)
    echo "Usage: $0 {edit|start|check} [claude|cursor]" >&2
    exit 64
    ;;
esac
