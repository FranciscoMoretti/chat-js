#!/usr/bin/env bash
set -euo pipefail
# Leave room in the 15-client Supabase session pool for both workers and deploy checks.
export DATABASE_MAX_CONNECTIONS="${DATABASE_MAX_CONNECTIONS:-1}"
export WORKFLOW_POSTGRES_MAX_POOL_SIZE="${WORKFLOW_POSTGRES_MAX_POOL_SIZE:-2}"
export NODE_EXTRA_CA_CERTS="$PWD/deployment/render/supabase-ca.crt"
# Match the failed 16.3.0 deployment for the Next.js upgrade comparison.
export NODE_OPTIONS="${NODE_OPTIONS:-} --max-old-space-size=128 --max-semi-space-size=4"
cd apps/chat
exec node node_modules/next/dist/bin/next start --hostname 0.0.0.0 --port "${PORT:-10000}"
