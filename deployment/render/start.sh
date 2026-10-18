#!/usr/bin/env bash
set -euo pipefail
# Leave room in the 15-client Supabase session pool for both workers and deploy checks.
export DATABASE_MAX_CONNECTIONS="${DATABASE_MAX_CONNECTIONS:-1}"
export WORKFLOW_POSTGRES_MAX_POOL_SIZE="${WORKFLOW_POSTGRES_MAX_POOL_SIZE:-2}"
export NODE_EXTRA_CA_CERTS="$PWD/deployment/render/supabase-ca.crt"
# Temporary bounded probes while diagnosing the free-compute readiness failure.
(
  for attempt in {1..12}; do
    sleep 15
    for probe in "${PORT:-10000}/api/health" "4274/eve/v1/health" "4275/eve/v1/health"; do
      status=$(curl --silent --output /dev/null --max-time 6 --write-out '%{http_code}' "http://127.0.0.1:$probe" || true)
      echo "[DEBUG-render-readiness] attempt=$attempt probe=$probe status=$status"
    done
    if [[ -r /sys/fs/cgroup/memory.current ]]; then
      echo "[DEBUG-render-readiness] memory_bytes=$(cat /sys/fs/cgroup/memory.current)"
    fi
  done
) &
# Three Node processes share the free instance's 512 MiB memory budget.
export NODE_OPTIONS="${NODE_OPTIONS:-} --max-old-space-size=128 --max-semi-space-size=4"
cd apps/chat
exec node node_modules/next/dist/bin/next start --hostname 0.0.0.0 --port "${PORT:-10000}"
