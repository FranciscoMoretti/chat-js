#!/usr/bin/env bash
set -euo pipefail
export NODE_EXTRA_CA_CERTS="$PWD/deployment/render/supabase-ca.crt"
npm install --global node-gyp
bun install --frozen-lockfile
bun run --cwd apps/chat build
