#!/usr/bin/env bash
set -euo pipefail
# Leave room in the 15-client Supabase session pool for the shared worker and deploy checks.
export DATABASE_MAX_CONNECTIONS="${DATABASE_MAX_CONNECTIONS:-1}"
export WORKFLOW_POSTGRES_MAX_POOL_SIZE="${WORKFLOW_POSTGRES_MAX_POOL_SIZE:-2}"
export NODE_EXTRA_CA_CERTS="$PWD/deployment/render/supabase-ca.crt"
npm install --global node-gyp
bun install --frozen-lockfile
(cd apps/chat && bunx tsx lib/db/migrate.ts && bunx tsx scripts/eve-setup.ts)
bun run --cwd apps/chat build
