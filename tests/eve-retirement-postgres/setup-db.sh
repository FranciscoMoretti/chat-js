#!/usr/bin/env bash
set -euo pipefail
repo_root="$(cd "$(dirname "$0")/../.." && pwd)"
handoff="${1:?Supply connection.json from cluster.sh}"
lane="${2:?Supply lane_a, lane_b, lane_c or lane_d}"
database_url="$(bun -e '
const [file,lane]=process.argv.slice(1);
const data=await Bun.file(file).json();
if(!["lane_a","lane_b","lane_c","lane_d"].includes(lane)) throw new Error("Unknown lane");
if((await Bun.file(`${data.root}/ownership`).text()).trim()!=="chatjs-retirement-disposable-v1") throw new Error("Missing disposable ownership");
const url=new URL(data.databases[lane]);
if(url.hostname!=="127.0.0.1" || url.username!=="retirement" || url.pathname!==`/${lane}` || Number(url.port)!==data.port) throw new Error("Invalid disposable URL");
console.log(url.href);
' "$handoff" "$lane")"
# Explicit URLs win over dotenv fallback. No provider credentials are forwarded.
env -i PATH="$PATH" HOME="$HOME" DATABASE_URL="$database_url" DATABASE_MIGRATION_URL="$database_url" bun --cwd "$repo_root/apps/chat" lib/db/migrate.ts
env -i PATH="$PATH" HOME="$HOME" DATABASE_URL="$database_url" WORKFLOW_POSTGRES_URL="$database_url" NODE_ENV=development bun --cwd "$repo_root/apps/chat" scripts/eve-setup.ts
printf 'Application migrations and patched Workflow schema/fences ready: %s\n' "$lane"
