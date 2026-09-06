#!/usr/bin/env bash
set -euo pipefail
app_dir=$(cd "$(dirname "$0")/.." && pwd)
pg_bin=${PG_BIN:-/opt/homebrew/opt/postgresql@17/bin}
pg_port=${M07_PG_PORT:-55479}
data_dir="$app_dir/.postgres/data"
mkdir -p "$data_dir"
if [[ ! -f "$data_dir/PG_VERSION" ]]; then
 "$pg_bin/initdb" --auth=trust --encoding=UTF8 --no-locale "$data_dir" >/dev/null
fi
"$pg_bin/pg_ctl" -D "$data_dir" -l "$app_dir/.postgres/postgres.log" -o "-h 127.0.0.1 -p $pg_port -k $app_dir/.postgres" start
"$pg_bin/createdb" -h 127.0.0.1 -p "$pg_port" m07
