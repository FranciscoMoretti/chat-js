#!/usr/bin/env bash
set -euo pipefail
export NODE_EXTRA_CA_CERTS="$PWD/deployment/render/supabase-ca.crt"
cd apps/chat
exec node node_modules/next/dist/bin/next start --hostname 0.0.0.0 --port "${PORT:-10000}"
