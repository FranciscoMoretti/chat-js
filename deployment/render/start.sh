#!/usr/bin/env bash
set -euo pipefail
# Leave room in the 15-client Supabase session pool for both workers and deploy checks.
export DATABASE_MAX_CONNECTIONS="${DATABASE_MAX_CONNECTIONS:-1}"
export WORKFLOW_POSTGRES_MAX_POOL_SIZE="${WORKFLOW_POSTGRES_MAX_POOL_SIZE:-2}"
export NODE_EXTRA_CA_CERTS="$PWD/deployment/render/supabase-ca.crt"
cd apps/chat
exec node node_modules/next/dist/bin/next start --hostname 0.0.0.0 --port "${PORT:-10000}"
