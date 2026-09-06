#!/usr/bin/env bash
set -euo pipefail
app_dir=$(cd "$(dirname "$0")/.." && pwd)
pg_bin=${PG_BIN:-/opt/homebrew/opt/postgresql@17/bin}
pg_port=${M29_PG_PORT:-55586}
data_dir="$app_dir/.postgres/data"
mkdir -p "$data_dir"
if [[ ! -f "$data_dir/PG_VERSION" ]]; then
 "$pg_bin/initdb" --auth=trust --encoding=UTF8 --no-locale "$data_dir" >/dev/null
fi
if ! "$pg_bin/pg_ctl" -D "$data_dir" status >/dev/null 2>&1; then
 "$pg_bin/pg_ctl" -D "$data_dir" -l "$app_dir/.postgres/postgres.log" -o "-h 127.0.0.1 -p $pg_port -k /tmp" start
fi
for database in m29 m29_effects; do
 if [[ $("$pg_bin/psql" -h 127.0.0.1 -p "$pg_port" postgres -tAc "SELECT 1 FROM pg_database WHERE datname='$database'") != 1 ]]; then
  "$pg_bin/createdb" -h 127.0.0.1 -p "$pg_port" "$database"
 fi
done
