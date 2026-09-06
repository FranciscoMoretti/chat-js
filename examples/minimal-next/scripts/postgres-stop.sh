#!/usr/bin/env bash
set -euo pipefail
app_dir=$(cd "$(dirname "$0")/.." && pwd)
"${PG_BIN:-/opt/homebrew/opt/postgresql@17/bin}/pg_ctl" -D "$app_dir/.postgres/data" stop
